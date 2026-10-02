/**
 * Builds the prototype's starting data.
 *
 * The built-in sample trip ("Lisbon & Porto Fall Getaway") is generated
 * relative to the real date it was seeded on: it always starts 14 days later.
 * That keeps "Day 1 — MM/DD", the dashboard, and the budget consistent no
 * matter when a tester opens the prototype.
 *
 * Every account gets its own copy of the sample trip with that account's
 * person as Owner, plus a pending invitation (Mexico City) to show the
 * invitee path. The returning-user account "Maya Chen" also has older trips.
 */

import { addDays, realTodayISO } from '../lib/dates';
import { splitEvenly } from '../lib/format';
import { getPlace } from './places';
import { SAMPLE_COMPANION_IDS, SAMPLE_PEOPLE, SAMPLE_SURVEYS } from './people';
import { connectedWith, freshConnections } from './services';
import type {
  Account,
  AppState,
  DemoNotification,
  EventCost,
  Expense,
  ExpenseCategory,
  ExpenseSource,
  ISODate,
  Membership,
  Reimbursement,
  Suggestion,
  Time,
  Todo,
  Trip,
  TripEvent,
} from './types';

export const STATE_VERSION = 3;

export const MAYA_ACCOUNT_ID = 'acct-maya';
export const MAYA_PERSON_ID = 'p-maya';
/** Shown on the login page as a demo hint. Fictional; not a real credential. */
export const DEMO_PASSWORD = 'wayfare-demo';

export interface TripBundle {
  trips: Trip[];
  events: TripEvent[];
  expenses: Expense[];
  reimbursements: Reimbursement[];
  todos: Todo[];
  suggestions: Suggestion[];
  notifications: DemoNotification[];
}

function emptyBundle(): TripBundle {
  return { trips: [], events: [], expenses: [], reimbursements: [], todos: [], suggestions: [], notifications: [] };
}

function mergeBundles(...bundles: TripBundle[]): TripBundle {
  const out = emptyBundle();
  for (const b of bundles) {
    out.trips.push(...b.trips);
    out.events.push(...b.events);
    out.expenses.push(...b.expenses);
    out.reimbursements.push(...b.reimbursements);
    out.todos.push(...b.todos);
    out.suggestions.push(...b.suggestions);
    out.notifications.push(...b.notifications);
  }
  return out;
}

const NOW_STAMP = () => new Date().toISOString();

/* --------------------------------------------------------------- builders */

/** Small helper so event lists below read like an itinerary. */
function ev(
  tripId: string,
  n: number,
  date: ISODate,
  start: Time,
  end: Time,
  placeId: string,
  attendeeIds: string[],
  extra: Partial<Pick<TripEvent, 'title' | 'notes' | 'confirmation'>> & { cost?: EventCost } = {},
  createdById = attendeeIds[0],
): TripEvent {
  return {
    id: `${tripId}-e${n}`,
    tripId,
    place: getPlace(placeId),
    date,
    start,
    end,
    attendeeIds,
    source: 'manual',
    createdById,
    ...extra,
  };
}

function ex(
  tripId: string,
  n: number,
  amount: number,
  purpose: string,
  category: ExpenseCategory,
  date: ISODate,
  paidById: string,
  splitWithIds: string[],
  source: ExpenseSource,
  merchant?: string,
): Expense {
  return { id: `${tripId}-x${n}`, tripId, amount, purpose, category, date, paidById, splitWithIds, source, merchant, createdById: paidById };
}

/**
 * Create "X owes payer" rows for an expense split evenly.
 * `paidIds` lists the people who have already paid the payer back.
 */
function owesFor(expense: Expense, paidIds: string[], startN: number): Reimbursement[] {
  const shares = splitEvenly(expense.amount, expense.splitWithIds.length);
  const rows: Reimbursement[] = [];
  let n = startN;
  expense.splitWithIds.forEach((personId, i) => {
    if (personId === expense.paidById) return;
    const paid = paidIds.includes(personId);
    rows.push({
      id: `${expense.tripId}-r${n++}`,
      tripId: expense.tripId,
      fromId: personId,
      toId: expense.paidById,
      amount: shares[i],
      reason: expense.purpose,
      expenseId: expense.id,
      status: paid ? 'paid' : 'open',
      createdAt: `${expense.date}T12:00:00.000Z`,
      paidAt: paid ? `${expense.date}T18:00:00.000Z` : undefined,
      notified: true,
    });
  });
  return rows;
}

