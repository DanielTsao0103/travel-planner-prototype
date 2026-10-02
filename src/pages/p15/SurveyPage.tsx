/**
 * Page 15 — Preferences survey.
 *
 * Gathers each traveler's diet, dining style, interests, and accessibility
 * needs. Page 13's group tiles are built entirely from these answers, so
 * saving here immediately changes what the whole group sees there.
 *
 * The survey always belongs to the SIGNED-IN person (`currentPerson`), never
 * to the prototype's "View as" stand-in: you can't fill in someone else's.
 *
 * Query params:
 *   step=1–5        which step is showing (default 1)
 *   trip=<tripId>   the trip the person came from (sets where Save goes)
 *   return=<path>   where Save / Back go (e.g. the trip's People page)
 *   s=errors        show the current step's validation errors right away (15F)
 *
 * Layouts: desktop = stepper | form | live preview; phone = one step per
 * screen with a progress bar and a sticky Back / Next bar.
 */

import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, ChevronLeft, Eye, X } from 'lucide-react';
import type { Person } from '../../data/types';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import { formatMonthDay } from '../../lib/dates';
import { navigate, Link, withQuery } from '../../router/router';
import { matchRoute, paths, type RouteName } from '../../router/routes';
import { simulateLatency } from '../../services/http';
import { saveSurvey } from '../../store/actions';
import { currentPerson, getTrip, myTrips } from '../../store/selectors';
import { useAppState } from '../../store/store';
import { toast } from '../../store/toast';
import { PageHeader } from '../../components/layout/PageHeader';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Display';
import { draftFromSurvey, draftToResponse, firstIncompleteStep, hasErrors, validateStep, type SurveyDraft } from './draft';
import { GroupPreview } from './GroupPreview';
import { StepAccess, StepDining, StepFood, StepInterests, StepReview } from './steps';
import { dietEntriesFor, LOCAL_SCALE, normalizeInterests, spendOption, STEPS, walkLabel, type StepNumber } from './vocab';
import './p15.css';

const TITLE_NEW = 'Tell your group what works for you';
const TITLE_EDIT = 'Update your preferences';
const SUBTITLE = 'Takes about 2 minutes. Your answers are shared with people on your trips to help plan meals and stops.';

/** Read `?step=` safely (anything odd becomes step 1). */
function parseStep(raw: string | null): StepNumber {
  const n = Number(raw);
  return n >= 1 && n <= 5 && Number.isInteger(n) ? (n as StepNumber) : 1;
}

/** Only accept in-app paths for `?return=` (never another site). */
function safeReturnPath(raw: string | null): string | null {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//')) return null;
  return raw;
}

/** A friendly name for the page a `return` path points at ("Back to Group & permissions"). */
function backLabelFor(path: string): string {
  const labels: Partial<Record<RouteName, string>> = {
    people: 'Group & permissions',
    trips: 'My trips',
    home: 'Home',
    itinerary: 'Itinerary',
    dashboard: 'Trip dashboard',
    'trip-new': 'Trip details',
    'trip-edit': 'Trip details',
  };
  return labels[matchRoute(path.split('?')[0]).name] ?? 'Back';
}

/** True when the person asked their device for less motion. */
function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Page 15 entry point: the survey always belongs to the signed-in person. */
export function SurveyPage({ query }: { query: URLSearchParams }) {
  const state = useAppState();
  const me = currentPerson(state);
  if (!me) return null; // App.tsx sends signed-out visitors to Page 1 first.
  // `key` restarts the form if a different person signs in (e.g. the auth=new demo link).
  return <SurveyFlow key={me.id} me={me} query={query} />;
}

