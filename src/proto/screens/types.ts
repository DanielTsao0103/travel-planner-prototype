/**
 * Screen index registry types. Each page folder contributes a list of the
 * screens/states it implements, with a deep link that reproduces the state.
 *
 * Deep-link query params understood by the app (see App.tsx):
 *   auth=maya    sign in as the returning demo user (Maya Chen)
 *   auth=new     create a fresh demo account (Alex Rivera) and sign in
 *   as=owner|editor|day|viewer   "View as" role
 *   clock=before|during|after|real|YYYY-MM-DD (+ time=HH:MM)   demo clock
 *   (date=before|during|after|real also works; a real date in `date=` is for the page)
 *   nearby=1     trigger the Page 16 pop-up
 *   s=<key>      page-specific forced state (documented per page)
 */

export interface ScreenContext {
  /** Maya's copy of the sample trip. */
  sampleTripId: string;
  /** ISO date of sample-trip day n (1-based). */
  day: (n: number) => string;
}

export interface ScreenEntry {
  /** Plan id, e.g. '8A'. */
  id: string;
  page: number;
  title: string;
  /** Path + page-specific params, built at runtime. */
  path: string | ((ctx: ScreenContext) => string);
  /** Sign-in needed for the link (default 'maya'). */
  auth?: 'none' | 'maya' | 'new';
  as?: 'owner' | 'editor' | 'day' | 'viewer';
  date?: 'before' | 'during' | 'after' | 'real';
  nearby?: boolean;
  /** Overlay/dialog state (opened on top of a page). */
  overlay?: boolean;
  notes?: string;
}
