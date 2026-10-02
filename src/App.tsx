/**
 * App root: matches the URL to a page, enforces sign-in, applies prototype
 * URL parameters, and auto-opens the trip dashboard during a trip (Page 10).
 */

import { lazy, Suspense, useEffect, type ComponentType } from 'react';
import { APP_NAME } from './config';
import { AppShell } from './components/layout/AppShell';
import { NoTripPage } from './components/layout/NoTripPage';
import { Skeleton } from './components/ui/Display';
import { Toaster } from './components/ui/Overlay';
import type { Role } from './data/types';
import { triggerNearby } from './features/nearby';
import { addDays } from './lib/dates';
import { markAutoOpened, setClock, setDemo, signUp } from './store/actions';
import { activeTrip, currentAccount, currentTrip, getTrip, jumpTarget, mySampleTrip, today } from './store/selectors';
import { getState, update, useAppState } from './store/store';
import { MAYA_ACCOUNT_ID } from './data/seed';
import { navigate, useRoute, withQuery } from './router/router';
import { matchRoute, paths, PUBLIC_ROUTES, type MatchedRoute } from './router/routes';

/* Pages load on demand so the first screen stays fast. */
const named = <T extends string>(loader: () => Promise<Record<T, ComponentType<any>>>, name: T) =>
  lazy(() => loader().then((m) => ({ default: m[name] })));

const AuthPage = named(() => import('./pages/p01/AuthPage'), 'AuthPage');
const ConnectPage = named(() => import('./pages/p02/ConnectPage'), 'ConnectPage');
const HomePage = named(() => import('./pages/p04/HomePage'), 'HomePage');
const TripsPage = named(() => import('./pages/p05/TripsPage'), 'TripsPage');
const TripFormPage = named(() => import('./pages/p06/TripFormPage'), 'TripFormPage');
const EventFormPage = named(() => import('./pages/p07/EventFormPage'), 'EventFormPage');
const ItineraryPage = named(() => import('./pages/p08/ItineraryPage'), 'ItineraryPage');
const IdeasPage = named(() => import('./pages/p09/IdeasPage'), 'IdeasPage');
const DashboardPage = named(() => import('./pages/p10/DashboardPage'), 'DashboardPage');
const DayPage = named(() => import('./pages/p11/DayPage'), 'DayPage');
const BudgetPage = named(() => import('./pages/p12/BudgetPage'), 'BudgetPage');
const PeoplePage = named(() => import('./pages/p13/PeoplePage'), 'PeoplePage');
const SurveyPage = named(() => import('./pages/p15/SurveyPage'), 'SurveyPage');
const NearbyPopup = named(() => import('./pages/p16/NearbyPopup'), 'NearbyPopup');
const MapPage = named(() => import('./pages/p17/MapPage'), 'MapPage');
const ScreenIndexPage = named(() => import('./proto/ScreenIndexPage'), 'ScreenIndexPage');
const ChecklistPage = named(() => import('./proto/ChecklistPage'), 'ChecklistPage');
const CreditsPage = named(() => import('./proto/CreditsPage'), 'CreditsPage');

const PAGE_TITLES: Record<number, string> = {
  1: 'Log in',
  2: 'Connect accounts',
  3: 'Connect accounts',
  4: 'Home',
  5: 'My trips',
  6: 'Trip details',
  7: 'Event',
  8: 'Itinerary',
  9: 'Ideas',
  10: 'Trip dashboard',
  11: 'Day',
  12: 'Budget',
  13: 'Group & permissions',
  15: 'Preferences',
  17: 'Map',
};

/** Global prototype URL params: ?auth=maya|new &as=viewer &date=during|before|after|YYYY-MM-DD &time=HH:MM &nearby=1 */
const GLOBAL_KEYS = ['auth', 'as', 'date', 'time', 'nearby'];
let newDemoAccounts = 0;

