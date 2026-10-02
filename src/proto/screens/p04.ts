import type { ScreenEntry } from './types';

/** Screens for P04 (owned by that page's folder; keep in sync with its `s=` states). */
export const screens: ScreenEntry[] = [
  { id: '4A', page: 4, title: 'Home (returning user)', path: '/home', auth: 'maya' },
  { id: '4B', page: 4, title: 'Home (brand-new user)', path: '/home', auth: 'new' },
  { id: '4C', page: 4, title: '3-line menu open', path: '/home?s=menu', auth: 'maya', overlay: true },
  { id: '4D', page: 4, title: 'Pre-planned trips “Coming soon”', path: '/home?s=menu', auth: 'maya', overlay: true },
  { id: '4E', page: 4, title: 'Suggestions loading', path: '/home?s=loading', auth: 'maya' },
  { id: '4F', page: 4, title: '“You’re on your trip” banner', path: '/home?s=on-trip', auth: 'maya', date: 'during' },
];
