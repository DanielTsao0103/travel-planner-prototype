/**
 * Live place + city search using Photon (photon.komoot.io), a free
 * OpenStreetMap-based geocoder that needs no API key. Results are converted
 * into our `Place` / `Destination` types. If Photon is unreachable we fall back
 * to the bundled catalog / popular-city list so forms still work.
 */

import { PLACES } from '../data/places';
import { POPULAR_CITIES } from '../data/destinations';
import type { BusyProfile, Destination, Place, PlaceCategory, PlaceTag } from '../data/types';
import type { LatLng } from '../lib/geo';
import { distanceMeters } from '../lib/geo';
import { getJson } from './http';

interface PhotonFeature {
  geometry: { coordinates: [number, number] };
  properties: {
    osm_id?: number;
    osm_type?: string;
    osm_key?: string;
    osm_value?: string;
    type?: string;
    name?: string;
    street?: string;
    housenumber?: string;
    district?: string;
    locality?: string;
    city?: string;
    county?: string;
    state?: string;
    country?: string;
  };
}

interface PhotonResponse {
  features: PhotonFeature[];
}

const PHOTON = 'https://photon.komoot.io/api/';

/* ----------------------------------------------------------------- cities */

/** City/town search for Page 6's destination field. */
export async function searchCities(query: string): Promise<{ results: Destination[]; source: 'live' | 'offline' }> {
  const q = query.trim();
  if (q.length < 2) return { results: [], source: 'live' };
  try {
    const url = `${PHOTON}?q=${encodeURIComponent(q)}&limit=8&lang=en&layer=city&layer=locality&layer=state&layer=country`;
    const data = await getJson<PhotonResponse>(url, { timeoutMs: 6000 });
    const seen = new Set<string>();
    const results: Destination[] = [];
    for (const f of data.features) {
      const p = f.properties;
      if (!p.name) continue;
      const key = `${p.name}|${p.country}`;
      if (seen.has(key)) continue;
      seen.add(key);
      results.push({
        id: `osm-${p.osm_type ?? 'x'}${p.osm_id ?? Math.round(f.geometry.coordinates[0] * 1e4)}`,
        name: p.name,
        country: p.type === 'country' ? undefined : [p.state, p.country].filter(Boolean).slice(-1)[0],
        lat: f.geometry.coordinates[1],
        lng: f.geometry.coordinates[0],
      });
    }
    return { results: results.slice(0, 6), source: 'live' };
  } catch {
    const needle = q.toLowerCase();
    return {
      results: POPULAR_CITIES.filter((c) => c.name.toLowerCase().includes(needle) || c.country?.toLowerCase().includes(needle)).slice(0, 6),
      source: 'offline',
    };
  }
}

/* ----------------------------------------------------------------- places */

function categoryFor(key = '', value = ''): { category: PlaceCategory; busy: BusyProfile } {
  if (key === 'tourism') {
    if (value === 'museum' || value === 'gallery') return { category: 'museum', busy: 'museum' };
    if (value === 'viewpoint') return { category: 'viewpoint', busy: 'viewpoint' };
    if (['hotel', 'hostel', 'guest_house', 'apartment', 'motel'].includes(value)) return { category: 'lodging', busy: 'lodging' };
    if (value === 'zoo' || value === 'theme_park' || value === 'aquarium') return { category: 'landmark', busy: 'landmark' };
    return { category: 'landmark', busy: 'landmark' };
  }
  if (key === 'amenity') {
    if (['restaurant', 'fast_food', 'food_court'].includes(value)) return { category: 'restaurant', busy: 'restaurant' };
    if (['cafe', 'ice_cream'].includes(value)) return { category: 'cafe', busy: 'cafe' };
    if (['bar', 'pub', 'nightclub', 'biergarten'].includes(value)) return { category: 'bar', busy: 'bar' };
    if (value === 'marketplace') return { category: 'market', busy: 'market' };
    if (['theatre', 'cinema', 'arts_centre'].includes(value)) return { category: 'other', busy: 'bar' };
    if (value === 'place_of_worship') return { category: 'landmark', busy: 'museum' };
  }
  if (key === 'historic') return { category: 'landmark', busy: 'landmark' };
  if (key === 'leisure' || key === 'natural') return { category: 'nature', busy: 'nature' };
  if (key === 'shop') return { category: 'shopping', busy: 'market' };
  if (key === 'railway' || key === 'public_transport' || key === 'aeroway' || key === 'highway') return { category: 'transit', busy: 'transit' };
  return { category: 'other', busy: 'landmark' };
}

