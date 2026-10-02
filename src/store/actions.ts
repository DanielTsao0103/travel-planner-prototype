/**
 * Actions: the only functions that change app state. Pages call these
 * (e.g. `addEvent(...)`) instead of editing state directly, so business rules
 * like "invitees start as Viewers" or "only the person owed can mark a
 * repayment paid" are enforced in one place.
 *
 * Everything external is SIMULATED: no email is sent, no account is accessed,
 * no money moves. "Sent" messages are only recorded in `state.messages`.
 */

import { addDays, daysBetween, realTodayISO } from '../lib/dates';
import { round2, splitEvenly } from '../lib/format';
import { uid } from '../lib/ids';
import { freshConnections, getService } from '../data/services';
import { starterBundleFor } from '../data/seed';
import type {
  AppState,
  AuthProvider,
  BudgetMode,
  DemoClock,
  DemoNotification,
  DemoSettings,
  Destination,
  EventCost,
  Expense,
  ExpenseCategory,
  ExpenseSource,
  ISODate,
  NearbyMatch,
  Person,
  Place,
  Role,
  ServiceId,
  SurveyResponse,
  Suggestion,
  Time,
  Todo,
  Trip,
  TripEvent,
} from '../data/types';
import { getState, resetState, update } from './store';
import { actingFor, currentPerson, getTrip } from './selectors';

const AVATAR_COLORS = ['av-1', 'av-2', 'av-3', 'av-4', 'av-5', 'av-6', 'av-7', 'av-8'];
const stamp = () => new Date().toISOString();

function pickColor(s: AppState): string {
  return AVATAR_COLORS[s.people.length % AVATAR_COLORS.length];
}

/** Find someone by email, or add them as a new (fictional) person. */
function ensurePerson(draft: AppState, name: string, email: string): Person {
  const existing = draft.people.find((p) => p.email.toLowerCase() === email.trim().toLowerCase());
  if (existing) return existing;
  const person: Person = { id: uid('p'), name: name.trim() || email.split('@')[0], email: email.trim(), color: pickColor(draft) };
  draft.people.push(person);
  return person;
}

function actingId(draft: AppState, tripId: string): string {
  const trip = draft.trips.find((t) => t.id === tripId);
  if (!trip) return currentPerson(draft)?.id ?? '';
  return actingFor(draft, trip).personId;
}

/* =================================================================== auth */

export type LoginResult = { ok: true } | { ok: false; error: 'email-not-found' | 'wrong-password' };

/** Email + password log in (Page 1). The distinct errors are what the doc asks for. */
export function logIn(email: string, password: string): LoginResult {
  const s = getState();
  const account = s.accounts.find((a) => a.email.toLowerCase() === email.trim().toLowerCase());
  if (!account) return { ok: false, error: 'email-not-found' };
  if (!account.password || account.password !== password) return { ok: false, error: 'wrong-password' };
  update((d) => {
    d.sessionAccountId = account.id;
    d.ui.autoOpenedFor = null;
    d.demo.viewAs = null;
  });
  return { ok: true };
}

/** Google/Apple sign-in (simulated chooser). Unknown accounts must create one. */
export function logInWithProvider(provider: AuthProvider, email: string): { ok: true } | { ok: false; error: 'not-found' } {
  const s = getState();
  const account = s.accounts.find((a) => a.email.toLowerCase() === email.toLowerCase());
  if (!account) return { ok: false, error: 'not-found' };
  update((d) => {
    const a = d.accounts.find((x) => x.id === account.id)!;
    if (!a.providers.includes(provider)) a.providers.push(provider);
    d.sessionAccountId = a.id;
    d.ui.autoOpenedFor = null;
    d.demo.viewAs = null;
  });
  return { ok: true };
}

export type SignUpResult = { ok: true } | { ok: false; error: 'email-in-use' };

