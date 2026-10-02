/**
 * Nearby places for live suggestions (Page 9), nearby matches (Page 16), and
 * the map's food layer (Page 17) on trips the tester creates. Free, no keys.
 *
 * Three sources, so one outage doesn't empty the page:
 *  - OpenStreetMap via Overpass: the richest data (vegetarian / gluten-free menus,
 *    wheelchair access), but the public server is often overloaded.
 *  - Wikipedia's nearby-articles search: notable sights, museums, and parks,
 *    each with a real photo and a one-line description. Fast and reliable.
 *  - Photon (OpenStreetMap search): restaurants and cafés when Overpass is down.
 * Results are merged (same name = same place) and sorted by distance.
 */

import type { Accessibility, BusyProfile, Place, PlaceCategory, PlaceTag } from '../data/types';
import { distanceMeters, type LatLng } from '../lib/geo';
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

/* ------------------------------------------------------------ Overpass */

function buildQuery(center: LatLng, radiusM: number, kinds: PoiKind[]): string {
  const at = `around:${Math.round(radiusM)},${center.lat.toFixed(5)},${center.lng.toFixed(5)}`;
  const parts: string[] = [];
  if (kinds.includes('sights')) {
    parts.push(`nwr(${at})["tourism"~"^(museum|attraction|viewpoint|gallery)$"]["name"];`);
    parts.push(`nwr(${at})["historic"~"^(monument|castle|memorial|ruins|archaeological_site|fort|city_gate)$"]["name"];`);
  }
  if (kinds.includes('food')) parts.push(`nwr(${at})["amenity"~"^(restaurant|cafe|ice_cream|marketplace)$"]["name"];`);
  if (kinds.includes('nature')) parts.push(`nwr(${at})["leisure"~"^(park|garden)$"]["name"];`);
  return `[out:json][timeout:10];(${parts.join('')});out center 80;`;
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

/** Prefer an English name. */
function displayName(tags: Record<string, string>): string | null {
  return tags['name:en'] ?? tags.name ?? null;
}

/** When the public Overpass server fails, skip it for a couple of minutes instead of waiting on it again. */
let overpassDownUntil = 0;

async function overpassPlaces(center: LatLng, radiusM: number, kinds: PoiKind[], city: string): Promise<Place[]> {
  if (Date.now() < overpassDownUntil) throw new Error('Overpass recently unavailable');
  const query = buildQuery(center, radiusM, kinds);
  let data: OverpassResponse;
  try {
    data = await getJson<OverpassResponse>(`${ENDPOINT}?data=${encodeURIComponent(query)}`, { timeoutMs: 9000 });
  } catch (err) {
    overpassDownUntil = Date.now() + 120_000;
    throw err;
  }
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
      name: tidyName(name),
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
      // Wikimedia links let PlacePhoto show a real photo of this exact place.
      refs:
        tags.wikidata || tags.wikipedia || tags.wikimedia_commons || tags.image
          ? { wikidata: tags.wikidata, wikipedia: tags.wikipedia, commons: tags.wikimedia_commons, image: tags.image }
          : undefined,
    });
  }
  return places;
}

/* ----------------------------------------------------------- Wikipedia */

interface WikiNearbyResponse {
  query?: {
    pages?: Record<
      string,
      {
        pageid: number;
        title: string;
        index?: number;
        description?: string;
        coordinates?: Array<{ lat: number; lon: number }>;
        thumbnail?: { source: string; width: number; height: number };
      }
    >;
  };
}

/** Articles that aren't places to visit (towns, schools, stations, roads, people…). */
const NOT_A_SIGHT =
  /\b(city|town|village|hamlet|municipality|county|census|prefecture|province|state of|neighbou?rhood|ward|suburb|human settlement|university|college|school|academy|station|airport|airline|hospital|clinic|company|corporation|brand|organi[sz]ation|highway|road|street|avenue|railway|rail line|bus|subway|metro|tram line|power|dam|bank|hotel|apartment|office|tower block|skyscraper|electoral|constituency|politician|person|band|album|film|novel|cemetery)\b/i;

