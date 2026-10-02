/**
 * A neutral service tile: the service's first letter on a colored square.
 * Deliberately not the real brand logos (this is a prototype, and the tiles
 * must not look like an official integration). Used on Pages 2 and 3.
 */

import type { ServiceId } from '../../data/types';
import './p02.css';

/** Tile colors: brand-adjacent hues from the avatar tokens (white text stays readable in both themes). */
const TILE_COLOR: Record<ServiceId, string> = {
  instagram: 'var(--av-7)',
  facebook: 'var(--av-4)',
  tiktok: 'var(--av-8)',
  gmail: 'var(--av-3)',
};

const MONOGRAM: Record<ServiceId, string> = {
  instagram: 'I',
  facebook: 'F',
  tiktok: 'T',
  gmail: 'G',
};

export function ServiceTile({ service, size = 40 }: { service: ServiceId; size?: number }) {
  return (
    <span
      className="p02-tile"
      aria-hidden
      style={{ background: TILE_COLOR[service], width: size, height: size, fontSize: Math.round(size * 0.46), borderRadius: Math.round(size * 0.28) }}
    >
      {MONOGRAM[service]}
    </span>
  );
}
