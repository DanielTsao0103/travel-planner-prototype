/**
 * Nearby-place matching for Page 16.
 *
 * The doc describes the system "scanning the area within 500 ft or so" for a
 * place that matches the traveler's preferences and restrictions, with matches
 * "usually a 5 minute walk away". Those are two different measurements, so we
 * apply both (plan §6 G9):
 *   1. Trigger radius: within ~500 ft (152 m) in a straight line.
 *   2. Walk filter: the walking route must be ≤ ~5 minutes.
 * The pop-up shows both numbers, e.g. "450 ft away · 4 min walk".
 *
 * The sample trip uses a bundled match (a fictional gluten-free bakery near
 * Time Out Market). Trips the tester creates query OpenStreetMap (Overpass).
 */

import { getPlace } from '../data/places';
import type { AppState, NearbyMatch, Place, SurveyResponse, Trip } from '../data/types';
import { distanceMeters, estimateWalkMinutes, NEARBY_MAX_WALK_MIN, NEARBY_RADIUS_M } from '../lib/geo';
import { firstName } from '../lib/format';
import { nearbyPlaces } from '../services/overpass';
import { showNearby } from '../store/actions';
import { acceptedMemberIds, simulatedLocation } from '../store/selectors';
import { getState } from '../store/store';

export type NearbyResult = 'shown' | 'none' | 'not-active' | 'error';

/** Explain why a place matches the group (diet, access, interests). */
export function matchReasons(place: Place, surveys: SurveyResponse[], names: Record<string, string>): string[] {
  const reasons: string[] = [];
  const who = (pred: (s: SurveyResponse) => boolean) =>
    surveys.filter(pred).map((s) => firstName(names[s.personId] ?? ''));
  const gf = who((s) => s.diet.includes('gluten-free') || s.allergies.some((a) => a.item === 'gluten'));
  if (gf.length && (place.tags.includes('gluten-free-dedicated') || place.tags.includes('gluten-free-options'))) {
    reasons.push(`${place.tags.includes('gluten-free-dedicated') ? 'Dedicated gluten-free' : 'Gluten-free options'} · ${gf.join(', ')}`);
  }
  const nut = who((s) => s.allergies.some((a) => a.item === 'tree-nuts' || a.item === 'peanuts'));
  if (nut.length && place.tags.includes('nut-free-kitchen')) reasons.push(`Nut-free kitchen · ${nut.join(', ')}`);
  const veg = who((s) => s.diet.includes('vegetarian') || s.diet.includes('vegan'));
  if (veg.length && (place.tags.includes('vegetarian-friendly') || place.tags.includes('vegan-options'))) reasons.push(`Vegetarian-friendly · ${veg.join(', ')}`);
  const stepFree = who((s) => s.stepFreeNeeded || s.mobility !== 'none');
  if (stepFree.length && place.stepFree === 'yes') reasons.push(`Step-free entrance · ${stepFree.join(', ')}`);
  const local = who((s) => s.localVsFamiliar >= 4);
  if (local.length && place.tags.includes('local-cuisine')) reasons.push(`Local favorite · ${local.slice(0, 2).join(', ')}`);
  const culture = who((s) => s.interests.some((i) => i === 'cultural' || i === 'historic' || i === 'art'));
  if (culture.length && place.tags.some((t) => t === 'cultural' || t === 'historic' || t === 'art')) reasons.push(`Matches interests · ${culture.slice(0, 2).join(', ')}`);
  return reasons;
}

function groupSurveys(s: AppState, trip: Trip): SurveyResponse[] {
  return acceptedMemberIds(trip)
    .map((id) => s.surveys[id])
    .filter((x): x is SurveyResponse => !!x);
}

function nameMap(s: AppState): Record<string, string> {
  return Object.fromEntries(s.people.map((p) => [p.id, p.name]));
}

/** Look for a match near the traveler's simulated location and show Page 16. */
export async function triggerNearby(tripId: string, options: { force?: boolean } = {}): Promise<NearbyResult> {
  const s = getState();
  const trip = s.trips.find((t) => t.id === tripId);
  if (!trip) return 'error';
  const here = simulatedLocation(s, trip);
  if (!here) return 'not-active';
  const surveys = groupSurveys(s, trip);
  const names = nameMap(s);

  // Sample trip, near Time Out Market: a bundled, always-works match (the demo
  // clock's "during" preset puts the traveler there). Anywhere else (Sintra,
  // Porto, other parts of Lisbon) uses the live OpenStreetMap search below.
  const bakery = getPlace('padaria-celeste');
  if (trip.isSample && distanceMeters(here, bakery) <= NEARBY_RADIUS_M * 1.5) {
    if (!options.force && getState().ui.nearbySeen.includes(bakery.id)) return 'none';
    // The pop-up shows right away with a bundled walking time (the streets around the
    // market wind, so ~450 ft straight-line is about a 4-minute walk). The map page
    // fetches the real route when the traveler taps Go.
    showNearby({
      tripId,
      place: bakery,
      distanceM: Math.round(distanceMeters(here, bakery)),
      walkMin: 4,
      reasons: matchReasons(bakery, surveys, names),
      from: { lat: here.lat, lng: here.lng, label: here.label },
    });
    return 'shown';
  }

  // Everywhere else: ask OpenStreetMap for named places within ~500 ft.
  try {
    const candidates = await nearbyPlaces(here, NEARBY_RADIUS_M, ['food', 'sights'], trip.destinations[0]?.name ?? '');
    const seen = getState().ui.nearbySeen;
    const scored = candidates
      .filter((p) => options.force || !seen.includes(p.id))
      .map((p) => ({ p, reasons: matchReasons(p, surveys, names), d: distanceMeters(here, p) }))
      .filter((x) => x.d <= NEARBY_RADIUS_M)
      .sort((a, b) => b.reasons.length - a.reasons.length || a.d - b.d);
    for (const cand of scored.slice(0, 3)) {
      // Estimate the walk from the straight-line distance (streets add ~30%) so the
      // pop-up isn't held up by the routing service; Page 17 shows the real route.
      const walkMin = estimateWalkMinutes(cand.d);
      if (walkMin > NEARBY_MAX_WALK_MIN) continue;
      showNearby({
        tripId,
        place: cand.p,
        distanceM: Math.round(cand.d),
        walkMin,
        reasons: cand.reasons.length ? cand.reasons : [`${cand.p.category === 'restaurant' || cand.p.category === 'cafe' ? 'Food' : 'Sight'} close to where you are`],
        from: { lat: here.lat, lng: here.lng, label: here.label },
      });
      return 'shown';
    }
    return 'none';
  } catch {
    return 'error';
  }
}
