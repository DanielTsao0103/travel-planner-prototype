/**
 * How far today's ideas are from your (simulated) location, for the
 * "4 min walk from you" chips on Page 9.
 *
 * We show a straight-line estimate right away, then replace it with the
 * walking-route service's number (the same service and cache Page 16 uses,
 * so both pages agree). Places more than 2 km away just show a distance.
 */

import { useEffect, useMemo, useState } from 'react';
import type { Place } from '../../data/types';
import { distanceMeters, estimateWalkMinutes, type LatLng } from '../../lib/geo';
import { walkingRoute } from '../../services/routing';

const WALKABLE_M = 2000;

export function useDistancesFromYou(here: LatLng | null, places: Place[]) {
  // A string key stands in for the arrays/objects, which are new on every render.
  const key = here ? `${here.lat.toFixed(5)},${here.lng.toFixed(5)}|${places.map((p) => p.id).join(',')}` : '';

  const meters = useMemo<Record<string, number>>(
    () => (here ? Object.fromEntries(places.map((p) => [p.id, distanceMeters(here, p)])) : {}),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key],
  );
  const [walk, setWalk] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!here) {
      setWalk({});
      return;
    }
    let alive = true;
    const near = places.filter((p) => meters[p.id] <= WALKABLE_M);
    setWalk(Object.fromEntries(near.map((p) => [p.id, estimateWalkMinutes(meters[p.id])])));
    // walkingRoute never throws: it falls back to the same estimate.
    Promise.all(near.map((p) => walkingRoute(here, p).then((r) => [p.id, r.minutes] as const))).then((pairs) => {
      if (alive) setWalk(Object.fromEntries(pairs));
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return { walk, meters };
}
