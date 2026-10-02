/**
 * Helpers shared by the trip dashboard (Page 10) and the day page (Page 11).
 *
 * Both pages turn the same events into the same labels and numbers (time
 * ranges, costs, travel estimates, which city a day is in), so keeping the
 * logic here means the dashboard, the day page, and the itinerary always agree.
 */

import { useEffect, useState } from 'react';
import type { AppState, ISODate, Time, Trip, TripEvent } from '../../data/types';
import { formatTime, timeToMin } from '../../lib/dates';
import { distanceMeters, estimateTaxiMinutes, estimateWalkMinutes, type LatLng } from '../../lib/geo';
import { money, moneyWhole } from '../../lib/format';
import { walkingRoute, type WalkingRoute } from '../../services/routing';
import { eventsOn, tripEvents } from '../../store/selectors';
import { useAppState } from '../../store/store';
import { withQuery } from '../../router/router';
import { paths } from '../../router/routes';

/** Walks longer than this are shown as a taxi ride instead. */
export const MAX_WALK_MIN = 25;
/** Minutes of slack the "Leave by" time keeps in hand. */
export const LEAVE_BUFFER_MIN = 5;

/* ------------------------------------------------------------- time labels */

/** '9:30' (12-hour clock without AM/PM). */
function clock12(t: Time): string {
  const [h, m] = t.split(':').map(Number);
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')}`;
}

/** '9:30–11:00 AM', or '11:15 AM–12:30 PM' when the range crosses noon. */
export function timeRangeLabel(start: Time, end: Time): string {
  const startIsAm = timeToMin(start) < 12 * 60;
  const endIsAm = timeToMin(end) < 12 * 60;
  return startIsAm === endIsAm ? `${clock12(start)}–${formatTime(end)}` : `${formatTime(start)}–${formatTime(end)}`;
}

/** How long an event lasts, in minutes (never negative). */
export function durationMin(e: Pick<TripEvent, 'start' | 'end'>): number {
  return Math.max(0, timeToMin(e.end) - timeToMin(e.start));
}

/** True once the event has ended, by the demo clock. */
export function isEventOver(e: Pick<TripEvent, 'date' | 'end'>, today: ISODate, nowMin: number): boolean {
  return e.date < today || (e.date === today && timeToMin(e.end) <= nowMin);
}

/** True while the event is happening, by the demo clock. */
export function isEventNow(e: Pick<TripEvent, 'date' | 'start' | 'end'>, today: ISODate, nowMin: number): boolean {
  return e.date === today && timeToMin(e.start) <= nowMin && nowMin < timeToMin(e.end);
}

/* ------------------------------------------------------------------- money */

/** '$13' for whole dollars, '$3.50' otherwise. */
export function dollars(amount: number): string {
  return Number.isInteger(amount) ? moneyWhole(amount) : money(amount);
}

/** What one person pays for an event. A "total" cost is split across the people going. */
export function perPersonCost(e: TripEvent): number {
  if (!e.cost) return 0;
  if (e.cost.per === 'person') return e.cost.amount;
  return e.cost.amount / Math.max(1, e.attendeeIds.length);
}

/** '$13 / person', '$120 total', or null when there's no cost. */
export function costLabel(e: TripEvent): string | null {
  if (!e.cost || e.cost.amount <= 0) return null;
  return e.cost.per === 'person' ? `${dollars(e.cost.amount)} / person` : `${dollars(e.cost.amount)} total`;
}

/* ------------------------------------------------------------------ places */

/**
 * The city a day happens in: where most of its events are. An empty day borrows
 * the city of the nearest planned day before it (then after it), and finally
 * falls back to the trip's first destination.
 */
export function dayCity(state: AppState, trip: Trip, date: ISODate): string {
  const counts = new Map<string, number>();
  for (const e of eventsOn(state, trip.id, date)) counts.set(e.place.city, (counts.get(e.place.city) ?? 0) + 1);
  if (counts.size > 0) {
    // Sort is stable, so a tie keeps the city of the earliest event.
    return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
  }
  const all = tripEvents(state, trip.id);
  const before = all.filter((e) => e.date < date).pop();
  const after = all.find((e) => e.date > date);
  return before?.place.city ?? after?.place.city ?? trip.destinations[0]?.name ?? '';
}

/* ------------------------------------------------------------------ travel */

export interface TravelLeg {
  mode: 'walk' | 'taxi';
  minutes: number;
  /** Straight-line distance in meters. */
  meters: number;
}

/**
 * A ride that ends somewhere else, like "Train to Sintra". Its place is the
 * station it leaves from, so we can't estimate travel *after* it.
 */
export function isRide(e: TripEvent): boolean {
  return e.place.category === 'transit';
}

