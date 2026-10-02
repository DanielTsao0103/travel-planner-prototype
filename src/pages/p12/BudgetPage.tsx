/**
 * Page 12 — Budget & reimbursements (route /trip/:tripId/budget).
 *
 * A Ramp-style budget dashboard for one trip:
 *  - KPI row: Total budget · Spent · Left to spend (or "My budget · My share
 *    spent · I have left" when the host picked individual budgets)
 *  - Spending by category: a pie with a "Left to spend" slice (left column on desktop)
 *  - Needs review: simulated Gmail receipt matches and bank alerts (demo data)
 *  - Expenses log and "Who owes whom" ("Priya Nair owes Maya Chen $384.00")
 *  - A summary bar pinned to the bottom: total spent, left to spend, Scan receipt, Add expense
 *
 * Forced states for the screen index (?s=…): individual, add, scan, settings,
 * over, no-gmail, matches. Also ?tab=owed (and ?tab=categories on phones).
 * "individual", "over", and "no-gmail" only change what's rendered; they never
 * change saved data.
 */

import { useEffect, useState } from 'react';
import { PiggyBank } from 'lucide-react';
import type { BudgetMode, Expense, ExpenseCategory } from '../../data/types';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import { useTrip, type TripContext } from '../../hooks/useTrip';
import { relativeDays } from '../../lib/dates';
import { firstName } from '../../lib/format';
import {
  acceptedMemberIds,
  currentAccount,
  getPerson,
  personFirstName,
  shareOf,
  today as todayOf,
  tripEvents,
  visibleExpenses,
  visibleReimbursements,
} from '../../store/selectors';
import { navigate, withQuery } from '../../router/router';
import { paths } from '../../router/routes';
import { PageHeader } from '../../components/layout/PageHeader';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/Display';
import { Segmented } from '../../components/ui/Field';
import { biggestFirst, budgetFigures, categoryTotals, newestFirst, sumOf, tripProgressLabel } from './budgetMath';
import { BudgetHeader, BudgetKpis, OverBudgetBanner, type OverviewProps } from './BudgetOverview';
import { BudgetSettingsSheet, MyBudgetSheet } from './BudgetSettingsSheet';
import { CategoryBreakdown } from './CategoryBreakdown';
import { EmptyBudget } from './EmptyBudget';
import { DeleteExpenseSheet, ExpenseDetailSheet } from './ExpenseDetailSheet';
import type { Member } from './ExpenseForm';
import { ExpenseList } from './ExpenseList';
import { ExpenseSheet, type SheetContext } from './ExpenseSheet';
import { OwesLog } from './OwesLog';
import { ReviewQueue } from './ReviewQueue';
import { ScanReceiptSheet } from './ScanReceiptSheet';
import { SpendingCard } from './SpendingCard';
import { SummaryBar } from './SummaryBar';
import './p12.css';

/** s=over previews the page as if the group total were this (data is not changed). */
const OVER_PREVIEW_TOTAL = 3000;

type Tab = 'expenses' | 'owed' | 'categories';

type SheetState =
  | { kind: 'add' }
  | { kind: 'scan' }
  | { kind: 'settings' }
  | { kind: 'my-budget' }
  | { kind: 'detail'; id: string }
  | { kind: 'edit'; id: string }
  | { kind: 'delete'; id: string };

/** Overlay states that a deep link can open directly. */
const SHEET_KEYS = ['add', 'scan', 'settings'] as const;
/** `s=` values that are render-only previews; saving settings clears them. */
const PREVIEW_KEYS = ['individual', 'over', 'settings'];

/** Which sheet a deep link (?s=add|scan|settings) should open, if any. */
function sheetFromQuery(s: string | null): SheetState | null {
  return s === 'add' || s === 'scan' || s === 'settings' ? { kind: s } : null;
}

/** Which tab a deep link (?tab=owed|categories) should select (defaults to Expenses). */
function tabFromQuery(t: string | null): Tab {
  return t === 'owed' ? 'owed' : t === 'categories' ? 'categories' : 'expenses';
}