/**
 * Create an account (Page 1, sign-up mode). The new account gets its own copy
 * of the sample trip (you as Owner) and a pending invitation, then Page 2 opens.
 */
export function signUp(input: { name: string; email: string; password?: string; provider: AuthProvider }): SignUpResult {
  const s = getState();
  if (s.accounts.some((a) => a.email.toLowerCase() === input.email.trim().toLowerCase())) {
    return { ok: false, error: 'email-in-use' };
  }
  update((d) => {
    const person: Person = { id: uid('p'), name: input.name.trim(), email: input.email.trim(), color: pickColor(d) };
    d.people.push(person);
    const accountId = uid('acct');
    d.accounts.push({
      id: accountId,
      personId: person.id,
      email: person.email,
      password: input.provider === 'email' ? input.password : undefined,
      providers: [input.provider],
      createdAt: stamp(),
      connections: freshConnections(),
      onboardingDone: false,
    });
    const bundle = starterBundleFor(person.id, realTodayISO());
    d.trips.push(...bundle.trips);
    d.events.push(...bundle.events);
    d.expenses.push(...bundle.expenses);
    d.reimbursements.push(...bundle.reimbursements);
    d.todos.push(...bundle.todos);
    d.suggestions.push(...bundle.suggestions);
    d.notifications.push(...bundle.notifications);
    d.sessionAccountId = accountId;
    d.ui.autoOpenedFor = null;
    d.ui.lastTripId = null;
    d.demo.viewAs = null;
  });
  return { ok: true };
}

export function logOut(): void {
  update((d) => {
    d.sessionAccountId = null;
    d.demo.viewAs = null;
    d.ui.nearby = null;
  });
}

/* ============================================================ connections */

/**
 * Record the outcome of the simulated provider authorization (Page 3).
 * On success, `grantedKeys` lists the permissions the user left switched on.
 */
export function setConnectionResult(service: ServiceId, result: 'success' | 'canceled' | 'failed', grantedKeys: string[] = []): void {
  update((d) => {
    const account = d.accounts.find((a) => a.id === d.sessionAccountId);
    if (!account) return;
    const conn = account.connections.find((c) => c.service === service);
    if (!conn) return;
    conn.lastResult = result;
    if (result === 'success') {
      conn.status = 'connected';
      conn.connectedAt = stamp();
      conn.permissions = getService(service).permissions.map((p) => ({ ...p, granted: grantedKeys.includes(p.key) }));
    } else if (result === 'failed') {
      conn.status = conn.status === 'connected' ? 'connected' : 'failed';
    } else if (result === 'canceled' && conn.status === 'failed') {
      conn.status = 'not-connected';
    }
    if (result === 'failed') d.demo.failNextConnect = false;
  });
}

export function disconnectService(service: ServiceId): void {
  update((d) => {
    const account = d.accounts.find((a) => a.id === d.sessionAccountId);
    const conn = account?.connections.find((c) => c.service === service);
    if (!conn) return;
    conn.status = 'not-connected';
    conn.lastResult = undefined;
    conn.permissions = conn.permissions.map((p) => ({ ...p, granted: false }));
  });
}

export function finishOnboarding(): void {
  update((d) => {
    const account = d.accounts.find((a) => a.id === d.sessionAccountId);
    if (account) account.onboardingDone = true;
  });
}

/* ================================================================== trips */

export interface TripInput {
  title: string;
  destinations: Destination[];
  startDate: ISODate;
  endDate: ISODate;
  invitees: Array<{ name: string; email: string }>;
  coverPhoto?: string;
}

