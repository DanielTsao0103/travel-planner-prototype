/**
 * Page 11 — Day detail.
 *
 * Doc: "just like the calender app, if i click on the day from the active trip
 * page it goes into the specific page that the day is on, and then you get a
 * detailed timing break down of the day. You get to edit it and add things to
 * it, its a simple ui that just focuses on the day."
 *
 * - Header: "Day 2 — 10/16", the long date and city, previous/next day, and a
 *   strip of every trip day (pills on phones, a wider strip on desktop).
 * - Timeline: an hour grid with events sized by duration, travel time between
 *   stops, free gaps (with "Find ideas" / "Add"), and a now-line on today.
 * - Desktop adds a right panel: day summary, a map of the day's stops, and the
 *   day's to-dos. Phones stack the map and to-dos under the timeline.
 * - Editing follows permissions: canEditDay(date) gets "Add to Day N" and the
 *   gap "Add" buttons; everyone else sees a locked banner that says why.
 *
 * Query params: `focus=<eventId>` scrolls to and highlights an event;
 * `from=calendar` (the Home menu's Calendar) adds trip/day pickers and sends
 * "back" to Home. All data comes from the shared store (same as Pages 8 and 10).
 */

import { useEffect } from 'react';
import { ArrowRight, CalendarPlus, CalendarX2, ChevronLeft, ChevronRight, Plane, Plus, Sparkles } from 'lucide-react';
import type { AppState, ISODate, Trip } from '../../data/types';
import type { TripAccess } from '../../lib/permissions';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import { useTrip } from '../../hooks/useTrip';
import { dayHeading, dayNumber, formatDateRange, formatLongDate, tripPhase, weekdayLong } from '../../lib/dates';
import { plural } from '../../lib/format';
import { decisionFor, eventsOn, now, tripDays, tripSuggestions } from '../../store/selectors';
import { Link, withQuery } from '../../router/router';
import { paths } from '../../router/routes';
import { Button, IconButton } from '../../components/ui/Button';
import { Badge, Banner, EmptyState, RoleBadge } from '../../components/ui/Display';
import { PlacePhoto } from '../../components/domain/PlacePhoto';
import { DayPills } from '../p10/DayPills';
import { TodoList } from '../p10/TodoList';
import { dayCity, dollars, timeRangeLabel, useLiveClock } from '../p10/tripTime';
import { CalendarPicker } from './CalendarPicker';
import { DayMapCard, DaySummaryCard } from './DaySide';
import { DayTimeline } from './DayTimeline';
import { daySummary } from './dayModel';
import './p11.css';

