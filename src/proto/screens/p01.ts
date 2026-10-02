import type { ScreenEntry } from './types';

/** Screens for P01 (owned by that page's folder; keep in sync with its `s=` states). */
export const screens: ScreenEntry[] = [
  { id: '1A', page: 1, title: 'Log in (default)', path: '/login', auth: 'none' },
  { id: '1B', page: 1, title: 'Create account', path: '/signup', auth: 'none' },
  { id: '1C', page: 1, title: 'Error: email not on file', path: '/login?s=email-not-found', auth: 'none' },
  { id: '1D', page: 1, title: 'Error: password doesn’t match', path: '/login?s=wrong-password', auth: 'none' },
  { id: '1E', page: 1, title: 'Simulated Google/Apple account chooser', path: '/login?s=google-chooser', auth: 'none', overlay: true },
  { id: '1F', page: 1, title: 'Google/Apple account not found → create one', path: '/login?s=social-not-found', auth: 'none', overlay: true },
  { id: '1G', page: 1, title: 'Sign-up validation errors', path: '/signup?s=errors', auth: 'none' },
  { id: '1H', page: 1, title: 'Submitting (loading)', path: '/login?s=loading', auth: 'none' },
];
