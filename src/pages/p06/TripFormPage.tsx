/**
 * Page 6 — Create a trip (/trips/new) and edit one (/trip/:id/edit).
 *
 * Doc: three things — 1) a title, with a gray "bachelorette trip" style
 * suggestion, 2) where they're going (several places allowed, one is enough),
 * and 3) a way to invite people. Don't set permissions here: everyone invited
 * starts as a Viewer, and roles change on Page 13. Once created, the trip must
 * be findable on Page 5, and everything stays editable later.
 * Approved addition: start + end dates are required (the itinerary needs them).
 *
 * Forced states (?s=): errors (6B) · filled (6C) · saving (6D)
 * Edit mode (6E) is for the Owner; everyone else sees a locked summary (6F).
 * Query: `dest=<Home suggestion id>` prefills the destination and dates (Page 4 → 6).
 */

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { CalendarPlus, CalendarRange, MapPinOff, SlidersHorizontal, Sparkles, Users, Wallet } from 'lucide-react';
import { HOME_SUGGESTIONS, POPULAR_CITIES, type SuggestedDestination } from '../../data/destinations';
import type { Destination, ISODate, Trip, TripEvent } from '../../data/types';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import { useTrip, type TripContext } from '../../hooks/useTrip';
import { addDays, dayNumber, daysBetween, formatDateRange, formatShortDate } from '../../lib/dates';
import { plural } from '../../lib/format';
import { simulateLatency } from '../../services/http';
import { findCityImage } from '../../services/placeImages';
import { createTrip, shiftTripEvents, updateTrip } from '../../store/actions';
import { currentPerson, getPerson, today, tripEvents, tripPeople } from '../../store/selectors';
import { update, useAppState } from '../../store/store';
import { toast } from '../../store/toast';
import { Link, navigate, withQuery } from '../../router/router';
import { paths } from '../../router/routes';
import { PageHeader } from '../../components/layout/PageHeader';
import { PlacePhoto } from '../../components/domain/PlacePhoto';
import { Button } from '../../components/ui/Button';
import { Avatar, AvatarStack, Banner, EmptyState, RoleBadge } from '../../components/ui/Display';
import { Checkbox, Field } from '../../components/ui/Field';
import { CitySearch } from './CitySearch';
import { coverToSave, destKey, useCoverPhoto } from './coverPhoto';
import { checkInvite, InviteFields, inviteeLabel, inviteesAsPeople, type Invitee } from './InviteFields';
import { TripPreview } from './TripPreview';
import './p06.css';

/** Longest trip we allow (keeps the itinerary and dashboard manageable). */
const MAX_DAYS = 30;
/** Lets the Save button submit the form from outside it (desktop side column). */
const FORM_ID = 'p06-trip-form';

type Mode = 'create' | 'edit';
type Forced = 'errors' | 'filled' | 'saving' | null;

/** Everything the form edits. Dates are '' until picked. */
interface TripDraft {
  title: string;
  destinations: Destination[];
  startDate: ISODate | '';
  endDate: ISODate | '';
  invitees: Invitee[];
}

type ErrorKey = 'title' | 'destinations' | 'startDate' | 'endDate' | 'range' | 'invite';
type TripErrors = Partial<Record<ErrorKey, string>>;

/** Fictional invitees for the "filled" state (example.com never reaches a real inbox). */
const SAMPLE_INVITEES: Invitee[] = [
  { name: 'Ava Thompson', email: 'ava.thompson@example.com' },
  { name: 'Rosa Martinez', email: 'rosa.martinez@example.com' },
];

/** Read `?s=` into one of the create form's forced states (or null). */
function readForced(query?: URLSearchParams): Forced {
  const s = query?.get('s');
  return s === 'errors' || s === 'filled' || s === 'saving' ? s : null;
}

/** A real 'YYYY-MM-DD' date (date inputs pass through odd years like 0002 while you type). */
function isISO(v: string): v is ISODate {
  return /^(19|20)\d{2}-\d{2}-\d{2}$/.test(v);
}

