/**
 * Page 13 aggregation: turns each traveler's survey answers (Page 15) into the
 * group tiles. These are pure functions (no React, no state changes), so every
 * rule — "comfort zone", "who is affected by stairs", "still to book" — is
 * written down in one readable place.
 *
 * Only ACCEPTED members count. Pending invitees haven't joined, so their
 * answers (if any) stay out of the group picture.
 */

import type { AppState, ISODate, Person, Role, SurveyResponse, Trip, TripEvent } from '../../data/types';
import { dayNumber, formatMMDD, weekdayShort } from '../../lib/dates';
import { tripPeople } from '../../store/selectors';
import { dietEntriesFor, normalizeInterests, type DietEntry, type MealBudget, type Scale5, type TicketPref, type WalkLimit } from '../p15/vocab';

/* ---------------------------------------------------------------- people */

/** One row of the trip's member list (same shape `tripPeople` returns). */
export interface Member {
  person: Person;
  role: Role;
  status: string;
  days?: ISODate[];
}

/** A member who has answered the survey. */
export interface Responder {
  person: Person;
  survey: SurveyResponse;
}

export interface GroupPicture {
  /** Everyone on the trip (accepted first, then pending), in display order. */
  members: Member[];
  accepted: Person[];
  /** Accepted members who shared their preferences. */
  responders: Responder[];
  /** Accepted members who haven't filled in the survey yet. */
  missing: Person[];
  /** Invited people who haven't accepted yet. */
  pending: Person[];
}

/** Split the trip’s people into who answered, who hasn’t yet, and who hasn’t accepted. */
export function groupPicture(state: AppState, trip: Trip): GroupPicture {
  const members = tripPeople(state, trip);
  const accepted = members.filter((m) => m.status === 'accepted').map((m) => m.person);
  const responders: Responder[] = [];
  for (const person of accepted) {
    const survey = state.surveys[person.id];
    if (survey) responders.push({ person, survey });
  }
  return {
    members,
    accepted,
    responders,
    missing: accepted.filter((p) => !state.surveys[p.id]),
    pending: members.filter((m) => m.status === 'pending').map((m) => m.person),
  };
}

/* ------------------------------------------------------------ small math */

/**
 * The "lower median": sort the answers and take the middle one (the lower of
 * the two middles for an even count). For spending, that is the highest price
 * level at least half the group is comfortable with.
 */
export function lowerMedian<T extends number>(values: T[]): T | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor((sorted.length - 1) / 2)];
}

/* ------------------------------------------------------------------ food */

/** A food need plus everyone who has it. */
export interface DietGroup extends DietEntry {
  personIds: string[];
}

/** Every diet/allergy in the group: severe first, then diets, then mild allergies. */
export function dietGroups(responders: Responder[]): DietGroup[] {
  const byKey = new Map<string, DietGroup>();
  for (const r of responders) {
    for (const entry of dietEntriesFor(r.survey)) {
      const group = byKey.get(entry.key) ?? { ...entry, personIds: [] };
      group.personIds.push(r.person.id);
      byKey.set(entry.key, group);
    }
  }
  const rank = { severe: 0, diet: 1, mild: 2 };
  // Array.sort is stable, so ties keep the member-list order (owner first).
  return [...byKey.values()].sort((a, b) => rank[a.kind] - rank[b.kind] || b.personIds.length - a.personIds.length);
}

/** What a kitchen must guarantee for a severe need ("nut-free", "celiac-safe"). */
export const MUST_PHRASE: Record<string, string> = {
  celiac: 'celiac-safe',
  'severe-tree-nuts': 'nut-free',
  'severe-peanuts': 'peanut-free',
  'severe-shellfish': 'shellfish-free',
  'severe-fish': 'fish-free',
  'severe-eggs': 'egg-free',
  'severe-dairy': 'dairy-free',
  'severe-soy': 'soy-free',
  'severe-sesame': 'sesame-free',
};

export interface Quote {
  personId: string;
  text: string;
}

/** Everyone’s optional food notes ("Carries an EpiPen…"). */
export function dietNotes(responders: Responder[]): Quote[] {
  return responders.filter((r) => r.survey.dietNotes?.trim()).map((r) => ({ personId: r.person.id, text: r.survey.dietNotes!.trim() }));
}

