/**
 * The day page's "detailed timing breakdown" (Page 11), drawn like a calendar
 * app's day view: an hour grid with each event sized by how long it lasts.
 *
 * Each event block shows as much as its height allows (photo, name, time range
 * and duration, who's going, cost, tickets and step-free facts, notes). Between
 * events: the travel time ("~12 min walk", or a taxi estimate for long hops),
 * and free stretches of 45+ minutes as soft blocks with "Find ideas" and "Add".
 * A "now" line marks the demo time on today's page. `focusId` highlights one
 * event (the page scrolls it into view).
 */

import type { CSSProperties, ReactNode } from 'react';
import { Accessibility, CalendarCheck, CarTaxiFront, Footprints, Plus, Sparkles, StickyNote, Ticket, TriangleAlert } from 'lucide-react';
import type { AppState, ISODate, Time, Trip, TripEvent } from '../../data/types';
import type { TripAccess } from '../../lib/permissions';
import { formatDuration, formatHour, formatTime, timeToMin } from '../../lib/dates';
import { acceptedMemberIds, getPerson } from '../../store/selectors';
import { Link, withQuery } from '../../router/router';
import { paths } from '../../router/routes';
import { Button, IconButton } from '../../components/ui/Button';
import { AvatarStack, Badge } from '../../components/ui/Display';
import { PlacePhoto } from '../../components/domain/PlacePhoto';
import { eventLabel } from '../../components/domain/EventItem';
import { costLabel, durationMin, isEventNow, isEventOver, timeRangeLabel, travelLabel, type TravelLeg } from '../p10/tripTime';
import { buildDayModel, type FreeBlock, type Hop, type PlacedEvent } from './dayModel';
import './p11.css';

/** Space above the first hour line (and below the last) so labels aren't clipped. */
const GRID_PAD = 12;

export interface DayTimelineProps {
  state: AppState;
  trip: Trip;
  access: TripAccess;
  date: ISODate;
  /** Demo-clock date and time. */
  today: ISODate;
  nowTime: Time;
  /** Event to highlight (from `?focus=`). */
  focusId: string | null;
  /** Phone layout: a little tighter, fewer avatars. */
  compact: boolean;
  /** Opened from the Home menu's Calendar: links back here keep `from=calendar`. */
  fromCalendar: boolean;
}

