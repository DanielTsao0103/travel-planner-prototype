import type { ScreenEntry } from './types';

/** Screens for P15 (owned by that page's folder; keep in sync with its `s=` states). */
export const screens: ScreenEntry[] = [
  { id: '15A', page: 15, title: 'Survey step 1: food & dietary', path: '/survey?step=1', auth: 'new', notes: 'Diets, allergies with Mild / Severe, or “No restrictions”.' },
  { id: '15B', page: 15, title: 'Step 2: dining style', path: '/survey?step=2', auth: 'new', notes: 'Local delights ↔ Taste of home, Simple ↔ Extravagant, spend per meal, atmosphere.' },
  { id: '15C', page: 15, title: 'Step 3: interests', path: '/survey?step=3', auth: 'new', notes: 'Sights (ancient & historic, modern, cultural…) and things to do.' },
  { id: '15D', page: 15, title: 'Step 4: accessibility & limits', path: '/survey?step=4', auth: 'new', notes: 'Mobility aid, step-free entrances, walking limit, tickets, other needs.' },
  { id: '15E', page: 15, title: 'Step 5: review', path: '/survey?step=5', auth: 'maya', notes: 'Answers per step with Edit links, plus “How the group sees this”.' },
  { id: '15F', page: 15, title: 'Validation', path: '/survey?step=4&s=errors', auth: 'new', notes: 'Walking limit and tickets are required (step 1 needs a pick or “No restrictions”).' },
  {
    id: '15G',
    page: 15,
    title: 'Saved → group tiles updated',
    path: (ctx) => `/trip/${ctx.sampleTripId}/people?s=saved`,
    auth: 'maya',
    notes: 'Success banner on Page 13 with the signed-in person’s answers highlighted in the tiles.',
  },
  { id: '15H', page: 15, title: 'Editing an existing response', path: '/survey', auth: 'maya', notes: 'Prefilled from Maya’s saved answers; title “Update your preferences”.' },
];
