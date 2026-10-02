/**
 * Page 12 — "Who owes whom" (12G).
 *
 * Every repayment request reads exactly like the doc asks:
 *   "Priya Nair owes Maya Chen $384.00"
 * Only the person who is owed (the requester, `toId`) sees "Mark as paid";
 * everyone else sees "Waiting for Maya to confirm".
 */

import { useState } from 'react';
import { Check, HandCoins } from 'lucide-react';
import type { AppState, Expense, Reimbursement } from '../../data/types';
import { formatMonthDay } from '../../lib/dates';
import { firstName, money, plural } from '../../lib/format';
import { markReimbursementPaid, reopenReimbursement } from '../../store/actions';
import { getPerson } from '../../store/selectors';
import { toast } from '../../store/toast';
import { Button } from '../../components/ui/Button';
import { Badge, EmptyState } from '../../components/ui/Display';
import { ChipToggle, Segmented } from '../../components/ui/Field';
import { owesSummary } from './budgetMath';

type StatusFilter = 'open' | 'paid' | 'all';

/** "Who owes whom": your balance, filters, and every repayment request in the doc's format. */
export function OwesLog({
  rows,
  state,
  actingPersonId,
  expensesById,
  isMobile,
  onAdd,
  logLocked,
}: {
  /** Visible reimbursements for the trip. */
  rows: Reimbursement[];
  state: AppState;
  actingPersonId: string;
  expensesById: Map<string, Expense>;
  isMobile: boolean;
  onAdd: () => void;
  logLocked: string | false;
}) {
  const [status, setStatus] = useState<StatusFilter>('all');
  const [mine, setMine] = useState(false);
  const summary = owesSummary(rows, actingPersonId);

  const fullName = (id: string) => getPerson(state, id)?.name ?? 'Someone';
  const first = (id: string) => firstName(fullName(id));
  const dateOf = (r: Reimbursement) => (r.expenseId ? expensesById.get(r.expenseId)?.date : undefined) ?? r.createdAt.slice(0, 10);

  const involving = (r: Reimbursement) => r.fromId === actingPersonId || r.toId === actingPersonId;
  const counts = {
    open: rows.filter((r) => r.status === 'open' && (!mine || involving(r))).length,
    paid: rows.filter((r) => r.status === 'paid' && (!mine || involving(r))).length,
  };
  /** Lower = higher in the list: rows waiting on you, then what you owe, then other open rows, then paid. */
  const rank = (r: Reimbursement) => (r.status === 'paid' ? 3 : r.toId === actingPersonId ? 0 : r.fromId === actingPersonId ? 1 : 2);
  const shown = rows
    .filter((r) => (status === 'all' || r.status === status) && (!mine || involving(r)))
    .sort((a, b) => rank(a) - rank(b) || dateOf(b).localeCompare(dateOf(a)) || b.amount - a.amount);

  /** Only the person owed can do this (the action double-checks); Undo reopens it. */
  const markPaid = (r: Reimbursement) => {
    const ok = markReimbursementPaid(r.id, actingPersonId);
    if (!ok) {
      toast({ title: 'Only the person who is owed can mark this paid', tone: 'error' });
      return;
    }
    toast({
      title: 'Marked as paid',
      body: `${fullName(r.fromId)} paid you ${money(r.amount)} for ${r.reason}.`,
      action: { label: 'Undo', onClick: () => reopenReimbursement(r.id) },
    });
  };

  if (rows.length === 0) {
    return (
      <EmptyState
        compact
        icon={<HandCoins />}
        title="Nobody owes anybody yet"
        actions={
          <Button size="sm" icon={<HandCoins />} locked={logLocked} onClick={onAdd}>
            Log something you paid for
          </Button>
        }
      >
        When you pay for other people, add the expense and turn on “I paid for others”. Each person’s share shows up here.
      </EmptyState>
    );
  }

  return (
    <div className="p12-owes">
      <div className="p12-owe-summary" aria-label="Your balance">
        <div className="p12-owe-tile">
          <span className="p12-kpi-label">You’re owed</span>
          <span className="p12-owe-tile-value num is-positive">{money(summary.owedToMe)}</span>
          <span className="p12-kpi-caption">{summary.owedByCount ? `from ${plural(summary.owedByCount, 'person', 'people')}` : 'Nothing open'}</span>
        </div>
        <div className="p12-owe-tile">
          <span className="p12-kpi-label">You owe</span>
          <span className="p12-owe-tile-value num">{money(summary.iOwe)}</span>
          <span className="p12-kpi-caption">{summary.oweToCount ? `to ${plural(summary.oweToCount, 'person', 'people')}` : 'Nothing open'}</span>
        </div>
      </div>

      <div className="p12-owe-filters">
        <Segmented<StatusFilter>
          label="Show"
          size="sm"
          value={status}
          onChange={setStatus}
          options={[
            { value: 'open', label: `Open ${counts.open}` },
            { value: 'paid', label: `Paid ${counts.paid}` },
            { value: 'all', label: 'All' },
          ]}
        />
        <ChipToggle selected={mine} onToggle={() => setMine((v) => !v)}>
          Involving me
        </ChipToggle>
      </div>

      {shown.length === 0 ? (
        <p className="p12-owe-empty muted small">{status === 'open' ? 'Everything here is settled.' : 'No repayments match these filters.'}</p>
      ) : (
        <ul className="p12-owe-list">
          {shown.map((r) => {
            const youOwe = r.fromId === actingPersonId;
            const youAreOwed = r.toId === actingPersonId;
            return (
              <li key={r.id} className={`p12-owe ${r.status === 'paid' ? 'is-paid' : ''} ${isMobile ? 'is-mobile' : ''}`}>
                <div className="p12-owe-main">
                  {/* The doc's exact format: "Name 1 owes Name 2 $000.00" */}
                  <p className="p12-owe-line">
                    <strong>{fullName(r.fromId)}</strong>
                    {youOwe && <span className="p12-you"> (you)</span>} owes <strong>{fullName(r.toId)}</strong>
                    {youAreOwed && <span className="p12-you"> (you)</span>} <span className="p12-owe-amount num">{money(r.amount)}</span>
                  </p>
                  <p className="p12-owe-meta">
                    <span className="truncate">{r.reason}</span>
                    <span aria-hidden>·</span>
                    <span className="num">{formatMonthDay(dateOf(r))}</span>
                    {r.status === 'open' ? (
                      <Badge tone="warning">Open</Badge>
                    ) : (
                      <Badge tone="success" className="p12-paid-badge">
                        Paid <Check aria-hidden />
                      </Badge>
                    )}
                  </p>
                </div>
                {r.status === 'open' && (
                  <div className="p12-owe-action">
                    {youAreOwed ? (
                      <Button size={isMobile ? 'md' : 'sm'} variant="secondary" icon={<Check />} onClick={() => markPaid(r)}>
                        Mark as paid
                      </Button>
                    ) : (
                      <span className="p12-waiting">Waiting for {first(r.toId)} to confirm</span>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <p className="p12-owe-foot xsmall muted">Only the person who is owed can mark a repayment as paid. Nothing is actually sent or charged.</p>
    </div>
  );
}
