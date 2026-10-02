/**
 * Page 12 — a small "⋯" row menu (Edit / Delete) for the expense table.
 *
 * Why not the shared <Popover>? The table sits in a horizontally scrollable
 * wrapper, and anything absolutely positioned inside it gets clipped. This
 * menu is rendered into <body> with fixed positioning, measured from the
 * trigger, and flips upward when there isn't room below.
 */

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { MoreHorizontal } from 'lucide-react';

export interface RowMenuItem {
  key: string;
  label: string;
  icon: ReactNode;
  onSelect: () => void;
  danger?: boolean;
}

/** Room kept clear at the bottom of the screen for the sticky summary bar. */
const BOTTOM_RESERVE = 96;

/** "⋯" button that opens a small fixed-position menu of row actions. */
export function RowMenu({ label, items, size = 'sm' }: { label: string; items: RowMenuItem[]; size?: 'sm' | 'md' }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top?: number; bottom?: number; right: number }>({ right: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Place the menu under (or above) the button, right-aligned to it.
  useLayoutEffect(() => {
    if (!open || !btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    const menuH = menuRef.current?.offsetHeight ?? items.length * 44 + 16;
    const right = Math.max(8, window.innerWidth - r.right);
    if (r.bottom + 6 + menuH > window.innerHeight - BOTTOM_RESERVE) setPos({ bottom: window.innerHeight - r.top + 6, right });
    else setPos({ top: r.bottom + 6, right });
    menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus({ preventScroll: true });
  }, [open, items.length]);

  // Close on outside click, Escape, scroll, or resize (a fixed menu would drift otherwise).
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!menuRef.current?.contains(t) && !btnRef.current?.contains(t)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        close();
        btnRef.current?.focus();
      }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        // Move focus between menu items with the arrow keys.
        const list = Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
        const i = list.indexOf(document.activeElement as HTMLElement);
        const next = e.key === 'ArrowDown' ? (i + 1) % list.length : (i - 1 + list.length) % list.length;
        list[next]?.focus();
        e.preventDefault();
      }
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [open]);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className={`icon-btn icon-btn-ghost icon-btn-${size} p12-row-menu-btn`}
        aria-label={label}
        title={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
      >
        <MoreHorizontal aria-hidden />
      </button>
      {open &&
        createPortal(
          <div ref={menuRef} className="p12-menu" role="menu" aria-label={label} style={{ top: pos.top, bottom: pos.bottom, right: pos.right }}>
            {items.map((item) => (
              <button
                key={item.key}
                type="button"
                role="menuitem"
                className={`menu-item ${item.danger ? 'p12-menu-danger' : ''}`}
                onClick={() => {
                  setOpen(false);
                  item.onSelect();
                }}
              >
                {item.icon}
                {item.label}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </>
  );
}