/* ---------------------------------------------------------------- scales */

export interface ScaleResult {
  /** Who picked each step. */
  buckets: Record<Scale5, string[]>;
  /** The group's middle answer. */
  median: Scale5 | null;
  /** People two or more steps above / below the middle. */
  high: string[];
  low: string[];
}

/** Place each person on a 5-step scale and find the middle answer and the outliers. */
export function scaleResult(responders: Responder[], pick: (s: SurveyResponse) => Scale5): ScaleResult {
  const buckets: Record<Scale5, string[]> = { 1: [], 2: [], 3: [], 4: [], 5: [] };
  for (const r of responders) buckets[pick(r.survey)].push(r.person.id);
  const median = lowerMedian(responders.map((r) => pick(r.survey)));
  const high = median === null ? [] : responders.filter((r) => pick(r.survey) - median >= 2).map((r) => r.person.id);
  const low = median === null ? [] : responders.filter((r) => median - pick(r.survey) >= 2).map((r) => r.person.id);
  return { buckets, median, high, low };
}

export interface SpendResult {
  buckets: Record<MealBudget, string[]>;
  /** Highest price level at least half the group picked (or more). */
  comfort: MealBudget | null;
  /** People whose budget is below the comfort zone. */
  below: string[];
  /** How many people are fine at the comfort zone. */
  fine: number;
}

/** Who picked each price level, and the group’s comfort zone. */
export function spendResult(responders: Responder[]): SpendResult {
  const buckets: Record<MealBudget, string[]> = { 1: [], 2: [], 3: [], 4: [] };
  for (const r of responders) buckets[r.survey.mealBudget].push(r.person.id);
  const comfort = lowerMedian(responders.map((r) => r.survey.mealBudget));
  const below = comfort === null ? [] : responders.filter((r) => r.survey.mealBudget < comfort).map((r) => r.person.id);
  return { buckets, comfort, below, fine: responders.length - below.length };
}

/* ---------------------------------------------------------- planned meals */

/** Place categories that count as a meal when checking spend per meal. */
const MEAL_CATEGORIES = new Set(['restaurant', 'cafe', 'market']);

export interface PlannedMeal {
  event: TripEvent;
  /** Planned cost per person in USD. */
  perPerson: number;
  /** Which price level ($ … $$$$) that cost falls in. */
  tier: MealBudget;
}

/** Price level for a per-person meal cost, using the survey's ranges. */
export function tierOf(perPerson: number): MealBudget {
  if (perPerson < 15) return 1;
  if (perPerson <= 30) return 2;
  if (perPerson <= 60) return 3;
  return 4;
}

/** Planned meals that have a cost, most expensive first. */
export function plannedMeals(events: TripEvent[]): PlannedMeal[] {
  const meals: PlannedMeal[] = [];
  for (const event of events) {
    if (!MEAL_CATEGORIES.has(event.place.category) || !event.cost) continue;
    const perPerson = event.cost.per === 'person' ? event.cost.amount : event.cost.amount / Math.max(1, event.attendeeIds.length);
    meals.push({ event, perPerson, tier: tierOf(perPerson) });
  }
  return meals.sort((a, b) => b.perPerson - a.perPerson);
}

/* ------------------------------------------------------------- tag counts */

export interface TagCount<T extends string> {
  value: T;
  label: string;
  personIds: string[];
}

/** Count how many people picked each option; most popular first (ties keep option order). */
export function tagCounts<T extends string>(responders: Responder[], pick: (s: SurveyResponse) => T[], options: Array<{ value: T; label: string }>): TagCount<T>[] {
  return options
    .map((o) => ({ value: o.value, label: o.label, personIds: responders.filter((r) => pick(r.survey).includes(o.value)).map((r) => r.person.id) }))
    .sort((a, b) => b.personIds.length - a.personIds.length);
}

/** Interests with the 'ancient' alias folded into 'historic'. */
export function interestsOf(s: SurveyResponse) {
  return normalizeInterests(s.interests);
}

/* --------------------------------------------------------- accessibility */

export interface AccessPerson {
  personId: string;
  survey: SurveyResponse;
}

