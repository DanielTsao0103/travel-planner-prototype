/**
 * The four services a new user can connect on Page 2 (via the simulated
 * authorization flow on Page 3). Permission lists are illustrative — see the
 * README's "Production notes" for what the real APIs do and don't allow.
 */

import type { Connection, ServiceId, ServicePermission } from './types';

export interface ServiceInfo {
  id: ServiceId;
  name: string;
  /** One-line summary of why you'd connect it. */
  tagline: string;
  /** Features you lose if you skip it (Page 2's Skip warning). */
  lostFeatures: string[];
  permissions: Omit<ServicePermission, 'granted'>[];
  /** Extra explanation shown under the row. */
  note?: string;
}

export const SERVICES: ServiceInfo[] = [
  {
    id: 'instagram',
    name: 'Instagram',
    tagline: 'Turn saved travel Reels and posts into trip ideas.',
    lostFeatures: ['Importing saved travel Reels and posts as trip ideas', 'Pinning Instagram finds on your trip map'],
    permissions: [
      { key: 'profile', label: 'See your basic profile (name and photo)', unlocks: 'Links your Instagram name to your profile', required: true },
      { key: 'saved', label: 'Read saved posts and Reels you choose to import', unlocks: 'Saved Reels become trip ideas', required: false },
      { key: 'locations', label: 'Read location tags on posts you import', unlocks: 'Imported ideas get pinned on the map', required: false },
    ],
  },
  {
    id: 'facebook',
    name: 'Facebook',
    tagline: 'Find friends to invite and add events you’re going to.',
    lostFeatures: ['Finding Facebook friends to invite to trips', 'Adding Facebook events you’re attending to your itinerary'],
    permissions: [
      { key: 'profile', label: 'See your basic profile (name and photo)', unlocks: 'Links your Facebook name to your profile', required: true },
      { key: 'friends', label: 'See which of your friends also use the app', unlocks: 'Invite friends in one tap', required: false },
      { key: 'events', label: 'Read events you’ve said you’re going to', unlocks: 'Add those events to a trip', required: false },
    ],
  },
  {
    id: 'tiktok',
    name: 'TikTok',
    tagline: 'Save travel videos you find as ideas for your trip.',
    lostFeatures: ['Saving TikTok travel videos as trip ideas'],
    permissions: [
      { key: 'profile', label: 'See your basic profile (display name and avatar)', unlocks: 'Links your TikTok name to your profile', required: true },
      { key: 'videos', label: 'Read videos you choose to import', unlocks: 'Imported videos become trip ideas', required: false },
    ],
  },
  {
    id: 'gmail',
    name: 'Gmail',
    tagline: 'Match receipts and bookings from your inbox automatically.',
    lostFeatures: [
      'Matching email receipts to your trip budget automatically',
      'Importing flight, hotel, and ticket confirmations into your itinerary',
    ],
    permissions: [
      { key: 'receipts', label: 'Read receipts from travel and shopping senders (read-only)', unlocks: 'Receipts are matched to your budget', required: true },
      { key: 'confirmations', label: 'Read booking confirmations (flights, hotels, tickets)', unlocks: 'Bookings appear in your itinerary', required: false },
    ],
    note: 'Signing in with Google only shares your name, email address, and photo. Reading Gmail needs this separate permission.',
  },
];

export function getService(id: ServiceId): ServiceInfo {
  const found = SERVICES.find((s) => s.id === id);
  if (!found) throw new Error(`Unknown service ${id}`);
  return found;
}

/** Fresh, unconnected rows for a new account. */
export function freshConnections(): Connection[] {
  return SERVICES.map((s) => ({
    service: s.id,
    status: 'not-connected' as const,
    permissions: s.permissions.map((p) => ({ ...p, granted: false })),
  }));
}

/** Connected with the given permission keys granted. */
export function connectedWith(service: ServiceId, grantedKeys: string[]): Connection {
  const info = getService(service);
  return {
    service,
    status: 'connected',
    lastResult: 'success',
    connectedAt: '2026-09-02T17:00:00.000Z',
    permissions: info.permissions.map((p) => ({ ...p, granted: grantedKeys.includes(p.key) })),
  };
}