/** Articles about events, not places (battles, sieges, fires…), or that start with a year. */
const AN_EVENT =
  /\b(siege|battle|rebellion|war|conflict|incident|massacre|attack|uprising|revolt|riot|treaty|bombing|assassination|earthquake|flood|disaster|election|clan|era|period|dynasty|emperor|shogun|coup|fire of|disestablished|former)\b|^\d{3,4}\b|\bin \d{3,4}\b/i;

/** "cafe musch" → "Cafe Musch" (some OpenStreetMap names are all lowercase). */
export function tidyName(name: string): string {
  return name === name.toLowerCase() ? name.replace(/(^|\s)(\p{L})/gu, (_m, sp: string, ch: string) => sp + ch.toUpperCase()) : name;
}

/** Map a Wikipedia short description to our kind of place. */
function classifyDescription(text: string): { category: PlaceCategory; busy: BusyProfile; tags: PlaceTag[] } {
  const d = text.toLowerCase();
  if (/museum|gallery|exhibition/.test(d)) return { category: 'museum', busy: 'museum', tags: ['cultural', 'art'] };
  if (/viewpoint|observation|overlook|lookout/.test(d)) return { category: 'viewpoint', busy: 'viewpoint', tags: ['view'] };
  if (/market/.test(d)) return { category: 'market', busy: 'market', tags: ['local-cuisine'] };
  if (/restaurant|caf[eé]|bakery|brewery|winery/.test(d)) return { category: 'restaurant', busy: 'restaurant', tags: ['local-cuisine'] };
  if (/park|garden|canyon|mountain|peak|lake|waterfall|falls|beach|forest|trail|valley|nature|pillar|arch|cave|island|river|gorge|cliff|hot spring|onsen/.test(d))
    return { category: 'nature', busy: 'nature', tags: ['nature'] };
  if (/theat(re|er)|opera|concert|stadium|arena/.test(d)) return { category: 'other', busy: 'bar', tags: ['cultural'] };
  return { category: 'landmark', busy: 'landmark', tags: ['historic', 'cultural'] };
}

async function wikipediaPlaces(center: LatLng, radiusM: number, city: string): Promise<Place[]> {
  const radius = Math.min(10_000, Math.max(100, Math.round(radiusM)));
  const data = await getJson<WikiNearbyResponse>(
    'https://en.wikipedia.org/w/api.php?action=query&format=json&origin=*' +
      `&generator=geosearch&ggscoord=${center.lat.toFixed(5)}|${center.lng.toFixed(5)}&ggsradius=${radius}&ggslimit=40` +
      '&prop=pageimages|description|coordinates&piprop=thumbnail&pithumbsize=960&pilicense=free',
    { timeoutMs: 7000 },
  );
  const places: Place[] = [];
  for (const p of Object.values(data.query?.pages ?? {})) {
    const coord = p.coordinates?.[0];
    const description = p.description ?? '';
    if (!coord || !description || NOT_A_SIGHT.test(description) || AN_EVENT.test(description)) continue;
    const { category, busy, tags } = classifyDescription(description);
    places.push({
      id: `wiki-${p.pageid}`,
      name: p.title.replace(/\s*\([^)]*\)\s*$/, ''), // "The Watchman (Utah)" → "The Watchman"
      area: '',
      city,
      lat: coord.lat,
      lng: coord.lon,
      category,
      tags,
      stepFree: 'unknown',
      ticketRequired: false,
      busyProfile: busy,
      blurb: description.charAt(0).toUpperCase() + description.slice(1),
      photo: p.thumbnail && p.thumbnail.width >= 300 ? p.thumbnail.source : undefined,
      source: 'osm',
      refs: { wikipedia: `en:${p.title}` },
    });
  }
  return places;
}

/* -------------------------------------------------------------- Photon */

