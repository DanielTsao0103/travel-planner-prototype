/**
 * Page 17 data hooks: walking directions to the selected place, and places to
 * eat near the traveler that fit the group. Both talk to free open-data
 * services, so both have loading and failure states and never block the map.
 */

import { useEffect, useState } from 'react';
import { PLACES } from '../../data/places';
import type { Place, SurveyResponse, Trip } from '../../data/types';
import { matchReasons } from '../../features/nearby';
import { distanceMeters, type LatLng } from '../../lib/geo';
import { simulateLatency } from '../../services/http';
import { nearbyPlaces } from '../../services/overpass';
import { walkingRoute, type WalkingRoute } from '../../services/routing';
import { estimateRoute, FOOD_CATEGORIES, MAX_WALK_M, type FoodPlace, type RouteOrigin } from './mapData';

/* -------------------------------------------------------------- directions */

export type Directions =
  | { status: 'none' }
  /** Farther than a reasonable walk: we show the distance, not a route. */
  | { status: 'too-far'; straightM: number }
  /** Waiting for the directions service; `preview` is a straight-line estimate to show meanwhile. */
  | { status: 'loading'; straightM: number; preview: WalkingRoute }
  | { status: 'ready'; straightM: number; route: WalkingRoute };

/**
 * Walking directions from `origin` to `target`.
 * `forceEstimate` (the `s=route-error` state) skips the network and returns the
 * straight-line estimate, as if the directions service were down.
 */
export function useWalkingDirections(origin: RouteOrigin | null, target: Place | null, forceEstimate: boolean): Directions {
  const straightM = origin && target ? distanceMeters(origin, target) : 0;
  const tooFar = straightM > MAX_WALK_M;
  // One string that changes whenever the request would change.
  const key =
    origin && target && !tooFar
      ? `${origin.lat.toFixed(5)},${origin.lng.toFixed(5)}>${target.lat.toFixed(5)},${target.lng.toFixed(5)}|${forceEstimate ? 'est' : 'live'}`
      : '';
  const [result, setResult] = useState<{ key: string; route: WalkingRoute } | null>(null);

  useEffect(() => {
    if (!key || !origin || !target) return;
    let alive = true; // ignore answers for a selection the person already left
    (async () => {
      let route: WalkingRoute;
      if (forceEstimate) {
        await simulateLatency(450); // looks like a request that failed
        route = estimateRoute(origin, target, target.name);
      } else {
        route = await walkingRoute(origin, target); // never throws; falls back to an estimate
        // Same numbers as the service's fallback, but with clearer steps ("Head northeast toward …").
        if (route.source === 'estimate') route = estimateRoute(origin, target, target.name);
      }
      if (alive) setResult({ key, route });
    })();
    return () => {
      alive = false;
    };
    // `key` captures everything about origin/target that matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  if (!origin || !target) return { status: 'none' };
  if (tooFar) return { status: 'too-far', straightM };
  if (result && result.key === key) return { status: 'ready', straightM, route: result.route };
  // The free directions service can take a few seconds (or time out), so show
  // a straight-line preview right away instead of an empty map.
  return { status: 'loading', straightM, preview: estimateRoute(origin, target, target.name) };
}

/* --------------------------------------------------------------------- food */

/** How far the food layer looks: bundled sample places vs. a live OpenStreetMap query. */
const SAMPLE_RADIUS_M = 2500;
export const LIVE_FOOD_RADIUS_M = 800;

export interface FoodResult {
  status: 'idle' | 'loading' | 'ready' | 'error';
  /** Places with at least one reason they fit the group, best first. */
  fits: FoodPlace[];
  /** Every place found, nearest first (for "Show all"). */
  all: FoodPlace[];
  retry: () => void;
}

function score(places: Place[], center: LatLng, surveys: SurveyResponse[], names: Record<string, string>): FoodPlace[] {
  return places.map((place) => ({ place, reasons: matchReasons(place, surveys, names), distanceM: distanceMeters(center, place) }));
}

/**
 * Places to eat around `center`, scored against the group's survey answers.
 * The sample trip uses bundled places (always works); other trips ask
 * OpenStreetMap (Overpass), which can be slow or fail.
 */
export function useFoodPlaces(params: {
  trip: Trip;
  center: LatLng | null;
  enabled: boolean;
  surveys: SurveyResponse[];
  names: Record<string, string>;
}): FoodResult {
  const { trip, center, enabled, surveys, names } = params;
  const live = !trip.isSample;
  const centerKey = center ? `${center.lat.toFixed(4)},${center.lng.toFixed(4)}` : '';
  const [attempt, setAttempt] = useState(0);
  const [fetched, setFetched] = useState<{ key: string; status: 'ready' | 'error'; places: Place[] } | null>(null);
  const requestKey = `${trip.id}|${centerKey}|${attempt}`;

  useEffect(() => {
    if (!live || !enabled || !center) return;
    if (fetched?.key === requestKey) return; // already have this answer
    let alive = true;
    nearbyPlaces(center, LIVE_FOOD_RADIUS_M, ['food'], trip.destinations[0]?.name ?? '')
      .then((places) => alive && setFetched({ key: requestKey, status: 'ready', places }))
      .catch(() => alive && setFetched({ key: requestKey, status: 'error', places: [] }));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live, enabled, requestKey]);

  const retry = () => setAttempt((n) => n + 1);
  if (!center) return { status: 'idle', fits: [], all: [], retry };

  let all: FoodPlace[];
  let status: FoodResult['status'];
  // Results we already fetched for this trip and spot (any attempt). We keep
  // returning them while the layer is off, so a place you selected from the
  // food list still resolves after you switch the layer off.
  const previous = fetched && fetched.key.startsWith(`${trip.id}|${centerKey}|`) ? fetched : null;
  if (!live) {
    const nearby = Object.values(PLACES).filter((p) => FOOD_CATEGORIES.includes(p.category) && distanceMeters(center, p) <= SAMPLE_RADIUS_M);
    all = score(nearby, center, surveys, names);
    status = 'ready';
  } else if (previous) {
    all = previous.status === 'ready' ? score(previous.places, center, surveys, names) : [];
    status = !enabled ? 'idle' : previous.key === requestKey ? previous.status : 'loading';
  } else {
    return { status: enabled ? 'loading' : 'idle', fits: [], all: [], retry };
  }

  all.sort((a, b) => a.distanceM - b.distanceM);
  const fits = all
    .filter((f) => f.reasons.length > 0)
    .sort((a, b) => b.reasons.length - a.reasons.length || a.distanceM - b.distanceM)
    .slice(0, 12);
  return { status, fits, all: all.slice(0, 25), retry };
}
