/**
 * Walking directions for the selected place: how long, how far, when you'd
 * arrive, where the walk starts, each step, and an "Open in Google Maps" link.
 *
 * Split into small pieces so the desktop panel can show everything at once
 * while the phone's bottom sheet shows a compact summary first and the steps
 * when expanded.
 */

import type { ReactNode } from 'react';
import {
  AlertTriangle,
  ArrowUp,
  CornerUpLeft,
  CornerUpRight,
  ExternalLink,
  Footprints,
  Loader2,
  LocateFixed,
  MapPin,
  Navigation,
  RotateCw,
  X,
} from 'lucide-react';
import { PlacePhoto } from '../../components/domain/PlacePhoto';
import { Button, IconButton } from '../../components/ui/Button';
import { DemoBadge, Loading } from '../../components/ui/Display';
import type { Trip } from '../../data/types';
import { dayNumber, formatTime } from '../../lib/dates';
import { distanceLabel } from '../../lib/format';
import type { Directions } from './hooks';
import { arrivalTime, googleMapsUrl, type MapItem, type RouteOrigin } from './mapData';
import { categoryLine } from './placeText';

/** Shared inputs for every piece of the route UI. */
export interface RouteViewProps {
  item: MapItem;
  trip: Trip;
  origin: RouteOrigin | null;
  directions: Directions;
  /** Demo clock time ('14:20'), for the arrival estimate. */
  nowTime: string;
  /** Only during the trip: before it, "arrive at" isn't meaningful. */
  showArrival: boolean;
  onClear: () => void;
}

/**
 * "Day 2 · 3:30 PM" for events, "Idea for Day 2 · 2:20 PM" for ideas, else the
 * category line. `asPlace` forces the category line (e.g. for a nearby match,
 * which is about the place, not when an idea was slotted).
 */
export function itemContext(item: MapItem, trip: Trip, asPlace = false): string {
  if (item.event) return `Day ${dayNumber(trip, item.event.date)} · ${formatTime(item.event.start)}`;
  if (item.suggestion && !asPlace) return `Idea for Day ${dayNumber(trip, item.suggestion.date)} · ${formatTime(item.suggestion.start)}`;
  return categoryLine(item.place.category, item.place.area);
}

/** Where the walk starts, in words. */
function originText(origin: RouteOrigin): string {
  switch (origin.kind) {
    case 'you':
      return `From your simulated location · ${origin.label}`;
    case 'lodging':
      return `From ${origin.label} (your lodging)`;
    case 'place':
      return `From ${origin.label} (a stop on your trip)`;
    default:
      return `From ${origin.label}`;
  }
}

/** Icon for one direction step, based on its wording. */
function StepIcon({ text }: { text: string }) {
  const t = text.toLowerCase();
  if (t.startsWith('turn left')) return <CornerUpLeft aria-hidden />;
  if (t.startsWith('turn right')) return <CornerUpRight aria-hidden />;
  if (t.startsWith('arrive')) return <MapPin aria-hidden />;
  if (t.startsWith('take the roundabout')) return <RotateCw aria-hidden />;
  if (t.startsWith('head')) return <Navigation aria-hidden />;
  return <ArrowUp aria-hidden />;
}

/** Big numbers: "4 min · 0.2 mi · Arrive ~2:24 PM" (or a loading / too-far state). */
export function RouteStats({ directions, nowTime, showArrival, compact }: Pick<RouteViewProps, 'directions' | 'nowTime' | 'showArrival'> & { compact?: boolean }) {
  if (directions.status === 'loading') {
    // A rough straight-line estimate while the directions service answers.
    const { preview } = directions;
    return (
      <Loading label="Getting walking directions">
        <div className={`p17-stats is-loading ${compact ? 'is-compact' : ''}`}>
          <span className="p17-stat-main num is-provisional">
            <Footprints aria-hidden />~{preview.minutes} min
          </span>
          <span className="p17-loading-note small muted">
            <Loader2 className="spin" aria-hidden />
            Getting walking directions…
          </span>
        </div>
      </Loading>
    );
  }
  if (directions.status === 'too-far') {
    return (
      <p className={`p17-stats is-far ${compact ? 'is-compact' : ''}`}>
        <strong className="num">{distanceLabel(directions.straightM)}</strong> away. That’s too far to walk.
      </p>
    );
  }
  if (directions.status !== 'ready') return null;
  const { route } = directions;
  return (
    <div className={`p17-stats ${compact ? 'is-compact' : ''}`} aria-live="polite">
      <span className="p17-stat-main num">
        <Footprints aria-hidden />
        {route.minutes} min
      </span>
      <span className="p17-stat num">{distanceLabel(route.distanceM)}</span>
      {showArrival && <span className="p17-stat num">Arrive ~{arrivalTime(nowTime, route.minutes)}</span>}
    </div>
  );
}

