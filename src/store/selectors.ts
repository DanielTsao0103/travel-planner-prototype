/**
 * Selectors: pure functions that read (never change) the state.
 * Pages call these instead of digging through `AppState` themselves, so the
 * rules (who is "you", which trip is current, what is visible "today") live
 * in one place.
 */

import { addDays, eachDay, rangesOverlap, resolveClock, timeToMin, tripPhase, type TripPhase } from '../lib/dates';
import { distanceMeters, offsetMeters, type LatLng } from '../lib/geo';
import { buildTripAccess, type TripAccess } from '../lib/permissions';
import { firstName } from '../lib/format';
import type {
  Account,
  AppState,
  DemoClock,
  Expense,
  ISODate,
  Person,
  Reimbursement,
  Role,
  Suggestion,
  Time,
  Trip,
  TripEvent,
} from '../data/types';

/* ---------------------------------------------------------------- session */

export function currentAccount(s: AppState): Account | null {
  return s.accounts.find((a) => a.id === s.sessionAccountId) ?? null;
}

/** The signed-in person (ignores "View as"). */
export function currentPerson(s: AppState): Person | null {
  const account = currentAccount(s);
  return account ? (s.people.find((p) => p.id === account.personId) ?? null) : null;
}

export function getPerson(s: AppState, personId: string): Person | undefined {
  return s.people.find((p) => p.id === personId);
}

/** Display name; "You" when it's the acting person. */
export function personName(s: AppState, personId: string, actingPersonId?: string): string {
  if (actingPersonId && personId === actingPersonId) return 'You';
  return getPerson(s, personId)?.name ?? 'Someone';
}

export function personFirstName(s: AppState, personId: string): string {
  return firstName(getPerson(s, personId)?.name ?? 'Someone');
}

/* ------------------------------------------------------------------ clock */

/** "Now" according to the demo clock (real time unless the Prototype drawer changed it). */
export function now(s: AppState): DemoClock {
  return resolveClock(s.demo.clock);
}

export function today(s: AppState): ISODate {
  return now(s).date;
}

/* ------------------------------------------------------------------ trips */

export function getTrip(s: AppState, tripId: string | undefined | null): Trip | undefined {
  return tripId ? s.trips.find((t) => t.id === tripId) : undefined;
}

export function phaseOf(s: AppState, trip: Trip): TripPhase {
  return tripPhase(trip, today(s));
}

/** Trips the signed-in person owns or has accepted, newest-first within each phase. */
export function myTrips(s: AppState): Trip[] {
  const me = currentPerson(s);
  if (!me) return [];
  return s.trips
    .filter((t) => (s.demo.showSample || !t.isSample) && t.members.some((m) => m.personId === me.id && m.status === 'accepted'))
    .sort((a, b) => a.startDate.localeCompare(b.startDate));
}

/** Pending invitations for the signed-in person. */
export function pendingInvites(s: AppState): Trip[] {
  const me = currentPerson(s);
  if (!me) return [];
  return s.trips.filter((t) => t.members.some((m) => m.personId === me.id && m.status === 'pending'));
}

/** The trip happening now (by the demo clock), if any. */
export function activeTrip(s: AppState): Trip | undefined {
  const d = today(s);
  return myTrips(s).find((t) => t.startDate <= d && d <= t.endDate);
}

/**
 * "Current trip" rule (plan §2): the active trip, else the last trip opened,
 * else the next upcoming trip, else undefined.
 */
export function currentTrip(s: AppState): Trip | undefined {
  const mine = myTrips(s);
  const active = activeTrip(s);
  if (active) return active;
  const last = mine.find((t) => t.id === s.ui.lastTripId);
  if (last) return last;
  const d = today(s);
  return mine.find((t) => t.endDate >= d) ?? mine[mine.length - 1];
}

/** The sample trip that belongs to the signed-in person. */
export function mySampleTrip(s: AppState): Trip | undefined {
  const me = currentPerson(s);
  return me ? s.trips.find((t) => t.isSample && t.ownerId === me.id) : undefined;
}

/** All dates of a trip. */
export function tripDays(trip: Trip): ISODate[] {
  return eachDay(trip.startDate, trip.endDate);
}

/* ------------------------------------------------------- access / roles */

/**
 * Who is "you" on this trip, and with what role.
 *
 * The Prototype drawer's "View as" switch changes the role. On the sample trip
 * it also swaps to the matching fictional companion (Editor → Jordan,
 * Day editor → Sam, Viewer → Priya) so names, "owes" rows, and to-dos line up.
 * On other trips it keeps you as yourself and only overrides the role.
 */
