/**
 * The app's data model. Everything the prototype shows is derived from one
 * `AppState` object (see src/store/store.ts), so a change made on one page
 * (e.g. adding an event on Page 7) shows up everywhere else automatically.
 *
 * Conventions:
 *  - Dates are local calendar dates as 'YYYY-MM-DD' strings (ISODate).
 *  - Times are 24h 'HH:MM' strings (Time), in the trip's local time.
 *  - Money is a plain number in US dollars.
 */

export type ISODate = string;
export type Time = string;

/* ------------------------------------------------------------------ people */

export interface Person {
  id: string;
  name: string;
  email: string;
  /** Avatar background (a CSS color token name or literal). */
  color: string;
  /** True for the built-in fictional companions on the sample trip. */
  isSample?: boolean;
}

/** Owner = trip host. Day = "day editor": can edit only the days listed in `days`. */
export type Role = 'owner' | 'editor' | 'day' | 'viewer';

export interface Membership {
  personId: string;
  role: Role;
  /** Only for role 'day': the days this person can edit. */
  days?: ISODate[];
  status: 'accepted' | 'pending' | 'declined';
  invitedById?: string;
  invitedAt?: string;
}

/* ------------------------------------------------------------------- places */

export type PlaceCategory =
  | 'landmark'
  | 'museum'
  | 'viewpoint'
  | 'restaurant'
  | 'cafe'
  | 'market'
  | 'bar'
  | 'nature'
  | 'lodging'
  | 'transit'
  | 'shopping'
  | 'tour'
  | 'other';

/** Facts about a place that matter for group preferences/limitations (Page 13). */
export type PlaceTag =
  | 'gluten-free-options'
  | 'gluten-free-dedicated'
  | 'vegetarian-friendly'
  | 'vegan-options'
  | 'nut-free-kitchen'
  | 'seafood'
  | 'local-cuisine'
  | 'familiar-food'
  | 'upscale'
  | 'casual'
  | 'lively'
  | 'quiet'
  | 'outdoor-seating'
  | 'view'
  | 'historic'
  | 'modern'
  | 'cultural'
  | 'nature'
  | 'art'
  | 'family-friendly';

export type Accessibility = 'yes' | 'partial' | 'no' | 'unknown';

/** Crowd profile used to draw the "how busy is it usually" chart (Page 7). */
export type BusyProfile =
  | 'landmark'
  | 'museum'
  | 'market'
  | 'restaurant'
  | 'cafe'
  | 'viewpoint'
  | 'transit'
  | 'bar'
  | 'nature'
  | 'lodging';

export interface Place {
  id: string;
  name: string;
  /** Neighborhood or city line shown under the name. */
  area: string;
  city: string;
  lat: number;
  lng: number;
  category: PlaceCategory;
  tags: PlaceTag[];
  /** Photo id from public/img (bundled) or a full URL (live Wikipedia photo). */
  photo?: string;
  stepFree: Accessibility;
  ticketRequired: boolean;
  busyProfile: BusyProfile;
  /** One-line description. */
  blurb?: string;
  /** True for invented businesses (restaurants etc.) so we never misattribute claims. */
  fictional?: boolean;
  source: 'bundled' | 'osm' | 'custom';
}

/* -------------------------------------------------------------------- trips */

export interface Destination {
  id: string;
  name: string;
  country?: string;
  lat: number;
  lng: number;
}

export type BudgetMode = 'group' | 'individual';

export interface TripBudget {
  mode: BudgetMode;
  /** Group total in USD (null = not set yet). */
  groupAmount: number | null;
  /** Individual budgets keyed by personId (individual mode). */
  personal: Record<string, number>;
}

