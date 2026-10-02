/**
 * The survey's working copy ("draft") while someone fills it in, plus the
 * rules that decide whether a step is complete.
 *
 * The draft differs from the saved `SurveyResponse` in two ways:
 *  - required answers can be `undefined` ("not answered yet"), so we can show
 *    "Choose how long you can walk" instead of silently picking a default;
 *  - "No restrictions" is its own flag (a saved response just has empty lists).
 */

import type { Allergy, AllergyTag, AtmosphereTag, DietTag, InterestTag, MobilityNeed, SurveyResponse } from '../../data/types';
import type { MealBudget, Scale5, StepNumber, TicketPref, WalkLimit } from './vocab';

export interface SurveyDraft {
  diet: DietTag[];
  /** "No restrictions" chip. Picking any diet or allergy turns it off. */
  noRestrictions: boolean;
  allergies: Allergy[];
  dietNotes: string;
  localVsFamiliar: Scale5;
  simpleVsExtravagant: Scale5;
  mealBudget: MealBudget;
  atmosphere: AtmosphereTag[];
  interests: InterestTag[];
  mobility: MobilityNeed;
  stepFreeNeeded: boolean;
  /** `undefined` = not answered yet; `null` = "No limit". */
  maxWalkMinutes: WalkLimit | undefined;
  tickets: TicketPref | undefined;
  otherNeeds: string;
}

/** Start from a saved response (editing, 15H) or from neutral defaults (first time). */
export function draftFromSurvey(saved: SurveyResponse | undefined): SurveyDraft {
  if (!saved) {
    return {
      diet: [],
      noRestrictions: false,
      allergies: [],
      dietNotes: '',
      localVsFamiliar: 3,
      simpleVsExtravagant: 3,
      mealBudget: 2,
      atmosphere: [],
      interests: [],
      mobility: 'none',
      stepFreeNeeded: false,
      maxWalkMinutes: undefined,
      tickets: undefined,
      otherNeeds: '',
    };
  }
  return {
    diet: [...saved.diet],
    // A saved response with no diets and no allergies means "No restrictions".
    noRestrictions: saved.diet.length === 0 && saved.allergies.length === 0,
    allergies: saved.allergies.map((a) => ({ ...a })),
    dietNotes: saved.dietNotes ?? '',
    localVsFamiliar: saved.localVsFamiliar,
    simpleVsExtravagant: saved.simpleVsExtravagant,
    mealBudget: saved.mealBudget,
    atmosphere: [...saved.atmosphere],
    interests: [...saved.interests],
    mobility: saved.mobility,
    stepFreeNeeded: saved.stepFreeNeeded,
    maxWalkMinutes: saved.maxWalkMinutes,
    tickets: saved.tickets,
    otherNeeds: saved.otherNeeds ?? '',
  };
}

/** Inline error messages, keyed by the field they belong to. */
export interface StepErrors {
  food?: string;
  walk?: string;
  tickets?: string;
}

/** Which answers are missing on a step (15F). Steps 2, 3, and 5 have no required answers. */
export function validateStep(draft: SurveyDraft, step: StepNumber): StepErrors {
  const errors: StepErrors = {};
  if (step === 1 && !draft.noRestrictions && draft.diet.length === 0 && draft.allergies.length === 0) {
    errors.food = 'Pick the diets or allergies that apply to you, or choose “No restrictions.”';
  }
  if (step === 4) {
    if (draft.maxWalkMinutes === undefined) errors.walk = 'Choose how long you can comfortably walk at one time.';
    if (!draft.tickets) errors.tickets = 'Choose how you feel about places that need tickets.';
  }
  return errors;
}

/** True if any error message is set. */
export function hasErrors(errors: StepErrors): boolean {
  return Object.values(errors).some(Boolean);
}

/** The first step with a missing required answer, if any. */
export function firstIncompleteStep(draft: SurveyDraft): StepNumber | null {
  for (const step of [1, 4] as StepNumber[]) {
    if (hasErrors(validateStep(draft, step))) return step;
  }
  return null;
}

/** Add or remove an item from a list (used by every chip group). */
export function toggleIn<T>(list: T[], item: T): T[] {
  return list.includes(item) ? list.filter((x) => x !== item) : [...list, item];
}

/** Turn an allergy on (as severe, the cautious default) or off. */
export function toggleAllergy(list: Allergy[], item: AllergyTag): Allergy[] {
  return list.some((a) => a.item === item) ? list.filter((a) => a.item !== item) : [...list, { item, severity: 'severe' }];
}

/**
 * Build the response that gets saved. Callers must validate first: the
 * required answers (walking limit, tickets) are filled in by then.
 */
export function draftToResponse(draft: SurveyDraft, personId: string): SurveyResponse {
  const noneChosen = draft.noRestrictions;
  return {
    personId,
    updatedAt: new Date().toISOString(),
    diet: noneChosen ? [] : draft.diet,
    allergies: noneChosen ? [] : draft.allergies,
    dietNotes: draft.dietNotes.trim() || undefined,
    localVsFamiliar: draft.localVsFamiliar,
    simpleVsExtravagant: draft.simpleVsExtravagant,
    mealBudget: draft.mealBudget,
    atmosphere: draft.atmosphere,
    interests: draft.interests,
    mobility: draft.mobility,
    stepFreeNeeded: draft.stepFreeNeeded,
    maxWalkMinutes: draft.maxWalkMinutes ?? null,
    tickets: draft.tickets ?? 'happy-to-book',
    otherNeeds: draft.otherNeeds.trim() || undefined,
  };
}
