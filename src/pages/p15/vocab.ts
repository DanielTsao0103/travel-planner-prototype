/**
 * The survey's vocabulary: every question's options, labels, and icons.
 *
 * Page 15 (the survey) asks the questions with these options, and Page 13
 * (Group & permissions) reads the same labels to build its group tiles, so a
 * label changed here changes on both pages.
 *
 * Stored values come from `SurveyResponse` in src/data/types.ts.
 */

import type { LucideIcon } from 'lucide-react';
import {
  Accessibility,
  Bean,
  Building2,
  Camera,
  Church,
  Columns3,
  Egg,
  Fish,
  Landmark,
  Leaf,
  Martini,
  Milk,
  MilkOff,
  Music,
  Nut,
  Palette,
  Shell,
  ShoppingBag,
  Soup,
  Sprout,
  Store,
  Theater,
  Trees,
  Umbrella,
  UtensilsCrossed,
  Vegan,
  Wheat,
  WheatOff,
} from 'lucide-react';
import type { AllergyTag, AtmosphereTag, DietTag, InterestTag, MobilityNeed, SurveyResponse } from '../../data/types';

/** One choice in a question: the stored value, what people see, and an optional hint/icon. */
export interface Option<T> {
  value: T;
  label: string;
  hint?: string;
  icon?: LucideIcon;
}

/** Turn an option list into a quick value → label lookup. */
function labelsOf<T extends string>(options: Option<T>[]): Record<T, string> {
  return Object.fromEntries(options.map((o) => [o.value, o.label])) as Record<T, string>;
}

/* ------------------------------------------------------------ step 1: food */

export const DIET_OPTIONS: Option<DietTag>[] = [
  { value: 'vegetarian', label: 'Vegetarian', icon: Leaf },
  { value: 'vegan', label: 'Vegan', icon: Vegan },
  { value: 'pescatarian', label: 'Pescatarian', icon: Fish },
  { value: 'gluten-free', label: 'Gluten-free / celiac', icon: WheatOff },
  { value: 'dairy-free', label: 'Dairy-free', icon: MilkOff },
  { value: 'halal', label: 'Halal', icon: UtensilsCrossed },
  { value: 'kosher', label: 'Kosher', icon: UtensilsCrossed },
  { value: 'low-sodium', label: 'Low-sodium', icon: Soup },
];

/** Shorter diet names for the group tiles ("Gluten-free" rather than "Gluten-free / celiac"). */
export const DIET_LABEL: Record<DietTag, string> = { ...labelsOf(DIET_OPTIONS), 'gluten-free': 'Gluten-free' };

export const ALLERGY_OPTIONS: Option<AllergyTag>[] = [
  { value: 'tree-nuts', label: 'Tree nuts', icon: Nut },
  { value: 'peanuts', label: 'Peanuts', icon: Nut },
  { value: 'shellfish', label: 'Shellfish', icon: Shell },
  { value: 'fish', label: 'Fish', icon: Fish },
  { value: 'eggs', label: 'Eggs', icon: Egg },
  { value: 'dairy', label: 'Dairy', icon: Milk },
  { value: 'soy', label: 'Soy', icon: Bean },
  { value: 'sesame', label: 'Sesame', icon: Sprout },
  { value: 'gluten', label: 'Gluten', icon: Wheat },
];

export const ALLERGY_LABEL = labelsOf(ALLERGY_OPTIONS);

export const SEVERITY_OPTIONS: Option<'mild' | 'severe'>[] = [
  { value: 'mild', label: 'Mild', hint: 'Avoid it, but a trace isn’t dangerous.' },
  { value: 'severe', label: 'Severe', hint: 'Even a trace is dangerous.' },
];

/** How serious a food need is: severe allergies first, then diets, then mild allergies. */
export type DietKind = 'severe' | 'diet' | 'mild';

/** One food need as it reads on the group tiles, e.g. "Tree nuts · Severe allergy". */
export interface DietEntry {
  key: string;
  label: string;
  kind: DietKind;
  badge: string;
  icon?: LucideIcon;
}

/**
 * Turn one person's food answers into tile entries.
 * A severe gluten allergy reads as "Celiac (strict gluten-free)" and absorbs
 * the plain "Gluten-free" diet, so Jordan shows up once, not twice.
 */
