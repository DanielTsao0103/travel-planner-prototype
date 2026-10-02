/**
 * Page 17 data helpers: turn the trip's state into map "items" (one pin + one
 * list row each), resolve the `to=` deep link to a place, choose where a walk
 * starts, and build a straight-line route when directions aren't available.
 *
 * Everything here is a pure function (no React, no network), so the page
 * component stays focused on layout and interaction.
 */

import type { MarkerKind } from '../../components/domain/MapView';
import { eventLabel } from '../../components/domain/EventItem';
import { PLACES } from '../../data/places';
import type { AppState, ISODate, Place, PlaceCategory, Suggestion, Trip, TripEvent } from '../../data/types';
import { formatTime, minToTime, timeToMin } from '../../lib/dates';
import { DETOUR_FACTOR, distanceMeters, estimateWalkMinutes, type LatLng } from '../../lib/geo';
import type { WalkingRoute } from '../../services/routing';
import { decisionFor, eventsOn, tripEvents, tripSuggestions, type SimLocation } from '../../store/selectors';

/* ------------------------------------------------------------------ layers */

/** The map's place layers (chips/toggles). */
export type LayerId = 'today' | 'trip' | 'ideas' | 'food';

export const LAYER_ORDER: LayerId[] = ['today', 'trip', 'ideas', 'food'];

export const LAYER_LABEL: Record<LayerId, string> = {
  today: 'Today’s plan',
  trip: 'Whole trip',
  ideas: 'Ideas',
  food: 'Food that fits the group',
};

/** Place categories that count as "somewhere to eat" for the food layer. */
export const FOOD_CATEGORIES: PlaceCategory[] = ['restaurant', 'cafe', 'market', 'bar'];

/** One thing on the map: a pin plus a row in the place list. */
export interface MapItem {
  /** Stable id used for the pin and the `to=` URL param (event, suggestion, or place id). */
  id: string;
  layer: LayerId;
  place: Place;
  /** Event title ("Train to Sintra") or the place name. */
  title: string;
  kind: MarkerKind;
  /** Order in today's plan (drawn inside the pin). */
  number?: number;
  event?: TripEvent;
  suggestion?: Suggestion;
  /** Why the place fits the group ("Nut-free kitchen · Sam"). */
  reasons?: string[];
}

/** A place to eat plus the reasons it fits the group. */
export interface FoodPlace {
  place: Place;
  reasons: string[];
  /** Straight-line meters from where the search was centered. */
  distanceM: number;
}

function eventItem(e: TripEvent, layer: LayerId, number?: number): MapItem {
  return { id: e.id, layer, place: e.place, title: eventLabel(e), kind: 'event', number, event: e };
}

/**
 * Build the items for the layers that are switched on, in priority order
 * (today → whole trip → ideas → food). A place shows up once: if a food match
 * is already an event or an idea, its "fits the group" reasons are merged into
 * that item instead of adding a second pin on top of it.
 */
export function buildItems(params: {
  state: AppState;
  trip: Trip;
  layers: Set<LayerId>;
  /** Demo "today" when the trip is happening, else null (no Today layer). */
  activeDay: ISODate | null;
  food: FoodPlace[];
}): MapItem[] {
  const { state, trip, layers, activeDay, food } = params;
  const items: MapItem[] = [];

  const showToday = layers.has('today') && !!activeDay;
  if (showToday) {
    eventsOn(state, trip.id, activeDay!).forEach((e, i) => items.push(eventItem(e, 'today', i + 1)));
  }
  if (layers.has('trip')) {
    for (const e of tripEvents(state, trip.id)) {
      if (showToday && e.date === activeDay) continue; // already numbered above
      items.push(eventItem(e, 'trip'));
    }
  }

  const byPlace = new Map<string, MapItem>();
  for (const it of items) if (!byPlace.has(it.place.id)) byPlace.set(it.place.id, it);

  if (layers.has('ideas')) {
    for (const s of tripSuggestions(state, trip.id)) {
      if (decisionFor(state, trip.id, s.id)) continue; // already added or declined
      if (byPlace.has(s.place.id)) continue;
      const it: MapItem = { id: s.id, layer: 'ideas', place: s.place, title: s.place.name, kind: 'suggestion', suggestion: s };
      items.push(it);
      byPlace.set(s.place.id, it);
    }
  }

  if (layers.has('food')) {
    for (const f of food) {
      const existing = byPlace.get(f.place.id);
      if (existing) {
        existing.reasons = existing.reasons ?? f.reasons;
        continue;
      }
      const it: MapItem = { id: f.place.id, layer: 'food', place: f.place, title: f.place.name, kind: 'place', reasons: f.reasons };
      items.push(it);
      byPlace.set(f.place.id, it);
    }
  }
  return items;
}

