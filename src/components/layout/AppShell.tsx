/**
 * The frame around every signed-in page:
 *  - header: the doc's 3-line menu (Page 4), wordmark / trip switcher, account menu
 *  - trip navigation: tabs on tablet/desktop, a bottom tab bar on phones
 *  - the "Prototype" controls (demo date, View as, simulations) — clearly
 *    separated from the app itself
 */

import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  CalendarDays,
  ChevronDown,
  Compass,
  FlaskConical,
  Home,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Map as MapIcon,
  Menu,
  PiggyBank,
  Plane,
  Sparkles,
  UserRound,
  Users,
  X,
} from 'lucide-react';
import { APP_NAME } from '../../config';
import type { Trip } from '../../data/types';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import { logOut } from '../../store/actions';
import { activeTrip, currentPerson, currentTrip, myTrips, phaseOf } from '../../store/selectors';
import { useAppState } from '../../store/store';
import { toast } from '../../store/toast';
import { Link, navigate, useRoute } from '../../router/router';
import { paths, type MatchedRoute } from '../../router/routes';
import { formatDateRange } from '../../lib/dates';
import { IconButton } from '../ui/Button';
import { Avatar, Badge } from '../ui/Display';
import { Popover } from '../ui/Overlay';
import { PrototypeDrawer } from './PrototypeDrawer';
import './shell.css';

/** Routes that belong to one trip and show the trip navigation. */
const TRIP_ROUTES = new Set(['itinerary', 'ideas', 'dashboard', 'day', 'budget', 'people', 'trip-map']);

export function AppShell({ route, children }: { route: MatchedRoute; children: ReactNode }) {
  const state = useAppState();
  const bp = useBreakpoint();
  const location = useRoute();
  // `?s=menu` opens the 3-line menu (screen index deep link for 4C/4D).
  const [menuOpen, setMenuOpen] = useState(location.query.get('s') === 'menu');
  const [protoOpen, setProtoOpen] = useState(false);
  useEffect(() => {
    setMenuOpen(location.query.get('s') === 'menu');
  }, [location.path, location.query]);
  const me = currentPerson(state);
  const tripId = route.params.tripId;
  const trip = tripId ? state.trips.find((t) => t.id === tripId) : undefined;
  const inTrip = !!trip && TRIP_ROUTES.has(route.name);

  return (
    <div className={`app ${inTrip ? 'has-trip-nav' : ''}`}>
      <a href="#main" className="skip-link" onClick={(e) => { e.preventDefault(); document.getElementById('main')?.focus(); }}>
        Skip to content
      </a>
      <header className="app-header">
        <div className="app-header-inner container">
          <IconButton label={menuOpen ? 'Close menu' : 'Open menu'} icon={menuOpen ? <X /> : <Menu />} onClick={() => setMenuOpen((v) => !v)} aria-expanded={menuOpen} aria-controls="main-menu" />
          {inTrip && bp === 'mobile' ? (
            <TripSwitcher trip={trip!} routeName={route.name} compact />
          ) : (
            <Link to={paths.home()} className="wordmark" aria-label={`${APP_NAME} home`}>
              <span className="wordmark-mark" aria-hidden>
                <Compass />
              </span>
              <span className="wordmark-text">{APP_NAME}</span>
            </Link>
          )}
          {inTrip && bp !== 'mobile' && <TripSwitcher trip={trip!} routeName={route.name} />}
          <div className="grow" />
          {bp !== 'mobile' && (
            <button type="button" className="proto-pill" onClick={() => setProtoOpen(true)}>
              <FlaskConical aria-hidden />
              Prototype
            </button>
          )}
          {me && (
            <Popover
              label="Account"
              align="end"
              width={260}
              trigger={(props) => (
                <button type="button" className="avatar-btn" aria-label="Account menu" {...props}>
                  <Avatar person={me} size={34} />
                </button>
              )}
            >
              {(close) => (
                <div className="stack-xs">
                  <div className="account-card">
                    <p className="account-name">{me.name}</p>
                    <p className="account-email">{me.email}</p>
                  </div>
                  <div className="menu-sep" />
                  <Link to={paths.trips()} className="menu-item" onClick={close}>
                    <Plane aria-hidden /> My trips
                  </Link>
                  <Link to={paths.survey()} className="menu-item" onClick={close}>
                    <UserRound aria-hidden /> My preferences
                  </Link>
                  <button type="button" className="menu-item" onClick={() => { close(); setProtoOpen(true); }}>
                    <FlaskConical aria-hidden /> Prototype controls
                  </button>
                  <div className="menu-sep" />
                  <button
                    type="button"
                    className="menu-item"
                    onClick={() => {
                      close();
                      logOut();
                      navigate(paths.login());
                    }}
                  >
                    <LogOut aria-hidden /> Log out
                  </button>
                </div>
              )}
            </Popover>
          )}
        </div>
      </header>

      <MainMenu open={menuOpen} onClose={() => setMenuOpen(false)} onOpenPrototype={() => setProtoOpen(true)} />

      {inTrip && bp !== 'mobile' && <TripTabs trip={trip!} routeName={route.name} />}

      <main id="main" className="app-main" tabIndex={-1}>
        {children}
      </main>

      {inTrip && bp === 'mobile' && <BottomTabBar trip={trip!} routeName={route.name} />}

      <PrototypeDrawer open={protoOpen} onClose={() => setProtoOpen(false)} contextTripId={trip?.id} />
    </div>
  );
}

