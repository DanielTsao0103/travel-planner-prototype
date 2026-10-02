/**
 * The event form's fields (Page 7): Where · When (with the crowd estimate and
 * conflict warning) · Cost · Who's coming · Details.
 *
 * Used for typing details in (7A–7C), checking what a screenshot "found"
 * (7F), and editing an event (7H). In screenshot review, each field says where
 * its value came from: "From screenshot", or "Needs your input" (highlighted
 * until it's filled in).
 */

import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { Accessibility, AlertCircle, Check, PenLine, ScanLine, Ticket, TriangleAlert } from 'lucide-react';
import type { AppState, Place, Time, Trip, TripEvent } from '../../data/types';
import type { TripAccess } from '../../lib/permissions';
import { dayNumber, formatDuration } from '../../lib/dates';
import { firstName, listJoin, money, plural } from '../../lib/format';
import { findPickedPlaceImage } from '../../services/placeImages';
import { acceptedMemberIds, getPerson } from '../../store/selectors';
import { eventLabel } from '../../components/domain/EventItem';
import { PlacePhoto } from '../../components/domain/PlacePhoto';
import { Button } from '../../components/ui/Button';
import { Avatar, Banner, LockNote } from '../../components/ui/Display';
import { ChipToggle, Field, Segmented } from '../../components/ui/Field';
import { BusyChart, BusyPlaceholder } from './BusyChart';
import {
  addMinutes,
  dayOptionLabel,
  durationMin,
  formatTimeRange,
  isTime,
  parseCost,
  type DraftErrors,
  type DraftField,
  type EventDraft,
  type FieldSource,
  type FieldSources,
} from './draft';
import { PlaceSearch, placeAreaLine } from './PlaceSearch';

/* ------------------------------------------------------------ focusing */

/** Refs to each field, so a failed Save can move focus to the first problem. */
export interface FieldRefs {
  place: RefObject<HTMLInputElement | null>;
  date: RefObject<HTMLSelectElement | null>;
  start: RefObject<HTMLInputElement | null>;
  end: RefObject<HTMLInputElement | null>;
  cost: RefObject<HTMLInputElement | null>;
  attendees: RefObject<HTMLDivElement | null>;
}

/** Create the refs for every field (a custom hook, so it follows React's hook rules). */
export function useFieldRefs(): FieldRefs {
  return {
    place: useRef<HTMLInputElement>(null),
    date: useRef<HTMLSelectElement>(null),
    start: useRef<HTMLInputElement>(null),
    end: useRef<HTMLInputElement>(null),
    cost: useRef<HTMLInputElement>(null),
    attendees: useRef<HTMLDivElement>(null),
  };
}

/** Move keyboard focus to a field (the first person chip for "Who's coming") and scroll it into view. */
export function focusField(refs: FieldRefs, field: DraftField): void {
  const el = field === 'attendees' ? refs.attendees.current?.querySelector('button') : refs[field].current;
  el?.focus();
  el?.scrollIntoView({ block: 'center' });
}

/**
 * New start time → keep the event's length (or default to 1 hour).
 * During screenshot review the end time is a gap to fill, so we don't invent one.
 */
export function startPatch(draft: EventDraft, value: string, sources?: FieldSources): Partial<EventDraft> {
  if (!isTime(value)) return { start: value };
  if (sources?.end === 'needs' && !isTime(draft.end)) return { start: value };
  const keep = durationMin(draft.start, draft.end);
  return { start: value, end: addMinutes(value, keep > 0 ? keep : 60) };
}

/* -------------------------------------------------------- small pieces */

/** "From screenshot" / "Needs your input" / "Added by you" (7F). */
function SourceChip({ source, filled }: { source: FieldSource; filled: boolean }) {
  if (source === 'found') {
    return (
      <span className="p07-src is-found">
        <ScanLine aria-hidden /> From screenshot
      </span>
    );
  }
  return filled ? (
    <span className="p07-src is-added">
      <Check aria-hidden /> Added by you
    </span>
  ) : (
    <span className="p07-src is-needed">
      <PenLine aria-hidden /> Needs your input
    </span>
  );
}

