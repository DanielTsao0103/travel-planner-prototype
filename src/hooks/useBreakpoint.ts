/**
 * Which layout to render: 'mobile' (<768px), 'tablet' (768–1099px), or 'desktop' (≥1100px).
 * Pages use this to switch between genuinely different layouts (not just CSS scaling).
 */

import { useSyncExternalStore } from 'react';

export type Breakpoint = 'mobile' | 'tablet' | 'desktop';

const mqTablet = typeof window !== 'undefined' ? window.matchMedia('(min-width: 768px)') : null;
const mqDesktop = typeof window !== 'undefined' ? window.matchMedia('(min-width: 1100px)') : null;

function read(): Breakpoint {
  if (mqDesktop?.matches) return 'desktop';
  if (mqTablet?.matches) return 'tablet';
  return 'mobile';
}

function subscribe(cb: () => void): () => void {
  mqTablet?.addEventListener('change', cb);
  mqDesktop?.addEventListener('change', cb);
  return () => {
    mqTablet?.removeEventListener('change', cb);
    mqDesktop?.removeEventListener('change', cb);
  };
}

export function useBreakpoint(): Breakpoint {
  return useSyncExternalStore(subscribe, read, () => 'desktop');
}

/** Convenience: true below 768px. */
export function useIsMobile(): boolean {
  return useBreakpoint() === 'mobile';
}
