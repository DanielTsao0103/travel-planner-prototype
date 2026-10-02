/**
 * Camera control for Page 17's map.
 *
 * The page needs to move the map itself: fit a route between the floating
 * search bar and the bottom sheet on phones, and "Recenter on me". The shared
 * MapView doesn't hand out its Leaflet map, so we use Leaflet's public
 * `addInitHook` API to remember every map Leaflet creates, keyed by its
 * container element, and look ours up from the page's DOM.
 *
 * A WeakMap means removed maps can still be garbage-collected.
 * (If MapView later exposes an `onReady(map)` prop, this file can go away.)
 */

import L from 'leaflet';
import type { LatLng } from '../../lib/geo';

const maps = new WeakMap<HTMLElement, L.Map>();

L.Map.addInitHook(function (this: L.Map) {
  maps.set(this.getContainer(), this);
});

/** The Leaflet map rendered by the MapView inside `root`, if it exists yet. */
export function leafletMapIn(root: HTMLElement | null): L.Map | null {
  const canvas = root?.querySelector<HTMLElement>('.map-canvas');
  return (canvas && maps.get(canvas)) || null;
}

/** Space (px) covered by floating UI on each side of the map. */
export interface Insets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/** True when the person asked their OS for less motion. */
function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Center `point` in the part of the map that isn't covered by floating UI.
 * We shift the map's true center by half the difference between the insets.
 */
export function centerCamera(map: L.Map, point: LatLng, zoom: number, insets: Insets, animate: boolean): void {
  const offset = L.point((insets.left - insets.right) / 2, (insets.top - insets.bottom) / 2);
  const target = map.unproject(map.project([point.lat, point.lng], zoom).subtract(offset), zoom);
  if (animate && !prefersReducedMotion()) map.flyTo(target, zoom, { duration: 0.6 });
  else map.setView(target, zoom, { animate: false });
}

/** Fit a set of points inside the uncovered part of the map. */
export function fitCamera(map: L.Map, points: LatLng[], insets: Insets, options: { animate?: boolean; maxZoom?: number } = {}): void {
  const { animate = false, maxZoom = 16 } = options;
  if (points.length === 0) return;
  if (points.length === 1) {
    centerCamera(map, points[0], Math.min(maxZoom, 16), insets, animate);
    return;
  }
  const bounds = L.latLngBounds(points.map((p) => [p.lat, p.lng] as [number, number]));
  const padding = {
    paddingTopLeft: L.point(insets.left, insets.top),
    paddingBottomRight: L.point(insets.right, insets.bottom),
    maxZoom,
  };
  if (animate && !prefersReducedMotion()) map.flyToBounds(bounds, { ...padding, duration: 0.6 });
  else map.fitBounds(bounds, { ...padding, animate: false });
}
