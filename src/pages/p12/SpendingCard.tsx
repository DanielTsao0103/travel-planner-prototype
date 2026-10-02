/**
 * Page 12 — "Spending by category": the pie (with a "Left to spend" slice)
 * plus a legend that doubles as a category filter for the expense list.
 */

import { AlertTriangle } from 'lucide-react';
import type { BudgetMode, ExpenseCategory } from '../../data/types';
import { money } from '../../lib/format';
import { pctLabel, type BudgetFigures, type CategoryTotal } from './budgetMath';
import { CATEGORY_META, CategoryDot } from './categories';
import { DonutChart, type DonutSlice } from './DonutChart';

const LEFT_KEY = 'left';

/** Card with the category pie, its center total, and a legend that filters the expense list. */
export function SpendingCard({
  totals,
  figures,
  mode,
  size,
  activeKey,
  onActiveChange,
  selectedCategory,
  onPickCategory,
}: {
  /** Non-empty categories, biggest first. */
  totals: CategoryTotal[];
  figures: BudgetFigures;
  mode: BudgetMode;
  /** Chart diameter in px. */
  size: number;
  activeKey: string | null;
  onActiveChange: (key: string | null) => void;
  /** Category the expense list is filtered to ('all' = none). */
  selectedCategory: ExpenseCategory | 'all';
  /** Legend/slice click: filter the expense list to that category (click again to clear). */
  onPickCategory: (category: ExpenseCategory | 'all') => void;
}) {
  const { spent, budget, left, over } = figures;
  const showLeft = left !== null && left > 0;
  const isIndividual = mode === 'individual';

  const slices: DonutSlice[] = totals.map((t) => ({
    key: t.category,
    label: CATEGORY_META[t.category].label,
    value: t.amount,
    color: CATEGORY_META[t.category].color,
    detail: `${money(t.amount)} · ${pctLabel((t.amount / spent) * 100)} of spent`,
  }));
  if (showLeft) {
    slices.push({ key: LEFT_KEY, label: isIndividual ? 'I have left' : 'Left to spend', value: left, color: 'var(--cat-remaining)', detail: money(left) });
  }

  const ariaLabel =
    `Spending by category: ${totals.map((t) => `${CATEGORY_META[t.category].label} ${money(t.amount)}`).join(', ') || 'nothing yet'}` +
    (showLeft ? `; ${money(left)} left to spend.` : over > 0 ? `; ${money(over)} over budget.` : '.');

  // The hole shows the total, or details for the hovered slice.
  const active = activeKey ? slices.find((s) => s.key === activeKey) : undefined;
  const center = active ? (
    <>
      <span className="p12-donut-kicker">{active.label}</span>
      <span className="p12-donut-value num">{money(active.value)}</span>
      <span className="p12-donut-sub">
        {active.key === LEFT_KEY ? `${pctLabel((active.value / (budget ?? 1)) * 100)} of budget` : `${pctLabel((active.value / spent) * 100)} of spent`}
      </span>
    </>
  ) : (
    <>
      <span className="p12-donut-kicker">{isIndividual ? 'My share' : 'Spent'}</span>
      <span className={`p12-donut-value num ${over > 0 ? 'is-over' : ''}`}>{money(spent)}</span>
      <span className="p12-donut-sub num">{budget ? `of ${money(budget)}` : 'No budget set'}</span>
    </>
  );

  return (
    <section className="p12-card p12-spending" aria-labelledby="p12-spending-title">
      <header className="p12-card-head">
        <h2 id="p12-spending-title" className="p12-card-title">
          Spending by category
        </h2>
        <span className="p12-card-aside">{isIndividual ? 'Your share' : 'Whole group'}</span>
      </header>

      <div className="p12-spending-chart">
        <DonutChart
          slices={slices}
          size={size}
          thickness={Math.round(size * 0.17)}
          activeKey={activeKey}
          onActiveChange={onActiveChange}
          onSliceClick={(key) => key !== LEFT_KEY && onPickCategory(selectedCategory === key ? 'all' : (key as ExpenseCategory))}
          ariaLabel={ariaLabel}
          center={center}
        />
      </div>

      {over > 0 && (
        <p className="p12-over-note" role="note">
          <AlertTriangle aria-hidden />
          <span>
            <strong className="num">{money(over)} over budget.</strong> {isIndividual ? 'Your share has used up your whole budget.' : 'The group has used up the whole budget.'}
          </span>
        </p>
      )}

      {totals.length === 0 ? (
        <p className="p12-legend-empty muted small">No spending yet. Expenses you log show up here by category.</p>
      ) : (
        <div className="p12-legend" role="group" aria-label="Categories. Choose one to filter the expense list.">
          <div className="p12-legend-head" aria-hidden>
            <span>Category</span>
            <span>Spent</span>
            <span>Share</span>
          </div>
          <ul className="p12-legend-list">
            {totals.map((t) => {
              const selected = selectedCategory === t.category;
              return (
                <li key={t.category}>
                  <button
                    type="button"
                    className={`p12-legend-row ${selected ? 'is-selected' : ''} ${activeKey === t.category ? 'is-active' : ''}`}
                    aria-pressed={selected}
                    onMouseEnter={() => onActiveChange(t.category)}
                    onMouseLeave={() => onActiveChange(null)}
                    onFocus={() => onActiveChange(t.category)}
                    onBlur={() => onActiveChange(null)}
                    onClick={() => onPickCategory(selected ? 'all' : t.category)}
                  >
                    <span className="p12-legend-name">
                      <CategoryDot category={t.category} />
                      <span className="truncate">{CATEGORY_META[t.category].label}</span>
                    </span>
                    <span className="p12-legend-amount num">{money(t.amount)}</span>
                    <span className="p12-legend-pct num">{pctLabel((t.amount / spent) * 100)}</span>
                  </button>
                </li>
              );
            })}
            {showLeft && (
              <li>
                <div className={`p12-legend-row is-static ${activeKey === LEFT_KEY ? 'is-active' : ''}`} onMouseEnter={() => onActiveChange(LEFT_KEY)} onMouseLeave={() => onActiveChange(null)}>
                  <span className="p12-legend-name">
                    <CategoryDot remaining />
                    <span className="truncate">{isIndividual ? 'I have left' : 'Left to spend'}</span>
                  </span>
                  <span className="p12-legend-amount num">{money(left)}</span>
                  <span className="p12-legend-pct num muted">—</span>
                </div>
              </li>
            )}
          </ul>
          <p className="p12-legend-foot xsmall muted">
            Share is the percent of {isIndividual ? 'your spending' : 'everything spent'}. Choose a category to filter the expenses.
          </p>
        </div>
      )}
    </section>
  );
}
