import type { ScreenEntry } from './types';

/** Screens for P15 (owned by that page's folder; keep in sync with its `s=` states). */
export const screens: ScreenEntry[] = [
  { id: '15A', page: 15, title: 'Survey step 1: food & dietary', path: '/survey?step=1', auth: 'new' },
  { id: '15B', page: 15, title: 'Step 2: dining style', path: '/survey?step=2', auth: 'new' },
  { id: '15C', page: 15, title: 'Step 3: interests', path: '/survey?step=3', auth: 'new' },
  { id: '15D', page: 15, title: 'Step 4: accessibility & limits', path: '/survey?step=4', auth: 'new' },
  { id: '15E', page: 15, title: 'Step 5: review', path: '/survey?step=5', auth: 'maya' },
  { id: '15F', page: 15, title: 'Validation', path: '/survey?step=4&s=errors', auth: 'new' },
  { id: '15G', page: 15, title: 'Saved → group tiles updated', path: (ctx) => `/trip/${ctx.sampleTripId}/people?s=saved`, auth: 'maya' },
  { id: '15H', page: 15, title: 'Editing an existing response', path: '/survey', auth: 'maya' },
];
