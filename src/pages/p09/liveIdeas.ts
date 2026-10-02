/**
 * Live ideas for trips that don't come with bundled suggestions (the trips
 * testers create, e.g. "Zion Weekend" or a new Kyoto trip).
 *
 * How it works:
 *  1. Anchor each day: your simulated location today (during the trip), else
 *     the day's first real stop (not the hotel or a train), else the
 *     destination when nothing is planned yet.
 *  2. Ask OpenStreetMap (Overpass) for named sights, food, and parks within
 *     ~900 m of each distinct anchor area. At most 3 areas, one request at a
 *     time, to respect the free service's fair-use limits.
 *  3. Score each place against the group's survey answers (diet, access,
 *     interests) and keep a varied short list.
 *  4. Put each idea on a day, inside that day's free time, at a sensible hour
 *     for its kind (lunch at lunchtime, cafés mid-morning or mid-afternoon).
 *  5. Add a Wikipedia photo when an article about that exact place is
 *     geotagged right next to it (otherwise the card shows an icon tile).
 * The result is saved with saveLiveSuggestions so it isn't refetched on every visit.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { AppState, InterestTag, ISODate, Place, PlaceCategory, Suggestion, SurveyResponse, Trip, TripEvent } from '../../data/types';
import { eventLabel } from '../../components/domain/EventItem';
import { matchReasons } from '../../features/nearby';
import { minToTime, timeToMin } from '../../lib/dates';
import { firstName } from '../../lib/format';
import { distanceMeters, estimateTaxiMinutes, estimateWalkMinutes, type LatLng } from '../../lib/geo';
import { sleep } from '../../lib/ids';
import { getJson, ServiceError } from '../../services/http';
import { nearbyPlaces, type PoiKind } from '../../services/overpass';
import { saveLiveSuggestions } from '../../store/actions';
import { eventsOn, getTrip, now, simulatedLocation, tripDays } from '../../store/selectors';
import { getState } from '../../store/store';
import { groupSurveys, roundUp5 } from './ideas';

const RADIUS_M = 900;
/** Anchors closer than this share one Overpass request. */
const SAME_AREA_M = 650;
const MAX_AREAS = 3;
const MAX_IDEAS = 9;
const MAX_PER_DAY = 3;
const DAY_START = 8 * 60;
const DAY_END = 22 * 60;

/** How long a visit usually takes, by kind of place (minutes). */
const DURATION: Record<PlaceCategory, number> = {
  landmark: 60,
  museum: 90,
  viewpoint: 30,
  restaurant: 75,
  cafe: 40,
  market: 60,
  bar: 60,
  nature: 90,
  lodging: 30,
  transit: 30,
  shopping: 45,
  tour: 90,
  other: 60,
};

/** The hours each kind of place fits best (minutes after midnight). */
const WINDOWS: Partial<Record<PlaceCategory, Array<[number, number]>>> = {
  restaurant: [
    [12 * 60, 14 * 60 + 30],
    [18 * 60 + 30, 21 * 60],
  ],
  cafe: [
    [9 * 60, 11 * 60 + 30],
    [15 * 60, 17 * 60 + 30],
  ],
  bar: [[17 * 60 + 30, 21 * 60 + 30]],
  market: [[9 * 60, 13 * 60]],
};
const DEFAULT_WINDOWS: Array<[number, number]> = [[9 * 60 + 30, 17 * 60 + 30]];

/** Per-kind caps so the list isn't eight restaurants. */
const CAPS: Partial<Record<PlaceCategory, number>> = { restaurant: 2, cafe: 2, bar: 1, market: 1, museum: 2, landmark: 2, viewpoint: 2, nature: 2 };

const SIGHTS = new Set<PlaceCategory>(['museum', 'landmark', 'viewpoint', 'nature', 'market']);

const KIND_WORD: Record<PlaceCategory, string> = {
  landmark: 'landmark',
  museum: 'museum',
  viewpoint: 'viewpoint',
  restaurant: 'restaurant',
  cafe: 'café',
  market: 'market',
  bar: 'bar',
  nature: 'nature spot',
  lodging: 'place to stay',
  transit: 'station',
  shopping: 'shop',
  tour: 'tour',
  other: 'spot',
};

const KINDS: PoiKind[] = ['sights', 'food', 'nature'];

/** Words that stay capitalized mid-sentence ("Zen Buddhist temple", not "zen Buddhist temple"). */
const PROPER_START = /^(Zen|Shinto|Buddhist|Hindu|Catholic|Christian|Islamic|Roman|Gothic|Baroque|Japanese|Chinese|American|British|English|French|Spanish|Italian|Portuguese|Mexican|Canadian|German|Greek|Moorish|Victorian|Art|United|National|UNESCO)\b/;

