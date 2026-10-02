import type { ScreenEntry } from './types';

/** Screens for P17 (owned by that page's folder; keep in sync with its `s=` states). */
export const screens: ScreenEntry[] = [
  { id: '17A', page: 17, title: 'Map: area, your simulated location, places', path: (ctx) => `/trip/${ctx.sampleTripId}/map`, auth: 'maya', date: 'during' },
  { id: '17B', page: 17, title: 'Route to a place (time, distance, steps)', path: (ctx) => `/trip/${ctx.sampleTripId}/map?to=padaria-celeste`, auth: 'maya', date: 'during' },
  { id: '17C', page: 17, title: 'Layer filters', path: (ctx) => `/trip/${ctx.sampleTripId}/map?s=layers`, auth: 'maya', date: 'during' },
  { id: '17D', page: 17, title: 'Not at the destination yet', path: (ctx) => `/trip/${ctx.sampleTripId}/map`, auth: 'maya', date: 'before' },
  { id: '17E', page: 17, title: 'Routing unavailable → straight-line estimate', path: (ctx) => `/trip/${ctx.sampleTripId}/map?to=santa-justa&s=route-error`, auth: 'maya', date: 'during' },
];