/** Case- and accent-insensitive text ("jeronimos" finds "Jerónimos"). */
export function fold(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

/** Does an item match the search box? Checks the name, title, area, and category. */
export function matchesSearch(item: MapItem, query: string): boolean {
  const q = fold(query.trim());
  if (!q) return true;
  const hay = fold([item.title, item.place.name, item.place.area, item.place.city, item.place.category].join(' '));
  return q.split(/\s+/).every((word) => hay.includes(word));
}

/* ------------------------------------------------------------------ camera */

/** "Around you" = places within this distance (a ~25-minute walk). */
const AROUND_YOU_M = 2000;
/** Places this close to the trip's first city count as "that city". */
const CITY_RADIUS_M = 12_000;

/**
 * Which points the camera should frame when nothing is selected.
 *  - During the trip: you plus the places around you (the doc's "map for
 *    around them"), with at least the two nearest places so it's never empty.
 *  - Otherwise: the places in the trip's first city. A whole trip across
 *    cities (Lisbon → Sintra → Porto) would be zoomed out too far to read;
 *    the list still shows everything, and pinch/scroll zooms out.
 */
export function framePoints(points: LatLng[], you: LatLng | null, anchor: LatLng | null): LatLng[] {
  if (you) {
    const byDistance = points.map((p) => ({ p, d: distanceMeters(you, p) })).sort((a, b) => a.d - b.d);
    const close = byDistance.filter((x) => x.d <= AROUND_YOU_M);
    const chosen = close.length >= 2 ? close : byDistance.slice(0, 2).filter((x) => x.d <= 15_000);
    return [you, ...chosen.map((x) => x.p)];
  }
  if (anchor) {
    const inCity = points.filter((p) => distanceMeters(anchor, p) <= CITY_RADIUS_M);
    if (inCity.length) return inCity;
  }
  return points;
}

/* --------------------------------------------------------------- deep link */

/**
 * Resolve `to=` to an item. It may be an event id, a suggestion id, a bundled
 * place id (e.g. "padaria-celeste"), or a live place already loaded on the map.
 * Items that are visible win, so the pin and list row stay in sync.
 */
export function resolveTarget(to: string, items: MapItem[], state: AppState, trip: Trip, food: FoodPlace[]): MapItem | null {
  const visible = items.find((i) => i.id === to) ?? items.find((i) => i.place.id === to);
  if (visible) return visible;

  const events = tripEvents(state, trip.id);
  const ev = events.find((e) => e.id === to) ?? events.find((e) => e.place.id === to);
  if (ev) return eventItem(ev, 'trip');

  const suggestion = tripSuggestions(state, trip.id).find((s) => s.id === to || s.place.id === to);
  if (suggestion) return { id: suggestion.id, layer: 'ideas', place: suggestion.place, title: suggestion.place.name, kind: 'suggestion', suggestion };

  const live = food.find((f) => f.place.id === to);
  const place = PLACES[to] ?? live?.place;
  if (place) {
    const isFood = FOOD_CATEGORIES.includes(place.category);
    return { id: place.id, layer: isFood ? 'food' : 'trip', place, title: place.name, kind: 'place', reasons: live?.reasons };
  }
  return null;
}

/* ----------------------------------------------------------------- walking */

/** Longest walk we draw directions for (~75 minutes). Farther = "too far to walk". */
export const MAX_WALK_M = 6000;

export interface RouteOrigin extends LatLng {
  /** "Near Time Out Market", "Casa Azulejo Alfama"… */
  label: string;
  /** Where the walk starts: the traveler (simulated), their lodging, another stop, or the town center. */
  kind: 'you' | 'lodging' | 'place' | 'center';
}

/**
 * Where directions start. During the trip that's the traveler's simulated
 * location. Before or after it, we start from the trip's lodging nearest the
 * destination, else the nearest other planned stop, else the town center.
 */
export function routeOriginFor(target: Place, you: SimLocation | null, events: TripEvent[], trip: Trip): RouteOrigin | null {
  if (you) return { lat: you.lat, lng: you.lng, label: you.label, kind: 'you' };

  const nearest = <T extends LatLng>(list: T[]): T | undefined =>
    list
      .map((p) => ({ p, d: distanceMeters(p, target) }))
      .filter((x) => x.d <= MAX_WALK_M)
      .sort((a, b) => a.d - b.d)[0]?.p;

  const lodging = nearest(events.filter((e) => e.place.category === 'lodging' && e.place.id !== target.id).map((e) => e.place));
  if (lodging) return { lat: lodging.lat, lng: lodging.lng, label: lodging.name, kind: 'lodging' };

  const stop = nearest(events.filter((e) => e.place.id !== target.id).map((e) => e.place));
  if (stop) return { lat: stop.lat, lng: stop.lng, label: stop.name, kind: 'place' };

  const town = nearest(trip.destinations);
  if (town) return { lat: town.lat, lng: town.lng, label: `${town.name} town center`, kind: 'center' };
  return null;
}

const COMPASS = ['north', 'northeast', 'east', 'southeast', 'south', 'southwest', 'west', 'northwest'];

/** Compass direction from a to b ("northeast"), for the estimated route's step. */
export function compassDirection(a: LatLng, b: LatLng): string {
  const rad = (d: number) => (d * Math.PI) / 180;
  const y = Math.sin(rad(b.lng - a.lng)) * Math.cos(rad(b.lat));
  const x = Math.cos(rad(a.lat)) * Math.sin(rad(b.lat)) - Math.sin(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.cos(rad(b.lng - a.lng));
  const bearing = ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
  return COMPASS[Math.round(bearing / 45) % 8];
}

/**
 * A straight-line "route" with an estimated walking time — what we show when
 * the directions service is unavailable (and what `s=route-error` forces).
 * Mirrors the fallback in services/routing.ts, with friendlier steps.
 */
export function estimateRoute(from: LatLng, to: LatLng, placeName: string): WalkingRoute {
  const straight = distanceMeters(from, to);
  const walkM = Math.round(straight * DETOUR_FACTOR);
  return {
    coords: [
      [from.lat, from.lng],
      [to.lat, to.lng],
    ],
    distanceM: walkM,
    minutes: estimateWalkMinutes(straight),
    steps: [
      { instruction: `Head ${compassDirection(from, to)} toward ${placeName}`, distanceM: walkM },
      { instruction: `Arrive at ${placeName}`, distanceM: 0 },
    ],
    source: 'estimate',
  };
}

/**
 * Walking routes start and end on the nearest street, a few meters from the
 * actual dot and pin. Add those end points so the line visibly connects them.
 */
export function connectRoute(coords: Array<[number, number]>, from: LatLng, to: LatLng): Array<[number, number]> {
  if (coords.length < 2) return coords;
  const out = [...coords];
  const [fLat, fLng] = out[0];
  const [tLat, tLng] = out[out.length - 1];
  if (distanceMeters(from, { lat: fLat, lng: fLng }) > 3) out.unshift([from.lat, from.lng]);
  if (distanceMeters(to, { lat: tLat, lng: tLng }) > 3) out.push([to.lat, to.lng]);
  return out;
}

/** "2:24 PM": the demo clock plus a walk. */
export function arrivalTime(nowTime: string, minutes: number): string {
  return formatTime(minToTime(timeToMin(nowTime) + minutes));
}

/** The next 5-minute mark strictly after now (14:20 → 14:25, 14:22 → 14:25). */
export function nextFiveMinuteMark(nowTime: string): string {
  const m = timeToMin(nowTime);
  return minToTime(Math.floor(m / 5) * 5 + 5);
}

/**
 * External Google Maps directions link (a plain URL, no API key). We never
 * claim an embedded Google integration; this just opens google.com in a new tab.
 */
export function googleMapsUrl(from: LatLng, to: LatLng, walking: boolean): string {
  // Coordinates are plain numbers, so they're safe to put in the URL as-is.
  const origin = `${from.lat.toFixed(6)},${from.lng.toFixed(6)}`;
  const destination = `${to.lat.toFixed(6)},${to.lng.toFixed(6)}`;
  return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}${walking ? '&travelmode=walking' : ''}`;
}
