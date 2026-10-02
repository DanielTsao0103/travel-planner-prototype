/**
 * The dashboard outside the trip dates (Page 10 only opens *during* a trip).
 *
 * - Before (10C): a locked state with a countdown, what the dashboard will
 *   show, and the way to the itinerary. A prototype-only hint can jump the demo
 *   clock into the trip.
 * - After (10D): the trip is over; links to the itinerary and to settling up.
 */

import type { ReactNode } from 'react';
import { ArrowRight, CalendarDays, CircleCheckBig, ListChecks, Lock, Navigation, PiggyBank, Timer } from 'lucide-react';
import type { AppState, ISODate, Trip } from '../../data/types';
import type { TripAccess } from '../../lib/permissions';
import { daysBetween, formatDateRange, formatShortDate, formatTime, relativeDays } from '../../lib/dates';
import { listJoin, money, plural } from '../../lib/format';
import { setClock } from '../../store/actions';
import { jumpTarget, personFirstName, tripDays, tripEvents, visibleReimbursements } from '../../store/selectors';
import { toast } from '../../store/toast';
import { paths } from '../../router/routes';
import { Button } from '../../components/ui/Button';
import { Banner } from '../../components/ui/Display';
import { PlacePhoto } from '../../components/domain/PlacePhoto';
import { eventLabel } from '../../components/domain/EventItem';
import './p10.css';

interface PhaseProps {
  state: AppState;
  trip: Trip;
  access: TripAccess;
  today: ISODate;
}

/** Prototype-only: move the demo clock into the trip (same as Prototype controls → Jump into trip). */
function jumpIntoTrip(trip: Trip) {
  const target = jumpTarget(trip);
  setClock(target);
  toast({ title: 'Demo clock moved into the trip', body: `It’s now ${formatShortDate(target.date)}, ${formatTime(target.time)}.`, tone: 'info' });
}

