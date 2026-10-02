import type { ScreenEntry } from './types';

/** Screens for P05 (owned by that page's folder; keep in sync with its `s=` states). */
export const screens: ScreenEntry[] = [
  { id: '5A', page: 5, title: 'My trips: sample, upcoming, past, pending invitation', path: '/trips', auth: 'maya' },
  { id: '5B', page: 5, title: 'Empty (no trips)', path: '/trips?s=empty', auth: 'maya' },
  { id: '5C', page: 5, title: 'Loading', path: '/trips?s=loading', auth: 'maya' },
  { id: '5D', page: 5, title: 'Just-created trip highlighted + next steps', path: '/trips?s=created', auth: 'maya' },
  { id: '5E', page: 5, title: 'Past trip (view only)', path: '/trips?s=past', auth: 'maya' },
];
