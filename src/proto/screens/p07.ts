import type { ScreenEntry } from './types';

/** Screens for P07 (owned by that page's folder; keep in sync with its `s=` states). */
export const screens: ScreenEntry[] = [
  { id: '7A', page: 7, title: 'Add event — manual entry', path: (ctx) => `/trip/${ctx.sampleTripId}/event/new`, auth: 'maya' },
  { id: '7B', page: 7, title: 'Crowd estimate for the chosen place and time', path: (ctx) => `/trip/${ctx.sampleTripId}/event/new?s=busy`, auth: 'maya' },
  { id: '7C', page: 7, title: 'Time conflict warning', path: (ctx) => `/trip/${ctx.sampleTripId}/event/new?s=conflict`, auth: 'maya' },
  { id: '7D', page: 7, title: 'Upload a confirmation screenshot', path: (ctx) => `/trip/${ctx.sampleTripId}/event/new?tab=upload`, auth: 'maya' },
  { id: '7E', page: 7, title: 'Reading the screenshot…', path: (ctx) => `/trip/${ctx.sampleTripId}/event/new?tab=upload&s=reading`, auth: 'maya' },
  { id: '7F', page: 7, title: 'Review extracted details, fill the gaps', path: (ctx) => `/trip/${ctx.sampleTripId}/event/new?tab=upload&s=review`, auth: 'maya' },
  { id: '7G', page: 7, title: 'Unreadable image', path: (ctx) => `/trip/${ctx.sampleTripId}/event/new?tab=upload&s=unreadable`, auth: 'maya' },
  { id: '7H', page: 7, title: 'Edit an event', path: (ctx) => `/trip/${ctx.sampleTripId}/event/${ctx.sampleTripId}-e4`, auth: 'maya' },
  { id: '7I', page: 7, title: 'View-only event (Viewer)', path: (ctx) => `/trip/${ctx.sampleTripId}/event/${ctx.sampleTripId}-e4`, auth: 'maya', as: 'viewer' },
  { id: '7J', page: 7, title: 'Day editor: only assigned days', path: (ctx) => `/trip/${ctx.sampleTripId}/event/new`, auth: 'maya', as: 'day' },
];
