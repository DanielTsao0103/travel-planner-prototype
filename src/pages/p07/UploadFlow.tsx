/**
 * The "Upload confirmation" tab's screens (Page 7):
 *  7D  UploadPicker   drop zone / file picker / "Use a sample confirmation"
 *  7E  ReadingCard    "Reading your screenshot…" with progress
 *  7G  UnreadableCard couldn't read it → try another image or type it in
 *  ShotPreview shows the image itself (side column on desktop, a fold-out on phones).
 *
 * Images are previewed with URL.createObjectURL, so they never leave the browser.
 */

import { useEffect, useRef, useState, type DragEvent } from 'react';
import { AlertCircle, Check, Circle, FileText, ImageOff, ImagePlus, ImageUp, Loader2, PenLine, ShieldCheck } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Banner, DemoBadge } from '../../components/ui/Display';
import { SampleConfirmation, type SampleTicket } from './SampleConfirmation';

/** What's being read: the built-in sample, a tester's file, or nothing to show (forced 7G). */
export type ShotImage = { kind: 'sample' } | { kind: 'file'; url: string; name: string; size: number } | { kind: 'placeholder' };

/**
 * Does this image look like a readable screenshot? It must decode, and its
 * short side must be at least 300px (tiny icons and thumbnails "fail").
 */
export function checkImage(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(Math.min(img.naturalWidth, img.naturalHeight) >= 300);
    img.onerror = () => resolve(false);
    img.src = url;
  });
}

/** The image itself, full size (scrolls inside its frame if it's tall). */
export function ShotPreview({ image, ticket, caption = true }: { image: ShotImage; ticket: SampleTicket; caption?: boolean }) {
  return (
    <figure className="p07-shot">
      <div className="p07-shot-frame">
        {image.kind === 'sample' ? (
          <SampleConfirmation ticket={ticket} />
        ) : image.kind === 'file' ? (
          <img src={image.url} alt="Your screenshot" className="p07-shot-img" />
        ) : (
          <span className="p07-shot-blank" role="img" aria-label="An unreadable image">
            <ImageOff aria-hidden />
          </span>
        )}
      </div>
      {caption && (
        <figcaption className="p07-shot-caption">{image.kind === 'sample' ? 'Sample confirmation from a fictional vendor' : 'Your image stays in this browser'}</figcaption>
      )}
    </figure>
  );
}

/* ------------------------------------------------------------------ 7D */