export function dietEntriesFor(s: Pick<SurveyResponse, 'diet' | 'allergies'>): DietEntry[] {
  const entries: DietEntry[] = [];
  const celiac = s.allergies.some((a) => a.item === 'gluten' && a.severity === 'severe');
  for (const a of s.allergies) {
    const icon = ALLERGY_OPTIONS.find((o) => o.value === a.item)?.icon;
    if (a.item === 'gluten' && a.severity === 'severe') {
      entries.push({ key: 'celiac', label: 'Celiac (strict gluten-free)', kind: 'severe', badge: 'Severe', icon: WheatOff });
    } else if (a.severity === 'severe') {
      entries.push({ key: `severe-${a.item}`, label: ALLERGY_LABEL[a.item], kind: 'severe', badge: 'Severe allergy', icon });
    } else {
      entries.push({ key: `mild-${a.item}`, label: ALLERGY_LABEL[a.item], kind: 'mild', badge: 'Mild allergy', icon });
    }
  }
  for (const d of s.diet) {
    if (d === 'gluten-free' && celiac) continue;
    entries.push({ key: `diet-${d}`, label: DIET_LABEL[d], kind: 'diet', badge: 'Diet', icon: DIET_OPTIONS.find((o) => o.value === d)?.icon });
  }
  const rank: Record<DietKind, number> = { severe: 0, diet: 1, mild: 2 };
  return entries.sort((a, b) => rank[a.kind] - rank[b.kind]);
}

/* ----------------------------------------------------- step 2: dining style */

export type Scale5 = 1 | 2 | 3 | 4 | 5;
export type MealBudget = SurveyResponse['mealBudget'];

/** A 5-step scale shown left → right. `order` lists the stored values in on-screen order. */
export interface ScaleDef {
  leftLabel: string;
  rightLabel: string;
  order: Scale5[];
  labels: Record<Scale5, string>;
}

/**
 * Local delights ↔ Taste of home. Stored as 1 (taste of home) … 5 (local only),
 * but shown with "Local delights" on the LEFT, as the source doc phrases it.
 */
export const LOCAL_SCALE: ScaleDef = {
  leftLabel: 'Local delights',
  rightLabel: 'Taste of home',
  order: [5, 4, 3, 2, 1],
  labels: { 5: 'All local', 4: 'Mostly local', 3: 'A mix', 2: 'Mostly familiar', 1: 'Taste of home' },
};

/** Simple ↔ Extravagant. Stored as 1 (simple) … 5 (extravagant), shown in that order. */
export const FANCY_SCALE: ScaleDef = {
  leftLabel: 'Simple',
  rightLabel: 'Extravagant',
  order: [1, 2, 3, 4, 5],
  labels: { 1: 'Keep it simple', 2: 'Mostly simple', 3: 'A mix', 4: 'Some splurges', 5: 'Extravagant' },
};

/** Typical spend per person per meal. */
export const SPEND_OPTIONS: Array<{ value: MealBudget; symbol: string; range: string }> = [
  { value: 1, symbol: '$', range: 'Under $15' },
  { value: 2, symbol: '$$', range: '$15–30' },
  { value: 3, symbol: '$$$', range: '$30–60' },
  { value: 4, symbol: '$$$$', range: '$60+' },
];

/** The $ symbol and range for a spend level (falls back to $$). */
export function spendOption(value: MealBudget) {
  return SPEND_OPTIONS.find((o) => o.value === value) ?? SPEND_OPTIONS[1];
}

export const ATMOSPHERE_OPTIONS: Option<AtmosphereTag>[] = [
  { value: 'lively', label: 'Lively' },
  { value: 'quiet', label: 'Quiet' },
  { value: 'casual', label: 'Casual' },
  { value: 'upscale', label: 'Upscale' },
  { value: 'romantic', label: 'Romantic' },
  { value: 'family-friendly', label: 'Family-friendly' },
  { value: 'outdoor-seating', label: 'Outdoor seating' },
  { value: 'great-view', label: 'Great view' },
];

export const ATMOSPHERE_LABEL = labelsOf(ATMOSPHERE_OPTIONS);

/* -------------------------------------------------------- step 3: interests */

/**
 * Interests, split into "sights" (the doc's modern vs. ancient vs. cultural)
 * and "things to do". The "Ancient & historic" chip stores 'historic'; older
 * answers may also contain 'ancient', which counts as the same interest.
 */
