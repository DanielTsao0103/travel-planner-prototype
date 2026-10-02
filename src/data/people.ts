/**
 * Fictional people and their preference-survey answers (Page 15 → Page 13).
 * Every email uses example.com, a domain reserved for documentation, so nothing
 * here points at a real inbox.
 */

import type { Person, SurveyResponse } from './types';

export const SAMPLE_PEOPLE: Person[] = [
  { id: 'p-maya', name: 'Maya Chen', email: 'maya.chen@example.com', color: 'av-1' },
  { id: 'p-jordan', name: 'Jordan Reyes', email: 'jordan.reyes@example.com', color: 'av-2', isSample: true },
  { id: 'p-sam', name: 'Sam Okafor', email: 'sam.okafor@example.com', color: 'av-3', isSample: true },
  { id: 'p-priya', name: 'Priya Nair', email: 'priya.nair@example.com', color: 'av-4', isSample: true },
  { id: 'p-linda', name: 'Linda Park', email: 'linda.park@example.com', color: 'av-5', isSample: true },
  { id: 'p-diego', name: 'Diego Alvarez', email: 'diego.alvarez@example.com', color: 'av-6', isSample: true },
  { id: 'p-kevin', name: 'Kevin Chen', email: 'kevin.chen@example.com', color: 'av-7', isSample: true },
];

/** The companions every account's sample trip includes (besides the owner). */
export const SAMPLE_COMPANION_IDS = ['p-jordan', 'p-sam', 'p-priya', 'p-linda', 'p-diego'] as const;

const stamp = '2026-09-20T18:00:00.000Z';

export const SAMPLE_SURVEYS: Record<string, SurveyResponse> = {
  'p-maya': {
    personId: 'p-maya',
    updatedAt: stamp,
    diet: ['pescatarian'],
    allergies: [],
    localVsFamiliar: 5,
    simpleVsExtravagant: 3,
    mealBudget: 2,
    atmosphere: ['lively', 'outdoor-seating'],
    interests: ['historic', 'cultural', 'food-markets', 'photography'],
    mobility: 'none',
    stepFreeNeeded: false,
    maxWalkMinutes: null,
    tickets: 'happy-to-book',
  },
  'p-jordan': {
    personId: 'p-jordan',
    updatedAt: stamp,
    diet: ['gluten-free'],
    allergies: [{ item: 'gluten', severity: 'severe' }],
    dietNotes: 'Celiac — needs a dedicated gluten-free kitchen or strict prep, not just “GF options.”',
    localVsFamiliar: 4,
    simpleVsExtravagant: 5,
    mealBudget: 4,
    atmosphere: ['upscale', 'great-view'],
    interests: ['modern', 'architecture', 'art', 'nightlife'],
    mobility: 'none',
    stepFreeNeeded: false,
    maxWalkMinutes: null,
    tickets: 'happy-to-book',
  },
  'p-sam': {
    personId: 'p-sam',
    updatedAt: stamp,
    diet: [],
    allergies: [{ item: 'tree-nuts', severity: 'severe' }],
    dietNotes: 'Carries an EpiPen. Please flag almond pastries and pesto.',
    localVsFamiliar: 4,
    simpleVsExtravagant: 2,
    mealBudget: 1,
    atmosphere: ['casual', 'outdoor-seating'],
    interests: ['nature', 'historic', 'photography'],
    mobility: 'none',
    stepFreeNeeded: false,
    maxWalkMinutes: null,
    tickets: 'happy-to-book',
  },
  'p-priya': {
    personId: 'p-priya',
    updatedAt: stamp,
    diet: ['vegetarian'],
    allergies: [],
    localVsFamiliar: 3,
    simpleVsExtravagant: 2,
    mealBudget: 2,
    atmosphere: ['quiet', 'casual'],
    interests: ['cultural', 'art', 'religious-sites', 'shopping'],
    mobility: 'none',
    stepFreeNeeded: false,
    maxWalkMinutes: 40,
    tickets: 'prefer-walk-in',
  },
  'p-linda': {
    personId: 'p-linda',
    updatedAt: stamp,
    diet: ['low-sodium'],
    allergies: [{ item: 'shellfish', severity: 'mild' }],
    localVsFamiliar: 2,
    simpleVsExtravagant: 3,
    mealBudget: 3,
    atmosphere: ['quiet', 'family-friendly'],
    interests: ['historic', 'ancient', 'religious-sites', 'music'],
    mobility: 'wheelchair-sometimes',
    stepFreeNeeded: true,
    maxWalkMinutes: 10,
    tickets: 'need-help',
    otherNeeds: 'Uses a folding wheelchair for longer distances. Needs a rest break after lunch.',
  },
};
