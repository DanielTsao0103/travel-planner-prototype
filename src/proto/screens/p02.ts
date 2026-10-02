import type { ScreenEntry } from './types';

/** Screens for P02 (owned by that page's folder; keep in sync with its `s=` states). */
export const screens: ScreenEntry[] = [
  { id: '2A', page: 2, title: 'Checklist, nothing connected', path: '/connect', auth: 'new' },
  { id: '2B', page: 2, title: 'Partly connected, one permission still needed', path: '/connect?s=partial', auth: 'new' },
  { id: '2C', page: 2, title: 'All connected → Continue', path: '/connect?s=all', auth: 'new' },
  { id: '2D', page: 2, title: 'Skip warning (features you’d lose)', path: '/connect?s=skip', auth: 'new', overlay: true },
  { id: '2E', page: 2, title: 'Connected accounts (returning user, “Done”)', path: '/connect', auth: 'maya', notes: 'Same page after onboarding: no step counter or Skip.' },
];
