/**
 * Interactive map (Pages 10, 11, 16, 17) built on Leaflet + OpenStreetMap tiles.
 *
 * Why not Google Maps? Embedding it needs an API key with billing. OpenStreetMap
 * tiles are free for light use (with attribution), so testers get a real,
 * pannable/zoomable map with no credentials. The traveler's location is always
 * SIMULATED — the badge in the corner says so.
 *
 * Usage:
 *  <MapView ariaLabel="Map of today's plan" markers={[…]} you={loc} route={coords} />
 */

import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { LatLng } from '../../lib/geo';
import './map.css';

export type MarkerKind = 'event' | 'suggestion' | 'nearby' | 'place' | 'destination';

export interface MapMarker {
  id: string;
  lat: number;
  lng: number;
  kind: MarkerKind;
  label: string;
  /** Number shown inside the pin (e.g. order in the day). */
  number?: number;
  selected?: boolean;
}

export interface MapViewProps {
  ariaLabel: string;
  markers?: MapMarker[];
  /** Simulated traveler location. */
  you?: (LatLng & { label?: string }) | null;
  /** Route polyline as [lat, lng] pairs. */
  route?: Array<[number, number]> | null;
  /** Draw the route dashed (straight-line estimate). */
  routeEstimated?: boolean;
  center?: LatLng;
  zoom?: number;
  /** What to fit the view to when data changes. */
  fit?: 'all' | 'route' | 'none';
  onMarkerClick?: (id: string) => void;
  /** Disable dragging/zooming (small preview maps). */
  static?: boolean;
  className?: string;
  /** Show the "Simulated location" badge (default true when `you` is set). */
  showSimBadge?: boolean;
}

function pinHtml(m: MapMarker): string {
  const inner = m.number !== undefined ? String(m.number) : m.kind === 'nearby' ? '★' : m.kind === 'suggestion' ? '+' : '';
  return `<span class="pin pin-${m.kind}${m.selected ? ' is-selected' : ''}" aria-hidden="true"><span class="pin-inner">${inner}</span></span>`;
}

export function MapView({
  ariaLabel,
  markers = [],
  you,
  route,
  routeEstimated,
  center,
  zoom = 14,
  fit = 'all',
  onMarkerClick,
  static: isStatic,
  className = '',
  showSimBadge,
}: MapViewProps) {
  const elRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const clickRef = useRef(onMarkerClick);
  clickRef.current = onMarkerClick;

  // Create the map once.
  useEffect(() => {
    if (!elRef.current || mapRef.current) return;
    const map = L.map(elRef.current, {
      zoomControl: !isStatic,
      dragging: !isStatic,
      scrollWheelZoom: !isStatic,
      doubleClickZoom: !isStatic,
      touchZoom: !isStatic,
      boxZoom: !isStatic,
      keyboard: !isStatic,
      attributionControl: true,
    });
    map.attributionControl.setPrefix('');
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors',
    }).addTo(map);
    if (map.zoomControl) map.zoomControl.setPosition('topright');
    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    map.setView(center ? [center.lat, center.lng] : [38.7223, -9.1393], zoom);
    // Leaflet measures its container on creation; re-measure after layout settles.
    const t = window.setTimeout(() => map.invalidateSize(), 60);
    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(elRef.current);
    return () => {
      window.clearTimeout(t);
      ro.disconnect();
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Redraw markers / route / you whenever the data changes.
  const markerKey = JSON.stringify(markers.map((m) => [m.id, m.lat, m.lng, m.kind, m.number, m.selected]));
  const routeKey = route ? `${route.length}:${route[0]?.join(',')}:${route[route.length - 1]?.join(',')}` : '';
  const youKey = you ? `${you.lat.toFixed(5)},${you.lng.toFixed(5)}` : '';

  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;
    layer.clearLayers();
    const bounds: L.LatLngExpression[] = [];

    if (route && route.length > 1) {
      L.polyline(route, { className: 'route-casing', weight: 9, opacity: 1, interactive: false }).addTo(layer);
      L.polyline(route, { className: `route-line ${routeEstimated ? 'is-estimated' : ''}`, weight: 5, opacity: 1, interactive: false }).addTo(layer);
    }

    for (const m of markers) {
      const marker = L.marker([m.lat, m.lng], {
        icon: L.divIcon({ html: pinHtml(m), className: 'pin-wrap', iconSize: [34, 42], iconAnchor: [17, 40] }),
        title: m.label,
        alt: m.label,
        keyboard: true,
        riseOnHover: true,
        zIndexOffset: m.selected ? 500 : m.kind === 'nearby' ? 400 : 0,
      });
      marker.bindTooltip(m.label, { direction: 'top', offset: [0, -38] });
      marker.on('click', () => clickRef.current?.(m.id));
      marker.addTo(layer);
      bounds.push([m.lat, m.lng]);
    }

    if (you) {
      L.marker([you.lat, you.lng], {
        icon: L.divIcon({ html: '<span class="you-dot" aria-hidden="true"></span>', className: 'you-wrap', iconSize: [22, 22], iconAnchor: [11, 11] }),
        title: you.label ?? 'You (simulated location)',
        keyboard: false,
        zIndexOffset: 1000,
      })
        .bindTooltip(you.label ? `You · ${you.label}` : 'You (simulated)', { direction: 'top', offset: [0, -10] })
        .addTo(layer);
      bounds.push([you.lat, you.lng]);
    }

    if (fit === 'route' && route && route.length > 1) {
      map.fitBounds(L.latLngBounds(route), { padding: [40, 40], maxZoom: 17 });
    } else if (fit !== 'none' && bounds.length > 1) {
      map.fitBounds(L.latLngBounds(bounds), { padding: [40, 40], maxZoom: 16 });
    } else if (fit !== 'none' && bounds.length === 1) {
      map.setView(bounds[0], Math.max(zoom, 15));
    } else if (center) {
      map.setView([center.lat, center.lng], zoom);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [markerKey, routeKey, youKey, fit, routeEstimated]);

  const showBadge = showSimBadge ?? !!you;
  return (
    <div className={`map-view ${className}`} role="region" aria-label={ariaLabel}>
      <div ref={elRef} className="map-canvas" />
      {showBadge && <span className="map-sim-badge">Simulated location</span>}
    </div>
  );
}