function applyGlobalParams(route: MatchedRoute, query: URLSearchParams, path: string): boolean {
  if (!GLOBAL_KEYS.some((k) => query.has(k))) return false;
  const auth = query.get('auth');
  if (auth === 'maya' && getState().sessionAccountId !== MAYA_ACCOUNT_ID) {
    update((d) => {
      d.sessionAccountId = MAYA_ACCOUNT_ID;
      d.ui.autoOpenedFor = null;
    });
  } else if (auth === 'new') {
    newDemoAccounts += 1;
    signUp({ name: 'Alex Rivera', email: `alex.rivera+${Date.now().toString(36)}${newDemoAccounts}@example.com`, password: 'demo-pass-1', provider: 'email' });
  }
  const as = query.get('as');
  if (as) setDemo({ viewAs: as === 'owner' || as === 'me' ? null : (as as Role) });

  const date = query.get('date');
  if (date) {
    const s = getState();
    const trip = getTrip(s, route.params.tripId) ?? mySampleTrip(s);
    if (date === 'during' && trip) setClock(jumpTarget(trip));
    else if (date === 'before' && trip) setClock({ date: addDays(trip.startDate, -14), time: '10:00' });
    else if (date === 'after' && trip) setClock({ date: addDays(trip.endDate, 4), time: '10:00' });
    else if (date === 'real') setClock(null);
    else if (/^\d{4}-\d{2}-\d{2}$/.test(date)) setClock({ date, time: query.get('time') ?? '12:00' });
  }
  if (query.get('nearby') === '1') {
    const s = getState();
    const trip = getTrip(s, route.params.tripId) ?? activeTrip(s);
    if (trip) window.setTimeout(() => void triggerNearby(trip.id, { force: true }), 600);
  }
  // Strip the global params so the address bar stays clean.
  const rest = new URLSearchParams(query);
  GLOBAL_KEYS.forEach((k) => rest.delete(k));
  const qs = rest.toString();
  navigate(qs ? `${path}?${qs}` : path, { replace: true });
  return true;
}

/* Nearby pop-up auto-trigger: once per trip per session, on the dashboard. */
const autoNearbyDone = new Set<string>();

export function App() {
  const location = useRoute();
  const state = useAppState();
  const route = matchRoute(location.path);
  const signedIn = !!currentAccount(state);

  // Prototype URL params.
  useEffect(() => {
    applyGlobalParams(route, location.query, location.path);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.full]);

  // Scroll to top and update the tab title on page change.
  useEffect(() => {
    window.scrollTo(0, 0);
    document.title = `${PAGE_TITLES[route.page] ?? 'Prototype'} · ${APP_NAME}`;
  }, [location.path, route.page]);

  // Sign-in guard: the app opens on Page 1.
  const needsAuth = !PUBLIC_ROUTES.includes(route.name);
  useEffect(() => {
    if (location.query.has('auth')) return;
    if (needsAuth && !signedIn) navigate(paths.login(), { replace: true });
    if ((route.name === 'login' || route.name === 'signup') && signedIn && !location.query.has('s')) navigate(paths.home(), { replace: true });
    if (route.name === 'not-found') navigate(signedIn ? paths.home() : paths.login(), { replace: true });
  }, [needsAuth, signedIn, route.name, location.query]);

  // Page 10 auto-opens during a trip (once per login/launch, so Home stays reachable).
  const live = signedIn ? activeTrip(state) : undefined;
  useEffect(() => {
    if (!live || route.name !== 'home' || location.query.has('s')) return;
    if (state.ui.autoOpenedFor === live.id) return;
    markAutoOpened(live.id);
    navigate(withQuery(paths.dashboard(live.id), { auto: 1 }), { replace: true });
  }, [live?.id, route.name, state.ui.autoOpenedFor]);

  // Page 16: "scan" for nearby matches a few seconds after the dashboard opens.
  useEffect(() => {
    if (route.name !== 'dashboard' || !live || route.params.tripId !== live.id) return;
    if (autoNearbyDone.has(live.id + today(state))) return;
    const t = window.setTimeout(() => {
      autoNearbyDone.add(live.id + today(getState()));
      void triggerNearby(live.id);
    }, 2800);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route.name, route.params.tripId, live?.id]);

  // Resolver routes from the menu (Budget, Calendar, Collaborators) → current trip.
  const resolverTarget = signedIn ? resolveCurrent(route) : null;
  useEffect(() => {
    if (resolverTarget) navigate(resolverTarget, { replace: true });
  }, [resolverTarget]);

  if (needsAuth && !signedIn) return <Toaster />;

  const page = renderPage(route, location.query);
  const bare = route.name === 'login' || route.name === 'signup' || (route.name === 'connect' || route.name === 'connect-service');
  return (
    <>
      {bare ? (
        <Suspense fallback={<PageFallback />}>{page}</Suspense>
      ) : (
        <AppShell route={route}>
          <Suspense fallback={<PageFallback />}>{page}</Suspense>
        </AppShell>
      )}
      {signedIn && state.ui.nearby && (
        <Suspense fallback={null}>
          <NearbyPopup />
        </Suspense>
      )}
      <Toaster />
    </>
  );
}

