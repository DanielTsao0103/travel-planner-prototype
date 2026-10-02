/**
 * Real photos for places and destinations the tester adds, pulled from
 * Wikipedia's API (CORS-enabled with `origin=*`, no key needed).
 * Returns null when nothing suitable is found — the UI then shows an
 * illustrated placeholder instead.
 */

import { getJson } from './http';

interface WikiSearchResponse {
  query?: {
    pages?: Record<string, { title: string; index?: number; thumbnail?: { source: string; width: number; height: number } }>;
  };
}

/** Find a representative photo for "name, city" (e.g. "Kinkaku-ji Kyoto"). */
export async function findPhoto(name: string, context = ''): Promise<string | null> {
  const query = `${name} ${context}`.trim();
  if (!query) return null;
  try {
    const url =
      'https://en.wikipedia.org/w/api.php?action=query&format=json&origin=*' +
      `&generator=search&gsrsearch=${encodeURIComponent(query)}&gsrlimit=5` +
      '&prop=pageimages&piprop=thumbnail&pithumbsize=800&pilicense=free';
    const data = await getJson<WikiSearchResponse>(url, { timeoutMs: 6000 });
    const pages = Object.values(data.query?.pages ?? {}).sort((a, b) => (a.index ?? 9) - (b.index ?? 9));
    // Only accept a page whose title really names this place: either one contains the
    // other, or most of the place name's words appear in the title. This avoids e.g.
    // "Springdale Town Park" matching a park in a different Springdale.
    const norm = (t: string) => t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\(.*?\)/g, '').trim();
    const target = norm(name);
    const words = target.split(/\W+/).filter((w) => w.length > 2);
    const matches = (title: string) => {
      const t = norm(title);
      if (t === target || t.includes(target) || target.includes(t)) return true;
      const hits = words.filter((w) => t.includes(w)).length;
      return words.length > 0 && hits / words.length >= 0.75;
    };
    // Skip maps, flags, seals, logos, and diagrams (common lead images for towns).
    const notPhoto = /(map|locator|location|flag|seal|coat_of_arms|emblem|logo|diagram|\.svg)/i;
    const good = pages.find((p) => p.thumbnail && p.thumbnail.width >= 300 && matches(p.title) && !notPhoto.test(decodeURIComponent(p.thumbnail.source)));
    return good?.thumbnail?.source ?? null;
  } catch {
    return null;
  }
}