/** Walk when it's short; a taxi estimate when the walk would take longer than 25 minutes. */
export function estimateTravel(from: LatLng, to: LatLng): TravelLeg {
  const meters = distanceMeters(from, to);
  const walk = estimateWalkMinutes(meters);
  if (walk > MAX_WALK_MIN) return { mode: 'taxi', minutes: estimateTaxiMinutes(meters), meters };
  return { mode: 'walk', minutes: walk, meters };
}

/** Travel from one event to the next (straight-line estimate), or null right after a ride elsewhere. */
export function travelBetween(a: TripEvent, b: TripEvent): TravelLeg | null {
  if (isRide(a) && distanceMeters(a.place, b.place) > 3000) return null;
  return estimateTravel(a.place, b.place);
}

/** '~12 min walk' or '~20 min by taxi'. */
export function travelLabel(leg: Pick<TravelLeg, 'mode' | 'minutes'>): string {
  return leg.mode === 'walk' ? `~${leg.minutes} min walk` : `~${leg.minutes} min by taxi`;
}

/**
 * Walking route from the routing service (cached, never throws; falls back to a
 * straight-line estimate). `loading` is true until the answer for the current
 * pair of points arrives.
 */
export function useWalkingRoute(from: LatLng | null | undefined, to: LatLng | null | undefined): { loading: boolean; route: WalkingRoute | null } {
  const key = from && to ? `${from.lat.toFixed(5)},${from.lng.toFixed(5)}>${to.lat.toFixed(5)},${to.lng.toFixed(5)}` : '';
  const [result, setResult] = useState<{ key: string; route: WalkingRoute } | null>(null);
  useEffect(() => {
    if (!key || !from || !to) return;
    let alive = true;
    void walkingRoute(from, to).then((route) => {
      if (alive) setResult({ key, route });
    });
    return () => {
      alive = false;
    };
    // The key captures both points; the objects themselves change every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const route = result && result.key === key ? result.route : null;
  return { loading: !!key && !route, route };
}

/** Directions to an event on the trip map (Page 17). */
export function directionsPath(tripId: string, event: TripEvent): string {
  return withQuery(paths.tripMap(tripId), { to: event.id });
}

/* ----------------------------------------------------------- grid layout */

export interface LanedEvent {
  event: TripEvent;
  /** 0-based column inside a group of overlapping events. */
  lane: number;
  /** How many columns that group needs. */
  lanes: number;
}

/**
 * Calendar-style layout: events that overlap in time sit side by side in
 * "lanes" (like Google Calendar), everything else gets the full width.
 */
export function layoutLanes(events: TripEvent[]): LanedEvent[] {
  const sorted = [...events].sort((a, b) => timeToMin(a.start) - timeToMin(b.start) || durationMin(b) - durationMin(a));
  const out: LanedEvent[] = [];
  let group: Array<{ event: TripEvent; lane: number }> = [];
  let laneEnds: number[] = []; // when each lane frees up, in minutes
  let groupEnd = -1;

  const flush = () => {
    const lanes = Math.max(1, laneEnds.length);
    for (const g of group) out.push({ ...g, lanes });
    group = [];
    laneEnds = [];
  };

  for (const event of sorted) {
    const start = timeToMin(event.start);
    const end = Math.max(timeToMin(event.end), start + 1);
    if (group.length > 0 && start >= groupEnd) flush(); // no overlap with the current group
    if (group.length === 0) groupEnd = end;
    let lane = laneEnds.findIndex((free) => free <= start);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(end);
    } else {
      laneEnds[lane] = end;
    }
    group.push({ event, lane });
    groupEnd = Math.max(groupEnd, end);
  }
  flush();
  return out;
}

/** Whole-hour range for a time grid: at least `minStart`–`minEnd`, stretched to fit every event. */
export function hourRange(events: Array<Pick<TripEvent, 'start' | 'end'>>, minStart: number, minEnd: number): { startHour: number; endHour: number } {
  let startHour = minStart;
  let endHour = minEnd;
  for (const e of events) {
    startHour = Math.min(startHour, Math.floor(timeToMin(e.start) / 60));
    endHour = Math.max(endHour, Math.ceil(timeToMin(e.end) / 60));
  }
  return { startHour: Math.max(0, startHour), endHour: Math.min(24, endHour) };
}

/** Split the trip's days into weeks of up to 7, starting from Day 1. */
export function tripWeeks(days: ISODate[]): ISODate[][] {
  const weeks: ISODate[][] = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));
  return weeks;
}

/* ------------------------------------------------------------------ clock */

/**
 * With the real clock (no demo time set), re-render every 30 seconds so the
 * "now" line and next-stop times stay current. A demo clock is frozen on purpose.
 */
export function useLiveClock(): void {
  const state = useAppState();
  const live = state.demo.clock === null;
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!live) return;
    const id = window.setInterval(() => setTick((n) => n + 1), 30_000);
    return () => window.clearInterval(id);
  }, [live]);
}
