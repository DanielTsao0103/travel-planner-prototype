/**
 * Page 7's form data and rules, kept apart from the UI so they're easy to
 * read: the draft shape, defaults, validation, and small time/format helpers.
 */

import type { EventCost, ISODate, Place, Time, Trip, TripEvent } from '../../data/types';
import { dayNumber, formatMMDD, formatTime, minToTime, timeToMin, weekdayShort } from '../../lib/dates';
import type { EventInput } from '../../store/actions';

/** Everything the event form edits. Empty strings mean "not filled in yet". */
export interface EventDraft {
  place: Place | null;
  /** Optional label shown instead of the place name ("Dinner with Jordan’s cousins"). */
  title: string;
  date: ISODate | '';
  start: Time | '';
  end: Time | '';
  /** Raw text from the cost box ('' = no cost entered). */
  costAmount: string;
  costPer: EventCost['per'];
  attendeeIds: string[];
  notes: string;
  confirmation: string;
}

/** Fields that can have an error message. */
export type DraftField = 'place' | 'date' | 'start' | 'end' | 'cost' | 'attendees';
export type DraftErrors = Partial<Record<DraftField, string>>;

/**
 * Screenshot review (7F): did a value come from the screenshot ("found"),
 * or does the person still need to fill it in ("needs")?
 */
export type FieldSource = 'found' | 'needs';
export type FieldSources = Partial<Record<DraftField | 'confirmation', FieldSource>>;

/** Order used to focus the first problem after a Save attempt. */
export const FIELD_ORDER: DraftField[] = ['place', 'date', 'start', 'end', 'cost', 'attendees'];

/** An empty form; everyone on the trip is coming by default. */
export function blankDraft(attendeeIds: string[]): EventDraft {
  return { place: null, title: '', date: '', start: '', end: '', costAmount: '', costPer: 'person', attendeeIds, notes: '', confirmation: '' };
}

/** Prefill the form from an existing event (edit mode, 7H). */
export function draftFromEvent(e: TripEvent): EventDraft {
  return {
    place: e.place,
    title: e.title ?? '',
    date: e.date,
    start: e.start,
    end: e.end,
    costAmount: e.cost ? formatAmount(e.cost.amount) : '',
    costPer: e.cost?.per ?? 'person',
    attendeeIds: [...e.attendeeIds],
    notes: e.notes ?? '',
    confirmation: e.confirmation ?? '',
  };
}

/** 13 → '13', 3.5 → '3.50' (how an amount looks in the cost box). */
export function formatAmount(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}

/** 'HH:MM' (24-hour)? */
export function isTime(v: string | null | undefined): v is Time {
  return !!v && /^([01]\d|2[0-3]):[0-5]\d$/.test(v);
}

/** 'YYYY-MM-DD'? */
export function isISODate(v: string | null | undefined): v is ISODate {
  return !!v && /^\d{4}-\d{2}-\d{2}$/.test(v);
}

/** '14:30' + 90 → '16:00' (stays within the same day, max 11:59 PM). */
export function addMinutes(t: Time, minutes: number): Time {
  return minToTime(timeToMin(t) + minutes);
}

/** Minutes from start to end (0 when either is missing). */
export function durationMin(start: string, end: string): number {
  return isTime(start) && isTime(end) ? timeToMin(end) - timeToMin(start) : 0;
}

/**
 * Read the cost box: '' → null (no cost), '12.5' / '$1,200' → a number,
 * anything else → 'invalid'.
 */
export function parseCost(raw: string): number | null | 'invalid' {
  const cleaned = raw.trim().replace(/[$,\s]/g, '');
  if (!cleaned) return null;
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return 'invalid';
  const n = Number(cleaned);
  return n > 100_000 ? 'invalid' : n;
}

/** Every rule the form checks before saving. */
export function validateDraft(d: EventDraft, editableDays: ISODate[]): DraftErrors {
  const e: DraftErrors = {};
  if (!d.place) e.place = 'Choose a place from the list, or add the name you typed';
  if (!d.date) e.date = 'Pick a day';
  else if (!editableDays.includes(d.date)) e.date = 'Pick one of the days you can edit';
  if (!isTime(d.start)) e.start = 'Pick a start time';
  if (!isTime(d.end)) e.end = 'Pick an end time';
  else if (isTime(d.start) && timeToMin(d.end) <= timeToMin(d.start)) e.end = 'End time must be after the start time';
  if (parseCost(d.costAmount) === 'invalid') e.cost = 'Enter a cost like 12.50, or leave it blank';
  if (d.attendeeIds.length === 0) e.attendees = 'Pick at least one person';
  return e;
}

/** True when any field has an error message. */
export function hasErrors(e: DraftErrors): boolean {
  return Object.values(e).some(Boolean);
}

/** Turn a valid draft into what `addEvent` / `updateEvent` expect. */
export function toEventInput(d: EventDraft, tripId: string, source: TripEvent['source']): EventInput {
  const amount = parseCost(d.costAmount);
  return {
    tripId,
    place: d.place!,
    title: d.title.trim() || undefined,
    date: d.date as ISODate,
    start: d.start as Time,
    end: d.end as Time,
    cost: typeof amount === 'number' ? { amount, per: d.costPer } : undefined,
    attendeeIds: d.attendeeIds,
    notes: d.notes.trim() || undefined,
    confirmation: d.confirmation.trim() || undefined,
    source,
  };
}

/** '3:30–4:15 PM', or '11:30 AM–12:15 PM' when it crosses noon. */
export function formatTimeRange(start: Time, end: Time): string {
  const a = formatTime(start);
  const b = formatTime(end);
  const sameHalf = timeToMin(start) < 720 === timeToMin(end) < 720;
  return sameHalf ? `${a.replace(/\s(AM|PM)$/, '')}–${b}` : `${a}–${b}`;
}

/** 'Day 2 — Fri, 10/16' (the day picker's option text). */
export function dayOptionLabel(trip: Pick<Trip, 'startDate'>, date: ISODate): string {
  return `Day ${dayNumber(trip, date)} — ${weekdayShort(date)}, ${formatMMDD(date)}`;
}

/** Only allow in-app return paths like '/trip/abc/day/2026-10-16'. */
export function safeReturnPath(v: string | null): string | null {
  return v && v.startsWith('/') && !v.startsWith('//') ? v : null;
}

/** Add query params to a path that may already have some. */
export function appendQuery(path: string, params: Record<string, string>): string {
  const [base, qs = ''] = path.split('?');
  const q = new URLSearchParams(qs);
  for (const [k, v] of Object.entries(params)) q.set(k, v);
  const out = q.toString();
  return out ? `${base}?${out}` : base;
}
