import type { ScreenEntry } from './types';

/** Screens for P12 (owned by that page's folder; keep in sync with its `s=` states). */
export const screens: ScreenEntry[] = [
  { id: '12A', page: 12, title: 'Group budget overview', path: (ctx) => `/trip/${ctx.sampleTripId}/budget`, auth: 'maya', date: 'during' },
  { id: '12B', page: 12, title: 'Individual budgets', path: (ctx) => `/trip/${ctx.sampleTripId}/budget?s=individual`, auth: 'maya', date: 'during' },
  { id: '12C', page: 12, title: 'Add expense / “I paid for…”', path: (ctx) => `/trip/${ctx.sampleTripId}/budget?s=add`, auth: 'maya', date: 'during', overlay: true },
  { id: '12D', page: 12, title: 'Scan a receipt', path: (ctx) => `/trip/${ctx.sampleTripId}/budget?s=scan`, auth: 'maya', date: 'during', overlay: true },
  { id: '12E', page: 12, title: 'Gmail receipt match (demo data)', path: (ctx) => `/trip/${ctx.sampleTripId}/budget?s=matches`, auth: 'maya', date: 'during' },
  { id: '12F', page: 12, title: 'Bank alert (demo data)', path: (ctx) => `/trip/${ctx.sampleTripId}/budget?s=matches`, auth: 'maya', date: 'during' },
  { id: '12G', page: 12, title: 'Reimbursement log + mark paid', path: (ctx) => `/trip/${ctx.sampleTripId}/budget?tab=owed`, auth: 'maya', date: 'during' },
  { id: '12H', page: 12, title: 'Budget settings (Owner)', path: (ctx) => `/trip/${ctx.sampleTripId}/budget?s=settings`, auth: 'maya', date: 'during', overlay: true },
  { id: '12I', page: 12, title: 'Over budget', path: (ctx) => `/trip/${ctx.sampleTripId}/budget?s=over`, auth: 'maya', date: 'during' },
  { id: '12J', page: 12, title: 'Empty budget, amount not set', path: '/trip/trip-zion/budget', auth: 'maya' },
  { id: '12K', page: 12, title: 'Gmail not connected → connect', path: (ctx) => `/trip/${ctx.sampleTripId}/budget?s=no-gmail`, auth: 'maya', date: 'during' },
];
