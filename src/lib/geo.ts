/** Small geography helpers (distances, walking estimates, bounding boxes). */

export interface LatLng {
  lat: number;
  lng: number;
}

const EARTH_RADIUS_M = 6_371_000;

/** Straight-line ("as the crow flies") distance in meters — the haversine formula. */
export function distanceMeters(a: LatLng, b: LatLng): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

/** Typical walking pace: ~80 m/min (≈ 3 mph). */
export const WALK_M_PER_MIN = 80;

/**
 * Streets are rarely straight, so a walking route is usually 20–40% longer than
 * the straight line. We use 1.3× when we can't ask a routing service.
 */
export const DETOUR_FACTOR = 1.3;

/** Estimated walking minutes from a straight-line distance (no routing service). */
export function estimateWalkMinutes(straightMeters: number): number {
  return Math.max(1, Math.round((straightMeters * DETOUR_FACTOR) / WALK_M_PER_MIN));
}

/** Rough taxi estimate for longer hops (~25 km/h in a city, +5 min pickup). */
export function estimateTaxiMinutes(straightMeters: number): number {
  return Math.round((straightMeters * DETOUR_FACTOR) / 1000 / 25 * 60) + 5;
}

/** Midpoint of a list of points (used to center maps). */
export function centerOf(points: LatLng[]): LatLng | null {
  if (points.length === 0) return null;
  const lat = points.reduce((s, p) => s + p.lat, 0) / points.length;
  const lng = points.reduce((s, p) => s + p.lng, 0) / points.length;
  return { lat, lng };
}

/** Nudge a point by meters east/north (to place "you are here" slightly off a pin). */
export function offsetMeters(p: LatLng, eastM: number, northM: number): LatLng {
  const dLat = northM / 111_320;
  const dLng = eastM / (111_320 * Math.cos((p.lat * Math.PI) / 180));
  return { lat: p.lat + dLat, lng: p.lng + dLng };
}

/** 500 ft ≈ 152 m: the doc's nearby-alert radius (straight line). */
export const NEARBY_RADIUS_M = 152;
/** The doc's "usually a 5 minute walk" guidance, applied to the walking route. */
export const NEARBY_MAX_WALK_MIN = 5;
