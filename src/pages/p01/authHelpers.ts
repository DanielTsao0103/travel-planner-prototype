/**
 * Page 1 helpers: validation rules and messages, the fictional accounts shown
 * in the simulated Google/Apple chooser, and a tiny in-memory "carry" so an
 * email typed on Log in follows the user to Create account (and back) without
 * being put in the URL.
 */

import type { Account, AppState } from '../../data/types';
import { DEMO_PASSWORD } from '../../data/seed';
import { looksLikeEmail } from '../../lib/format';

/** The returning demo user's email (shown in the demo hint card). */
export const DEMO_EMAIL = 'maya.chen@example.com';
export { DEMO_PASSWORD };

/** Google and Apple are the two "social" sign-in options. */
export type SocialProvider = 'google' | 'apple';

export const PROVIDER_NAME: Record<SocialProvider, string> = {
  google: 'Google',
  apple: 'Apple',
};

/** A fictional account offered by the simulated Google/Apple account chooser. */
export interface ProviderAccount {
  name: string;
  email: string;
  /** Avatar color token name (see --av-1 … --av-8 in tokens.css). */
  color: string;
}

/**
 * Accounts the simulated chooser lists. Maya already has a Wayfare account;
 * Alex doesn't, so picking Alex while logging in shows "No Wayfare account".
 */
export const CHOOSER_ACCOUNTS: ProviderAccount[] = [
  { name: 'Maya Chen', email: 'maya.chen@example.com', color: 'av-1' },
  { name: 'Alex Rivera', email: 'alex.rivera@example.com', color: 'av-2' },
];

/** Find an account by email, ignoring case and stray spaces. */
export function accountByEmail(s: AppState, email: string): Account | undefined {
  const wanted = email.trim().toLowerCase();
  return s.accounts.find((a) => a.email.toLowerCase() === wanted);
}

/* ------------------------------------------------------------ validation */

/** Password rules, shown as a live checklist while creating an account. */
export const PASSWORD_RULES: Array<{ id: 'length' | 'number'; label: string; test: (value: string) => boolean }> = [
  { id: 'length', label: 'At least 8 characters', test: (v) => v.length >= 8 },
  { id: 'number', label: 'One number', test: (v) => /\d/.test(v) },
];

/** Field-level error messages. Each one says what's wrong and how to fix it. */
export interface FormErrors {
  name?: string;
  email?: string;
  password?: string;
  /** Which inline follow-up to offer under the email error. */
  emailAction?: 'create-account' | 'log-in';
}

/** Check an email field; returns an error message or null. */
export function emailProblem(email: string): string | null {
  if (!email.trim()) return 'Enter your email address.';
  if (!looksLikeEmail(email)) return 'Enter an email address like name@example.com.';
  return null;
}

/** Check a new password against the rules; returns a specific message or null. */
export function passwordProblem(password: string): string | null {
  if (!password) return 'Create a password.';
  const longEnough = password.length >= 8;
  const hasNumber = /\d/.test(password);
  if (!longEnough && !hasNumber) return 'Use at least 8 characters and include one number.';
  if (!longEnough) return `Use at least 8 characters. This one has ${password.length}.`;
  if (!hasNumber) return 'Include at least one number.';
  return null;
}

/* ----------------------------------------------------------- copy helpers */

export const msg = {
  emailNotFound: (email: string) => `We don’t have an account for ${email.trim()}.`,
  wrongPassword: (email: string) => `That password doesn’t match ${email.trim()}. Check it and try again.`,
  /** The account exists but was created with Google/Apple, so it has no password. */
  socialOnly: (email: string, provider: string) => `${email.trim()} signs in with ${provider}. Use “Continue with ${provider}” above.`,
  emailInUse: (email: string) => `${email.trim()} already has an account.`,
};

/** 'jamie.lee@example.com' → 'Jamie Lee' (a name for "Use another account" sign-ups). */
export function nameFromEmail(email: string): string {
  const local = email.trim().split('@')[0] ?? '';
  const words = local
    .replace(/\+.*$/, '') // drop "+tags"
    .split(/[._-]+/)
    .filter(Boolean)
    .map((w) => w.replace(/\d+/g, ''))
    .filter(Boolean);
  if (words.length === 0) return 'New traveler';
  return words.map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase()).join(' ');
}

/**
 * Made-up details for the sign-up "Fill in example" button. Picks the first
 * jamie…@example.com address that isn't already taken in this browser.
 */
export function exampleIdentity(s: AppState): { name: string; email: string; password: string } {
  let n = 1;
  let email = 'jamie.lee@example.com';
  while (accountByEmail(s, email)) {
    n += 1;
    email = `jamie.lee${n}@example.com`;
  }
  return { name: 'Jamie Lee', email, password: 'trip-plan-24' };
}

/* ------------------------------------------------------------------ carry */

// Module-level (not React state) so it survives the Log in ↔ Create account
// switch, which remounts the form. The form reads it while rendering and
// clears it in an effect (React may render twice in development, so reading
// must not have side effects).
let carriedEmail = '';

/** Remember the typed email before switching between Log in and Create account. */
export function carryEmail(email: string): void {
  carriedEmail = email.trim();
}

/** Read the carried email without clearing it. */
export function peekCarriedEmail(): string {
  return carriedEmail;
}

/** Forget the carried email once the form has picked it up. */
export function clearCarriedEmail(): void {
  carriedEmail = '';
}
