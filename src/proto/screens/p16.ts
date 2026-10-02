import type { ScreenEntry } from './types';

/** Screens for P16 (owned by that page's folder; keep in sync with its `s=` states). */
export const screens: ScreenEntry[] = [
  { id: '16A', page: 16, title: 'Nearby match pop-up (Go / No)', path: (ctx) => `/trip/${ctx.sampleTripId}/dashboard`, auth: 'maya', date: 'during', nearby: true },
  { id: '16B', page: 16, title: 'Dismissed', path: (ctx) => `/trip/${ctx.sampleTripId}/dashboard?s=nearby-dismissed`, auth: 'maya', date: 'during' },
];