/** Create a trip (Page 6). Everyone invited starts as a Viewer, status pending. */
export function createTrip(input: TripInput): string {
  const tripId = uid('trip');
  update((d) => {
    const me = currentPerson(d);
    if (!me) return;
    const trip: Trip = {
      id: tripId,
      title: input.title.trim(),
      destinations: input.destinations,
      startDate: input.startDate,
      endDate: input.endDate,
      ownerId: me.id,
      members: [{ personId: me.id, role: 'owner', status: 'accepted' }],
      budget: { mode: 'group', groupAmount: null, personal: {} },
      coverPhoto: input.coverPhoto,
      createdAt: stamp(),
      updatedAt: stamp(),
    };
    for (const inv of input.invitees) {
      const p = ensurePerson(d, inv.name, inv.email);
      if (trip.members.some((m) => m.personId === p.id)) continue;
      trip.members.push({ personId: p.id, role: 'viewer', status: 'pending', invitedById: me.id, invitedAt: stamp() });
      d.messages.push({ id: uid('msg'), kind: 'invite', toPersonId: p.id, tripId, text: `${me.name} invited you to “${trip.title}”`, at: stamp() });
    }
    d.trips.push(trip);
    d.ui.justCreatedTripId = tripId;
    d.ui.lastTripId = tripId;
  });
  return tripId;
}

/** Edit title/destinations/dates/cover (Page 6, Owner only). */
export function updateTrip(tripId: string, patch: Partial<Pick<Trip, 'title' | 'destinations' | 'startDate' | 'endDate' | 'coverPhoto'>>): void {
  update((d) => {
    const trip = d.trips.find((t) => t.id === tripId);
    if (!trip) return;
    Object.assign(trip, patch, { updatedAt: stamp() });
    // Day-editor assignments outside the new dates are dropped.
    for (const m of trip.members) {
      if (m.days) m.days = m.days.filter((day) => day >= trip.startDate && day <= trip.endDate);
    }
  });
}

/**
 * Shift everything dated when the whole trip moves to new dates (keeps day numbers):
 * events, to-dos, suggestions, and Day-editor assignments (so Sam keeps "Day 3").
 * Call this before updateTrip() with the new dates.
 */
export function shiftTripEvents(tripId: string, deltaDays: number): void {
  if (!deltaDays) return;
  update((d) => {
    const trip = d.trips.find((t) => t.id === tripId);
    trip?.members.forEach((m) => {
      if (m.days) m.days = m.days.map((day) => addDays(day, deltaDays));
    });
    for (const e of d.events) if (e.tripId === tripId) e.date = addDays(e.date, deltaDays);
    for (const t of d.todos) if (t.tripId === tripId && t.date) t.date = addDays(t.date, deltaDays);
    for (const s of d.suggestions) if (s.tripId === tripId) s.date = addDays(s.date, deltaDays);
  });
}

export function acceptInvite(tripId: string): void {
  update((d) => {
    const me = currentPerson(d);
    const m = d.trips.find((t) => t.id === tripId)?.members.find((x) => x.personId === me?.id);
    if (m) m.status = 'accepted';
    d.ui.lastTripId = tripId;
  });
}

export function declineInvite(tripId: string): void {
  update((d) => {
    const me = currentPerson(d);
    const m = d.trips.find((t) => t.id === tripId)?.members.find((x) => x.personId === me?.id);
    if (m) m.status = 'declined';
  });
}

/** Invite someone to an existing trip (Page 13, Owner only). Starts as Viewer. */
export function inviteMember(tripId: string, name: string, email: string): { ok: true } | { ok: false; error: 'already-member' } {
  const s = getState();
  const trip = getTrip(s, tripId);
  const existing = s.people.find((p) => p.email.toLowerCase() === email.trim().toLowerCase());
  if (trip && existing && trip.members.some((m) => m.personId === existing.id && m.status !== 'declined')) {
    return { ok: false, error: 'already-member' };
  }
  update((d) => {
    const t = d.trips.find((x) => x.id === tripId);
    const me = currentPerson(d);
    if (!t || !me) return;
    const p = ensurePerson(d, name, email);
    t.members = t.members.filter((m) => m.personId !== p.id);
    t.members.push({ personId: p.id, role: 'viewer', status: 'pending', invitedById: me.id, invitedAt: stamp() });
    d.messages.push({ id: uid('msg'), kind: 'invite', toPersonId: p.id, tripId, text: `${me.name} invited you to “${t.title}”`, at: stamp() });
  });
  return { ok: true };
}

