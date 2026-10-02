/**
 * Page 12 — phone "Categories" tab: every category with its total, share of
 * spending, number of expenses, and a to-scale bar. Tapping one jumps to the
 * Expenses tab filtered to it.
 */

import { ChevronRight } from 'lucide-react';
import type { BudgetMode, ExpenseCategory } from '../../data/types';
import { money, plural } from '../../lib/format';
import { pctLabel, type CategoryTotal } from './budgetMath';
import { CATEGORY_META, CategoryTile, catVar } from './categories';

/** Phone-only list of all six categories, biggest first, each linking to a filtered expense list. */
export function CategoryBreakdown({
  totals,
  spent,
  mode,
  onPick,
}: {
  /** All six categories (zeros included), in display order. */
  totals: CategoryTotal[];
  spent: number;
  mode: BudgetMode;
  onPick: (category: ExpenseCategory) => void;
}) {
  // Biggest first; empty categories at the end so the list still shows every option.
  const rows = [...totals].sort((a, b) => b.amount - a.amount);
  return (
    <div className="p12-breakdown">
      <p className="xsmall muted">{mode === 'individual' ? 'Your share of spending, by category.' : 'Everything the group has spent, by category.'}</p>
      <ul className="p12-breakdown-list">
        {rows.map((t) => {
          const pct = spent > 0 ? (t.amount / spent) * 100 : 0;
          const empty = t.amount <= 0;
          return (
            <li key={t.category}>
              <button type="button" className={`p12-breakdown-row ${empty ? 'is-empty' : ''}`} onClick={() => onPick(t.category)} style={catVar(t.category)}>
                <CategoryTile category={t.category} size={36} />
                <span className="p12-breakdown-main">
                  <span className="p12-breakdown-top">
                    <span className="p12-breakdown-name">{CATEGORY_META[t.category].label}</span>
                    <span className="p12-breakdown-amount num">{money(t.amount)}</span>
                  </span>
                  <span className="p12-breakdown-bar" aria-hidden>
                    <span style={{ width: `${Math.min(100, pct)}%` }} />
                  </span>
                  <span className="p12-breakdown-meta num">
                    {empty ? 'Nothing yet' : `${plural(t.count, 'expense')} · ${pctLabel(pct)} of spent`}
                  </span>
                </span>
                <ChevronRight className="p12-breakdown-chev" aria-hidden />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
