/**
 * Overlays: Sheet (dialog / bottom sheet), Toaster, and Popover menus.
 *
 * Sheet adapts to the screen: a centered dialog (or right-side panel with
 * variant="side") on tablet/desktop, and a bottom sheet on phones — the
 * thumb-friendly pattern mobile users expect.
 */

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { dismissToast, useToasts } from '../../store/toast';
import { IconButton } from './Button';
import './overlay.css';

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  /** Sticky action row at the bottom. */
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
  /** 'dialog' (centered) or 'side' (right panel) on larger screens. */
  variant?: 'dialog' | 'side';
  /** Full screen on phones (for long forms / provider flows). */
  fullOnMobile?: boolean;
  /** Prevent closing by clicking the backdrop (e.g. while saving). */
  dismissible?: boolean;
  className?: string;
}

export function Sheet({ open, onClose, title, description, children, footer, size = 'md', variant = 'dialog', fullOnMobile, dismissible = true, className = '' }: SheetProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descId = useId();
  const lastFocused = useRef<HTMLElement | null>(null);
  // Keep the latest onClose in a ref so the effect below doesn't re-run (and
  // steal focus) every time the parent re-renders with a new arrow function.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const dismissibleRef = useRef(dismissible);
  dismissibleRef.current = dismissible;

  useEffect(() => {
    if (!open) return;
    lastFocused.current = document.activeElement as HTMLElement;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    // Focus the first field (or the panel) once it's rendered.
    const t = window.setTimeout(() => {
      const panel = panelRef.current;
      // Focus a field the page marked with data-autofocus; otherwise the dialog itself,
      // so screen readers announce its title and Tab moves into it.
      const preferred = panel?.querySelector<HTMLElement>('[data-autofocus]');
      (preferred ?? panel)?.focus();
    }, 30);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && dismissibleRef.current) {
        e.stopPropagation();
        onCloseRef.current();
      }
      if (e.key === 'Tab' && panelRef.current) {
        // Keep keyboard focus inside the dialog.
        const items = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.offsetParent !== null);
        if (items.length === 0) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      window.clearTimeout(t);
      document.body.style.overflow = prevOverflow;
      document.removeEventListener('keydown', onKey);
      lastFocused.current?.focus?.();
    };
  }, [open]);

  if (!open) return null;
  return createPortal(
    <div className={`sheet-root sheet-${variant} ${fullOnMobile ? 'sheet-full-mobile' : ''}`}>
      <div className="sheet-backdrop" onClick={dismissible ? onClose : undefined} aria-hidden />
      <div
        ref={panelRef}
        className={`sheet-panel sheet-${size} ${className}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
      >
        <div className="sheet-grabber" aria-hidden />
        <header className="sheet-head">
          <div className="stack-xs grow">
            <h2 id={titleId} className="sheet-title">
              {title}
            </h2>
            {description && (
              <p id={descId} className="sheet-desc">
                {description}
              </p>
            )}
          </div>
          {dismissible && <IconButton label="Close" icon={<X />} onClick={onClose} />}
        </header>
        <div className="sheet-body">{children}</div>
        {footer && <footer className="sheet-foot">{footer}</footer>}
      </div>
    </div>,
    document.body,
  );
}

/* ----------------------------------------------------------------- toasts */

const TOAST_ICON = {
  success: <CheckCircle2 aria-hidden />,
  info: <Info aria-hidden />,
  warning: <AlertTriangle aria-hidden />,
  error: <XCircle aria-hidden />,
};

export function Toaster() {
  const toasts = useToasts();
  return createPortal(
    <div className="toaster" aria-live="polite" aria-atomic="false">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast-${t.tone}`} role={t.tone === 'error' ? 'alert' : 'status'}>
          <span className="toast-icon">{TOAST_ICON[t.tone]}</span>
          <div className="toast-body">
            <p className="toast-title">{t.title}</p>
            {t.body && <p className="toast-text">{t.body}</p>}
          </div>
          {t.action && (
            <button
              type="button"
              className="toast-action"
              onClick={() => {
                t.action?.onClick();
                dismissToast(t.id);
              }}
            >
              {t.action.label}
            </button>
          )}
          <button type="button" className="toast-close" aria-label="Dismiss" onClick={() => dismissToast(t.id)}>
            <X aria-hidden />
          </button>
        </div>
      ))}
    </div>,
    document.body,
  );
}

/* ---------------------------------------------------------------- popover */

/**
 * A dropdown panel anchored to a trigger. Closes on outside click or Escape.
 *  <Popover trigger={(props) => <button {...props}>Menu</button>}>…items…</Popover>
 */
export function Popover({
  trigger,
  children,
  align = 'start',
  width = 280,
  label,
}: {
  trigger: (props: { onClick: () => void; 'aria-expanded': boolean; 'aria-haspopup': 'menu' | 'dialog'; 'aria-controls': string }) => ReactNode;
  children: (close: () => void) => ReactNode;
  align?: 'start' | 'end';
  width?: number;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="popover-root" ref={rootRef}>
      {trigger({ onClick: () => setOpen((v) => !v), 'aria-expanded': open, 'aria-haspopup': 'dialog', 'aria-controls': id })}
      {open && (
        <div id={id} className={`popover-panel popover-${align}`} style={{ width }} role="dialog" aria-label={label}>
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}
