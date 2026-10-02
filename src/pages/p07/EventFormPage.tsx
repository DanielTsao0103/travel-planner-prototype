/**
 * Page 7 — Add an event (/trip/:id/event/new) and edit or view one
 * (/trip/:id/event/:eventId).
 *
 * Doc: "add an event to the itinerary seen on page 8 … 2 ways to get that
 * information. 1 - a simple where, when, cost, and who is coming. When they
 * plan the where and when, find out how busy the location typically is at
 * that time, and let them know. 2 - or they can upload a screenshot of a
 * confirmation, and we will pull the info from the screenshot, and they can
 * fill in any gaps."
 *
 * This file only decides WHICH screen to show:
 *   edit/add form (EventEditor) · read-only view (EventView, 7I/7J) ·
 *   locked "can't add" (Viewers, past trips) · not found.
 *
 * Query params:  tab=upload · s=busy|conflict|reading|review|unreadable (forced states)
 *                day=YYYY-MM-DD (or date=) and start=HH:MM prefill "When"
 *                return=<in-app path> where Back / Save go
 */

import { CalendarX2, ChevronRight } from 'lucide-react';
import type { Trip } from '../../data/types';
import { useTrip, type TripContext } from '../../hooks/useTrip';
import { dayNumber, formatDateRange } from '../../lib/dates';
import { myTrips, tripAccess } from '../../store/selectors';
import { Link } from '../../router/router';
import { matchRoute, paths } from '../../router/routes';
import { PageHeader } from '../../components/layout/PageHeader';
import { PlacePhoto } from '../../components/domain/PlacePhoto';
import { Button } from '../../components/ui/Button';
import { Banner, EmptyState } from '../../components/ui/Display';
import { isISODate, safeReturnPath } from './draft';
import { EventEditor, type BackLink } from './EventEditor';
import { EventView } from './EventView';
import './p07.css';

/** The query params this page reads (the remount key is built from these). */
const PAGE_KEYS = ['s', 'tab', 'day', 'start', 'return'];

/** Name the page `return` points at, for "← Day 2" and "Back to Day 2". */
function backFor(returnPath: string | null, trip: Trip): BackLink {
  if (!returnPath) return { to: paths.itinerary(trip.id), label: 'Itinerary', phrase: 'the itinerary' };
  const route = matchRoute(returnPath.split('?')[0]);
  const named = (label: string, phrase = label): BackLink => ({ to: returnPath, label, phrase });
  switch (route.name) {
    case 'day':
      return isISODate(route.params.date) ? named(`Day ${dayNumber(trip, route.params.date)}`) : named('Day');
    case 'itinerary':
      return named('Itinerary', 'the itinerary');
    case 'dashboard':
      return named('Trip dashboard', 'the trip dashboard');
    case 'ideas':
      return named('Ideas', 'ideas');
    case 'trips':
      return named('My trips');
    case 'map':
    case 'trip-map':
      return named('Map', 'the map');
    case 'budget':
      return named('Budget', 'the budget');
    case 'people':
      return named('People', 'people');
    case 'home':
      return named('Home');
    default:
      return named('Back', 'where you were');
  }
}

/** Page 7's entry point: picks the screen for this trip, event, and person. */
export function EventFormPage({ tripId, eventId, query }: { tripId: string; eventId?: string; query: URLSearchParams }) {
  const ctx = useTrip(tripId);
  if (!ctx) return <Missing kind="trip" />;
  const { state, trip, access } = ctx;
  const back = backFor(safeReturnPath(query.get('return')), trip);
  // Re-mount the form when the trip, event, or page-specific params change (e.g. a different
  // forced state). Global params (auth, as, date, time) are left out on purpose: the app
  // strips them from the address right after load, and that shouldn't wipe the form.
  const key = [trip.id, eventId ?? 'new', ...PAGE_KEYS.map((k) => query.get(k) ?? '')].join('|');

  if (eventId) {
    const event = state.events.find((e) => e.id === eventId && e.tripId === trip.id);
    if (!event) return <Missing kind="event" trip={trip} />;
    // Viewers, other people's days (Day editors), and past trips: read-only (7I / 7J).
    if (!access.canEditDay(event.date)) return <EventView ctx={ctx} event={event} back={back} />;
    return <EventEditor key={key} ctx={ctx} event={event} query={query} back={back} />;
  }
  if (!access.canAddEvents) return <AddLocked ctx={ctx} back={back} />;
  return <EventEditor key={key} ctx={ctx} query={query} back={back} />;
}

/** Viewers (and everyone on a past trip) can't add events: say why, and offer trips they can add to. */
function AddLocked({ ctx, back }: { ctx: TripContext; back: BackLink }) {
  const { state, trip, access } = ctx;
  const others = myTrips(state).filter((t) => t.id !== trip.id && tripAccess(state, t).canAddEvents);
  return (
    <div className="container page p07">
      <PageHeader back={{ to: back.to, label: back.label }} eyebrow={trip.title} title="Add an event" />
      <div className="p07-locked">
        <Banner tone="locked" title={access.isPast ? 'Past trip' : 'You can’t add events to this trip'}>
          {access.lockReason('editEvents')}
        </Banner>
        <div>
          <Button to={back.to} variant="secondary">
            Back to {back.phrase}
          </Button>
        </div>
        {others.length > 0 && (
          <section className="p07-others" aria-labelledby="p07-others-title">
            <h2 id="p07-others-title" className="p07-others-title">
              Add to one of your other trips
            </h2>
            <ul className="p07-others-list">
              {others.map((t) => (
                <li key={t.id}>
                  <Link to={paths.newEvent(t.id)} className="p07-other">
                    <PlacePhoto photo={t.coverPhoto} destination={t.destinations[0]} alt="" category="landmark" className="p07-other-photo" />
                    <span className="p07-other-text">
                      <strong>{t.title}</strong>
                      <span className="num">{formatDateRange(t.startDate, t.endDate)}</span>
                    </span>
                    <ChevronRight aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}

/** The trip or event in the address doesn't exist (or you're not on that trip). */
function Missing({ kind, trip }: { kind: 'trip' | 'event'; trip?: Trip }) {
  return (
    <div className="container page p07">
      <EmptyState
        icon={<CalendarX2 />}
        title={kind === 'trip' ? 'We couldn’t find that trip' : 'This event isn’t on the trip anymore'}
        actions={kind === 'trip' || !trip ? <Button to={paths.trips()}>Go to My trips</Button> : <Button to={paths.itinerary(trip.id)}>Back to the itinerary</Button>}
      >
        {kind === 'trip' ? 'It may have been deleted, or you’re not on it.' : 'Someone may have deleted it. The rest of the itinerary is still there.'}
      </EmptyState>
    </div>
  );
}