function member(personId: string, role: Membership['role'], status: Membership['status'] = 'accepted', days?: ISODate[]): Membership {
  return { personId, role, status, days, invitedAt: '2026-09-01T12:00:00.000Z' };
}

/* ----------------------------------------------------- the sample trip */

/** Id of the sample trip for an owner (one copy per account). */
export function sampleTripId(ownerId: string): string {
  return `trip-sample-${ownerId}`;
}

export function buildSampleTrip(ownerId: string, base: ISODate): TripBundle {
  const id = sampleTripId(ownerId);
  const start = addDays(base, 14);
  const D = (n: number) => addDays(start, n - 1);
  const [jordan, sam, priya, linda, diego] = SAMPLE_COMPANION_IDS;
  const everyone = [ownerId, jordan, sam, priya, linda];
  const noLinda = [ownerId, jordan, sam, priya];

  const trip: Trip = {
    id,
    title: 'Lisbon & Porto Fall Getaway',
    destinations: [
      { id: `${id}-d1`, name: 'Lisbon', country: 'Portugal', lat: 38.7223, lng: -9.1393 },
      { id: `${id}-d2`, name: 'Porto', country: 'Portugal', lat: 41.1579, lng: -8.6291 },
    ],
    startDate: start,
    endDate: D(7),
    ownerId,
    members: [
      member(ownerId, 'owner'),
      member(jordan, 'editor'),
      member(sam, 'day', 'accepted', [D(3)]),
      member(priya, 'viewer'),
      member(linda, 'viewer'),
      member(diego, 'viewer', 'pending'),
    ],
    budget: {
      mode: 'group',
      groupAmount: 7500,
      personal: { [ownerId]: 1800, [jordan]: 2000, [sam]: 1200, [priya]: 1400, [linda]: 1500 },
    },
    coverPhoto: 'lisbon',
    isSample: true,
    createdAt: `${addDays(base, -40)}T16:00:00.000Z`,
    updatedAt: `${addDays(base, -2)}T16:00:00.000Z`,
  };

  const pp = (amount: number): EventCost => ({ amount, per: 'person' });
  let n = 1;
  const events: TripEvent[] = [
    // Day 1 — Lisbon, arrival
    ev(id, n++, D(1), '14:00', '14:45', 'casa-azulejo', everyone, { title: 'Check in — Casa Azulejo', notes: 'Door code arrives by text the morning of check-in.' }, ownerId),
    ev(id, n++, D(1), '16:30', '17:30', 'santa-luzia', everyone, {}, ownerId),
    ev(id, n++, D(1), '19:30', '21:30', 'mare-alta', everyone, { cost: pp(46) }, jordan),
    // Day 2 — Belém and Baixa
    ev(id, n++, D(2), '09:30', '11:00', 'jeronimos', everyone, { cost: pp(13), confirmation: 'JER-48213' }, ownerId),
    ev(id, n++, D(2), '11:15', '11:45', 'pasteis-belem', everyone, { cost: pp(3.5) }, ownerId),
    ev(id, n++, D(2), '13:00', '14:15', 'time-out-market', everyone, { cost: pp(22) }, jordan),
    ev(id, n++, D(2), '15:30', '16:15', 'santa-justa', everyone, { cost: pp(6) }, ownerId),
    ev(id, n++, D(2), '20:00', '22:00', 'casa-lumiar', everyone, { cost: pp(40), notes: 'Gluten-free tasting menu requested for Jordan.' }, jordan),
    // Day 3 — Sintra (Sam's day)
    ev(id, n++, D(3), '08:40', '09:20', 'rossio-station', everyone, { title: 'Train to Sintra', cost: pp(5) }, sam),
    ev(id, n++, D(3), '10:00', '12:30', 'pena', everyone, { cost: pp(22), confirmation: 'PENA-7731-TE', notes: 'Timed entry 10:00. Shuttle bus from the gate.' }, sam),
    ev(id, n++, D(3), '13:00', '14:00', 'tasca-serra', everyone, { cost: pp(18) }, sam),
    ev(id, n++, D(3), '14:30', '16:30', 'regaleira', noLinda, { cost: pp(14), notes: 'Steep paths and stairs. Linda will rest at the café across the street.' }, sam),
    ev(id, n++, D(3), '18:15', '19:00', 'sintra-station', everyone, { title: 'Train back to Lisbon', cost: pp(5) }, sam),
    // Day 4 — Castle and Alfama
    ev(id, n++, D(4), '10:00', '12:00', 'castelo', everyone, { cost: pp(17) }, ownerId),
    ev(id, n++, D(4), '12:30', '13:30', 'tram-28', noLinda, { cost: pp(3.1), notes: 'Tram has steps; Linda takes a taxi to meet us in Chiado.' }, ownerId),
    ev(id, n++, D(4), '21:00', '23:00', 'adega-becos', everyone, { cost: pp(35), confirmation: 'FADO-2210' }, jordan),
    // Day 5 — To Porto
    ev(id, n++, D(5), '09:00', '12:00', 'santa-apolonia', everyone, { title: 'Train to Porto', cost: pp(38), confirmation: 'TH-AP-55120' }, ownerId),
    ev(id, n++, D(5), '13:30', '14:15', 'ribeira-loft', everyone, { title: 'Check in — Ribeira Loft' }, jordan),
    ev(id, n++, D(5), '16:00', '17:00', 'lello', everyone, { cost: pp(10) }, ownerId),
    ev(id, n++, D(5), '19:30', '21:00', 'douro-velho', everyone, { cost: pp(24) }, jordan),
    // Day 6 — intentionally empty (shows the empty-day state + suggestions)
    // Day 7 — Porto, last day
    ev(id, n++, D(7), '10:30', '12:00', 'cave-ribeirinha', everyone, { cost: pp(28) }, jordan),
    ev(id, n++, D(7), '12:30', '13:30', 'dom-luis', everyone, {}, ownerId),
  ];

  const ex1 = ex(id, 1, 1920, 'Lisbon apartment, 4 nights', 'lodging', D(-33), ownerId, everyone, 'manual', 'Casa Azulejo Alfama');
  const ex2 = ex(id, 2, 760, 'Porto apartment, 2 nights', 'lodging', D(-29), jordan, everyone, 'gmail-demo', 'Ribeira Loft Apartments');
  const ex3 = ex(id, 3, 190, 'Train tickets Lisbon → Porto (5)', 'transport', D(-19), ownerId, everyone, 'gmail-demo', 'TrainHop Iberia');
  const ex4 = ex(id, 4, 110, 'Pena Palace timed tickets (5)', 'activities', D(-15), sam, everyone, 'manual', 'Parques de Sintra');
  const ex5 = ex(id, 5, 58.4, 'Airport taxis (2 cars)', 'transport', D(1), ownerId, everyone, 'bank-demo', 'Lisboa Táxi Rede');
  const ex6 = ex(id, 6, 231.5, 'Dinner at Taberna Maré Alta', 'food', D(1), jordan, everyone, 'receipt', 'Taberna Maré Alta');
  const ex7 = ex(id, 7, 64.75, 'Groceries for the apartment', 'food', D(1), priya, everyone, 'receipt', 'Mercearia do Largo');
  const ex8 = ex(id, 8, 65, 'Jerónimos Monastery tickets (5)', 'activities', D(2), ownerId, everyone, 'manual', 'Jerónimos Monastery');
  const ex9 = ex(id, 9, 17.5, 'Pastries and coffee', 'food', D(2), linda, everyone, 'bank-demo', 'Pastéis de Belém');
  const ex10 = ex(id, 10, 118.4, 'Lunch at Time Out Market', 'food', D(2), jordan, everyone, 'receipt', 'Time Out Market');
  const expenses = [ex1, ex2, ex3, ex4, ex5, ex6, ex7, ex8, ex9, ex10];

  const reimbursements = [
    ...owesFor(ex1, [jordan, linda], 1),
    ...owesFor(ex2, [priya, linda], 10),
    ...owesFor(ex4, [jordan], 20),
    ...owesFor(ex6, [], 30),
  ];

  const todos: Todo[] = [
    { id: `${id}-t1`, tripId: id, text: 'Book Pena Palace timed entry', date: D(3), assigneeId: sam, done: true, eventId: `${id}-e10`, createdById: sam },
    { id: `${id}-t2`, tripId: id, text: 'Reserve fado dinner for 5', date: D(4), assigneeId: jordan, done: true, eventId: `${id}-e16`, createdById: ownerId },
    { id: `${id}-t3`, tripId: id, text: 'Confirm gluten-free tasting menu at Casa Lumiar', date: D(2), assigneeId: jordan, done: false, eventId: `${id}-e8`, createdById: jordan },
    { id: `${id}-t4`, tripId: id, text: 'Buy Livraria Lello tickets', date: D(5), assigneeId: priya, done: false, eventId: `${id}-e19`, createdById: ownerId },
    { id: `${id}-t5`, tripId: id, text: 'Download offline maps for Sintra', date: D(3), assigneeId: sam, done: false, createdById: sam },
    { id: `${id}-t6`, tripId: id, text: 'Print train tickets to Porto', date: D(5), assigneeId: ownerId, done: false, eventId: `${id}-e17`, createdById: ownerId },
    { id: `${id}-t7`, tripId: id, text: 'Pack the folding wheelchair', date: D(1), assigneeId: linda, done: true, createdById: linda },
    { id: `${id}-t8`, tripId: id, text: 'Book a taxi for Linda to meet us in Chiado', date: D(4), assigneeId: ownerId, done: false, eventId: `${id}-e15`, createdById: ownerId },
  ];

  const s = (
    k: number,
    placeId: string,
    basedOnEvent: number | null,
    basedOnLabel: string,
    reason: string,
    day: number,
    startT: Time,
    endT: Time,
    fit: string[],
    est?: number,
  ): Suggestion => ({
    id: `${id}-s${k}`,
    tripId: id,
    place: getPlace(placeId),
    basedOnEventId: basedOnEvent ? `${id}-e${basedOnEvent}` : undefined,
    basedOnLabel,
    reason,
    date: D(day),
    start: startT,
    end: endT,
    fit,
    estCostPerPerson: est,
    source: 'bundled',
  });

  const suggestions: Suggestion[] = [
    s(1, 'padaria-celeste', 6, 'Time Out Market', 'Since you planned lunch at Time Out Market, you might also like Padaria Celeste, a dedicated gluten-free bakery 2 minutes away.', 2, '14:20', '14:50', ['Dedicated gluten-free · Jordan', 'Nut-free kitchen · Sam', '2 min walk'], 6),
    s(2, 'maat', 4, 'Jerónimos Monastery', 'Since you planned Jerónimos Monastery, you might also like MAAT, a riverside museum of modern art and architecture a short taxi ride away.', 2, '11:50', '12:45', ['Modern art · Jordan', 'Fits your 11:45 AM gap', 'Step-free'], 11),
    s(3, 'belem-tower', 4, 'Jerónimos Monastery', 'Since you planned Jerónimos Monastery, you might also like Belém Tower, a 10-minute walk along the river.', 2, '11:00', '11:45', ['Historic · Linda', 'Not step-free inside'], 9),
    s(4, 'sao-pedro-alcantara', 2, 'Miradouro de Santa Luzia', 'Since you planned Miradouro de Santa Luzia, you might also like São Pedro de Alcântara for sunset before dinner in Chiado.', 2, '18:45', '19:30', ['Step-free', '9 min walk to Casa Lumiar', 'Free'], 0),
    s(5, 'vinho-alto', 8, 'Casa Lumiar', 'Since you planned dinner at Casa Lumiar, you might also like Vinho Alto, a natural-wine bar 5 minutes up the hill.', 2, '22:15', '23:30', ['Nightlife · Jordan', 'Lively'], 20),
    s(6, 'monserrate', 10, 'Pena Palace', 'Since you planned Pena Palace, you might also like Monserrate Palace: botanical gardens and far fewer crowds.', 3, '16:45', '18:00', ['Nature · Sam', 'Quieter than Pena', 'Partly step-free'], 12),
    s(7, 'horta-graca', 14, 'Castelo de São Jorge', 'Since you planned Castelo de São Jorge, you might also like lunch at Horta da Graça, a vegetarian spot 8 minutes downhill.', 4, '13:45', '14:45', ['Vegetarian · Priya', 'Quiet', 'Step-free'], 18),
    s(8, 'azulejo-museum', 15, 'Tram 28', 'Since you’re riding Tram 28, you might also like the National Tile Museum: five centuries of Portuguese azulejos.', 4, '14:30', '16:30', ['Cultural · Priya, Linda', 'Fits your free afternoon'], 8),
    s(9, 'sao-bento', 17, 'Train to Porto', 'Since you’re arriving in Porto by train, you might also like São Bento Station’s tiled hall, 5 minutes from Livraria Lello.', 5, '15:00', '15:40', ['Free', 'Azulejo art · Priya', 'Step-free'], 0),
    s(10, 'serralves', 19, 'Livraria Lello', 'Since you planned Livraria Lello, you might also like Serralves: contemporary art, an Art Deco villa, and gardens.', 6, '10:00', '13:00', ['Modern art · Jordan', 'Gardens · Sam', 'Fills your empty Day 6'], 20),
    s(11, 'palacio-cristal', 19, 'Livraria Lello', 'Since you planned Livraria Lello, you might also like the Crystal Palace Gardens, a 12-minute walk west with river views.', 6, '12:30', '13:30', ['Nature · Sam', 'Free'], 0),
    s(12, 'rabelo-cruise', 22, 'Dom Luís I Bridge', 'Since you planned the Dom Luís I Bridge walk, you might also like a Six Bridges river cruise on a rabelo boat.', 6, '15:00', '16:00', ['Seated · good for Linda', 'River views'], 18),
  ];

  const notifications: DemoNotification[] = [
    { id: `${id}-n1`, kind: 'gmail', tripId: id, amount: 50, merchant: 'Adega dos Becos (deposit)', category: 'activities', date: D(-5), receivedAt: `${D(-5)}T10:12:00.000Z`, status: 'new' },
    { id: `${id}-n2`, kind: 'bank', tripId: id, amount: 9.8, merchant: 'Quiosque do Rossio', category: 'food', date: D(2), receivedAt: `${D(2)}T10:40:00.000Z`, status: 'new' },
  ];

  return { trips: [trip], events, expenses, reimbursements, todos, suggestions, notifications };
}