/* ======================================================================= */

export function TripFormPage({ tripId, query }: { tripId?: string; query: URLSearchParams }) {
  // A new key re-mounts the form for a different trip or forced state.
  const key = `${tripId ?? 'new'}|${query.get('s') ?? ''}|${query.get('dest') ?? ''}`;
  return tripId ? <EditTrip key={key} tripId={tripId} /> : <TripForm key={key} mode="create" query={query} />;
}

/** Edit route: only the Owner gets the form; everyone else sees why not (6F). */
function EditTrip({ tripId }: { tripId: string }) {
  const ctx = useTrip(tripId);
  if (!ctx) return <TripMissing />;
  if (!ctx.access.canEditTrip) return <TripLocked ctx={ctx} />;
  return <TripForm mode="edit" ctx={ctx} />;
}

/* ================================================================ the form */

/** Starting values: the trip being edited, a forced demo state, a Home suggestion, or blank. */
function initialDraft(args: { trip?: Trip; forced: Forced; suggestion?: SuggestedDestination; todayIso: ISODate }): TripDraft {
  const { trip, forced, suggestion, todayIso } = args;
  if (trip) {
    return { title: trip.title, destinations: trip.destinations.map((d) => ({ ...d })), startDate: trip.startDate, endDate: trip.endDate, invitees: [] };
  }
  if (forced === 'filled' || forced === 'saving') {
    const start = addDays(todayIso, 30);
    const cities = ['Nashville', 'New Orleans'].map((name) => POPULAR_CITIES.find((c) => c.name === name)).filter((c): c is Destination => !!c);
    return { title: 'Bachelorette weekend', destinations: cities, startDate: start, endDate: addDays(start, 2), invitees: SAMPLE_INVITEES };
  }
  if (suggestion) {
    // "Plan this trip" from Home: the place, plus the longest suggested stay starting a month out.
    const start = addDays(todayIso, 30);
    return { title: '', destinations: [{ ...suggestion.destination }], startDate: start, endDate: addDays(start, suggestion.days[1] - 1), invitees: [] };
  }
  return { title: '', destinations: [], startDate: '', endDate: '', invitees: [] };
}

/** All validation rules in one place. `outside` = events that would fall outside the new dates. */
function validate(d: TripDraft, ctx: { mode: Mode; todayIso: ISODate; trip?: Trip; outside: number }): TripErrors {
  const e: TripErrors = {};
  const title = d.title.trim();
  if (!title) e.title = 'Give your trip a name';
  else if (title.length > 80) e.title = 'Keep the name under 80 characters';

  if (d.destinations.length === 0) e.destinations = 'Add at least one destination';

  const startMoved = ctx.mode === 'create' || d.startDate !== ctx.trip?.startDate;
  if (!isISO(d.startDate)) e.startDate = 'Pick a start date';
  else if (startMoved && d.startDate < ctx.todayIso) e.startDate = 'Pick a start date that’s today or later';

  if (!isISO(d.endDate)) e.endDate = 'Pick an end date';
  else if (isISO(d.startDate) && d.endDate < d.startDate) e.endDate = 'End date must be on or after the start date';
  else if (isISO(d.startDate) && daysBetween(d.startDate, d.endDate) + 1 > MAX_DAYS) {
    e.endDate = `Trips can be up to ${MAX_DAYS} days. Pick an end date on or before ${formatShortDate(addDays(d.startDate, MAX_DAYS - 1))}.`;
  }

  if (ctx.outside > 0) {
    const n = ctx.outside;
    e.range = `${plural(n, 'event')} ${n === 1 ? 'is' : 'are'} outside these dates. Move or delete ${n === 1 ? 'it' : 'them'} first.`;
  }
  return e;
}