/** Change a collaborator's role (Page 13, Owner only). `days` is used for Day editors. */
export function setMemberRole(tripId: string, personId: string, role: Exclude<Role, 'owner'>, days?: ISODate[]): void {
  update((d) => {
    const t = d.trips.find((x) => x.id === tripId);
    const m = t?.members.find((x) => x.personId === personId);
    if (!t || !m || m.role === 'owner') return;
    m.role = role;
    m.days = role === 'day' ? (days ?? []) : undefined;
    d.messages.push({ id: uid('msg'), kind: 'role-change', toPersonId: personId, tripId, text: `Your role on “${t.title}” is now ${role}`, at: stamp() });
  });
}

export function removeMember(tripId: string, personId: string): void {
  update((d) => {
    const t = d.trips.find((x) => x.id === tripId);
    if (!t || t.ownerId === personId) return;
    t.members = t.members.filter((m) => m.personId !== personId);
    d.messages.push({ id: uid('msg'), kind: 'removed', toPersonId: personId, tripId, text: `You were removed from “${t.title}”`, at: stamp() });
  });
}

/* ================================================================= events */

export interface EventInput {
  tripId: string;
  place: Place;
  title?: string;
  date: ISODate;
  start: Time;
  end: Time;
  cost?: EventCost;
  attendeeIds: string[];
  notes?: string;
  confirmation?: string;
  source: TripEvent['source'];
}

export function addEvent(input: EventInput): string {
  const id = uid('ev');
  update((d) => {
    d.events.push({ id, ...input, createdById: actingId(d, input.tripId) });
    d.ui.justAddedEventId = id;
    d.ui.lastTripId = input.tripId;
  });
  return id;
}

export function updateEvent(eventId: string, patch: Partial<Omit<TripEvent, 'id' | 'tripId' | 'createdById'>>): void {
  update((d) => {
    const e = d.events.find((x) => x.id === eventId);
    if (e) Object.assign(e, patch);
    d.ui.justAddedEventId = eventId;
  });
}

export function deleteEvent(eventId: string): TripEvent | undefined {
  const removed = getState().events.find((e) => e.id === eventId);
  update((d) => {
    d.events = d.events.filter((e) => e.id !== eventId);
  });
  return removed;
}

/** Undo for a deleted event (toast action). */
export function restoreEvent(event: TripEvent): void {
  update((d) => {
    if (!d.events.some((e) => e.id === event.id)) d.events.push(event);
  });
}

/**
 * Clear the "just added" highlights. Pages clear only their own:
 * Page 8 clears 'event', Page 5 clears 'trip'.
 */
export function clearHighlights(which: 'event' | 'trip' | 'all' = 'all'): void {
  const s = getState();
  const clearEvent = which !== 'trip' && !!s.ui.justAddedEventId;
  const clearTrip = which !== 'event' && !!s.ui.justCreatedTripId;
  if (!clearEvent && !clearTrip) return;
  update((d) => {
    if (clearEvent) d.ui.justAddedEventId = null;
    if (clearTrip) d.ui.justCreatedTripId = null;
  });
}

/* ============================================================ suggestions */

/** Store live (OpenStreetMap) suggestions for a trip, replacing older live ones. */
export function saveLiveSuggestions(tripId: string, suggestions: Suggestion[]): void {
  update((d) => {
    d.suggestions = d.suggestions.filter((x) => !(x.tripId === tripId && x.source === 'osm')).concat(suggestions);
  });
}

export function declineSuggestion(tripId: string, suggestionId: string): void {
  update((d) => {
    d.decisions = d.decisions.filter((x) => !(x.tripId === tripId && x.suggestionId === suggestionId));
    d.decisions.push({ tripId, suggestionId, status: 'declined', at: stamp() });
  });
}