export function DayTimeline({ state, trip, access, date, today, nowTime, focusId, compact, fromCalendar }: DayTimelineProps) {
  const model = buildDayModel(state, trip, date);
  const pxPerMin = compact ? 1.5 : 1.6;
  const gridStart = model.startHour * 60;
  const gridEnd = model.endHour * 60;
  /** Minutes after midnight → pixels from the top of the timeline. */
  const y = (min: number) => GRID_PAD + (min - gridStart) * pxPerMin;
  const height = GRID_PAD * 2 + (gridEnd - gridStart) * pxPerMin;
  const nowMin = timeToMin(nowTime);
  const showNow = date === today && nowMin >= gridStart && nowMin <= gridEnd;
  const canEdit = access.canEditDay(date);
  const from = fromCalendar ? 'calendar' : undefined;
  // Pages opened from here (add an event, view an event) come back to this day.
  const dayPath = withQuery(paths.day(trip.id, date), { from });
  const eventHref = (eventId: string) => withQuery(paths.event(trip.id, eventId), { return: withQuery(paths.day(trip.id, date), { from, focus: eventId }) });
  const ideasPath = withQuery(paths.ideas(trip.id), { day: date });
  const everyone = acceptedMemberIds(trip);
  const hours = Array.from({ length: model.endHour - model.startHour + 1 }, (_, i) => model.startHour + i);

  // Everything goes into one list in time order, so screen readers hear the day in sequence.
  const items: Array<{ at: number; key: string; node: ReactNode }> = [
    ...model.free.map((f) => ({
      at: f.startMin,
      key: `free-${f.start}`,
      node: (
        <FreeItem
          key={`free-${f.start}`}
          block={f}
          top={y(f.startMin)}
          height={y(f.endMin) - y(f.startMin)}
          canEdit={canEdit}
          ideasPath={ideasPath}
          addPath={withQuery(paths.newEvent(trip.id), { date, start: f.start, return: dayPath })}
          compact={compact}
        />
      ),
    })),
    ...model.events.map((p) => ({
      at: p.startMin,
      key: p.event.id,
      node: (
        <EventBlock
          key={p.event.id}
          placed={p}
          top={y(p.startMin)}
          height={Math.max(44, y(p.endMin) - y(p.startMin) - 3)}
          href={eventHref(p.event.id)}
          state={state}
          everyone={everyone}
          focused={p.event.id === focusId}
          over={isEventOver(p.event, today, nowMin)}
          live={isEventNow(p.event, today, nowMin)}
          compact={compact}
        />
      ),
    })),
    ...model.hops.map((h) => ({ at: h.atMin, key: `hop-${h.from.id}`, node: <HopItem key={`hop-${h.from.id}`} hop={h} top={y(h.atMin)} /> })),
  ].sort((a, b) => a.at - b.at);

  return (
    <div className={`p11-tl ${compact ? 'is-compact' : ''}`} style={{ height }}>
      <div className="p11-tl-grid" aria-hidden>
        {hours.map((h) => {
          const top = y(h * 60);
          // Hide an hour label that would collide with the "now" label.
          const hidden = showNow && Math.abs(top - y(nowMin)) < 16;
          return (
            <div key={h} className="p11-tl-line" style={{ top }}>
              {!hidden && <span className="p11-tl-hour">{formatHour(h % 24)}</span>}
            </div>
          );
        })}
      </div>

      <ol className="p11-tl-items" aria-label="Timeline">
        {items.map((i) => i.node)}
      </ol>

      {showNow && (
        <div className="p11-now" style={{ top: y(nowMin) }}>
          <span className="p11-now-label num">{formatTime(nowTime)}</span>
          <span className="sr-only">Current time</span>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------ an event */

/** How much detail fits: decided by the event's length. */
function tierFor(minutes: number): 'tiny' | 'short' | 'medium' | 'long' {
  if (minutes < 40) return 'tiny';
  if (minutes < 60) return 'short';
  if (minutes < 90) return 'medium';
  return 'long';
}

function EventBlock({
  placed,
  top,
  height,
  href,
  state,
  everyone,
  focused,
  over,
  live,
  compact,
}: {
  placed: PlacedEvent;
  top: number;
  height: number;
  /** The event's page (Page 7), with a way back here. */
  href: string;
  state: AppState;
  everyone: string[];
  focused: boolean;
  over: boolean;
  live: boolean;
  compact: boolean;
}) {
  const { event: e, number, lane, lanes } = placed;
  const minutes = durationMin(e);
  const tier = tierFor(minutes);
  const people = e.attendeeIds.map((id) => getPerson(state, id)).filter((p): p is NonNullable<typeof p> => !!p);
  const allGoing = everyone.every((id) => e.attendeeIds.includes(id));
  const style: CSSProperties = {
    top,
    height,
    left: lanes > 1 ? `calc(${(lane / lanes) * 100}% + ${lane ? 3 : 0}px)` : 0,
    width: lanes > 1 ? `calc(${100 / lanes}% - 3px)` : '100%',
  };
  const classes = ['p11-ev', `is-${tier}`, over ? 'is-over' : '', live ? 'is-live' : '', focused ? 'is-focus' : '', lanes > 1 ? 'is-split' : ''].filter(Boolean).join(' ');

  return (
    <li id={`p11-ev-${e.id}`} className="p11-tl-item" style={style}>
      <Link to={href} className={classes} aria-current={focused ? 'true' : undefined}>
        <PlacePhoto photo={e.place.photo} alt="" category={e.place.category} className="p11-ev-photo" />
        <span className="p11-ev-body">
          <span className="p11-ev-top">
            <span className="p11-ev-num">
              <span className="sr-only">Stop </span>
              {number}
            </span>
            <span className="p11-ev-name">{eventLabel(e)}</span>
            {live && <Badge tone="accent">Now</Badge>}
            {/* Phones show just the start time here so the name has room; the block's height shows the length. */}
            {tier === 'tiny' && <span className="p11-ev-time is-inline num">{compact ? formatTime(e.start) : timeRangeLabel(e.start, e.end)}</span>}
          </span>
          {tier !== 'tiny' && (
            <span className="p11-ev-time num">
              {timeRangeLabel(e.start, e.end)} · {formatDuration(minutes)}
              {/* Short blocks have room for one line, so the key facts ride along on it. */}
              {tier === 'short' && costLabel(e) && <span className="p11-ev-inline-fact"> · {costLabel(e)}</span>}
              {tier === 'short' && (e.confirmation || e.place.ticketRequired) && (
                <span className={`p11-ev-inline-fact ${e.confirmation ? 'is-good' : 'is-warn'}`}> · {e.confirmation ? 'Booked' : 'Tickets required'}</span>
              )}
            </span>
          )}
          {(tier === 'medium' || tier === 'long') && (
            <span className={`p11-ev-facts ${tier === 'long' ? 'can-wrap' : ''}`}>
              {people.length > 0 && (
                <span className="p11-fact">
                  <AvatarStack people={people} max={compact ? 3 : 5} size={22} />
                  <span>{allGoing ? 'Everyone' : `${people.length} going`}</span>
                </span>
              )}
              {costLabel(e) && <span className="p11-fact num">{costLabel(e)}</span>}
              <TicketFact event={e} />
              <StepFreeFact event={e} />
              {e.notes && tier !== 'long' && (
                <span className="p11-fact" title={e.notes}>
                  <StickyNote aria-hidden /> Note
                </span>
              )}
            </span>
          )}
          {tier === 'long' && e.notes && <span className="p11-ev-notes">{e.notes}</span>}
          {lanes > 1 && (
            <span className="p11-ev-overlap">
              <TriangleAlert aria-hidden /> Overlaps another event
            </span>
          )}
        </span>
      </Link>
    </li>
  );
}

/** "Booked · JER-48213", or "Tickets required" when nothing is booked yet. */
function TicketFact({ event }: { event: TripEvent }) {
  if (event.confirmation) {
    return (
      <span className="p11-fact is-good">
        {event.place.ticketRequired ? <Ticket aria-hidden /> : <CalendarCheck aria-hidden />}
        Booked · <span className="num">{event.confirmation}</span>
      </span>
    );
  }
  if (event.place.ticketRequired) {
    return (
      <span className="p11-fact is-warn">
        <Ticket aria-hidden /> Tickets required
      </span>
    );
  }
  return null;
}

/** Step-free access, which matters to anyone using a wheelchair (Linda, on the sample trip). */
function StepFreeFact({ event }: { event: TripEvent }) {
  const label = { yes: 'Step-free', partial: 'Partly step-free', no: 'Not step-free', unknown: null }[event.place.stepFree];
  if (!label) return null;
  return (
    <span className={`p11-fact ${event.place.stepFree === 'no' ? 'is-warn' : ''}`}>
      <Accessibility aria-hidden /> {label}
    </span>
  );
}

/* ------------------------------------------------------- free time */

function FreeItem({
  block,
  top,
  height,
  canEdit,
  ideasPath,
  addPath,
  compact,
}: {
  block: FreeBlock;
  top: number;
  height: number;
  canEdit: boolean;
  ideasPath: string;
  addPath: string;
  compact: boolean;
}) {
  const tall = block.minutes >= 90;
  // On phones a short free block can't fit the text and labeled buttons on two rows: use icon buttons beside the text.
  const iconActions = compact && block.minutes < 70;
  const leg = block.travelTo?.leg;
  const tight = !!leg && leg.minutes > block.minutes;
  // Phones keep the inline version short ("~21 min by taxi"); the next block is right below it.
  const travelInline = leg ? <TravelText leg={leg} to={compact ? undefined : eventLabel(block.travelTo!.event)} tight={tight} /> : null;
  const travelFoot = leg ? <TravelText leg={leg} to={eventLabel(block.travelTo!.event)} tight={tight} /> : null;
  return (
    <li className={`p11-tl-item p11-free ${tall ? 'is-tall' : ''} ${iconActions ? 'is-tight' : ''}`} style={{ top, height: Math.max(40, height - 3) }}>
      <div className="p11-free-row">
        <div className="p11-free-text">
          <span className="p11-free-title num">Free {timeRangeLabel(block.start, block.end)}</span>
          <span className="p11-free-sub num">
            {formatDuration(block.minutes)}
            {!tall && travelInline && <> · {travelInline}</>}
          </span>
        </div>
        {iconActions ? (
          <div className="p11-free-actions">
            <IconButton label={`Find ideas for ${formatTime(block.start)}`} icon={<Sparkles />} to={ideasPath} />
            {canEdit && <IconButton label={`Add an event at ${formatTime(block.start)}`} icon={<Plus />} variant="secondary" to={addPath} />}
          </div>
        ) : (
          <div className="p11-free-actions">
            <Button size="sm" variant="ghost" icon={<Sparkles />} to={ideasPath}>
              Find ideas
            </Button>
            {canEdit && (
              <Button size="sm" variant="secondary" icon={<Plus />} to={addPath} aria-label={`Add an event at ${formatTime(block.start)}`}>
                Add
              </Button>
            )}
          </div>
        )}
      </div>
      {tall && travelFoot && <p className="p11-free-foot">{travelFoot}</p>}
    </li>
  );
}

/** "~13 min walk to Santa Justa Lift" (or just "~13 min walk") with a walk or taxi icon. */
function TravelText({ leg, to, tight }: { leg: TravelLeg; to?: string; tight: boolean }) {
  return (
    <span className={`p11-travel-text ${tight ? 'is-tight' : ''}`}>
      {leg.mode === 'walk' ? <Footprints aria-hidden /> : <CarTaxiFront aria-hidden />}
      {travelLabel(leg)}
      {to && ` to ${to}`}
    </span>
  );
}

/* --------------------------------------------- travel between events */

function HopItem({ hop, top }: { hop: Hop; top: number }) {
  return (
    <li className={`p11-tl-item p11-hop ${hop.tight ? 'is-tight' : ''}`} style={{ top }}>
      <span className="p11-hop-pill num">
        {hop.leg.mode === 'walk' ? <Footprints aria-hidden /> : <CarTaxiFront aria-hidden />}
        {travelLabel(hop.leg)}
        {hop.tight && <span className="p11-hop-warn"> · only {hop.gapMin} min between</span>}
        <span className="sr-only"> from {eventLabel(hop.from)} to {eventLabel(hop.to)}</span>
      </span>
    </li>
  );
}
