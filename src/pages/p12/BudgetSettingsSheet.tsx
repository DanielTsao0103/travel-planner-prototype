/**
 * Page 12 — "Budget settings" (12H, Owner only) and "Set my budget".
 *
 * The host picks how the trip budgets:
 *  - Group budget: one shared total; everyone sees all spending.
 *  - Individual budgets: each traveler sets their own; shared costs count
 *    toward each person's share.
 * Non-owners see the same sheet read-only with the reason it's locked.
 */

import { useRef, useState, type FormEvent } from 'react';
import { Check, Circle } from 'lucide-react';
import type { BudgetMode, Trip } from '../../data/types';
import type { TripAccess } from '../../lib/permissions';
import { money, round2 } from '../../lib/format';
import { setBudgetMode, setGroupBudget, setPersonalBudget } from '../../store/actions';
import { toast } from '../../store/toast';
import { Button } from '../../components/ui/Button';
import { LockNote } from '../../components/ui/Display';
import { Field, MoneyInput, Segmented } from '../../components/ui/Field';
import { Sheet } from '../../components/ui/Overlay';
import { moneyInputValue, parseMoney } from './budgetMath';
import type { Member } from './ExpenseForm';

const MODE_COPY: Record<BudgetMode, { title: string; body: string }> = {
  group: { title: 'Group budget', body: 'One shared total for the whole trip. Everyone sees all spending and what’s left.' },
  individual: { title: 'Individual budgets', body: 'Each traveler sets their own budget. Shared costs count toward each person’s share.' },
};

/** Check a typed budget amount; returns an error message or null. */
function budgetError(raw: string): string | null {
  const n = parseMoney(raw);
  if (raw.trim() === '') return 'Enter an amount, like 7500.';
  if (!Number.isFinite(n) || n <= 0) return 'Enter an amount greater than $0.';
  if (n > 10_000_000) return 'That’s more than $10,000,000. Check the amount.';
  return null;
}