/** Shared frame: text on the left, the trip's cover photo on the right (photo first on phones). */
function GateLayout({ trip, photoBadge, photoCaption, past, children }: { trip: Trip; photoBadge: ReactNode; photoCaption?: ReactNode; past?: boolean; children: ReactNode }) {
  return (
    <div className="p10-gate">
      <figure className={`p10-gate-photo ${past ? 'is-past' : ''}`}>
        <PlacePhoto photo={trip.coverPhoto} destination={trip.destinations[0]} alt="" category="landmark" size="full" rounded={false} className="p10-gate-img" />
        <div className="p10-gate-overlay">
          {photoBadge}
          {photoCaption && <figcaption className="p10-gate-caption">{photoCaption}</figcaption>}
        </div>
      </figure>
      <div className="p10-gate-text">{children}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ before */

export function BeforeTrip({ state, trip, today }: PhaseProps) {
  const daysLeft = daysBetween(today, trip.startDate);
  const events = tripEvents(state, trip.id);
  const first = events[0];
  const openTodos = state.todos.filter((t) => t.tripId === trip.id && !t.done);
  const exampleTodo = openTodos[0];
  const dayCount = tripDays(trip).length;

  return (
    <div className="container page p10">
      <GateLayout
        trip={trip}
        photoBadge={
          <span className="p10-gate-count">
            <span className="p10-gate-count-num num">{daysLeft}</span>
            <span>{daysLeft === 1 ? 'day to go' : 'days to go'}</span>
          </span>
        }
        photoCaption={first ? `Day 1 starts with ${eventLabel(first)} at ${formatTime(first.start)}.` : undefined}
      >
        <p className="eyebrow">{trip.title}</p>
        <h1 className="p10-gate-title">Your trip dashboard opens on {formatShortDate(trip.startDate)}</h1>
        <p className="p10-gate-sub">
          <Lock aria-hidden className="p10-inline-icon" />
          It unlocks {relativeDays(today, trip.startDate)}, when Day 1 starts. Until then, your plan lives in the itinerary.
        </p>

        <h2 className="p10-gate-h2">During the trip, this page shows</h2>
        <ul className="p10-gate-list">
          <li>
            <CalendarDays aria-hidden />
            <span>
              <strong>A week calendar</strong>
              <span>
                All {plural(dayCount, 'day')} at a glance, {plural(events.length, 'event')} so far. Pick a day for its timeline.
              </span>
            </span>
          </li>
          <li>
            <ListChecks aria-hidden />
            <span>
              <strong>The group’s to-do list</strong>
              <span>
                {openTodos.length > 0 ? `${plural(openTodos.length, 'open to-do')}, like “${exampleTodo.text}”.` : 'Everything the group still needs to book or bring.'}
              </span>
            </span>
          </li>
          <li>
            <Navigation aria-hidden />
            <span>
              <strong>Where to next</strong>
              <span>Your next stop on a map, how long the walk is, and when to leave.</span>
            </span>
          </li>
        </ul>

        <div className="p10-gate-actions">
          <Button to={paths.itinerary(trip.id)} iconRight={<ArrowRight />}>
            View itinerary
          </Button>
        </div>
      </GateLayout>

      <Banner
        tone="demo"
        title="Prototype: preview the dashboard"
        action={
          <Button variant="secondary" icon={<Timer />} onClick={() => jumpIntoTrip(trip)}>
            Jump into trip
          </Button>
        }
      >
        The demo clock decides what day it is. Jump into the trip here, or use Prototype controls (header, or account menu on phones).
      </Banner>
    </div>
  );
}

/* ------------------------------------------------------------------- after */

export function AfterTrip({ state, trip, access }: PhaseProps) {
  const events = tripEvents(state, trip.id);
  const cities = [...new Set(events.map((e) => e.place.city))];
  const me = access.actingPersonId;
  const open = visibleReimbursements(state, trip.id).filter((r) => r.status === 'open');
  const iOwe = open.filter((r) => r.fromId === me);
  const owedToMe = open.filter((r) => r.toId === me);
  const sum = (rows: typeof open) => rows.reduce((total, r) => total + r.amount, 0);
  /** 'Sam and Priya' from repayment rows (each person once). */
  const people = (ids: string[]) => listJoin([...new Set(ids)].map((id) => personFirstName(state, id)));
  const owerCount = new Set(owedToMe.map((r) => r.fromId)).size;

  return (
    <div className="container page p10">
      <GateLayout
        trip={trip}
        past
        photoBadge={
          <span className="p10-gate-done">
            <CircleCheckBig aria-hidden /> Trip complete
          </span>
        }
        photoCaption={formatDateRange(trip.startDate, trip.endDate)}
      >
        <p className="eyebrow">{trip.title}</p>
        <h1 className="p10-gate-title">This trip ended on {formatShortDate(trip.endDate)}</h1>
        <p className="p10-gate-sub">
          {plural(tripDays(trip).length, 'day')} · {plural(events.length, 'event')}
          {cities.length > 0 && ` in ${listJoin(cities)}`}. The day-by-day dashboard closes when a trip ends; the itinerary keeps the full plan.
        </p>

        <div className="p10-settle" aria-labelledby="p10-settle-title">
          <h2 id="p10-settle-title" className="p10-gate-h2">
            Still to settle
          </h2>
          {iOwe.length === 0 && owedToMe.length === 0 ? (
            <p className="p10-settle-line">
              <CircleCheckBig aria-hidden className="p10-inline-icon is-success" /> You’re all settled up.
            </p>
          ) : (
            <ul className="p10-settle-list">
              {iOwe.length > 0 && (
                <li>
                  <span>You owe {people(iOwe.map((r) => r.toId))}</span>
                  <strong className="num">{money(sum(iOwe))}</strong>
                </li>
              )}
              {owedToMe.length > 0 && (
                <li>
                  <span>
                    {people(owedToMe.map((r) => r.fromId))} {owerCount === 1 ? 'owes' : 'owe'} you
                  </span>
                  <strong className="num">{money(sum(owedToMe))}</strong>
                </li>
              )}
            </ul>
          )}
        </div>

        <div className="p10-gate-actions">
          <Button to={paths.itinerary(trip.id)} variant="secondary">
            View itinerary
          </Button>
          <Button to={paths.budget(trip.id)} icon={<PiggyBank />}>
            Settle up in Budget
          </Button>
        </div>
      </GateLayout>

      <Banner
        tone="demo"
        title="Prototype: go back into the trip"
        action={
          <Button variant="secondary" icon={<Timer />} onClick={() => jumpIntoTrip(trip)}>
            Jump into trip
          </Button>
        }
      >
        The demo clock is set after the trip. Jump back in to see the live dashboard.
      </Banner>
    </div>
  );
}