/** "Museum in Kyoto, Japan" → "museum in Kyoto, Japan"; proper words keep their capital. */
function sentenceCase(text: string): string {
  return PROPER_START.test(text) ? text : text.charAt(0).toLowerCase() + text.slice(1);
}

/** "a" or "an" before a word ("an onsen", "a temple"). */
function article(word: string): string {
  return /^[aeiou]/i.test(word) ? 'an' : 'a';
}

/** Names in Latin script (our testers read English); other scripts are a fallback. */
const LATIN = /^[\p{Script=Latin}\p{N}\p{P}\p{Zs}'’&-]+$/u;

/** A rough per-person cost so cards can show an estimate. */
function estimateCost(p: Place): number {
  switch (p.category) {
    case 'restaurant':
      return p.tags.includes('upscale') ? 45 : 25;
    case 'cafe':
      return 8;
    case 'bar':
      return 14;
    case 'market':
      return 12;
    case 'museum':
      return 15;
    default:
      return p.ticketRequired ? 12 : 0;
  }
}

/* ---------------------------------------------------------------- anchors */

interface Anchor {
  date: ISODate;
  center: LatLng;
  /** The planned stop the idea is "since you planned …" about. */
  event?: TripEvent;
  label: string;
  /** Today's anchor is your (simulated) location. */
  fromYou: boolean;
  city: string;
}

/** The destination nearest a point (or the first one). */
function nearestDestination(trip: Trip, point: LatLng | null) {
  if (!point) return trip.destinations[0];
  return [...trip.destinations].sort((a, b) => distanceMeters(a, point) - distanceMeters(b, point))[0];
}

function dayAnchors(state: AppState, trip: Trip): Anchor[] {
  const clock = now(state);
  const here = simulatedLocation(state, trip);
  let prev: LatLng | null = null;
  const anchors: Anchor[] = [];
  for (const date of tripDays(trip)) {
    const events = eventsOn(state, trip.id, date);
    const stop = events.find((e) => e.place.category !== 'lodging' && e.place.category !== 'transit') ?? events[0];
    if (here && date === clock.date) {
      const atEvent = events.find((e) => e.id === here.eventId) ?? stop;
      prev = here;
      anchors.push({ date, center: { lat: here.lat, lng: here.lng }, event: atEvent, label: atEvent ? eventLabel(atEvent) : here.label, fromYou: true, city: nearestDestination(trip, here)?.name ?? '' });
    } else if (stop) {
      prev = stop.place;
      anchors.push({ date, center: { lat: stop.place.lat, lng: stop.place.lng }, event: stop, label: eventLabel(stop), fromYou: false, city: nearestDestination(trip, stop.place)?.name ?? stop.place.city });
    } else {
      const dest = nearestDestination(trip, prev);
      if (dest) anchors.push({ date, center: { lat: dest.lat, lng: dest.lng }, label: dest.name, fromYou: false, city: dest.name });
    }
  }
  return anchors;
}

interface Area {
  center: LatLng;
  anchors: Anchor[];
  city: string;
}

/** Merge anchors that are close together so each area costs one request. */
function groupAreas(anchors: Anchor[]): Area[] {
  const areas: Area[] = [];
  for (const a of anchors) {
    const near = areas.find((x) => distanceMeters(x.center, a.center) <= SAME_AREA_M);
    if (near) near.anchors.push(a);
    else areas.push({ center: a.center, anchors: [a], city: a.city });
  }
  // Where you are right now first, then the areas that cover the most days.
  const score = (x: Area) => (x.anchors.some((a) => a.fromYou) ? 100 : 0) + x.anchors.length;
  return areas.sort((x, y) => score(y) - score(x)).slice(0, MAX_AREAS);
}

/* ---------------------------------------------------------------- scoring */

/** Extra interest matches that matchReasons (Page 16) doesn't cover. */
function interestReasons(place: Place, surveys: SurveyResponse[], names: Record<string, string>, already: string[]): string[] {
  const out: string[] = [];
  const add = (label: string, tags: InterestTag[]) => {
    const who = surveys
      .filter((s) => s.interests.some((i) => tags.includes(i)))
      .map((s) => firstName(names[s.personId] ?? ''))
      .filter(Boolean)
      .slice(0, 2);
    if (who.length) out.push(`${label} · ${who.join(', ')}`);
  };
  if (place.category === 'nature' || place.tags.includes('nature')) add('Nature', ['nature']);
  if (place.category === 'viewpoint' || place.tags.includes('view')) add('Views', ['photography']);
  if (place.category === 'market') add('Food markets', ['food-markets']);
  if (place.category === 'museum' && place.tags.includes('art') && !already.some((r) => r.startsWith('Matches interests'))) add('Art', ['art', 'modern']);
  return out;
}

interface Candidate {
  place: Place;
  area: Area;
  reasons: string[];
  score: number;
}

/* --------------------------------------------------------------- requests */

/**
 * Places around one area. The free Overpass server often answers "busy" right
 * away (HTTP 429/504); one retry a moment later usually works. Slow answers
 * (timeouts) aren't retried, so a dead server fails in one go.
 */
async function placesAround(area: Area): Promise<Place[]> {
  try {
    return await nearbyPlaces(area.center, RADIUS_M, KINDS, area.city);
  } catch (err) {
    if (err instanceof ServiceError && err.kind !== 'timeout') {
      await sleep(2500);
      return nearbyPlaces(area.center, RADIUS_M, KINDS, area.city);
    }
    throw err;
  }
}

interface WikiGeoResponse {
  query?: { pages?: Record<string, { title: string; thumbnail?: { source: string; width: number } }> };
}

/** Words that say what a place is, not which one ("Town Park" alone could be anywhere). */
const GENERIC_WORDS = new Set([
  'park', 'parks', 'museum', 'gallery', 'cafe', 'coffee', 'restaurant', 'house', 'center', 'centre', 'town', 'city',
  'trail', 'bridge', 'church', 'market', 'garden', 'gardens', 'square', 'plaza', 'viewpoint', 'lookout', 'station',
  'hall', 'grill', 'kitchen', 'pizza', 'shop', 'store', 'visitor', 'visitors', 'national', 'state', 'memorial',
  'monument', 'tower', 'castle', 'temple', 'shrine', 'street', 'avenue', 'road', 'the', 'and',
]);

/** Lowercase, accents removed: "Café Lumière" → "cafe lumiere". */
function plain(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/**
 * A photo only when Wikipedia has an article geotagged within 400 m whose
 * title contains every distinctive word of the place's name. Precise on
 * purpose: a wrong photo (a park in another Springdale) is worse than none.
 */
async function placePhoto(place: Place): Promise<string | null> {
  const words = plain(place.name)
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 4 && !GENERIC_WORDS.has(w));
  if (words.length === 0) return null;
  try {
    const url =
      'https://en.wikipedia.org/w/api.php?action=query&format=json&origin=*' +
      `&generator=geosearch&ggscoord=${place.lat.toFixed(5)}|${place.lng.toFixed(5)}&ggsradius=400&ggslimit=15` +
      '&prop=pageimages&piprop=thumbnail&pithumbsize=800&pilicense=free';
    const data = await getJson<WikiGeoResponse>(url, { timeoutMs: 6000 });
    const hit = Object.values(data.query?.pages ?? {}).find((p) => p.thumbnail && p.thumbnail.width >= 300 && words.every((w) => plain(p.title).includes(w)));
    return hit?.thumbnail?.source ?? null;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ slots */

/**
 * A time for a place on one day: inside free time, at a sensible hour for its
 * kind, with 15 minutes to get there after the previous stop. Falls back to
 * the first free gap of at least an hour; null when the day is full.
 */
function pickSlot(dayEvents: TripEvent[], extra: Array<[number, number]>, category: PlaceCategory, notBefore: number): [number, number] | null {
  const taken: Array<[number, number]> = [...dayEvents.map((e): [number, number] => [timeToMin(e.start), timeToMin(e.end)]), ...extra].sort((a, b) => a[0] - b[0]);
  const gaps: Array<[number, number]> = [];
  let cursor = Math.max(DAY_START, notBefore);
  for (const [s, e] of taken) {
    if (s > cursor) gaps.push([cursor, s]);
    cursor = Math.max(cursor, e);
  }
  if (DAY_END > cursor) gaps.push([cursor, DAY_END]);

  const duration = DURATION[category];
  for (const [ws, we] of WINDOWS[category] ?? DEFAULT_WINDOWS) {
    for (const [gs, ge] of gaps) {
      const start = roundUp5(Math.max(gs + (gs > DAY_START ? 15 : 0), ws));
      const end = start + duration;
      if (start <= we && end <= ge - (ge < DAY_END ? 10 : 0)) return [start, end];
    }
  }
  for (const [gs, ge] of gaps) {
    if (ge - gs >= 60) {
      const start = roundUp5(gs);
      return [start, Math.min(start + duration, ge)];
    }
  }
  return null;
}

/* ------------------------------------------------------------------ build */

/**
 * Build live suggestions for a trip. Throws when every OpenStreetMap request
 * fails (the page then shows "Couldn't load ideas…" with Retry).
 */
export async function buildLiveSuggestions(tripId: string): Promise<Suggestion[]> {
  const state = getState();
  const trip = getTrip(state, tripId);
  if (!trip || trip.destinations.length === 0) return [];

  const anchors = dayAnchors(state, trip);
  const areas = groupAreas(anchors);
  const surveys = groupSurveys(state, trip);
  const names = Object.fromEntries(state.people.map((p) => [p.id, p.name]));
  const planned = state.events.filter((e) => e.tripId === trip.id);
  const plannedNames = new Set(planned.map((e) => e.place.name.toLowerCase()));

  // 1–2. One request per area, one at a time.
  const found: Array<{ area: Area; places: Place[] }> = [];
  for (const area of areas) {
    try {
      found.push({ area, places: await placesAround(area) });
    } catch {
      // Keep going: another area may still work.
    }
  }
  if (found.length === 0) throw new Error('OpenStreetMap is unavailable');

  // 3. Score every place we haven't already planned.
  const seen = new Set<string>();
  let candidates: Candidate[] = [];
  for (const { area, places } of found) {
    for (const place of places) {
      if (seen.has(place.id) || plannedNames.has(place.name.toLowerCase())) continue;
      if (planned.some((e) => distanceMeters(e.place, place) < 30)) continue;
      seen.add(place.id);
      const base = matchReasons(place, surveys, names);
      const reasons = [...base, ...interestReasons(place, surveys, names, base)];
      const meters = distanceMeters(area.center, place);
      const score = reasons.length * 3 + (SIGHTS.has(place.category) ? 1.5 : 0) + (place.stepFree === 'yes' ? 0.5 : 0) + (place.blurb ? 0.3 : 0) - meters / 600;
      candidates.push({ place, area, reasons, score });
    }
  }
  const latin = candidates.filter((c) => LATIN.test(c.place.name));
  if (latin.length >= 4) candidates = latin;
  candidates.sort((a, b) => b.score - a.score);

  // Keep a varied list (caps per kind of place).
  const perKind = new Map<PlaceCategory, number>();
  const picked: Candidate[] = [];
  for (const c of candidates) {
    const n = perKind.get(c.place.category) ?? 0;
    if (n >= (CAPS[c.place.category] ?? 2)) continue;
    perKind.set(c.place.category, n + 1);
    picked.push(c);
    if (picked.length >= MAX_IDEAS) break;
  }
  // Sparse areas (a small town by a national park): top up past the caps so
  // there are still enough ideas to choose from.
  for (const c of candidates) {
    if (picked.length >= Math.min(6, MAX_IDEAS)) break;
    if (!picked.includes(c)) picked.push(c);
  }

  // 4. Day + time slot for each idea, spreading them across the area's days.
  const clock = now(state);
  const perDay = new Map<ISODate, number>();
  const placedSlots = new Map<ISODate, Array<[number, number]>>();
  const placed: Array<{ c: Candidate; anchor: Anchor; slot: [number, number] }> = [];
  for (const c of picked) {
    const days = [...c.area.anchors].sort((a, b) => (perDay.get(a.date) ?? 0) - (perDay.get(b.date) ?? 0) || a.date.localeCompare(b.date));
    let done = false;
    for (const anchor of days) {
      if ((perDay.get(anchor.date) ?? 0) >= MAX_PER_DAY) continue;
      // Today during the trip: nothing earlier than 15 minutes from now.
      const notBefore = anchor.date === clock.date ? roundUp5(timeToMin(clock.time) + 15) : DAY_START;
      if (anchor.date < clock.date && anchor.date >= trip.startDate && clock.date <= trip.endDate) continue; // a day that's already over
      const slot = pickSlot(eventsOn(state, trip.id, anchor.date), placedSlots.get(anchor.date) ?? [], c.place.category, notBefore);
      if (!slot) continue;
      perDay.set(anchor.date, (perDay.get(anchor.date) ?? 0) + 1);
      placedSlots.set(anchor.date, [...(placedSlots.get(anchor.date) ?? []), slot]);
      placed.push({ c, anchor, slot });
      done = true;
      break;
    }
    // Spec fallback: nothing free on its days → 10:00–11:00 on the first day.
    if (!done && placed.length < 3) placed.push({ c, anchor: { ...c.area.anchors[0], date: trip.startDate }, slot: [600, 660] });
  }

  // 5. Photos (only exact, nearby Wikipedia matches; see placePhoto).
  const photos = await Promise.all(placed.map(({ c }) => placePhoto(c.place)));

  return placed.map(({ c, anchor, slot }, i): Suggestion => {
    const meters = distanceMeters(anchor.center, c.place);
    const walk = estimateWalkMinutes(meters);
    const far = walk > 25;
    const kind = KIND_WORD[c.place.category];
    const cost = estimateCost(c.place);
    // For Wikipedia places, add its own one-line description as a second sentence
    // ("It's a Zen Buddhist temple in Kyoto, Japan.") instead of a generic kind.
    const described = c.place.id.startsWith('wiki-') && c.place.blurb ? c.place.blurb.replace(/\.$/, '') : '';
    const when = (away: string, car: string) => (far ? `${estimateTaxiMinutes(meters)} min ${car}` : `${walk} min ${away}`);
    let reason: string;
    if (described) {
      const lead = anchor.event
        ? `Since you planned ${anchor.label}, you might also like ${c.place.name}, ${when(anchor.fromYou ? 'from where you are now' : 'away', anchor.fromYou ? 'by car from where you are now' : 'away by car')}.`
        : `Since you’re visiting ${anchor.label}, you might like ${c.place.name}, ${when('from the center', 'by car from the center')}.`;
      const desc = sentenceCase(described);
      reason = `${lead} It’s ${article(desc)} ${desc}.`;
    } else if (anchor.event && anchor.fromYou) {
      reason = `Since you planned ${anchor.label}, you might also like ${c.place.name}, ${article(kind)} ${kind} ${when('from where you are now', 'by car from where you are now')}.`;
    } else if (anchor.event) {
      reason = `Since you planned ${anchor.label}, you might also like ${c.place.name}, ${article(kind)} ${kind} ${when('away', 'away by car')}.`;
    } else {
      reason = `Since you’re visiting ${anchor.label}, you might like ${c.place.name}, ${article(kind)} ${kind} ${when('from the center', 'by car from the center')}.`;
    }
    const fit = c.reasons.slice(0, 3);
    if (anchor.event && !anchor.fromYou && walk <= 20) fit.push(`${walk} min walk from ${anchor.label}`);
    if (cost === 0) fit.push('Free');
    return {
      id: `${trip.id}-osm-${c.place.id}`,
      tripId: trip.id,
      place: { ...c.place, photo: photos[i] ?? c.place.photo, city: c.place.city || anchor.city },
      basedOnEventId: anchor.event?.id,
      basedOnLabel: anchor.label,
      reason,
      date: anchor.date,
      start: minToTime(slot[0]),
      end: minToTime(slot[1]),
      estCostPerPerson: cost,
      fit,
      source: 'osm',
    };
  });
}

/* --------------------------------------------------------- fetch + hook */

/** One request per trip at a time (React's dev double-render would otherwise fetch twice). */
const inflight = new Map<string, Promise<Suggestion[]>>();

/** Build, save, and return live ideas for a trip. */
export function fetchLiveIdeas(tripId: string): Promise<Suggestion[]> {
  const running = inflight.get(tripId);
  if (running) return running;
  const p = buildLiveSuggestions(tripId)
    .then((list) => {
      saveLiveSuggestions(tripId, list);
      return list;
    })
    .finally(() => inflight.delete(tripId));
  inflight.set(tripId, p);
  return p;
}

export type LiveStatus = 'idle' | 'loading' | 'ready' | 'error';

/**
 * Loads live ideas once per trip (unless some are already saved) and exposes
 * `run` for Retry / "Refresh ideas". `forcedError` shows the error state (9H).
 */
export function useLiveIdeas(tripId: string, enabled: boolean, hasSaved: boolean, forcedError: boolean) {
  const [status, setStatus] = useState<LiveStatus>(() => (!enabled ? 'idle' : forcedError ? 'error' : hasSaved ? 'ready' : 'loading'));
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const run = useCallback(() => {
    setStatus('loading');
    fetchLiveIdeas(tripId).then(
      () => mounted.current && setStatus('ready'),
      () => mounted.current && setStatus('error'),
    );
  }, [tripId]);

  useEffect(() => {
    if (!enabled) return;
    if (forcedError) {
      setStatus('error');
      return;
    }
    if (hasSaved) {
      setStatus('ready');
      return;
    }
    run();
    // Only when the trip changes: saving new ideas mustn't trigger another fetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripId, enabled]);

  return { status, run };
}
