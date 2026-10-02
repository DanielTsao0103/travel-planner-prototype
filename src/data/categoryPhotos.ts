/**
 * Representative photos by kind of place, used only when a place has no photo
 * of its own and none could be found online (see src/services/placeImages.ts).
 * They're deliberately generic (no famous landmarks), so they never suggest a
 * specific place, and the UI labels them "Representative photo".
 * All are freely licensed from Wikimedia Commons (credits in photoCredits.json).
 */

import type { PlaceCategory } from './types';

export const CATEGORY_PHOTOS: Record<PlaceCategory, string[]> = {
  restaurant: ['restaurant', 'cat-restaurant-2', 'cat-restaurant-3', 'cat-restaurant-4'],
  cafe: ['cat-cafe-1', 'cat-cafe-2', 'cat-cafe-3', 'cat-cafe-4', 'sourdough'],
  bar: ['cat-bar-2', 'cat-bar-3'],
  market: ['cat-market'],
  museum: ['cat-museum-1', 'cat-museum-2'],
  landmark: ['cat-landmark-1', 'cat-landmark-2'],
  viewpoint: ['cat-viewpoint'],
  nature: ['cat-nature-1', 'cat-nature-2'],
  lodging: ['cat-lodging'],
  transit: ['cat-transit'],
  shopping: ['cat-shopping'],
  tour: ['cat-tour'],
  other: ['cat-travel'],
};

/** Every representative photo id (so the UI can tell them apart from real ones). */
export const REPRESENTATIVE_IDS = new Set(Object.values(CATEGORY_PHOTOS).flat());

/** Small stable hash (FNV-1a) so a place keeps the same photo. */
function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Photo already chosen for each place, and how often each photo is in use. */
const assigned = new Map<string, string>();
const uses = new Map<string, number>();

/**
 * Pick a representative photo for a kind of place. Each new place gets the
 * least-used photo in its pool (starting from a stable spot), so a list of
 * nearby cafés shows different images instead of one repeated photo.
 */
export function categoryPhoto(category: PlaceCategory, seed: string): string {
  const key = `${category}|${seed}`;
  const known = assigned.get(key);
  if (known) return known;
  const pool = CATEGORY_PHOTOS[category] ?? CATEGORY_PHOTOS.other;
  const startAt = hash(seed) % pool.length;
  let best = pool[startAt];
  for (let i = 1; i < pool.length; i++) {
    const candidate = pool[(startAt + i) % pool.length];
    if ((uses.get(candidate) ?? 0) < (uses.get(best) ?? 0)) best = candidate;
  }
  uses.set(best, (uses.get(best) ?? 0) + 1);
  assigned.set(key, best);
  return best;
}