/** The create / edit form itself: fields on the left, live preview (and Save) on the right. */
function TripForm({ mode, ctx, query }: { mode: Mode; ctx?: TripContext; query?: URLSearchParams }) {
  const state = useAppState();
  const bp = useBreakpoint();
  const isMobile = bp === 'mobile';
  const me = currentPerson(state);
  const todayIso = today(state);
  const trip = ctx?.trip;
  const forced = mode === 'create' ? readForced(query) : null;
  const suggestion = mode === 'create' ? HOME_SUGGESTIONS.find((s) => s.id === query?.get('dest')) : undefined;

  const [draft, setDraft] = useState<TripDraft>(() => initialDraft({ trip, forced, suggestion, todayIso }));
  const [showErrors, setShowErrors] = useState(forced === 'errors');
  const [saving, setSaving] = useState(forced === 'saving');
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [moveEvents, setMoveEvents] = useState(true);
  /** Screen-reader announcement for list changes ("Added Ava as a Viewer"). */
  const [announce, setAnnounce] = useState('');

  // Keep the existing cover (edit) or the suggestion's photo while the first stop is unchanged.
  const keep = trip ? { key: destKey(trip.destinations[0]), photo: trip.coverPhoto } : suggestion ? { key: destKey(suggestion.destination), photo: suggestion.photo } : undefined;
  const cover = useCoverPhoto(draft.destinations[0], keep);

  const titleRef = useRef<HTMLInputElement>(null);
  const destRef = useRef<HTMLInputElement>(null);
  const startRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLInputElement>(null);
  const inviteNameRef = useRef<HTMLInputElement>(null);
  const inviteEmailRef = useRef<HTMLInputElement>(null);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const patch = (p: Partial<TripDraft>) => setDraft((d) => ({ ...d, ...p }));

  /* ------------------------------------------- edit mode: moving dates */
  const events: TripEvent[] = trip ? tripEvents(state, trip.id) : [];
  const datesOk = isISO(draft.startDate) && isISO(draft.endDate) && draft.endDate >= draft.startDate;
  const delta = trip && isISO(draft.startDate) ? daysBetween(trip.startDate, draft.startDate) : 0;
  const sameLength = !!trip && datesOk && daysBetween(draft.startDate, draft.endDate) === daysBetween(trip.startDate, trip.endDate);
  // Offer to carry the plan along when the whole trip moves (same length, new start).
  const offerMove = mode === 'edit' && delta !== 0 && sameLength && events.length > 0;
  const willShift = offerMove && moveEvents;
  const outside =
    datesOk && mode === 'edit'
      ? events.filter((e) => {
          const d = willShift ? addDays(e.date, delta) : e.date;
          return d < draft.startDate || d > draft.endDate;
        })
      : [];

  const errors = validate(draft, { mode, todayIso, trip, outside: outside.length });
  // Missing-field errors wait for a Save attempt; date conflicts show right away.
  const bothDates = isISO(draft.startDate) && isISO(draft.endDate);
  const shown: TripErrors = showErrors ? errors : { endDate: bothDates ? errors.endDate : undefined, range: errors.range };

  /** Changing the start date. Editing keeps the trip's length (the whole trip moves). */
  const setStart = (value: string) =>
    setDraft((d) => {
      if (!value) return { ...d, startDate: '' };
      const len = isISO(d.startDate) && isISO(d.endDate) && d.endDate >= d.startDate ? daysBetween(d.startDate, d.endDate) : 0;
      if (mode === 'edit' && isISO(value) && isISO(d.endDate)) return { ...d, startDate: value, endDate: addDays(value, len) };
      // Creating: keep the end date unless it would now be before the start.
      if (isISO(value) && isISO(d.endDate) && d.endDate < value) return { ...d, startDate: value, endDate: addDays(value, len) };
      return { ...d, startDate: value };
    });

  /* ------------------------------------------------------------ invites */
  const addInvite = () => {
    const problem = checkInvite(inviteEmail, draft.invitees, me?.email);
    if (problem) {
      setInviteError(problem);
      inviteEmailRef.current?.focus();
      return;
    }
    const added: Invitee = { name: inviteName.trim(), email: inviteEmail.trim() };
    patch({ invitees: [...draft.invitees, added] });
    setInviteName('');
    setInviteEmail('');
    setInviteError(null);
    setAnnounce(`Added ${inviteeLabel(added)} as a Viewer`);
    inviteNameRef.current?.focus();
  };

  const removeInvite = (email: string) => {
    const gone = draft.invitees.find((i) => i.email === email);
    patch({ invitees: draft.invitees.filter((i) => i.email !== email) });
    if (gone) setAnnounce(`Removed ${inviteeLabel(gone)}`);
    inviteNameRef.current?.focus();
  };

  /* -------------------------------------------------------------- save */
  const focusError = (key: ErrorKey) => {
    const target = { title: titleRef, destinations: destRef, startDate: startRef, endDate: endRef, range: endRef, invite: inviteEmailRef }[key];
    target.current?.focus();
    target.current?.scrollIntoView({ block: 'center' });
  };

  const submit = async (e?: FormEvent) => {
    e?.preventDefault();
    if (saving) return;

    // An invite typed but never "Added": include it if it's valid, otherwise ask to fix it.
    let invitees = draft.invitees;
    let inviteProblem: string | null = null;
    if (mode === 'create' && (inviteEmail.trim() || inviteName.trim())) {
      inviteProblem = checkInvite(inviteEmail, invitees, me?.email);
      if (inviteProblem) {
        setInviteError(inviteProblem);
      } else {
        invitees = [...invitees, { name: inviteName.trim(), email: inviteEmail.trim() }];
        patch({ invitees });
        setInviteName('');
        setInviteEmail('');
        setInviteError(null);
      }
    }

    const errs = validate({ ...draft, invitees }, { mode, todayIso, trip, outside: outside.length });
    const order: ErrorKey[] = ['title', 'destinations', 'startDate', 'endDate', 'range'];
    const firstBad = order.find((k) => errs[k]) ?? (inviteProblem ? 'invite' : undefined);
    if (firstBad) {
      setShowErrors(true);
      focusError(firstBad);
      return;
    }

    setSaving(true);
    await simulateLatency(650);
    if (!mounted.current) return; // they left the page while we were saving

    const title = draft.title.trim();
    const first = draft.destinations[0];
    const startDate = draft.startDate as ISODate;
    const endDate = draft.endDate as ISODate;

    if (mode === 'create') {
      const id = createTrip({ title, destinations: draft.destinations, startDate, endDate, invitees, coverPhoto: coverToSave(cover) });
      // The photo search is still running: attach the photo to the new trip when it arrives.
      if (cover.status === 'loading' && first) {
        void findCityImage(first).then((url) => url && updateTrip(id, { coverPhoto: url }));
      }
      toast({
        title: 'Trip created',
        body: invitees.length ? `${title} is in My trips. ${plural(invitees.length, 'person', 'people')} marked as invited.` : `${title} is in My trips.`,
      });
      // Page 5 highlights it from ui.justCreatedTripId; `created` in the URL is a backup in
      // case another page clears that flag first (Page 8 clears highlights on a timer).
      navigate(withQuery(paths.trips(), { created: id }));
      return;
    }

    const t = trip!;
    const sameFirst = destKey(first) === destKey(t.destinations[0]);
    // Moves events, to-dos, ideas, and Day-editor assignments together.
    if (willShift) shiftTripEvents(t.id, delta);
    updateTrip(t.id, { title, destinations: draft.destinations, startDate, endDate, coverPhoto: coverToSave(cover) ?? (sameFirst ? t.coverPhoto : undefined) });
    if (cover.status === 'loading' && first && !sameFirst) {
      void findCityImage(first).then((url) => url && updateTrip(t.id, { coverPhoto: url }));
    }
    toast({ title: 'Trip updated', body: willShift ? `Moved ${plural(events.length, 'event')} to the new dates.` : `${title} is up to date.` });
    navigate(paths.itinerary(t.id));
  };

  const cancelTo = mode === 'edit' && trip ? paths.itinerary(trip.id) : suggestion ? paths.home() : paths.trips();

  /* ------------------------------------------------------------ render */
  // Save + Cancel: a sticky bar on phones, under the sticky preview on bigger screens.
  // `form={FORM_ID}` lets the Save button submit the form even when it sits outside it.
  const actionButtons = (
    <>
      <Button type="submit" form={FORM_ID} loading={saving} size={isMobile ? 'lg' : 'md'} block={!isMobile} className="p06-save">
        {saving ? (mode === 'create' ? 'Creating trip…' : 'Saving…') : mode === 'create' ? 'Create trip' : 'Save changes'}
      </Button>
      <Button variant="ghost" size={isMobile ? 'lg' : 'md'} block={!isMobile} onClick={() => navigate(cancelTo)} disabled={saving}>
        Cancel
      </Button>
    </>
  );
  // The summary lists the trip's own fields; an invite problem shows (and is focused) inline.
  const errorList = (Object.entries(shown) as Array<[ErrorKey, string | undefined]>).filter((x): x is [ErrorKey, string] => !!x[1]);
  const days = datesOk ? daysBetween(draft.startDate, draft.endDate) + 1 : 0;
  const previewPeople = [...(me ? [me] : []), ...inviteesAsPeople(draft.invitees)];
  const editPeople = trip
    ? tripPeople(state, trip)
        .filter((p) => p.status !== 'declined')
        .map((p) => p.person)
    : [];

  return (
    <div className="container page p06">
      <PageHeader
        back={
          mode === 'edit' && trip
            ? { to: paths.itinerary(trip.id), label: 'Itinerary' }
            : suggestion
              ? { to: paths.home(), label: 'Home' }
              : { to: paths.trips(), label: 'My trips' }
        }
        title={mode === 'edit' ? 'Edit trip' : 'New trip'}
        subtitle={
          mode === 'edit'
            ? 'Change the name, places, or dates. To invite people or change roles, use the Collaborators page.'
            : 'Name it, choose where you’re going, and invite your group. You can change all of this later.'
        }
      />

      {suggestion && (
        <Banner tone="info" icon={<Sparkles aria-hidden />} title={`Planning ${suggestion.name}`} className="p06-banner">
          We added {suggestion.destination.name} with {plural(suggestion.days[1], 'day')} starting a month from today. Change anything you like.
        </Banner>
      )}

      {showErrors && errorList.length > 0 && (
        <Banner tone="danger" title={`Fix ${plural(errorList.length, 'thing')} to ${mode === 'create' ? 'create your trip' : 'save your changes'}`} className="p06-banner">
          <ul className="p06-summary-list">
            {errorList.map(([key, message]) => (
              <li key={key}>
                <button type="button" className="p06-summary-link" onClick={() => focusError(key)}>
                  {message}
                </button>
              </li>
            ))}
          </ul>
        </Banner>
      )}

      <div className="p06-layout">
        <form id={FORM_ID} className="p06-form" onSubmit={submit} noValidate aria-busy={saving || undefined} aria-label={mode === 'edit' ? 'Edit trip' : 'New trip'}>
          <fieldset className="p06-fieldset" disabled={saving}>
            {/* 1 — Title */}
            <section className="p06-sec">
              <Field label={<StepLabel n={1}>Trip name</StepLabel>} required error={shown.title} hint="Something your group will recognize. You can rename it anytime.">
                {(p) => (
                  <input
                    {...p}
                    ref={titleRef}
                    className="input p06-title-input"
                    value={draft.title}
                    onChange={(e) => patch({ title: e.target.value })}
                    placeholder="Bachelorette trip"
                    maxLength={80}
                    autoComplete="off"
                    autoCapitalize="sentences"
                    enterKeyHint="next"
                  />
                )}
              </Field>
            </section>

            {/* 2 — Destinations */}
            <section className="p06-sec">
              <Field
                label={<StepLabel n={2}>Where are you going?</StepLabel>}
                required
                error={shown.destinations}
                hint="Add one place or several stops, in order. The first one sets the cover photo."
              >
                {(p) => <CitySearch value={draft.destinations} onChange={(destinations) => patch({ destinations })} control={p} inputRef={destRef} disabled={saving} />}
              </Field>
            </section>

            {/* 3 — Dates */}
            <fieldset className="p06-sec p06-dates">
              <legend className="p06-legend">
                <StepLabel n={3}>When</StepLabel>
                <span className="field-required" aria-hidden>
                  {' '}
                  *
                </span>
              </legend>
              <div className="p06-date-row">
                <Field label="Start date" required error={shown.startDate}>
                  {(p) => (
                    <input
                      {...p}
                      ref={startRef}
                      type="date"
                      className="input p06-date"
                      value={draft.startDate}
                      min={mode === 'create' ? todayIso : undefined}
                      onChange={(e) => setStart(e.target.value)}
                    />
                  )}
                </Field>
                <Field label="End date" required error={shown.endDate}>
                  {(p) => (
                    <input
                      {...p}
                      ref={endRef}
                      type="date"
                      className="input p06-date"
                      value={draft.endDate}
                      min={isISO(draft.startDate) ? draft.startDate : todayIso}
                      max={isISO(draft.startDate) ? addDays(draft.startDate, MAX_DAYS - 1) : undefined}
                      onChange={(e) => patch({ endDate: e.target.value })}
                    />
                  )}
                </Field>
              </div>

              {datesOk && !errors.endDate && (
                <p className="p06-length num">
                  <CalendarRange aria-hidden />
                  <span>
                    <strong>{plural(days, 'day')}</strong> · {formatShortDate(draft.startDate)} – {formatShortDate(draft.endDate)}
                  </span>
                </p>
              )}
              {mode === 'edit' && <p className="field-hint">Changing the start date moves the end date too, so the trip keeps its length.</p>}

              {offerMove && (
                <div className="p06-move">
                  <Checkbox
                    label="Move all events with the new dates"
                    description={`Every event keeps its trip day, so Day 1 becomes ${formatShortDate(draft.startDate)}. ${plural(events.length, 'event')} will move.`}
                    checked={moveEvents}
                    onChange={setMoveEvents}
                  />
                </div>
              )}

              {shown.range && trip && <OutsideEvents message={shown.range} events={outside} trip={trip} willShift={willShift} delta={delta} />}
            </fieldset>

            {/* 4 — People */}
            {mode === 'create' ? (
              <fieldset className="p06-sec">
                <legend className="p06-legend">
                  <StepLabel n={4}>Invite people</StepLabel>
                  <span className="p06-optional">Optional</span>
                </legend>
                <InviteFields
                  me={me}
                  invitees={draft.invitees}
                  name={inviteName}
                  email={inviteEmail}
                  error={inviteError}
                  onName={setInviteName}
                  onEmail={(v) => {
                    setInviteEmail(v);
                    if (inviteError) setInviteError(null);
                  }}
                  onAdd={addInvite}
                  onRemove={removeInvite}
                  nameRef={inviteNameRef}
                  emailRef={inviteEmailRef}
                  disabled={saving}
                />
              </fieldset>
            ) : (
              trip && (
                <section className="p06-sec" aria-labelledby="p06-people-title">
                  <h2 id="p06-people-title" className="p06-legend">
                    <StepLabel n={4}>People</StepLabel>
                  </h2>
                  <PeopleSummary trip={trip} />
                </section>
              )
            )}

            {isMobile && (
              <div className="p06-sec p06-mobile-preview">
                <p className="eyebrow">Preview</p>
                <TripPreview
                  variant="compact"
                  title={draft.title}
                  destinations={draft.destinations}
                  startDate={draft.startDate}
                  endDate={draft.endDate}
                  people={mode === 'edit' ? editPeople : previewPeople}
                  cover={cover}
                  today={todayIso}
                />
              </div>
            )}
          </fieldset>

          {/* Phones: a sticky Save bar at the bottom of the form. */}
          {isMobile && <div className="p06-actions">{actionButtons}</div>}
          <p className="sr-only" role="status" aria-live="polite">
            {saving ? (mode === 'create' ? 'Creating your trip' : 'Saving your changes') : announce}
          </p>
        </form>

        {!isMobile && (
          <aside className="p06-aside" aria-label="Trip preview">
            <TripPreview
              title={draft.title}
              destinations={draft.destinations}
              startDate={draft.startDate}
              endDate={draft.endDate}
              people={mode === 'edit' ? editPeople : previewPeople}
              cover={cover}
              today={todayIso}
              showNextSteps={mode === 'create'}
              peopleLabel={mode === 'edit' ? plural(editPeople.length, 'person', 'people') : undefined}
            >
              <div className="p06-aside-actions">{actionButtons}</div>
            </TripPreview>
          </aside>
        )}
      </div>
    </div>
  );
}

