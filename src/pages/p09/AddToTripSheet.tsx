/**
 * 9B / 9C — "Add MAAT to your trip".
 *
 * Pick a day (only days you can edit) and a start/end time, prefilled with the
 * suggested slot. A mini timeline of that day shows where the idea would land.
 * If it overlaps something (9C) we name the event and its time before anything
 * is added, and offer "Pick another time" (jumps to the nearest free time) or
 * "Add anyway". Nothing overlaps silently.
 *
 * Desktop: a side panel. Phones: a bottom sheet (the Sheet component adapts).
 */

import { useId, useRef, useState } from 'react';
import { CheckCircle2, Clock } from 'lucide-react';
import type { AppState, ISODate, Suggestion, Time, Trip, TripEvent } from '../../data/types';
import { eventLabel } from '../../components/domain/EventItem';
import { PlacePhoto } from '../../components/domain/PlacePhoto';
import { Button } from '../../components/ui/Button';
import { Banner } from '../../components/ui/Display';
import { Field, Select, TextInput } from '../../components/ui/Field';
import { Sheet } from '../../components/ui/Overlay';
import type { TripAccess } from '../../lib/permissions';
import { dayNumber, formatDuration, formatHour, formatMMDD, formatTime, minToTime, timeToMin, weekdayShort } from '../../lib/dates';
import { listJoin } from '../../lib/format';
import { navigate } from '../../router/router';
import { paths } from '../../router/routes';
import { addSuggestionToTrip } from '../../store/actions';
import { conflictsFor, eventsOn, freeGaps } from '../../store/selectors';
import { toast } from '../../store/toast';
import { categoryLine, costLabel, formatRange, roundUp5, slotLabel } from './ideas';

export interface AddToTripSheetProps {
  suggestion: Suggestion;
  state: AppState;
  trip: Trip;
  access: TripAccess;
  todayIso: ISODate;
  nowTime: Time;
  isActive: boolean;
  onClose: () => void;
  /** Called after the event is created (the card then shows "Added to Day N"). */
  onAdded: (s: Suggestion, date: ISODate, start: Time, end: Time) => void;
}

/**
 * The free slot of the same length closest to the time you picked, or null.
 * During the trip, today's slots can't start in the past.
 */
function nearestFreeSlot(state: AppState, tripId: string, date: ISODate, start: Time, minutes: number, notBefore: number): [Time, Time] | null {
  let best: { start: number; diff: number } | null = null;
  for (const gap of freeGaps(state, tripId, date, minutes)) {
    const gapStart = roundUp5(Math.max(timeToMin(gap.start), notBefore));
    const latest = timeToMin(gap.end) - minutes;
    if (gapStart > latest) continue;
    // Inside this gap, the start closest to what you asked for.
    const s = Math.min(Math.max(timeToMin(start), gapStart), latest - (latest % 5));
    const diff = Math.abs(s - timeToMin(start));
    if (!best || diff < best.diff) best = { start: s, diff };
  }
  return best ? [minToTime(best.start), minToTime(best.start + minutes)] : null;
}

