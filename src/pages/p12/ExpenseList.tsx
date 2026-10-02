/**
 * Page 12 — the expense log.
 *  - Desktop/tablet: a dense, Ramp-style table (date, expense + merchant +
 *    source, category chip, paid by + split, amount) with a row menu.
 *  - Phone: list rows grouped by day (no wide table), tap a row for details.
 * A category filter sits above both.
 */

import { Camera, Lock, Pencil, Plus, Trash2, X } from 'lucide-react';
import type { AppState, BudgetMode, Expense, ExpenseCategory } from '../../data/types';
import { formatMonthDay, formatShortDate } from '../../lib/dates';
import { firstName, money, plural } from '../../lib/format';
import { getPerson, shareOf } from '../../store/selectors';
import { toast } from '../../store/toast';
import { Button } from '../../components/ui/Button';
import { Avatar, EmptyState } from '../../components/ui/Display';
import { Select } from '../../components/ui/Field';
import { CATEGORY_ORDER, sumOf } from './budgetMath';
import { CATEGORY_META, CategoryChip, CategoryTile, SourceBadge } from './categories';
import { RowMenu } from './RowMenu';

export interface ExpenseListProps {
  /** Already filtered by category and sorted newest first. */
  expenses: Expense[];
  /** All visible expenses (for counts in the filter). */
  allExpenses: Expense[];
  state: AppState;
  actingPersonId: string;
  mode: BudgetMode;
  isMobile: boolean;
  category: ExpenseCategory | 'all';
  onCategory: (c: ExpenseCategory | 'all') => void;
  highlightId: string | null;
  canEdit: (e: Expense) => boolean;
  editLockReason: (e: Expense) => string;
  onOpen: (e: Expense) => void;
  onEdit: (e: Expense) => void;
  onDelete: (e: Expense) => void;
  onAdd: () => void;
  onScan: () => void;
  logLocked: string | false;
}

/** "You" for the acting person, otherwise a first name. */
export function shortName(state: AppState, personId: string, actingPersonId: string): string {
  if (personId === actingPersonId) return 'You';
  return firstName(getPerson(state, personId)?.name ?? 'Someone');
}

/** "Split 5 ways", "Not split", or "For Sam" (paid entirely for someone else). */
export function splitLabel(state: AppState, e: Expense, actingPersonId: string): string {
  const n = e.splitWithIds.length;
  if (n > 1) return `Split ${n} ways`;
  const only = e.splitWithIds[0];
  if (!only || only === e.paidById) return 'Not split';
  return `For ${shortName(state, only, actingPersonId) === 'You' ? 'you' : shortName(state, only, actingPersonId)}`;
}

/** The expense log with its count/total toolbar and category filter (table on desktop, rows on phones). */
export function ExpenseList(props: ExpenseListProps) {
  const { expenses, allExpenses, category, onCategory, isMobile, onAdd, onScan, logLocked, mode, actingPersonId } = props;
  const filteredTotal = sumOf(expenses.map((e) => e.amount));
  // Individual budgets: also show what part of these expenses is yours.
  const filteredShare = sumOf(expenses.map((e) => shareOf(e, actingPersonId)));

  const toolbar = (
    <div className="p12-toolbar">
      <p className="p12-toolbar-count">
        <span className="num">
          {category === 'all' ? plural(allExpenses.length, 'expense') : `${expenses.length} of ${allExpenses.length}`}
        </span>
        <span className="p12-toolbar-sep" aria-hidden>
          ·
        </span>
        <span className="num">{money(filteredTotal)}</span>
        {mode === 'individual' && (
          <>
            <span className="p12-toolbar-sep" aria-hidden>
              ·
            </span>
            <span className="num p12-toolbar-share">Your share {money(filteredShare)}</span>
          </>
        )}
      </p>
      <div className="p12-toolbar-filter">
        {category !== 'all' && !isMobile && (
          <button type="button" className="p12-filter-chip" onClick={() => onCategory('all')} aria-label={`Clear filter: ${CATEGORY_META[category].label}`}>
            {CATEGORY_META[category].label}
            <X aria-hidden />
          </button>
        )}
        <label className="sr-only" htmlFor="p12-cat-filter">
          Filter by category
        </label>
        <Select id="p12-cat-filter" className="p12-select" value={category} onChange={(e) => onCategory(e.target.value as ExpenseCategory | 'all')}>
          <option value="all">All categories</option>
          {CATEGORY_ORDER.map((c) => {
            const n = allExpenses.filter((e) => e.category === c).length;
            return (
              <option key={c} value={c}>
                {CATEGORY_META[c].label} ({n})
              </option>
            );
          })}
        </Select>
      </div>
    </div>
  );

  if (allExpenses.length === 0) {
    return (
      <EmptyState
        compact
        title="No expenses yet"
        actions={
          <>
            <Button icon={<Plus />} locked={logLocked} onClick={onAdd}>
              Add expense
            </Button>
            <Button variant="secondary" icon={<Camera />} locked={logLocked} onClick={onScan}>
              Scan receipt
            </Button>
          </>
        }
      >
        Log what you spend as you go, or scan a receipt. Everything here adds up in the chart.
      </EmptyState>
    );
  }

  return (
    <div className="p12-expenses">
      {toolbar}
      {expenses.length === 0 ? (
        <EmptyState
          compact
          title={`No ${category === 'all' ? '' : CATEGORY_META[category].label.toLowerCase() + ' '}expenses yet`}
          actions={
            <Button size="sm" variant="secondary" onClick={() => onCategory('all')}>
              Show all expenses
            </Button>
          }
        />
      ) : isMobile ? (
        <MobileRows {...props} />
      ) : (
        <ExpenseTable {...props} />
      )}
    </div>
  );
}

