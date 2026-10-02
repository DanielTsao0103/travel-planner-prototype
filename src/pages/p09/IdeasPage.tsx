/**
 * Page 9 — Ideas (suggestions).
 *
 * The doc: suggest things based on (1) the traveler's location during the trip
 * (simulated here; Google Maps would supply it in production), (2) where the
 * group is going each day, within the time already planned, and (3) "since you
 * planned … you might also like …". People choose whether to add an idea, and
 * pick its day and time.
 *
 * Every card shows why it fits: who it suits, the free gap it sits in, how far
 * it is from you, access facts, and any overlap with the plan (never silent).
 *
 * Sources:
 *  - The sample trip ships with hand-written ideas (bundled, always works).
 *  - Other trips (testers' own, e.g. Zion or Kyoto) get live ideas from
 *    OpenStreetMap, saved so they aren't refetched on every visit.
 *
 * Layouts: desktop = filter rail (left) + 2-column cards + side sheet for Add;
 * phones = sticky day chips, one column, bottom sheet.
 *
 * Query params read here:
 *   day=<YYYY-MM-DD>  preselect a day (from the itinerary's empty days)
 *   s=add | conflict | declined | empty | live-error  forced states (screen index)
 */

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowLeft, CalendarX2, CheckCheck, Clock, CloudOff, LocateFixed, LocateOff, MapPin, MapPinOff, RefreshCw, Sparkles, Users } from 'lucide-react';
import type { ISODate, Suggestion, Time } from '../../data/types';
import { Button } from '../../components/ui/Button';
import { Badge, Banner, DemoBadge, EmptyState, Loading, Skeleton } from '../../components/ui/Display';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import { useTrip, type TripContext } from '../../hooks/useTrip';
import { dayHeading, dayNumber, formatMMDD, timeToMin, weekdayLong, weekdayShort } from '../../lib/dates';
import { listJoin, plural } from '../../lib/format';
import { paths } from '../../router/routes';
import { declineSuggestion, undoSuggestionDecision } from '../../store/actions';
import { decisionFor, freeGaps, now, personFirstName, phaseOf, simulatedLocation, tripDays, tripEvents, tripSuggestions, type SimLocation } from '../../store/selectors';
import { getState } from '../../store/store';
import { toast } from '../../store/toast';
import { AddToTripSheet } from './AddToTripSheet';
import { AddedList, DeclinedList } from './DecidedLists';
import { useDistancesFromYou } from './hooks';
import { addedEventFor, costLabel, fitChips, groupSurveys, slotHasPassed, slotLabel, type FitContext } from './ideas';
import { DayFilterChips, DayFilterRail, FreeTimePanel, FreeTimeStrip, type DayOption } from './IdeasFilters';
import { useLiveIdeas } from './liveIdeas';
import { SuggestionCard } from './SuggestionCard';
import './p09.css';

export function IdeasPage({ tripId, query }: { tripId: string; query: URLSearchParams }) {
  const ctx = useTrip(tripId);
  if (!ctx) {
    return (
      <div className="container page">
        <EmptyState
          icon={<MapPinOff />}
          title="Trip not found"
          actions={
            <Button to={paths.trips()} variant="primary">
              Go to My trips
            </Button>
          }
        >
          This trip doesn’t exist, or you’re not a member of it. Open one of your trips instead.
        </EmptyState>
      </div>
    );
  }
  // key: switching trips (trip switcher) resets the day filter, open sheet, etc.
  return <Ideas key={ctx.trip.id} ctx={ctx} query={query} />;
}

/** "near Time Out Market", "at Jerónimos Monastery", "in Springdale". */
function locationPhrase(here: SimLocation): string {
  if (here.basis === 'just-left') return `near ${here.label.replace(/^Near /, '')}`;
  if (here.basis === 'at-event' || here.basis === 'lodging') return `at ${here.label}`;
  return here.label.startsWith('On the way') ? here.label.charAt(0).toLowerCase() + here.label.slice(1) : `in ${here.label}`;
}

/** Sort by day, then start time. */
const byDayAndTime = (a: Suggestion, b: Suggestion) => a.date.localeCompare(b.date) || timeToMin(a.start) - timeToMin(b.start);