export function undoSuggestionDecision(tripId: string, suggestionId: string): void {
  update((d) => {
    d.decisions = d.decisions.filter((x) => !(x.tripId === tripId && x.suggestionId === suggestionId));
  });
}

/** Accept a suggestion at a chosen day/time — creates a real event. */
export function addSuggestionToTrip(suggestion: Suggestion, date: ISODate, start: Time, end: Time): string {
  const trip = getTrip(getState(), suggestion.tripId);
  const attendees = trip ? trip.members.filter((m) => m.status === 'accepted').map((m) => m.personId) : [];
  const eventId = addEvent({
    tripId: suggestion.tripId,
    place: suggestion.place,
    date,
    start,
    end,
    attendeeIds: attendees,
    cost: suggestion.estCostPerPerson ? { amount: suggestion.estCostPerPerson, per: 'person' } : undefined,
    source: 'suggestion',
    notes: suggestion.reason,
  });
  update((d) => {
    d.decisions = d.decisions.filter((x) => !(x.tripId === suggestion.tripId && x.suggestionId === suggestion.id));
    d.decisions.push({ tripId: suggestion.tripId, suggestionId: suggestion.id, status: 'added', at: stamp(), eventId });
  });
  return eventId;
}

/* ================================================================= budget */

export interface ExpenseInput {
  tripId: string;
  amount: number;
  purpose: string;
  category: ExpenseCategory;
  date: ISODate;
  paidById: string;
  splitWithIds: string[];
  source: ExpenseSource;
  merchant?: string;
  /** Create "X owes payer" rows for everyone else in the split and simulate notifying them. */
  requestRepayment: boolean;
}

export function addExpense(input: ExpenseInput): string {
  const id = uid('ex');
  update((d) => {
    const { requestRepayment, ...rest } = input;
    const expense: Expense = { id, ...rest, amount: round2(rest.amount), createdById: actingId(d, input.tripId) };
    d.expenses.push(expense);
    if (requestRepayment && expense.splitWithIds.length > 1) {
      const shares = splitEvenly(expense.amount, expense.splitWithIds.length);
      expense.splitWithIds.forEach((personId, i) => {
        if (personId === expense.paidById) return;
        d.reimbursements.push({
          id: uid('rb'),
          tripId: expense.tripId,
          fromId: personId,
          toId: expense.paidById,
          amount: shares[i],
          reason: expense.purpose,
          expenseId: id,
          status: 'open',
          createdAt: stamp(),
          notified: true,
        });
        d.messages.push({
          id: uid('msg'),
          kind: 'reimbursement',
          toPersonId: personId,
          tripId: expense.tripId,
          text: `You owe ${shares[i].toFixed(2)} for “${expense.purpose}”`,
          at: stamp(),
        });
      });
    }
  });
  return id;
}

export function updateExpense(expenseId: string, patch: Partial<Omit<Expense, 'id' | 'tripId'>>): void {
  update((d) => {
    const e = d.expenses.find((x) => x.id === expenseId);
    if (e) Object.assign(e, patch);
  });
}

export function deleteExpense(expenseId: string): void {
  update((d) => {
    d.expenses = d.expenses.filter((e) => e.id !== expenseId);
    d.reimbursements = d.reimbursements.filter((r) => r.expenseId !== expenseId);
  });
}

/**
 * Mark a repayment as done. Only the person who is owed (the requester) may do
 * this — returns false otherwise.
 */
export function markReimbursementPaid(reimbursementId: string, actingPersonId: string): boolean {
  const r = getState().reimbursements.find((x) => x.id === reimbursementId);
  if (!r || r.toId !== actingPersonId) return false;
  update((d) => {
    const row = d.reimbursements.find((x) => x.id === reimbursementId);
    if (row) {
      row.status = 'paid';
      row.paidAt = stamp();
    }
  });
  return true;
}

