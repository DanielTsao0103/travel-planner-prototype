/**
 * Pure helpers for the Ideas page (Page 9): time-range labels, the "fit" chips
 * on each card, and small lookups (who the group is, what was added).
 * No React here, so every rule is easy to read and test on its own.
 */

import type { AppState, ISODate, PlaceCategory, Suggestion, SurveyResponse, Time, Trip, TripEvent } from '../../data/types';
import { eventLabel } from '../../components/domain/EventItem';
import { dayNumber, formatTime, timeToMin } from '../../lib/dates';
import { distanceLabel, moneyWhole } from '../../lib/format';
import { acceptedMemberIds, conflictsFor, eventsOn, freeGaps, tripEvents } from '../../store/selectors';

/* ------------------------------------------------------------------ time */

/** "2:15–3:30 PM", or "11:45 AM–1:00 PM" when the range crosses noon. */
export function formatRange(start: Time, end: Time): string {
  const [aTime, aMer] = formatTime(start).split(' ');
  const [bTime, bMer] = formatTime(end).split(' ');
  return aMer === bMer ? `${aTime}–${bTime} ${bMer}` : `${aTime} ${aMer}–${bTime} ${bMer}`;
}

/** "Day 2 · 2:20–2:50 PM" */
export function slotLabel(trip: Trip, s: Pick<Suggestion, 'date' | 'start' | 'end'>): string {
  return `Day ${dayNumber(trip, s.date)} · ${formatRange(s.start, s.end)}`;
}

/** Has the suggested time already started (during the trip)? */
export function slotHasPassed(s: Pick<Suggestion, 'date' | 'start'>, todayIso: ISODate, nowTime: Time, isActive: boolean): boolean {
  if (!isActive) return false;
  return s.date < todayIso || (s.date === todayIso && timeToMin(s.start) < timeToMin(nowTime));
}

/** Round minutes up to the next 5 (time inputs step in 5-minute increments). */
export function roundUp5(min: number): number {
  return Math.ceil(min / 5) * 5;
}

/* ---------------------------------------------------------------- labels */

export const CATEGORY_LABEL: Record<PlaceCategory, string> = {
  landmark: 'Landmark',
  museum: 'Museum',
  viewpoint: 'Viewpoint',
  restaurant: 'Restaurant',
  cafe: 'Café',
  market: 'Market',
  bar: 'Bar',
  nature: 'Nature',
  lodging: 'Stay',
  transit: 'Station',
  shopping: 'Shop',
  tour: 'Tour',
  other: 'Place',
};

/** "Café · Cais do Sodré" (falls back to the city when OpenStreetMap has no street). */
export function categoryLine(s: Suggestion): string {
  const where = s.place.area || s.place.city;
  return where ? `${CATEGORY_LABEL[s.place.category]} · ${where}` : CATEGORY_LABEL[s.place.category];
}

/** "About $6 per person", "Free", or null when we have no estimate. */
export function costLabel(amount: number | undefined): string | null {
  if (amount === undefined) return null;
  if (amount === 0) return 'Free';
  return `About ${moneyWhole(amount)} per person`;
}

/* ----------------------------------------------------------------- group */

/** Survey answers of everyone who accepted the trip (people without a survey are skipped). */
export function groupSurveys(state: AppState, trip: Trip): SurveyResponse[] {
  return acceptedMemberIds(trip)
    .map((id) => state.surveys[id])
    .filter((x): x is SurveyResponse => !!x);
}

/** The event created when a suggestion was added (newest first), if it still exists. */
export function addedEventFor(state: AppState, s: Suggestion): TripEvent | undefined {
  return tripEvents(state, s.tripId)
    .filter((e) => e.source === 'suggestion' && e.place.id === s.place.id)
    .pop();
}

/* ------------------------------------------------------------- fit chips */

/**
 * Chip kinds decide the color:
 *  person (who it suits) = teal, time (fits the schedule) = green,
 *  warn (overlap / not step-free) = amber, everything else = neutral.
 */
export type FitKind = 'person' | 'time' | 'walk' | 'access' | 'warn' | 'cost' | 'plain';

