/**
 * Page 12 — designed empty state (12J): no budget amount yet and nothing
 * logged. The Owner gets "Set a budget"; everyone else learns who sets it
 * and that they can still log what they spend.
 */

import { Camera, ChartPie, HandCoins, PiggyBank, Plus, Settings2 } from 'lucide-react';
import type { BudgetMode } from '../../data/types';
import { Button } from '../../components/ui/Button';

/** Shown instead of the dashboard when there's no budget amount and nothing logged yet. */
export function EmptyBudget({
  tripTitle,
  mode,
  isOwner,
  ownerFirst,
  onSetBudget,
  onSetMyBudget,
  onAdd,
  logLocked,
}: {
  tripTitle: string;
  mode: BudgetMode;
  isOwner: boolean;
  ownerFirst: string;
  onSetBudget: () => void;
  onSetMyBudget: () => void;
  onAdd: () => void;
  logLocked: string | false;
}) {
  const individual = mode === 'individual';
  const title = individual ? 'Set your budget for this trip' : isOwner ? `Set a budget for ${tripTitle}` : `${ownerFirst} hasn’t set a budget yet`;
  const body = individual
    ? 'Each traveler on this trip tracks their own budget. Your share of shared costs counts toward yours.'
    : isOwner
      ? 'Choose one shared total for the group, or let each traveler track their own. Then log expenses as you go.'
      : `You can still log what you spend. It counts toward the budget once ${ownerFirst} sets one.`;

  return (
    <section className="p12-card p12-empty" aria-labelledby="p12-empty-title">
      <div className="p12-empty-main">
        <span className="p12-empty-icon" aria-hidden>
          <PiggyBank />
        </span>
        <h2 id="p12-empty-title" className="p12-empty-title">
          {title}
        </h2>
        <p className="p12-empty-text">{body}</p>
        <div className="p12-empty-actions">
          {individual ? (
            <Button icon={<Settings2 />} onClick={onSetMyBudget}>
              Set my budget
            </Button>
          ) : (
            isOwner && (
              <Button icon={<Settings2 />} onClick={onSetBudget}>
                Set a budget
              </Button>
            )
          )}
          <Button variant={isOwner || individual ? 'secondary' : 'primary'} icon={<Plus />} locked={logLocked} onClick={onAdd}>
            Add expense
          </Button>
        </div>
      </div>
      <ul className="p12-empty-hints">
        <li>
          <ChartPie aria-hidden />
          <span>
            <strong>Spending by category.</strong> See where the money goes and what’s left.
          </span>
        </li>
        <li>
          <Camera aria-hidden />
          <span>
            <strong>Scan receipts.</strong> Snap one and the details fill in.
          </span>
        </li>
        <li>
          <HandCoins aria-hidden />
          <span>
            <strong>Split and settle up.</strong> “Sam Okafor owes Maya Chen $24.00” stays open until Maya marks it paid.
          </span>
        </li>
      </ul>
    </section>
  );
}
