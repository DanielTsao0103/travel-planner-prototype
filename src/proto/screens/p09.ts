import type { ScreenEntry } from './types';

/** Screens for P09 (owned by that page's folder; keep in sync with its `s=` states). */
export const screens: ScreenEntry[] = [
  { id: '9A', page: 9, title: 'Suggestions with “Since you planned…”', path: (ctx) => `/trip/${ctx.sampleTripId}/ideas`, auth: 'maya', date: 'during' },
  { id: '9B', page: 9, title: 'Pick a day and time', path: (ctx) => `/trip/${ctx.sampleTripId}/ideas?s=add`, auth: 'maya', date: 'during', overlay: true },
  { id: '9C', page: 9, title: 'Conflict shown before adding', path: (ctx) => `/trip/${ctx.sampleTripId}/ideas?s=conflict`, auth: 'maya', date: 'during', overlay: true, notes: '“Pick another time” jumps to the nearest free slot.' },
  { id: '9D', page: 9, title: 'Declined (with undo)', path: (ctx) => `/trip/${ctx.sampleTripId}/ideas?s=declined`, auth: 'maya', date: 'during' },
  { id: '9E', page: 9, title: 'Empty / all reviewed', path: (ctx) => `/trip/${ctx.sampleTripId}/ideas?s=empty`, auth: 'maya' },
  { id: '9F', page: 9, title: 'Viewer: can decline, Add locked', path: (ctx) => `/trip/${ctx.sampleTripId}/ideas`, auth: 'maya', as: 'viewer', date: 'during' },
  { id: '9G', page: 9, title: 'Before the trip (no live location)', path: (ctx) => `/trip/${ctx.sampleTripId}/ideas`, auth: 'maya', date: 'before' },
  { id: '9H', page: 9, title: 'Live ideas: couldn’t load', path: '/trip/trip-zion/ideas?s=live-error', auth: 'maya', notes: 'Retry fetches real places from OpenStreetMap.' },
  { id: '9I', page: 9, title: 'Live ideas from OpenStreetMap (a trip without bundled ideas)', path: '/trip/trip-zion/ideas', auth: 'maya', notes: 'Shows loading cards first; ideas are saved so they aren’t refetched on every visit.' },
  { id: '9J', page: 9, title: 'One day picked (from an empty day on the itinerary)', path: (ctx) => `/trip/${ctx.sampleTripId}/ideas?day=${ctx.day(6)}`, auth: 'maya', date: 'during' },
];