/* ------------------------------------------------------------- main menu */

/**
 * The doc's 3-line menu: Budget (12), Calendar (11), Map (17),
 * Collaborators (13), Pre-planned trips (coming soon). Trip-specific items open
 * for the "current trip", which the menu names so it's never ambiguous.
 */
function MainMenu({ open, onClose, onOpenPrototype }: { open: boolean; onClose: () => void; onOpenPrototype: () => void }) {
  const state = useAppState();
  const trip = currentTrip(state);
  const navRef = useRef<HTMLElement>(null);
  // Move focus into the menu once when it opens (keyboard users can Tab through items).
  useEffect(() => {
    if (open) navRef.current?.focus();
  }, [open]);
  if (!open) return null;
  const go = (to: string) => {
    onClose();
    navigate(to);
  };
  return (
    <div className="main-menu-root" onKeyDown={(e) => e.key === 'Escape' && onClose()}>
      <div className="main-menu-backdrop" onClick={onClose} aria-hidden />
      <nav id="main-menu" className="main-menu" aria-label="Main menu" tabIndex={-1} ref={navRef}>
        <div className="main-menu-top show-mobile-only">
          <span className="wordmark-text">{APP_NAME}</span>
          <IconButton label="Close menu" icon={<X />} onClick={onClose} />
        </div>
        <button type="button" className="menu-item" onClick={() => go(paths.home())}>
          <Home aria-hidden /> Home
        </button>
        <div className="menu-sep" />
        <p className="main-menu-context">
          {trip ? (
            <>
              Opens for <strong>{trip.title}</strong>
            </>
          ) : (
            'Pick or create a trip to use these'
          )}
        </p>
        <button type="button" className="menu-item" onClick={() => go(paths.budgetCurrent())}>
          <PiggyBank aria-hidden /> Budget
        </button>
        <button type="button" className="menu-item" onClick={() => go(paths.calendar())}>
          <CalendarDays aria-hidden /> Calendar
        </button>
        <button type="button" className="menu-item" onClick={() => go(paths.map())}>
          <MapIcon aria-hidden /> Map
        </button>
        <button type="button" className="menu-item" onClick={() => go(paths.peopleCurrent())}>
          <Users aria-hidden /> Collaborators
        </button>
        <button
          type="button"
          className="menu-item is-disabled"
          aria-disabled="true"
          onClick={() => toast({ title: 'Pre-planned trips are coming soon', body: 'You’ll be able to start from other travelers’ itineraries.', tone: 'info' })}
        >
          <Compass aria-hidden /> Pre-planned trips <Badge tone="accent">Coming soon</Badge>
        </button>
        <div className="menu-sep" />
        <button type="button" className="menu-item" onClick={() => go(paths.trips())}>
          <Plane aria-hidden /> My trips
        </button>
        <div className="main-menu-proto">
          <button
            type="button"
            className="menu-item"
            onClick={() => {
              onClose();
              onOpenPrototype();
            }}
          >
            <FlaskConical aria-hidden /> Prototype controls
          </button>
          <button type="button" className="menu-item" onClick={() => go(paths.protoIndex())}>
            <ListChecks aria-hidden /> Screen index
          </button>
        </div>
      </nav>
    </div>
  );
}

/* ----------------------------------------------------------- trip switcher */

/** Map a trip route name to the same view on another trip. */
function sameViewOn(routeName: string, tripId: string, trip: Trip): string {
  switch (routeName) {
    case 'ideas':
      return paths.ideas(tripId);
    case 'dashboard':
      return paths.dashboard(tripId);
    case 'day':
      return paths.day(tripId, trip.startDate);
    case 'budget':
      return paths.budget(tripId);
    case 'people':
      return paths.people(tripId);
    case 'trip-map':
      return paths.tripMap(tripId);
    default:
      return paths.itinerary(tripId);
  }
}

