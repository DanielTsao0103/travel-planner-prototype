/**
 * Page 12 — "Needs review": simulated Gmail receipt matches and bank alerts
 * waiting for a one-tap decision (12E, 12F), or the "Connect Gmail" card when
 * the account hasn't connected Gmail (12K).
 *
 * Everything here is DEMO DATA. Nothing reads a real inbox or bank account;
 * each card says so with a "Demo data" badge, and the footer explains it.
 */

import { CheckCheck, FlaskConical, Landmark, Link2, Mail } from 'lucide-react';
import type { DemoNotification, ISODate, Trip, TripEvent } from '../../data/types';
import { formatShortDate, formatTime } from '../../lib/dates';
import { money } from '../../lib/format';
import { addExpense, deleteExpense, pushDemoNotification, resolveDemoNotification } from '../../store/actions';
import { update } from '../../store/store';
import { toast } from '../../store/toast';
import { navigate, withQuery } from '../../router/router';
import { paths } from '../../router/routes';
import { Button } from '../../components/ui/Button';
import { DemoBadge } from '../../components/ui/Display';
import { eventDay, eventNoun, matchEvent, merchantBase, purposeFromNotification } from './budgetMath';
import { CATEGORY_META } from './categories';

/**
 * Put a demo notification back to "new" (for Undo).
 * Escape hatch (see docs/ARCHITECTURE.md): the shared actions can mark a
 * notification logged/ignored but can't reopen it, which Undo needs.
 */
function reopenNotification(notificationId: string): void {
  update((draft) => {
    const n = draft.notifications.find((x) => x.id === notificationId);
    if (n) n.status = 'new';
  });
}

