import type { ScreenEntry } from './types';

/** Screens for P05 (owned by that page's folder; keep in sync with its `s=` states). */
export const screens: ScreenEntry[] = [
  {
    id: '5A',
    page: 5,
    title: 'My trips: sample, upcoming, past, pending invitation',
    path: '/trips',
    auth: 'maya',
    notes: 'Accept → preferences survey (Page 15) for that trip; Decline asks first. Viewers see “Add event” locked.',
  },
  { id: '5B', page: 5, title: 'Empty (no trips)', path: '/trips?s=empty', auth: 'maya', notes: 'Also shown when the Prototype hides the sample trip and you have no other trips.' },
  { id: '5C', page: 5, title: 'Loading', path: '/trips?s=loading', auth: 'maya', notes: 'Also shows briefly with the Prototype’s Slow mode on.' },
  {
    id: '5D',
    page: 5,
    title: 'Just-created trip highlighted + next steps',
    path: '/trips?s=created',
    auth: 'maya',
    notes: 'Shown for real right after saving on Page 6. Forced: your newest non-sample trip (Zion Weekend for Maya).',
  },
  {
    id: '5E',
    page: 5,
    title: 'Past trip (view only)',
    path: '/trips?s=past',
    auth: 'maya',
    notes: 'Scrolls to the Past section; past trips open their itinerary and have no “Add event”.',
  },
];