/** Short facts that matter for planning: step-free access and tickets. */
function placeFacts(place: Place): Array<{ icon: ReactNode; label: string; tone: 'good' | 'warn' | 'accent' | 'plain' }> {
  if (place.source === 'custom') {
    return [{ icon: <PenLine aria-hidden />, label: place.blurb ?? 'Added by name, so there are no map details yet', tone: 'plain' }];
  }
  const facts: Array<{ icon: ReactNode; label: string; tone: 'good' | 'warn' | 'accent' | 'plain' }> = [];
  const stepFree = {
    yes: { label: 'Step-free access', tone: 'good' as const },
    partial: { label: 'Partly step-free', tone: 'plain' as const },
    no: { label: 'Not step-free', tone: 'warn' as const },
    unknown: { label: 'Step-free access not known', tone: 'plain' as const },
  }[place.stepFree];
  facts.push({ icon: <Accessibility aria-hidden />, ...stepFree });
  // Only our curated places know about tickets for sure.
  if (place.source === 'bundled') {
    facts.push(
      place.ticketRequired
        ? { icon: <Ticket aria-hidden />, label: 'Tickets required', tone: 'accent' }
        : { icon: <Ticket aria-hidden />, label: 'No tickets needed', tone: 'plain' },
    );
  }
  return facts;
}

/** The chosen place: photo, name, area, and facts, with a way to change it. */
export function SelectedPlace({ place, onChange }: { place: Place; onChange?: () => void }) {
  return (
    <div className="p07-place">
      <PlacePhoto photo={place.photo} place={place} alt={place.name} category={place.category} className="p07-place-photo" />
      <div className="p07-place-main">
        <p className="p07-place-name">{place.name}</p>
        {placeAreaLine(place) && <p className="p07-place-area">{placeAreaLine(place)}</p>}
        <ul className="p07-place-facts">
          {placeFacts(place).map((f) => (
            <li key={f.label} className={`is-${f.tone}`}>
              {f.icon}
              <span>{f.label}</span>
            </li>
          ))}
        </ul>
      </div>
      {onChange && (
        <Button variant="ghost" size="sm" onClick={onChange} className="p07-place-change" aria-label={`Change the place (now ${place.name})`}>
          Change
        </Button>
      )}
    </div>
  );
}

/** Quick lengths under the time fields: 30 min · 1 hr · 1½ hr · 2 hr · 3 hr. */
function DurationPicker({ start, end, onPick }: { start: Time; end: string; onPick: (end: Time) => void }) {
  const current = durationMin(start, end);
  const options: Array<[number, string]> = [
    [30, '30 min'],
    [60, '1 hr'],
    [90, '1½ hr'],
    [120, '2 hr'],
    [180, '3 hr'],
  ];
  return (
    <div className="p07-durations" role="group" aria-label="Set the length">
      <span className="p07-durations-label" aria-hidden>
        Length
      </span>
      {options.map(([minutes, label]) => (
        <button
          key={minutes}
          type="button"
          className={`p07-dur ${current === minutes ? 'is-on' : ''}`}
          aria-pressed={current === minutes}
          onClick={() => onPick(addMinutes(start, minutes))}
        >
          {label}
        </button>
      ))}
      {current > 0 && !options.some(([m]) => m === current) && <span className="p07-dur-custom">{formatDuration(current)}</span>}
    </div>
  );
}

/** The crowd estimate, or a placeholder that says what's still missing. */
export function CrowdBlock({ draft, onTryTime, compact }: { draft: EventDraft; onTryTime?: (t: Time) => void; compact?: boolean }) {
  const missing = [!draft.place && 'a place', !draft.date && 'a day', !isTime(draft.start) && 'a start time'].filter((x): x is string => !!x);
  if (missing.length > 0 || !draft.place) return <BusyPlaceholder missing={missing} compact={compact} />;
  return <BusyChart place={draft.place} date={draft.date} start={draft.start} end={draft.end} onTryTime={onTryTime} />;
}

