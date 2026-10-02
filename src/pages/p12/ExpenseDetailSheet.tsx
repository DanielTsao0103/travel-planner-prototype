/**
 * Page 12 — expense details (tap a row) and the delete confirmation.
 *
 * Details show who paid, how it's split (each person's exact share), where it
 * came from, and any repayment requests tied to it. Edit/Delete appear only
 * for the person who logged it or the trip owner; others see why not.
 */

import { Check, Pencil, Trash2 } from 'lucide-react';
import type { AppState, BudgetMode, Expense, Reimbursement } from '../../data/types';
import { formatShortDate } from '../../lib/dates';
import { money, plural, splitEvenly } from '../../lib/format';
import { deleteExpense } from '../../store/actions';
import { getPerson } from '../../store/selectors';
import { toast } from '../../store/toast';
import { Button } from '../../components/ui/Button';
import { Avatar, Badge, LockNote } from '../../components/ui/Display';
import { Sheet } from '../../components/ui/Overlay';
import { CategoryChip, SOURCE_DESCRIPTION, SourceBadge } from './categories';
import { shortName, splitLabel } from './ExpenseList';

/** Read-only details for one expense, with Edit/Delete for the people allowed to change it. */
export function ExpenseDetailSheet({
  expense,
  state,
  actingPersonId,
  mode,
  linked,
  canEdit,
  lockReason,
  onClose,
  onEdit,
  onDelete,
}: {
  expense: Expense;
  state: AppState;
  actingPersonId: string;
  mode: BudgetMode;
  /** Repayment rows created from this expense. */
  linked: Reimbursement[];
  canEdit: boolean;
  lockReason: string;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const payer = getPerson(state, expense.paidById);
  const shares = splitEvenly(expense.amount, expense.splitWithIds.length);
  const fullName = (id: string) => getPerson(state, id)?.name ?? 'Someone';
  const myIndex = expense.splitWithIds.indexOf(actingPersonId);

  return (
    <Sheet
      open
      onClose={onClose}
      title={expense.purpose}
      description={`${expense.merchant && expense.merchant !== expense.purpose ? `${expense.merchant} · ` : ''}${formatShortDate(expense.date)}`}
      footer={
        canEdit ? (
          <>
            <Button variant="ghost" icon={<Trash2 />} onClick={onDelete} className="p12-btn-danger-ghost">
              Delete
            </Button>
            <Button variant="secondary" icon={<Pencil />} onClick={onEdit}>
              Edit expense
            </Button>
          </>
        ) : (
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        )
      }
    >
      <div className="p12-detail">
        <div className="p12-detail-hero">
          <span className="p12-detail-amount num">{money(expense.amount)}</span>
          <div className="cluster">
            <CategoryChip category={expense.category} />
            <SourceBadge source={expense.source} />
          </div>
        </div>

        <dl className="p12-detail-list">
          <div>
            <dt>Paid by</dt>
            <dd className="p12-payer">
              {payer && <Avatar person={payer} size={24} />}
              {expense.paidById === actingPersonId ? `You (${fullName(actingPersonId)})` : fullName(expense.paidById)}
            </dd>
          </div>
          <div>
            <dt>Split</dt>
            <dd>
              <span>{splitLabel(state, expense, actingPersonId)}</span>
              {expense.splitWithIds.length > 1 && (
                <ul className="p12-share-list">
                  {expense.splitWithIds.map((id, i) => (
                    <li key={id}>
                      <span>{shortName(state, id, actingPersonId)}</span>
                      <span className="num">{money(shares[i])}</span>
                    </li>
                  ))}
                </ul>
              )}
            </dd>
          </div>
          {mode === 'individual' && (
            <div>
              <dt>Your share</dt>
              <dd className="num">{myIndex >= 0 ? money(shares[myIndex]) : 'Not part of your budget'}</dd>
            </div>
          )}
          <div>
            <dt>Logged by</dt>
            <dd>{expense.createdById === actingPersonId ? 'You' : fullName(expense.createdById)}</dd>
          </div>
          <div>
            <dt>Source</dt>
            <dd>{SOURCE_DESCRIPTION[expense.source]}</dd>
          </div>
        </dl>

        {linked.length > 0 && (
          <section className="p12-detail-owes" aria-label="Repayment requests">
            <h3 className="p12-detail-subtitle">Repayment requests</h3>
            <ul>
              {linked.map((r) => (
                <li key={r.id}>
                  <span>
                    {fullName(r.fromId)} owes {fullName(r.toId)} <strong className="num">{money(r.amount)}</strong>
                  </span>
                  {r.status === 'open' ? (
                    <Badge tone="warning">Open</Badge>
                  ) : (
                    <Badge tone="success" className="p12-paid-badge">
                      Paid <Check aria-hidden />
                    </Badge>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        {!canEdit && <LockNote>{lockReason}</LockNote>}
      </div>
    </Sheet>
  );
}

/** "Delete this expense?" — also warns about repayment requests that go with it. */
export function DeleteExpenseSheet({ expense, linkedCount, onClose, onDeleted }: { expense: Expense; linkedCount: number; onClose: () => void; onDeleted: () => void }) {
  const confirm = () => {
    deleteExpense(expense.id);
    toast({ title: 'Expense deleted', body: `${expense.purpose} · ${money(expense.amount)}` });
    onDeleted();
  };
  return (
    <Sheet
      open
      onClose={onClose}
      title="Delete this expense?"
      description={`${expense.purpose} · ${money(expense.amount)}`}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Keep it
          </Button>
          <Button variant="danger" icon={<Trash2 />} onClick={confirm}>
            Delete expense
          </Button>
        </>
      }
    >
      <p className="small">
        It comes off the budget and the category chart.
        {linkedCount > 0 && ` This also removes ${plural(linkedCount, 'repayment request')} linked to it.`}
      </p>
    </Sheet>
  );
}
