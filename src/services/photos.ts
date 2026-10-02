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
      `&generator=search&gsrsearch=${encodeURIComponent(query)}&gsrlimit=3` +
      '&prop=pageimages&piprop=thumbnail&pithumbsize=800&pilicense=free';
    const data = await getJson<WikiSearchResponse>(url, { timeoutMs: 6000 });
    const pages = Object.values(data.query?.pages ?? {}).sort((a, b) => (a.index ?? 9) - (b.index ?? 9));
    // Prefer the top search hit whose title shares a word with the place name.
    const words = name.toLowerCase().split(/\W+/).filter((w) => w.length > 3);
    const good = pages.find((p) => p.thumbnail && p.thumbnail.width >= 300 && words.some((w) => p.title.toLowerCase().includes(w)));
    return good?.thumbnail?.source ?? null;
  } catch {
    return null;
  }
}