export function DayPage({ tripId, date, query }: { tripId: string; date: string; query: URLSearchParams }) {
  const ctx = useTrip(tripId);
  const bp = useBreakpoint();
  useLiveClock();
  const focusId = query.get('focus');
  const fromCalendar = query.get('from') === 'calendar';
  useScrollToFocus(focusId, date);

  if (!ctx) return <TripUnavailable />;
  const { state, trip, access } = ctx;
  const clock = now(state);
  const today = clock.date;
  const days = tripDays(trip);
  if (!days.includes(date)) return <DayNotInTrip trip={trip} />;

  const isMobile = bp === 'mobile';
  const n = dayNumber(trip, date);
  const index = days.indexOf(date);
  const prev = days[index - 1];
  const next = days[index + 1];
  // Keep the Calendar pickers while moving between days.
  const dayHref = (d: ISODate) => withQuery(paths.day(trip.id, d), { from: fromCalendar ? 'calendar' : undefined });
  const events = eventsOn(state, trip.id, date);
  const counts = Object.fromEntries(days.map((d) => [d, eventsOn(state, trip.id, d).length]));
  const canEdit = access.canEditDay(date);
  const addPath = withQuery(paths.newEvent(trip.id), { date, return: dayHref(date) });
  const back = fromCalendar
    ? { to: paths.home(), label: 'Home' }
    : tripPhase(trip, today) === 'active'
      ? { to: paths.dashboard(trip.id), label: 'Today' }
      : { to: paths.itinerary(trip.id), label: 'Itinerary' };
  const summary = daySummary(events);
  const firstOwnDay = access.role === 'day' ? access.editableDays[0] : undefined;

  const addButton = canEdit ? (
    <Button icon={<Plus />} to={addPath}>
      Add to Day {n}
    </Button>
  ) : (
    <Button variant="secondary" locked={access.lockReason('editThisDay')}>
      Add to Day {n}
    </Button>
  );

  const header = (
    <header className="p11-head">
      <Link to={back.to} className="back-link">
        <ChevronLeft aria-hidden />
        {back.label}
      </Link>
      {fromCalendar && <CalendarPicker state={state} trip={trip} date={date} today={today} />}
      <div className="p11-head-row">
        <div className="p11-head-text">
          <h1 className="p11-title">{dayHeading(trip, date)}</h1>
          <p className="p11-sub">
            <span className="num">
              {weekdayLong(date)}, {formatLongDate(date)} · {dayCity(state, trip, date)}
            </span>
            {date === today && <Badge tone="accent">Today</Badge>}
            {access.role === 'day' && canEdit && (
              <span className="p11-perm">
                <RoleBadge role="day" /> You can edit this day
              </span>
            )}
          </p>
        </div>
        <div className="p11-head-actions">
          <div className="p11-daynav">
            {prev ? (
              <IconButton label={`Previous day (Day ${n - 1})`} icon={<ChevronLeft />} variant="secondary" to={dayHref(prev)} />
            ) : (
              <IconButton label="This is the first day" icon={<ChevronLeft />} variant="secondary" disabled />
            )}
            {next ? (
              <IconButton label={`Next day (Day ${n + 1})`} icon={<ChevronRight />} variant="secondary" to={dayHref(next)} />
            ) : (
              <IconButton label="This is the last day" icon={<ChevronRight />} variant="secondary" disabled />
            )}
          </div>
          {!isMobile && addButton}
        </div>
      </div>
      <DayPills trip={trip} days={days} counts={counts} today={today} selected={date} hrefFor={dayHref} label="Trip days" variant={isMobile ? 'compact' : 'wide'} />
    </header>
  );

  const lockedBanner = !canEdit && (
    <Banner
      tone="locked"
      title={access.isPast ? 'View only' : `Day ${n} is view-only for you`}
      action={
        firstOwnDay && !access.isPast ? (
          <Button size={isMobile ? 'md' : 'sm'} variant="secondary" to={dayHref(firstOwnDay)} iconRight={<ArrowRight />}>
            Go to Day {dayNumber(trip, firstOwnDay)}
          </Button>
        ) : undefined
      }
    >
      {access.lockReason('editThisDay')}
    </Banner>
  );

  const timeline =
    events.length === 0 ? (
      <EmptyDay state={state} trip={trip} access={access} date={date} addPath={addPath} />
    ) : (
      <DayTimeline state={state} trip={trip} access={access} date={date} today={today} nowTime={clock.time} focusId={focusId} compact={isMobile} fromCalendar={fromCalendar} />
    );

  const todos = <TodoList state={state} trip={trip} access={access} today={today} date={date} showFilter={false} title={`To-do for Day ${n}`} className="p10-panel" />;

  if (isMobile) {
    return (
      <div className="container page p11 is-mobile">
        {header}
        {events.length > 0 && (
          <div className="p11-mbar">
            <p className="p11-mbar-sum num">
              {plural(events.length, 'event')} · {dollars(Math.round(summary.perPerson * 100) / 100)} per person
            </p>
            {canEdit && (
              <Button icon={<Plus />} to={addPath}>
                Add to Day {n}
              </Button>
            )}
          </div>
        )}
        {lockedBanner}
        <section className="p11-timeline-wrap" aria-label="Timeline">
          {timeline}
        </section>
        {events.length > 0 && <DayMapCard state={state} trip={trip} date={date} today={today} events={events} />}
        {todos}
      </div>
    );
  }

  return (
    <div className="container page p11">
      {header}
      <div className="p11-body">
        <section className="p11-main" aria-label="Timeline">
          {lockedBanner}
          {timeline}
        </section>
        <aside className="p11-side" aria-label={`Day ${n} summary, map, and to-dos`}>
          {events.length > 0 && <DaySummaryCard events={events} />}
          {events.length > 0 && <DayMapCard state={state} trip={trip} date={date} today={today} events={events} />}
          {todos}
        </aside>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------- focus scroll */

/**
 * `?focus=<eventId>`: scroll the event into view and move keyboard focus to it.
 * Waits a moment because App scrolls new pages to the top after they render.
 */
function useScrollToFocus(focusId: string | null, date: string) {
  useEffect(() => {
    if (!focusId) return;
    const timer = window.setTimeout(() => {
      const item = document.getElementById(`p11-ev-${focusId}`);
      if (!item) return;
      const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      item.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
      item.querySelector<HTMLElement>('a')?.focus({ preventScroll: true });
    }, 180);
    return () => window.clearTimeout(timer);
  }, [focusId, date]);
}

/* ------------------------------------------------------------- empty day */

/** 11B: nothing planned. Offers "Add event" (if allowed) and the bundled ideas for this day. */
function EmptyDay({ state, trip, access, date, addPath }: { state: AppState; trip: Trip; access: TripAccess; date: ISODate; addPath: string }) {
  const n = dayNumber(trip, date);
  const city = dayCity(state, trip, date);
  const ideas = tripSuggestions(state, trip.id).filter((s) => s.date === date && !decisionFor(state, trip.id, s.id));
  const ideasPath = withQuery(paths.ideas(trip.id), { day: date });
  return (
    <div className="p11-empty">
      <EmptyState
        icon={<CalendarPlus />}
        title={`Nothing planned for Day ${n} yet`}
        actions={
          <>
            {access.canEditDay(date) && (
              <Button icon={<Plus />} to={addPath}>
                Add event
              </Button>
            )}
            <Button variant="secondary" icon={<Sparkles />} to={ideasPath}>
              See ideas for this day
            </Button>
          </>
        }
      >
        {city ? `Day ${n} in ${city} is wide open.` : `Day ${n} is wide open.`}{' '}
        {ideas.length > 0 ? `${plural(ideas.length, 'idea')} from the group’s plans already fit it.` : 'Add a plan, or browse ideas that fit the group.'}
      </EmptyState>

      {ideas.length > 0 && (
        <section className="p11-ideas" aria-labelledby="p11-ideas-title">
          <div className="p11-ideas-head">
            <h2 id="p11-ideas-title" className="p11-card-title">
              Ideas for Day {n}
            </h2>
            <Link to={ideasPath} className="p11-ideas-all">
              See all ideas
            </Link>
          </div>
          <ul className="p11-ideas-list">
            {ideas.slice(0, 3).map((s) => (
              <li key={s.id}>
                <Link to={ideasPath} className="p11-idea">
                  <PlacePhoto photo={s.place.photo} alt="" category={s.place.category} className="p11-idea-photo" />
                  <span className="p11-idea-body">
                    <span className="p11-idea-name">{s.place.name}</span>
                    <span className="p11-idea-time num">
                      {timeRangeLabel(s.start, s.end)}
                      {s.estCostPerPerson !== undefined && (s.estCostPerPerson > 0 ? ` · ~${dollars(s.estCostPerPerson)} / person` : ' · Free')}
                    </span>
                    {s.fit.length > 0 && <span className="p11-idea-fit">{s.fit.slice(0, 2).join(' · ')}</span>}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

/* -------------------------------------------------------- not-found states */

function TripUnavailable() {
  return (
    <div className="container page">
      <EmptyState
        icon={<Plane />}
        title="This trip isn’t available"
        actions={
          <Button to={paths.trips()} iconRight={<ArrowRight />}>
            Go to My trips
          </Button>
        }
      >
        It may have been deleted, or you’re not a member of it.
      </EmptyState>
    </div>
  );
}

/** The URL's date isn't one of the trip's days (or isn't a date at all). */
function DayNotInTrip({ trip }: { trip: Trip }) {
  return (
    <div className="container page">
      <EmptyState
        icon={<CalendarX2 />}
        title="That day isn’t part of this trip"
        actions={
          <Button to={paths.itinerary(trip.id)} iconRight={<ArrowRight />}>
            Go to the itinerary
          </Button>
        }
      >
        {trip.title} runs {formatDateRange(trip.startDate, trip.endDate)}. Pick one of those days from the itinerary.
      </EmptyState>
    </div>
  );
}