/* ------------------------------------------- the pending invitation */

export function mexicoTripId(inviteeId: string): string {
  return `trip-mexico-${inviteeId}`;
}

/** Priya invites the account holder to "Mexico City Food Week" (pending). */
export function buildMexicoInvite(inviteeId: string, base: ISODate): TripBundle {
  const id = mexicoTripId(inviteeId);
  const start = addDays(base, 130);
  const D = (n: number) => addDays(start, n - 1);
  const priya = 'p-priya';
  const sam = 'p-sam';
  const trip: Trip = {
    id,
    title: 'Mexico City Food Week',
    destinations: [{ id: `${id}-d1`, name: 'Mexico City', country: 'Mexico', lat: 19.4326, lng: -99.1332 }],
    startDate: start,
    endDate: D(5),
    ownerId: priya,
    members: [
      member(priya, 'owner'),
      member(sam, 'editor'),
      { personId: inviteeId, role: 'viewer', status: 'pending', invitedById: priya, invitedAt: `${addDays(base, -3)}T15:00:00.000Z` },
    ],
    budget: { mode: 'group', groupAmount: 3000, personal: {} },
    coverPhoto: 'mexico-city',
    createdAt: `${addDays(base, -10)}T16:00:00.000Z`,
    updatedAt: `${addDays(base, -3)}T16:00:00.000Z`,
  };
  const everyone = [priya, sam];
  let n = 1;
  const events = [
    ev(id, n++, D(1), '16:00', '17:30', 'bellas-artes', everyone, {}, priya),
    ev(id, n++, D(2), '10:00', '12:00', 'frida', everyone, { cost: { amount: 15, per: 'person' } }, priya),
    ev(id, n++, D(2), '12:30', '14:00', 'coyoacan', everyone, {}, priya),
    ev(id, n++, D(3), '08:00', '13:00', 'teotihuacan', everyone, { cost: { amount: 6, per: 'person' } }, sam),
    ev(id, n++, D(3), '20:00', '21:30', 'la-lumbre', everyone, {}, priya),
  ];
  return { ...emptyBundle(), trips: [trip], events };
}