/** 7C: the overlap warning. Saving still works, but it's never silent. */
export function ConflictBanner({ trip, date, conflicts }: { trip: Trip; date: string; conflicts: TripEvent[] }) {
  const n = dayNumber(trip, date);
  const one = conflicts.length === 1 ? conflicts[0] : null;
  return (
    <Banner
      tone="warning"
      icon={<TriangleAlert aria-hidden />}
      className="p07-conflict"
      title={one ? `Overlaps with ${eventLabel(one)} (${formatTimeRange(one.start, one.end)})` : `Overlaps with ${conflicts.length} events on Day ${n}`}
    >
      {!one && (
        <ul className="p07-conflict-list">
          {conflicts.map((c) => (
            <li key={c.id}>
              {eventLabel(c)} · {formatTimeRange(c.start, c.end)}
            </li>
          ))}
        </ul>
      )}
      <p>You can still save it. Both will show on Day {n}, so the group can sort it out.</p>
    </Banner>
  );
}

/* ---------------------------------------------------------------- form */

export interface EventFieldsProps {
  state: AppState;
  trip: Trip;
  access: TripAccess;
  draft: EventDraft;
  onChange: (patch: Partial<EventDraft>) => void;
  errors: DraftErrors;
  /** Screenshot review: where each value came from. */
  sources?: FieldSources;
  attendeeHint?: string | null;
  /** A note under "Day" (e.g. the asked-for day isn't one you can edit). */
  dayNote?: string | null;
  conflicts: TripEvent[];
  /** Phones/tablets: show the crowd estimate right under the time fields. */
  inlineChart: boolean;
  refs: FieldRefs;
}

