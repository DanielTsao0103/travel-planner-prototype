/**
 * The data behind the day page (Page 11): which events happen, where they sit
 * on the timeline, the free time between them, and how long it takes to get
 * from one stop to the next. The components only draw what this returns.
 */

import type { AppState, ISODate, Time, Trip, TripEvent } from '../../data/types';
import { timeToMin } from '../../lib/dates';
import { eventsOn, freeGaps } from '../../store/selectors';
import { hourRange, layoutLanes, perPersonCost, travelBetween, type TravelLeg } from '../p10/tripTime';

/** An event placed on the timeline. */
export interface PlacedEvent {
  event: TripEvent;
  /** Order in the day (1 = first), matching the numbered map pins. */
  number: number;
  /** Side-by-side column when events overlap. */
  lane: number;
  lanes: number;
  startMin: number;
  endMin: number;
}

/** Free time of at least 45 minutes (the same rule Page 8 and the dashboard use). */
export interface FreeBlock {
  start: Time;
  end: Time;
  minutes: number;
  startMin: number;
  endMin: number;
  /** Getting to the event that ends this free time. */
  travelTo?: { event: TripEvent; leg: TravelLeg };
}

/** Travel between two events that are less than 45 minutes apart. */
export interface Hop {
  from: TripEvent;
  to: TripEvent;
  leg: TravelLeg;
  /** Minutes between the first event's end and the second's start. */
  gapMin: number;
  /** Where to draw the hop (minutes after midnight). */
  atMin: number;
  /** The trip takes longer than the time between the events. */
  tight: boolean;
}

export interface DayModel {
  events: PlacedEvent[];
  free: FreeBlock[];
  hops: Hop[];
  /** Grid range in whole hours: at least 8 AM–10 PM, stretched to fit events. */
  startHour: number;
  endHour: number;
}

export function buildDayModel(state: AppState, trip: Trip, date: ISODate): DayModel {
  const list = eventsOn(state, trip.id, date); // already sorted by start time
  const lanes = new Map(layoutLanes(list).map((l) => [l.event.id, l]));
  const events: PlacedEvent[] = list.map((event, i) => ({
    event,
    number: i + 1,
    lane: lanes.get(event.id)?.lane ?? 0,
    lanes: lanes.get(event.id)?.lanes ?? 1,
    startMin: timeToMin(event.start),
    endMin: timeToMin(event.end),
  }));

  const free: FreeBlock[] = freeGaps(state, trip.id, date).map((g) => ({ ...g, startMin: timeToMin(g.start), endMin: timeToMin(g.end) }));

  const hops: Hop[] = [];
  for (let i = 1; i < list.length; i++) {
    const a = list[i - 1];
    const b = list[i];
    const aEnd = timeToMin(a.end);
    const bStart = timeToMin(b.start);
    if (bStart < aEnd) continue; // overlapping events: nobody travels between them
    const leg = travelBetween(a, b);
    if (!leg) continue; // right after a train ride: we don't know where it dropped you off
    const block = free.find((f) => f.endMin === bStart && f.startMin >= aEnd);
    if (block) {
      // Long free stretch: the walk is shown inside the free block, next to the event it leads to.
      block.travelTo = { event: b, leg };
      continue;
    }
    const gapMin = bStart - aEnd;
    hops.push({ from: a, to: b, leg, gapMin, atMin: aEnd + gapMin / 2, tight: leg.minutes > gapMin });
  }

  const { startHour, endHour } = hourRange(list, 8, 22);
  return { events, free, hops, startHour, endHour };
}

/** Numbers for the day summary: events, planned cost per person, ticketed stops. */
export function daySummary(events: TripEvent[]): { count: number; perPerson: number; ticketed: number; booked: number } {
  return {
    count: events.length,
    perPerson: events.reduce((sum, e) => sum + perPersonCost(e), 0),
    ticketed: events.filter((e) => e.place.ticketRequired).length,
    booked: events.filter((e) => e.place.ticketRequired && e.confirmation).length,
  };
}