export function AddToTripSheet({ suggestion: s, state, trip, access, todayIso, nowTime, isActive, onClose, onAdded }: AddToTripSheetProps) {
  const days = access.editableDays;
  const [date, setDate] = useState<ISODate>(access.canEditDay(s.date) ? s.date : (days[0] ?? s.date));
  const [start, setStart] = useState<Time>(s.start);
  const [end, setEnd] = useState<Time>(s.end);
  const [note, setNote] = useState<string | null>(null);
  // The Day <select> gets its id from <Field>; we keep it to move focus there when a day is full.
  const daySelectId = useRef<string>('');
  const statusId = useId();

  const hasTimes = !!start && !!end;
  const valid = hasTimes && timeToMin(end) > timeToMin(start);
  const minutes = valid ? timeToMin(end) - timeToMin(start) : 0;
  const conflicts = valid ? conflictsFor(state, trip.id, date, start, end) : [];
  const n = dayNumber(trip, date);
  const isPastTime = isActive && (date < todayIso || (date === todayIso && valid && timeToMin(start) < timeToMin(nowTime)));

  const timeError = !hasTimes ? 'Enter a start and an end time.' : !valid ? 'End time must be after the start time.' : null;

  const dayHint =
    access.role === 'day' && !access.canEditDay(s.date)
      ? `Suggested for Day ${dayNumber(trip, s.date)}, but you can add to ${listJoin(days.map((d) => `Day ${dayNumber(trip, d)}`))} only.`
      : date !== s.date
        ? `Suggested for Day ${dayNumber(trip, s.date)}.`
        : undefined;

  /** "Pick another time": move to the nearest free stretch of the same length on this day. */
  const pickAnother = () => {
    const notBefore = isActive && date === todayIso ? timeToMin(nowTime) : 0;
    const slot = nearestFreeSlot(state, trip.id, date, start, minutes || 60, notBefore);
    if (!slot) {
      setNote(`Day ${n} has no free ${formatDuration(minutes || 60)} stretch left. Try another day.`);
      document.getElementById(daySelectId.current)?.focus();
      return;
    }
    setStart(slot[0]);
    setEnd(slot[1]);
    setNote(`Moved to ${formatRange(slot[0], slot[1])}, the closest free time on Day ${n}.`);
  };

  const confirm = () => {
    if (!valid) return;
    addSuggestionToTrip(s, date, start, end);
    toast({
      title: `Added to Day ${n}`,
      body: `${s.place.name} · ${formatRange(start, end)}`,
      tone: 'success',
      action: { label: 'View day', onClick: () => navigate(paths.day(trip.id, date)) },
    });
    onAdded(s, date, start, end);
    onClose();
  };

  const footer =
    conflicts.length > 0 ? (
      <>
        <Button variant="secondary" onClick={pickAnother}>
          Pick another time
        </Button>
        <Button onClick={confirm}>Add anyway</Button>
      </>
    ) : (
      <>
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={confirm} disabled={!valid}>
          Add to Day {n}
        </Button>
      </>
    );

  const cost = costLabel(s.estCostPerPerson);

  return (
    <Sheet open onClose={onClose} title={`Add ${s.place.name} to your trip`} description="Pick a day and time. Everyone on the trip will see it on the itinerary." variant="side" size="md" footer={footer} className="p09-sheet">
      <div className="p09-sheet-body">
        <div className="p09-sheet-summary">
          <PlacePhoto photo={s.place.photo} alt="" category={s.place.category} className="p09-sheet-thumb" />
          <div className="stack-xs grow">
            <p className="p09-sheet-name">{s.place.name}</p>
            <p className="p09-sheet-cat">{categoryLine(s)}</p>
            <p className="p09-sheet-suggested num">
              <Clock aria-hidden />
              <span>Suggested: {slotLabel(trip, s)}</span>
            </p>
            {cost && <p className="p09-sheet-cat">{cost}</p>}
          </div>
        </div>

        <Field label="Day" hint={dayHint}>
          {(p) => {
            daySelectId.current = p.id;
            return (
            <Select
              {...p}
              value={date}
              onChange={(e) => {
                setDate(e.target.value);
                setNote(null);
              }}
              data-autofocus
            >
              {days.map((d) => (
                <option key={d} value={d}>
                  {`Day ${dayNumber(trip, d)} — ${formatMMDD(d)} · ${weekdayShort(d)}${d === todayIso && isActive ? ' (today)' : ''}`}
                </option>
              ))}
            </Select>
            );
          }}
        </Field>

        <div className="p09-times">
          <Field label="Start">
            {(p) => (
              <TextInput
                {...p}
                type="time"
                step={300}
                value={start}
                aria-invalid={timeError ? true : undefined}
                onChange={(e) => {
                  setStart(e.target.value);
                  setNote(null);
                }}
              />
            )}
          </Field>
          <Field label="End" error={timeError} hint={valid ? formatDuration(minutes) : undefined}>
            {(p) => (
              <TextInput
                {...p}
                type="time"
                step={300}
                value={end}
                onChange={(e) => {
                  setEnd(e.target.value);
                  setNote(null);
                }}
              />
            )}
          </Field>
        </div>

        {isPastTime && <p className="p09-past-note">That’s earlier than now ({formatTime(nowTime)}).</p>}

        {/* Live region: screen readers hear the overlap / "free" result as times change. */}
        <div id={statusId} aria-live="polite" className="p09-sheet-status">
          {valid && conflicts.length > 0 && (
            <Banner tone="warning" title={`Overlaps ${listJoin(conflicts.map((c) => `${eventLabel(c)} (${formatRange(c.start, c.end)})`))}`}>
              Both would be on Day {n} at the same time. Pick another time, or add it anyway.
            </Banner>
          )}
          {valid && conflicts.length === 0 && (
            <p className="p09-free">
              <CheckCircle2 aria-hidden />
              You’re free then.
            </p>
          )}
          {note && <p className="p09-sheet-note">{note}</p>}
        </div>

        <MiniTimeline
          dayLabel={`Day ${n}, ${weekdayShort(date)} ${formatMMDD(date)}`}
          events={eventsOn(state, trip.id, date)}
          conflictIds={new Set(conflicts.map((c) => c.id))}
          proposal={valid ? { start: timeToMin(start), end: timeToMin(end), name: s.place.name } : null}
          nowMin={isActive && date === todayIso ? timeToMin(nowTime) : undefined}
        />
      </div>
    </Sheet>
  );
}

