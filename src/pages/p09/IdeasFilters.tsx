/**
 * Day filters for the Ideas page (Page 9) and the selected day's free time.
 *  - Desktop: a left rail with a day list (+ counts) and a "Free time" panel.
 *  - Phones/tablets: a sticky row of day chips and a one-line free-time strip.
 */

import { useEffect, useRef } from 'react';
import { ChevronRight, Clock } from 'lucide-react';
import type { ISODate, Time, Trip } from '../../data/types';
import { Badge } from '../../components/ui/Display';
import { dayHeading, dayNumber, formatDuration, timeToMin, weekdayShort } from '../../lib/dates';
import { Link } from '../../router/router';
import { paths } from '../../router/routes';
import { formatRange } from './ideas';

export interface DayOption {
  date: ISODate;
  /** Open (undecided) ideas on this day. */
  count: number;
  isToday: boolean;
}

export interface Gap {
  start: Time;
  end: Time;
  minutes: number;
}

interface FilterProps {
  trip: Trip;
  options: DayOption[];
  totalCount: number;
  /** 'all' or an ISO date. */
  value: string;
  onChange: (value: string) => void;
}

/* ------------------------------------------------------------- desktop */

export function DayFilterRail({ trip, options, totalCount, value, onChange }: FilterProps) {
  return (
    <nav className="p09-rail-card" aria-labelledby="p09-day-filter-title">
      <h2 className="p09-rail-title" id="p09-day-filter-title">
        Day
      </h2>
      <ul className="p09-filter-list">
        <li>
          <button type="button" className={`p09-filter-item ${value === 'all' ? 'is-active' : ''}`} aria-pressed={value === 'all'} onClick={() => onChange('all')}>
            <span className="p09-filter-label">All days</span>
            <span className="p09-count num">{totalCount}</span>
          </button>
        </li>
        {options.map((o) => (
          <li key={o.date}>
            <button
              type="button"
              className={`p09-filter-item ${value === o.date ? 'is-active' : ''}`}
              aria-pressed={value === o.date}
              aria-label={`${dayHeading(trip, o.date)}, ${o.count} open ${o.count === 1 ? 'idea' : 'ideas'}${o.isToday ? ', today' : ''}`}
              onClick={() => onChange(o.date)}
            >
              <span className="p09-filter-label num">{dayHeading(trip, o.date)}</span>
              {o.isToday && <Badge tone="accent">Today</Badge>}
              <span className={`p09-count num ${o.count ? '' : 'is-zero'}`}>{o.count}</span>
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** Free time for the selected day (8 AM–10 PM gaps of 45+ minutes). */
export function FreeTimePanel({
  trip,
  date,
  gaps,
  nowMin,
  mostOpen,
}: {
  trip: Trip;
  /** null = "All days" is selected. */
  date: ISODate | null;
  gaps: Gap[];
  /** Minutes after midnight when the selected day is today (during the trip). */
  nowMin?: number;
  /** The day with the most free time (shown when no day is picked). */
  mostOpen?: { date: ISODate; minutes: number };
}) {
  if (!date) {
    return (
      <section className="p09-rail-card" aria-labelledby="p09-free-title">
        <h2 className="p09-rail-title" id="p09-free-title">
          Free time
        </h2>
        <p className="p09-rail-text">Pick a day to see when you’re free.</p>
        {mostOpen && (
          <p className="p09-rail-text">
            <strong>Day {dayNumber(trip, mostOpen.date)}</strong> is the most open, with {formatDuration(mostOpen.minutes)} free.
          </p>
        )}
      </section>
    );
  }
  const n = dayNumber(trip, date);
  return (
    <section className="p09-rail-card" aria-labelledby="p09-free-title">
      <h2 className="p09-rail-title" id="p09-free-title">
        Free time on Day {n}
      </h2>
      {gaps.length === 0 ? (
        <p className="p09-rail-text">Day {n} is fully booked between 8 AM and 10 PM.</p>
      ) : (
        <ul className="p09-gaps">
          {gaps.map((g) => {
            const past = nowMin !== undefined && timeToMin(g.end) <= nowMin;
            const current = nowMin !== undefined && timeToMin(g.start) <= nowMin && nowMin < timeToMin(g.end);
            return (
              <li key={g.start} className={`p09-gap ${past ? 'is-past' : ''} ${current ? 'is-now' : ''}`}>
                <span className="num">{formatRange(g.start, g.end)}</span>
                <span className="p09-gap-len">{current ? 'Now' : past ? 'Earlier' : formatDuration(g.minutes)}</span>
              </li>
            );
          })}
        </ul>
      )}
      <Link to={paths.day(trip.id, date)} className="p09-rail-link">
        Open Day {n}
        <ChevronRight aria-hidden />
      </Link>
    </section>
  );
}

/* -------------------------------------------------------------- phones */

export function DayFilterChips({ trip, options, totalCount, value, onChange }: FilterProps) {
  const trackRef = useRef<HTMLDivElement>(null);

  // Keep the selected chip in view (e.g. Day 6 preselected from the itinerary).
  useEffect(() => {
    const track = trackRef.current;
    const chip = track?.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (!track || !chip) return;
    const left = chip.offsetLeft - (track.clientWidth - chip.offsetWidth) / 2;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    track.scrollTo({ left: Math.max(0, left), behavior: reduce ? 'auto' : 'smooth' });
  }, [value]);

  return (
    <div className="p09-chips" role="group" aria-label="Filter ideas by day">
      <div className="p09-chips-track" ref={trackRef}>
        <button type="button" className={`p09-chip ${value === 'all' ? 'is-active' : ''}`} aria-pressed={value === 'all'} onClick={() => onChange('all')}>
          All
          <span className="p09-chip-count num">{totalCount}</span>
        </button>
        {options.map((o) => (
          <button
            key={o.date}
            type="button"
            className={`p09-chip ${value === o.date ? 'is-active' : ''} ${o.isToday ? 'is-today' : ''}`}
            aria-pressed={value === o.date}
            aria-label={`Day ${dayNumber(trip, o.date)}, ${weekdayShort(o.date)}, ${o.count} open ${o.count === 1 ? 'idea' : 'ideas'}${o.isToday ? ', today' : ''}`}
            onClick={() => onChange(o.date)}
          >
            Day {dayNumber(trip, o.date)}
            <span className={`p09-chip-count num ${o.count ? '' : 'is-zero'}`}>{o.count}</span>
            {o.isToday && <span className="p09-chip-today" aria-hidden />}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Phones: "Free on Day 2" + the gaps as small pills. */
export function FreeTimeStrip({ trip, date, gaps, nowMin }: { trip: Trip; date: ISODate; gaps: Gap[]; nowMin?: number }) {
  const n = dayNumber(trip, date);
  return (
    <div className="p09-free-strip">
      <p className="p09-free-strip-label">
        <Clock aria-hidden />
        {gaps.length ? `Free on Day ${n}` : `Day ${n} is fully booked`}
      </p>
      {gaps.length > 0 && (
        <ul className="p09-free-strip-list">
          {gaps.map((g) => {
            const past = nowMin !== undefined && timeToMin(g.end) <= nowMin;
            const current = nowMin !== undefined && timeToMin(g.start) <= nowMin && nowMin < timeToMin(g.end);
            return (
              <li key={g.start} className={`p09-free-pill num ${past ? 'is-past' : ''} ${current ? 'is-now' : ''}`}>
                {formatRange(g.start, g.end)}
                {current && <span className="sr-only"> (now)</span>}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
