/**
 * A strip of trip days as pills: weekday, date, and one dot per event (up to
 * four). Tapping a pill opens that day (Page 11).
 *
 * - `compact` (phones): the dashboard's 7-day strip and the day page's switcher.
 *   Seven pills fit a 390px screen exactly; longer trips scroll sideways.
 * - `wide` (desktop): the day page's switcher, with "Day N" on each pill.
 *
 * Today always gets a marigold ring; the day being viewed is filled teal.
 */

import { useEffect, useRef } from 'react';
import type { ISODate, Trip } from '../../data/types';
import { dayNumber, formatMMDD, formatShortDate, parseISODate, weekdayShort } from '../../lib/dates';
import { plural } from '../../lib/format';
import { Link } from '../../router/router';
import './p10.css';

export interface DayPillsProps {
  trip: Trip;
  days: ISODate[];
  /** Number of events on each day. */
  counts: Record<ISODate, number>;
  /** Demo-clock date. */
  today: ISODate;
  /** The day being viewed (Page 11). */
  selected?: ISODate;
  hrefFor: (date: ISODate) => string;
  /** Accessible name for the strip, e.g. "Trip days". */
  label: string;
  variant?: 'compact' | 'wide';
}

export function DayPills({ trip, days, counts, today, selected, hrefFor, label, variant = 'compact' }: DayPillsProps) {
  const scrollerRef = useRef<HTMLUListElement>(null);
  const focusDay = selected ?? (days.includes(today) ? today : undefined);

  // Long trips scroll sideways: bring the viewed day (or today) into the middle.
  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller || !focusDay) return;
    const pill = scroller.querySelector<HTMLElement>(`[data-day="${focusDay}"]`);
    if (!pill || scroller.scrollWidth <= scroller.clientWidth) return;
    scroller.scrollLeft = pill.offsetLeft - (scroller.clientWidth - pill.clientWidth) / 2;
  }, [focusDay, days.length]);

  return (
    <nav className={`p10-pills is-${variant} ${days.length > 7 ? 'is-scrolling' : ''}`} aria-label={label}>
      <ul ref={scrollerRef} className="p10-pills-list" style={{ ['--p10-pill-count' as string]: Math.min(days.length, 7) }}>
        {days.map((d) => {
          const n = dayNumber(trip, d);
          const count = counts[d] ?? 0;
          const isToday = d === today;
          const isSelected = d === selected;
          const name = `Day ${n}, ${formatShortDate(d)}${isToday ? ', today' : ''}, ${count ? plural(count, 'event') : 'nothing planned'}`;
          return (
            <li key={d} data-day={d}>
              <Link
                to={hrefFor(d)}
                className={`p10-pill ${isToday ? 'is-today' : ''} ${isSelected ? 'is-selected' : ''} ${d < today ? 'is-past' : ''}`}
                aria-label={name}
                aria-current={isSelected ? 'date' : undefined}
              >
                {variant === 'wide' ? (
                  <>
                    <span className="p10-pill-day">Day {n}</span>
                    <span className="p10-pill-date num">
                      {weekdayShort(d)} {formatMMDD(d)}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="p10-pill-dow">{weekdayShort(d)}</span>
                    <span className="p10-pill-num num">{parseISODate(d).getDate()}</span>
                  </>
                )}
                <span className="p10-pill-dots" aria-hidden>
                  {Array.from({ length: Math.min(count, 4) }, (_, i) => (
                    <span key={i} className="p10-pill-dot" />
                  ))}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