/** "Estimated route (directions service unavailable)" when we only have a straight line. */
export function EstimateNote({ directions }: { directions: Directions }) {
  if (directions.status !== 'ready' || directions.route.source !== 'estimate') return null;
  return (
    <p className="p17-estimate" role="status">
      <AlertTriangle aria-hidden />
      <span>
        <strong>Estimated route (directions service unavailable).</strong> The dashed line is straight, so the walk may be longer.
      </span>
      <DemoBadge>Estimate</DemoBadge>
    </p>
  );
}

/** Numbered walking steps. */
export function RouteSteps({ item, directions }: Pick<RouteViewProps, 'item' | 'directions'>) {
  if (directions.status !== 'ready') return null;
  const steps = directions.route.steps.map((s) => ({
    ...s,
    // OSRM says "Arrive at your destination"; name the place instead.
    instruction: s.instruction === 'Arrive at your destination' ? `Arrive at ${item.place.name}` : s.instruction,
  }));
  return (
    <ol className="p17-steps" aria-label={`Walking steps to ${item.title}`}>
      {steps.map((s, i) => (
        <li key={i} className="p17-step">
          <span className="p17-step-icon">
            <StepIcon text={s.instruction} />
          </span>
          <span className="p17-step-text">{s.instruction}</span>
          {s.distanceM > 0 && <span className="p17-step-dist num">{distanceLabel(s.distanceM)}</span>}
        </li>
      ))}
    </ol>
  );
}

/** "Open in Google Maps" (new tab) + "Clear route". */
export function RouteActions({ item, origin, directions, onClear, size = 'md' }: Pick<RouteViewProps, 'item' | 'origin' | 'directions' | 'onClear'> & { size?: 'sm' | 'md' }) {
  return (
    <div className="p17-route-actions">
      {origin && (
        <Button
          size={size}
          variant="secondary"
          href={googleMapsUrl(origin, item.place, directions.status !== 'too-far')}
          iconRight={<ExternalLink />}
          aria-label={`Open directions to ${item.place.name} in Google Maps (opens a new tab)`}
        >
          Open in Google Maps
        </Button>
      )}
      <Button size={size} variant="ghost" icon={<X />} onClick={onClear}>
        Clear route
      </Button>
    </div>
  );
}

/** Desktop side panel: the whole route card. `extra` holds the nearby-match block. */
export function RouteCard(props: RouteViewProps & { eyebrow: string; asPlace?: boolean; extra?: ReactNode }) {
  const { item, trip, origin, directions, onClear, eyebrow, asPlace, extra } = props;
  return (
    <section className="p17-route" aria-labelledby="p17-route-title">
      <div className="p17-route-top">
        <span className="eyebrow">{eyebrow}</span>
        <IconButton label="Clear route" icon={<X />} size="sm" onClick={onClear} />
      </div>
      <div className="p17-route-place">
        <PlacePhoto photo={item.place.photo} alt={item.place.name} category={item.place.category} className="p17-route-photo" />
        <div className="stack-xs grow">
          <h2 id="p17-route-title" className="p17-route-name">
            {item.title}
          </h2>
          <p className="small muted">{itemContext(item, trip, asPlace)}</p>
        </div>
      </div>
      <RouteStats directions={directions} nowTime={props.nowTime} showArrival={props.showArrival} />
      {origin && (
        <p className="p17-from">
          <LocateFixed aria-hidden />
          <span>{originText(origin)}</span>
        </p>
      )}
      {!origin && <p className="small muted">We can’t find a starting point for walking directions on this trip.</p>}
      <EstimateNote directions={directions} />
      {extra}
      <RouteActions item={item} origin={origin} directions={directions} onClear={onClear} size="sm" />
      <RouteSteps item={item} directions={directions} />
    </section>
  );
}

export { originText };
