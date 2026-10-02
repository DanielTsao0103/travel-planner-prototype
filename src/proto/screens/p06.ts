import type { ScreenEntry } from './types';

/** Screens for P06 (owned by that page's folder; keep in sync with its `s=` states). */
export const screens: ScreenEntry[] = [
  {
    id: '6A',
    page: 6,
    title: 'Create trip (blank, gray placeholder)',
    path: '/trips/new',
    auth: 'maya',
    notes: 'Live city search for any city (OpenStreetMap), with an offline fallback list.',
  },
  { id: '6B', page: 6, title: 'Validation errors', path: '/trips/new?s=errors', auth: 'maya' },
  {
    id: '6C',
    page: 6,
    title: 'Multiple destinations + invitees (all Viewer)',
    path: '/trips/new?s=filled',
    auth: 'maya',
    notes: '“Bachelorette weekend”: Nashville + New Orleans, two fictional @example.com invitees.',
  },
  { id: '6D', page: 6, title: 'Saving', path: '/trips/new?s=saving', auth: 'maya', notes: 'Saving for real goes to Page 5 with the new trip highlighted (5D).' },
  {
    id: '6E',
    page: 6,
    title: 'Edit trip (Owner)',
    path: (ctx) => `/trip/${ctx.sampleTripId}/edit`,
    auth: 'maya',
    notes: 'Move the start date to offer “Move all events with the new dates”; shorten it to see the events-outside error.',
  },
  { id: '6F', page: 6, title: 'No permission to edit (Viewer)', path: (ctx) => `/trip/${ctx.sampleTripId}/edit`, auth: 'maya', as: 'viewer' },
  {
    id: '6G',
    page: 6,
    title: 'Prefilled from a Home suggestion',
    path: '/trips/new?dest=kyoto',
    auth: 'maya',
    notes: 'From Page 4’s “Plan this trip”: Kyoto, 7 days starting a month out.',
  },
];