/* ------------------------------------- Maya's other (older) trips */

function buildMayaHistory(base: ISODate): TripBundle {
  const maya = MAYA_PERSON_ID;
  const jordan = 'p-jordan';
  const sam = 'p-sam';
  const priya = 'p-priya';
  const kevin = 'p-kevin';

  // Upcoming: Kauai (Maya is a Viewer; Kevin hosts)
  const kStart = addDays(base, 80);
  const K = (n: number) => addDays(kStart, n - 1);
  const kauai: Trip = {
    id: 'trip-kauai',
    title: 'Kauai Family Christmas',
    destinations: [{ id: 'trip-kauai-d1', name: 'Kauai', country: 'United States', lat: 22.0964, lng: -159.5261 }],
    startDate: kStart,
    endDate: K(7),
    ownerId: kevin,
    members: [member(kevin, 'owner'), member(maya, 'viewer')],
    budget: { mode: 'individual', groupAmount: null, personal: { [maya]: 1500, [kevin]: 2200 } },
    coverPhoto: 'kauai',
    createdAt: `${addDays(base, -25)}T16:00:00.000Z`,
    updatedAt: `${addDays(base, -25)}T16:00:00.000Z`,
  };
  const kauaiEvents = [
    ev('trip-kauai', 1, K(2), '09:00', '12:00', 'waimea', [kevin, maya], {}, kevin),
    ev('trip-kauai', 2, K(4), '10:00', '15:00', 'hanalei', [kevin, maya], {}, kevin),
    ev('trip-kauai', 3, K(5), '17:30', '20:30', 'kauai-luau', [kevin, maya], { cost: { amount: 145, per: 'person' } }, kevin),
  ];

  // Past: NYC (Maya was an Editor; Jordan hosted)
  const nStart = addDays(base, -200);
  const N = (n: number) => addDays(nStart, n - 1);
  const nyc: Trip = {
    id: 'trip-nyc',
    title: 'NYC Birthday Weekend',
    destinations: [{ id: 'trip-nyc-d1', name: 'New York', country: 'United States', lat: 40.7128, lng: -74.006 }],
    startDate: nStart,
    endDate: N(3),
    ownerId: jordan,
    members: [member(jordan, 'owner'), member(maya, 'editor'), member(priya, 'viewer')],
    budget: { mode: 'group', groupAmount: 1500, personal: {} },
    coverPhoto: 'central-park',
    createdAt: `${addDays(base, -260)}T16:00:00.000Z`,
    updatedAt: `${addDays(base, -196)}T16:00:00.000Z`,
  };
  const nycAll = [jordan, maya, priya];
  const nycEvents = [
    ev('trip-nyc', 1, N(1), '10:00', '12:00', 'central-park', nycAll, {}, jordan),
    ev('trip-nyc', 2, N(1), '19:30', '21:30', 'lucas-trattoria', nycAll, { cost: { amount: 62, per: 'person' } }, maya),
    ev('trip-nyc', 3, N(2), '10:30', '13:30', 'the-met', nycAll, { cost: { amount: 30, per: 'person' } }, jordan),
    ev('trip-nyc', 4, N(2), '19:00', '21:45', 'broadway-show', nycAll, { cost: { amount: 149, per: 'person' } }, jordan),
  ];
  const nycExpenses = [
    ex('trip-nyc', 1, 447, 'Broadway tickets (3)', 'activities', N(-20), jordan, nycAll, 'gmail-demo', 'Theater District Box Office'),
    ex('trip-nyc', 2, 186.2, 'Birthday dinner', 'food', N(1), maya, nycAll, 'receipt', 'Luca’s Trattoria'),
    ex('trip-nyc', 3, 90, 'The Met tickets (3)', 'activities', N(2), priya, nycAll, 'manual', 'The Met'),
  ];
  const nycOwes = [...owesFor(nycExpenses[0], [maya, priya], 1), ...owesFor(nycExpenses[1], [jordan, priya], 5), ...owesFor(nycExpenses[2], [maya, jordan], 9)];

  // Past: Banff (Maya hosted)
  const bStart = addDays(base, -450);
  const B = (n: number) => addDays(bStart, n - 1);
  const banff: Trip = {
    id: 'trip-banff',
    title: 'Banff Long Weekend',
    destinations: [{ id: 'trip-banff-d1', name: 'Banff', country: 'Canada', lat: 51.1784, lng: -115.5708 }],
    startDate: bStart,
    endDate: B(4),
    ownerId: maya,
    members: [member(maya, 'owner'), member(jordan, 'editor'), member(sam, 'viewer')],
    budget: { mode: 'group', groupAmount: 2400, personal: {} },
    coverPhoto: 'banff',
    createdAt: `${addDays(base, -520)}T16:00:00.000Z`,
    updatedAt: `${addDays(base, -446)}T16:00:00.000Z`,
  };
  const banffAll = [maya, jordan, sam];
  const banffEvents = [
    ev('trip-banff', 1, B(1), '15:00', '17:00', 'banff-gondola', banffAll, { cost: { amount: 62, per: 'person' } }, maya),
    ev('trip-banff', 2, B(2), '06:00', '08:30', 'moraine-lake', banffAll, { notes: 'Sunrise shuttle at 5:15 AM.' }, sam),
    ev('trip-banff', 3, B(2), '10:00', '13:00', 'lake-louise', banffAll, {}, maya),
    ev('trip-banff', 4, B(3), '09:00', '12:00', 'johnston-canyon', banffAll, {}, sam),
  ];
  const banffExpenses = [
    ex('trip-banff', 1, 980, 'Lodge, 3 nights', 'lodging', B(-40), maya, banffAll, 'gmail-demo', 'Bow River Lodge'),
    ex('trip-banff', 2, 186, 'Gondola tickets (3)', 'activities', B(1), sam, banffAll, 'manual', 'Banff Gondola'),
    ex('trip-banff', 3, 142.35, 'Groceries and snacks', 'food', B(1), jordan, banffAll, 'receipt', 'Mountain Market'),
  ];
  const banffOwes = [...owesFor(banffExpenses[0], [jordan, sam], 1), ...owesFor(banffExpenses[1], [maya, jordan], 5), ...owesFor(banffExpenses[2], [maya, sam], 9)];

  // Upcoming: a just-created trip with nothing planned yet (natural empty states).
  const zStart = addDays(base, 45);
  const zion: Trip = {
    id: 'trip-zion',
    title: 'Zion Weekend',
    destinations: [{ id: 'trip-zion-d1', name: 'Springdale', country: 'Utah, United States', lat: 37.1889, lng: -112.9986 }],
    startDate: zStart,
    endDate: addDays(zStart, 2),
    ownerId: maya,
    members: [member(maya, 'owner')],
    budget: { mode: 'group', groupAmount: null, personal: {} },
    coverPhoto: 'zion',
    createdAt: `${addDays(base, -1)}T20:00:00.000Z`,
    updatedAt: `${addDays(base, -1)}T20:00:00.000Z`,
  };

  return {
    ...emptyBundle(),
    trips: [kauai, nyc, banff, zion],
    events: [...kauaiEvents, ...nycEvents, ...banffEvents],
    expenses: [...nycExpenses, ...banffExpenses],
    reimbursements: [...nycOwes, ...banffOwes],
  };
}

