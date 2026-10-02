/**
 * Walking directions from the FOSSGIS OSRM server (routing.openstreetmap.de),
 * the same free service openstreetmap.org uses for its directions. If it's
 * unreachable we fall back to a straight line with an estimated walking time,
 * and the map labels the route "Estimated".
 */

import { distanceMeters, estimateWalkMinutes, type LatLng } from '../lib/geo';
import { getJson } from './http';

export interface RouteStep {
  instruction: string;
  distanceM: number;
}

export interface WalkingRoute {
  /** [lat, lng] pairs for drawing the line. */
  coords: Array<[number, number]>;
  distanceM: number;
  minutes: number;
  steps: RouteStep[];
  source: 'osrm' | 'estimate';
}

interface OsrmStep {
  distance: number;
  name: string;
  maneuver: { type: string; modifier?: string };
}

interface OsrmResponse {
  code: string;
  routes: Array<{
    distance: number;
    duration: number;
    geometry: { coordinates: Array<[number, number]> };
    legs: Array<{ steps: OsrmStep[] }>;
  }>;
}

function describe(step: OsrmStep, isFirst: boolean, isLast: boolean): string {
  const street = step.name ? ` onto ${step.name}` : '';
  if (isFirst) return step.name ? `Head out on ${step.name}` : 'Head out';
  if (isLast || step.maneuver.type === 'arrive') return 'Arrive at your destination';
  const mod = step.maneuver.modifier ?? '';
  switch (step.maneuver.type) {
    case 'turn':
    case 'end of road':
    case 'fork':
      return `${mod.includes('left') ? 'Turn left' : mod.includes('right') ? 'Turn right' : 'Continue'}${street}`;
    case 'new name':
    case 'continue':
      return `Continue${street}`;
    case 'roundabout':
    case 'rotary':
      return `Take the roundabout${street}`;
    default:
      return `Continue${street}`;
  }
}

/** Walking route between two points. Never throws — falls back to an estimate. */
export async function walkingRoute(from: LatLng, to: LatLng): Promise<WalkingRoute> {
  const straight = distanceMeters(from, to);
  const estimate: WalkingRoute = {
    coords: [
      [from.lat, from.lng],
      [to.lat, to.lng],
    ],
    distanceM: Math.round(straight * 1.3),
    minutes: estimateWalkMinutes(straight),
    steps: [{ instruction: 'Walk toward the destination (estimated route)', distanceM: Math.round(straight * 1.3) }],
    source: 'estimate',
  };
  // Very long hops aren't walks; don't hammer the router for them.
  if (straight > 15_000) return estimate;
  try {
    const url =
      `https://routing.openstreetmap.de/routed-foot/route/v1/driving/` +
      `${from.lng.toFixed(6)},${from.lat.toFixed(6)};${to.lng.toFixed(6)},${to.lat.toFixed(6)}` +
      `?overview=full&geometries=geojson&steps=true`;
    const data = await getJson<OsrmResponse>(url, { timeoutMs: 7000 });
    const r = data.routes?.[0];
    if (data.code !== 'Ok' || !r) return estimate;
    const steps = r.legs[0]?.steps ?? [];
    return {
      coords: r.geometry.coordinates.map(([lng, lat]) => [lat, lng]),
      distanceM: Math.round(r.distance),
      // OSRM's foot profile assumes ~5 km/h; round up to whole minutes.
      minutes: Math.max(1, Math.round(r.duration / 60)),
      steps: steps
        .filter((s) => s.distance > 0 || s.maneuver.type === 'arrive')
        .map((s, i, arr) => ({ instruction: describe(s, i === 0, i === arr.length - 1), distanceM: Math.round(s.distance) })),
      source: 'osrm',
    };
  } catch {
    return estimate;
  }
}
