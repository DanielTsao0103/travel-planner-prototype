import type { ScreenEntry } from './types';

/** Screens for P06 (owned by that page's folder; keep in sync with its `s=` states). */
export const screens: ScreenEntry[] = [
  { id: '6A', page: 6, title: 'Create trip (blank, gray placeholder)', path: '/trips/new', auth: 'maya' },
  { id: '6B', page: 6, title: 'Validation errors', path: '/trips/new?s=errors', auth: 'maya' },
  { id: '6C', page: 6, title: 'Multiple destinations + invitees (all Viewer)', path: '/trips/new?s=filled', auth: 'maya' },
  { id: '6D', page: 6, title: 'Saving', path: '/trips/new?s=saving', auth: 'maya' },
  { id: '6E', page: 6, title: 'Edit trip (Owner)', path: (ctx) => `/trip/${ctx.sampleTripId}/edit`, auth: 'maya' },
  { id: '6F', page: 6, title: 'No permission to edit (Viewer)', path: (ctx) => `/trip/${ctx.sampleTripId}/edit`, auth: 'maya', as: 'viewer' },
];
