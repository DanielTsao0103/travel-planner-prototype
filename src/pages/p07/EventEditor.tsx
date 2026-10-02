/**
 * Page 7's add / edit screen.
 *
 * Two ways in (the doc's "2 ways to get that information"):
 *  1. "Enter details": where, when, cost, and who's coming. Once the place,
 *     day, and start time are set, a crowd estimate appears (7B), and any
 *     overlap with another event is called out (7C).
 *  2. "Upload confirmation": pick an image or the sample, watch it get "read"
 *     (7E, simulated), then check the results and fill the gaps (7F).
 *
 * Desktop: form on the left; on the right, where the event lands in the day
 * plus the crowd estimate (or the screenshot being read). Phones: one column,
 * the estimate under the time fields, and a sticky Save bar.
 */

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { CalendarDays, ImageUp, MapPin, PenLine, ScanText, Ticket, Trash2, Wallet } from 'lucide-react';
import type { AppState, ISODate, Time, Trip, TripEvent } from '../../data/types';
import { getPlace } from '../../data/places';
import type { TripContext } from '../../hooks/useTrip';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import { addDays, dayHeading, dayNumber, formatShortDate, formatTime, timeToMin } from '../../lib/dates';
import { plural } from '../../lib/format';
import { simulateLatency } from '../../services/http';
import { findPickedPlaceImage } from '../../services/placeImages';
import { addEvent, deleteEvent, restoreEvent, updateEvent } from '../../store/actions';
import { acceptedMemberIds, conflictsFor, eventsOn, getPerson, myTrips, personName, sortEvents, today, tripAccess } from '../../store/selectors';
import { getState, update } from '../../store/store';
import { toast } from '../../store/toast';
import { navigate, withQuery } from '../../router/router';
import { paths } from '../../router/routes';
import { PageHeader } from '../../components/layout/PageHeader';
import { EventItem, eventLabel } from '../../components/domain/EventItem';
import { Button } from '../../components/ui/Button';
import { Banner, DemoBadge } from '../../components/ui/Display';
import {
  addMinutes,
  appendQuery,
  blankDraft,
  dayOptionLabel,
  draftFromEvent,
  FIELD_ORDER,
  isISODate,
  isTime,
  safeReturnPath,
  toEventInput,
  validateDraft,
  type DraftErrors,
  type EventDraft,
  type FieldSources,
} from './draft';
import { CrowdBlock, EventFields, focusField, startPatch, useFieldRefs } from './EventFields';
import { addedByLine } from './EventView';
import { extractFromSample, extractFromUpload, type Extraction } from './extract';
import { sampleTicketFor } from './SampleConfirmation';
import { checkImage, ReadingCard, ShotPreview, UnreadableCard, UploadPicker, type ShotImage } from './UploadFlow';

type Tab = 'details' | 'upload';

type UploadState =
  { stage: 'pick'; error?: string } | { stage: 'reading'; image: ShotImage; frozen?: boolean } | { stage: 'review'; image: ShotImage } | { stage: 'unreadable'; image: ShotImage };

/** Where "Back" / "Cancel" go: the itinerary, or the page that sent you here (`?return=`). */
export interface BackLink {
  to: string;
  label: string;
  /** For sentences: "Back to the itinerary". */
  phrase: string;
}

const FORM_ID = 'p07-event-form';
/** How long the simulated screenshot reading takes (Slow mode stretches it). */
const READ_MS = 1600;

/* ----------------------------------------------------- starting values */

/**
 * The form's starting values: the event being edited, or a new event with
 * the day/time other pages asked for (`?day=` or `?date=`, and `?start=`),
 * or a forced demo state (`?s=busy`, `?s=conflict`).
 */
