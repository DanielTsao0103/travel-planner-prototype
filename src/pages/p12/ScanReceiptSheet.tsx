/**
 * Page 12 — "Scan receipt" (12D): take or choose a photo (or use a fictional
 * sample), "read" it, then review and save.
 *
 * Reading is SIMULATED. Photos are previewed locally with an object URL and
 * never leave the browser. Because a prototype can't actually read a photo,
 * an uploaded receipt only gets its date filled in, and the sheet says so.
 */

import { useEffect, useRef, useState, type ChangeEvent, type DragEvent, type FormEvent } from 'react';
import { Camera, ImageOff, Loader2, ReceiptText, ShieldCheck } from 'lucide-react';
import { minToTime, timeToMin } from '../../lib/dates';
import { money, plural, round2 } from '../../lib/format';
import { simulateLatency } from '../../services/http';
import { addExpense } from '../../store/actions';
import { now } from '../../store/selectors';
import { toast } from '../../store/toast';
import { Button } from '../../components/ui/Button';
import { DemoBadge, Skeleton } from '../../components/ui/Display';
import { Sheet } from '../../components/ui/Overlay';
import { defaultExpenseDate, parseMoney, repaymentShares } from './budgetMath';
import { ExpenseFields, validateDraft, type ExpenseDraft } from './ExpenseForm';
import { blankDraft, focusFirstError, type SheetContext } from './ExpenseSheet';
import { SAMPLE_RECEIPT, SampleReceipt } from './SampleReceipt';

type Step = 'choose' | 'reading' | 'review';
type ReceiptSource = { kind: 'sample' } | { kind: 'upload'; url: string; name: string };

