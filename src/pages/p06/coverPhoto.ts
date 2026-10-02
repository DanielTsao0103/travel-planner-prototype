/**
 * The trip's cover photo comes from its first destination (Page 6).
 *
 *  1. A bundled photo when we ship one for that place (instant, works offline).
 *  2. Otherwise a free photo of the city via `findCityImage()` (Wikipedia, never a
 *     map or flag; else a geotagged Commons photo near the city center).
 *  3. Otherwise none saved: the preview shows a representative travel photo.
 */

import { useEffect, useState } from 'react';
import type { Destination } from '../../data/types';
import { findCityImage } from '../../services/placeImages';

/** Destination names (lowercase) → bundled photo ids in public/img. */
const BUNDLED_COVERS: Record<string, string> = {
  lisbon: 'lisbon',
  lisboa: 'lisbon',
  porto: 'porto',
  sintra: 'pena',
  kyoto: 'kyoto',
  'mexico city': 'mexico-city',
  'ciudad de méxico': 'mexico-city',
  banff: 'banff',
  kauai: 'kauai',
  "kaua'i": 'kauai',
  'new york': 'central-park',
  'new york city': 'central-park',
  vík: 'iceland',
  vik: 'iceland',
  springdale: 'zion',
};

/** A bundled photo id for a destination name, if we have one. */
export function bundledCover(name: string): string | undefined {
  return BUNDLED_COVERS[name.trim().toLowerCase()];
}

/** Identifies "the same destination" across renders (ids differ between search sources). */
export function destKey(d: Destination | undefined): string {
  return d ? `${d.name.trim().toLowerCase()}|${(d.country ?? '').trim().toLowerCase()}` : '';
}

export type CoverState = { status: 'idle' } | { status: 'loading' } | { status: 'ready'; photo: string } | { status: 'none' };

/**
 * Resolve a cover photo whenever the first destination changes.
 * `keep` holds an existing cover (edit mode, or a Home suggestion) that we
 * reuse as long as the first destination is still the same place.
 */
export function useCoverPhoto(first: Destination | undefined, keep?: { key: string; photo?: string }): CoverState {
  const key = destKey(first);
  const [cover, setCover] = useState<CoverState>(() => {
    if (!first) return { status: 'idle' };
    if (keep && keep.key === key) return keep.photo ? { status: 'ready', photo: keep.photo } : { status: 'none' };
    const bundled = bundledCover(first.name);
    return bundled ? { status: 'ready', photo: bundled } : { status: 'loading' };
  });

  useEffect(() => {
    if (!first) {
      setCover({ status: 'idle' });
      return;
    }
    if (keep && keep.key === key) {
      setCover(keep.photo ? { status: 'ready', photo: keep.photo } : { status: 'none' });
      return;
    }
    const bundled = bundledCover(first.name);
    if (bundled) {
      setCover({ status: 'ready', photo: bundled });
      return;
    }
    // Live lookup. `alive` ignores a slow answer for a destination that has since changed.
    let alive = true;
    setCover({ status: 'loading' });
    void findCityImage(first).then((url) => {
      if (alive) setCover(url ? { status: 'ready', photo: url } : { status: 'none' });
    });
    return () => {
      alive = false;
    };
    // Only re-run when the destination itself changes (not on every render).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return cover;
}

/** The photo to save with the trip (undefined → a representative photo is shown). */
export function coverToSave(cover: CoverState): string | undefined {
  return cover.status === 'ready' ? cover.photo : undefined;
}