function initialManual(args: { trip: Trip; days: ISODate[]; event?: TripEvent; query: URLSearchParams; forced: string | null; members: string[]; todayIso: ISODate }): {
  draft: EventDraft;
  dayNote: string | null;
} {
  const { trip, days, event, query, forced, members, todayIso } = args;
  if (event) return { draft: draftFromEvent(event), dayNote: null };

  const d = blankDraft(members);
  let dayNote: string | null = null;
  // `day` is the reliable key; `date` also works when the app doesn't treat it as the demo clock.
  const asked = query.get('day') ?? query.get('date');
  if (isISODate(asked) && days.includes(asked)) {
    d.date = asked;
  } else {
    if (isISODate(asked) && asked >= trip.startDate && asked <= trip.endDate) {
      dayNote = `You can’t add events on Day ${dayNumber(trip, asked)}, so we picked one of your days.`;
    }
    d.date = days.includes(todayIso) ? todayIso : (days[0] ?? '');
  }
  const askedStart = query.get('start');
  if (isTime(askedStart)) {
    d.start = askedStart;
    d.end = addMinutes(askedStart, 60);
  }

  // Forced states for the screen index (sample trip only; they use its Lisbon places).
  if (trip.isSample && (forced === 'busy' || forced === 'conflict')) {
    const day2 = addDays(trip.startDate, 1);
    const date = days.includes(day2) ? day2 : (days[0] ?? '');
    if (forced === 'busy') Object.assign(d, { place: getPlace('jeronimos'), date, start: '12:00', end: '13:00' });
    else Object.assign(d, { place: getPlace('lx-factory'), date, start: '15:45', end: '17:00' });
  }
  return { draft: d, dayNote };
}

/** Where the upload tab starts: a forced demo state (`?s=reading|review|unreadable`) or the picker. */
function initialUpload(forced: string | null): UploadState {
  if (forced === 'reading') return { stage: 'reading', image: { kind: 'sample' }, frozen: true };
  if (forced === 'review') return { stage: 'review', image: { kind: 'sample' } };
  if (forced === 'unreadable') return { stage: 'unreadable', image: { kind: 'placeholder' } };
  return { stage: 'pick' };
}

/** True while the component is on screen (async work checks this before updating). */
function useMounted() {
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  return mounted;
}

/* ================================================================ editor */

