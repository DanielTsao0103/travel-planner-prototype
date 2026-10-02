/**
 * Finds a real photo for any place or destination, using free Wikimedia data
 * (no API keys). Used by PlacePhoto whenever a place doesn't have a photo yet,
 * e.g. ideas and map places from OpenStreetMap, or places a tester adds.
 *
 * Order of attempts for a place:
 *  1. Links OpenStreetMap already has: a Commons file, a Wikidata item's image
 *     (P18), a Wikipedia article's lead image, or a direct Commons image URL.
 *  2. A Wikipedia article geotagged within 400 m whose title names this place.
 *  3. For sights, parks, viewpoints, museums, and tours: the nearest geotagged
 *     Commons photo taken within ~150 m (a real photo of that spot).
 * For a city (trip covers): its Wikipedia article's photo (never a map or flag),
 * then a geotagged Commons photo near the center.
 *
 * Returns null when nothing suitable exists; the UI then shows a labeled
 * representative photo for that kind of place (src/data/categoryPhotos.ts).
 */

import type { Destination, Place, PlaceCategory } from '../data/types';
import { getJson } from './http';
import { findPhoto } from './photos';

/** File names that are almost never good "what does it look like" photos. */
const NOT_A_PHOTO = /\b(map|maps|plan|locator|location|logo|flag|seal|coat[ _-]of[ _-]arms|emblem|sign|signage|plaque|diagram|chart|graph|menu|ticket|receipt|document|scan|poster|stamp|icon|svg|pdf|routemap|diagramme)\b/i;

/** Kinds of places where a nearby street photo is a fair picture of the place itself. */
const LOCATION_PHOTO_OK = new Set<PlaceCategory>(['landmark', 'viewpoint', 'nature', 'museum', 'tour', 'other', 'market', 'shopping']);

const WIDTH = 960; // a standard Wikimedia thumbnail width (others may be refused)

/** URL that redirects to a resized copy of a Commons file. */
function commonsFileUrl(fileName: string): string {
  const name = fileName.replace(/^File:/i, '').trim();
  return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(name)}?width=${WIDTH}`;
}

function isPhotoName(name: string): boolean {
  return /\.(jpe?g)$/i.test(name) && !NOT_A_PHOTO.test(name.replace(/[_-]/g, ' '));
}

/** Lowercase, accents removed: "Café Lumière" → "cafe lumiere". */
function plain(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/** Words that say what a place is, not which one. */
const GENERIC_WORDS = new Set([
  'park', 'parks', 'museum', 'gallery', 'cafe', 'coffee', 'restaurant', 'house', 'center', 'centre', 'town', 'city',
  'trail', 'bridge', 'church', 'market', 'garden', 'gardens', 'square', 'plaza', 'viewpoint', 'lookout', 'station',
  'hall', 'grill', 'kitchen', 'pizza', 'shop', 'store', 'visitor', 'visitors', 'national', 'state', 'memorial',
  'monument', 'tower', 'castle', 'temple', 'shrine', 'street', 'avenue', 'road', 'the', 'and', 'bar', 'hotel',
]);

function distinctiveWords(name: string): string[] {
  return plain(name)
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 4 && !GENERIC_WORDS.has(w));
}

/* ------------------------------------------------------- 1. OSM links */

interface WikidataResponse {
  entities?: Record<string, { claims?: { P18?: Array<{ mainsnak?: { datavalue?: { value?: string } } }> } }>;
}

async function fromWikidata(id: string): Promise<string | null> {
  const data = await getJson<WikidataResponse>(
    `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${encodeURIComponent(id)}&props=claims&format=json&origin=*`,
    { timeoutMs: 6000 },
  );
  const file = data.entities?.[id]?.claims?.P18?.[0]?.mainsnak?.datavalue?.value;
  return file && isPhotoName(file) ? commonsFileUrl(file) : null;
}

interface PageImagesResponse {
  query?: { pages?: Record<string, { title: string; index?: number; thumbnail?: { source: string; width: number; height: number } }> };
}

async function fromWikipediaTitle(tag: string): Promise<string | null> {
  // OSM's wikipedia tag looks like "en:Kinkaku-ji" (language prefix optional).
  const [lang, ...rest] = tag.includes(':') ? tag.split(':') : ['en', tag];
  const title = rest.join(':') || lang;
  const host = /^[a-z-]{2,12}$/.test(lang) && rest.length ? lang : 'en';
  const data = await getJson<PageImagesResponse>(
    `https://${host}.wikipedia.org/w/api.php?action=query&format=json&origin=*&redirects=1&prop=pageimages&piprop=thumbnail&pithumbsize=${WIDTH}&pilicense=free&titles=${encodeURIComponent(title)}`,
    { timeoutMs: 6000 },
  );
  const page = Object.values(data.query?.pages ?? {})[0];
  const src = page?.thumbnail?.source;
  return src && !NOT_A_PHOTO.test(decodeURIComponent(src)) ? src : null;
}

