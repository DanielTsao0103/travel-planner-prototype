/**
 * Page 12 — the expense form fields shared by "Add expense" (12C), "Edit
 * expense", and the review step of "Scan receipt" (12D).
 *
 * The form keeps a plain `ExpenseDraft` (strings for what the user types) and
 * only turns it into an Expense on save, after `validateDraft` passes.
 */

import { useEffect, useId, useRef, type ReactNode } from 'react';
import { AlertCircle } from 'lucide-react';
import type { ExpenseCategory, ISODate } from '../../data/types';
import { listJoin, money } from '../../lib/format';
import { ChipToggle, Field, MoneyInput, Select, Switch, TextInput } from '../../components/ui/Field';
import { CATEGORY_ORDER, parseMoney, repaymentShares } from './budgetMath';
import { CATEGORY_META, CategoryDot } from './categories';

export interface ExpenseDraft {
  /** Raw text from the money input. */
  amount: string;
  purpose: string;
  merchant: string;
  category: ExpenseCategory | null;
  date: ISODate;
  paidById: string;
  splitWithIds: string[];
  requestRepayment: boolean;
}

export type DraftField = 'amount' | 'purpose' | 'merchant' | 'category' | 'date' | 'splitWithIds';
export type DraftErrors = Partial<Record<DraftField, string>>;

export interface Member {
  id: string;
  /** Full name ("Jordan Reyes"). */
  name: string;
  /** "You" or a first name, for chips. */
  short: string;
}

/** Check a draft before saving. Messages say what's wrong and how to fix it. */
export function validateDraft(d: ExpenseDraft, today: ISODate, opts: { requireMerchant?: boolean } = {}): DraftErrors {
  const errors: DraftErrors = {};
  const amount = parseMoney(d.amount);
  if (d.amount.trim() === '') errors.amount = 'Enter how much it cost.';
  else if (!Number.isFinite(amount) || amount <= 0) errors.amount = 'Enter an amount greater than $0, like 12.50.';
  else if (amount > 100000) errors.amount = 'That’s over $100,000. Check the amount.';
  if (!d.purpose.trim()) errors.purpose = 'Say what it was for, like “Dinner at Time Out Market”.';
  if (opts.requireMerchant && !d.merchant.trim()) errors.merchant = 'Add the store name from the receipt.';
  if (!d.category) errors.category = 'Choose a category.';
  if (!d.date) errors.date = 'Pick the date you paid.';
  else if (d.date > today) errors.date = 'Pick today or an earlier date. Expenses count from the day they’re paid.';
  if (d.splitWithIds.length === 0) errors.splitWithIds = 'Choose at least one person to split with.';
  return errors;
}

/** Plain-language preview of who will owe what ("Jordan, Sam… will each owe you $12.50."). */
export function repaymentPreview(d: ExpenseDraft, members: Member[], actingPersonId: string): { ready: boolean; text: string; count: number } {
  const amount = parseMoney(d.amount);
  const payerShort = members.find((m) => m.id === d.paidById)?.short ?? 'the payer';
  const payerRef = d.paidById === actingPersonId ? 'you' : payerShort;
  if (!Number.isFinite(amount) || amount <= 0) return { ready: false, text: 'Enter an amount to see what each person owes.', count: 0 };
  const shares = repaymentShares(amount, d.splitWithIds, d.paidById);
  if (shares.length === 0) return { ready: false, text: `Add other people to the split to ask them to pay ${payerRef} back.`, count: 0 };
  const names = listJoin(shares.map((s) => members.find((m) => m.id === s.personId)?.short ?? 'Someone'));
  const amounts = shares.map((s) => s.amount);
  const min = Math.min(...amounts);
  const max = Math.max(...amounts);
  const each =
    shares.length === 1
      ? `${names} will owe ${payerRef} ${money(min)}.`
      : min === max
        ? `${names} will each owe ${payerRef} ${money(min)}.`
        : `${names} will each owe ${payerRef} ${money(min)} or ${money(max)} (the extra cents are spread out).`;
  return { ready: true, text: `${each} We’ll notify them (simulated).`, count: shares.length };
}

