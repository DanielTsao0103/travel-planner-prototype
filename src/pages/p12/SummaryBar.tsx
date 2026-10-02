/**
 * Page 12 — the summary bar pinned to the bottom of the screen (the doc's
 * "total spent, total left to spend, and then a camera button").
 *
 * Phones: it sits directly above the bottom tab bar, and the camera button is
 * the primary (most prominent) action because snapping receipts is the
 * on-the-go task. Desktop: "Add expense" is primary, "Scan receipt" secondary.
 */

import { Camera, Plus } from 'lucide-react';
import type { BudgetMode } from '../../data/types';
import { money } from '../../lib/format';
import { Button } from '../../components/ui/Button';
import type { BudgetFigures } from './budgetMath';

/** Bottom bar: total spent, what's left (or over), and the Scan receipt / Add expense actions. */
export function SummaryBar({
  figures,
  mode,
  isMobile,
  onScan,
  onAdd,
  logLocked,
}: {
  figures: BudgetFigures;
  mode: BudgetMode;
  isMobile: boolean;
  onScan: () => void;
  onAdd: () => void;
  logLocked: string | false;
}) {
  const individual = mode === 'individual';
  const { spent, left, over } = figures;
  const spentLabel = individual ? (isMobile ? 'My share' : 'My share spent') : isMobile ? 'Spent' : 'Total spent';
  const leftLabel = over > 0 ? (isMobile ? 'Over by' : individual ? 'I’m over by' : 'Over budget') : individual ? 'I have left' : isMobile ? 'Left' : 'Left to spend';
  const leftValue = over > 0 ? money(over) : left !== null ? money(left) : 'No budget';

  return (
    <div className="p12-summary" role="region" aria-label="Budget totals">
      <div className="container p12-summary-inner">
        <dl className="p12-summary-stats">
          <div className="p12-summary-stat">
            <dt>{spentLabel}</dt>
            <dd className="num">{money(spent)}</dd>
          </div>
          <div className={`p12-summary-stat ${over > 0 ? 'is-over' : ''} ${left === null && over <= 0 ? 'is-muted' : ''}`}>
            <dt>{leftLabel}</dt>
            <dd className="num">{leftValue}</dd>
          </div>
        </dl>
        <div className="p12-summary-actions">
          <Button variant={isMobile ? 'primary' : 'secondary'} icon={<Camera />} aria-label="Scan receipt" locked={logLocked} onClick={onScan} className="p12-scan-btn">
            {isMobile ? 'Scan' : 'Scan receipt'}
          </Button>
          <Button variant={isMobile ? 'secondary' : 'primary'} icon={<Plus />} aria-label="Add expense" locked={logLocked} onClick={onAdd}>
            {isMobile ? 'Add' : 'Add expense'}
          </Button>
        </div>
      </div>
    </div>
  );
}