/** "①  Trip name": a step number before each section label. */
function StepLabel({ n, children }: { n: number; children: ReactNode }) {
  return (
    <>
      <span className="p06-step" aria-hidden>
        {n}
      </span>
      {children}
    </>
  );
}

/** The error for shortened/moved dates, listing which events would fall outside (edit mode). */
function OutsideEvents({ message, events, trip, willShift, delta }: { message: string; events: TripEvent[]; trip: Trip; willShift: boolean; delta: number }) {
  const shown = events.slice(0, 4);
  return (
    <div className="p06-outside" role="alert">
      <p className="field-error">
        <MapPinOff aria-hidden />
        <span>{message}</span>
      </p>
      <ul className="p06-outside-list">
        {shown.map((e) => {
          const date = willShift ? addDays(e.date, delta) : e.date;
          return (
            <li key={e.id}>
              <span className="p06-outside-name">{e.title ?? e.place.name}</span>
              <span className="p06-outside-day num">
                Day {dayNumber(trip, e.date)} · {formatShortDate(date)}
              </span>
            </li>
          );
        })}
        {events.length > shown.length && <li className="muted">and {plural(events.length - shown.length, 'more event')}</li>}
      </ul>
      <Button to={paths.itinerary(trip.id)} variant="ghost" size="sm">
        Open the itinerary
      </Button>
    </div>
  );
}