/** 7D: drop an image, choose one, paste one, or use the sample. */
export function UploadPicker({ onFile, onSample, error, isMobile }: { onFile: (file: File) => void; onSample: () => void; error?: string; isMobile: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) onFile(file);
  };

  return (
    <div className="p07-upload">
      <div
        className={`p07-drop ${over ? 'is-over' : ''}`}
        onDragOver={(e) => {
          e.preventDefault(); // allows dropping here
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={onDrop}
      >
        <span className="p07-drop-icon" aria-hidden>
          <ImageUp />
        </span>
        <p className="p07-drop-title">{isMobile ? 'Add a screenshot of your booking' : 'Drop a screenshot of your booking here'}</p>
        <p className="p07-drop-text">Confirmation emails, tickets, or reservation screens. We’ll pull out the place, date, time, price, and booking code.</p>
        <div className="p07-drop-actions">
          <Button icon={<ImagePlus />} onClick={() => inputRef.current?.click()} block={isMobile}>
            {isMobile ? 'Choose a screenshot' : 'Choose an image'}
          </Button>
          <Button variant="secondary" icon={<FileText />} onClick={onSample} block={isMobile}>
            Use a sample confirmation
          </Button>
        </div>
        {!isMobile && <p className="p07-drop-hint">You can also paste an image with ⌘V or Ctrl+V.</p>}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = ''; // so choosing the same file again still triggers a change
            if (file) onFile(file);
          }}
        />
      </div>

      {error && (
        <p className="field-error" role="alert">
          <AlertCircle aria-hidden />
          <span>{error}</span>
        </p>
      )}

      <div className="p07-upload-notes">
        <p className="p07-note">
          <ShieldCheck aria-hidden />
          <span>Your image stays in this browser. Nothing is uploaded or stored.</span>
        </p>
        <p className="p07-note">
          <DemoBadge>Simulated</DemoBadge>
          <span>Reading screenshots is simulated in this prototype. You’ll check every detail before saving.</span>
        </p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ 7E */

const STEPS = ['Finding the place and address', 'Reading the date and time', 'Looking for prices and a booking code'];

/** 7E: the screenshot being "read", with progress and three steps that tick off. */
export function ReadingCard({
  image,
  ticket,
  frozen,
  durationMs,
  onCancel,
}: {
  image: ShotImage;
  ticket: SampleTicket;
  /** Forced state (?s=reading): hold on the middle step instead of finishing. */
  frozen?: boolean;
  durationMs: number;
  onCancel: () => void;
}) {
  const [step, setStep] = useState(frozen ? 1 : 0);
  useEffect(() => {
    if (frozen) return;
    const t1 = window.setTimeout(() => setStep(1), durationMs / 3);
    const t2 = window.setTimeout(() => setStep(2), (2 * durationMs) / 3);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [frozen, durationMs]);

  return (
    <div className="p07-reading">
      <div className="p07-reading-thumb" aria-hidden>
        <div className="p07-reading-mini">
          {image.kind === 'sample' ? <SampleConfirmation ticket={ticket} /> : image.kind === 'file' ? <img src={image.url} alt="" /> : <span className="p07-shot-blank" />}
        </div>
        <span className="p07-scanline" />
      </div>
      <div className="p07-reading-body" role="status" aria-live="polite">
        <p className="p07-reading-title">Reading your screenshot…</p>
        <div className="p07-progress" aria-hidden>
          <span className={frozen ? 'is-frozen' : ''} style={{ animationDuration: `${durationMs}ms` }} />
        </div>
        <ol className="p07-steps">
          {STEPS.map((label, i) => (
            <li key={label} className={i < step ? 'is-done' : i === step ? 'is-active' : ''}>
              {i < step ? <Check aria-hidden /> : i === step ? <Loader2 className="spin" aria-hidden /> : <Circle aria-hidden />}
              <span>{label}</span>
            </li>
          ))}
        </ol>
        <div className="p07-reading-foot">
          <DemoBadge>Simulated</DemoBadge>
          <Button variant="ghost" size="sm" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ 7G */

/** 7G: the image couldn't be read; try another or type the details in. */
export function UnreadableCard({ image, ticket, onRetry, onManual }: { image: ShotImage; ticket: SampleTicket; onRetry: () => void; onManual: () => void }) {
  return (
    <div className="p07-unreadable">
      <div className="p07-unreadable-thumb" aria-hidden>
        <div className="p07-reading-mini">
          {image.kind === 'sample' ? <SampleConfirmation ticket={ticket} /> : image.kind === 'file' ? <img src={image.url} alt="" /> : <span className="p07-shot-blank" />}
        </div>
        <span className="p07-unreadable-badge">
          <ImageOff />
        </span>
      </div>
      <div className="p07-unreadable-body">
        <Banner tone="warning" title="We couldn’t read this image.">
          Try a clearer screenshot, or enter the details yourself.
        </Banner>
        <div className="p07-unreadable-actions">
          <Button icon={<ImageUp />} onClick={onRetry}>
            Try another image
          </Button>
          <Button variant="secondary" icon={<PenLine />} onClick={onManual}>
            Enter details yourself
          </Button>
        </div>
        <ul className="p07-tips">
          <li>Crop to the confirmation itself.</li>
          <li>Make sure the place, date, and time are in view.</li>
          <li>Use a screenshot rather than a photo of a screen.</li>
        </ul>
      </div>
    </div>
  );
}
