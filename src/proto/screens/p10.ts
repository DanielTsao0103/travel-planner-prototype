import type { ScreenEntry } from './types';

/** Screens for P10 (owned by that page's folder; keep in sync with its `s=` states). */
export const screens: ScreenEntry[] = [
  { id: '10A', page: 10, title: 'Active day: week calendar, to-do, where to next', path: (ctx) => `/trip/${ctx.sampleTripId}/dashboard`, auth: 'maya', date: 'during' },
  { id: '10B', page: 10, title: 'Auto-opened banner', path: (ctx) => `/trip/${ctx.sampleTripId}/dashboard?auto=1`, auth: 'maya', date: 'during' },
  { id: '10C', page: 10, title: 'Locked before the trip', path: (ctx) => `/trip/${ctx.sampleTripId}/dashboard`, auth: 'maya', date: 'before' },
  { id: '10D', page: 10, title: 'Trip ended', path: (ctx) => `/trip/${ctx.sampleTripId}/dashboard`, auth: 'maya', date: 'after' },
  { id: '10E', page: 10, title: 'Hosts the nearby pop-up (Page 16)', path: (ctx) => `/trip/${ctx.sampleTripId}/dashboard`, auth: 'maya', date: 'during', nearby: true },
];
