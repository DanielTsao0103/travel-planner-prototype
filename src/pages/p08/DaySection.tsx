/**
 * One day of the itinerary (Page 8):
 *
 *   Day 2 — 10/16                         [View day] [+ Add]
 *   Friday · Lisbon   (Today)
 *   [photo] Jerónimos Monastery            @ 9:30 AM
 *   [photo] Pastéis de Belém               @ 11:15 AM
 *
 * Events are already sorted by start time (itineraryByDay). An empty day shows
 * a quiet row with "Add event" (if you can edit that day) and "See ideas".
 */

import type { ReactNode } from 'react';
import { CalendarPlus, ChevronRight, Lock, Plus, Sparkles, Ticket } from 'lucide-react';
import type { Trip, Time, TripEvent } from '../../data/types';
import { EventItem } from '../../components/domain/EventItem';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Display';
import { dayHeading, formatDuration, formatTime, timeToMin, weekdayLong } from '../../lib/dates';
import { plural } from '../../lib/format';
import { Link, withQuery } from '../../router/router';
import { paths } from '../../router/routes';
import type { DayGroup } from '../../store/selectors';
import { dayAnchorId, eventAnchorId } from './itinerary';

export interface DaySectionProps {
  trip: Trip;
  day: DayGroup;
  /** "Lisbon", "Lisbon → Porto", "Day trip to Sintra"… */
  placeLabel: string;
  isToday: boolean;
  /** Current demo time on today's section; draws the "Now" line. */
  nowTime?: Time;
  /** Can the acting person add/edit events on this day? */
  canEdit: boolean;
  /** Show "View only" (day editors, on days that aren't theirs). */
  showViewOnly: boolean;
  isPast: boolean;
  /** Undecided ideas suggested for this day (Page 9). */
  ideasCount: number;
  /** Accepted travelers, so a row can say "4 of 5 going". */
  groupSize: number;
  highlightId: string | null;
  /** Every day is empty: keep the empty rows extra short (the page shows a start panel). */
  quiet?: boolean;
  /** Phones: the heading itself links to the day (no room for a "View day" button). */
  compact?: boolean;
}

/**
 * The small line under an event's name: where, how long, who's going, tickets.
 * `short` (phones) drops the duration so names keep more room.
 */
function eventMeta(event: TripEvent, groupSize: number, short?: boolean): ReactNode {
  const minutes = timeToMin(event.end) - timeToMin(event.start);
  const parts = [
    event.title ? event.place.name : event.place.area,
    minutes > 0 && !short ? formatDuration(minutes) : '',
    // Only worth saying when someone is skipping it (e.g. Linda skips the tram).
    event.attendeeIds.length < groupSize ? `${event.attendeeIds.length} of ${groupSize} going` : '',
  ].filter(Boolean);
  return (
    <>
      <span>{parts.join(' · ')}</span>
      {event.place.ticketRequired && (
        <span className="event-ticket" title="Tickets required">
          <Ticket aria-hidden /> Tickets
        </span>
      )}
    </>
  );
}

/** Marigold "Now · 2:20 PM" divider between what's done and what's next today. */
function NowLine({ time }: { time: Time }) {
  return (
    <li className="p08-now" aria-label={`Now, ${formatTime(time)}`}>
      <span className="p08-now-dot" aria-hidden />
      <span className="p08-now-label num" aria-hidden>
        Now · {formatTime(time)}
      </span>
    </li>
  );
}

