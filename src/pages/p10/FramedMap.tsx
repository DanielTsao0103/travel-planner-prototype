/**
 * A MapView that opens already framed around a set of points.
 *
 * Why not MapView's own fit="all"? That zooms with an animation after the map
 * appears, and if the page changes while the animation is still running,
 * Leaflet throws an error (its zoom timer outlives the removed map). Working
 * out the center and zoom ourselves means the map starts in the right place
 * and never animates. It also lets the dashboard keep the stops clear of the
 * info card that sits over the map's left side (`insetLeft`).
 *
 * Used by Page 10 ("Where to next") and Page 11 ("Map of the day").
 */

import { useLayoutEffect, useRef, useState } from 'react';
import type { LatLng } from '../../lib/geo';
import { MapView, type MapViewProps } from '../../components/domain/MapView';
import './p10.css';

const TILE_PX = 256;
/** Map pins are drawn above their point (about 40px tall), so leave that much extra room at the top. */
const PIN_HEADROOM_PX = 34;

/** Web Mercator (the projection map tiles use): longitude → 0..1 across the world. */
function mercX(lng: number): number {
  return (lng + 180) / 360;
}

/** Web Mercator: latitude → 0..1 down the world. */
function mercY(lat: number): number {
  const sin = Math.sin((lat * Math.PI) / 180);
  return 0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI);
}

/** Inverse of mercY. */
function latFromMercY(y: number): number {
  return (180 / Math.PI) * Math.atan(Math.sinh(Math.PI - 2 * Math.PI * y));
}

/**
 * The center and whole-number zoom that fit `points` in a `width`×`height` map,
 * keeping `padding` px clear on every side and `insetLeft` px clear on the left.
 */
export function framePoints(
  points: LatLng[],
  width: number,
  height: number,
  { padding = 36, insetLeft = 0, maxZoom = 16, minZoom = 3 }: { padding?: number; insetLeft?: number; maxZoom?: number; minZoom?: number } = {},
): { center: LatLng; zoom: number } | null {
  if (points.length === 0 || width <= 0 || height <= 0) return null;
  const xs = points.map((p) => mercX(p.lng));
  const ys = points.map((p) => mercY(p.lat));
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const availW = Math.max(40, width - insetLeft - padding * 2);
  const availH = Math.max(40, height - padding * 2 - PIN_HEADROOM_PX);
  // At zoom z the whole world is 256·2^z pixels wide; take the largest zoom where the box still fits.
  const fitX = Math.log2(availW / (Math.max(maxX - minX, 1e-9) * TILE_PX));
  const fitY = Math.log2(availH / (Math.max(maxY - minY, 1e-9) * TILE_PX));
  const zoom = Math.max(minZoom, Math.min(maxZoom, Math.floor(Math.min(fitX, fitY))));
  // Put the box in the middle of the *uncovered* part of the map (and a little low, for the pins).
  const worldPx = TILE_PX * 2 ** zoom;
  const centerX = (minX + maxX) / 2 - insetLeft / 2 / worldPx;
  const centerY = (minY + maxY) / 2 - PIN_HEADROOM_PX / 2 / worldPx;
  return { center: { lat: latFromMercY(centerY), lng: centerX * 360 - 180 }, zoom };
}

export interface FramedMapProps extends Omit<MapViewProps, 'fit' | 'center' | 'zoom'> {
  /** Points the view must show (stops, "you"). */
  frame: LatLng[];
  /** Where to look when there's nothing to frame. */
  fallback?: LatLng;
  /** Pixels covered on the left (by an overlay card), given the map's width. */
  insetLeft?: (width: number) => number;
  maxZoom?: number;
  /** Change this to start a fresh map (e.g. a different day) instead of moving the old one. */
  frameKey: string;
  /** Sets the map's height (the map fills this box). */
  className?: string;
}

export function FramedMap({ frame, fallback, insetLeft, maxZoom = 16, frameKey, className = '', ...mapProps }: FramedMapProps) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);

  // Measure before the browser paints, so the map is created with the right view.
  useLayoutEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const read = () =>
      setSize((prev) => {
        const w = Math.round(el.clientWidth);
        const h = Math.round(el.clientHeight);
        return prev && prev.w === w && prev.h === h ? prev : { w, h };
      });
    read();
    const observer = new ResizeObserver(read);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const view = size ? framePoints(frame, size.w, size.h, { insetLeft: insetLeft?.(size.w) ?? 0, maxZoom }) : null;
  return (
    <div ref={boxRef} className={`p10-framed ${className}`}>
      {size && <MapView key={frameKey} {...mapProps} fit="none" center={view?.center ?? fallback} zoom={view?.zoom ?? 13} className="p10-framed-map" />}
    </div>
  );
}