export interface Trip {
  id: string;
  title: string;
  destinations: Destination[];
  startDate: ISODate;
  endDate: ISODate;
  ownerId: string;
  members: Membership[];
  budget: TripBudget;
  /** Photo id or URL for the trip card. */
  coverPhoto?: string;
  /** Built-in fictional trip (badge "Sample"). */
  isSample?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface EventCost {
  amount: number;
  per: 'person' | 'total';
}

export interface TripEvent {
  id: string;
  tripId: string;
  /** A snapshot of the place (so live search results keep working offline). */
  place: Place;
  /** Optional label that replaces the place name, e.g. "Train to Sintra". */
  title?: string;
  date: ISODate;
  start: Time;
  end: Time;
  cost?: EventCost;
  attendeeIds: string[];
  notes?: string;
  /** How the event was created. */
  source: 'manual' | 'screenshot' | 'suggestion' | 'nearby';
  /** Confirmation/booking reference (from a screenshot or typed in). */
  confirmation?: string;
  createdById: string;
}

/* ------------------------------------------------------------------- budget */

export type ExpenseCategory = 'lodging' | 'food' | 'activities' | 'transport' | 'shopping' | 'other';

/** Where an expense came from. gmail-demo / bank-demo are simulated integrations. */
export type ExpenseSource = 'manual' | 'receipt' | 'gmail-demo' | 'bank-demo';

export interface Expense {
  id: string;
  tripId: string;
  amount: number;
  /** "What it was for" */
  purpose: string;
  category: ExpenseCategory;
  date: ISODate;
  paidById: string;
  /** Everyone who shares this cost (including the payer if they share it). */
  splitWithIds: string[];
  source: ExpenseSource;
  merchant?: string;
  createdById: string;
}

/** "Name 1 owes Name 2 $000.00" — `toId` is the person who is owed (the requester). */
export interface Reimbursement {
  id: string;
  tripId: string;
  fromId: string;
  toId: string;
  amount: number;
  reason: string;
  expenseId?: string;
  status: 'open' | 'paid';
  createdAt: string;
  paidAt?: string;
  /** Simulated notification was "sent" to fromId. */
  notified: boolean;
}

/* -------------------------------------------------------------------- to-do */

export interface Todo {
  id: string;
  tripId: string;
  text: string;
  date?: ISODate;
  assigneeId?: string;
  done: boolean;
  eventId?: string;
  createdById: string;
}

/* ------------------------------------------------------------ survey (P15) */

export type DietTag =
  | 'vegetarian'
  | 'vegan'
  | 'pescatarian'
  | 'gluten-free'
  | 'dairy-free'
  | 'halal'
  | 'kosher'
  | 'low-sodium';

export type AllergyTag = 'tree-nuts' | 'peanuts' | 'shellfish' | 'fish' | 'eggs' | 'dairy' | 'soy' | 'sesame' | 'gluten';

export interface Allergy {
  item: AllergyTag;
  severity: 'mild' | 'severe';
}

export type AtmosphereTag =
  | 'lively'
  | 'quiet'
  | 'casual'
  | 'upscale'
  | 'romantic'
  | 'family-friendly'
  | 'outdoor-seating'
  | 'great-view';

export type InterestTag =
  | 'historic'
  | 'ancient'
  | 'modern'
  | 'cultural'
  | 'art'
  | 'architecture'
  | 'nature'
  | 'food-markets'
  | 'nightlife'
  | 'music'
  | 'shopping'
  | 'beaches'
  | 'religious-sites'
  | 'photography';

export type MobilityNeed = 'none' | 'cane-or-walker' | 'wheelchair-sometimes' | 'wheelchair-always';

export interface SurveyResponse {
  personId: string;
  updatedAt: string;
  diet: DietTag[];
  allergies: Allergy[];
  dietNotes?: string;
  /** 1 = taste of home / familiar food … 5 = local delights only */
  localVsFamiliar: 1 | 2 | 3 | 4 | 5;
  /** 1 = simple & cheap … 5 = extravagant */
  simpleVsExtravagant: 1 | 2 | 3 | 4 | 5;
  /** Typical spend per person per meal: 1 = $ (<$15) … 4 = $$$$ ($60+) */
  mealBudget: 1 | 2 | 3 | 4;
  atmosphere: AtmosphereTag[];
  interests: InterestTag[];
  mobility: MobilityNeed;
  stepFreeNeeded: boolean;
  /** Longest comfortable walk at one time, in minutes (null = no limit). */
  maxWalkMinutes: 5 | 10 | 20 | 40 | null;
  /** How they feel about places that need tickets booked ahead. */
  tickets: 'happy-to-book' | 'prefer-walk-in' | 'need-help';
  otherNeeds?: string;
}

/* ----------------------------------------------------- connections (P2/P3) */

export type ServiceId = 'instagram' | 'facebook' | 'tiktok' | 'gmail';

export interface ServicePermission {
  key: string;
  label: string;
  /** What this permission unlocks in the app. */
  unlocks: string;
  required: boolean;
  granted: boolean;
}

export interface Connection {
  service: ServiceId;
  status: 'not-connected' | 'connected' | 'failed';
  permissions: ServicePermission[];
  lastResult?: 'success' | 'canceled' | 'failed';
  connectedAt?: string;
}

/* ----------------------------------------------------------------- accounts */

export type AuthProvider = 'email' | 'google' | 'apple';

export interface Account {
  id: string;
  personId: string;
  email: string;
  /** Fictional demo password (this is a prototype; never a real credential). */
  password?: string;
  providers: AuthProvider[];
  createdAt: string;
  connections: Connection[];
  /** Set once the user leaves Page 2 (connected or skipped). */
  onboardingDone: boolean;
}

/* --------------------------------------------------------- suggestions (P9) */

export interface Suggestion {
  id: string;
  tripId: string;
  place: Place;
  /** "Since you planned <basedOn> …" */
  basedOnEventId?: string;
  basedOnLabel: string;
  reason: string;
  /** Suggested slot (the user can change it before adding). */
  date: ISODate;
  start: Time;
  end: Time;
  estCostPerPerson?: number;
  /** Short fit chips, e.g. "Gluten-free (Jordan)", "6 min walk". */
  fit: string[];
  source: 'bundled' | 'osm';
}

export interface SuggestionDecision {
  tripId: string;
  suggestionId: string;
  status: 'declined' | 'added';
  at: string;
  /** For 'added': the event that was created. */
  eventId?: string;
}

/* ------------------------------------------------------------ demo controls */

export interface DemoClock {
  date: ISODate;
  time: Time;
}

export interface DemoSettings {
  /** null = use the real current date/time. */
  clock: DemoClock | null;
  /** "View as" role override (prototype tool). null = your real role. */
  viewAs: Role | null;
  /** Show the built-in sample trip in lists. */
  showSample: boolean;
  /** Add artificial delays so loading states are visible. */
  slowMode: boolean;
  /** Make the next simulated connection (Page 3) fail. */
  failNextConnect: boolean;
}

/** A nearby-place match shown by Page 16. */
export interface NearbyMatch {
  tripId: string;
  place: Place;
  /** Straight-line distance from the traveler (meters). */
  distanceM: number;
  /** Estimated walking time along streets (minutes). */
  walkMin: number;
  reasons: string[];
  from: { lat: number; lng: number; label: string };
}

export interface DemoNotification {
  id: string;
  kind: 'bank' | 'gmail';
  tripId: string;
  amount: number;
  merchant: string;
  category: ExpenseCategory;
  date: ISODate;
  receivedAt: string;
  status: 'new' | 'logged' | 'ignored';
}

/** A log of simulated outbound messages (invites, "you owe" notices). Nothing is really sent. */
export interface SimulatedMessage {
  id: string;
  kind: 'invite' | 'reimbursement' | 'role-change' | 'removed';
  toPersonId: string;
  tripId: string;
  text: string;
  at: string;
}

export interface UiState {
  lastTripId: string | null;
  /** Trip id the dashboard auto-opened for in this session (so it only happens once). */
  autoOpenedFor: string | null;
  nearby: NearbyMatch | null;
  /** Nearby place ids already shown/dismissed (per trip). */
  nearbySeen: string[];
  /** Trip that was just created (Page 5 highlight). */
  justCreatedTripId: string | null;
  /** Event that was just added (Page 8 highlight). */
  justAddedEventId: string | null;
}

export interface AppState {
  version: number;
  /** ISO date the seed data was generated on (sample trip dates are relative to it). */
  seededOn: ISODate;
  accounts: Account[];
  people: Person[];
  sessionAccountId: string | null;
  trips: Trip[];
  events: TripEvent[];
  expenses: Expense[];
  reimbursements: Reimbursement[];
  todos: Todo[];
  surveys: Record<string, SurveyResponse>;
  suggestions: Suggestion[];
  decisions: SuggestionDecision[];
  notifications: DemoNotification[];
  messages: SimulatedMessage[];
  demo: DemoSettings;
  ui: UiState;
}
