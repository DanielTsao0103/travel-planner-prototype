import type { ScreenEntry } from './types';

/**
 * Screens for P16 (owned by src/pages/p16; keep in sync with NearbyPopup.tsx).
 * The pop-up appears ~1 s after the page loads (nearby=1 runs the "scan").
 * Page-specific param: `nearby-answer=no` presses "No" automatically ~1.4 s
 * after the pop-up shows, so the dismissed state (toast) is reproducible.
 */
export const screens: ScreenEntry[] = [
  {
    id: '16A',
    page: 16,
    title: 'Nearby match pop-up (Go / No)',
    path: (ctx) => `/trip/${ctx.sampleTripId}/dashboard`,
    auth: 'maya',
    date: 'during',
    nearby: true,
    overlay: true,
    notes: 'Padaria Celeste: 450 ft away · about 4 min walk. Go opens the map with the route (17B).',
  },
  {
    id: '16B',
    page: 16,
    title: 'Dismissed with “No” (toast)',
    path: (ctx) => `/trip/${ctx.sampleTripId}/dashboard?nearby-answer=no`,
    auth: 'maya',
    date: 'during',
    nearby: true,
    overlay: true,
    notes: 'The pop-up shows, then “No” is pressed for you; the toast says it won’t be suggested again today.',
  },
];
