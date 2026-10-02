/**
 * Page 5 — My trips.
 *
 * Doc: "list every single trip the user has ever created or been invited to
 * (and has accepted the invitation). Let this include past trips, so they can
 * still view the itineraries. When they open an existing trip, have it go to
 * page 8 (day-by-day itinerary) for that trip. There needs to be a button to
 * add new events, that will open page 7."
 *
 * Layout: invitations first (they need an answer), then trips grouped by
 * phase: Happening now · Upcoming · Past. Cards sit in a 3-column grid on
 * desktop, 2 on tablet, and a single column on phones.
 *
 * Forced states (?s=):  empty (5B) · loading (5C) · created (5D) · past (5E)
 */

import { useEffect, useRef, useState, type ReactNode, type Ref } from 'react';
import { CalendarPlus, Compass, Eye, Lock, Luggage, Plus, ShieldCheck, SlidersHorizontal, UserPlus, X } from 'lucide-react';
import type { AppState, Person, Trip } from '../../data/types';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import { plural } from '../../lib/format';
import { simulateLatency } from '../../services/http';
import { acceptInvite, clearHighlights, declineInvite } from '../../store/actions';
import { acceptedMemberIds, currentPerson, getPerson, myTrips, pendingInvites, phaseOf, today, tripAccess, tripEvents } from '../../store/selectors';
import { getState, useAppState } from '../../store/store';
import { toast } from '../../store/toast';
import { navigate, withQuery } from '../../router/router';
import { paths } from '../../router/routes';
import { PageHeader } from '../../components/layout/PageHeader';
import { TripCard } from '../../components/domain/TripCard';
import { Button, IconButton } from '../../components/ui/Button';
import { Banner, EmptyState, Loading, Skeleton } from '../../components/ui/Display';
import { InviteCard } from './InviteCard';
import './p05.css';

/** The forced states the screen index can open (see src/proto/screens/p05.ts). */
type Forced = 'empty' | 'loading' | 'created' | 'past' | null;

/** Read `?s=` into one of this page's forced states (or null for the live page). */
function readForced(query: URLSearchParams): Forced {
  const s = query.get('s');
  return s === 'empty' || s === 'loading' || s === 'created' || s === 'past' ? s : null;
}

/** Page 5's entry point (the router renders this for /trips). */
export function TripsPage({ query }: { query: URLSearchParams }) {
  const forced = readForced(query);
  // A new `key` re-mounts the view, so switching forced states starts fresh.
  return <TripsView key={forced ?? 'live'} forced={forced} createdParam={query.get('created')} />;
}

/**
 * For `?s=created`: the most recently created non-sample trip you own,
 * falling back to Maya's brand-new "Zion Weekend", then any trip you own.
 */
function forcedCreatedTripId(s: AppState): string | null {
  const me = currentPerson(s);
  const mine = myTrips(s).filter((t) => t.ownerId === me?.id);
  const newest = mine.filter((t) => !t.isSample).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  if (newest) return newest.id;
  if (myTrips(s).some((t) => t.id === 'trip-zion')) return 'trip-zion';
  return mine[0]?.id ?? null;
}

/**
 * @param createdParam `?created=<tripId>` from Page 6 right after saving: a backup for the
 *   store's `ui.justCreatedTripId`, which other pages can clear.
 */