/** Three steps in one sheet: choose a photo (or the sample) → "Reading receipt…" → review and save. */
export function ScanReceiptSheet({ ctx, onClose, onSaved }: { ctx: SheetContext; onClose: () => void; onSaved: (expenseId: string) => void }) {
  const { trip, state, access, members, today, isMobile } = ctx;
  const acting = access.actingPersonId;
  const receiptDate = defaultExpenseDate(today, trip);
  // The sample receipt is stamped a few minutes before the demo clock.
  const receiptTime = minToTime(timeToMin(now(state).time) - 20);
  // Receipts are usually personal purchases, so the split starts as "just you".
  const freshDraft = (): ExpenseDraft => ({ ...blankDraft(ctx), splitWithIds: [acting] });

  const [step, setStep] = useState<Step>('choose');
  const [source, setSource] = useState<ReceiptSource | null>(null);
  const [draft, setDraft] = useState<ExpenseDraft>(freshDraft);
  const [submitted, setSubmitted] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [previewFailed, setPreviewFailed] = useState(false);
  const [dragging, setDragging] = useState(false);
  const runRef = useRef(0); // bumps on cancel/restart so a late "reading" result is ignored
  const urlRef = useRef<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  // Free the local preview URL when the sheet closes.
  useEffect(
    () => () => {
      runRef.current += 1;
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    },
    [],
  );

  const isUpload = source?.kind === 'upload';
  const errors = submitted ? validateDraft(draft, today, { requireMerchant: true }) : {};

  const read = async (src: ReceiptSource) => {
    setSource(src);
    setPreviewFailed(false);
    setSubmitted(false);
    setStep('reading');
    const run = ++runRef.current;
    await simulateLatency(1500);
    if (run !== runRef.current) return; // canceled, restarted, or closed
    if (src.kind === 'sample') {
      setDraft({ ...freshDraft(), amount: String(SAMPLE_RECEIPT.total), merchant: SAMPLE_RECEIPT.merchant, purpose: SAMPLE_RECEIPT.purpose, category: SAMPLE_RECEIPT.category, date: receiptDate });
    } else {
      setDraft({ ...freshDraft(), date: receiptDate });
    }
    setStep('review');
  };

  const takeFile = (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setFileError('That file isn’t a photo. Choose a JPG, PNG, or HEIC image of the receipt.');
      return;
    }
    setFileError(null);
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    const url = URL.createObjectURL(file); // stays in this browser; nothing is uploaded
    urlRef.current = url;
    void read({ kind: 'upload', url, name: file.name });
  };

  const onFileInput = (e: ChangeEvent<HTMLInputElement>) => {
    takeFile(e.target.files?.[0]);
    e.target.value = ''; // lets the same photo be chosen again
  };

  const onDrop = (e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setDragging(false);
    takeFile(e.dataTransfer.files?.[0]);
  };

  const startOver = () => {
    runRef.current += 1;
    setStep('choose');
    setSource(null);
    setSubmitted(false);
    setDraft(freshDraft());
  };

  const save = (e?: FormEvent) => {
    e?.preventDefault();
    setSubmitted(true);
    const errs = validateDraft(draft, today, { requireMerchant: true });
    if (Object.keys(errs).length > 0) {
      focusFirstError(formRef.current);
      return;
    }
    const amount = round2(parseMoney(draft.amount));
    const others = draft.requestRepayment ? repaymentShares(amount, draft.splitWithIds, draft.paidById) : [];
    const id = addExpense({
      tripId: trip.id,
      amount,
      purpose: draft.purpose.trim(),
      category: draft.category!,
      date: draft.date,
      paidById: draft.paidById,
      splitWithIds: draft.splitWithIds,
      source: 'receipt',
      merchant: draft.merchant.trim() || undefined,
      requestRepayment: others.length > 0,
    });
    toast({ title: 'Receipt added', body: `${draft.merchant.trim()} · ${money(amount)}` });
    if (others.length > 0) {
      toast({ title: `Notified ${plural(others.length, 'person', 'people')} (simulated)`, body: 'They’ll see what they owe under “Who owes whom”. Nothing was actually sent.', tone: 'info' });
    }
    onSaved(id);
  };

  const preview =
    source?.kind === 'sample' ? (
      <SampleReceipt date={receiptDate} time={receiptTime} compact />
    ) : source?.kind === 'upload' && !previewFailed ? (
      <img src={source.url} alt="Your receipt photo" className="p12-scan-img" onError={() => setPreviewFailed(true)} />
    ) : (
      <div className="p12-scan-img-fallback">
        <ImageOff aria-hidden />
        <span>This browser can’t preview that file type, but you can still fill in the details.</span>
      </div>
    );

  const footer =
    step === 'review' ? (
      <>
        <Button variant="ghost" onClick={startOver}>
          Start over
        </Button>
        <Button type="submit" form="p12-scan-form">
          Save expense
        </Button>
      </>
    ) : (
      <Button variant="ghost" onClick={step === 'reading' ? startOver : onClose}>
        Cancel
      </Button>
    );

  return (
    <Sheet open onClose={onClose} title="Scan a receipt" description={step === 'choose' ? 'Add an expense you haven’t logged yet from its receipt.' : undefined} fullOnMobile size="lg" footer={footer}>
      {step === 'choose' && (
        <div className="p12-scan-choose">
          <label
            className={`p12-upload ${dragging ? 'is-dragging' : ''}`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
          >
            {/* capture="environment" opens the rear camera on phones; desktops get a file picker. */}
            <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={onFileInput} data-autofocus />
            <span className="p12-upload-icon" aria-hidden>
              <Camera />
            </span>
            <span className="p12-upload-title">{isMobile ? 'Take a photo of the receipt' : 'Upload a photo of the receipt'}</span>
            <span className="p12-upload-sub">{isMobile ? 'Opens your camera. You can also pick a photo.' : 'Choose a photo or drop one here. JPG, PNG, or HEIC.'}</span>
          </label>
          {fileError && (
            <p className="field-error" role="alert">
              {fileError}
            </p>
          )}

          <div className="p12-or" aria-hidden>
            <span>or</span>
          </div>

          <div className="p12-sample-pick">
            <div className="p12-sample-thumb">
              <SampleReceipt date={receiptDate} time={receiptTime} compact />
            </div>
            <div className="p12-sample-copy">
              <p className="p12-sample-title">No receipt handy?</p>
              <p className="small muted">Try a fictional pharmacy receipt for {money(SAMPLE_RECEIPT.total)}.</p>
            </div>
            <Button variant="secondary" icon={<ReceiptText />} className="p12-sample-btn" onClick={() => void read({ kind: 'sample' })}>
              Use a sample receipt
            </Button>
          </div>

          <p className="p12-privacy">
            <ShieldCheck aria-hidden />
            <span>Your photo stays on this device. It’s previewed in your browser and never uploaded.</span>
          </p>
        </div>
      )}

      {step === 'reading' && (
        <div className="p12-scan-reading" role="status" aria-live="polite">
          <div className="p12-scan-preview is-scanning">
            {preview}
            <span className="p12-scan-line" aria-hidden />
          </div>
          <div className="p12-scan-reading-copy">
            <p className="p12-scan-reading-title">
              <Loader2 className="spin" aria-hidden /> Reading receipt…
            </p>
            <p className="small muted">Looking for the store, total, and date.</p>
            <div className="stack-sm" aria-hidden>
              <Skeleton height={14} width="72%" />
              <Skeleton height={14} width="48%" />
              <Skeleton height={14} width="60%" />
            </div>
          </div>
        </div>
      )}

      {step === 'review' && source && (
        <div className="p12-scan-review">
          <div className="p12-scan-preview">{preview}</div>
          <div className="p12-scan-fields">
            <div className="p12-scan-note">
              <DemoBadge>Simulated</DemoBadge>
              <p className="small">
                {isUpload
                  ? 'The prototype can’t really read photos, so only the date is filled in. Copy the store and total from your receipt.'
                  : 'A simulated reader filled these in from the sample receipt. Check them before saving.'}
              </p>
            </div>
            <form id="p12-scan-form" ref={formRef} onSubmit={save} noValidate>
              <ExpenseFields
                draft={draft}
                onChange={(p) => setDraft((d) => ({ ...d, ...p }))}
                errors={errors}
                members={members}
                actingPersonId={acting}
                canChoosePayer={access.role === 'owner'}
                payerLockHint="You can log what you paid."
                today={today}
                order="merchant-first"
                hints={
                  isUpload
                    ? { merchant: 'Not read from the photo. Type the store name.', amount: 'Not read. Type the total.' }
                    : { category: 'Suggested' }
                }
              />
            </form>
          </div>
        </div>
      )}
    </Sheet>
  );
}