function Ideas({ ctx, query }: { ctx: TripContext; query: URLSearchParams }) {
  const { state, trip, access } = ctx;
  const bp = useBreakpoint();
  const isDesktop = bp === 'desktop';
  const isMobile = bp === 'mobile';
  const forced = query.get('s');

  const phase = phaseOf(state, trip);
  const isActive = phase === 'active';
  const isPast = phase === 'past';
  const clock = now(state);
  const todayIso = clock.date;
  const nowMin = timeToMin(clock.time);
  const days = tripDays(trip);
  const ownerName = personFirstName(state, trip.ownerId);

  /* --------------------------------------------------------------- data */

  // By day and time, but during the trip an idea whose time already passed goes to the end of its day.
  const passed = (s: Suggestion) => slotHasPassed(s, todayIso, clock.time, isActive);
  const all = [...tripSuggestions(state, trip.id)].sort((a, b) => a.date.localeCompare(b.date) || Number(passed(a)) - Number(passed(b)) || byDayAndTime(a, b));
  const isLive = !all.some((s) => s.source === 'bundled');
  const savedLive = all.filter((s) => s.source === 'osm');
  const live = useLiveIdeas(trip.id, isLive && !isPast, savedLive.length > 0, forced === 'live-error');

  // Day filter: ?day=<date> preselects (e.g. "See ideas for this day" on the itinerary).
  const queryDay = query.get('day');
  const [day, setDay] = useState<string>(() => (queryDay && days.includes(queryDay) ? queryDay : 'all'));
  useEffect(() => {
    if (queryDay && days.includes(queryDay)) setDay(queryDay);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryDay]);

  const [sheetId, setSheetId] = useState<string | null>(null);
  // Ideas added during this visit stay in place (showing "Added to Day 2") until you leave.
  const [sessionAdded, setSessionAdded] = useState<Record<string, { date: ISODate; start: Time }>>({});
  const [showDeclined, setShowDeclined] = useState(forced === 'declined');
  const [showAdded, setShowAdded] = useState(false);

  // Forced states from the screen index, applied once.
  const applied = useRef(false);
  useEffect(() => {
    if (applied.current) return;
    applied.current = true;
    const exists = (id: string) => tripSuggestions(getState(), trip.id).some((x) => x.id === id);
    if ((forced === 'add' || forced === 'conflict') && access.canAddEvents) {
      const id = `${trip.id}-${forced === 'add' ? 's1' : 's3'}`;
      if (exists(id)) setSheetId(id);
    }
    if (forced === 'declined') {
      for (const k of ['s4', 's5']) {
        const id = `${trip.id}-${k}`;
        if (exists(id) && !decisionFor(getState(), trip.id, id)) declineSuggestion(trip.id, id);
      }
      // Bring the expanded "Not interested" list into view (it sits below all the cards).
      window.setTimeout(() => document.getElementById('p09-declined')?.scrollIntoView({ block: 'center' }), 350);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const decision = (s: Suggestion) => decisionFor(state, trip.id, s.id);
  const undecided = all.filter((s) => !decision(s));
  const declined = all.filter((s) => decision(s)?.status === 'declined');
  const addedEarlier = all.filter((s) => decision(s)?.status === 'added' && !sessionAdded[s.id]);
  // The grid: undecided ideas plus the ones just added on this visit.
  const inGrid = all.filter((s) => !decision(s) || sessionAdded[s.id]);
  const forcedEmpty = forced === 'empty';
  const visible = forcedEmpty ? [] : inGrid.filter((s) => day === 'all' || s.date === day);
  // What the filters count (the forced "all reviewed" state counts nothing, to stay consistent).
  const toReview = forcedEmpty ? [] : undecided;

  const surveys = groupSurveys(state, trip);
  const here = isActive ? simulatedLocation(state, trip) : null;
  const { walk, meters } = useDistancesFromYou(
    here,
    inGrid.filter((s) => s.date === todayIso).map((s) => s.place),
  );
  const fitCtx: FitContext = {
    state,
    trip,
    todayIso,
    isActive,
    needsStepFree: surveys.some((x) => x.stepFreeNeeded || x.mobility !== 'none'),
    walkFromYou: walk,
    metersFromYou: meters,
  };

  const dayOptions: DayOption[] = days.map((d) => ({ date: d, count: toReview.filter((s) => s.date === d).length, isToday: isActive && d === todayIso }));
  const selectedDate = day === 'all' ? null : day;
  const gaps = selectedDate ? freeGaps(state, trip.id, selectedDate) : [];
  const gapNow = selectedDate && isActive && selectedDate === todayIso ? nowMin : undefined;
  const mostOpen = days
    .map((d) => ({ date: d, minutes: freeGaps(state, trip.id, d).reduce((sum, g) => sum + g.minutes, 0) }))
    .filter((x) => !isActive || x.date >= todayIso)
    .sort((a, b) => b.minutes - a.minutes)[0];

  const sheetSuggestion = sheetId ? all.find((s) => s.id === sheetId) : undefined;
  const addLocked = access.canAddEvents ? false : access.lockReason('editEvents');

  /* ------------------------------------------------------------ actions */

  const decline = (s: Suggestion) => {
    declineSuggestion(trip.id, s.id);
    toast({ title: 'Moved to Not interested', body: s.place.name, tone: 'info', action: { label: 'Undo', onClick: () => undoSuggestionDecision(trip.id, s.id) } });
  };

  /* ------------------------------------------------------------- pieces */

  const plannedPlaces = new Set(tripEvents(state, trip.id).map((e) => e.place.id)).size;
  const dest = trip.destinations[0]?.name ?? 'your destination';

  const header = (
    <header className="p09-head">
      <div className="p09-head-text">
        <h1 className="p09-title">Ideas for {trip.title}</h1>
        {isDesktop || bp === 'tablet' ? (
          <BasedOnBar here={here} plannedPlaces={plannedPlaces} travelers={surveys.length} dest={dest} isActive={isActive} />
        ) : (
          <p className="p09-basis-sentence">
            <Sparkles aria-hidden />
            <span>
              Based on{' '}
              {listJoin([
                ...(here ? [`your location (simulated, ${locationPhrase(here)})`] : []),
                plannedPlaces ? plural(plannedPlaces, 'planned place') : `places near ${dest}`,
                'free time each day',
                surveys.length ? `the interests of ${plural(surveys.length, 'traveler')}` : 'your group’s interests',
              ])}
              .{!isActive && ' Your location is used during the trip.'}
            </span>
          </p>
        )}
      </div>
      {isLive && !isPast && (live.status === 'ready' || live.status === 'loading' || (live.status === 'error' && savedLive.length > 0)) && (
        <div className="p09-head-actions">
          <Button variant="secondary" icon={<RefreshCw />} onClick={live.run} loading={live.status === 'loading'} size={isMobile ? 'sm' : 'md'}>
            Refresh ideas
          </Button>
        </div>
      )}
    </header>
  );

  const [lockTitle, lockText] = splitFirstSentence(access.lockReason('editEvents'));
  const banners = !isPast && (
    <>
      {access.role === 'viewer' && (
        <Banner tone="locked" title={lockTitle}>
          {lockText} You can still hide ideas you’re not interested in.
        </Banner>
      )}
      {access.role === 'day' && (
        <Banner tone="info" title={`You can add ideas to ${listJoin(access.editableDays.map((d) => `Day ${dayNumber(trip, d)} (${weekdayShort(d)}, ${formatMMDD(d)})`))}.`}>
          Other days are view-only for you. Ask {ownerName} if you need more.
        </Banner>
      )}
    </>
  );

  /* -------------------------------------------------------------- body */

  let results: ReactNode;
  if (isPast) {
    results = (
      <EmptyState
        icon={<CalendarX2 />}
        title="This trip has ended"
        actions={
          <Button to={paths.itinerary(trip.id)} variant="secondary" icon={<ArrowLeft />}>
            Back to the itinerary
          </Button>
        }
      >
        Ideas are for trips that are coming up or happening now.
      </EmptyState>
    );
  } else if (isLive && live.status === 'error' && (forced === 'live-error' || savedLive.length === 0)) {
    results = (
      <EmptyState
        icon={<CloudOff />}
        title="Couldn’t load ideas right now."
        actions={
          <>
            <Button icon={<RefreshCw />} onClick={live.run}>
              Retry
            </Button>
            {access.canAddEvents && (
              <Button variant="secondary" to={paths.newEvent(trip.id)}>
                Add an event yourself
              </Button>
            )}
          </>
        }
      >
        The free map service didn’t answer. Check your connection and try again. Your trip hasn’t changed.
      </EmptyState>
    );
  } else if (isLive && live.status === 'loading' && savedLive.length === 0) {
    results = <IdeasSkeleton dest={dest} columns={isMobile ? 1 : 2} />;
  } else if (all.length === 0) {
    results = (
      <EmptyState
        icon={<MapPin />}
        title={`No ideas found near ${dest} yet`}
        actions={
          <>
            {access.canAddEvents && (
              <Button to={paths.newEvent(trip.id)} variant="primary">
                Add an event
              </Button>
            )}
            {isLive && (
              <Button variant="secondary" icon={<RefreshCw />} onClick={live.run}>
                Refresh ideas
              </Button>
            )}
          </>
        }
      >
        OpenStreetMap didn’t list named sights or food spots close by. Add an event and we’ll look around it.
      </EmptyState>
    );
  } else if (forcedEmpty || (undecided.length === 0 && Object.keys(sessionAdded).length === 0)) {
    results = (
      <EmptyState
        icon={<CheckCheck />}
        title="You’re all caught up"
        actions={
          <>
            <Button to={paths.itinerary(trip.id)} variant="secondary">
              See the itinerary
            </Button>
            {isLive && (
              <Button variant="ghost" icon={<RefreshCw />} onClick={live.run}>
                Refresh ideas
              </Button>
            )}
          </>
        }
      >
        You’ve reviewed every idea for this trip. Anything you added is on the itinerary, and ideas you skipped are under Not interested.
      </EmptyState>
    );
  } else if (visible.length === 0 && selectedDate) {
    results = (
      <EmptyState
        compact
        icon={<Sparkles />}
        title={`No open ideas for Day ${dayNumber(trip, selectedDate)}`}
        actions={
          <Button variant="secondary" onClick={() => setDay('all')}>
            See all days
          </Button>
        }
      >
        {gaps.length ? 'You still have free time that day. Ideas for other days might fit too.' : `Day ${dayNumber(trip, selectedDate)} is fully booked.`}
      </EmptyState>
    );
  } else {
    // Group the visible ideas by day.
    const groups = new Map<ISODate, Suggestion[]>();
    for (const s of visible) groups.set(s.date, [...(groups.get(s.date) ?? []), s]);
    results = (
      <div className="p09-groups">
        {isLive && live.status === 'error' && (
          <Banner tone="warning" title="Couldn’t refresh ideas." action={<Button size="sm" variant="secondary" onClick={live.run}>Retry</Button>}>
            These are the ideas we found last time.
          </Banner>
        )}
        {[...groups.entries()].map(([date, list]) => (
          <section key={date} className="p09-group" aria-labelledby={`p09-group-${date}`}>
            <div className="p09-group-head">
              <h2 className="p09-group-title num" id={`p09-group-${date}`}>
                {dayHeading(trip, date)}
              </h2>
              <span className="p09-group-sub">
                {weekdayLong(date)}
                {isActive && date === todayIso && <Badge tone="accent">Today</Badge>}
              </span>
              <span className="p09-group-count">{plural(list.filter((s) => !sessionAdded[s.id]).length, 'idea')}</span>
            </div>
            <div className={`p09-grid ${isMobile ? 'is-single' : ''}`}>
              {list.map((s) => (
                <SuggestionCard
                  key={s.id}
                  suggestion={s}
                  trip={trip}
                  fits={fitChips(s, fitCtx)}
                  slot={slotLabel(trip, s)}
                  isToday={isActive && s.date === todayIso}
                  passed={passed(s)}
                  cost={costLabel(s.estCostPerPerson)}
                  layout={isMobile ? 'compact' : 'photo'}
                  addLocked={addLocked}
                  added={sessionAdded[s.id]}
                  onAdd={() => setSheetId(s.id)}
                  onDecline={() => decline(s)}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    );
  }

  // "12 ideas to review" above the cards (only when cards are showing).
  const openCount = toReview.filter((s) => day === 'all' || s.date === day).length;
  const resultsHead = !isPast && visible.length > 0 && (
    <div className="p09-results-head">
      <p className="p09-results-count">
        {openCount ? `${plural(openCount, 'idea')} to review` : 'Nothing left to review'}
        {selectedDate ? ` for Day ${dayNumber(trip, selectedDate)}` : ''}
      </p>
      {isLive && <span className="p09-source">Places from OpenStreetMap and Wikipedia</span>}
    </div>
  );

  const decidedLists = !isPast && (
    <div className="p09-decided-wrap">
      <DeclinedList trip={trip} items={declined} open={showDeclined} onToggle={() => setShowDeclined((v) => !v)} onUndo={(s) => undoSuggestionDecision(trip.id, s.id)} />
      <AddedList trip={trip} items={addedEarlier} eventFor={(s) => addedEventFor(state, s)} open={showAdded} onToggle={() => setShowAdded((v) => !v)} />
    </div>
  );

  const sheet = sheetSuggestion && (
    <AddToTripSheet
      key={sheetSuggestion.id}
      suggestion={sheetSuggestion}
      state={state}
      trip={trip}
      access={access}
      todayIso={todayIso}
      nowTime={clock.time}
      isActive={isActive}
      onClose={() => setSheetId(null)}
      onAdded={(s, date, start) => setSessionAdded((prev) => ({ ...prev, [s.id]: { date, start } }))}
    />
  );

  /* ------------------------------------------------------------- layout */

  if (isDesktop) {
    return (
      <div className="container page p09-page is-desktop">
        {header}
        {banners}
        <div className="p09-layout">
          {!isPast && (
            <aside className="p09-rail" aria-label="Filters">
              <DayFilterRail trip={trip} options={dayOptions} totalCount={toReview.length} value={day} onChange={setDay} />
              <FreeTimePanel trip={trip} date={selectedDate} gaps={gaps} nowMin={gapNow} mostOpen={mostOpen} />
            </aside>
          )}
          <div className="p09-results">
            {resultsHead}
            {results}
            {decidedLists}
          </div>
        </div>
        {sheet}
      </div>
    );
  }

  return (
    <div className="container page p09-page">
      {header}
      {banners}
      {!isPast && <DayFilterChips trip={trip} options={dayOptions} totalCount={toReview.length} value={day} onChange={setDay} />}
      {selectedDate && !isPast && <FreeTimeStrip trip={trip} date={selectedDate} gaps={gaps} nowMin={gapNow} />}
      <div className="p09-results">
        {resultsHead}
        {results}
        {decidedLists}
      </div>
      {sheet}
    </div>
  );
}

/** Split "First sentence. The rest." so a banner can bold the first part. */
function splitFirstSentence(text: string): [string, string] {
  const i = text.indexOf('. ');
  return i === -1 ? [text, ''] : [text.slice(0, i + 1), text.slice(i + 2)];
}

/**
 * Desktop/tablet "Based on" bar: the four inputs behind the ideas, so testers
 * can see the suggestions aren't random.
 */
function BasedOnBar({ here, plannedPlaces, travelers, dest, isActive }: { here: SimLocation | null; plannedPlaces: number; travelers: number; dest: string; isActive: boolean }) {
  return (
    <div className="p09-basis">
      <span className="p09-basis-label">Based on</span>
      <ul className="p09-basis-list">
        {here ? (
          <li className="p09-basis-item">
            <LocateFixed aria-hidden />
            <span>
              Your location <span className="p09-basis-detail">{locationPhrase(here)}</span>
            </span>
            <DemoBadge>Simulated</DemoBadge>
          </li>
        ) : (
          <li className="p09-basis-item is-off">
            <LocateOff aria-hidden />
            <span>{isActive ? 'Your location isn’t available' : 'Your location is used during the trip.'}</span>
          </li>
        )}
        <li className="p09-basis-item">
          <MapPin aria-hidden />
          <span>{plannedPlaces ? plural(plannedPlaces, 'planned place') : `Places near ${dest}`}</span>
        </li>
        <li className="p09-basis-item">
          <Clock aria-hidden />
          <span>Free time each day</span>
        </li>
        <li className="p09-basis-item">
          <Users aria-hidden />
          <span>{travelers ? `Interests of ${plural(travelers, 'traveler')}` : 'Your group’s interests'}</span>
        </li>
      </ul>
    </div>
  );
}

/** Placeholder cards while live ideas load. */
function IdeasSkeleton({ dest, columns }: { dest: string; columns: 1 | 2 }) {
  return (
    <Loading label={`Finding places near ${dest}`}>
      <p className="p09-loading-line">
        <RefreshCw className="spin" aria-hidden /> Finding places near {dest} on OpenStreetMap…
      </p>
      <div className={`p09-grid ${columns === 1 ? 'is-single' : ''}`}>
        {Array.from({ length: columns === 1 ? 3 : 4 }, (_, i) => (
          <div key={i} className={`p09-card p09-skel ${columns === 1 ? 'is-compact' : 'is-photo'}`} aria-hidden>
            {columns === 2 && <Skeleton height="auto" radius={0} className="p09-skel-media" />}
            <div className="p09-card-body">
              <div className="p09-card-top">
                {columns === 1 && <Skeleton width={88} height={88} radius={10} />}
                <div className="stack-sm grow">
                  <Skeleton width="62%" height={18} radius={6} />
                  <Skeleton width="40%" height={13} radius={6} />
                </div>
              </div>
              <Skeleton height={13} radius={6} />
              <Skeleton width="80%" height={13} radius={6} />
              <div className="cluster">
                <Skeleton width={120} height={26} radius={999} />
                <Skeleton width={96} height={26} radius={999} />
              </div>
              <div className="cluster">
                <Skeleton width={128} height={44} radius={10} />
                <Skeleton width={128} height={44} radius={10} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </Loading>
  );
}
