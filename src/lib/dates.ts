/**
 * Date/time helpers.
 *
 * We store dates as 'YYYY-MM-DD' strings and times as 'HH:MM'. Parsing a
 * date-only string with `new Date('2026-10-15')` treats it as UTC midnight,
 * which shows up as the *previous* day in US time zones — so we always build
 * Date objects from parts with `new Date(y, m - 1, d)` (local time) instead.
 */

import type { DemoClock, ISODate, Time, Trip } from '../data/types';

const WEEKDAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WEEKDAYS_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Parse 'YYYY-MM-DD' into a local Date at midnight. */
export function parseISODate(iso: ISODate): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Format a Date as 'YYYY-MM-DD' (local). */
export function toISODate(date: Date): ISODate {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** The real calendar date today (ignores the demo clock). */
export function realTodayISO(): ISODate {
  return toISODate(new Date());
}

/** The real current time as 'HH:MM'. */
export function realNowTime(): Time {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

export function addDays(iso: ISODate, days: number): ISODate {
  const d = parseISODate(iso);
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

/** Whole days from a to b (b - a). */
export function daysBetween(a: ISODate, b: ISODate): number {
  const ms = parseISODate(b).getTime() - parseISODate(a).getTime();
  return Math.round(ms / 86_400_000);
}

/** Every date from start to end, inclusive. */
export function eachDay(start: ISODate, end: ISODate): ISODate[] {
  const out: ISODate[] = [];
  const total = daysBetween(start, end);
  for (let i = 0; i <= total; i++) out.push(addDays(start, i));
  return out;
}

/** '10/15' — the format the doc asks for in "Day 1 — MM/DD". */
export function formatMMDD(iso: ISODate): string {
  const d = parseISODate(iso);
  return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
}

export function weekdayShort(iso: ISODate): string {
  return WEEKDAYS_SHORT[parseISODate(iso).getDay()];
}

export function weekdayLong(iso: ISODate): string {
  return WEEKDAYS_LONG[parseISODate(iso).getDay()];
}

/** 'Fri, Oct 16' */
export function formatShortDate(iso: ISODate): string {
  const d = parseISODate(iso);
  return `${WEEKDAYS_SHORT[d.getDay()]}, ${MONTHS_SHORT[d.getMonth()]} ${d.getDate()}`;
}

/** 'Oct 16' */
export function formatMonthDay(iso: ISODate): string {
  const d = parseISODate(iso);
  return `${MONTHS_SHORT[d.getMonth()]} ${d.getDate()}`;
}

/** 'Oct 16, 2026' */
export function formatLongDate(iso: ISODate): string {
  const d = parseISODate(iso);
  return `${MONTHS_SHORT[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

/** 'Oct 15 – 21, 2026' or 'Dec 28, 2026 – Jan 3, 2027' */
export function formatDateRange(start: ISODate, end: ISODate): string {
  const a = parseISODate(start);
  const b = parseISODate(end);
  if (a.getFullYear() !== b.getFullYear()) return `${formatLongDate(start)} – ${formatLongDate(end)}`;
  if (a.getMonth() !== b.getMonth()) {
    return `${MONTHS_SHORT[a.getMonth()]} ${a.getDate()} – ${MONTHS_SHORT[b.getMonth()]} ${b.getDate()}, ${b.getFullYear()}`;
  }
  return `${MONTHS_SHORT[a.getMonth()]} ${a.getDate()} – ${b.getDate()}, ${b.getFullYear()}`;
}

/** '13:05' -> 785 minutes after midnight. */
export function timeToMin(t: Time): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

/** 785 -> '13:05' (clamped to the same day). */
export function minToTime(min: number): Time {
  const clamped = Math.max(0, Math.min(23 * 60 + 59, Math.round(min)));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** '13:05' -> '1:05 PM' */
export function formatTime(t: Time): string {
  const [h, m] = t.split(':').map(Number);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${suffix}`;
}

/** '13:00' -> '1 PM' (compact, for axis labels). */
export function formatHour(t: Time | number): string {
  const h = typeof t === 'number' ? t : Number(t.split(':')[0]);
  const suffix = h >= 12 && h < 24 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12} ${suffix}`;
}

/** Duration label: 90 -> '1 hr 30 min' */
export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h && m) return `${h} hr ${m} min`;
  if (h) return `${h} hr`;
  return `${m} min`;
}

/** Do two [start, end) time ranges overlap? */
export function rangesOverlap(aStart: Time, aEnd: Time, bStart: Time, bEnd: Time): boolean {
  return timeToMin(aStart) < timeToMin(bEnd) && timeToMin(bStart) < timeToMin(aEnd);
}

/* --------------------------------------------------------- trip timing */

export type TripPhase = 'upcoming' | 'active' | 'past';

/** Where a trip is relative to "now" (the demo clock). */
export function tripPhase(trip: Pick<Trip, 'startDate' | 'endDate'>, today: ISODate): TripPhase {
  if (today < trip.startDate) return 'upcoming';
  if (today > trip.endDate) return 'past';
  return 'active';
}

/** 1-based day number of `date` within the trip. */
export function dayNumber(trip: Pick<Trip, 'startDate'>, date: ISODate): number {
  return daysBetween(trip.startDate, date) + 1;
}

/** 'Day 3 — 10/17' (the doc's exact itinerary heading format). */
export function dayHeading(trip: Pick<Trip, 'startDate'>, date: ISODate): string {
  return `Day ${dayNumber(trip, date)} — ${formatMMDD(date)}`;
}

/** Human countdown: 'in 14 days', 'tomorrow', 'today'. */
export function relativeDays(from: ISODate, to: ISODate): string {
  const n = daysBetween(from, to);
  if (n === 0) return 'today';
  if (n === 1) return 'tomorrow';
  if (n === -1) return 'yesterday';
  if (n > 0) return `in ${n} days`;
  return `${-n} days ago`;
}

/** Resolve the demo clock to a concrete date/time (real time when unset). */
export function resolveClock(clock: DemoClock | null): DemoClock {
  return clock ?? { date: realTodayISO(), time: realNowTime() };
}