export function DaySection({ trip, day, placeLabel, isToday, nowTime, canEdit, showViewOnly, isPast, ideasCount, groupSize, highlightId, quiet, compact }: DaySectionProps) {
  const headingId = `${dayAnchorId(day.date)}-title`;
  const dayPath = paths.day(trip.id, day.date);
  const addPath = withQuery(paths.newEvent(trip.id), { date: day.date, return: paths.itinerary(trip.id) });
  const ideasPath = withQuery(paths.ideas(trip.id), { day: day.date });
  const hasEvents = day.events.length > 0;
  // Index of the first event that starts after "now" (-1 = everything already started).
  const nowIndex = nowTime ? day.events.findIndex((e) => timeToMin(e.start) > timeToMin(nowTime)) : null;

  return (
    <section className={`p08-day ${isToday ? 'is-today' : ''}`} id={dayAnchorId(day.date)} aria-labelledby={headingId}>
      <header className="p08-day-head">
        {/* tabIndex -1: the day chips move keyboard focus here after scrolling. */}
        <h2 className="p08-day-title num" id={headingId} tabIndex={-1} data-day-heading>
          {compact ? (
            <Link to={dayPath} className="p08-day-link" aria-label={`${dayHeading(trip, day.date)}, view this day in detail`}>
              {dayHeading(trip, day.date)}
              <ChevronRight aria-hidden />
            </Link>
          ) : (
            dayHeading(trip, day.date)
          )}
        </h2>
        <p className="p08-day-sub">
          <span>
            {weekdayLong(day.date)} · {placeLabel}
          </span>
          {isToday && <Badge tone="accent">Today</Badge>}
        </p>
        <div className="p08-day-actions">
          {showViewOnly && (
            <span className="p08-view-only">
              <Lock aria-hidden /> View only
            </span>
          )}
          {!compact && (
            <Button size="sm" variant="ghost" to={dayPath} iconRight={<ChevronRight />} aria-label={`View Day ${day.dayNumber} in detail`}>
              View day
            </Button>
          )}
          {canEdit && hasEvents && (
            <Button size="sm" variant="subtle" icon={<Plus />} to={addPath} aria-label={`Add an event to Day ${day.dayNumber}`}>
              Add
            </Button>
          )}
        </div>
      </header>

      {hasEvents ? (
        <ol className="p08-events">
          {day.events.map((event, i) => (
            <FragmentRow key={event.id} showNow={!!nowTime && nowIndex === i} nowTime={nowTime}>
              <li className="p08-event" id={eventAnchorId(event.id)}>
                {/* Phones drop the chevron (trailing={false}): the whole row is the link, and names need the room. */}
                <EventItem
                  event={event}
                  to={paths.event(trip.id, event.id)}
                  highlight={highlightId === event.id}
                  meta={eventMeta(event, groupSize, compact)}
                  trailing={compact ? false : undefined}
                />
              </li>
            </FragmentRow>
          ))}
          {nowTime && nowIndex === -1 && <NowLine time={nowTime} />}
        </ol>
      ) : (
        <div className={`p08-empty-day ${quiet ? 'is-quiet' : ''}`}>
          <span className="p08-empty-icon" aria-hidden>
            <CalendarPlus />
          </span>
          <div className="p08-empty-copy">
            <p className="p08-empty-title">{isPast ? 'Nothing was planned for this day.' : 'Nothing planned yet'}</p>
            {!isPast && !quiet && (
              <p className="p08-empty-hint">
                {ideasCount > 0
                  ? `${plural(ideasCount, 'idea')} ${ideasCount === 1 ? 'fits' : 'fit'} this day.`
                  : canEdit
                    ? 'Add a place, or look for ideas that fit this day.'
                    : 'Nobody has added anything to this day yet.'}
              </p>
            )}
          </div>
          {!isPast && (
            <div className="p08-empty-actions">
              {canEdit && (
                <Button size="sm" variant="secondary" icon={<Plus />} to={addPath} aria-label={`Add an event to Day ${day.dayNumber}`}>
                  Add event
                </Button>
              )}
              <Button size="sm" variant="ghost" icon={<Sparkles />} to={ideasPath}>
                See ideas for this day
              </Button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

/** Renders the "Now" line just before a row when needed (keeps the map above readable). */
function FragmentRow({ showNow, nowTime, children }: { showNow: boolean; nowTime?: Time; children: ReactNode }) {
  return (
    <>
      {showNow && nowTime && <NowLine time={nowTime} />}
      {children}
    </>
  );
}
