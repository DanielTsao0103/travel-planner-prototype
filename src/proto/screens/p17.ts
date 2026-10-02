import type { ScreenEntry } from './types';

/**
 * Screens for P17 (owned by src/pages/p17; keep in sync with MapPage.tsx).
 * Page params: `to` (bundled place id, event id, or idea id), `from=nearby`,
 * `layers=today,trip,ideas,food` (which layers start on),
 * `s=layers` (open the layer list), `s=route-error` (straight-line estimate).
 */
export const screens: ScreenEntry[] = [
  { id: '17A', page: 17, title: 'Map: area around you, simulated location, today’s places', path: (ctx) => `/trip/${ctx.sampleTripId}/map`, auth: 'maya', date: 'during' },
  {
    id: '17B',
    page: 17,
    title: 'Route to the nearby match (after “Go”): time, distance, steps',
    path: (ctx) => `/trip/${ctx.sampleTripId}/map?to=padaria-celeste&from=nearby`,
    auth: 'maya',
    date: 'during',
    notes: 'Includes “Add to today’s plan” (adds a 30-minute stop at the next 5-minute mark).',
  },
  { id: '17C', page: 17, title: 'Layer filters', path: (ctx) => `/trip/${ctx.sampleTripId}/map?s=layers`, auth: 'maya', date: 'during' },
  {
    id: '17D',
    page: 17,
    title: 'Not at the destination yet (no location dot)',
    path: (ctx) => `/trip/${ctx.sampleTripId}/map`,
    auth: 'maya',
    date: 'before',
    notes: 'Tap a place: the walk starts at the trip’s lodging instead of your location.',
  },
  { id: '17E', page: 17, title: 'Routing unavailable → straight-line estimate', path: (ctx) => `/trip/${ctx.sampleTripId}/map?to=santa-justa&s=route-error`, auth: 'maya', date: 'during' },
  { id: '17F', page: 17, title: 'Route to the next stop (event link) with food layer', path: (ctx) => `/trip/${ctx.sampleTripId}/map?to=${ctx.sampleTripId}-e7&layers=today,food`, auth: 'maya', date: 'during' },
  {
    id: '17G',
    page: 17,
    title: 'Viewer: “Add to today’s plan” is locked',
    path: (ctx) => `/trip/${ctx.sampleTripId}/map?to=padaria-celeste&from=nearby`,
    auth: 'maya',
    as: 'viewer',
    date: 'during',
  },
  { id: '17H', page: 17, title: 'Map from the menu (current trip, no trip tabs)', path: '/map', auth: 'maya', date: 'during' },
  {
    id: '17I',
    page: 17,
    title: 'A trip you created: live OpenStreetMap places to eat',
    path: '/trip/trip-zion/map?layers=trip,food',
    auth: 'maya',
    date: 'real',
    notes: 'Zion Weekend has no events yet. Food comes from Overpass (loading, then results or a “Try again” error).',
  },
];
