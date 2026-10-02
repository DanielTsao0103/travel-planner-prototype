/**
 * Page 12 — category metadata and the small "chips" used across the budget:
 * colored category dots/chips, category icon tiles, and the source badge
 * (Manual / Receipt / Gmail · demo / Bank alert · demo).
 *
 * Colors come from the --cat-* tokens in tokens.css, so they adapt to dark mode.
 */

import type { CSSProperties } from 'react';
import { BedDouble, CarFront, CircleEllipsis, PenLine, ReceiptText, ShoppingBag, Ticket, UtensilsCrossed, type LucideIcon } from 'lucide-react';
import type { ExpenseCategory, ExpenseSource } from '../../data/types';
import { Badge, DemoBadge } from '../../components/ui/Display';

export interface CategoryMeta {
  /** Full label ("Food & drink"). */
  label: string;
  /** Short label for tight buttons ("Food"). */
  short: string;
  /** CSS color (a token reference). */
  color: string;
  Icon: LucideIcon;
}

export const CATEGORY_META: Record<ExpenseCategory, CategoryMeta> = {
  lodging: { label: 'Lodging', short: 'Lodging', color: 'var(--cat-lodging)', Icon: BedDouble },
  food: { label: 'Food & drink', short: 'Food', color: 'var(--cat-food)', Icon: UtensilsCrossed },
  activities: { label: 'Activities', short: 'Activities', color: 'var(--cat-activities)', Icon: Ticket },
  transport: { label: 'Transport', short: 'Transport', color: 'var(--cat-transport)', Icon: CarFront },
  shopping: { label: 'Shopping', short: 'Shopping', color: 'var(--cat-shopping)', Icon: ShoppingBag },
  other: { label: 'Other', short: 'Other', color: 'var(--cat-other)', Icon: CircleEllipsis },
};

/** Inline style that hands a category color to CSS as `--c` (used by .p12-dot, .p12-cat-tile…). */
export function catVar(category: ExpenseCategory): CSSProperties {
  return { '--c': CATEGORY_META[category].color } as CSSProperties;
}

/** A small colored dot. `remaining` draws the hollow "Left to spend" dot instead. */
export function CategoryDot({ category, remaining }: { category?: ExpenseCategory; remaining?: boolean }) {
  if (remaining) return <span className="p12-dot is-remaining" aria-hidden />;
  return <span className="p12-dot" style={category ? catVar(category) : undefined} aria-hidden />;
}

/** "● Food & drink" — the category chip used in tables and lists. */
export function CategoryChip({ category }: { category: ExpenseCategory }) {
  return (
    <span className="p12-cat-chip">
      <CategoryDot category={category} />
      {CATEGORY_META[category].label}
    </span>
  );
}

/** Rounded icon tile tinted with the category color (mobile list rows). */
export function CategoryTile({ category, size = 40 }: { category: ExpenseCategory; size?: number }) {
  const { Icon } = CATEGORY_META[category];
  return (
    <span className="p12-cat-tile" style={{ ...catVar(category), width: size, height: size }} aria-hidden>
      <Icon />
    </span>
  );
}

/**
 * Where an expense came from. The two simulated integrations always say
 * "demo" so testers never think a real inbox or bank was read.
 */
export function SourceBadge({ source }: { source: ExpenseSource }) {
  switch (source) {
    case 'receipt':
      return (
        <Badge tone="info" icon={<ReceiptText aria-hidden />}>
          Receipt
        </Badge>
      );
    case 'gmail-demo':
      return <DemoBadge title="Simulated Gmail match. No real inbox was read.">Gmail · demo</DemoBadge>;
    case 'bank-demo':
      return <DemoBadge title="Simulated bank alert. No real bank account was accessed.">Bank alert · demo</DemoBadge>;
    case 'manual':
    default:
      return (
        <Badge tone="neutral" icon={<PenLine aria-hidden />}>
          Manual
        </Badge>
      );
  }
}

/** Plain-language description of a source (detail sheet). */
export const SOURCE_DESCRIPTION: Record<ExpenseSource, string> = {
  manual: 'Typed in by hand.',
  receipt: 'Added from a scanned receipt.',
  'gmail-demo': 'Matched from a simulated Gmail receipt (demo data). No real inbox was read.',
  'bank-demo': 'Logged from a simulated bank alert (demo data). No real bank account was accessed.',
};