/** Route component for /trip/:tripId/budget. Shows a friendly message if the trip isn't available. */
export function BudgetPage({ tripId, query }: { tripId: string; query: URLSearchParams }) {
  const ctx = useTrip(tripId);
  if (!ctx) {
    return (
      <div className="container page">
        <PageHeader title="Budget" />
        <EmptyState icon={<PiggyBank />} title="This trip isn’t available" actions={<Button to={paths.trips()}>Go to My trips</Button>}>
          It may have been deleted, or you’re not on it.
        </EmptyState>
      </div>
    );
  }
  return <BudgetScreen ctx={ctx} query={query} />;
}

/**
 * The budget dashboard itself. Split out from BudgetPage so its hooks always
 * run in the same order (React rule: no hooks after an early return).
 */
function BudgetScreen({ ctx, query }: { ctx: TripContext; query: URLSearchParams }) {
  const { state, trip, access } = ctx;
  const bp = useBreakpoint();
  const isMobile = bp === 'mobile';
  const isDesktop = bp === 'desktop';
  const forced = query.get('s');
  const tabParam = query.get('tab');

  /* ------------------------------------------------------- who and what */
  const acting = access.actingPersonId;
  const isOwner = access.role === 'owner';
  const today = todayOf(state);
  const ownerFirst = personFirstName(state, trip.ownerId);
  const logLocked: string | false = access.canLogExpenses ? false : 'Accept the invitation to log expenses on this trip.';

  // Render-only previews: never write these to the saved trip.
  const mode: BudgetMode = forced === 'individual' ? 'individual' : trip.budget.mode;
  const individual = mode === 'individual';
  const groupAmount = forced === 'over' ? OVER_PREVIEW_TOTAL : trip.budget.groupAmount;
  const myBudget = trip.budget.personal[acting] ?? null;

  const expenses = newestFirst(visibleExpenses(state, trip.id), state.expenses);
  const expensesById = new Map(expenses.map((e) => [e.id, e]));
  const reimbursements = visibleReimbursements(state, trip.id);
  const groupSpent = sumOf(expenses.map((e) => e.amount));
  const mySpent = sumOf(expenses.map((e) => shareOf(e, acting)));
  const figures = budgetFigures(individual ? myBudget : groupAmount, individual ? mySpent : groupSpent);
  const amountOf = individual ? (e: Expense) => shareOf(e, acting) : (e: Expense) => e.amount;
  const allTotals = categoryTotals(expenses, amountOf);
  const pieTotals = biggestFirst(allTotals);

  // Accepted travelers, "you" first (used by the split chips and payer list).
  const accepted = acceptedMemberIds(trip);
  const memberIds = accepted.includes(acting) ? [acting, ...accepted.filter((id) => id !== acting)] : accepted;
  const members: Member[] = memberIds.map((id) => {
    const name = getPerson(state, id)?.name ?? 'Someone';
    return { id, name, short: id === acting ? 'You' : firstName(name) };
  });

  // Gmail matches need the signed-in account's Gmail connection (s=no-gmail previews it disconnected).
  const gmail = currentAccount(state)?.connections.find((c) => c.service === 'gmail');
  const gmailConnected = forced !== 'no-gmail' && gmail?.status === 'connected' && gmail.permissions.some((p) => p.key === 'receipts' && p.granted);
  const reviewItems = state.notifications
    .filter((n) => n.tripId === trip.id && n.status === 'new' && n.date <= today)
    .sort((a, b) => b.receivedAt.localeCompare(a.receivedAt));

  const isEmpty = expenses.length === 0 && (individual ? myBudget === null : groupAmount === null);

  /* ------------------------------------------------------------ UI state */
  const [sheet, setSheet] = useState<SheetState | null>(() => (logLocked && (forced === 'add' || forced === 'scan') ? null : sheetFromQuery(forced)));
  const [tab, setTab] = useState<Tab>(() => tabFromQuery(tabParam));
  const [category, setCategory] = useState<ExpenseCategory | 'all'>('all');
  const [activeSlice, setActiveSlice] = useState<string | null>(null);
  const [highlight, setHighlight] = useState<{ id: string; scroll: boolean } | null>(null);
  const [flashReview, setFlashReview] = useState(forced === 'matches');

  // Follow deep links that change while the page is open (screen index, back button).
  useEffect(() => {
    const next = sheetFromQuery(forced);
    if (next && !(logLocked && next.kind !== 'settings')) setSheet(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [forced]);
  useEffect(() => {
    if (!tabParam) return;
    setTab(tabFromQuery(tabParam));
    // Phones stack the tabs below the chart, so a deep link (?tab=owed) scrolls down to them.
    if (!isMobile || tabParam === 'expenses') return;
    const t = window.setTimeout(() => document.getElementById('p12-details')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 400);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabParam]);

  // s=matches: bring "Needs review" into view once the page has laid out, then stop the outline pulse.
  useEffect(() => {
    if (forced !== 'matches') return;
    setFlashReview(true);
    const scroll = window.setTimeout(() => document.getElementById('p12-review')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 400);
    const stop = window.setTimeout(() => setFlashReview(false), 3200);
    return () => {
      window.clearTimeout(scroll);
      window.clearTimeout(stop);
    };
  }, [forced]);

  // Briefly highlight a just-saved expense (and scroll to it when it came from a form).
  useEffect(() => {
    if (!highlight) return;
    const scroll = highlight.scroll
      ? window.setTimeout(() => document.getElementById(`p12-row-${highlight.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 180)
      : undefined;
    const clear = window.setTimeout(() => setHighlight(null), 3200);
    return () => {
      window.clearTimeout(scroll);
      window.clearTimeout(clear);
    };
  }, [highlight]);

  /* --------------------------------------------------------- navigation */
  /** Remove `s` from the address bar (so closing a deep-linked sheet doesn't reopen it on reload). */
  const clearForced = () => {
    const rest = Object.fromEntries(new URLSearchParams(query));
    delete rest.s;
    navigate(withQuery(paths.budget(trip.id), rest), { replace: true });
  };

  const closeSheet = () => {
    setSheet(null);
    if (forced && (SHEET_KEYS as readonly string[]).includes(forced)) clearForced();
  };

  const afterExpenseSaved = (id: string) => {
    closeSheet();
    setTab('expenses');
    setCategory('all');
    setHighlight({ id, scroll: true });
  };

  const pickCategory = (c: ExpenseCategory | 'all') => {
    setCategory(c);
    if (c === 'all') return;
    setTab('expenses');
    // On phones the list sits below the chart, so bring it into view.
    if (isMobile) window.setTimeout(() => document.getElementById('p12-details')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
  };

  const openAdd = () => setSheet({ kind: 'add' });
  const openScan = () => setSheet({ kind: 'scan' });
  const openSettings = () => setSheet({ kind: 'settings' });
  const openMyBudget = () => setSheet({ kind: 'my-budget' });

  /* --------------------------------------------------------- permissions */
  const canEdit = (e: Expense) => isOwner || e.createdById === acting;
  const editLockReason = (e: Expense) => {
    const creator = personFirstName(state, e.createdById);
    return e.createdById === trip.ownerId
      ? `Only ${ownerFirst} (who logged it and owns the trip) can change this expense.`
      : `Only ${creator} (who logged it) or ${ownerFirst} (the trip owner) can change this expense.`;
  };

  /* ------------------------------------------------------------- pieces */
  const setBy = trip.ownerId === acting ? 'you' : ownerFirst;
  const modeChip = individual
    ? `Individual budgets · chosen by ${setBy}`
    : groupAmount === null
      ? `Group budget · not set yet`
      : `Group budget · set by ${setBy}`;

  const overview: OverviewProps = {
    mode,
    modeChip,
    figures,
    isMobile,
    settingsLocked: access.canSetBudget ? false : access.lockReason('setBudget'),
    onOpenSettings: openSettings,
    onSetMyBudget: openMyBudget,
    expenseCount: expenses.length,
    groupSpent,
    progressLabel: tripProgressLabel(trip, today, relativeDays),
    setBy,
    ownerFirst,
    isOwner,
  };

  const sheetCtx: SheetContext = { trip, state, access, members, today, isMobile, ownerFirst };
  const filtered = category === 'all' ? expenses : expenses.filter((e) => e.category === category);
  const openOwed = reimbursements.filter((r) => r.status === 'open').length;

  const spending = (
    <SpendingCard
      totals={pieTotals}
      figures={figures}
      mode={mode}
      size={isMobile ? 200 : 216}
      activeKey={activeSlice}
      onActiveChange={setActiveSlice}
      selectedCategory={category}
      onPickCategory={pickCategory}
    />
  );

  const review = (
    <ReviewQueue
      trip={trip}
      events={tripEvents(state, trip.id)}
      items={reviewItems}
      gmailConnected={gmailConnected}
      actingPersonId={acting}
      acceptedIds={accepted}
      today={today}
      flash={flashReview}
      logLocked={logLocked}
      onLogged={(id) => setHighlight({ id, scroll: false })}
    />
  );

  const expenseList = (
    <ExpenseList
      expenses={filtered}
      allExpenses={expenses}
      state={state}
      actingPersonId={acting}
      mode={mode}
      isMobile={isMobile}
      category={category}
      onCategory={setCategory}
      highlightId={highlight?.id ?? null}
      canEdit={canEdit}
      editLockReason={editLockReason}
      onOpen={(e) => setSheet({ kind: 'detail', id: e.id })}
      onEdit={(e) => setSheet({ kind: 'edit', id: e.id })}
      onDelete={(e) => setSheet({ kind: 'delete', id: e.id })}
      onAdd={openAdd}
      onScan={openScan}
      logLocked={logLocked}
    />
  );

  const owesLog = (
    <OwesLog rows={reimbursements} state={state} actingPersonId={acting} expensesById={expensesById} isMobile={isMobile} onAdd={openAdd} logLocked={logLocked} />
  );

  // Desktop/tablet: underline tabs inside a card. Phones: a segmented control with a third "Categories" view.
  const deskTab: Exclude<Tab, 'categories'> = tab === 'owed' ? 'owed' : 'expenses';
  const details = isMobile ? (
    <section id="p12-details" className="p12-mtabs" aria-label="Budget details">
      <div className="p12-mtabs-seg">
        <Segmented<Tab>
          label="Show"
          value={tab}
          onChange={setTab}
          options={[
            { value: 'expenses', label: 'Expenses' },
            {
              value: 'owed',
              label: (
                <>
                  Owed{openOwed > 0 && <span className="p12-seg-count num">{openOwed}</span>}
                </>
              ),
            },
            { value: 'categories', label: 'Categories' },
          ]}
        />
      </div>
      <div className="p12-mtab-panel">
        {tab === 'owed' ? owesLog : tab === 'categories' ? <CategoryBreakdown totals={allTotals} spent={figures.spent} mode={mode} onPick={pickCategory} /> : expenseList}
      </div>
    </section>
  ) : (
    <section id="p12-details" className="p12-card p12-tabs-card" aria-label="Budget details">
      <div
        className="p12-tabs"
        role="tablist"
        aria-label="Budget details"
        onKeyDown={(e) => {
          // Tabs pattern: arrow keys move between tabs (only two, so either arrow flips).
          if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
          e.preventDefault();
          const next = deskTab === 'owed' ? 'expenses' : 'owed';
          setTab(next);
          document.getElementById(`p12-tab-${next}`)?.focus();
        }}
      >
        <button
          type="button"
          role="tab"
          id="p12-tab-expenses"
          aria-selected={deskTab === 'expenses'}
          aria-controls="p12-panel"
          tabIndex={deskTab === 'expenses' ? 0 : -1}
          className={`p12-tab ${deskTab === 'expenses' ? 'is-active' : ''}`}
          onClick={() => setTab('expenses')}
        >
          Expenses <span className="p12-count num">{expenses.length}</span>
        </button>
        <button
          type="button"
          role="tab"
          id="p12-tab-owed"
          aria-selected={deskTab === 'owed'}
          aria-controls="p12-panel"
          tabIndex={deskTab === 'owed' ? 0 : -1}
          className={`p12-tab ${deskTab === 'owed' ? 'is-active' : ''}`}
          onClick={() => setTab('owed')}
        >
          Who owes whom {openOwed > 0 && <span className="p12-count num">{openOwed} open</span>}
        </button>
      </div>
      <div id="p12-panel" role="tabpanel" aria-labelledby={deskTab === 'owed' ? 'p12-tab-owed' : 'p12-tab-expenses'} className="p12-tab-panel">
        {deskTab === 'owed' ? owesLog : expenseList}
      </div>
    </section>
  );

  /* -------------------------------------------------------------- sheets */
  const sheetExpense = sheet && 'id' in sheet ? state.expenses.find((x) => x.id === sheet.id) : undefined;
  const linkedTo = (id: string) => state.reimbursements.filter((r) => r.expenseId === id);

  return (
    <div className={`container page p12-page ${isMobile ? 'is-mobile' : ''}`}>
      <BudgetHeader {...overview} />

      {isEmpty ? (
        <div className="p12-body">
          <EmptyBudget
            tripTitle={trip.title}
            mode={mode}
            isOwner={isOwner}
            ownerFirst={ownerFirst}
            onSetBudget={openSettings}
            onSetMyBudget={openMyBudget}
            onAdd={openAdd}
            logLocked={logLocked}
          />
          {/* A simulated bank alert can arrive before anything is logged; keep it reviewable. */}
          {reviewItems.length > 0 && review}
        </div>
      ) : (
        <div className="p12-body">
          <OverBudgetBanner figures={figures} mode={mode} canAdjust={individual || access.canSetBudget} onAdjust={individual ? openMyBudget : openSettings} />
          <BudgetKpis {...overview} />
          {isDesktop ? (
            <div className="p12-grid">
              <div className="p12-col-left">
                {spending}
                {review}
              </div>
              <div className="p12-col-right">{details}</div>
            </div>
          ) : isMobile ? (
            <>
              {spending}
              {review}
              {details}
            </>
          ) : (
            <>
              <div className="p12-tablet-row">
                {spending}
                {review}
              </div>
              {details}
            </>
          )}
        </div>
      )}

      <SummaryBar figures={figures} mode={mode} isMobile={isMobile} onScan={openScan} onAdd={openAdd} logLocked={logLocked} />

      {sheet?.kind === 'add' && <ExpenseSheet ctx={sheetCtx} onClose={closeSheet} onSaved={afterExpenseSaved} />}
      {sheet?.kind === 'scan' && <ScanReceiptSheet ctx={sheetCtx} onClose={closeSheet} onSaved={afterExpenseSaved} />}
      {sheet?.kind === 'settings' && (
        <BudgetSettingsSheet
          trip={trip}
          access={access}
          members={members}
          initialMode={mode}
          initialGroupAmount={groupAmount}
          ownerFirst={ownerFirst}
          onClose={closeSheet}
          onSaved={() => {
            setSheet(null);
            // Saved settings replace any preview, so drop render-only ?s= states.
            if (forced && PREVIEW_KEYS.includes(forced)) clearForced();
          }}
        />
      )}
      {sheet?.kind === 'my-budget' && <MyBudgetSheet trip={trip} personId={acting} onClose={closeSheet} />}
      {sheet?.kind === 'edit' && sheetExpense && <ExpenseSheet ctx={sheetCtx} editing={sheetExpense} onClose={closeSheet} onSaved={afterExpenseSaved} />}
      {sheet?.kind === 'detail' && sheetExpense && (
        <ExpenseDetailSheet
          expense={sheetExpense}
          state={state}
          actingPersonId={acting}
          mode={mode}
          linked={linkedTo(sheetExpense.id)}
          canEdit={canEdit(sheetExpense)}
          lockReason={editLockReason(sheetExpense)}
          onClose={closeSheet}
          onEdit={() => setSheet({ kind: 'edit', id: sheetExpense.id })}
          onDelete={() => setSheet({ kind: 'delete', id: sheetExpense.id })}
        />
      )}
      {sheet?.kind === 'delete' && sheetExpense && (
        <DeleteExpenseSheet expense={sheetExpense} linkedCount={linkedTo(sheetExpense.id).length} onClose={closeSheet} onDeleted={() => setSheet(null)} />
      )}
    </div>
  );
}
