import type { ScreenEntry } from './types';

/**
 * Screens for P10 — the active-trip dashboard (src/pages/p10/).
 * No `s=` states: the trip phase comes from the demo clock (`clock=`), and
 * `auto=1` is the flag App adds when it opens the dashboard by itself.
 */
export const screens: ScreenEntry[] = [
  {
    id: '10A',
    page: 10,
    title: 'Active day: week calendar, to-do, where to next',
    path: (ctx) => `/trip/${ctx.sampleTripId}/dashboard`,
    auth: 'maya',
    date: 'during',
    notes: 'Desktop: week calendar with the to-do list beside it and a map strip below. Phone: day pills, today’s agenda, to-do, map card.',
  },
  {
    id: '10B',
    page: 10,
    title: 'Auto-opened banner',
    path: (ctx) => `/trip/${ctx.sampleTripId}/dashboard?auto=1`,
    auth: 'maya',
    date: 'during',
    notes: 'Also reached naturally: open Home while the demo clock is inside the trip.',
  },
  {
    id: '10C',
    page: 10,
    title: 'Locked before the trip',
    path: (ctx) => `/trip/${ctx.sampleTripId}/dashboard`,
    auth: 'maya',
    date: 'before',
    notes: 'Countdown and preview; the prototype hint can jump the demo clock into the trip.',
  },
  { id: '10D', page: 10, title: 'Trip ended', path: (ctx) => `/trip/${ctx.sampleTripId}/dashboard`, auth: 'maya', date: 'after', notes: 'Links to the itinerary and to settling up in Budget.' },
  { id: '10E', page: 10, title: 'Hosts the nearby pop-up (Page 16)', path: (ctx) => `/trip/${ctx.sampleTripId}/dashboard`, auth: 'maya', date: 'during', nearby: true },
  {
    id: '10F',
    page: 10,
    title: 'Viewer: to-dos locked except their own',
    path: (ctx) => `/trip/${ctx.sampleTripId}/dashboard`,
    auth: 'maya',
    as: 'viewer',
    date: 'during',
    notes: 'Priya can check off her own to-do; tapping any other checkbox explains why it’s locked.',
  },
];
