/**
 * Page 12 — a FICTIONAL receipt drawn in HTML, used by "Use a sample receipt"
 * so testers can try scanning without a real one. The store doesn't exist.
 */

import type { ExpenseCategory, ISODate, Time } from '../../data/types';
import { formatLongDate, formatTime } from '../../lib/dates';
import { money } from '../../lib/format';

/** What the simulated reader "finds" on the sample receipt. */
export const SAMPLE_RECEIPT = {
  merchant: 'Farmácia Estrela',
  purpose: 'Sunscreen & bandages',
  category: 'shopping' as ExpenseCategory,
  items: [
    { name: 'Sunscreen SPF50', amount: 10.9 },
    { name: 'Bandages x20', amount: 3.95 },
  ],
  total: 14.85,
};

/** The fictional receipt, styled like thermal paper. `compact` shrinks it for thumbnails. */
export function SampleReceipt({ date, time, compact }: { date: ISODate; time: Time; compact?: boolean }) {
  return (
    <figure className={`p12-receipt ${compact ? 'is-compact' : ''}`} aria-label={`Sample receipt: ${SAMPLE_RECEIPT.merchant}, ${money(SAMPLE_RECEIPT.total)} (fictional)`}>
      <div className="p12-receipt-paper">
        <p className="p12-receipt-store">FARMÁCIA ESTRELA</p>
        <p className="p12-receipt-sub">Pharmacy · Lisbon</p>
        <p className="p12-receipt-sub">Sample (fictional)</p>
        <hr />
        <p className="p12-receipt-line">
          <span>{formatLongDate(date)}</span>
          <span>{formatTime(time)}</span>
        </p>
        <hr />
        {SAMPLE_RECEIPT.items.map((item) => (
          <p key={item.name} className="p12-receipt-line">
            <span>{item.name}</span>
            <span>{money(item.amount)}</span>
          </p>
        ))}
        <hr />
        <p className="p12-receipt-line is-total">
          <span>TOTAL</span>
          <span>{money(SAMPLE_RECEIPT.total)}</span>
        </p>
        <p className="p12-receipt-line">
          <span>Paid by card</span>
          <span>USD</span>
        </p>
        <hr />
        <p className="p12-receipt-thanks">Obrigado!</p>
      </div>
    </figure>
  );
}
