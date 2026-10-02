/**
 * fetch() with a timeout and a cache.
 *
 * The free open-data services we use (OpenStreetMap search, routing, Overpass,
 * Wikipedia) have fair-use limits, so we cache every successful response in
 * memory and in localStorage for a day. A request that takes too long is
 * aborted so the UI can fall back instead of spinning forever.
 */

import { getState } from '../store/store';
import { sleep } from '../lib/ids';

const memory = new Map<string, unknown>();
const CACHE_PREFIX = 'wayfare-cache:';
const TTL_MS = 24 * 60 * 60 * 1000;

function readCache<T>(key: string): T | undefined {
  if (memory.has(key)) return memory.get(key) as T;
  try {
    const raw = window.localStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return undefined;
    const { at, data } = JSON.parse(raw) as { at: number; data: T };
    if (Date.now() - at > TTL_MS) return undefined;
    memory.set(key, data);
    return data;
  } catch {
    return undefined;
  }
}

function writeCache(key: string, data: unknown): void {
  memory.set(key, data);
  try {
    window.localStorage.setItem(CACHE_PREFIX + key, JSON.stringify({ at: Date.now(), data }));
  } catch {
    // Storage full or blocked — memory cache still works for this session.
  }
}

export class ServiceError extends Error {
  constructor(
    message: string,
    public kind: 'timeout' | 'network' | 'http' | 'parse',
  ) {
    super(message);
  }
}

/** GET JSON with a timeout; cached by URL unless `cache: false`. */
export async function getJson<T>(url: string, options: { timeoutMs?: number; cache?: boolean; init?: RequestInit } = {}): Promise<T> {
  const { timeoutMs = 8000, cache = true, init } = options;
  const key = url + (init?.body ? `|${String(init.body)}` : '');
  if (cache) {
    const hit = readCache<T>(key);
    if (hit !== undefined) return hit;
  }
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    if (!res.ok) throw new ServiceError(`HTTP ${res.status}`, 'http');
    let data: T;
    try {
      data = (await res.json()) as T;
    } catch {
      throw new ServiceError('Bad JSON', 'parse');
    }
    if (cache) writeCache(key, data);
    return data;
  } catch (err) {
    if (err instanceof ServiceError) throw err;
    if ((err as Error).name === 'AbortError') throw new ServiceError('Timed out', 'timeout');
    throw new ServiceError((err as Error).message || 'Network error', 'network');
  } finally {
    window.clearTimeout(timer);
  }
}

/**
 * Wait like a real network call would. Used by simulated integrations
 * (sign-in, connections, receipt reading). The Prototype drawer's
 * "Slow mode" makes these longer so loading states are easy to see.
 */
export async function simulateLatency(baseMs = 700): Promise<void> {
  const slow = getState().demo.slowMode;
  await sleep(slow ? baseMs * 3.5 : baseMs);
}