/** "Needs review" card: one-tap decisions on simulated Gmail receipts and bank alerts. */
export function ReviewQueue({
  trip,
  events,
  items,
  gmailConnected,
  actingPersonId,
  acceptedIds,
  today,
  flash,
  logLocked,
  onLogged,
}: {
  trip: Trip;
  events: TripEvent[];
  /** New, visible notifications for this trip (newest first). */
  items: DemoNotification[];
  gmailConnected: boolean;
  actingPersonId: string;
  acceptedIds: string[];
  today: ISODate;
  /** Briefly outline the section (deep link s=matches). */
  flash: boolean;
  /** Reason logging is unavailable (pending invitees), or false. */
  logLocked: string | false;
  /** Called with the new expense id so the page can highlight it. */
  onLogged: (expenseId: string) => void;
}) {
  // Without Gmail there'd be no receipt matches, so only bank alerts remain.
  const visible = items.filter((n) => n.kind === 'bank' || gmailConnected);

  /** Turn a demo notification into an expense (with Undo). */
  const log = (n: DemoNotification) => {
    const matched = n.kind === 'gmail' ? matchEvent(n.merchant, events) : undefined;
    // A receipt matched to a group plan is shared by that plan's attendees; anything else is just yours.
    const attendees = matched ? matched.attendeeIds.filter((id) => acceptedIds.includes(id)) : [];
    const expenseId = addExpense({
      tripId: trip.id,
      amount: n.amount,
      purpose: purposeFromNotification(n, matched),
      category: n.category,
      date: n.date,
      paidById: actingPersonId,
      splitWithIds: attendees.length > 0 ? attendees : [actingPersonId],
      source: n.kind === 'gmail' ? 'gmail-demo' : 'bank-demo',
      merchant: merchantBase(n.merchant),
      requestRepayment: false,
    });
    resolveDemoNotification(n.id, 'logged');
    toast({
      title: n.kind === 'gmail' ? 'Added to budget' : `Logged as ${CATEGORY_META[n.category].label}`,
      body: `${merchantBase(n.merchant)} · ${money(n.amount)}`,
      action: {
        label: 'Undo',
        onClick: () => {
          deleteExpense(expenseId);
          reopenNotification(n.id);
        },
      },
    });
    onLogged(expenseId);
  };

  /** "Ignore" / "Not a trip expense": hide it without logging anything (with Undo). */
  const dismiss = (n: DemoNotification) => {
    resolveDemoNotification(n.id, 'ignored');
    toast({
      title: n.kind === 'gmail' ? 'Receipt ignored' : 'Marked as not a trip expense',
      body: 'It won’t be added to the budget.',
      tone: 'info',
      action: { label: 'Undo', onClick: () => reopenNotification(n.id) },
    });
  };

  /** Prototype helper: make a new fictional item arrive so testers can try the flow again. */
  const simulate = (kind: 'bank' | 'gmail') => {
    if (kind === 'bank') {
      pushDemoNotification({ kind, tripId: trip.id, amount: 12.6, merchant: 'Pastelaria Sol Nascente', category: 'food', date: today });
    } else {
      pushDemoNotification({ kind, tripId: trip.id, amount: 72, merchant: 'Barco do Rio cruise (email receipt)', category: 'activities', date: today });
    }
  };

  return (
    <section id="p12-review" className={`p12-card p12-review ${flash ? 'is-flash' : ''}`} aria-labelledby="p12-review-title">
      <header className="p12-card-head">
        <h2 id="p12-review-title" className="p12-card-title">
          Needs review
          {visible.length > 0 && <span className="p12-count num">{visible.length}</span>}
        </h2>
        <DemoBadge>Demo data</DemoBadge>
      </header>

      <div className="p12-review-list">
        {!gmailConnected && (
          <div className="p12-review-item p12-connect">
            <span className="p12-review-icon is-gmail" aria-hidden>
              <Mail />
            </span>
            <div className="p12-review-body">
              <p className="p12-review-title">Connect Gmail to match receipts automatically</p>
              <p className="p12-review-meta">Receipts from travel and shopping senders show up here for you to confirm. Read-only. You choose what gets added.</p>
              <div className="p12-review-actions">
                <Button size="sm" variant="secondary" icon={<Mail />} onClick={() => navigate(withQuery(paths.connectService('gmail'), { return: paths.budget(trip.id) }))}>
                  Connect Gmail
                </Button>
              </div>
            </div>
          </div>
        )}

        {visible.map((n) => {
          const matched = n.kind === 'gmail' ? matchEvent(n.merchant, events) : undefined;
          const isGmail = n.kind === 'gmail';
          return (
            <article key={n.id} className="p12-review-item" aria-label={`${isGmail ? 'Receipt in Gmail' : 'Bank alert'}: ${money(n.amount)} at ${n.merchant}`}>
              <span className={`p12-review-icon ${isGmail ? 'is-gmail' : 'is-bank'}`} aria-hidden>
                {isGmail ? <Mail /> : <Landmark />}
              </span>
              <div className="p12-review-body">
                <div className="p12-review-top">
                  <p className="p12-review-title">{n.merchant}</p>
                  <span className="p12-review-amount num">{money(n.amount)}</span>
                </div>
                <p className="p12-review-meta">
                  <span>
                    {isGmail ? 'Receipt in Gmail' : 'Bank alert'} · {formatShortDate(n.date)}
                  </span>
                  <DemoBadge>Demo data</DemoBadge>
                </p>
                {matched && (
                  <p className="p12-review-match">
                    <Link2 aria-hidden />
                    <span>
                      Matches your {eventNoun(matched)} on Day {eventDay(trip, matched)} · {formatTime(matched.start)}
                    </span>
                  </p>
                )}
                {!isGmail && <p className="p12-review-hint">Looks like {CATEGORY_META[n.category].label.toLowerCase()}.</p>}
                <div className="p12-review-actions">
                  <Button size="sm" locked={logLocked} onClick={() => log(n)}>
                    {isGmail ? 'Add to budget' : `Log as ${CATEGORY_META[n.category].short}`}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => dismiss(n)}>
                    {isGmail ? 'Ignore' : 'Not a trip expense'}
                  </Button>
                </div>
              </div>
            </article>
          );
        })}

        {visible.length === 0 && (
          <div className="p12-review-empty">
            <span className="p12-review-icon is-done" aria-hidden>
              <CheckCheck />
            </span>
            <div className="p12-review-body">
              <p className="p12-review-title">You’re all caught up</p>
              <p className="p12-review-meta">{gmailConnected ? 'Matched Gmail receipts and bank alerts show up here.' : 'Bank alerts show up here.'}</p>
              <div className="p12-proto-sim">
                <span className="xsmall muted">Prototype: simulate one</span>
                <div className="cluster">
                  <Button size="sm" variant="ghost" icon={<FlaskConical />} onClick={() => simulate('bank')}>
                    Bank alert
                  </Button>
                  {gmailConnected && (
                    <Button size="sm" variant="ghost" icon={<FlaskConical />} onClick={() => simulate('gmail')}>
                      Gmail receipt
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <p className="p12-review-explainer">
        <FlaskConical aria-hidden />
        <span>Demo: in a real app these would come from Gmail (with permission) and a bank-data connection. Nothing here is real.</span>
      </p>
    </section>
  );
}
