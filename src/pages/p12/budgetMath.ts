/**
 * Page 12 — pure budget math (no React, no state changes).
 *
 * Keeping the arithmetic here makes the components simple and lets us reason
 * about money in one place: totals per category, "how much is left",
 * who owes whom, and the even split used for repayment requests.
 */

import type { DemoNotification, Expense, ExpenseCategory, ISODate, Reimbursement, Trip, TripEvent } from '../../data/types';
import { round2, splitEvenly } from '../../lib/format';
import { dayNumber, timeToMin, tripPhase } from '../../lib/dates';

/** Display order for categories (matches the Add-expense chips). */
export const CATEGORY_ORDER: ExpenseCategory[] = ['lodging', 'food', 'activities', 'transport', 'shopping', 'other'];

export interface CategoryTotal {
  category: ExpenseCategory;
  /** Dollars in this category (full amounts in group mode, your share in individual mode). */
  amount: number;
  /** How many expenses contributed. */
  count: number;
}

/**
 * Sum expenses per category.
 * `amountOf` decides what counts: the whole expense (group budget) or one
 * person's share of it (individual budgets).
 */
export function categoryTotals(expenses: Expense[], amountOf: (e: Expense) => number): CategoryTotal[] {
  const totals = new Map<ExpenseCategory, CategoryTotal>(CATEGORY_ORDER.map((c) => [c, { category: c, amount: 0, count: 0 }]));
  for (const e of expenses) {
    const amount = amountOf(e);
    if (amount <= 0) continue;
    const row = totals.get(e.category) ?? totals.get('other')!;
    row.amount += amount;
    row.count += 1;
  }
  // Round once at the end so floating-point drift never shows up as "$0.01" differences.
  return CATEGORY_ORDER.map((c) => {
    const row = totals.get(c)!;
    return { ...row, amount: round2(row.amount) };
  });
}

/** Non-empty categories, biggest first (the pie and legend order). */
export function biggestFirst(totals: CategoryTotal[]): CategoryTotal[] {
  return totals.filter((t) => t.amount > 0).sort((a, b) => b.amount - a.amount);
}

export function sumOf(values: number[]): number {
  return round2(values.reduce((acc, v) => acc + v, 0));
}

/** The headline numbers for the KPI row and the bottom summary bar. */
export interface BudgetFigures {
  /** Budget amount, or null when nobody has set one yet. */
  budget: number | null;
  spent: number;
  /** budget − spent (negative when over), or null when there's no budget. */
  left: number | null;
  /** How far over budget (0 when not over). */
  over: number;
  /** Percent of the budget used (can exceed 100), or null when there's no budget. */
  pct: number | null;
}

export function budgetFigures(budget: number | null, spent: number): BudgetFigures {
  if (budget === null || budget <= 0) return { budget, spent, left: null, over: 0, pct: null };
  const left = round2(budget - spent);
  return { budget, spent, left, over: left < 0 ? round2(-left) : 0, pct: (spent / budget) * 100 };
}

/** "47%" style label; keeps one decimal only for tiny non-zero values. */
export function pctLabel(pct: number): string {
  if (pct > 0 && pct < 1) return '<1%';
  return `${Math.round(pct)}%`;
}

/* ------------------------------------------------------------- ordering */

/**
 * Newest first: by date, then by when it was logged (later entries in the
 * store array were added later), so a just-added expense lands on top of its day.
 */
export function newestFirst(expenses: Expense[], allExpenses: Expense[]): Expense[] {
  const order = new Map(allExpenses.map((e, i) => [e.id, i]));
  return [...expenses].sort((a, b) => b.date.localeCompare(a.date) || (order.get(b.id) ?? 0) - (order.get(a.id) ?? 0));
}

/* ---------------------------------------------------------- reimbursements */

export interface OwesSummary {
  /** Open amounts other people owe the person. */
  owedToMe: number;
  /** Open amounts the person owes others. */
  iOwe: number;
  owedByCount: number;
  oweToCount: number;
}

export function owesSummary(rows: Reimbursement[], personId: string): OwesSummary {
  let owedToMe = 0;
  let iOwe = 0;
  const owedBy = new Set<string>();
  const oweTo = new Set<string>();
  for (const r of rows) {
    if (r.status !== 'open') continue;
    if (r.toId === personId) {
      owedToMe += r.amount;
      owedBy.add(r.fromId);
    }
    if (r.fromId === personId) {
      iOwe += r.amount;
      oweTo.add(r.toId);
    }
  }
  return { owedToMe: round2(owedToMe), iOwe: round2(iOwe), owedByCount: owedBy.size, oweToCount: oweTo.size };
}

