/**
 * Page 12 — the top of the budget: title, budget-mode chip, the Owner-only
 * "Budget settings" control, and the number-forward KPI row
 * (Total budget · Spent · Left to spend) with a slim "% used" meter.
 *
 * In individual mode the same slots read "My budget · My share spent · I have left".
 */

import type { ReactNode } from 'react';
import { Settings2, User, Users, Wallet } from 'lucide-react';
import type { BudgetMode } from '../../data/types';
import { money, plural } from '../../lib/format';
import { Button, IconButton } from '../../components/ui/Button';
import { Banner } from '../../components/ui/Display';
import { pctLabel, type BudgetFigures } from './budgetMath';

export interface OverviewProps {
  mode: BudgetMode;
  /** "Group budget · set by you" / "Individual budgets · chosen by Maya". */
  modeChip: string;
  figures: BudgetFigures;
  isMobile: boolean;
  /** Owner can open settings; everyone else sees a locked control with this reason. */
  settingsLocked: string | false;
  onOpenSettings: () => void;
  onSetMyBudget: () => void;
  expenseCount: number;
  /** Whole-group spending (shown as context in individual mode). */
  groupSpent: number;
  /** "Day 2 of 7" / "Trip starts in 14 days" / "Trip ended". */
  progressLabel: string;
  /** "you" or the owner's first name, for "Set by …". */
  setBy: string;
  ownerFirst: string;
  isOwner: boolean;
}

/** Header row: title, mode chip, settings / "Set my budget". */
export function BudgetHeader({ mode, modeChip, isMobile, settingsLocked, onOpenSettings, onSetMyBudget }: OverviewProps) {
  const ModeIcon = mode === 'group' ? Users : User;
  return (
    <header className="p12-header">
      <div className="p12-header-text">
        <h1 className="p12-title">Budget</h1>
        <span className="p12-mode-chip">
          <ModeIcon aria-hidden />
          {modeChip}
        </span>
      </div>
      <div className="p12-header-actions">
        {mode === 'individual' && !isMobile && (
          <Button variant="secondary" icon={<Wallet />} onClick={onSetMyBudget}>
            Set my budget
          </Button>
        )}
        {isMobile ? (
          <IconButton label="Budget settings" icon={<Settings2 />} variant="secondary" locked={settingsLocked} onClick={onOpenSettings} />
        ) : (
          <Button variant="secondary" icon={<Settings2 />} locked={settingsLocked} onClick={onOpenSettings}>
            Budget settings
          </Button>
        )}
      </div>
    </header>
  );
}

/** One KPI tile: small uppercase label, big tabular number, muted caption. */
function Kpi({ label, value, caption, tone }: { label: string; value: ReactNode; caption?: ReactNode; tone?: 'danger' | 'muted' }) {
  return (
    <div className={`p12-kpi ${tone ? `is-${tone}` : ''}`}>
      <span className="p12-kpi-label">{label}</span>
      <span className="p12-kpi-value num">{value}</span>
      {caption && <span className="p12-kpi-caption">{caption}</span>}
    </div>
  );
}