function TripSwitcher({ trip, routeName, compact }: { trip: Trip; routeName: string; compact?: boolean }) {
  const state = useAppState();
  const trips = myTrips(state);
  return (
    <Popover
      label="Switch trip"
      width={320}
      trigger={(props) => (
        <button type="button" className={`trip-switcher ${compact ? 'is-compact' : ''}`} {...props} aria-label={`Current trip: ${trip.title}. Switch trip`}>
          <span className="trip-switcher-title truncate">{trip.title}</span>
          <ChevronDown aria-hidden />
        </button>
      )}
    >
      {(close) => (
        <div className="stack-xs">
          <p className="main-menu-context">Switch trip</p>
          {trips.map((t) => {
            const phase = phaseOf(state, t);
            return (
              <Link key={t.id} to={phase === 'past' && routeName === 'dashboard' ? paths.itinerary(t.id) : sameViewOn(routeName, t.id, t)} className={`menu-item trip-switch-item ${t.id === trip.id ? 'is-active' : ''}`} onClick={close}>
                <span className="stack-xs grow">
                  <span className="truncate">{t.title}</span>
                  <span className="xsmall muted num">{formatDateRange(t.startDate, t.endDate)}</span>
                </span>
                {phase === 'active' && <Badge tone="accent">Now</Badge>}
                {t.isSample && <Badge>Sample</Badge>}
              </Link>
            );
          })}
          <div className="menu-sep" />
          <Link to={paths.trips()} className="menu-item" onClick={close}>
            <Plane aria-hidden /> All trips
          </Link>
        </div>
      )}
    </Popover>
  );
}

/* ------------------------------------------------------------- trip tabs */

interface TabDef {
  key: string;
  label: string;
  to: string;
  icon: ReactNode;
  match: string[];
}

function tripTabs(trip: Trip, isActive: boolean): TabDef[] {
  const tabs: TabDef[] = [];
  if (isActive) tabs.push({ key: 'today', label: 'Today', to: paths.dashboard(trip.id), icon: <LayoutDashboard aria-hidden />, match: ['dashboard', 'day'] });
  tabs.push({ key: 'plan', label: 'Itinerary', to: paths.itinerary(trip.id), icon: <CalendarDays aria-hidden />, match: isActive ? ['itinerary'] : ['itinerary', 'day', 'dashboard'] });
  tabs.push({ key: 'ideas', label: 'Ideas', to: paths.ideas(trip.id), icon: <Sparkles aria-hidden />, match: ['ideas'] });
  tabs.push({ key: 'budget', label: 'Budget', to: paths.budget(trip.id), icon: <PiggyBank aria-hidden />, match: ['budget'] });
  tabs.push({ key: 'people', label: 'People', to: paths.people(trip.id), icon: <Users aria-hidden />, match: ['people'] });
  tabs.push({ key: 'map', label: 'Map', to: paths.tripMap(trip.id), icon: <MapIcon aria-hidden />, match: ['trip-map'] });
  return tabs;
}

function TripTabs({ trip, routeName }: { trip: Trip; routeName: string }) {
  const state = useAppState();
  const isActive = activeTrip(state)?.id === trip.id;
  return (
    <nav className="trip-tabs" aria-label="Trip sections">
      <div className="container trip-tabs-inner">
        {tripTabs(trip, isActive).map((t) => (
          <Link key={t.key} to={t.to} className={`trip-tab ${t.match.includes(routeName) ? 'is-active' : ''}`} aria-current={t.match.includes(routeName) ? 'page' : undefined}>
            {t.icon}
            {t.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}

/** Phones: five tabs max, so "Today" (during the trip) replaces "Itinerary". */
function BottomTabBar({ trip, routeName }: { trip: Trip; routeName: string }) {
  const state = useAppState();
  const isActive = activeTrip(state)?.id === trip.id;
  const tabs = tripTabs(trip, isActive).filter((t) => !(isActive && t.key === 'plan'));
  if (isActive) tabs[0] = { ...tabs[0], match: ['dashboard', 'day', 'itinerary'] };
  return (
    <nav className="bottom-tabs" aria-label="Trip sections">
      {tabs.map((t) => (
        <Link key={t.key} to={t.to} className={`bottom-tab ${t.match.includes(routeName) ? 'is-active' : ''}`} aria-current={t.match.includes(routeName) ? 'page' : undefined}>
          {t.icon}
          <span>{t.label}</span>
        </Link>
      ))}
    </nav>
  );
}