/* ------------------------------------------------------- initial state */

/** Everything a brand-new account gets: its own sample trip + a pending invite. */
export function starterBundleFor(personId: string, base: ISODate): TripBundle {
  return mergeBundles(buildSampleTrip(personId, base), buildMexicoInvite(personId, base));
}

export function createInitialState(): AppState {
  const base = realTodayISO();
  const maya: Account = {
    id: MAYA_ACCOUNT_ID,
    personId: MAYA_PERSON_ID,
    email: 'maya.chen@example.com',
    password: DEMO_PASSWORD,
    providers: ['email', 'google', 'apple'],
    createdAt: '2025-03-02T17:00:00.000Z',
    connections: freshConnections().map((c) =>
      c.service === 'instagram'
        ? connectedWith('instagram', ['profile', 'saved'])
        : c.service === 'gmail'
          ? connectedWith('gmail', ['receipts', 'confirmations'])
          : c,
    ),
    onboardingDone: true,
  };

  const bundle = mergeBundles(starterBundleFor(MAYA_PERSON_ID, base), buildMayaHistory(base));

  return {
    version: STATE_VERSION,
    seededOn: base,
    accounts: [maya],
    people: SAMPLE_PEOPLE.map((p) => ({ ...p })),
    sessionAccountId: null,
    ...bundle,
    surveys: { ...SAMPLE_SURVEYS },
    decisions: [],
    messages: [],
    demo: { clock: null, viewAs: null, showSample: true, slowMode: false, failNextConnect: false },
    ui: { lastTripId: null, autoOpenedFor: null, nearby: null, nearbySeen: [], justCreatedTripId: null, justAddedEventId: null },
  };
}

export { NOW_STAMP };