/* ------------------------------------------------------------- desktop */

/** Desktop/tablet table. Edit and Delete live in the row menu for people allowed to change the row. */
function ExpenseTable({ expenses, state, actingPersonId, mode, highlightId, canEdit, editLockReason, onOpen, onEdit, onDelete }: ExpenseListProps) {
  const individual = mode === 'individual';
  return (
    <div className="p12-table-wrap">
      <table className={`p12-table ${individual ? 'has-share' : ''}`}>
        <thead>
          <tr>
            <th scope="col">Date</th>
            <th scope="col">Expense</th>
            <th scope="col">Category</th>
            <th scope="col">Paid by</th>
            {individual && (
              <th scope="col" className="is-num">
                Your share
              </th>
            )}
            <th scope="col" className="is-num">
              Amount
            </th>
            <th scope="col">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {expenses.map((e) => {
            const payer = getPerson(state, e.paidById);
            const share = shareOf(e, actingPersonId);
            const editable = canEdit(e);
            return (
              <tr key={e.id} id={`p12-row-${e.id}`} className={highlightId === e.id ? 'is-new' : ''}>
                <td className="p12-td-date num">{formatMonthDay(e.date)}</td>
                <td className="p12-td-main">
                  <button type="button" className="p12-row-link" onClick={() => onOpen(e)}>
                    {e.purpose}
                  </button>
                  <span className="p12-row-sub">
                    {e.merchant && e.merchant !== e.purpose && <span className="truncate">{e.merchant}</span>}
                    <SourceBadge source={e.source} />
                  </span>
                </td>
                <td>
                  <CategoryChip category={e.category} />
                </td>
                <td className="p12-td-payer">
                  <span className="p12-payer">
                    {payer && <Avatar person={payer} size={22} />}
                    <span className="truncate">{shortName(state, e.paidById, actingPersonId)}</span>
                  </span>
                  <span className="p12-row-sub">{splitLabel(state, e, actingPersonId)}</span>
                </td>
                {individual && <td className="is-num num p12-td-share">{share > 0 ? money(share) : '—'}</td>}
                <td className="is-num num p12-td-amount">{money(e.amount)}</td>
                <td className="p12-td-menu">
                  {editable ? (
                    <RowMenu
                      label={`Actions for ${e.purpose}`}
                      items={[
                        { key: 'edit', label: 'Edit expense', icon: <Pencil aria-hidden />, onSelect: () => onEdit(e) },
                        { key: 'delete', label: 'Delete expense', icon: <Trash2 aria-hidden />, onSelect: () => onDelete(e), danger: true },
                      ]}
                    />
                  ) : (
                    <button
                      type="button"
                      className="icon-btn icon-btn-ghost icon-btn-sm p12-row-lock"
                      aria-label={`Why can’t I edit ${e.purpose}?`}
                      title={editLockReason(e)}
                      onClick={() => toast({ title: 'Not available', body: editLockReason(e), tone: 'info' })}
                    >
                      <Lock aria-hidden />
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* --------------------------------------------------------------- phone */

/** Phone list: rows grouped under day headings with each day's total; tap a row for details. */
function MobileRows({ expenses, state, actingPersonId, mode, highlightId, onOpen }: ExpenseListProps) {
  const individual = mode === 'individual';
  // Group by day, keeping the newest-first order.
  const days: Array<{ date: string; items: Expense[] }> = [];
  for (const e of expenses) {
    const last = days[days.length - 1];
    if (last && last.date === e.date) last.items.push(e);
    else days.push({ date: e.date, items: [e] });
  }
  return (
    <div className="p12-mlist">
      {days.map((d) => (
        <section key={d.date} className="p12-mday" aria-label={formatShortDate(d.date)}>
          <h3 className="p12-mday-head">
            <span>{formatShortDate(d.date)}</span>
            <span className="num">{money(sumOf(d.items.map((e) => (individual ? shareOf(e, actingPersonId) : e.amount))))}</span>
          </h3>
          <ul className="p12-mday-list">
            {d.items.map((e) => {
              const share = shareOf(e, actingPersonId);
              return (
                <li key={e.id}>
                  <button type="button" id={`p12-row-${e.id}`} className={`p12-mrow ${highlightId === e.id ? 'is-new' : ''}`} onClick={() => onOpen(e)}>
                    <CategoryTile category={e.category} />
                    <span className="p12-mrow-main">
                      <span className="p12-mrow-top">
                        <span className="p12-mrow-title">{e.purpose}</span>
                        <span className="p12-mrow-amount num">{money(e.amount)}</span>
                      </span>
                      <span className="p12-mrow-sub">
                        {individual
                          ? `${shortName(state, e.paidById, actingPersonId)} paid · Your share ${share > 0 ? money(share) : '$0.00'}`
                          : `${shortName(state, e.paidById, actingPersonId)} paid · ${splitLabel(state, e, actingPersonId)}`}
                      </span>
                      {/* "Manual" is the default, so phones only label receipts and the demo integrations. */}
                      {e.source !== 'manual' && (
                        <span className="p12-mrow-badge">
                          <SourceBadge source={e.source} />
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