function tagsFor(key = '', value = ''): PlaceTag[] {
  if (key === 'historic' || value === 'castle' || value === 'monument') return ['historic'];
  if (value === 'museum' || value === 'gallery' || value === 'arts_centre') return ['cultural', 'art'];
  if (key === 'leisure' || key === 'natural') return ['nature'];
  if (value === 'viewpoint') return ['view'];
  return [];
}

/** Convert a Photon result into a Place snapshot. */
function toPlace(f: PhotonFeature): Place | null {
  const p = f.properties;
  if (!p.name) return null;
  const { category, busy } = categoryFor(p.osm_key, p.osm_value);
  const area = [p.district ?? p.locality, p.street].filter(Boolean)[0] ?? p.city ?? p.county ?? '';
  return {
    id: `osm-${p.osm_type ?? 'x'}${p.osm_id ?? Date.now()}`,
    name: p.name,
    area,
    city: p.city ?? p.county ?? p.state ?? '',
    lat: f.geometry.coordinates[1],
    lng: f.geometry.coordinates[0],
    category,
    tags: tagsFor(p.osm_key, p.osm_value),
    stepFree: 'unknown',
    ticketRequired: false,
    busyProfile: busy,
    source: 'osm',
  };
}

/**
 * Search places near a trip's destinations (Page 7's "Where").
 * Bundled places that match are listed first so the sample trip works offline.
 */
export async function searchPlaces(query: string, near: LatLng[]): Promise<{ results: Place[]; source: 'live' | 'offline' }> {
  const q = query.trim();
  if (q.length < 2) return { results: [], source: 'live' };
  const needle = q.toLowerCase();
  const nearest = (pl: { lat: number; lng: number }) => Math.min(...near.map((n) => distanceMeters(n, pl)), Infinity);
  const bundled = Object.values(PLACES)
    .filter((pl) => (pl.name.toLowerCase().includes(needle) || pl.area.toLowerCase().includes(needle)) && (near.length === 0 || nearest(pl) < 60_000))
    .slice(0, 4);

  try {
    const bias = near[0];
    const url = `${PHOTON}?q=${encodeURIComponent(q)}&limit=10&lang=en${bias ? `&lat=${bias.lat}&lon=${bias.lng}` : ''}`;
    const data = await getJson<PhotonResponse>(url, { timeoutMs: 6000 });
    const live = data.features
      .map(toPlace)
      .filter((pl): pl is Place => !!pl)
      // Keep results within ~80 km of a trip destination (when we know them).
      .filter((pl) => near.length === 0 || nearest(pl) < 80_000)
      .filter((pl) => !bundled.some((b) => b.name === pl.name));
    return { results: [...bundled, ...live].slice(0, 8), source: 'live' };
  } catch {
    return { results: bundled, source: 'offline' };
  }
}

/** A typed-in place we couldn't find (or the user didn't pick from the list). */
export function customPlace(name: string, near: LatLng | undefined, city = ''): Place {
  return {
    id: `custom-${Date.now().toString(36)}`,
    name: name.trim(),
    area: city,
    city,
    lat: near?.lat ?? 0,
    lng: near?.lng ?? 0,
    category: 'other',
    tags: [],
    stepFree: 'unknown',
    ticketRequired: false,
    busyProfile: 'landmark',
    source: 'custom',
  };
}
