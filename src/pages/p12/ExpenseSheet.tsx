/**
 * Page 12 — "Add expense" (12C) and "Edit expense".
 *
 * Amount, what it was for, category, date, who paid, and who it's split with.
 * The "I paid for others" switch turns on repayment requests: everyone else
 * in the split gets an "X owes you $…" row, and we simulate notifying them.
 */

import { useRef, useState, type FormEvent } from 'react';
import type { AppState, Expense, ISODate, Trip } from '../../data/types';
import type { TripAccess } from '../../lib/permissions';
import { money, plural, round2 } from '../../lib/format';
import { addExpense, updateExpense } from '../../store/actions';
import { toast } from '../../store/toast';
import { Button } from '../../components/ui/Button';
import { Sheet } from '../../components/ui/Overlay';
import { defaultExpenseDate, moneyInputValue, parseMoney, repaymentShares } from './budgetMath';
import { ExpenseFields, validateDraft, type ExpenseDraft, type Member } from './ExpenseForm';

/** Everything the expense sheets need to know about the trip and "you". */
export interface SheetContext {
  trip: Trip;
  state: AppState;
  access: TripAccess;
  /** Accepted travelers, "you" first. */
  members: Member[];
  today: ISODate;
  isMobile: boolean;
  ownerFirst: string;
}

/** A fresh draft: today's date, paid by you, split with everyone. */
export function blankDraft(ctx: SheetContext): ExpenseDraft {
  return {
    amount: '',
    purpose: '',
    merchant: '',
    category: null,
    date: defaultExpenseDate(ctx.today, ctx.trip),
    paidById: ctx.access.actingPersonId,
    splitWithIds: ctx.members.map((m) => m.id),
    requestRepayment: false,
  };
}

/** Fill the form from an existing expense (Edit). */
function draftFrom(e: Expense): ExpenseDraft {
  return {
    amount: moneyInputValue(e.amount),
    purpose: e.purpose,
    merchant: e.merchant ?? '',
    category: e.category,
    date: e.date,
    paidById: e.paidById,
    splitWithIds: [...e.splitWithIds],
    requestRepayment: false,
  };
}

/** Move focus to the first field with an error so keyboard and screen-reader users land on it. */
export function focusFirstError(root: HTMLElement | null): void {
  window.requestAnimationFrame(() => {
    const el = root?.querySelector<HTMLElement>('[aria-invalid="true"], .p12-fieldset.has-error button');
    el?.focus();
  });
}

/** Add (no `editing`) or edit (with `editing`) an expense in a sheet. Calls onSaved with the expense id. */
export function ExpenseSheet({ ctx, editing, onClose, onSaved }: { ctx: SheetContext; editing?: Expense; onClose: () => void; onSaved: (expenseId: string) => void }) {
  const { trip, state, access, members, today, isMobile, ownerFirst } = ctx;
  const acting = access.actingPersonId;
  const formRef = useRef<HTMLFormElement>(null);
  const [draft, setDraft] = useState<ExpenseDraft>(() => (editing ? draftFrom(editing) : blankDraft(ctx)));
  const [submitted, setSubmitted] = useState(false);
  // Validate live only after the first save attempt, so people aren't scolded while typing.
  const errors = submitted ? validateDraft(draft, today) : {};

  const linked = editing ? state.reimbursements.filter((r) => r.expenseId === editing.id) : [];
  const moneyLocked =
    linked.length > 0
      ? `Amount, payer, and split are locked because ${plural(linked.length, 'repayment request')} ${linked.length === 1 ? 'was' : 'were'} already sent. To change them, delete this expense and add it again.`
      : false;

  const save = (e?: FormEvent) => {
    e?.preventDefault();
    setSubmitted(true);
    const errs = validateDraft(draft, today);
    if (Object.keys(errs).length > 0) {
      focusFirstError(formRef.current);
      return;
    }
    const amount = round2(parseMoney(draft.amount));
    const purpose = draft.purpose.trim();
    const merchant = draft.merchant.trim() || undefined;

    if (editing) {
      updateExpense(editing.id, {
        purpose,
        merchant,
        category: draft.category!,
        date: draft.date,
        // Money fields only change when no repayment requests depend on them.
        ...(moneyLocked ? {} : { amount, paidById: draft.paidById, splitWithIds: draft.splitWithIds }),
      });
      toast({ title: 'Expense updated', body: `${purpose} · ${money(moneyLocked ? editing.amount : amount)}` });
      onSaved(editing.id);
      return;
    }

    const others = draft.requestRepayment ? repaymentShares(amount, draft.splitWithIds, draft.paidById) : [];
    const id = addExpense({
      tripId: trip.id,
      amount,
      purpose,
      category: draft.category!,
      date: draft.date,
      paidById: draft.paidById,
      splitWithIds: draft.splitWithIds,
      source: 'manual',
      merchant,
      requestRepayment: others.length > 0,
    });
    toast({ title: 'Expense added', body: `${purpose} · ${money(amount)}` });
    if (others.length > 0) {
      toast({ title: `Notified ${plural(others.length, 'person', 'people')} (simulated)`, body: 'They’ll see what they owe under “Who owes whom”. Nothing was actually sent.', tone: 'info' });
    }
    onSaved(id);
  };

  return (
    <Sheet
      open
      onClose={onClose}
      title={editing ? 'Edit expense' : 'Add expense'}
      description={editing ? undefined : 'Log what you spent. If you paid for other people, ask them to pay you back.'}
      fullOnMobile
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="p12-expense-form">
            {editing ? 'Save changes' : 'Save expense'}
          </Button>
        </>
      }
    >
      <form id="p12-expense-form" ref={formRef} onSubmit={save} noValidate>
        <ExpenseFields
          draft={draft}
          onChange={(p) => setDraft((d) => ({ ...d, ...p }))}
          errors={errors}
          members={members}
          actingPersonId={acting}
          canChoosePayer={access.role === 'owner'}
          payerLockHint={`You can log what you paid. ${ownerFirst} (the trip owner) can log costs for others.`}
          today={today}
          moneyLocked={moneyLocked}
          showRepayment={!editing}
          autoFocusAmount={!isMobile}
        />
      </form>
    </Sheet>
  );
}