/* --------------------------------------------------------- mini timeline */

/**
 * The chosen day around the proposed time (two hours either side, at least
 * five hours), with existing events as gray blocks and the idea as a dashed
 * teal block. Overlapping events turn amber.
 */
function MiniTimeline({
  dayLabel,
  events,
  conflictIds,
  proposal,
  nowMin,
}: {
  dayLabel: string;
  events: TripEvent[];
  conflictIds: Set<string>;
  proposal: { start: number; end: number; name: string } | null;
  nowMin?: number;
}) {
  // Visible window, on whole hours, kept between 6 AM and midnight.
  const center = proposal ?? { start: 9 * 60, end: 12 * 60 };
  let from = Math.floor((center.start - 120) / 60) * 60;
  let to = Math.ceil((center.end + 120) / 60) * 60;
  if (to - from < 300) to = from + 300;
  if (from < 6 * 60) {
    to += 6 * 60 - from;
    from = 6 * 60;
  }
  if (to > 24 * 60) {
    from = Math.max(6 * 60, from - (to - 24 * 60));
    to = 24 * 60;
  }
  const span = to - from;
  const pct = (min: number) => `${((Math.min(Math.max(min, from), to) - from) / span) * 100}%`;
  const heightPct = (a: number, b: number) => `${((Math.min(b, to) - Math.max(a, from)) / span) * 100}%`;

  const visible = events.filter((e) => timeToMin(e.end) > from && timeToMin(e.start) < to);
  const hours: number[] = [];
  for (let h = from; h <= to; h += 60) hours.push(h);
  const hasConflict = conflictIds.size > 0;

  const summary =
    `${dayLabel}, ${formatHour(from / 60)} to ${formatHour((to / 60) % 24)}. ` +
    (visible.length ? visible.map((e) => `${eventLabel(e)} ${formatRange(e.start, e.end)}`).join('; ') + '. ' : 'Nothing planned in this window. ') +
    (proposal ? `${proposal.name} would be ${formatRange(minToTime(proposal.start), minToTime(proposal.end))}.` : '');

  return (
    <figure className="p09-tl-wrap">
      <figcaption className="p09-tl-caption">
        <span className="eyebrow">{dayLabel}</span>
        <span className="p09-tl-legend" aria-hidden>
          <span className="p09-tl-key is-event" /> Planned
          <span className="p09-tl-key is-new" /> This idea
        </span>
      </figcaption>
      <div className="p09-tl" role="img" aria-label={summary}>
        {hours.map((h) => (
          <div key={h} className="p09-tl-hour" style={{ top: pct(h) }}>
            <span className="num">{formatHour((h / 60) % 24)}</span>
          </div>
        ))}
        {visible.map((e) => (
          <div
            key={e.id}
            className={`p09-tl-block is-event ${conflictIds.has(e.id) ? 'is-conflict' : ''}`}
            style={{ top: pct(timeToMin(e.start)), height: heightPct(timeToMin(e.start), timeToMin(e.end)) }}
          >
            <span className="p09-tl-name">{eventLabel(e)}</span>
            <span className="p09-tl-time num">{formatRange(e.start, e.end)}</span>
          </div>
        ))}
        {proposal && (
          <div
            className={`p09-tl-block is-new ${hasConflict ? 'is-beside' : ''}`}
            style={{ top: pct(proposal.start), height: heightPct(proposal.start, proposal.end) }}
          >
            <span className="p09-tl-name">{proposal.name}</span>
            <span className="p09-tl-time num">{formatRange(minToTime(proposal.start), minToTime(proposal.end))}</span>
          </div>
        )}
        {nowMin !== undefined && nowMin > from && nowMin < to && (
          <div className="p09-tl-now" style={{ top: pct(nowMin) }}>
            <span>Now</span>
          </div>
        )}
      </div>
    </figure>
  );
}
