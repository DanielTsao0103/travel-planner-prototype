import type { ScreenEntry } from './types';

/** Screens for P03 (owned by that page's folder; keep in sync with its `s=` states). */
export const screens: ScreenEntry[] = [
  { id: '3A', page: 3, title: 'Simulated authorization (Instagram)', path: '/connect/instagram', auth: 'new', overlay: true },
  { id: '3B', page: 3, title: 'Connecting…', path: '/connect/gmail?s=connecting', auth: 'new', overlay: true, notes: 'Finishes connecting after a few seconds.' },
  { id: '3C', page: 3, title: 'Connected successfully', path: '/connect/instagram?s=success', auth: 'new', overlay: true },
  { id: '3D', page: 3, title: 'Canceled → back to checklist with a note', path: '/connect?s=canceled&svc=facebook', auth: 'new' },
  { id: '3E', page: 3, title: 'Connection failed → retry', path: '/connect/tiktok?s=failed', auth: 'new', overlay: true },
  { id: '3F', page: 3, title: 'Add a missing permission (already connected)', path: '/connect/instagram', auth: 'maya', overlay: true },
];