export const SIGHT_OPTIONS: Option<InterestTag>[] = [
  { value: 'historic', label: 'Ancient & historic', icon: Landmark },
  { value: 'modern', label: 'Modern', icon: Building2 },
  { value: 'cultural', label: 'Cultural', icon: Theater },
  { value: 'art', label: 'Art & museums', icon: Palette },
  { value: 'architecture', label: 'Architecture', icon: Columns3 },
  { value: 'religious-sites', label: 'Religious sites', icon: Church },
];

export const ACTIVITY_OPTIONS: Option<InterestTag>[] = [
  { value: 'nature', label: 'Nature', icon: Trees },
  { value: 'food-markets', label: 'Food markets', icon: Store },
  { value: 'nightlife', label: 'Nightlife', icon: Martini },
  { value: 'music', label: 'Live music', icon: Music },
  { value: 'shopping', label: 'Shopping', icon: ShoppingBag },
  { value: 'beaches', label: 'Beaches', icon: Umbrella },
  { value: 'photography', label: 'Photography', icon: Camera },
];

export const INTEREST_OPTIONS: Option<InterestTag>[] = [...SIGHT_OPTIONS, ...ACTIVITY_OPTIONS];

export const INTEREST_LABEL: Record<InterestTag, string> = { ...labelsOf(INTEREST_OPTIONS), ancient: 'Ancient & historic' };

/** Merge the 'ancient' alias into 'historic' and drop duplicates. */
export function normalizeInterests(interests: InterestTag[]): InterestTag[] {
  return Array.from(new Set(interests.map((i) => (i === 'ancient' ? 'historic' : i))));
}

/* ------------------------------------------- step 4: accessibility & limits */

export const MOBILITY_OPTIONS: Option<MobilityNeed>[] = [
  { value: 'none', label: 'None' },
  { value: 'cane-or-walker', label: 'Cane or walker' },
  { value: 'wheelchair-sometimes', label: 'Wheelchair for longer distances' },
  { value: 'wheelchair-always', label: 'Wheelchair all the time' },
];

/** How a mobility answer reads on the group tiles. */
export const MOBILITY_PHRASE: Record<MobilityNeed, string> = {
  none: 'No mobility aid',
  'cane-or-walker': 'Uses a cane or walker',
  'wheelchair-sometimes': 'Uses a wheelchair for longer distances',
  'wheelchair-always': 'Uses a wheelchair all the time',
};

export const MOBILITY_ICON: LucideIcon = Accessibility;

export type WalkLimit = SurveyResponse['maxWalkMinutes'];

export const WALK_OPTIONS: Array<{ value: WalkLimit; label: string }> = [
  { value: 5, label: '5 min' },
  { value: 10, label: '10 min' },
  { value: 20, label: '20 min' },
  { value: 40, label: '40 min' },
  { value: null, label: 'No limit' },
];

/** "10 min" or "No limit". */
export function walkLabel(value: WalkLimit): string {
  return value === null ? 'No limit' : `${value} min`;
}

export type TicketPref = SurveyResponse['tickets'];

export const TICKET_OPTIONS: Option<TicketPref>[] = [
  { value: 'happy-to-book', label: 'Happy to book ahead', hint: 'Timed tickets and reservations are fine.' },
  { value: 'prefer-walk-in', label: 'Prefer walk-in places', hint: 'I’d rather keep plans loose and skip the lines for tickets.' },
  { value: 'need-help', label: 'I’d like help booking', hint: 'Someone else books, or helps me book.' },
];

/** How a tickets answer reads on the group tiles (third person). */
export const TICKET_PHRASE: Record<TicketPref, string> = {
  'happy-to-book': 'Happy to book ahead',
  'prefer-walk-in': 'Prefers walk-in places',
  'need-help': 'Would like help booking',
};

/* ------------------------------------------------------------------ steps */

export type StepNumber = 1 | 2 | 3 | 4 | 5;

export const STEPS: Array<{ n: StepNumber; short: string; title: string; description: string }> = [
  { n: 1, short: 'Food & dietary', title: 'Food & dietary needs', description: 'So every restaurant on the trip works for you.' },
  { n: 2, short: 'Dining style', title: 'Dining style', description: 'How you like to eat when you travel.' },
  { n: 3, short: 'Interests', title: 'What you want to see', description: 'Planners use these to pick stops everyone enjoys.' },
  { n: 4, short: 'Accessibility & limits', title: 'Accessibility & limits', description: 'So the plan fits how you get around.' },
  { n: 5, short: 'Review', title: 'Review your answers', description: 'Check everything, then save. You can change it anytime.' },
];