/** People who use a mobility aid or need step-free entrances. */
export function accessPeople(responders: Responder[]): AccessPerson[] {
  return responders.filter((r) => r.survey.mobility !== 'none' || r.survey.stepFreeNeeded).map((r) => ({ personId: r.person.id, survey: r.survey }));
}

export interface AccessStop {
  event: TripEvent;
  access: 'no' | 'partial';
  /** People with access needs who are attending this stop. */
  going: string[];
  /** People with access needs who are NOT attending (the plan works around them). */
  skipping: string[];
}

/** Planned stops that aren't fully step-free: "not step-free" first, then by date and time. */
export function accessStops(events: TripEvent[], needIds: string[]): AccessStop[] {
  const flagged: AccessStop[] = [];
  for (const event of events) {
    const access = event.place.stepFree;
    if (access !== 'no' && access !== 'partial') continue;
    flagged.push({
      event,
      access,
      going: needIds.filter((id) => event.attendeeIds.includes(id)),
      skipping: needIds.filter((id) => !event.attendeeIds.includes(id)),
    });
  }
  const rank = { no: 0, partial: 1 };
  return flagged.sort((a, b) => rank[a.access] - rank[b.access]);
}

/** Stops whose access we don't know (e.g. places found with live search). */
export function unknownAccessCount(events: TripEvent[]): number {
  return events.filter((e) => e.place.stepFree === 'unknown' && e.place.category !== 'lodging').length;
}

/* --------------------------------------------------------------- walking */

export interface WalkRow {
  personId: string;
  minutes: WalkLimit;
}

/** Each person's walking limit, shortest first ("No limit" last). */
export function walkRows(responders: Responder[]): WalkRow[] {
  const rank = (m: WalkLimit) => (m === null ? Infinity : m);
  return responders.map((r) => ({ personId: r.person.id, minutes: r.survey.maxWalkMinutes })).sort((a, b) => rank(a.minutes) - rank(b.minutes));
}

/** The group's shortest limit and who has it (null when nobody set one). */
export function shortestWalk(rows: WalkRow[]): { minutes: number; personIds: string[] } | null {
  const limited = rows.filter((r) => r.minutes !== null);
  if (limited.length === 0) return null;
  const minutes = limited[0].minutes as number;
  return { minutes, personIds: limited.filter((r) => r.minutes === minutes).map((r) => r.personId) };
}

/* --------------------------------------------------------------- tickets */

export interface TicketStops {
  all: TripEvent[];
  /** Has a confirmation number. */
  booked: TripEvent[];
  toBook: TripEvent[];
}

/** Planned stops that need tickets, split by whether they have a confirmation number. */
export function ticketStops(events: TripEvent[]): TicketStops {
  const all = events.filter((e) => e.place.ticketRequired);
  return { all, booked: all.filter((e) => !!e.confirmation), toBook: all.filter((e) => !e.confirmation) };
}

/** Who is happy to book ahead, prefers walk-ins, or wants help booking. */
export function ticketPrefs(responders: Responder[]): Record<TicketPref, string[]> {
  const out: Record<TicketPref, string[]> = { 'happy-to-book': [], 'prefer-walk-in': [], 'need-help': [] };
  for (const r of responders) out[r.survey.tickets].push(r.person.id);
  return out;
}

/* ----------------------------------------------------------- other needs */

export function otherNeeds(responders: Responder[]): Quote[] {
  return responders.filter((r) => r.survey.otherNeeds?.trim()).map((r) => ({ personId: r.person.id, text: r.survey.otherNeeds!.trim() }));
}

/* ------------------------------------------------------------------ days */

/** 'Day 3 · Sat 10/17' */
export function dayLabel(trip: Pick<Trip, 'startDate'>, date: ISODate): string {
  return `Day ${dayNumber(trip, date)} · ${weekdayShort(date)} ${formatMMDD(date)}`;
}

/** A day editor's days: 'Day 3 · Sat 10/17' for one day, 'Days 3, 4' for several. */
export function daysLabel(trip: Pick<Trip, 'startDate'>, days: ISODate[]): string {
  const sorted = [...days].sort();
  if (sorted.length === 0) return 'No days assigned';
  if (sorted.length === 1) return dayLabel(trip, sorted[0]);
  return `Days ${sorted.map((d) => dayNumber(trip, d)).join(', ')}`;
}