export function reopenReimbursement(reimbursementId: string): void {
  update((d) => {
    const row = d.reimbursements.find((x) => x.id === reimbursementId);
    if (row) {
      row.status = 'open';
      row.paidAt = undefined;
    }
  });
}

export function setBudgetMode(tripId: string, mode: BudgetMode): void {
  update((d) => {
    const t = d.trips.find((x) => x.id === tripId);
    if (t) t.budget.mode = mode;
  });
}

export function setGroupBudget(tripId: string, amount: number | null): void {
  update((d) => {
    const t = d.trips.find((x) => x.id === tripId);
    if (t) t.budget.groupAmount = amount === null ? null : round2(amount);
  });
}

export function setPersonalBudget(tripId: string, personId: string, amount: number): void {
  update((d) => {
    const t = d.trips.find((x) => x.id === tripId);
    if (t) t.budget.personal[personId] = round2(amount);
  });
}

/** Simulate a bank or Gmail notification arriving (Prototype drawer / Page 12 demo buttons). */
export function pushDemoNotification(input: Omit<DemoNotification, 'id' | 'receivedAt' | 'status'>): string {
  const id = uid('nt');
  update((d) => {
    d.notifications.push({ ...input, id, receivedAt: stamp(), status: 'new' });
  });
  return id;
}

export function resolveDemoNotification(notificationId: string, status: 'logged' | 'ignored'): void {
  update((d) => {
    const n = d.notifications.find((x) => x.id === notificationId);
    if (n) n.status = status;
  });
}

/* ================================================================== to-dos */

export function addTodo(input: Omit<Todo, 'id' | 'done' | 'createdById'>): string {
  const id = uid('td');
  update((d) => {
    d.todos.push({ ...input, id, done: false, createdById: actingId(d, input.tripId) });
  });
  return id;
}

export function toggleTodo(todoId: string): void {
  update((d) => {
    const t = d.todos.find((x) => x.id === todoId);
    if (t) t.done = !t.done;
  });
}

export function updateTodo(todoId: string, patch: Partial<Omit<Todo, 'id' | 'tripId'>>): void {
  update((d) => {
    const t = d.todos.find((x) => x.id === todoId);
    if (t) Object.assign(t, patch);
  });
}

export function deleteTodo(todoId: string): void {
  update((d) => {
    d.todos = d.todos.filter((t) => t.id !== todoId);
  });
}

/* ================================================================== survey */

/** Save (or update) a person's preference survey (Page 15). Page 13's tiles recompute from this. */
export function saveSurvey(response: SurveyResponse): void {
  update((d) => {
    d.surveys[response.personId] = { ...response, updatedAt: stamp() };
  });
}

/* ==================================================================== demo */

export function setDemo(patch: Partial<DemoSettings>): void {
  update((d) => {
    Object.assign(d.demo, patch);
  });
}

export function setClock(clock: DemoClock | null): void {
  update((d) => {
    d.demo.clock = clock;
    d.ui.autoOpenedFor = null;
    d.ui.nearby = null;
  });
}

export function setLastTrip(tripId: string): void {
  if (getState().ui.lastTripId === tripId) return;
  update((d) => {
    d.ui.lastTripId = tripId;
  });
}

export function markAutoOpened(tripId: string): void {
  update((d) => {
    d.ui.autoOpenedFor = tripId;
  });
}

export function showNearby(match: NearbyMatch): void {
  update((d) => {
    d.ui.nearby = match;
    if (!d.ui.nearbySeen.includes(match.place.id)) d.ui.nearbySeen.push(match.place.id);
  });
}

export function dismissNearby(): void {
  update((d) => {
    d.ui.nearby = null;
  });
}

export function resetDemoData(): void {
  resetState();
}

/** Days between two dates (re-exported for pages that shift trips). */
export { daysBetween };
