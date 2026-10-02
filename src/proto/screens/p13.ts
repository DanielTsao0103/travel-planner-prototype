import type { ScreenEntry } from './types';

/** Screens for P13 (owned by that page's folder; keep in sync with its `s=` states). */
export const screens: ScreenEntry[] = [
  { id: '13A', page: 13, title: 'Food & dining tiles', path: (ctx) => `/trip/${ctx.sampleTripId}/people`, auth: 'maya' },
  { id: '13B', page: 13, title: 'Travel preferences & limitations tiles', path: (ctx) => `/trip/${ctx.sampleTripId}/people?section=travel`, auth: 'maya' },
  { id: '13C', page: 13, title: 'Collaborators (Owner can manage)', path: (ctx) => `/trip/${ctx.sampleTripId}/people?section=collaborators`, auth: 'maya' },
  { id: '13D', page: 13, title: 'Change role / assign days', path: (ctx) => `/trip/${ctx.sampleTripId}/people?s=role`, auth: 'maya', overlay: true },
  { id: '13E', page: 13, title: 'Invite a collaborator', path: (ctx) => `/trip/${ctx.sampleTripId}/people?s=invite`, auth: 'maya', overlay: true },
  { id: '13F', page: 13, title: 'Remove a collaborator', path: (ctx) => `/trip/${ctx.sampleTripId}/people?s=remove`, auth: 'maya', overlay: true },
  { id: '13G', page: 13, title: 'Non-owner: roles read-only', path: (ctx) => `/trip/${ctx.sampleTripId}/people`, auth: 'maya', as: 'viewer' },
  { id: '13H', page: 13, title: 'Response count + pending invitee', path: (ctx) => `/trip/${ctx.sampleTripId}/people?section=collaborators`, auth: 'maya' },
];