/** All of the event form's fields (see the file comment for the sections). */
export function EventFields({ state, trip, access, draft, onChange, errors, sources, attendeeHint, dayNote, conflicts, inlineChart, refs }: EventFieldsProps) {
  const members = acceptedMemberIds(trip);
  // You first, then everyone else in the trip's order.
  const ordered = [...members.filter((id) => id === access.actingPersonId), ...members.filter((id) => id !== access.actingPersonId)];
  // Typed-in destinations without a map location can't anchor a search.
  const near = trip.destinations.filter((d) => !(d.lat === 0 && d.lng === 0)).map((d) => ({ lat: d.lat, lng: d.lng }));
  const cityLabel = trip.destinations[0]?.name ?? '';
  const days = access.editableDays;

  /** After "Change", search again starting from the old place's name. */
  const [changeQuery, setChangeQuery] = useState<string | null>(null);

  // Live search results (OpenStreetMap) come without photos: look one up on
  // Wikipedia and keep it on the place, so the itinerary shows it too.
  const currentPlace = useRef(draft.place);
  currentPlace.current = draft.place;
  const placeId = draft.place?.id;
  useEffect(() => {
    const place = draft.place;
    if (!place || place.source !== 'osm' || place.photo) return;
    let alive = true;
    void findPickedPlaceImage(place).then((url) => {
      // Only if they haven't picked a different place in the meantime.
      if (alive && url && currentPlace.current?.id === place.id) onChange({ place: { ...place, photo: url } });
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placeId]);
  const [showName, setShowName] = useState(!!draft.title);

  const filled: Record<DraftField | 'confirmation', boolean> = {
    place: !!draft.place,
    date: !!draft.date,
    start: isTime(draft.start),
    end: isTime(draft.end),
    cost: !!draft.costAmount.trim(),
    attendees: draft.attendeeIds.length > 0,
    confirmation: !!draft.confirmation.trim(),
  };
  const chip = (k: DraftField | 'confirmation') => (sources?.[k] ? <SourceChip source={sources[k]!} filled={filled[k]} /> : undefined);
  /** Highlight a field the screenshot couldn't fill until the person fills it. */
  const needs = (k: DraftField) => (sources?.[k] === 'needs' && !filled[k] ? 'is-needed' : '');

  const amount = parseCost(draft.costAmount);
  const going = draft.attendeeIds.length;
  const costHint =
    typeof amount === 'number' && amount === 0
      ? 'Free.'
      : typeof amount === 'number' && going > 0
        ? draft.costPer === 'person'
          ? `${money(amount)} × ${plural(going, 'person', 'people')} = ${money(amount * going)} total.`
          : `${money(amount)} total, about ${money(amount / going)} per person.`
        : 'A planned cost, so everyone knows what to expect. Log real spending on the Budget page.';

  const allSelected = members.every((id) => draft.attendeeIds.includes(id));
  const toggle = (id: string) =>
    onChange({ attendeeIds: draft.attendeeIds.includes(id) ? draft.attendeeIds.filter((x) => x !== id) : members.filter((m) => m === id || draft.attendeeIds.includes(m)) });

  return (
    <div className="p07-fields">
      {/* -------------------------------------------------------- Where */}
      <section className={`p07-sec ${needs('place')}`} aria-label="Where">
        {draft.place ? (
          <div className="field">
            <div className="field-label-row">
              <span className="field-label">Where</span>
              {chip('place')}
            </div>
            <SelectedPlace
              place={draft.place}
              onChange={() => {
                setChangeQuery(draft.place!.name);
                onChange({ place: null });
              }}
            />
          </div>
        ) : (
          <Field
            label="Where"
            required
            error={errors.place}
            aside={chip('place')}
            hint={sources?.place === 'needs' ? 'The screenshot didn’t say where. Search for the place, or type its name.' : undefined}
          >
            {(p) => (
              <PlaceSearch
                near={near}
                cityLabel={cityLabel}
                control={p}
                initialQuery={changeQuery ?? ''}
                autoFocus={changeQuery !== null}
                inputRef={refs.place}
                onPick={(place) => {
                  setChangeQuery(null);
                  onChange({ place });
                }}
              />
            )}
          </Field>
        )}

        {draft.place &&
          (showName ? (
            <Field label="Event name" aside="Optional" hint="Shown on the itinerary instead of the place name.">
              {(p) => (
                <input
                  {...p}
                  className="input"
                  value={draft.title}
                  onChange={(e) => onChange({ title: e.target.value })}
                  placeholder={draft.place!.name}
                  maxLength={80}
                  autoComplete="off"
                />
              )}
            </Field>
          ) : (
            <button type="button" className="p07-linkbtn" onClick={() => setShowName(true)}>
              <PenLine aria-hidden /> Give it a custom name
            </button>
          ))}
      </section>

      {/* --------------------------------------------------------- When */}
      <fieldset className="p07-sec p07-when-sec">
        <legend className="p07-legend">When</legend>
        <div className="p07-when">
          <div className={`p07-cell p07-cell-day ${needs('date')}`}>
            <Field label="Day" required error={errors.date} aside={chip('date')} hint={dayNote ?? undefined}>
              {(p) => (
                <div className="select-wrap">
                  <select {...p} ref={refs.date} className="input select" value={draft.date} onChange={(e) => onChange({ date: e.target.value })}>
                    {!draft.date && <option value="">Choose a day</option>}
                    {days.map((d) => (
                      <option key={d} value={d}>
                        {dayOptionLabel(trip, d)}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </Field>
          </div>
          <div className={`p07-cell ${needs('start')}`}>
            <Field label="Starts" required error={errors.start} aside={chip('start')}>
              {(p) => (
                <input {...p} ref={refs.start} type="time" className="input p07-time" value={draft.start} onChange={(e) => onChange(startPatch(draft, e.target.value, sources))} />
              )}
            </Field>
          </div>
          <div className={`p07-cell ${needs('end')}`}>
            <Field label="Ends" required error={errors.end} aside={chip('end')}>
              {(p) => <input {...p} ref={refs.end} type="time" className="input p07-time" value={draft.end} onChange={(e) => onChange({ end: e.target.value })} />}
            </Field>
          </div>
        </div>

        {isTime(draft.start) && <DurationPicker start={draft.start} end={draft.end} onPick={(end) => onChange({ end })} />}

        {access.role === 'day' && days.length > 0 && (
          <LockNote>As a Day editor, you can add and edit events only on {listJoin(days.map((d) => `Day ${dayNumber(trip, d)}`))}. Other days are view-only.</LockNote>
        )}

        {inlineChart && <CrowdBlock draft={draft} compact onTryTime={(t) => onChange(startPatch(draft, t, sources))} />}

        {conflicts.length > 0 && draft.date && <ConflictBanner trip={trip} date={draft.date} conflicts={conflicts} />}
      </fieldset>

      {/* --------------------------------------------------------- Cost */}
      <fieldset className={`p07-sec ${needs('cost')}`}>
        <legend className="p07-legend">
          <span>Cost</span>
          <span className="p07-optional">Optional</span>
          {chip('cost')}
        </legend>
        <div className="p07-cost">
          <Field label="Amount in US dollars" hideLabel error={errors.cost}>
            {(p) => (
              <div className="input-affix">
                <span className="input-prefix" aria-hidden>
                  $
                </span>
                <input
                  {...p}
                  ref={refs.cost}
                  inputMode="decimal"
                  className="input num"
                  value={draft.costAmount}
                  onChange={(e) => onChange({ costAmount: e.target.value })}
                  placeholder="0.00"
                  autoComplete="off"
                />
              </div>
            )}
          </Field>
          <Segmented
            label="The cost is"
            value={draft.costPer}
            onChange={(v) => onChange({ costPer: v })}
            options={[
              { value: 'person', label: 'Per person' },
              { value: 'total', label: 'Total' },
            ]}
          />
        </div>
        {!errors.cost && <p className="field-hint num">{costHint}</p>}
      </fieldset>

      {/* ------------------------------------------------- Who's coming */}
      <fieldset className={`p07-sec ${needs('attendees')}`}>
        <legend className="p07-legend">
          <span>Who’s coming</span>
          {chip('attendees')}
        </legend>
        <div className="p07-people-head">
          <span className="p07-people-count num">
            {going} of {members.length} going
          </span>
          <button type="button" className="p07-linkbtn" onClick={() => onChange({ attendeeIds: allSelected ? [] : [...members] })}>
            {allSelected ? 'Clear' : 'Select everyone'}
          </button>
        </div>
        <div className="p07-people" ref={refs.attendees}>
          {ordered.map((id) => {
            const person = getPerson(state, id);
            const label = id === access.actingPersonId ? 'You' : firstName(person?.name ?? 'Someone');
            return (
              <ChipToggle
                key={id}
                selected={draft.attendeeIds.includes(id)}
                onToggle={() => toggle(id)}
                icon={
                  person ? (
                    <span className="p07-chip-av" aria-hidden>
                      <Avatar person={person} size={22} />
                    </span>
                  ) : undefined
                }
              >
                {label}
              </ChipToggle>
            );
          })}
        </div>
        {attendeeHint && <p className="field-hint">{attendeeHint}</p>}
        {errors.attendees && (
          <p className="field-error" role="alert">
            <AlertCircle aria-hidden />
            <span>{errors.attendees}</span>
          </p>
        )}
      </fieldset>

      {/* ------------------------------------------------------ Details */}
      <fieldset className="p07-sec">
        <legend className="p07-legend">
          <span>Details</span>
          <span className="p07-optional">Optional</span>
        </legend>
        <div className="p07-details">
          <Field label="Booking or confirmation code" aside={chip('confirmation')}>
            {(p) => (
              <input
                {...p}
                className="input num"
                value={draft.confirmation}
                onChange={(e) => onChange({ confirmation: e.target.value })}
                placeholder="ABC-12345"
                autoCapitalize="characters"
                autoComplete="off"
                spellCheck={false}
              />
            )}
          </Field>
          <Field label="Notes">
            {(p) => (
              <textarea
                {...p}
                className="input textarea"
                rows={3}
                value={draft.notes}
                onChange={(e) => onChange({ notes: e.target.value })}
                placeholder="Door codes, what to bring, who booked it"
              />
            )}
          </Field>
        </div>
      </fieldset>
    </div>
  );
}
