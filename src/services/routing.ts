/**
 * Walking directions from free OpenStreetMap routing services (no API key).
 *
 * Order of attempts:
 *  1. Bundled routes for the sample trip's key demo walks (always available).
 *  2. FOSSGIS Valhalla (valhalla1.openstreetmap.de), pedestrian costing, which
 *     also gives readable turn-by-turn instructions.
 *  3. FOSSGIS OSRM (routing.openstreetmap.de), the service openstreetmap.org uses.
 *  4. A straight-line estimate. The map draws it dashed and labels it "Estimated".
 * Free services can be slow or down, so every attempt has a short timeout and
 * this function never throws.
 */

import { BUNDLED_ROUTES } from '../data/bundledRoutes';
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
  source: 'bundled' | 'valhalla' | 'osrm' | 'estimate';
}

/* ------------------------------------------------------------- bundled */

/** A pre-computed sample-trip route whose endpoints match this request, if any. */
function bundledRoute(from: LatLng, to: LatLng): WalkingRoute | null {
  for (const r of Object.values(BUNDLED_ROUTES)) {
    const start = { lat: r.from[0], lng: r.from[1] };
    const end = { lat: r.to[0], lng: r.to[1] };
    if (distanceMeters(from, start) < 80 && distanceMeters(to, end) < 40) {
      return { coords: r.coords, distanceM: r.distanceM, minutes: r.minutes, steps: r.steps, source: 'bundled' };
    }
  }
  return null;
}

/* ------------------------------------------------------------ Valhalla */

interface ValhallaResponse {
  trip?: {
    summary: { length: number; time: number };
    legs: Array<{ shape: string; maneuvers: Array<{ instruction: string; length: number }> }>;
  };
}

/** Decode Valhalla's "polyline6" shape string into [lat, lng] pairs. */
function decodePolyline6(shape: string): Array<[number, number]> {
  const coords: Array<[number, number]> = [];
  let index = 0;
  let lat = 0;
  let lng = 0;
  while (index < shape.length) {
    for (let which = 0; which < 2; which++) {
      let shift = 0;
      let result = 0;
      let byte: number;
      do {
        byte = shape.charCodeAt(index++) - 63;
        result |= (byte & 0x1f) << shift;
        shift += 5;
      } while (byte >= 0x20);
      const delta = result & 1 ? ~(result >> 1) : result >> 1;
      if (which === 0) lat += delta;
      else lng += delta;
    }
    coords.push([lat / 1e6, lng / 1e6]);
  }
  return coords;
}

async function valhallaRoute(from: LatLng, to: LatLng): Promise<WalkingRoute | null> {
  const body = {
    locations: [
      { lat: from.lat, lon: from.lng },
      { lat: to.lat, lon: to.lng },
    ],
    costing: 'pedestrian',
    directions_options: { units: 'kilometers' },
  };
  const url = `https://valhalla1.openstreetmap.de/route?json=${encodeURIComponent(JSON.stringify(body))}`;
  const data = await getJson<ValhallaResponse>(url, { timeoutMs: 6000 });
  const leg = data.trip?.legs?.[0];
  if (!data.trip || !leg) return null;
  return {
    coords: decodePolyline6(leg.shape),
    distanceM: Math.round(data.trip.summary.length * 1000),
    minutes: Math.max(1, Math.round(data.trip.summary.time / 60)),
    steps: leg.maneuvers.map((m) => ({ instruction: m.instruction, distanceM: Math.round(m.length * 1000) })),
    source: 'valhalla',
  };
}

/* ---------------------------------------------------------------- OSRM */

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
    case 'roundabout':
    case 'rotary':
      return `Take the roundabout${street}`;
    default:
      return `Continue${street}`;
  }
}

async function osrmRoute(from: LatLng, to: LatLng): Promise<WalkingRoute | null> {
  const url =
    `https://routing.openstreetmap.de/routed-foot/route/v1/driving/` +
    `${from.lng.toFixed(6)},${from.lat.toFixed(6)};${to.lng.toFixed(6)},${to.lat.toFixed(6)}` +
    `?overview=full&geometries=geojson&steps=true`;
  const data = await getJson<OsrmResponse>(url, { timeoutMs: 5000 });
  const r = data.routes?.[0];
  if (data.code !== 'Ok' || !r) return null;
  const steps = r.legs[0]?.steps ?? [];
  return {
    coords: r.geometry.coordinates.map(([lng, lat]) => [lat, lng] as [number, number]),
    distanceM: Math.round(r.distance),
    minutes: Math.max(1, Math.round(r.duration / 60)),
    steps: steps
      .filter((s) => s.distance > 0 || s.maneuver.type === 'arrive')
      .map((s, i, arr) => ({ instruction: describe(s, i === 0, i === arr.length - 1), distanceM: Math.round(s.distance) })),
    source: 'osrm',
  };
}

/* ------------------------------------------------------------- public */

/** Walking route between two points. Never throws: falls back to an estimate. */
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

  const bundled = bundledRoute(from, to);
  if (bundled) return bundled;
  // Very long hops aren't walks; don't hammer the routers for them.
  if (straight > 15_000) return estimate;

  for (const attempt of [valhallaRoute, osrmRoute]) {
    try {
      const route = await attempt(from, to);
      if (route) return route;
    } catch {
      // Try the next service.
    }
  }
  return estimate;
}