function TripsView({ forced, createdParam }: { forced: Forced; createdParam: string | null }) {
  const state = useAppState();
  const bp = useBreakpoint();
  const isMobile = bp === 'mobile';

  const trips = forced === 'empty' ? [] : myTrips(state);
  const invites = forced === 'empty' ? [] : pendingInvites(state);

  // Page 6 sets `ui.justCreatedTripId` right before it sends you here. We copy it
  // into local state, then clear the store flag when you leave, so the
  // "Trip created" banner shows once (and survives React's dev double-mount).
  const [createdId, setCreatedId] = useState<string | null>(() => (forced === 'created' ? forcedCreatedTripId(getState()) : (createdParam ?? getState().ui.justCreatedTripId)));
  useEffect(() => () => clearHighlights('trip'), []);
  // Tidy the address bar once `?created=` has been read, so a reload doesn't show the banner again.
  useEffect(() => {
    if (createdParam) navigate(withQuery(paths.trips(), { s: forced ?? undefined }), { replace: true });
  }, [createdParam, forced]);
  const createdTrip = createdId ? trips.find((t) => t.id === createdId) : undefined;

  // Trips are local, so they load instantly. With the Prototype's "Slow mode"
  // on, we pause briefly so the loading state (5C) can be seen naturally.
  const [slowLoading, setSlowLoading] = useState(() => getState().demo.slowMode);
  useEffect(() => {
    if (!slowLoading) return;
    let alive = true;
    void simulateLatency(400).then(() => alive && setSlowLoading(false));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const loading = forced === 'loading' || slowLoading;

  // Group by where each trip is relative to the demo clock.
  const active = trips.filter((t) => phaseOf(state, t) === 'active');
  const upcoming = trips.filter((t) => phaseOf(state, t) === 'upcoming');
  // Most recent past trip first.
  const past = trips.filter((t) => phaseOf(state, t) === 'past').sort((a, b) => b.startDate.localeCompare(a.startDate));

  // 5E: bring the Past section into view. Waits a beat because the app
  // scrolls to the top whenever the page changes.
  const pastRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (forced !== 'past' || loading) return;
    const t = window.setTimeout(() => pastRef.current?.scrollIntoView({ block: 'start' }), 120);
    return () => window.clearTimeout(t);
  }, [forced, loading]);

  const counts = [active.length ? `${active.length} happening now` : '', upcoming.length ? `${upcoming.length} upcoming` : '', past.length ? `${past.length} past` : '']
    .filter(Boolean)
    .join(' · ');

  const showEmpty = !loading && trips.length === 0;

  const subtitle = loading ? 'Loading your trips…' : trips.length ? `${counts}. Open a trip to see its day-by-day itinerary.` : 'Trips you create or join will show up here.';

  return (
    <div className="container page p05">
      <PageHeader
        title="My trips"
        subtitle={subtitle}
        actions={
          // The empty state has its own "New trip" button, so skip the duplicate.
          showEmpty ? undefined : (
            <Button to={paths.newTrip()} icon={<Plus />} block={isMobile}>
              New trip
            </Button>
          )
        }
      />

      {loading ? (
        <TripsSkeleton cards={isMobile ? 2 : 3} />
      ) : (
        <div className="p05-body">
          {createdTrip && (
            <CreatedBanner
              trip={createdTrip}
              onDismiss={() => {
                setCreatedId(null);
                clearHighlights('trip');
              }}
            />
          )}

          {invites.length > 0 && <InvitationsSection invites={invites} />}

          {showEmpty ? (
            <div className="p05-empty">
              <EmptyState
                icon={<Luggage />}
                title="No trips yet"
                actions={
                  <>
                    <Button to={paths.newTrip()} icon={<Plus />}>
                      New trip
                    </Button>
                    <Button to={paths.home()} variant="secondary" icon={<Compass />}>
                      Browse trip ideas
                    </Button>
                  </>
                }
              >
                <p>Create a trip to start planning with your group.</p>
                <p className="p05-empty-note">
                  {invites.length > 0
                    ? 'Accept an invitation above and that trip will show up here too.'
                    : 'When someone invites you to their trip, the invitation will show up here for you to accept.'}
                </p>
              </EmptyState>
            </div>
          ) : (
            <>
              {active.length > 0 && (
                <TripSection id="p05-now" title="Happening now" count={active.length}>
                  <TripGrid trips={active} highlightId={createdTrip?.id} />
                </TripSection>
              )}

              <TripSection id="p05-upcoming" title="Upcoming" count={upcoming.length}>
                {upcoming.length > 0 ? (
                  <TripGrid trips={upcoming} highlightId={createdTrip?.id} />
                ) : (
                  <EmptyState
                    compact
                    title="Nothing coming up"
                    actions={
                      <Button to={paths.newTrip()} variant="secondary" icon={<Plus />}>
                        Plan a trip
                      </Button>
                    }
                  >
                    Your next adventure starts with a name and a place.
                  </EmptyState>
                )}
              </TripSection>

              {past.length > 0 && (
                <TripSection
                  id="p05-past"
                  ref={pastRef}
                  title="Past"
                  count={past.length}
                  emphasized={forced === 'past'}
                  note={
                    <>
                      <Lock aria-hidden /> Past trips are view-only. Open one to look back at its itinerary and budget.
                    </>
                  }
                >
                  <TripGrid trips={past} highlightId={createdTrip?.id} />
                </TripSection>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

/* --------------------------------------------------------------- sections */

/** A titled group of trips with a count, an optional note, and optional emphasis (5E). */
function TripSection({
  id,
  title,
  count,
  note,
  emphasized,
  ref,
  children,
}: {
  id: string;
  title: string;
  count: number;
  note?: ReactNode;
  emphasized?: boolean;
  /** React 19 lets function components take `ref` as a normal prop. */
  ref?: Ref<HTMLElement>;
  children: ReactNode;
}) {
  return (
    <section id={id} ref={ref} className={`p05-section ${emphasized ? 'is-emphasized' : ''}`} aria-labelledby={`${id}-title`}>
      <div className="p05-section-head">
        <h2 id={`${id}-title`} className="p05-section-title">
          {title}
          <span className="p05-count num" aria-label={plural(count, 'trip')}>
            {count}
          </span>
        </h2>
        {note && <p className="p05-section-note">{note}</p>}
      </div>
      {children}
    </section>
  );
}

/** The responsive card grid (3 / 2 / 1 columns). */
function TripGrid({ trips, highlightId }: { trips: Trip[]; highlightId?: string }) {
  return (
    <ul className="p05-grid" role="list">
      {trips.map((trip) => (
        <li key={trip.id} className="p05-grid-item">
          <TripTile trip={trip} highlight={trip.id === highlightId} />
        </li>
      ))}
    </ul>
  );
}

/**
 * One trip: the shared TripCard plus this page's actions.
 *  - Open → the trip's itinerary (Page 8)
 *  - Add event → Page 7 with this trip preselected; locked for Viewers, hidden on past trips
 */
function TripTile({ trip, highlight }: { trip: Trip; highlight: boolean }) {
  const state = useAppState();
  const access = tripAccess(state, trip);
  const phase = phaseOf(state, trip);
  const people = acceptedMemberIds(trip)
    .map((id) => getPerson(state, id))
    .filter((p): p is Person => !!p);

  const actions =
    phase === 'past' ? (
      <Button to={paths.itinerary(trip.id)} variant="secondary" icon={<Eye />} aria-label={`View the itinerary for ${trip.title}`}>
        View itinerary
      </Button>
    ) : (
      <>
        <Button to={paths.itinerary(trip.id)} variant="secondary" aria-label={`Open ${trip.title}`}>
          Open
        </Button>
        {access.canAddEvents ? (
          <Button to={paths.newEvent(trip.id)} variant="subtle" icon={<Plus />} aria-label={`Add an event to ${trip.title}`}>
            Add event
          </Button>
        ) : (
          <Button variant="subtle" locked={access.lockReason('editEvents')} aria-label={`Add event (locked): ${access.lockReason('editEvents')}`}>
            Add event
          </Button>
        )}
      </>
    );

  return <TripCard trip={trip} role={access.role} people={people} phase={phase} today={today(state)} to={paths.itinerary(trip.id)} actions={actions} highlight={highlight} />;
}

/* ------------------------------------------------------------ invitations */

/** Pending invitations with Accept / Decline. Accepting continues to the preferences survey. */
function InvitationsSection({ invites }: { invites: Trip[] }) {
  const state = useAppState();
  const me = currentPerson(state);

  const accept = (trip: Trip) => {
    acceptInvite(trip.id);
    toast({ title: `You joined ${trip.title}`, body: 'Next, share your food and travel preferences with the group.' });
    // The survey page reads `trip` and `return`, then sends you to the itinerary.
    navigate(withQuery(paths.survey(), { trip: trip.id, return: paths.itinerary(trip.id) }));
  };

  const decline = (trip: Trip) => {
    declineInvite(trip.id);
    toast({ title: 'Invitation declined', body: `${trip.title} won’t appear in your trips.`, tone: 'info' });
  };

  return (
    <section id="p05-invites" className="p05-section" aria-labelledby="p05-invites-title">
      <div className="p05-section-head">
        <h2 id="p05-invites-title" className="p05-section-title">
          Invitations
          <span className="p05-count num is-info" aria-label={plural(invites.length, 'invitation')}>
            {invites.length}
          </span>
        </h2>
        <p className="p05-section-note">Accept to see the plan and add your preferences.</p>
      </div>
      <div className="p05-invites">
        {invites.map((trip) => {
          const mine = trip.members.find((m) => m.personId === me?.id);
          const inviter = getPerson(state, mine?.invitedById ?? trip.ownerId);
          const people = acceptedMemberIds(trip)
            .map((id) => getPerson(state, id))
            .filter((p): p is Person => !!p);
          return (
            <InviteCard
              key={trip.id}
              trip={trip}
              inviter={inviter}
              people={people}
              role={mine?.role ?? 'viewer'}
              today={today(state)}
              onAccept={() => accept(trip)}
              onDecline={() => decline(trip)}
            />
          );
        })}
      </div>
    </section>
  );
}

/* --------------------------------------------------------- created (5D) */

/** "Trip created" banner with the next steps as buttons (5D). */
function CreatedBanner({ trip, onDismiss }: { trip: Trip; onDismiss: () => void }) {
  const state = useAppState();
  const hasEvents = tripEvents(state, trip.id).length > 0;
  const surveyLink = withQuery(paths.survey(), { trip: trip.id, return: paths.itinerary(trip.id) });
  return (
    <div className="p05-created">
      <Banner tone="success" title="Trip created">
        <p className="p05-created-text">
          <strong>{trip.title}</strong> is ready. Pick a next step, or come back to these anytime from the trip.
        </p>
        <div className="p05-next">
          <Button to={paths.newEvent(trip.id)} icon={<CalendarPlus />} size="sm">
            {hasEvents ? 'Add an event' : 'Add your first event'}
          </Button>
          <Button to={withQuery(paths.people(trip.id), { section: 'collaborators' })} variant="secondary" icon={<ShieldCheck />} size="sm">
            Set permissions
          </Button>
          <Button to={surveyLink} variant="secondary" icon={<SlidersHorizontal />} size="sm">
            Fill out your preferences
          </Button>
          <Button to={withQuery(paths.people(trip.id), { s: 'invite' })} variant="secondary" icon={<UserPlus />} size="sm">
            Invite more people
          </Button>
        </div>
      </Banner>
      <IconButton label="Dismiss" icon={<X />} size="sm" className="p05-created-close" onClick={onDismiss} />
    </div>
  );
}

/* --------------------------------------------------------- loading (5C) */

/** Skeleton cards shaped like the real TripCard. */
function TripsSkeleton({ cards }: { cards: number }) {
  return (
    <Loading label="Loading your trips">
      <div className="p05-body" aria-hidden>
        <div className="p05-section">
          <Skeleton width={160} height={26} />
          <div className="p05-grid">
            {Array.from({ length: cards }, (_, i) => (
              <div key={i} className="p05-skel-card">
                <Skeleton height="auto" radius={0} className="p05-skel-media" />
                <div className="p05-skel-body">
                  <Skeleton width="70%" height={22} />
                  <Skeleton width="55%" height={14} />
                  <Skeleton width="45%" height={14} />
                  <div className="row-between">
                    <Skeleton width={96} height={26} radius={13} />
                    <Skeleton width={60} height={22} radius={11} />
                  </div>
                  <div className="row">
                    <Skeleton width="50%" height={40} radius={10} />
                    <Skeleton width="50%" height={40} radius={10} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Loading>
  );
}
