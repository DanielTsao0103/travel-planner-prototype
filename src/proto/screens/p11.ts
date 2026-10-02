import type { ScreenEntry } from './types';

/**
 * Screens for P11 — the day page (src/pages/p11/).
 * Page params: `focus=<eventId>` (scroll to and highlight an event) and
 * `from=calendar` (opened from the Home menu's Calendar: trip/day pickers).
 */
export const screens: ScreenEntry[] = [
  { id: '11A', page: 11, title: 'Day timeline (today)', path: (ctx) => `/trip/${ctx.sampleTripId}/day/${ctx.day(2)}`, auth: 'maya', date: 'during' },
  { id: '11B', page: 11, title: 'Empty day', path: (ctx) => `/trip/${ctx.sampleTripId}/day/${ctx.day(6)}`, auth: 'maya', date: 'during', notes: 'Shows the bundled ideas for Day 6.' },
  { id: '11C', page: 11, title: 'Viewer: read-only', path: (ctx) => `/trip/${ctx.sampleTripId}/day/${ctx.day(2)}`, auth: 'maya', as: 'viewer', date: 'during' },
  { id: '11D', page: 11, title: 'Day editor on their day (Day 3)', path: (ctx) => `/trip/${ctx.sampleTripId}/day/${ctx.day(3)}`, auth: 'maya', as: 'day', date: 'during' },
  { id: '11E', page: 11, title: 'Opened from Calendar (trip/day picker)', path: '/calendar', auth: 'maya' },
  { id: '11F', page: 11, title: 'Day editor on someone else’s day (Day 2)', path: (ctx) => `/trip/${ctx.sampleTripId}/day/${ctx.day(2)}`, auth: 'maya', as: 'day', date: 'during', notes: 'Locked banner with a shortcut to Day 3.' },
  {
    id: '11G',
    page: 11,
    title: 'Event highlighted (opened from the dashboard)',
    path: (ctx) => `/trip/${ctx.sampleTripId}/day/${ctx.day(2)}?focus=${ctx.sampleTripId}-e7`,
    auth: 'maya',
    date: 'during',
    notes: 'Same as tapping Santa Justa Lift in the dashboard’s week calendar.',
  },
];
