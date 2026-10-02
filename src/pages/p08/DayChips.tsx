/**
 * Phones/tablets: a sticky row of day chips under the header. Tapping a chip
 * glides the page to that day; while you scroll, the chip for the day on
 * screen lights up and slides into view.
 */

import { useEffect, useRef, type RefObject } from 'react';
import type { ISODate, Trip } from '../../data/types';
import { formatMMDD, formatShortDate } from '../../lib/dates';
import { plural } from '../../lib/format';
import type { DayGroup } from '../../store/selectors';
import { prefersReducedMotion } from './hooks';

export function DayChips({
  trip,
  days,
  active,
  todayIso,
  onPick,
  barRef,
}: {
  trip: Trip;
  days: DayGroup[];
  active?: ISODate;
  todayIso: ISODate;
  onPick: (date: ISODate) => void;
  /** Lets the scroll logic measure this bar's height. */
  barRef: RefObject<HTMLElement | null>;
}) {
  const trackRef = useRef<HTMLDivElement>(null);

  // Keep the active chip centered in the horizontally scrolling track.
  useEffect(() => {
    const track = trackRef.current;
    const chip = track?.querySelector<HTMLElement>(`[data-date="${active}"]`);
    if (!track || !chip) return;
    const left = chip.offsetLeft - (track.clientWidth - chip.offsetWidth) / 2;
    track.scrollTo({ left: Math.max(0, left), behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
  }, [active]);

  return (
    <nav className="p08-chips" aria-label={`Jump to a day of ${trip.title}`} ref={barRef}>
      <div className="p08-chips-track" ref={trackRef}>
        {days.map((d) => {
          const isActive = d.date === active;
          const isToday = d.date === todayIso;
          const summary = d.events.length ? plural(d.events.length, 'event') : 'nothing planned';
          return (
            <button
              key={d.date}
              type="button"
              data-date={d.date}
              className={`p08-chip ${isActive ? 'is-active' : ''} ${d.events.length ? '' : 'is-empty'} ${isToday ? 'is-today' : ''}`}
              aria-current={isActive ? 'true' : undefined}
              aria-label={`Day ${d.dayNumber}, ${formatShortDate(d.date)}, ${summary}${isToday ? ', today' : ''}`}
              onClick={() => onPick(d.date)}
            >
              <span className="p08-chip-day">Day {d.dayNumber}</span>
              <span className="p08-chip-date num">{formatMMDD(d.date)}</span>
              {isToday && <span className="p08-chip-today" aria-hidden />}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