/** Edit mode: who's on the trip (read-only here; managed on Page 13). */
function PeopleSummary({ trip }: { trip: Trip }) {
  const state = useAppState();
  const people = tripPeople(state, trip);
  return (
    <div className="p06-edit-people">
      <ul className="p06-people" aria-label="People on this trip">
        {people.map(({ person, role, status, days }) => (
          <li key={person.id} className="p06-person">
            <Avatar person={person} size={36} />
            <span className="p06-person-text">
              <span className="p06-person-name">{person.name}</span>
              <span className="p06-person-sub">{status === 'pending' ? 'Invited, hasn’t joined yet' : person.email}</span>
            </span>
            <RoleBadge role={role} days={role === 'day' ? (days?.length ?? 0) : undefined} />
          </li>
        ))}
      </ul>
      <Button to={withQuery(paths.people(trip.id), { section: 'collaborators' })} variant="secondary" icon={<Users />}>
        Invite people or change permissions
      </Button>
    </div>
  );
}

/* ====================================================== locked & missing */

/** 6F: a read-only summary for anyone who can't edit (non-owners, past trips). */
function TripLocked({ ctx }: { ctx: TripContext }) {
  const { state, trip, access } = ctx;
  const owner = getPerson(state, trip.ownerId);
  const people = tripPeople(state, trip)
    .filter((p) => p.status === 'accepted')
    .map((p) => p.person);
  const days = daysBetween(trip.startDate, trip.endDate) + 1;
  return (
    <div className="container page p06">
      <PageHeader back={{ to: paths.itinerary(trip.id), label: 'Itinerary' }} title="Trip details" subtitle={trip.title} />
      <div className="p06-locked-layout">
        <div className="p06-locked">
          <Banner tone="locked" title={access.isPast ? 'Past trip' : 'Only the trip owner can edit this'}>
            {access.lockReason('editTrip')}
          </Banner>

          <article className="p06-summary-card">
            <div className="p06-summary-media">
              <PlacePhoto photo={trip.coverPhoto} destination={trip.destinations[0]} alt="" category="landmark" size="full" rounded={false} className="p06-summary-photo" />
            </div>
            <dl className="p06-facts">
              <div>
                <dt>Trip name</dt>
                <dd>{trip.title}</dd>
              </div>
              <div>
                <dt>Where</dt>
                <dd>{trip.destinations.map((d) => (d.country ? `${d.name}, ${d.country}` : d.name)).join(' · ')}</dd>
              </div>
              <div>
                <dt>When</dt>
                <dd className="num">
                  {formatDateRange(trip.startDate, trip.endDate)} · {plural(days, 'day')}
                </dd>
              </div>
              <div>
                <dt>Owner</dt>
                <dd className="row">
                  {owner && <Avatar person={owner} size={26} />}
                  <span>{owner?.name ?? 'Unknown'}</span>
                </dd>
              </div>
              <div>
                <dt>Your role</dt>
                <dd>
                  <RoleBadge role={access.role} />
                </dd>
              </div>
              <div>
                <dt>Going</dt>
                <dd className="row">
                  <AvatarStack people={people} size={26} max={6} />
                  <span>{plural(people.length, 'person', 'people')}</span>
                </dd>
              </div>
            </dl>
          </article>

          <div className="p06-locked-actions">
            <Button to={paths.itinerary(trip.id)}>Back to the itinerary</Button>
            <Button to={paths.people(trip.id)} variant="secondary" icon={<Users />}>
              See who’s going
            </Button>
          </div>
        </div>

        <aside className="p06-cando" aria-labelledby="p06-cando-title">
          <h2 id="p06-cando-title" className="p06-cando-title">
            What you can do
          </h2>
          {/* What this person's role still allows (see src/lib/permissions.ts). */}
          <ul className="p06-cando-list">
            <li>
              <Link to={paths.itinerary(trip.id)} className="p06-cando-link">
                <CalendarRange aria-hidden />
                <span>
                  <strong>See the day-by-day plan</strong>
                  <span>Every event, time, and place.</span>
                </span>
              </Link>
            </li>
            {access.canAddEvents && (
              <li>
                <Link to={paths.newEvent(trip.id)} className="p06-cando-link">
                  <CalendarPlus aria-hidden />
                  <span>
                    <strong>Add events</strong>
                    <span>{access.role === 'day' ? 'On the days you’re assigned.' : 'On any day of the trip.'}</span>
                  </span>
                </Link>
              </li>
            )}
            {!access.isPast && (
              <li>
                <Link to={withQuery(paths.survey(), { trip: trip.id, return: paths.itinerary(trip.id) })} className="p06-cando-link">
                  <SlidersHorizontal aria-hidden />
                  <span>
                    <strong>Share your preferences</strong>
                    <span>Food, interests, and anything the group should know.</span>
                  </span>
                </Link>
              </li>
            )}
            {access.canLogExpenses && (
              <li>
                <Link to={paths.budget(trip.id)} className="p06-cando-link">
                  <Wallet aria-hidden />
                  <span>
                    <strong>Log what you spend</strong>
                    <span>Add your own expenses and settle up.</span>
                  </span>
                </Link>
              </li>
            )}
          </ul>
        </aside>
      </div>
    </div>
  );
}

/** The trip id in the address doesn't exist, or you're not on that trip. */
function TripMissing() {
  return (
    <div className="container page p06">
      <EmptyState
        icon={<MapPinOff />}
        title="We couldn’t find that trip"
        actions={
          <Button to={paths.trips()} variant="primary">
            Go to My trips
          </Button>
        }
      >
        It may have been deleted, or you’re not on it.
      </EmptyState>
    </div>
  );
}