export interface FitChip {
  label: string;
  kind: FitKind;
}

/** Guess a chip's kind from its wording (bundled ideas come with plain strings). */
export function classifyFit(label: string): FitKind {
  if (/^overlaps|not step-free|stairs|steep/i.test(label)) return 'warn';
  if (/partly step-free/i.test(label)) return 'plain';
  if (/step-free|seated|wheelchair/i.test(label)) return 'access';
  if (/fits your|fills your|free afternoon|wide open/i.test(label)) return 'time';
  if (/walk|min away|from you|taxi|by car/i.test(label)) return 'walk';
  if (/^free$/i.test(label)) return 'cost';
  if (label.includes(' · ')) return 'person';
  return 'plain';
}

export interface FitContext {
  state: AppState;
  trip: Trip;
  todayIso: ISODate;
  isActive: boolean;
  /** Someone in the group needs step-free access (so access facts matter). */
  needsStepFree: boolean;
  /** Walking minutes from your simulated location (today's ideas only). */
  walkFromYou: Record<string, number>;
  /** Straight-line meters from your simulated location (today's ideas only). */
  metersFromYou: Record<string, number>;
}

/**
 * Every chip for one idea, most important first:
 *  1. a scheduling conflict (so overlaps are never hidden),
 *  2. the idea's own reasons (who it suits, how far from the planned stop),
 *  3. "Fits your 2:15–3:30 PM gap" when the slot sits inside free time,
 *  4. "4 min walk from you" (today, during the trip; location is simulated),
 *  5. access and ticket facts.
 */
export function fitChips(s: Suggestion, ctx: FitContext): FitChip[] {
  const { state, trip } = ctx;
  const chips: FitChip[] = [];
  const has = (re: RegExp) => s.fit.some((f) => re.test(f));

  const conflicts = conflictsFor(state, trip.id, s.date, s.start, s.end);
  if (conflicts.length) {
    const more = conflicts.length > 1 ? ` +${conflicts.length - 1} more` : '';
    chips.push({ label: `Overlaps ${eventLabel(conflicts[0])}${more}`, kind: 'warn' });
  }

  for (const f of s.fit) {
    // A bare "2 min walk" means from the planned stop the idea is based on; say so.
    const label = /^\d+ min walk$/i.test(f) && s.basedOnLabel ? `${f} from ${s.basedOnLabel}` : f;
    chips.push({ label, kind: classifyFit(label) });
  }

  if (!conflicts.length && !has(/fits your|fills your|free afternoon|wide open/i)) {
    if (eventsOn(state, trip.id, s.date).length === 0) {
      chips.push({ label: `Day ${dayNumber(trip, s.date)} is wide open`, kind: 'time' });
    } else {
      const gap = freeGaps(state, trip.id, s.date, 30).find((g) => timeToMin(g.start) <= timeToMin(s.start) && timeToMin(s.end) <= timeToMin(g.end));
      if (gap) chips.push({ label: `Fits your ${formatRange(gap.start, gap.end)} gap`, kind: 'time' });
    }
  }

  if (ctx.isActive && s.date === ctx.todayIso) {
    const walk = ctx.walkFromYou[s.place.id];
    const meters = ctx.metersFromYou[s.place.id];
    if (walk !== undefined) chips.push({ label: `${walk} min walk from you`, kind: 'walk' });
    else if (meters !== undefined) chips.push({ label: `${distanceLabel(meters)} from you`, kind: 'walk' });
  }

  if (ctx.needsStepFree && !has(/step-free|seated/i)) {
    if (s.place.stepFree === 'yes') chips.push({ label: 'Step-free', kind: 'access' });
    else if (s.place.stepFree === 'no') chips.push({ label: 'Not step-free', kind: 'warn' });
    else if (s.place.stepFree === 'partial') chips.push({ label: 'Partly step-free', kind: 'plain' });
  }
  if (s.place.ticketRequired && !has(/ticket/i)) chips.push({ label: 'Tickets needed', kind: 'plain' });

  return chips;
}