async function fromRefs(place: Place): Promise<string | null> {
  const refs = place.refs;
  if (!refs) return null;
  if (refs.commons && /^File:/i.test(refs.commons) && isPhotoName(refs.commons)) return commonsFileUrl(refs.commons);
  if (refs.image && /^https:\/\/(upload|commons)\.wikimedia\.org\//.test(refs.image)) {
    const m = refs.image.match(/\/(?:File:|[0-9a-f]\/[0-9a-f]{2}\/)([^/?#]+\.jpe?g)$/i);
    if (m) return commonsFileUrl(decodeURIComponent(m[1]));
  }
  if (refs.wikidata) {
    const fromWd = await fromWikidata(refs.wikidata).catch(() => null);
    if (fromWd) return fromWd;
  }
  if (refs.wikipedia) return fromWikipediaTitle(refs.wikipedia).catch(() => null);
  return null;
}

/* ------------------------------------------- 2. Wikipedia geotagged article */

async function fromNearbyArticle(name: string, lat: number, lng: number): Promise<string | null> {
  const words = distinctiveWords(name);
  if (words.length === 0) return null;
  const data = await getJson<PageImagesResponse>(
    'https://en.wikipedia.org/w/api.php?action=query&format=json&origin=*' +
      `&generator=geosearch&ggscoord=${lat.toFixed(5)}|${lng.toFixed(5)}&ggsradius=400&ggslimit=15` +
      `&prop=pageimages&piprop=thumbnail&pithumbsize=${WIDTH}&pilicense=free`,
    { timeoutMs: 6000 },
  );
  const hit = Object.values(data.query?.pages ?? {}).find(
    (p) => p.thumbnail && p.thumbnail.width >= 400 && words.every((w) => plain(p.title).includes(w)) && !NOT_A_PHOTO.test(decodeURIComponent(p.thumbnail.source)),
  );
  return hit?.thumbnail?.source ?? null;
}

/* ------------------------------------------- 3. geotagged Commons photo */

interface CommonsGeoResponse {
  query?: {
    pages?: Record<string, { title: string; index?: number; imageinfo?: Array<{ thumburl?: string; width: number; height: number; mime: string }> }>;
  };
}

/**
 * The nearest good photo taken within `radius` meters. Prefers files whose name
 * mentions the place; otherwise the nearest landscape JPEG that isn't a map or sign.
 */
async function fromNearbyCommons(name: string, lat: number, lng: number, radius: number): Promise<string | null> {
  const data = await getJson<CommonsGeoResponse>(
    'https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*' +
      `&generator=geosearch&ggscoord=${lat.toFixed(5)}|${lng.toFixed(5)}&ggsradius=${radius}&ggsnamespace=6&ggslimit=20` +
      `&prop=imageinfo&iiprop=url|size|mime&iiurlwidth=${WIDTH}`,
    { timeoutMs: 7000 },
  );
  const files = Object.values(data.query?.pages ?? {})
    .sort((a, b) => (a.index ?? 99) - (b.index ?? 99))
    .filter((p) => {
      const info = p.imageinfo?.[0];
      return info?.thumburl && info.mime === 'image/jpeg' && info.width >= 1000 && info.width >= info.height * 1.1 && !NOT_A_PHOTO.test(p.title.replace(/[_-]/g, ' '));
    });
  const words = distinctiveWords(name);
  const named = words.length ? files.find((p) => words.some((w) => plain(p.title).includes(w))) : undefined;
  return (named ?? files[0])?.imageinfo?.[0]?.thumburl ?? null;
}

/* ------------------------------------------------------------- public */

const cache = new Map<string, Promise<string | null>>();

/** Run at most 3 lookups at a time so long lists don't flood the services. */
let running = 0;
const queue: Array<() => void> = [];
async function limited<T>(task: () => Promise<T>): Promise<T> {
  if (running >= 3) await new Promise<void>((resolve) => queue.push(resolve));
  running++;
  try {
    return await task();
  } finally {
    running--;
    queue.shift()?.();
  }
}

function hasCoords(p: { lat: number; lng: number }): boolean {
  return Number.isFinite(p.lat) && Number.isFinite(p.lng) && !(p.lat === 0 && p.lng === 0);
}

/** Best real photo of a place, or null. Never throws; results are cached. */
export function findPlaceImage(place: Place): Promise<string | null> {
  const key = `place:${place.id}:${place.name}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const job = limited(async () => {
    try {
      // A typed-in place ("Dinner at Tia Rosa's") has no real location to photograph.
      if (place.source === 'custom') return null;
      const linked = await fromRefs(place);
      if (linked) return linked;
      if (!hasCoords(place)) return null;
      const article = await fromNearbyArticle(place.name, place.lat, place.lng).catch(() => null);
      if (article) return article;
      if (LOCATION_PHOTO_OK.has(place.category)) {
        return await fromNearbyCommons(place.name, place.lat, place.lng, place.category === 'nature' ? 300 : 150).catch(() => null);
      }
      return null;
    } catch {
      return null;
    }
  });
  cache.set(key, job);
  return job;
}

/**
 * For a place someone just picked from search: the lookups above, then a
 * Wikipedia text search ("Kinkaku-ji Kyoto") as a last try.
 */
export async function findPickedPlaceImage(place: Place): Promise<string | null> {
  return (await findPlaceImage(place)) ?? (place.source === 'custom' ? null : await findPhoto(place.name, place.city));
}

/** A photo of a destination city (trip covers), or null. */
export function findCityImage(destination: Destination): Promise<string | null> {
  const key = `city:${destination.name}:${destination.country ?? ''}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const job = limited(async () => {
    try {
      // "Springdale, Utah" before plain "Springdale" (which may be a disambiguation page).
      const region = destination.country?.split(',')[0]?.trim();
      const titles = [region ? `${destination.name}, ${region}` : '', destination.name].filter(Boolean);
      for (const title of titles) {
        const src = await fromWikipediaTitle(title).catch(() => null);
        if (src) return src;
      }
      if (!hasCoords(destination)) return null;
      return await fromNearbyCommons(destination.name, destination.lat, destination.lng, 2000).catch(() => null);
    } catch {
      return null;
    }
  });
  cache.set(key, job);
  return job;
}
