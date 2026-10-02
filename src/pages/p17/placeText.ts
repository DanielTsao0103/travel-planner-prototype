/**
 * Small text helpers for describing places, shared by Page 16 (the nearby
 * pop-up) and Page 17 (the map). Pure functions, no React.
 */

import type { PlaceCategory } from '../../data/types';

/** Human label for a place category, e.g. 'cafe' → 'Café'. */
export const CATEGORY_LABEL: Record<PlaceCategory, string> = {
  landmark: 'Landmark',
  museum: 'Museum',
  viewpoint: 'Viewpoint',
  restaurant: 'Restaurant',
  cafe: 'Café',
  market: 'Market',
  bar: 'Bar',
  nature: 'Park & nature',
  lodging: 'Lodging',
  transit: 'Station',
  shopping: 'Shopping',
  tour: 'Tour',
  other: 'Place',
};

/** "Café · Cais do Sodré" (skips the area when a live place has none). */
export function categoryLine(category: PlaceCategory, area?: string): string {
  const label = CATEGORY_LABEL[category] ?? 'Place';
  return area ? `${label} · ${area}` : label;
}

/**
 * A match reason from `matchReasons()` looks like "Nut-free kitchen · Sam".
 * Split it so the UI can style the need and the people separately.
 */
export function splitReason(reason: string): { need: string; who: string } {
  const at = reason.lastIndexOf(' · ');
  if (at === -1) return { need: reason, who: '' };
  return { need: reason.slice(0, at), who: reason.slice(at + 3) };
}

/**
 * Show "You" instead of your own first name in a reason
 * ("Local favorite · Maya, Jordan" → "Local favorite · You, Jordan").
 */
export function personalizeReason(reason: string, myFirstName: string | undefined): string {
  if (!myFirstName) return reason;
  const { need, who } = splitReason(reason);
  if (!who) return reason;
  const names = who.split(', ');
  if (!names.includes(myFirstName)) return reason;
  // "You" goes first, then everyone else in their original order.
  const others = names.filter((n) => n !== myFirstName);
  return `${need} · ${['You', ...others].join(', ')}`;
}