export function actingFor(s: AppState, trip: Trip): { personId: string; role: Role; isViewAs: boolean } {
  const me = currentPerson(s);
  const myId = me?.id ?? trip.ownerId;
  const myMembership = trip.members.find((m) => m.personId === myId);
  const realRole: Role = myMembership?.role ?? 'viewer';
  const viewAs = s.demo.viewAs;
  if (!viewAs || viewAs === realRole) return { personId: myId, role: realRole, isViewAs: false };
  if (trip.isSample) {
    const stand: Record<Role, string> = { owner: trip.ownerId, editor: 'p-jordan', day: 'p-sam', viewer: 'p-priya' };
    return { personId: stand[viewAs], role: viewAs, isViewAs: true };
  }
  return { personId: myId, role: viewAs, isViewAs: true };
}

export function tripAccess(s: AppState, trip: Trip): TripAccess {
  const acting = actingFor(s, trip);
  const access = buildTripAccess({
    trip,
    actingPersonId: acting.personId,
    role: acting.role,
    isViewAs: acting.isViewAs,
    today: today(s),
    ownerName: personFirstName(s, trip.ownerId),
  });
  // A day editor shown via "View as" on a non-sample trip has no assigned days yet:
  // give them the first day so the state is demonstrable.
  if (acting.isViewAs && acting.role === 'day' && !trip.isSample && access.editableDays.length === 0 && !access.isPast) {
    const first = trip.startDate;
    return { ...access, editableDays: [first], canEditDay: (d) => d === first, canAddEvents: true };
  }
  return access;
}

/** People on a trip (accepted first), with their membership. */
export function tripPeople(s: AppState, trip: Trip): Array<{ person: Person; role: Role; status: string; days?: ISODate[] }> {
  const order: Record<Role, number> = { owner: 0, editor: 1, day: 2, viewer: 3 };
  return trip.members
    .filter((m) => m.status !== 'declined')
    .map((m) => ({ person: getPerson(s, m.personId)!, role: m.role, status: m.status, days: m.days }))
    .filter((x) => x.person)
    .sort((a, b) => (a.status === b.status ? order[a.role] - order[b.role] : a.status === 'accepted' ? -1 : 1));
}

export function acceptedMemberIds(trip: Trip): string[] {
  return trip.members.filter((m) => m.status === 'accepted').map((m) => m.personId);
}

/* ----------------------------------------------------------------- events */

export function sortEvents(events: TripEvent[]): TripEvent[] {
  return [...events].sort((a, b) => a.date.localeCompare(b.date) || timeToMin(a.start) - timeToMin(b.start));
}

export function tripEvents(s: AppState, tripId: string): TripEvent[] {
  return sortEvents(s.events.filter((e) => e.tripId === tripId));
}

export function eventsOn(s: AppState, tripId: string, date: ISODate): TripEvent[] {
  return tripEvents(s, tripId).filter((e) => e.date === date);
}

export interface DayGroup {
  date: ISODate;
  dayNumber: number;
  events: TripEvent[];
}

/** The itinerary grouped by day — includes empty days (Page 8). */
export function itineraryByDay(s: AppState, trip: Trip): DayGroup[] {
  const events = tripEvents(s, trip.id);
  return tripDays(trip).map((date, i) => ({ date, dayNumber: i + 1, events: events.filter((e) => e.date === date) }));
}

/** Events that overlap a proposed time slot (Pages 7, 9, 11 show these as conflicts). */
export function conflictsFor(
  s: AppState,
  tripId: string,
  date: ISODate,
  start: Time,
  end: Time,
  excludeEventId?: string,
): TripEvent[] {
  return eventsOn(s, tripId, date).filter((e) => e.id !== excludeEventId && rangesOverlap(start, end, e.start, e.end));
}

/** Free gaps of at least `minMinutes` between 8:00 and 22:00 on a day. */
export function freeGaps(s: AppState, tripId: string, date: ISODate, minMinutes = 45): Array<{ start: Time; end: Time; minutes: number }> {
  const dayStart = 8 * 60;
  const dayEnd = 22 * 60;
  const evs = eventsOn(s, tripId, date);
  const gaps: Array<{ start: Time; end: Time; minutes: number }> = [];
  let cursor = dayStart;
  for (const e of evs) {
    const st = timeToMin(e.start);
    if (st - cursor >= minMinutes) gaps.push({ start: toTime(cursor), end: toTime(st), minutes: st - cursor });
    cursor = Math.max(cursor, timeToMin(e.end));
  }
  if (dayEnd - cursor >= minMinutes) gaps.push({ start: toTime(cursor), end: toTime(dayEnd), minutes: dayEnd - cursor });
  return gaps;
}