/**
 * A labeled group of toggle chips (category, split) with an inline error.
 * Uses role="group" + aria-labelledby (rather than <fieldset>/<legend>) so the
 * label can share a row with the "Everyone" shortcut and still name the group.
 */
function ChoiceGroup({ legend, error, aside, children }: { legend: string; error?: string; aside?: ReactNode; children: ReactNode }) {
  const id = useId();
  return (
    <div role="group" aria-labelledby={`${id}-label`} aria-describedby={error ? `${id}-error` : undefined} className={`p12-fieldset ${error ? 'has-error' : ''}`}>
      <div className="p12-fieldset-head">
        <span id={`${id}-label`} className="field-label">
          {legend}
          <span className="field-required" aria-hidden>
            {' '}
            *
          </span>
        </span>
        {aside}
      </div>
      <div className="p12-chips">{children}</div>
      {error && (
        <p id={`${id}-error`} className="field-error" role="alert">
          <AlertCircle aria-hidden />
          <span>{error}</span>
        </p>
      )}
    </div>
  );
}

/** All expense inputs (amount, date, purpose, where, category, payer, split, repayment) as one block. */
export function ExpenseFields({
  draft,
  onChange,
  errors,
  members,
  actingPersonId,
  canChoosePayer,
  payerLockHint,
  today,
  moneyLocked,
  showRepayment = true,
  showMerchant = true,
  autoFocusAmount,
  hints = {},
  order = 'amount-first',
}: {
  draft: ExpenseDraft;
  onChange: (patch: Partial<ExpenseDraft>) => void;
  errors: DraftErrors;
  members: Member[];
  actingPersonId: string;
  /** Owners can log for anyone; everyone else logs what they paid. */
  canChoosePayer: boolean;
  payerLockHint?: string;
  today: ISODate;
  /** Reason amount/payer/split can't change (repayment requests already exist). */
  moneyLocked?: string | false;
  showRepayment?: boolean;
  showMerchant?: boolean;
  autoFocusAmount?: boolean;
  /** Per-field hints (the receipt review uses these to flag what wasn't read). */
  hints?: Partial<Record<DraftField, ReactNode>>;
  /** Receipt review shows the store name first, like a receipt does. */
  order?: 'amount-first' | 'merchant-first';
}) {
  const preview = repaymentPreview(draft, members, actingPersonId);
  const payer = members.find((m) => m.id === draft.paidById);
  // The switch only makes sense when someone besides the payer shares the cost.
  const hasOthers = draft.splitWithIds.some((id) => id !== draft.paidById);
  const repayRef = useRef<HTMLDivElement>(null);

  // Turning on "I paid for others" reveals who owes what; make sure that preview is on screen.
  useEffect(() => {
    if (draft.requestRepayment) repayRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [draft.requestRepayment]);
  const everyone = members.map((m) => m.id);
  const allSelected = everyone.every((id) => draft.splitWithIds.includes(id));

  const toggleSplit = (id: string) => {
    const has = draft.splitWithIds.includes(id);
    // Keep the trip's member order so shares line up the same way every time.
    const next = has ? draft.splitWithIds.filter((x) => x !== id) : everyone.filter((x) => x === id || draft.splitWithIds.includes(x));
    onChange({ splitWithIds: next, requestRepayment: next.some((x) => x !== draft.paidById) ? draft.requestRepayment : false });
  };

  const merchantField = showMerchant && (
    <Field label={order === 'merchant-first' ? 'Store or merchant' : 'Where'} aside={order === 'merchant-first' ? undefined : 'Optional'} error={errors.merchant} hint={hints.merchant} required={order === 'merchant-first'}>
      {(p) => <TextInput {...p} value={draft.merchant} onChange={(e) => onChange({ merchant: e.target.value })} placeholder="e.g. Time Out Market" autoComplete="off" />}
    </Field>
  );

  return (
    <div className="p12-form">
      {order === 'merchant-first' && merchantField}
      <div className="p12-form-row">
        <Field label="Amount" required error={errors.amount} hint={moneyLocked ? undefined : hints.amount}>
          {(p) => (
            <MoneyInput
              {...p}
              value={draft.amount}
              onChange={(e) => onChange({ amount: e.target.value })}
              placeholder="0.00"
              disabled={!!moneyLocked}
              data-autofocus={autoFocusAmount ? true : undefined}
            />
          )}
        </Field>
        <Field label="Date" required error={errors.date} hint={hints.date}>
          {(p) => <TextInput {...p} type="date" value={draft.date} max={today} onChange={(e) => onChange({ date: e.target.value })} />}
        </Field>
      </div>

      <Field label="What it was for" required error={errors.purpose} hint={hints.purpose}>
        {(p) => <TextInput {...p} value={draft.purpose} onChange={(e) => onChange({ purpose: e.target.value })} placeholder="e.g. Dinner at Time Out Market" autoComplete="off" maxLength={80} />}
      </Field>

      {order === 'amount-first' && merchantField}

      <ChoiceGroup legend="Category" error={errors.category} aside={hints.category ? <span className="field-aside">{hints.category}</span> : undefined}>
        {CATEGORY_ORDER.map((c) => (
          <ChipToggle key={c} selected={draft.category === c} onToggle={() => onChange({ category: c })} icon={<CategoryDot category={c} />}>
            {CATEGORY_META[c].label}
          </ChipToggle>
        ))}
      </ChoiceGroup>

      <Field label="Paid by" hint={canChoosePayer ? undefined : payerLockHint}>
        {(p) => (
          <Select
            {...p}
            value={draft.paidById}
            disabled={!canChoosePayer || !!moneyLocked}
            onChange={(e) => {
              const id = e.target.value;
              onChange({ paidById: id, requestRepayment: draft.splitWithIds.some((x) => x !== id) ? draft.requestRepayment : false });
            }}
          >
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.id === actingPersonId ? `You (${m.name})` : m.name}
              </option>
            ))}
          </Select>
        )}
      </Field>

      <ChoiceGroup
        legend="Split with"
        error={errors.splitWithIds}
        aside={
          !moneyLocked && members.length > 1 ? (
            <button type="button" className="p12-link-btn" onClick={() => onChange(allSelected ? { splitWithIds: [draft.paidById], requestRepayment: false } : { splitWithIds: everyone })}>
              {allSelected ? `Just ${draft.paidById === actingPersonId ? 'me' : payer?.short}` : 'Everyone'}
            </button>
          ) : undefined
        }
      >
        {members.map((m) => (
          <ChipToggle key={m.id} selected={draft.splitWithIds.includes(m.id)} onToggle={() => toggleSplit(m.id)} disabled={!!moneyLocked}>
            {m.short}
          </ChipToggle>
        ))}
      </ChoiceGroup>

      {moneyLocked && <p className="p12-form-note">{moneyLocked}</p>}

      {showRepayment && !moneyLocked && (
        <div ref={repayRef} className={`p12-repay ${draft.requestRepayment ? 'is-on' : ''}`}>
          <Switch
            label={draft.paidById === actingPersonId ? 'I paid for others' : `${payer?.short ?? 'They'} paid for others`}
            description={draft.paidById === actingPersonId ? 'Ask them to pay me back' : `Ask them to pay ${payer?.short ?? 'them'} back`}
            checked={draft.requestRepayment}
            disabled={!hasOthers}
            onChange={(v) => onChange({ requestRepayment: v })}
          />
          <p className="p12-repay-preview" aria-live="polite">
            {draft.requestRepayment || !preview.ready
              ? preview.text
              : `Turn this on to ask the ${preview.count === 1 ? 'other person' : `${preview.count} other people`} in the split to pay ${draft.paidById === actingPersonId ? 'you' : (payer?.short ?? 'them')} back.`}
          </p>
        </div>
      )}
    </div>
  );
}