/** The survey itself: draft answers, steps, validation, saving, and both layouts. */
function SurveyFlow({ me, query }: { me: Person; query: URLSearchParams }) {
  const state = useAppState();
  const bp = useBreakpoint();
  const saved = state.surveys[me.id];
  // Decide "new vs. editing" once, so the title doesn't flip the moment we save.
  const [wasEditing] = useState(() => !!saved);
  const [draft, setDraft] = useState<SurveyDraft>(() => draftFromSurvey(saved));
  const step = parseStep(query.get('step'));
  const tripId = query.get('trip') ?? undefined;
  const trip = getTrip(state, tripId);
  const returnRaw = query.get('return');
  const returnTo = safeReturnPath(returnRaw);
  // Editing a saved survey: every step already has answers, so all of them are reachable.
  const [maxVisited, setMaxVisited] = useState<StepNumber>(() => (saved ? 5 : step));
  // Steps whose errors are visible (after a failed "Next", or ?s=errors).
  const [errorSteps, setErrorSteps] = useState<StepNumber[]>(() => (query.get('s') === 'errors' ? [step] : []));
  const [saving, setSaving] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const firstRender = useRef(true);
  const sParam = query.get('s');

  const back = returnTo
    ? { to: returnTo, label: backLabelFor(returnTo) }
    : trip
      ? { to: paths.people(trip.id), label: 'Group & permissions' }
      : { to: paths.home(), label: 'Home' };

  // Remember the furthest step reached (the desktop stepper lets you jump back to any of them).
  useEffect(() => {
    setMaxVisited((m) => (step > m ? step : m));
  }, [step]);

  // ?s=errors can also arrive while the page is open (screen-index link).
  useEffect(() => {
    if (sParam === 'errors') setErrorSteps((prev) => (prev.includes(step) ? prev : [...prev, step]));
  }, [sParam, step]);

  // New step: start at the top and move focus to its heading (helps screen-reader users).
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    window.scrollTo({ top: 0 });
    headingRef.current?.focus({ preventScroll: true });
  }, [step]);

  const patch = (changes: Partial<SurveyDraft>) => setDraft((d) => ({ ...d, ...changes }));
  const errors = errorSteps.includes(step) ? validateStep(draft, step) : {};

  const goTo = (n: StepNumber) => {
    navigate(withQuery(paths.survey(), { step: n, trip: tripId, return: returnRaw }));
  };

  /** After a failed "Next", bring the first error into view and focus its control. */
  const revealFirstError = () => {
    window.setTimeout(() => {
      const alert = document.querySelector<HTMLElement>('.p15-step-body [role="alert"]');
      if (!alert) return;
      alert.scrollIntoView({ block: 'center', behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
      const scope = alert.closest('.p15-question, .p15-fieldset') ?? alert.closest('.p15-step-body');
      scope?.querySelector<HTMLElement>('[role="radio"][tabindex="0"], input, button')?.focus({ preventScroll: true });
    }, 40);
  };

  const next = () => {
    if (hasErrors(validateStep(draft, step))) {
      setErrorSteps((prev) => (prev.includes(step) ? prev : [...prev, step]));
      revealFirstError();
      return;
    }
    if (step < 5) goTo((step + 1) as StepNumber);
  };

  const prev = () => {
    if (step > 1) goTo((step - 1) as StepNumber);
  };

  /** Where Save takes you: the `return` page, else the trip's People page, else Home. */
  const destination = (): string => {
    if (returnTo) {
      // Returning to a People page? Open it in its "saved" state (15G) so the change is visible.
      const route = matchRoute(returnTo.split('?')[0]);
      if (route.name === 'people') return withQuery(paths.people(route.params.tripId), { s: 'saved' });
      return returnTo;
    }
    if (trip) return withQuery(paths.people(trip.id), { s: 'saved' });
    return paths.home();
  };

  const save = async () => {
    const incomplete = firstIncompleteStep(draft);
    if (incomplete) {
      setErrorSteps((prev) => (prev.includes(incomplete) ? prev : [...prev, incomplete]));
      goTo(incomplete);
      toast({ title: 'One more answer needed', body: `Step ${incomplete} has a required question.`, tone: 'warning' });
      return;
    }
    setSaving(true);
    await simulateLatency(450);
    saveSurvey(draftToResponse(draft, me.id));
    toast({
      title: wasEditing ? 'Preferences updated' : 'Preferences saved',
      body: trip ? `Everyone on ${trip.title} sees your answers now.` : 'Everyone on your trips sees your answers now.',
    });
    navigate(destination());
  };

  const stepMeta = STEPS[step - 1];
  const title = wasEditing ? TITLE_EDIT : TITLE_NEW;
  const lastSaved = saved ? formatMonthDay(saved.updatedAt.slice(0, 10)) : null;

  const body =
    step === 1 ? (
      <StepFood draft={draft} patch={patch} errors={errors} />
    ) : step === 2 ? (
      <StepDining draft={draft} patch={patch} errors={errors} />
    ) : step === 3 ? (
      <StepInterests draft={draft} patch={patch} errors={errors} />
    ) : step === 4 ? (
      <StepAccess draft={draft} patch={patch} errors={errors} />
    ) : (
      <StepReview draft={draft} person={me} onEdit={goTo} showPreview />
    );

  const primary =
    step < 5 ? (
      <Button iconRight={<ArrowRight />} onClick={next} className="p15-next">
        {bp === 'desktop' ? `Next: ${STEPS[step].short}` : 'Next'}
      </Button>
    ) : (
      <Button icon={<Check />} loading={saving} onClick={save} className="p15-next">
        Save preferences
      </Button>
    );

  const secondary =
    step > 1 ? (
      <Button variant="secondary" icon={<ArrowLeft />} onClick={prev}>
        Back
      </Button>
    ) : (
      <Button variant="ghost" icon={<X />} to={back.to}>
        Cancel
      </Button>
    );

  /* ---------------------------------------------------------- desktop */
  if (bp === 'desktop') {
    return (
      <div className="container page p15-page">
        <PageHeader back={{ to: back.to, label: back.label }} title={title} subtitle={SUBTITLE}>
          {lastSaved && <p className="p15-last-saved">Last saved {lastSaved}</p>}
        </PageHeader>
        <div className="p15-desk">
          <Stepper draft={draft} step={step} maxVisited={maxVisited} errorSteps={errorSteps} onGo={goTo} />
          <section className="p15-card p15-step" aria-labelledby="p15-step-title">
            <div className="p15-card-head">
              <span className="eyebrow">
                Step {step} of 5
              </span>
              <h2 id="p15-step-title" ref={headingRef} tabIndex={-1} className="p15-step-title">
                {stepMeta.title}
              </h2>
              <p className="muted">{stepMeta.description}</p>
            </div>
            {body}
            <div className="p15-card-foot">
              {secondary}
              {primary}
            </div>
          </section>
          <aside className="p15-aside">
            {step < 5 ? <PreviewCard draft={draft} me={me} step={step} tripTitle={trip?.title} /> : <SharedWithCard />}
          </aside>
        </div>
      </div>
    );
  }

  /* ---------------------------------------------------- phone / tablet */
  return (
    <div className="container page p15-page p15-page-compact">
      <div className="p15-compact">
        <Link to={back.to} className="back-link">
          <ChevronLeft aria-hidden />
          {back.label}
        </Link>
        {step === 1 && (
          <div className="p15-intro">
            <h1>{title}</h1>
            <p className="muted">{SUBTITLE}</p>
            {lastSaved && <p className="p15-last-saved">Last saved {lastSaved}</p>}
          </div>
        )}
        <div className="p15-progress">
          <div className="row-between">
            <span className="p15-progress-label num">
              Step {step} of 5
            </span>
            <span className="p15-progress-next small muted">{step < 5 ? `Next: ${STEPS[step].short}` : 'Last step'}</span>
          </div>
          <div className="p15-progress-bar" role="progressbar" aria-label="Survey progress" aria-valuemin={1} aria-valuemax={5} aria-valuenow={step} aria-valuetext={`Step ${step} of 5: ${stepMeta.short}`}>
            {STEPS.map((s) => (
              <span key={s.n} className={s.n <= step ? 'is-done' : ''} />
            ))}
          </div>
        </div>
        <section className="p15-step" aria-labelledby="p15-step-title">
          <div className="p15-step-head">
            {step === 1 ? (
              <h2 id="p15-step-title" ref={headingRef} tabIndex={-1} className="p15-step-title">
                {stepMeta.title}
              </h2>
            ) : (
              <h1 id="p15-step-title" ref={headingRef} tabIndex={-1} className="p15-step-title">
                {stepMeta.title}
              </h1>
            )}
            <p className="muted">{stepMeta.description}</p>
          </div>
          {body}
        </section>
      </div>
      <div className="p15-bar">
        <div className="p15-bar-inner">
          {secondary}
          {primary}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ stepper */

/** A one-line, live summary of a step's answers for the desktop stepper. */
function stepSummary(draft: SurveyDraft, n: StepNumber): string {
  switch (n) {
    case 1: {
      if (draft.noRestrictions) return 'No restrictions';
      const labels = dietEntriesFor(draft).map((e) => e.label);
      return labels.length ? labels.join(', ') : 'Not answered yet';
    }
    case 2:
      return `${LOCAL_SCALE.labels[draft.localVsFamiliar]} · ${spendOption(draft.mealBudget).symbol}`;
    case 3: {
      const count = normalizeInterests(draft.interests).length;
      return count ? `${count} picked` : 'Optional';
    }
    case 4: {
      const missing = (draft.maxWalkMinutes === undefined ? 1 : 0) + (draft.tickets ? 0 : 1);
      if (missing) return `${missing} required answer${missing === 1 ? '' : 's'} left`;
      return `Walks: ${walkLabel(draft.maxWalkMinutes ?? null).toLowerCase()}`;
    }
    default:
      return 'Check and save';
  }
}

/** Desktop vertical stepper. Steps you've reached are clickable; later ones stay locked. */
function Stepper({ draft, step, maxVisited, errorSteps, onGo }: { draft: SurveyDraft; step: StepNumber; maxVisited: StepNumber; errorSteps: StepNumber[]; onGo: (n: StepNumber) => void }) {
  return (
    <nav className="p15-stepper" aria-label="Survey steps">
      <ol>
        {STEPS.map((s) => {
          const current = s.n === step;
          const reachable = s.n <= maxVisited;
          const showsError = errorSteps.includes(s.n) && hasErrors(validateStep(draft, s.n));
          const done = reachable && !current && s.n < 5 && !hasErrors(validateStep(draft, s.n));
          return (
            <li key={s.n}>
              <button
                type="button"
                className={`p15-stepper-item ${current ? 'is-current' : ''} ${done ? 'is-done' : ''} ${showsError ? 'is-error' : ''}`}
                aria-current={current ? 'step' : undefined}
                disabled={!reachable}
                onClick={() => onGo(s.n)}
              >
                <span className="p15-stepper-num num" aria-hidden>
                  {done ? <Check /> : s.n}
                </span>
                <span className="p15-stepper-text">
                  <span className="p15-stepper-label">{s.short}</span>
                  <span className="p15-stepper-sub">{reachable ? (showsError ? 'Needs an answer' : stepSummary(draft, s.n)) : 'Not started'}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/* ------------------------------------------------------- aside cards */

function PreviewCard({ draft, me, step, tripTitle }: { draft: SurveyDraft; me: Person; step: StepNumber; tripTitle?: string }) {
  return (
    <div className="p15-aside-card" aria-labelledby="p15-preview-title">
      <span className="eyebrow">Live preview</span>
      <h2 id="p15-preview-title" className="p15-aside-title">
        How this shows up for your group
      </h2>
      <p className="p15-hint">{tripTitle ? `Your answers join the group’s on ${tripTitle}.` : 'Your answers join everyone else’s on each trip’s People page.'}</p>
      <GroupPreview draft={draft} person={me} activeStep={step} />
      <p className="p15-privacy">
        <Eye aria-hidden />
        Visible to everyone on your trips.
      </p>
    </div>
  );
}

/** Step 5's side card: which trips (and how many people) will see these answers. */
function SharedWithCard() {
  const state = useAppState();
  const trips = myTrips(state);
  return (
    <div className="p15-aside-card" aria-labelledby="p15-shared-title">
      <span className="eyebrow">Privacy</span>
      <h2 id="p15-shared-title" className="p15-aside-title">
        Who sees your answers
      </h2>
      <p className="p15-hint">Everyone on these trips. One set of answers covers all of them.</p>
      {trips.length > 0 ? (
        <ul className="p15-shared-list">
          {trips.map((t) => {
            const people = t.members.filter((m) => m.status === 'accepted').length;
            return (
              <li key={t.id}>
                <span className="p15-shared-name truncate">{t.title}</span>
                <Badge tone="neutral">{people === 1 ? 'Just you' : `${people} people`}</Badge>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="small muted">You’re not on any trips yet. Your answers will be shared once you join one.</p>
      )}
      <p className="p15-privacy">
        <Eye aria-hidden />
        Diet and accessibility answers can be sensitive. Only share what you’re comfortable with.
      </p>
    </div>
  );
}