/**
 * Who would owe the payer what — the same even split the `addExpense` action
 * uses (the first shares absorb any leftover cents), minus the payer's own share.
 */
export function repaymentShares(amount: number, splitWithIds: string[], payerId: string): Array<{ personId: string; amount: number }> {
  const shares = splitEvenly(amount, splitWithIds.length);
  return splitWithIds.map((personId, i) => ({ personId, amount: shares[i] })).filter((s) => s.personId !== payerId);
}

/* ------------------------------------------------------------ dates */

/**
 * Default date for a new expense: the demo "today", but never after the trip's
 * last day. Earlier dates stay allowed so pre-trip bookings (lodging, trains)
 * count. We don't push it forward to the trip start, because expenses dated
 * after "today" are hidden until that day arrives.
 */
export function defaultExpenseDate(today: ISODate, trip: Pick<Trip, 'endDate'>): ISODate {
  return today > trip.endDate ? trip.endDate : today;
}

/** "Day 2 of 7", "Trip starts in 14 days", or "Trip ended" for the KPI caption. */
export function tripProgressLabel(trip: Pick<Trip, 'startDate' | 'endDate'>, today: ISODate, relative: (from: ISODate, to: ISODate) => string): string {
  const phase = tripPhase(trip, today);
  if (phase === 'upcoming') return `Trip starts ${relative(today, trip.startDate)}`;
  if (phase === 'past') return 'Trip ended';
  return `Day ${dayNumber(trip, today)} of ${dayNumber(trip, trip.endDate)}`;
}

/* ------------------------------------------------- demo receipt matching */

/**
 * Find the planned event a (simulated) Gmail receipt belongs to, by merchant
 * name. "Adega dos Becos (deposit)" matches the Day 4 event at Adega dos Becos.
 */
export function matchEvent(merchant: string, events: TripEvent[]): TripEvent | undefined {
  const base = merchantBase(merchant).toLowerCase();
  if (base.length < 4) return undefined;
  return events.find((e) => {
    const name = e.place.name.toLowerCase();
    return name === base || base.includes(name) || name.includes(base);
  });
}

/** "Adega dos Becos (deposit)" → "Adega dos Becos" */
export function merchantBase(merchant: string): string {
  return merchant.replace(/\s*\(.*?\)\s*/g, ' ').trim();
}

/** A plain word for what an event is: "fado night", "dinner", "visit", "stay"… */
export function eventNoun(event: TripEvent): string {
  // A fado house is a night out more than a meal (Adega dos Becos: "Fado house with a set dinner").
  if (/\bfado\b/i.test(`${event.place.name} ${event.place.blurb ?? ''}`)) return 'fado night';
  switch (event.place.category) {
    case 'restaurant':
    case 'cafe':
    case 'bar':
    case 'market': {
      const start = timeToMin(event.start);
      return start < 11 * 60 ? 'breakfast' : start < 16 * 60 ? 'lunch' : 'dinner';
    }
    case 'lodging':
      return 'stay';
    case 'transit':
      return 'trip';
    default:
      return 'visit';
  }
}

/** What to call an expense created from a demo notification. */
export function purposeFromNotification(n: DemoNotification, matched: TripEvent | undefined): string {
  if (matched && n.kind === 'gmail') {
    const noun = eventNoun(matched);
    const deposit = /deposit/i.test(n.merchant) ? ' (deposit)' : '';
    return `${noun[0].toUpperCase()}${noun.slice(1)} at ${matched.place.name}${deposit}`;
  }
  return merchantBase(n.merchant) || n.merchant;
}

/** Day number of an event within the trip (for "Matches your Day 4 dinner"). */
export function eventDay(trip: Pick<Trip, 'startDate'>, event: TripEvent): number {
  return dayNumber(trip, event.date);
}

/* --------------------------------------------------------------- parsing */

/** Parse what someone typed in a money field ("1,234.5", "$12") → number, or NaN. */
export function parseMoney(raw: string): number {
  const cleaned = raw.replace(/[$,\s]/g, '');
  if (!/^\d*\.?\d*$/.test(cleaned) || cleaned === '' || cleaned === '.') return Number.NaN;
  return Number(cleaned);
}

/** A number formatted for a money input (no "$", no thousands separators). */
export function moneyInputValue(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || !Number.isFinite(amount)) return '';
  return Number.isInteger(amount) ? String(amount) : amount.toFixed(2);
}