function toTime(min: number): Time {
  return `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
}

/* ------------------------------------------------- location (simulated) */

export interface SimLocation extends LatLng {
  label: string;
  basis: 'at-event' | 'just-left' | 'lodging' | 'destination';
  eventId?: string;
}

/**
 * Where the traveler "is" right now. Real location is never used: during the
 * trip we place them at their current event, just outside the one they last
 * left, or at the first destination.
 */
export function simulatedLocation(s: AppState, trip: Trip): SimLocation | null {
  const clock = now(s);
  if (clock.date < trip.startDate || clock.date > trip.endDate) return null;
  const nowMin = timeToMin(clock.time);
  const todays = eventsOn(s, trip.id, clock.date);
  const current = todays.find((e) => timeToMin(e.start) <= nowMin && nowMin < timeToMin(e.end));
  if (current) return { lat: current.place.lat, lng: current.place.lng, label: current.title ?? current.place.name, basis: 'at-event', eventId: current.id };
  const past = todays.filter((e) => timeToMin(e.end) <= nowMin);
  const last = past[past.length - 1];
  if (last) {
    const p = offsetMeters(last.place, 18, 14); // a few steps outside the door
    return { ...p, label: `Near ${last.title ?? last.place.name}`, basis: 'just-left', eventId: last.id };
  }
  const lodging = tripEvents(s, trip.id).filter((e) => e.place.category === 'lodging' && e.date <= clock.date).pop();
  if (lodging) return { lat: lodging.place.lat, lng: lodging.place.lng, label: lodging.place.name, basis: 'lodging', eventId: lodging.id };
  const firstPlaceToday = todays[0];
  if (firstPlaceToday) {
    const p = offsetMeters(firstPlaceToday.place, -220, -160);
    return { ...p, label: `On the way to ${firstPlaceToday.title ?? firstPlaceToday.place.name}`, basis: 'destination' };
  }
  const d = trip.destinations[0];
  return d ? { lat: d.lat, lng: d.lng, label: d.name, basis: 'destination' } : null;
}

/** The next event today after "now" (Page 10's "Where to next"). */
export function nextEventToday(s: AppState, trip: Trip): TripEvent | undefined {
  const clock = now(s);
  const nowMin = timeToMin(clock.time);
  return eventsOn(s, trip.id, clock.date).find((e) => timeToMin(e.start) > nowMin);
}

/** The next upcoming event of the trip from "now" (any day). */
export function nextEventAnyDay(s: AppState, trip: Trip): TripEvent | undefined {
  const clock = now(s);
  return tripEvents(s, trip.id).find((e) => e.date > clock.date || (e.date === clock.date && timeToMin(e.start) > timeToMin(clock.time)));
}

export function distanceFrom(a: LatLng, b: LatLng): number {
  return distanceMeters(a, b);
}

/* ------------------------------------------------------------------ money */

/** Expenses dated on or before "today" (so spending builds up as the demo clock moves). */
export function visibleExpenses(s: AppState, tripId: string): Expense[] {
  const d = today(s);
  return s.expenses.filter((e) => e.tripId === tripId && e.date <= d).sort((a, b) => b.date.localeCompare(a.date));
}

export function visibleReimbursements(s: AppState, tripId: string): Reimbursement[] {
  const visible = new Set(visibleExpenses(s, tripId).map((e) => e.id));
  return s.reimbursements.filter((r) => r.tripId === tripId && (!r.expenseId || visible.has(r.expenseId)));
}

/** A person's share of an expense (even split). */
export function shareOf(expense: Expense, personId: string): number {
  if (!expense.splitWithIds.includes(personId)) return 0;
  return expense.amount / expense.splitWithIds.length;
}

/* ------------------------------------------------------------ suggestions */

export function tripSuggestions(s: AppState, tripId: string): Suggestion[] {
  return s.suggestions.filter((x) => x.tripId === tripId);
}

export function decisionFor(s: AppState, tripId: string, suggestionId: string) {
  return s.decisions.find((d) => d.tripId === tripId && d.suggestionId === suggestionId);
}

/* ---------------------------------------------------------------- helpers */

/** "Jump into trip" target time: Day 2 at 2:20 PM for the sample trip, else Day 1 at noon. */
export function jumpTarget(trip: Trip): DemoClock {
  return trip.isSample ? { date: addDays(trip.startDate, 1), time: '14:20' } : { date: trip.startDate, time: '12:00' };
}