/** For /calendar, /budget, /people: send to the current trip (or show the no-trip state). */
function resolveCurrent(route: MatchedRoute): string | null {
  if (!['calendar', 'budget-current', 'people-current'].includes(route.name)) return null;
  const s = getState();
  const trip = currentTrip(s);
  if (!trip) return null;
  if (route.name === 'budget-current') return paths.budget(trip.id);
  if (route.name === 'people-current') return paths.people(trip.id);
  const d = today(s);
  const day = d >= trip.startDate && d <= trip.endDate ? d : trip.startDate;
  return withQuery(paths.day(trip.id, day), { from: 'calendar' });
}

function renderPage(route: MatchedRoute, query: URLSearchParams) {
  const p = route.params;
  switch (route.name) {
    case 'login':
      return <AuthPage mode="login" query={query} />;
    case 'signup':
      return <AuthPage mode="signup" query={query} />;
    case 'connect':
      return <ConnectPage query={query} />;
    case 'connect-service':
      return <ConnectPage service={p.service} query={query} />;
    case 'home':
      return <HomePage query={query} />;
    case 'trips':
      return <TripsPage query={query} />;
    case 'trip-new':
      return <TripFormPage query={query} />;
    case 'trip-edit':
      return <TripFormPage tripId={p.tripId} query={query} />;
    case 'event-new':
      return <EventFormPage tripId={p.tripId} query={query} />;
    case 'event-edit':
      return <EventFormPage tripId={p.tripId} eventId={p.eventId} query={query} />;
    case 'itinerary':
      return <ItineraryPage tripId={p.tripId} query={query} />;
    case 'ideas':
      return <IdeasPage tripId={p.tripId} query={query} />;
    case 'dashboard':
      return <DashboardPage tripId={p.tripId} query={query} />;
    case 'day':
      return <DayPage tripId={p.tripId} date={p.date} query={query} />;
    case 'budget':
      return <BudgetPage tripId={p.tripId} query={query} />;
    case 'people':
      return <PeoplePage tripId={p.tripId} query={query} />;
    case 'survey':
      return <SurveyPage query={query} />;
    case 'map':
      return <MapPage query={query} />;
    case 'trip-map':
      return <MapPage tripId={p.tripId} query={query} />;
    case 'calendar':
    case 'budget-current':
    case 'people-current':
      return <NoTripPage kind={route.name} />;
    case 'proto-index':
      return <ScreenIndexPage />;
    case 'proto-checklist':
      return <ChecklistPage />;
    case 'proto-credits':
      return <CreditsPage />;
    default:
      return null;
  }
}

function PageFallback() {
  return (
    <div className="container page stack-md" aria-busy="true">
      <Skeleton width={220} height={34} />
      <Skeleton height={18} width="60%" />
      <Skeleton height={160} radius={14} />
      <Skeleton height={160} radius={14} />
    </div>
  );
}