export function EventEditor({ ctx, event, query, back }: { ctx: TripContext; event?: TripEvent; query: URLSearchParams; back: BackLink }) {
  const { state, trip, access } = ctx;
  const bp = useBreakpoint();
  const isWide = bp === 'desktop';
  const isMobile = bp === 'mobile';
  const isEdit = !!event;
  const forced = query.get('s');
  const returnPath = safeReturnPath(query.get('return'));
  const members = acceptedMemberIds(trip);
  const days = access.editableDays;
  const refs = useFieldRefs();
  const mounted = useMounted();

  const [tab, setTab] = useState<Tab>(() => (!isEdit && query.get('tab') === 'upload' ? 'upload' : 'details'));
  const [initial] = useState(() => initialManual({ trip, days, event, query, forced, members, todayIso: today(getState()) }));
  const [draft, setDraft] = useState<EventDraft>(initial.draft);
  const [showErrors, setShowErrors] = useState(false);

  // Upload flow. Forced upload states only apply on the upload tab.
  const [upload, setUpload] = useState<UploadState>(() => initialUpload(tab === 'upload' ? forced : null));
  const [extraction, setExtraction] = useState<Extraction | null>(() => (tab === 'upload' && forced === 'review' ? extractFromSample(trip, days, members.length) : null));
  const [reviewDraft, setReviewDraft] = useState<EventDraft | null>(() => extraction?.draft ?? null);
  const [reviewShowErrors, setReviewShowErrors] = useState(false);

  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  /** Bumps on every new read (or cancel) so an older, slower read is ignored. */
  const runRef = useRef(0);
  /** The current uploaded image's object URL (revoked when replaced or on leaving). */
  const urlRef = useRef<string | null>(null);
  const replaceUrl = (url: string | null) => {
    if (urlRef.current && urlRef.current !== url) URL.revokeObjectURL(urlRef.current);
    urlRef.current = url;
  };
  useEffect(
    () => () => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    },
    [],
  );

  const ticket = sampleTicketFor(trip, members.length);
  const readMs = state.demo.slowMode ? READ_MS * 3.5 : READ_MS;

  /* --------------------------------------------- which draft is active */
  const reviewImage = upload.stage === 'review' ? upload.image : null;
  const inReview = tab === 'upload' && !!reviewImage && !!reviewDraft;
  const active = inReview ? reviewDraft! : draft;
  const sources: FieldSources | undefined = inReview ? extraction?.sources : undefined;
  const patchActive = (patch: Partial<EventDraft>) => {
    if (inReview) setReviewDraft((d) => (d ? { ...d, ...patch } : d));
    else setDraft((d) => ({ ...d, ...patch }));
  };

  const allErrors = validateDraft(active, days);
  const errorsVisible = inReview ? reviewShowErrors : showErrors;
  // Before a Save attempt, only show problems with what's already typed (times out of order, a bad amount).
  const shown: DraftErrors = errorsVisible ? allErrors : { end: isTime(active.start) && isTime(active.end) ? allErrors.end : undefined, cost: allErrors.cost };
  const timesOk = !!active.date && isTime(active.start) && isTime(active.end) && timeToMin(active.end) > timeToMin(active.start);
  const conflicts = timesOk ? conflictsFor(state, trip.id, active.date, active.start as Time, active.end as Time, event?.id) : [];

  // Phones/tablets: the forced crowd and conflict states (7B, 7C) scroll to "When",
  // where the estimate and the warning appear. (Waits a beat: the app scrolls to
  // the top whenever the page changes.)
  useEffect(() => {
    if (isWide || (forced !== 'busy' && forced !== 'conflict')) return;
    const t = window.setTimeout(() => document.querySelector('.p07-when-sec')?.scrollIntoView({ block: 'start' }), 150);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* -------------------------------------------------- screenshot reading */
  const startReading = async (image: ShotImage) => {
    const run = ++runRef.current;
    setUpload({ stage: 'reading', image });
    let readable = true;
    await Promise.all([simulateLatency(READ_MS), image.kind === 'file' ? checkImage(image.url).then((ok) => void (readable = ok)) : Promise.resolve()]);
    if (run !== runRef.current || !mounted.current) return; // canceled, or they left the page
    if (!readable) {
      setUpload({ stage: 'unreadable', image });
      return;
    }
    const ext = image.kind === 'file' ? extractFromUpload(trip, days, image) : extractFromSample(trip, days, members.length);
    setExtraction(ext);
    setReviewDraft(ext.draft);
    setReviewShowErrors(false);
    setUpload({ stage: 'review', image });
  };

  const handleFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setUpload({ stage: 'pick', error: 'That file isn’t an image. Choose a PNG or JPG screenshot.' });
      return;
    }
    // A local preview URL: the image never leaves this browser.
    const url = URL.createObjectURL(file);
    replaceUrl(url);
    void startReading({ kind: 'file', url, name: file.name, size: file.size });
  };

  const backToPick = () => {
    runRef.current += 1; // cancels a read in progress
    replaceUrl(null);
    setUpload({ stage: 'pick' });
  };

  // Paste a screenshot (⌘V / Ctrl+V) while the picker is showing.
  const handleFileRef = useRef(handleFile);
  handleFileRef.current = handleFile;
  useEffect(() => {
    if (tab !== 'upload' || upload.stage !== 'pick') return;
    const onPaste = (e: ClipboardEvent) => {
      const file = Array.from(e.clipboardData?.files ?? []).find((f) => f.type.startsWith('image/'));
      if (file) {
        e.preventDefault();
        handleFileRef.current(file);
      }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [tab, upload.stage]);

  /* ---------------------------------------------------------------- save */
  const done = (eventId: string) => navigate(returnPath ? appendQuery(returnPath, { focus: eventId }) : withQuery(paths.itinerary(trip.id), { focus: eventId }));

  const save = async (e?: FormEvent) => {
    e?.preventDefault();
    if (saving) return;
    const errs = validateDraft(active, days);
    const firstBad = FIELD_ORDER.find((k) => errs[k]);
    if (firstBad) {
      if (inReview) setReviewShowErrors(true);
      else setShowErrors(true);
      focusField(refs, firstBad);
      return;
    }
    setSaving(true);
    await simulateLatency(400);
    if (!mounted.current) return;

    const source: TripEvent['source'] = event ? event.source : inReview ? 'screenshot' : 'manual';
    const input = toEventInput(active, trip.id, source);
    const label = eventLabel({ title: input.title, place: input.place });
    const n = dayNumber(trip, input.date);
    let savedId: string;
    if (event) {
      const { tripId: _tripId, ...patch } = input;
      updateEvent(event.id, patch);
      savedId = event.id;
      toast({ title: 'Changes saved', body: `${label} · Day ${n} at ${formatTime(input.start)}` });
    } else {
      savedId = addEvent(input);
      toast({ title: `Added to Day ${n}`, body: `${label} · ${formatShortDate(input.date)} at ${formatTime(input.start)}` });
    }
    // Saved before the live place's photo arrived? Attach it when it does, so the
    // itinerary still shows a picture for this event.
    const place = input.place;
    if (place.source === 'osm' && !place.photo) {
      void findPickedPlaceImage(place).then((url) => {
        if (!url) return;
        // Escape hatch: only the photo changes. (updateEvent would also re-trigger
        // the itinerary's "just added" highlight.)
        update((d) => {
          const saved = d.events.find((x) => x.id === savedId);
          if (saved && saved.place.id === place.id && !saved.place.photo) saved.place = { ...saved.place, photo: url };
        });
      });
    }
    done(savedId);
  };

  const remove = () => {
    if (!event) return;
    const label = eventLabel(event);
    const n = dayNumber(trip, event.date);
    // Leave first (replacing this history entry), then delete, so this page
    // never flashes "event not found" in between.
    navigate(returnPath ?? paths.itinerary(trip.id), { replace: true });
    const removed = deleteEvent(event.id);
    toast({
      title: 'Event deleted',
      body: `${label} was removed from Day ${n}.`,
      tone: 'info',
      duration: 8000,
      action: removed ? { label: 'Undo', onClick: () => restoreEvent(removed) } : undefined,
    });
  };

  /* -------------------------------------------------------------- header */
  const tripOptions = isEdit ? [] : myTrips(state).filter((t) => tripAccess(state, t).canAddEvents);
  const tripPicker = !isEdit && (
    <div className="p07-trippick">
      {tripOptions.length > 1 ? (
        <>
          <label htmlFor="p07-trip" className="p07-trippick-label">
            Adding to
          </label>
          <div className="select-wrap">
            <select
              id="p07-trip"
              className="input select"
              value={trip.id}
              // A different trip means different days and people, so start that trip's form fresh.
              onChange={(e) => navigate(withQuery(paths.newEvent(e.target.value), { tab: tab === 'upload' ? 'upload' : undefined }), { replace: true })}
            >
              {tripOptions.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </select>
          </div>
        </>
      ) : (
        <p className="p07-trippick-one">
          <span className="p07-trippick-label">Adding to</span> <strong>{trip.title}</strong>
        </p>
      )}
    </div>
  );

  const addedBy = event ? getPerson(state, event.createdById) : undefined;

  /* -------------------------------------------------------- form + panels */
  const needsLeft = inReview && sources ? (Object.entries(sources) as Array<[string, string]>).filter(([k, v]) => v === 'needs' && isEmpty(active, k)).length : 0;
  const errorCount = Object.values(allErrors).filter(Boolean).length;
  const n = active.date ? dayNumber(trip, active.date) : null;
  const saveLabel = saving ? 'Saving…' : conflicts.length > 0 ? 'Save anyway' : isEdit ? 'Save changes' : n ? `Add to Day ${n}` : 'Add event';

  const form = (
    <form id={FORM_ID} className="p07-form" onSubmit={save} noValidate aria-busy={saving || undefined} aria-label={isEdit ? 'Edit event' : 'New event'}>
      <fieldset className="p07-fieldset" disabled={saving}>
        {inReview && extraction && <ReviewIntro extraction={extraction} onChangeImage={backToPick} />}
        {inReview && reviewImage && !isWide && (
          <details className="p07-shot-fold">
            <summary>
              <ScanText aria-hidden /> Show your screenshot
            </summary>
            <ShotPreview image={reviewImage} ticket={ticket} />
          </details>
        )}
        <EventFields
          state={state}
          trip={trip}
          access={access}
          draft={active}
          onChange={patchActive}
          errors={shown}
          sources={sources}
          attendeeHint={inReview ? extraction?.attendeeHint : null}
          dayNote={inReview ? extraction?.dateNote : initial.dayNote}
          conflicts={conflicts}
          inlineChart={!isWide}
          refs={refs}
        />
        {event && <DeleteBlock label={eventLabel(event)} day={dayNumber(trip, event.date)} confirming={confirmDelete} setConfirming={setConfirmDelete} onDelete={remove} />}
      </fieldset>

      <div className="p07-actions">
        {errorsVisible && errorCount > 0 ? (
          <p className="p07-actions-note is-error" role="status">
            {errorCount === 1 ? '1 thing needs' : `${errorCount} things need`} your attention
          </p>
        ) : needsLeft > 0 ? (
          <p className="p07-actions-note" role="status">
            {needsLeft === 1 ? '1 field still needs' : `${needsLeft} fields still need`} your input
          </p>
        ) : conflicts.length > 0 ? (
          <p className="p07-actions-note is-warning">Overlaps another event</p>
        ) : null}
        <div className="p07-actions-buttons">
          <Button variant="ghost" onClick={() => navigate(back.to)} disabled={saving} size={isMobile ? 'lg' : 'md'}>
            Cancel
          </Button>
          <Button type="submit" loading={saving} className="p07-save" size={isMobile ? 'lg' : 'md'}>
            {saveLabel}
          </Button>
        </div>
      </div>
    </form>
  );

  let uploadPanel = null;
  if (tab === 'upload' && !inReview) {
    if (upload.stage === 'pick') {
      uploadPanel = <UploadPicker onFile={handleFile} onSample={() => void startReading({ kind: 'sample' })} error={upload.error} isMobile={isMobile} />;
    } else if (upload.stage === 'reading') {
      uploadPanel = <ReadingCard image={upload.image} ticket={ticket} frozen={upload.frozen} durationMs={readMs} onCancel={backToPick} />;
    } else if (upload.stage === 'unreadable') {
      uploadPanel = <UnreadableCard image={upload.image} ticket={ticket} onRetry={backToPick} onManual={() => setTab('details')} />;
    }
  }

  // Desktop side column.
  let side = null;
  if (isWide) {
    if (tab === 'upload' && !inReview) {
      side = upload.stage === 'pick' ? <WhatWeRead /> : <ShotPreview image={upload.image} ticket={ticket} />;
    } else {
      // The crowd estimate comes first: it's the answer to "how busy will it be?".
      side =
        inReview && reviewImage ? (
          <>
            <ShotPreview image={reviewImage} ticket={ticket} />
            <CrowdBlock draft={active} onTryTime={(t) => patchActive(startPatch(active, t, sources))} />
          </>
        ) : (
          <>
            <CrowdBlock draft={active} onTryTime={(t) => patchActive(startPatch(active, t, sources))} />
            <DayPreview state={state} trip={trip} draft={active} editingId={event?.id} />
          </>
        );
    }
  }

  return (
    <div className="container page p07 p07-editor">
      <PageHeader
        back={{ to: back.to, label: back.label }}
        eyebrow={event ? dayOptionLabel(trip, event.date) : undefined}
        title={isEdit ? 'Edit event' : 'Add an event'}
        subtitle={
          event
            ? addedByLine(addedBy ? personName(state, addedBy.id, access.actingPersonId) : 'someone', event.source)
            : isMobile
              ? undefined // the tabs below say the same thing; save the space on phones
              : 'Type in the details, or upload a booking screenshot and we’ll fill them in.'
        }
        actions={isWide ? tripPicker : undefined}
      />

      {!isEdit && (
        <div className="p07-modebar">
          {!isWide && tripPicker}
          <Tabs tab={tab} onChange={setTab} />
        </div>
      )}

      <div className={`p07-layout ${isWide ? 'is-wide' : ''}`}>
        <div className="p07-main" {...(!isEdit ? { role: 'tabpanel', id: 'p07-panel', 'aria-labelledby': tab === 'details' ? 'p07-tab-details' : 'p07-tab-upload' } : {})}>
          {tab === 'details' || inReview ? form : uploadPanel}
        </div>
        {isWide && (
          <aside className="p07-side" aria-label="Preview">
            {side}
          </aside>
        )}
      </div>
    </div>
  );
}

/** Is this draft field still empty? (for the "fields still need your input" count) */
function isEmpty(d: EventDraft, key: string): boolean {
  switch (key) {
    case 'place':
      return !d.place;
    case 'date':
      return !d.date;
    case 'start':
      return !isTime(d.start);
    case 'end':
      return !isTime(d.end);
    case 'cost':
      return !d.costAmount.trim();
    case 'attendees':
      return d.attendeeIds.length === 0;
    case 'confirmation':
      return !d.confirmation.trim();
    default:
      return false;
  }
}

/* ------------------------------------------------------------ pieces */

/** The two ways to add an event, as an accessible tab list (←/→ switch tabs). */
function Tabs({ tab, onChange }: { tab: Tab; onChange: (t: Tab) => void }) {
  const detailsRef = useRef<HTMLButtonElement>(null);
  const uploadRef = useRef<HTMLButtonElement>(null);
  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
    e.preventDefault();
    const next: Tab = e.key === 'Home' ? 'details' : e.key === 'End' ? 'upload' : tab === 'details' ? 'upload' : 'details';
    onChange(next);
    (next === 'details' ? detailsRef : uploadRef).current?.focus();
  };
  return (
    <div className="p07-tabs" role="tablist" aria-label="How do you want to add it?">
      <button
        ref={detailsRef}
        type="button"
        role="tab"
        id="p07-tab-details"
        aria-selected={tab === 'details'}
        aria-controls="p07-panel"
        tabIndex={tab === 'details' ? 0 : -1}
        className={tab === 'details' ? 'is-active' : ''}
        onClick={() => onChange('details')}
        onKeyDown={onKeyDown}
      >
        <PenLine aria-hidden /> Enter details
      </button>
      <button
        ref={uploadRef}
        type="button"
        role="tab"
        id="p07-tab-upload"
        aria-selected={tab === 'upload'}
        aria-controls="p07-panel"
        tabIndex={tab === 'upload' ? 0 : -1}
        className={tab === 'upload' ? 'is-active' : ''}
        onClick={() => onChange('upload')}
        onKeyDown={onKeyDown}
      >
        <ScanText aria-hidden /> Upload confirmation
      </button>
    </div>
  );
}

/** 7F header: what came from the screenshot and what's left to fill in. */
function ReviewIntro({ extraction, onChangeImage }: { extraction: Extraction; onChangeImage: () => void }) {
  const values = Object.values(extraction.sources);
  const found = values.filter((v) => v === 'found').length;
  const needed = values.filter((v) => v === 'needs').length;
  return (
    <div className="p07-review">
      <div className="p07-review-head">
        <h2 className="p07-review-title">Check what we found</h2>
        <DemoBadge>Simulated</DemoBadge>
      </div>
      <p className="p07-review-text">
        {plural(found, 'detail')} came from your screenshot. Fill in the {plural(needed, 'highlighted field')} to finish.
      </p>
      {extraction.fromUpload && (
        <Banner tone="demo" title="Simulated reading">
          This prototype can’t really read images, so we filled in example details for yours. Check each one before saving.
        </Banner>
      )}
      <Button variant="ghost" size="sm" icon={<ImageUp />} onClick={onChangeImage} className="p07-review-change">
        Use a different image
      </Button>
    </div>
  );
}

/** Desktop side column before an image is chosen: what the reader looks for. */
function WhatWeRead() {
  return (
    <section className="p07-side-card" aria-labelledby="p07-what-title">
      <p id="p07-what-title" className="p07-side-title">
        What we look for
      </p>
      <ul className="p07-read-list">
        <li>
          <MapPin aria-hidden /> The place and its address
        </li>
        <li>
          <CalendarDays aria-hidden /> The date and start time
        </li>
        <li>
          <Wallet aria-hidden /> The price, per person or in total
        </li>
        <li>
          <Ticket aria-hidden /> A booking or confirmation code
        </li>
      </ul>
      <p className="p07-side-note">Anything we can’t find is highlighted so you can fill it in. Nothing is added until you save.</p>
    </section>
  );
}

/** Desktop: where the new event lands in its day ("Day 2 — 10/16"), highlighted. */
function DayPreview({ state, trip, draft, editingId }: { state: AppState; trip: Trip; draft: EventDraft; editingId?: string }) {
  if (!draft.place || !draft.date || !isTime(draft.start)) {
    return (
      <section className="p07-side-card is-empty" aria-labelledby="p07-day-title">
        <p id="p07-day-title" className="p07-side-title">
          On your itinerary
        </p>
        <p className="p07-side-note">Pick a place, day, and start time to see where it lands in the day.</p>
      </section>
    );
  }
  const preview: TripEvent = {
    id: 'p07-preview',
    tripId: trip.id,
    place: draft.place,
    title: draft.title.trim() || undefined,
    date: draft.date,
    start: draft.start,
    end: isTime(draft.end) ? draft.end : draft.start,
    attendeeIds: draft.attendeeIds,
    source: 'manual',
    createdById: '',
  };
  const list = sortEvents([...eventsOn(state, trip.id, draft.date).filter((e) => e.id !== editingId), preview]);
  return (
    <section className="p07-side-card" aria-labelledby="p07-day-title">
      <p id="p07-day-title" className="p07-side-title">
        {dayHeading(trip, draft.date)}
      </p>
      <ul className="p07-daylist">
        {list.map((e) => (
          <li key={e.id} aria-current={e.id === 'p07-preview' ? 'true' : undefined}>
            <EventItem event={e} compact highlight={e.id === 'p07-preview'} />
          </li>
        ))}
      </ul>
    </section>
  );
}

/** 7H: delete with an inline "are you sure?" (Undo is offered in the toast afterwards). */
function DeleteBlock({
  label,
  day,
  confirming,
  setConfirming,
  onDelete,
}: {
  label: string;
  day: number;
  confirming: boolean;
  setConfirming: (v: boolean) => void;
  onDelete: () => void;
}) {
  const keepRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (confirming) keepRef.current?.focus();
  }, [confirming]);
  return (
    <section className="p07-sec p07-delete" aria-label="Delete this event">
      {confirming ? (
        <div className="p07-delete-confirm" role="group" aria-label="Confirm delete">
          <p>
            <strong>Delete {label}?</strong> It comes off Day {day} for everyone on the trip.
          </p>
          <div className="p07-delete-buttons">
            <Button variant="danger" icon={<Trash2 />} onClick={onDelete}>
              Delete event
            </Button>
            <Button variant="ghost" ref={keepRef} onClick={() => setConfirming(false)}>
              Keep it
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="ghost" icon={<Trash2 />} className="p07-delete-btn" onClick={() => setConfirming(true)}>
          Delete event
        </Button>
      )}
    </section>
  );
}