/** Owner-only settings: group vs. individual budgets and the amounts. Read-only for everyone else. */
export function BudgetSettingsSheet({
  trip,
  access,
  members,
  initialMode,
  initialGroupAmount,
  ownerFirst,
  onClose,
  onSaved,
}: {
  trip: Trip;
  access: TripAccess;
  members: Member[];
  /** What the page currently shows (may be a forced preview state). */
  initialMode: BudgetMode;
  initialGroupAmount: number | null;
  ownerFirst: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const canEdit = access.canSetBudget;
  const acting = access.actingPersonId;
  const [mode, setMode] = useState<BudgetMode>(initialMode);
  const [amount, setAmount] = useState(moneyInputValue(initialGroupAmount));
  const [mine, setMine] = useState(moneyInputValue(trip.budget.personal[acting]));
  const [submitted, setSubmitted] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const groupError = submitted && mode === 'group' ? budgetError(amount) : null;
  // In individual mode your own amount is optional here (it can be set later).
  const mineError = submitted && mode === 'individual' && mine.trim() !== '' ? budgetError(mine) : null;

  const save = (e?: FormEvent) => {
    e?.preventDefault();
    if (!canEdit) return;
    setSubmitted(true);
    if ((mode === 'group' && budgetError(amount)) || (mode === 'individual' && mine.trim() !== '' && budgetError(mine))) {
      window.requestAnimationFrame(() => formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
      return;
    }
    setBudgetMode(trip.id, mode);
    if (mode === 'group') {
      const value = round2(parseMoney(amount));
      setGroupBudget(trip.id, value);
      toast({ title: 'Budget updated', body: `Group budget: ${money(value)}. Everyone sees all spending.` });
    } else {
      if (mine.trim() !== '') setPersonalBudget(trip.id, acting, round2(parseMoney(mine)));
      toast({ title: 'Budget updated', body: 'Each traveler now tracks their own budget.' });
    }
    onSaved();
  };

  const setCount = members.filter((m) => trip.budget.personal[m.id] !== undefined).length;

  return (
    <Sheet
      open
      onClose={onClose}
      title="Budget settings"
      description={canEdit ? 'Only you (the trip owner) can change these.' : undefined}
      footer={
        canEdit ? (
          <>
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" form="p12-settings-form">
              Save settings
            </Button>
          </>
        ) : (
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        )
      }
    >
      <form id="p12-settings-form" ref={formRef} onSubmit={save} noValidate className="p12-form">
        {!canEdit && <LockNote>{access.lockReason('setBudget')}</LockNote>}

        <div className="p12-fieldset">
          <span className="field-label" id="p12-mode-label">
            How should this trip budget?
          </span>
          <div className="p12-mode-seg">
            <Segmented<BudgetMode>
              label="Budget type"
              value={mode}
              onChange={setMode}
              disabled={!canEdit}
              options={[
                { value: 'group', label: 'Group budget' },
                { value: 'individual', label: 'Individual budgets' },
              ]}
            />
          </div>
          <p className="p12-mode-explain">
            <strong>{MODE_COPY[mode].title}.</strong> {MODE_COPY[mode].body}
          </p>
        </div>

        {mode === 'group' ? (
          <Field label="Group total" required error={groupError} hint="Covers lodging, food, activities, transport, and everything else.">
            {(p) => <MoneyInput {...p} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="7500" disabled={!canEdit} data-autofocus={canEdit ? true : undefined} />}
          </Field>
        ) : (
          <>
            <Field label="Your budget" aside="Optional" error={mineError} hint="Everyone sets their own with “Set my budget”.">
              {(p) => <MoneyInput {...p} value={mine} onChange={(e) => setMine(e.target.value)} placeholder="1800" disabled={!canEdit} />}
            </Field>
            <div className="p12-who-set">
              <p className="field-label">
                {setCount} of {members.length} travelers have set a budget
              </p>
              <ul>
                {members.map((m) => {
                  const isSet = trip.budget.personal[m.id] !== undefined;
                  return (
                    <li key={m.id} className={isSet ? 'is-set' : ''}>
                      {isSet ? <Check aria-hidden /> : <Circle aria-hidden />}
                      <span>{m.id === acting ? 'You' : m.name}</span>
                      <span className="muted small">{isSet ? 'Set' : 'Not set yet'}</span>
                    </li>
                  );
                })}
              </ul>
              <p className="xsmall muted">Amounts stay private to each traveler.</p>
            </div>
          </>
        )}
        {!canEdit && <p className="small muted">Ask {ownerFirst} if the budget should change.</p>}
      </form>
    </Sheet>
  );
}

/** "Set my budget" — anyone can set their own amount in individual mode. */
export function MyBudgetSheet({ trip, personId, onClose }: { trip: Trip; personId: string; onClose: () => void }) {
  const [value, setValue] = useState(moneyInputValue(trip.budget.personal[personId]));
  const [submitted, setSubmitted] = useState(false);
  const error = submitted ? budgetError(value) : null;

  const save = (e?: FormEvent) => {
    e?.preventDefault();
    setSubmitted(true);
    if (budgetError(value)) return;
    const amount = round2(parseMoney(value));
    setPersonalBudget(trip.id, personId, amount);
    toast({ title: 'Your budget is set', body: `${money(amount)} for this trip.` });
    onClose();
  };

  return (
    <Sheet
      open
      onClose={onClose}
      title="Set my budget"
      description="Your share of shared costs counts toward it."
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="p12-my-budget-form">
            Save budget
          </Button>
        </>
      }
    >
      <form id="p12-my-budget-form" onSubmit={save} noValidate className="p12-form">
        <Field label="My budget for this trip" required error={error} hint="Include lodging, food, activities, and getting around.">
          {(p) => <MoneyInput {...p} value={value} onChange={(e) => setValue(e.target.value)} placeholder="1800" data-autofocus />}
        </Field>
      </form>
    </Sheet>
  );
}
