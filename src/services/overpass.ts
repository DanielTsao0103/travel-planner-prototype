/**
 * Nearby places from OpenStreetMap via the Overpass API (free, no key).
 * Used for live suggestions (Page 9) and nearby matches (Page 16) on trips
 * the tester creates. OSM tags tell us useful facts like vegetarian or
 * gluten-free menus and wheelchair access, which we score against the group's
 * survey answers.
 */

import type { Accessibility, BusyProfile, Place, PlaceCategory, PlaceTag } from '../data/types';
import type { LatLng } from '../lib/geo';
import { getJson } from './http';

interface OverpassElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

interface OverpassResponse {
  elements: OverpassElement[];
}

const ENDPOINT = 'https://overpass-api.de/api/interpreter';

export type PoiKind = 'sights' | 'food' | 'nature';

function buildQuery(center: LatLng, radiusM: number, kinds: PoiKind[]): string {
  const at = `around:${Math.round(radiusM)},${center.lat.toFixed(5)},${center.lng.toFixed(5)}`;
  const parts: string[] = [];
  if (kinds.includes('sights')) {
    parts.push(`nwr(${at})["tourism"~"^(museum|attraction|viewpoint|gallery)$"]["name"];`);
    parts.push(`nwr(${at})["historic"~"^(monument|castle|memorial|ruins|archaeological_site|fort|city_gate)$"]["name"];`);
  }
  if (kinds.includes('food')) parts.push(`nwr(${at})["amenity"~"^(restaurant|cafe|ice_cream|marketplace)$"]["name"];`);
  if (kinds.includes('nature')) parts.push(`nwr(${at})["leisure"~"^(park|garden)$"]["name"];`);
  return `[out:json][timeout:12];(${parts.join('')});out center 80;`;
}

function accessibility(tags: Record<string, string>): Accessibility {
  const w = tags.wheelchair;
  if (w === 'yes' || w === 'designated') return 'yes';
  if (w === 'limited') return 'partial';
  if (w === 'no') return 'no';
  return 'unknown';
}

function classify(tags: Record<string, string>): { category: PlaceCategory; busy: BusyProfile; placeTags: PlaceTag[] } {
  const t: PlaceTag[] = [];
  const v = (k: string) => tags[k] ?? '';
  if (/^(yes|only)$/.test(v('diet:vegetarian'))) t.push('vegetarian-friendly');
  if (/^(yes|only)$/.test(v('diet:vegan'))) t.push('vegan-options');
  if (v('diet:gluten_free') === 'only') t.push('gluten-free-dedicated');
  else if (v('diet:gluten_free') === 'yes') t.push('gluten-free-options');
  if (v('outdoor_seating') === 'yes') t.push('outdoor-seating');

  if (tags.amenity === 'restaurant') return { category: 'restaurant', busy: 'restaurant', placeTags: t };
  if (tags.amenity === 'cafe' || tags.amenity === 'ice_cream') return { category: 'cafe', busy: 'cafe', placeTags: t };
  if (tags.amenity === 'marketplace') return { category: 'market', busy: 'market', placeTags: [...t, 'local-cuisine'] };
  if (tags.tourism === 'museum' || tags.tourism === 'gallery') return { category: 'museum', busy: 'museum', placeTags: [...t, 'cultural', 'art'] };
  if (tags.tourism === 'viewpoint') return { category: 'viewpoint', busy: 'viewpoint', placeTags: [...t, 'view'] };
  if (tags.historic) return { category: 'landmark', busy: 'landmark', placeTags: [...t, 'historic'] };
  if (tags.leisure) return { category: 'nature', busy: 'nature', placeTags: [...t, 'nature'] };
  return { category: 'landmark', busy: 'landmark', placeTags: [...t, 'cultural'] };
}

/** Prefer an English name; skip places whose only name isn't in Latin script if `latinOnly`. */
function displayName(tags: Record<string, string>): string | null {
  return tags['name:en'] ?? tags.name ?? null;
}

const LATIN = /^[\p{Script=Latin}\p{N}\p{P}\p{Zs}'’&-]+$/u;

/** Find named places of the given kinds around a point. Throws on network failure. */
export async function nearbyPlaces(center: LatLng, radiusM: number, kinds: PoiKind[], city = ''): Promise<Place[]> {
  const query = buildQuery(center, radiusM, kinds);
  const data = await getJson<OverpassResponse>(`${ENDPOINT}?data=${encodeURIComponent(query)}`, { timeoutMs: 15000 });
  const places: Place[] = [];
  const seen = new Set<string>();
  for (const el of data.elements) {
    const tags = el.tags ?? {};
    const name = displayName(tags);
    const lat = el.lat ?? el.center?.lat;
    const lng = el.lon ?? el.center?.lon;
    if (!name || lat === undefined || lng === undefined || seen.has(name)) continue;
    seen.add(name);
    const { category, busy, placeTags } = classify(tags);
    places.push({
      id: `osm-${el.type[0]}${el.id}`,
      name,
      area: tags['addr:street'] ?? tags['addr:suburb'] ?? '',
      city,
      lat,
      lng,
      category,
      tags: placeTags,
      stepFree: accessibility(tags),
      ticketRequired: tags.fee === 'yes',
      busyProfile: busy,
      blurb: tags.description ?? tags.cuisine?.replace(/;/g, ', ').replace(/_/g, ' '),
      source: 'osm',
    });
  }
  // Names in Latin script first (our testers read English), then the rest.
  return places.sort((a, b) => Number(!LATIN.test(a.name)) - Number(!LATIN.test(b.name)));
}
