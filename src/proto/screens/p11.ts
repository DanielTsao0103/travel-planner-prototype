import type { ScreenEntry } from './types';

/** Screens for P11 (owned by that page's folder; keep in sync with its `s=` states). */
export const screens: ScreenEntry[] = [
  { id: '11A', page: 11, title: 'Day timeline (today)', path: (ctx) => `/trip/${ctx.sampleTripId}/day/${ctx.day(2)}`, auth: 'maya', date: 'during' },
  { id: '11B', page: 11, title: 'Empty day', path: (ctx) => `/trip/${ctx.sampleTripId}/day/${ctx.day(6)}`, auth: 'maya', date: 'during' },
  { id: '11C', page: 11, title: 'Viewer: read-only', path: (ctx) => `/trip/${ctx.sampleTripId}/day/${ctx.day(2)}`, auth: 'maya', as: 'viewer', date: 'during' },
  { id: '11D', page: 11, title: 'Day editor on their day (Day 3)', path: (ctx) => `/trip/${ctx.sampleTripId}/day/${ctx.day(3)}`, auth: 'maya', as: 'day', date: 'during' },
  { id: '11E', page: 11, title: 'Opened from Calendar (trip/day picker)', path: '/calendar', auth: 'maya' },
];