/** The KPI card with the usage meter. */
export function BudgetKpis(props: OverviewProps) {
  const { mode, figures, isMobile, expenseCount, groupSpent, progressLabel, setBy, ownerFirst, isOwner, onOpenSettings, onSetMyBudget } = props;
  const { budget, spent, left, over, pct } = figures;
  const individual = mode === 'individual';
  const hasBudget = budget !== null && budget > 0;

  // Caption under "Total budget" doubles as the call to action when it isn't set.
  const setCta = individual ? (
    <button type="button" className="p12-link-btn" onClick={onSetMyBudget}>
      Set my budget
    </button>
  ) : isOwner ? (
    <button type="button" className="p12-link-btn" onClick={onOpenSettings}>
      Set a budget
    </button>
  ) : (
    `${ownerFirst} hasn’t set one yet`
  );

  const budgetCaption = hasBudget ? (individual ? (isMobile ? 'Set by you' : 'Set by you. Only you can change it.') : `Set by ${setBy}`) : setCta;
  const spentCaption = individual ? `of ${money(groupSpent)} group total` : plural(expenseCount, 'expense');

  const meter = hasBudget && pct !== null && (
    <div className="p12-meter-wrap">
      <div
        className={`p12-meter ${over > 0 ? 'is-over' : pct >= 85 ? 'is-near' : ''}`}
        role="meter"
        aria-label={individual ? 'Share of my budget used' : 'Share of the budget used'}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.min(100, Math.round(pct))}
        aria-valuetext={`${pctLabel(pct)} used`}
      >
        {/* At least a sliver shows once anything is spent, so 0.4% still reads as "started". */}
        <span className="p12-meter-fill" style={{ width: `${Math.min(100, Math.max(pct, spent > 0 ? 1 : 0))}%` }} />
      </div>
      <div className="p12-meter-caption">
        <span className={`num ${over > 0 ? 'p12-text-danger' : ''}`}>
          <strong>{pctLabel(pct)}</strong> used
        </span>
        <span className="muted">{progressLabel}</span>
      </div>
    </div>
  );

  // Phones: one hero number (what's left) with the bar, then budget and spent side by side.
  // Three equal columns would wrap "Left to spend" and knock the numbers out of line.
  if (isMobile) {
    const heroLabel = !hasBudget ? (individual ? 'My share spent' : 'Total spent') : over > 0 ? (individual ? 'I’m over by' : 'Over budget') : individual ? 'I have left' : 'Left to spend';
    const heroValue = !hasBudget ? money(spent) : money(over > 0 ? over : (left ?? 0));
    return (
      <section className="p12-card p12-kpis is-mobile" aria-label="Budget summary">
        <div className={`p12-kpi-hero ${over > 0 ? 'is-danger' : ''}`}>
          <span className="p12-kpi-label">{heroLabel}</span>
          <span className="p12-kpi-hero-value num">{heroValue}</span>
          {!hasBudget && <span className="p12-kpi-caption">No budget yet · {setCta}</span>}
        </div>
        {meter}
        {hasBudget && (
          <div className="p12-kpi-row is-two">
            <Kpi label={individual ? 'My budget' : 'Total budget'} value={money(budget)} caption={budgetCaption} />
            <Kpi label={individual ? 'My share spent' : 'Spent'} value={money(spent)} caption={spentCaption} />
          </div>
        )}
      </section>
    );
  }

  return (
    <section className="p12-card p12-kpis" aria-label="Budget summary">
      <div className="p12-kpi-row">
        <Kpi label={individual ? 'My budget' : 'Total budget'} value={hasBudget ? money(budget) : 'Not set'} caption={budgetCaption} tone={hasBudget ? undefined : 'muted'} />
        <Kpi label={individual ? 'My share spent' : 'Spent'} value={money(spent)} caption={spentCaption} />
        {over > 0 ? (
          <Kpi label={individual ? 'I’m over by' : 'Over budget'} value={money(over)} caption={`${pctLabel((pct ?? 100) - 100)} over the total`} tone="danger" />
        ) : (
          <Kpi
            label={individual ? 'I have left' : 'Left to spend'}
            value={left !== null ? money(left) : '—'}
            caption={left !== null && budget ? `${pctLabel((left / budget) * 100)} of budget` : 'Needs a budget'}
            tone={left === null ? 'muted' : undefined}
          />
        )}
      </div>
      {meter}
    </section>
  );
}

/** Danger banner shown whenever spending passes the budget (12I). */
export function OverBudgetBanner({ figures, mode, canAdjust, onAdjust }: { figures: BudgetFigures; mode: BudgetMode; canAdjust: boolean; onAdjust: () => void }) {
  if (figures.over <= 0 || figures.budget === null) return null;
  const individual = mode === 'individual';
  return (
    <Banner
      tone="danger"
      title={individual ? `You’re ${money(figures.over)} over your budget` : `You’re ${money(figures.over)} over budget`}
      action={
        canAdjust ? (
          <Button size="sm" variant="secondary" onClick={onAdjust}>
            {individual ? 'Change my budget' : 'Adjust budget'}
          </Button>
        ) : undefined
      }
    >
      {individual
        ? `Your share of spending is ${money(figures.spent)} against your ${money(figures.budget)} budget.`
        : `The group has spent ${money(figures.spent)} against a ${money(figures.budget)} budget.`}
    </Banner>
  );
}
