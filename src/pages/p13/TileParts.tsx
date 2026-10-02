/**
 * Building blocks for Page 13's preference tiles: the tile frame, "who"
 * labels (avatars + names), count dots, and the 5-step scale.
 *
 * Tiles need to turn person ids into names ("You" for the acting person) and
 * know whose answers to highlight after a survey save, so that lookup is
 * shared through a small React context instead of being passed to every tile.
 */

import { createContext, Fragment, useContext, useId, useState, type ReactNode } from 'react';
import { ChevronDown, Quote } from 'lucide-react';
import type { Person } from '../../data/types';
import { Avatar } from '../../components/ui/Display';
import { useIsMobile } from '../../hooks/useBreakpoint';
import { listJoin } from '../../lib/format';
import type { Scale5, ScaleDef } from '../p15/vocab';

/* ---------------------------------------------------------------- context */

export interface PeopleLookup {
  person: (id: string) => Person | undefined;
  /** "You" for the acting person, otherwise their first name. */
  name: (id: string) => string;
  /** Whose answers to highlight (the person who just saved the survey, 15G). */
  highlightId: string | null;
  /** How many people shared preferences (the "of 5" in "3 of 5"). */
  total: number;
}

const PeopleContext = createContext<PeopleLookup | null>(null);

export const PeopleProvider = PeopleContext.Provider;

/** Read the name/highlight lookup from inside any tile. */
export function usePeople(): PeopleLookup {
  const value = useContext(PeopleContext);
  if (!value) throw new Error('usePeople() must be used inside <PeopleProvider>');
  return value;
}

/** Note for group comparisons when only one person has answered. */
export const ONE_ANSWER = 'Only one answer so far.';

/** Subject-verb agreement for name lists: "Linda prefers" vs. "You prefer" / "Priya and Linda prefer". */
export function agree(names: string[], singular: string, pluralForm: string): string {
  return names.length === 1 && names[0].toLowerCase() !== 'you' ? singular : pluralForm;
}

/**
 * Join names for a sentence: "Linda and you". "You" stays capitalized only
 * when it opens the sentence (`start: true`), e.g. "You and Sam prefer…".
 */
export function joinNames(names: string[], { start = false }: { start?: boolean } = {}): string {
  return listJoin(names.map((n, i) => (n === 'You' && !(start && i === 0) ? 'you' : n)));
}

/* ------------------------------------------------------------------ Tile */

/**
 * One preference tile: an icon, a small title, a big one-line takeaway
 * ("Mostly local"), a short note, and the details below.
 */
export function Tile({
  icon,
  title,
  summary,
  note,
  wide,
  tone,
  className = '',
  children,
}: {
  icon: ReactNode;
  title: string;
  summary?: ReactNode;
  note?: ReactNode;
  /** Span both columns of the tile grid on wide screens. */
  wide?: boolean;
  /** 'alert' tints the icon red (e.g. severe allergies present). */
  tone?: 'default' | 'alert';
  className?: string;
  children?: ReactNode;
}) {
  const id = useId();
  return (
    <article className={`p13-tile ${wide ? 'is-wide' : ''} ${className}`} aria-labelledby={id}>
      <header className="p13-tile-head">
        <span className={`p13-tile-icon ${tone === 'alert' ? 'is-alert' : ''}`} aria-hidden>
          {icon}
        </span>
        <div className="p13-tile-heading">
          <h3 id={id} className="p13-tile-title">
            {title}
          </h3>
          {summary && <p className="p13-tile-summary">{summary}</p>}
          {note && <p className="p13-tile-note">{note}</p>}
        </div>
      </header>
      {children && <div className="p13-tile-body">{children}</div>}
    </article>
  );
}

/** Small uppercase label for a group of rows inside a tile. */
export function TileLabel({ children }: { children: ReactNode }) {
  return <h4 className="p13-tile-label">{children}</h4>;
}

/** Muted one-liner for a tile with nothing to show. */
export function TileEmpty({ children }: { children: ReactNode }) {
  return <p className="p13-tile-empty">{children}</p>;
}

/* --------------------------------------------------------------- people */

