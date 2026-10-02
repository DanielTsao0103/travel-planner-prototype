/**
 * "How busy is it usually?" (Page 7, state 7B).
 *
 * Hourly bars from 6 AM to 11 PM for this kind of place on this day of the
 * week, with the chosen start hour in the accent color and the rest of the
 * event's time in a lighter tint. Real crowd data isn't available from an
 * official API, so the numbers are illustrative and the card always says
 * "Estimate".
 */

import { useId } from 'react';
import { Clock3, UsersRound } from 'lucide-react';
import type { BusyProfile, ISODate, Place, Time } from '../../data/types';
import { estimateBusy } from '../../lib/busy';
import { formatHour, formatTime, timeToMin, weekdayLong } from '../../lib/dates';
import { listJoin } from '../../lib/format';
import { Button } from '../../components/ui/Button';
import { DemoBadge } from '../../components/ui/Display';

const FIRST_HOUR = 6;
const LAST_HOUR = 23;
/** 6, 7, … 23 — one bar per hour. */
const HOURS = Array.from({ length: LAST_HOUR - FIRST_HOUR + 1 }, (_, i) => FIRST_HOUR + i);
/** A gentle made-up curve for the empty state's faded bars. */
const GHOST = [6, 12, 24, 40, 55, 62, 70, 72, 66, 58, 52, 50, 46, 40, 30, 22, 14, 8];

const PROFILE_NOUN: Record<BusyProfile, string> = {
  landmark: 'landmark',
  museum: 'museum',
  market: 'market',
  restaurant: 'restaurant',
  cafe: 'café',
  viewpoint: 'viewpoint',
  transit: 'station',
  bar: 'bar',
  nature: 'park or trail',
  lodging: 'hotel or rental',
};

const ESTIMATE_NOTE = 'Illustrative estimate based on the kind of place and the day of the week. Not live data.';

/**
 * The calmer hour behind busy.ts's tip (same rule: the quietest open hour
 * within ±3 hours, if it's at least 20 points calmer), so we can offer a
 * one-tap "Move to 10:00 AM".
 */
function calmerHour(curve: number[], hour: number): number | null {
  const level = curve[hour] ?? 0;
  if (level < 60) return null;
  let best = hour;
  for (let h = Math.max(0, hour - 3); h <= Math.min(23, hour + 3); h++) {
    if (curve[h] > 8 && curve[h] < curve[best]) best = h;
  }
  return best !== hour && curve[best] <= level - 20 ? best : null;
}

export interface BusyChartProps {
  place: Place;
  date: ISODate;
  start: Time;
  end?: Time | '';
  /** Called with a calmer start time when the person taps "Move to …". */
  onTryTime?: (time: Time) => void;
}

/** The crowd card: label, hourly bars, a tip, and an optional "Move to …" button. */
export function BusyChart({ place, date, start, end, onTryTime }: BusyChartProps) {
  const headingId = useId();
  const est = estimateBusy(place.busyProfile, date, start);
  const startHour = est.hour;
  const endMin = end ? timeToMin(end) : timeToMin(start) + 60;
  // Last hour the event touches (11:00–12:00 covers only the 11 o'clock bar).
  const lastHour = Math.max(startHour, Math.ceil(endMin / 60) - 1);
  const tone = est.level >= 60 ? 'busy' : est.level >= 35 ? 'some' : 'calm';
  const calmer = calmerHour(est.curve, startHour);
  const minutes = String(timeToMin(start) % 60).padStart(2, '0');
  const tryTime: Time | null = calmer !== null ? `${String(calmer).padStart(2, '0')}:${minutes}` : null;
  const tip = est.level < 8 ? 'Quiet then, or not open yet. Check opening hours before you go.' : est.tip;
  // "at 2 PM" on the hour, "at 9:30 AM" otherwise (the estimate itself is hourly).
  const at = timeToMin(start) % 60 === 0 ? formatHour(start) : formatTime(start);
  const summary = `${est.label} at ${at}`;

  return (
    <section className={`p07-busy is-${tone}`} aria-labelledby={headingId}>
      <div className="p07-busy-head">
        <p className="p07-busy-eyebrow">
          <UsersRound aria-hidden /> How busy it usually is
        </p>
        <DemoBadge title={ESTIMATE_NOTE}>Estimate</DemoBadge>
      </div>

      <p id={headingId} className="p07-busy-label">
        {summary}
      </p>
      <p className="p07-busy-sub">
        Typical {weekdayLong(date)} for a {PROFILE_NOUN[place.busyProfile]}
      </p>

      <div className="p07-busy-chart" role="img" aria-label={`Estimated crowds by hour on a typical ${weekdayLong(date)}, 6 AM to 11 PM. ${summary}.${tip ? ` ${tip}` : ''}`}>
        <div className="p07-busy-bars">
          {HOURS.map((h) => {
            const value = est.curve[h] ?? 0;
            const cls = h === startHour ? 'is-start' : h > startHour && h <= lastHour ? 'is-event' : '';
            return <span key={h} className={`p07-busy-bar ${cls}`} style={{ height: `${Math.max(4, value)}%` }} />;
          })}
        </div>
        <div className="p07-busy-axis" aria-hidden>
          <span style={{ gridColumn: 1 }}>6a</span>
          <span style={{ gridColumn: 7 }}>12p</span>
          <span style={{ gridColumn: 13 }}>6p</span>
          <span style={{ gridColumn: 18 }}>11p</span>
        </div>
      </div>

      {tip && (
        <p className="p07-busy-tip">
          <Clock3 aria-hidden />
          <span>{tip}</span>
        </p>
      )}
      {tryTime && onTryTime && (
        <Button size="sm" variant="secondary" onClick={() => onTryTime(tryTime)} className="p07-busy-try">
          Move to {formatTime(tryTime)}
        </Button>
      )}
    </section>
  );
}

/**
 * Before a place, day, and start time are set: what's missing, plus faded
 * bars (left out when `compact`, e.g. inline on phones, to save space).
 */
export function BusyPlaceholder({ missing, compact }: { missing: string[]; compact?: boolean }) {
  return (
    <section className={`p07-busy is-empty ${compact ? 'is-compact' : ''}`} aria-label="How busy it usually is">
      <div className="p07-busy-head">
        <p className="p07-busy-eyebrow">
          <UsersRound aria-hidden /> How busy it usually is
        </p>
        <DemoBadge title={ESTIMATE_NOTE}>Estimate</DemoBadge>
      </div>
      <p className="p07-busy-label is-muted">Pick {listJoin(missing)} to see how crowded it usually gets.</p>
      {!compact && (
        <div className="p07-busy-chart" aria-hidden>
          <div className="p07-busy-bars is-ghost">
            {GHOST.map((v, i) => (
              <span key={i} className="p07-busy-bar" style={{ height: `${v}%` }} />
            ))}
          </div>
          <div className="p07-busy-axis">
            <span style={{ gridColumn: 1 }}>6a</span>
            <span style={{ gridColumn: 7 }}>12p</span>
            <span style={{ gridColumn: 13 }}>6p</span>
            <span style={{ gridColumn: 18 }}>11p</span>
          </div>
        </div>
      )}
    </section>
  );
}