interface PhotonResponse {
  features: Array<{
    geometry: { coordinates: [number, number] };
    properties: { osm_id?: number; osm_type?: string; osm_value?: string; name?: string; street?: string; district?: string; city?: string };
  }>;
}

/** Restaurants and cafés near a point from Photon (used when Overpass is down). */
async function photonFood(center: LatLng, maxDistanceM: number, city: string): Promise<Place[]> {
  const searches: Array<[string, PlaceCategory]> = [
    ['restaurant', 'restaurant'],
    ['cafe', 'cafe'],
  ];
  const results = await Promise.all(
    searches.map(([term, category]) =>
      getJson<PhotonResponse>(
        `https://photon.komoot.io/api/?q=${term}&lat=${center.lat.toFixed(5)}&lon=${center.lng.toFixed(5)}&limit=15&lang=en&osm_tag=amenity:${term}`,
        { timeoutMs: 6000 },
      )
        .then((data) => ({ data, category }))
        .catch(() => null),
    ),
  );
  const places: Place[] = [];
  for (const r of results) {
    if (!r) continue;
    for (const f of r.data.features) {
      const props = f.properties;
      const point = { lat: f.geometry.coordinates[1], lng: f.geometry.coordinates[0] };
      if (!props.name || distanceMeters(center, point) > maxDistanceM) continue;
      places.push({
        id: `osm-${props.osm_type ?? 'n'}${props.osm_id ?? Math.round(point.lat * 1e5)}`,
        name: tidyName(props.name),
        area: props.street ?? props.district ?? '',
        city: props.city ?? city,
        ...point,
        category: r.category,
        tags: [],
        stepFree: 'unknown',
        ticketRequired: false,
        busyProfile: r.category === 'cafe' ? 'cafe' : 'restaurant',
        source: 'osm',
      });
    }
  }
  return places;
}

/* -------------------------------------------------------------- public */

const LATIN = /^[\p{Script=Latin}\p{N}\p{P}\p{Zs}'’&-]+$/u;

function nameKey(name: string): string {
  return name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '');
}

/**
 * Named places of the given kinds around a point, nearest first (English names
 * before other scripts). Throws only when every source failed.
 */
export async function nearbyPlaces(center: LatLng, radiusM: number, kinds: PoiKind[], city = ''): Promise<Place[]> {
  const wantsSights = kinds.includes('sights') || kinds.includes('nature');
  // Ideas look a little wider for notable sights (sparse towns); the ~500 ft nearby
  // check keeps its tight radius.
  const wikiRadius = radiusM < 300 ? radiusM : Math.max(radiusM, 2500);
  const [osm, wiki] = await Promise.allSettled([
    overpassPlaces(center, radiusM, kinds, city),
    wantsSights ? wikipediaPlaces(center, wikiRadius, city) : Promise.resolve([] as Place[]),
  ]);

  let places: Place[] = osm.status === 'fulfilled' ? osm.value : [];
  let anySource = osm.status === 'fulfilled';
  if (osm.status === 'rejected' && kinds.includes('food')) {
    const food = await photonFood(center, Math.max(radiusM * 2, 1500), city).catch(() => null);
    if (food) {
      places = food;
      anySource = true;
    }
  }
  if (wiki.status === 'fulfilled') {
    anySource = true;
    // The same place from both sources: keep OSM's facts, add Wikipedia's photo + description.
    const byName = new Map(places.map((p) => [nameKey(p.name), p]));
    for (const w of wiki.value) {
      const match = byName.get(nameKey(w.name));
      if (match) {
        match.photo ??= w.photo;
        match.blurb ??= w.blurb;
        match.refs ??= w.refs;
      } else if (distanceMeters(center, w) <= wikiRadius * 1.1) {
        places.push(w);
      }
    }
  }
  if (!anySource) throw new Error('No nearby-places source answered');

  const seen = new Set<string>();
  return places
    .filter((p) => {
      const key = nameKey(p.name);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => Number(!LATIN.test(a.name)) - Number(!LATIN.test(b.name)) || distanceMeters(center, a) - distanceMeters(center, b));
}