/** Avatars + names ("You, Sam"). The highlighted person's name is marked. */
export function PeopleInline({ ids, size = 22, max = 3 }: { ids: string[]; size?: number; max?: number }) {
  const { person, name, highlightId } = usePeople();
  const people = ids.map(person).filter((p): p is Person => !!p);
  if (people.length === 0) return <span className="p13-nobody">Nobody yet</span>;
  return (
    <span className={`p13-people ${highlightId && ids.includes(highlightId) ? 'has-hl' : ''}`}>
      <span className="p13-people-avatars" aria-hidden>
        {people.slice(0, max).map((p) => (
          <span key={p.id} className={p.id === highlightId ? 'is-hl' : undefined}>
            <Avatar person={p} size={size} ring />
          </span>
        ))}
      </span>
      <span className="p13-people-names">
        {people.map((p, i) => (
          <Fragment key={p.id}>
            {i > 0 && ', '}
            <span className={p.id === highlightId ? 'p13-hl' : undefined}>{name(p.id)}</span>
          </Fragment>
        ))}
      </span>
    </span>
  );
}

/** "3 of 5" as dots (falls back to a bar for big groups). Decorative: pair with text. */
export function CountMeter({ count, total }: { count: number; total: number }) {
  if (total > 8) {
    return (
      <span className="p13-meter-bar" aria-hidden>
        <span style={{ width: `${total ? (count / total) * 100 : 0}%` }} />
      </span>
    );
  }
  return (
    <span className="p13-meter" aria-hidden>
      {Array.from({ length: total }, (_, i) => (
        <i key={i} className={i < count ? 'is-on' : ''} />
      ))}
    </span>
  );
}

/* ------------------------------------------------------------ ScaleTrack */

/**
 * A 5-step scale with each person placed at their answer, e.g.
 *   Local delights ●───●───●───●───● Taste of home
 * The group's middle answer gets a filled dot labeled "Group".
 */
export function ScaleTrack({ scale, buckets, median }: { scale: ScaleDef; buckets: Record<Scale5, string[]>; median: Scale5 | null }) {
  const { person, name, highlightId } = usePeople();
  return (
    <div className="p13-scale">
      <div className="p13-scale-ends" aria-hidden>
        <span>{scale.leftLabel}</span>
        <span>{scale.rightLabel}</span>
      </div>
      <ol className="p13-scale-steps" aria-label={`${scale.leftLabel} to ${scale.rightLabel}`}>
        {scale.order.map((v) => {
          const ids = buckets[v];
          const isMedian = v === median;
          return (
            <li key={v} className={`p13-scale-step ${isMedian ? 'is-median' : ''}`}>
              <span className="p13-scale-dot" aria-hidden />
              {/* Every step keeps this line (empty except the middle one) so the avatars line up. */}
              <span className="p13-scale-group" aria-hidden>
                {isMedian ? 'Group' : ''}
              </span>
              <span className="sr-only">
                {scale.labels[v]}: {ids.length ? ids.map(name).join(', ') : 'nobody'}
                {isMedian ? ' (the group’s middle answer)' : ''}
              </span>
              <span className="p13-scale-people" aria-hidden>
                {ids.map((id) => {
                  const p = person(id);
                  if (!p) return null;
                  return (
                    <span key={id} className={`p13-scale-person ${id === highlightId ? 'is-hl' : ''}`}>
                      <Avatar person={p} size={26} />
                      <span className="p13-scale-name">{name(id)}</span>
                    </span>
                  );
                })}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/* ----------------------------------------------------------------- quote */

/** A note someone wrote in their survey, with who wrote it. */
export function QuoteCard({ personId, text }: { personId: string; text: string }) {
  const { highlightId } = usePeople();
  return (
    <figure className={`p13-quote ${personId === highlightId ? 'is-hl' : ''}`}>
      <Quote className="p13-quote-icon" aria-hidden />
      <blockquote>{text}</blockquote>
      <figcaption>
        <PeopleInline ids={[personId]} size={20} />
      </figcaption>
    </figure>
  );
}

/* ------------------------------------------------------------- show more */

/**
 * On phones, long lists show the first few items plus a "Show N more" button
 * (desktop shows everything). Returns the items to render and the button.
 */
export function useShowMore<T>(items: T[], limit: number, noun: string): { visible: T[]; toggle: ReactNode } {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  // Hiding just one item isn't worth a button.
  if (!isMobile || items.length <= limit + 1) return { visible: items, toggle: null };
  return {
    visible: open ? items : items.slice(0, limit),
    toggle: (
      <button type="button" className="p13-more" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        {open ? 'Show fewer' : `Show ${items.length - limit} more ${noun}`}
        <ChevronDown aria-hidden className={open ? 'is-flipped' : ''} />
      </button>
    ),
  };
}
