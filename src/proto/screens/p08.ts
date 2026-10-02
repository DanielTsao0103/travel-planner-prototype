import type { ScreenEntry } from './types';

/** Screens for P08 (owned by that page's folder; keep in sync with its `s=` states). */
export const screens: ScreenEntry[] = [
  { id: '8A', page: 8, title: 'Itinerary: multi-day list with an empty day', path: (ctx) => `/trip/${ctx.sampleTripId}`, auth: 'maya' },
  { id: '8B', page: 8, title: 'New trip, every day empty', path: '/trip/trip-zion', auth: 'maya' },
  { id: '8C', page: 8, title: 'Newly added event highlighted', path: (ctx) => `/trip/${ctx.sampleTripId}?s=highlight`, auth: 'maya' },
  { id: '8D', page: 8, title: 'Viewer: read-only', path: (ctx) => `/trip/${ctx.sampleTripId}`, auth: 'maya', as: 'viewer' },
  { id: '8E', page: 8, title: 'Past trip', path: '/trip/trip-banff', auth: 'maya' },
  { id: '8F', page: 8, title: 'Loading', path: (ctx) => `/trip/${ctx.sampleTripId}?s=loading`, auth: 'maya' },
];
