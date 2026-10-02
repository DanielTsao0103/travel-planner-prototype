import type { ScreenEntry } from './types';

/**
 * Screens for P12 (owned by that page's folder; keep in sync with its `s=` states).
 *
 * Page 12 reads:
 *   s=individual  preview individual budgets (render only; saved mode unchanged)
 *   s=add         open "Add expense"            s=scan      open "Scan receipt"
 *   s=settings    open "Budget settings"         s=over      preview a $3,000 group total (render only)
 *   s=no-gmail    preview Gmail as not connected s=matches   scroll to "Needs review"
 *   tab=owed      open "Who owes whom"           tab=categories  phone "Categories" view
 */
export const screens: ScreenEntry[] = [
  { id: '12A', page: 12, title: 'Group budget overview', path: (ctx) => `/trip/${ctx.sampleTripId}/budget`, auth: 'maya', date: 'during', notes: 'KPI row, pie with a “Left to spend” slice, expense log, summary bar pinned to the bottom.' },
  { id: '12B', page: 12, title: 'Individual budgets', path: (ctx) => `/trip/${ctx.sampleTripId}/budget?s=individual`, auth: 'maya', date: 'during', notes: 'Preview only: renders individual mode without changing the saved budget mode.' },
  { id: '12C', page: 12, title: 'Add expense / “I paid for…”', path: (ctx) => `/trip/${ctx.sampleTripId}/budget?s=add`, auth: 'maya', date: 'during', overlay: true },
  { id: '12D', page: 12, title: 'Scan a receipt', path: (ctx) => `/trip/${ctx.sampleTripId}/budget?s=scan`, auth: 'maya', date: 'during', overlay: true, notes: 'Camera/photo input or a fictional sample receipt. Reading is simulated; photos never leave the browser.' },
  { id: '12E', page: 12, title: 'Gmail receipt match (demo data)', path: (ctx) => `/trip/${ctx.sampleTripId}/budget?s=matches`, auth: 'maya', date: 'during' },
  { id: '12F', page: 12, title: 'Bank alert (demo data)', path: (ctx) => `/trip/${ctx.sampleTripId}/budget?s=matches`, auth: 'maya', date: 'during' },
  { id: '12G', page: 12, title: 'Reimbursement log + mark paid', path: (ctx) => `/trip/${ctx.sampleTripId}/budget?tab=owed`, auth: 'maya', date: 'during' },
  { id: '12H', page: 12, title: 'Budget settings (Owner)', path: (ctx) => `/trip/${ctx.sampleTripId}/budget?s=settings`, auth: 'maya', date: 'during', overlay: true },
  { id: '12I', page: 12, title: 'Over budget', path: (ctx) => `/trip/${ctx.sampleTripId}/budget?s=over`, auth: 'maya', date: 'during', notes: 'Preview only: renders as if the group total were $3,000.' },
  { id: '12J', page: 12, title: 'Empty budget, amount not set', path: '/trip/trip-zion/budget', auth: 'maya' },
  { id: '12K', page: 12, title: 'Gmail not connected → connect', path: (ctx) => `/trip/${ctx.sampleTripId}/budget?s=no-gmail`, auth: 'maya', date: 'during' },
  { id: '12L', page: 12, title: 'Viewer: settings locked, can still log expenses', path: (ctx) => `/trip/${ctx.sampleTripId}/budget`, auth: 'maya', as: 'viewer', date: 'during' },
  { id: '12M', page: 12, title: 'Jordan marks repayments he’s owed as paid', path: (ctx) => `/trip/${ctx.sampleTripId}/budget?tab=owed`, auth: 'maya', as: 'editor', date: 'during' },
  { id: '12N', page: 12, title: 'Spending by category list (phone)', path: (ctx) => `/trip/${ctx.sampleTripId}/budget?tab=categories`, auth: 'maya', date: 'during', notes: 'Phone layout only; desktop shows the same breakdown in the pie legend.' },
  { id: '12O', page: 12, title: 'New account: Gmail not connected', path: '/budget', auth: 'new', notes: 'Opens the new account’s own sample trip, before the trip starts.' },
];
