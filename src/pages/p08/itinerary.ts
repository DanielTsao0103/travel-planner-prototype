/**
 * Pure helpers for the itinerary page (Page 8).
 *
 * They only read data (no React, no state changes), which keeps the page
 * components short and makes each rule easy to find: where a day "is",
 * who is going, how the budget looks, and which ideas are still open.
 */

import type { AppState, ISODate, Suggestion, Trip, TripEvent } from '../../data/types';
import { dayNumber, formatMMDD, weekdayShort } from '../../lib/dates';
import { listJoin } from '../../lib/format';
import {
  decisionFor,
  shareOf,
  tripPeople,
  tripSuggestions,
  visibleExpenses,
  visibleReimbursements,
  type DayGroup,
} from '../../store/selectors';

/** DOM id of a day section (the day chips and the rail scroll to it). */
export const dayAnchorId = (date: ISODate): string => `p08-day-${date}`;

/** DOM id of an event row (used to scroll a highlighted event into view). */
export const eventAnchorId = (eventId: string): string => `p08-ev-${eventId}`;

/* ------------------------------------------------------------ day places */

/** The city that appears most often among a day's events. Ties go to the earliest event. */
function mainCity(events: TripEvent[]): string | null {
  const counts = new Map<string, number>();
  for (const e of events) if (e.place.city) counts.set(e.place.city, (counts.get(e.place.city) ?? 0) + 1);
  let best: string | null = null;
  let bestCount = 0;
  // Walk the events in time order so a tie keeps the earliest city.
  for (const e of events) {
    const n = counts.get(e.place.city) ?? 0;
    if (n > bestCount) {
      best = e.place.city;
      bestCount = n;
    }
  }
  return best;
}

/**
 * A short "where" label for every day:
 *  - "Lisbon" for an ordinary day,
 *  - "Lisbon → Porto" when the day starts with a train/flight from another city,
 *  - "Day trip to Sintra" when you leave by train and also end the day on one,
 *  - empty days borrow the city you'd wake up in (the previous day's last stop),
 *    else the next planned city, else the trip's first destination.
 */
export function dayPlaceLabels(days: DayGroup[], trip: Trip): Record<ISODate, string> {
  const own = days.map((d) => mainCity(d.events));
  const labels: Record<ISODate, string> = {};
  days.forEach((day, i) => {
    let city = own[i];
    // Empty day: look backwards first (where you slept), then forwards.
    for (let j = i - 1; !city && j >= 0; j--) {
      const evs = days[j].events;
      if (evs.length) city = evs[evs.length - 1].place.city || null;
    }
    for (let j = i + 1; !city && j < days.length; j++) {
      const evs = days[j].events;
      if (evs.length) city = evs[0].place.city || null;
    }
    city = city || trip.destinations[0]?.name || '';

    const first = day.events[0];
    const last = day.events[day.events.length - 1];
    const startsWithTravel = own[i] && first?.place.category === 'transit' && first.place.city && first.place.city !== own[i];
    if (startsWithTravel && day.events.length > 1 && last?.place.category === 'transit') {
      labels[day.date] = `Day trip to ${own[i]}`;
    } else if (startsWithTravel) {
      labels[day.date] = `${first.place.city} → ${own[i]}`;
    } else {
      labels[day.date] = city;
    }
  });
  return labels;
}

/* ---------------------------------------------------------------- people */

export interface PeopleSummary {
  rows: ReturnType<typeof tripPeople>;
  going: number;
  invited: number;
}

/** Everyone on the trip (accepted first) plus counts for the header line. */
export function peopleSummary(state: AppState, trip: Trip): PeopleSummary {
  const rows = tripPeople(state, trip);
  return {
    rows,
    going: rows.filter((r) => r.status === 'accepted').length,
    invited: rows.filter((r) => r.status === 'pending').length,
  };
}

/** "5 going · 1 invited", "3 went", or "Just you so far". */
export function peopleLine(p: PeopleSummary, isPast: boolean): string {
  if (isPast) return `${p.going} went`;
  if (p.going <= 1 && p.invited === 0) return 'Just you so far';
  return p.invited ? `${p.going} going · ${p.invited} invited` : `${p.going} going`;
}

/* ---------------------------------------------------------------- budget */

export interface BudgetSnapshot {
  mode: 'group' | 'individual';
  /** Spent so far (group total, or your share in individual mode). */
  spent: number;
  /** The budget to compare against (null = nobody set one yet). */
  budget: number | null;
  /** Repayments that haven't been marked paid yet. */
  openRepayments: number;
}

/**
 * Spent vs. budget for the rail card. Only expenses dated on or before the demo
 * "today" count, so the number grows as the demo clock moves through the trip.
 */
export function budgetSnapshot(state: AppState, trip: Trip, actingPersonId: string): BudgetSnapshot {
  const expenses = visibleExpenses(state, trip.id);
  const openRepayments = visibleReimbursements(state, trip.id).filter((r) => r.status === 'open').length;
  if (trip.budget.mode === 'individual') {
    const spent = expenses.reduce((sum, e) => sum + shareOf(e, actingPersonId), 0);
    return { mode: 'individual', spent, budget: trip.budget.personal[actingPersonId] ?? null, openRepayments };
  }
  const spent = expenses.reduce((sum, e) => sum + e.amount, 0);
  return { mode: 'group', spent, budget: trip.budget.groupAmount, openRepayments };
}

/* ----------------------------------------------------------------- ideas */

/** Suggestions nobody has added or declined yet. */
export function openIdeas(state: AppState, tripId: string): Suggestion[] {
  return tripSuggestions(state, tripId).filter((s) => !decisionFor(state, tripId, s.id));
}

/* ----------------------------------------------------------- permissions */

/** "You can edit Day 3 (Sat, 10/17). Other days are view-only." */
export function editableDaysSentence(trip: Trip, days: ISODate[]): string {
  if (days.length === 0) return 'You can view this trip, but none of its days are assigned to you yet.';
  const parts = days.map((d) => `Day ${dayNumber(trip, d)} (${weekdayShort(d)}, ${formatMMDD(d)})`);
  return `You can edit ${listJoin(parts)}. Other days are view-only.`;
}
