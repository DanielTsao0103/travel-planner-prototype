/**
 * Page 8 — Day-by-day itinerary.
 *
 * The doc asks for a plain list, not a calendar:
 *   "Day 1 - MM/DD (enter) pic location @ hh:mm (enter) Day 2 - MM/DD …"
 * So every day is a section headed exactly "Day 1 — 10/15" (dayHeading), and
 * its events are listed in time order with the place's photo, name, and
 * "@ 9:30 AM" (EventItem). Empty days stay in the list with a quiet prompt.
 *
 * Layouts:
 *  - Desktop (≥1100px): list column + right rail (jump to day, who's going,
 *    budget, ideas). "Jump to day" stays pinned while the list scrolls.
 *  - Phones/tablets: sticky day chips under the header; phones also get a
 *    floating "+ Add event" button above the bottom tab bar.
 *
 * Query params read here:
 *   s=loading    8F skeleton
 *   s=highlight  8C: highlight the trip's last event
 *   focus=<id>   scroll to and highlight an event (e.g. after saving on Page 7)
 */

import type { ReactNode } from 'react';
import { CalendarPlus, LayoutDashboard, MapPinOff, Pencil, Plus, Sparkles, UserPlus } from 'lucide-react';
import { PhaseBadge } from '../../components/domain/TripCard';
import { Button } from '../../components/ui/Button';
import { AvatarStack, Badge, Banner, EmptyState, RoleBadge } from '../../components/ui/Display';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import { useTrip, type TripContext } from '../../hooks/useTrip';
import { formatDateRange } from '../../lib/dates';
import { plural } from '../../lib/format';
import { Link, withQuery } from '../../router/router';
import { paths } from '../../router/routes';
import { itineraryByDay, now, personFirstName, personName, phaseOf, tripSuggestions } from '../../store/selectors';
import { DayChips } from './DayChips';
import { DaySection } from './DaySection';
import { useDayScroll, useEventHighlight, useScrolledPast } from './hooks';
import { budgetSnapshot, dayPlaceLabels, editableDaysSentence, openIdeas, peopleLine, peopleSummary } from './itinerary';
import { ItineraryRail } from './ItineraryRail';
import { ChipsSkeleton, DayListSkeleton, RailSkeleton } from './ItinerarySkeleton';
import './p08.css';

export function ItineraryPage({ tripId, query }: { tripId: string; query: URLSearchParams }) {
  const ctx = useTrip(tripId);
  if (!ctx) return <TripNotFound />;
  // key: switching trips (trip switcher) starts fresh (scroll position, highlight).
  return <Itinerary key={ctx.trip.id} ctx={ctx} query={query} />;
}

/** Shown when the id is wrong or the signed-in person isn't on this trip. */
function TripNotFound() {
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

/** Split "First sentence. The rest." so banners can bold the first sentence. */
function splitFirstSentence(text: string): [string, string] {
  const i = text.indexOf('. ');
  return i === -1 ? [text, ''] : [text.slice(0, i + 1), text.slice(i + 2)];
}

function Itinerary({ ctx, query }: { ctx: TripContext; query: URLSearchParams }) {
  const { state, trip, access } = ctx;
  const bp = useBreakpoint();
  const isDesktop = bp === 'desktop';
  const isMobile = bp === 'mobile';
  const forced = query.get('s');
  const isLoading = forced === 'loading';

  const days = itineraryByDay(state, trip);
  const phase = phaseOf(state, trip);
  const isPast = phase === 'past';
  const isActive = phase === 'active';
  const clock = now(state);
  const todayIso = clock.date;
  const allEvents = days.flatMap((d) => d.events);
  const isEmptyTrip = allEvents.length === 0;
  const placeLabels = dayPlaceLabels(days, trip);
  const people = peopleSummary(state, trip);
  const ideas = isPast ? [] : openIdeas(state, trip.id);
  const liveIdeas = !tripSuggestions(state, trip.id).some((s) => s.source === 'bundled');
  const ownerName = personFirstName(state, trip.ownerId);

  // Which event to highlight: ?s=highlight → the trip's last event; ?focus=<id>;
  // otherwise the event that was just added (store marker from Page 7 / Page 9).
  const justAdded = state.ui.justAddedEventId;
  const target =
    forced === 'highlight'
      ? (allEvents[allEvents.length - 1]?.id ?? null)
      : (query.get('focus') ?? (justAdded && allEvents.some((e) => e.id === justAdded) ? justAdded : null));
  const highlightId = useEventHighlight(isLoading ? null : target, allEvents.map((e) => e.id));

  const initialDay = days.some((d) => d.date === todayIso) ? todayIso : days[0]?.date;
  const { active, scrollToDay, barRef } = useDayScroll(
    days.map((d) => d.date),
    initialDay,
  );

  // "+ Add event" opens Page 7 on the most useful day: today during the trip,
  // or a day editor's own day; Page 7 brings you back here afterwards.
  const defaultAddDate = access.canEditDay(todayIso) ? todayIso : access.canEditAnyDay ? undefined : access.editableDays[0];
  const addPath = withQuery(paths.newEvent(trip.id), { date: defaultAddDate, return: paths.itinerary(trip.id) });
  const canAdd = !isPast && access.canAddEvents;
  // No floating button on a brand-new trip: the start panel already leads with "Add your first event".
  const showFab = isMobile && canAdd && !isLoading && !isEmptyTrip;
  // The floating button shows its label at first, then shrinks to a round "+" so it covers less of the list.
  const fabCollapsed = useScrolledPast(240);

  const addButton: ReactNode = isPast ? null : canAdd ? (
    <Button to={addPath} icon={<Plus />}>
      Add event
    </Button>
  ) : (
    <Button icon={<Plus />} locked={access.lockReason('editEvents')}>
      Add event
    </Button>
  );
  const editButton: ReactNode = access.canEditTrip ? (
    <Button variant="secondary" icon={<Pencil />} to={paths.editTrip(trip.id)} size={isMobile ? 'sm' : 'md'}>
      Edit trip
    </Button>
  ) : null;
  const dashboardButton: ReactNode = isActive ? (
    <Button variant="secondary" icon={<LayoutDashboard />} to={paths.dashboard(trip.id)} size={isMobile ? 'sm' : 'md'}>
      Trip dashboard
    </Button>
  ) : null;

  /* ------------------------------------------------------------- pieces */

  const acceptedPeople = people.rows.filter((r) => r.status === 'accepted').map((r) => r.person);
  const header = (
    <header className="p08-head">
      <div className="p08-head-text">
        <span className="eyebrow">Itinerary</span>
        <h1 className="p08-title">{trip.title}</h1>
        <p className="p08-meta num">
          {trip.destinations.map((d) => d.name).join(', ')} · {formatDateRange(trip.startDate, trip.endDate)} · {plural(days.length, 'day')}
        </p>
        <div className="p08-badges">
          <RoleBadge role={access.role} days={access.role === 'day' ? access.editableDays.length : undefined} />
          <PhaseBadge phase={phase} startDate={trip.startDate} today={todayIso} />
          {trip.isSample && <Badge>Sample</Badge>}
          <Link to={paths.people(trip.id)} className="p08-people-link" aria-label={`${peopleLine(people, isPast)}. See who’s on this trip`}>
            <AvatarStack people={acceptedPeople} max={5} size={28} />
            <span>{peopleLine(people, isPast)}</span>
          </Link>
        </div>
      </div>
      {isMobile ? (
        // Phones: "+ Add event" lives in the floating button; Viewers see it locked here instead.
        (dashboardButton || editButton || (!canAdd && addButton)) && (
          <div className="p08-head-actions">
            {dashboardButton}
            {editButton}
            {!canAdd && addButton}
          </div>
        )
      ) : (
        <div className="p08-head-actions">
          {dashboardButton}
          {editButton}
          {addButton}
        </div>
      )}
    </header>
  );

  const [viewerTitle, viewerText] = splitFirstSentence(access.lockReason('editEvents'));
  const [dayTitle, dayText] = splitFirstSentence(editableDaysSentence(trip, access.editableDays));
  const banners = (
    <>
      {isPast && (
        <Banner tone="info" title="This trip has ended.">
          You can still view the itinerary.
        </Banner>
      )}
      {!isPast && access.role === 'viewer' && (
        <Banner tone="locked" title={viewerTitle}>
          {viewerText}
        </Banner>
      )}
      {!isPast && access.role === 'day' && (
        <Banner tone="info" title={dayTitle}>
          {dayText}
        </Banner>
      )}
    </>
  );

  const startPanel = isEmptyTrip && !isPast && !isLoading ? <StartPanel ctx={ctx} addPath={addPath} ownerName={ownerName} solo={people.going <= 1} /> : null;

  const dayList = isLoading ? (
    <DayListSkeleton />
  ) : (
    <div className="p08-days">
      {days.map((day) => {
        const isToday = day.date === todayIso;
        return (
          <DaySection
            key={day.date}
            trip={trip}
            day={day}
            placeLabel={placeLabels[day.date]}
            isToday={isToday}
            nowTime={isActive && isToday ? clock.time : undefined}
            canEdit={access.canEditDay(day.date)}
            showViewOnly={access.role === 'day' && !isPast && !access.canEditDay(day.date)}
            isPast={isPast}
            ideasCount={ideas.filter((s) => s.date === day.date).length}
            groupSize={people.going}
            highlightId={highlightId}
            quiet={isEmptyTrip}
            compact={isMobile}
          />
        );
      })}
    </div>
  );

  /* ------------------------------------------------------------- layout */

  if (isDesktop) {
    return (
      <div className="container page p08-page is-desktop">
        {header}
        <div className="p08-layout">
          <div className="p08-main">
            {banners}
            {startPanel}
            {dayList}
          </div>
          {isLoading ? (
            <RailSkeleton />
          ) : (
            <ItineraryRail
              trip={trip}
              days={days}
              active={active}
              todayIso={todayIso}
              onJump={scrollToDay}
              people={people}
              nameOf={(id) => personName(state, id, access.actingPersonId)}
              budget={budgetSnapshot(state, trip, access.actingPersonId)}
              ideas={ideas}
              liveIdeas={liveIdeas}
              isPast={isPast}
              canManagePeople={access.canManagePeople}
              canSetBudget={access.canSetBudget}
            />
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`container page p08-page ${showFab ? 'has-fab' : ''}`}>
      {header}
      {banners}
      {isLoading ? <ChipsSkeleton /> : <DayChips trip={trip} days={days} active={active} todayIso={todayIso} onPick={scrollToDay} barRef={barRef} />}
      {startPanel}
      {dayList}
      {showFab && (
        <div className="p08-fab-wrap">
          <Button to={addPath} size="lg" icon={<Plus />} className={`p08-fab ${fabCollapsed ? 'is-collapsed' : ''}`} aria-label="Add event">
            Add event
          </Button>
        </div>
      )}
    </div>
  );
}

/**
 * A brand-new trip (every day empty, e.g. "Zion Weekend"): one clear starting
 * point instead of a wall of identical empty days.
 */
function StartPanel({ ctx, addPath, ownerName, solo }: { ctx: TripContext; addPath: string; ownerName: string; solo: boolean }) {
  const { trip, access } = ctx;
  const dest = trip.destinations[0]?.name ?? 'your destination';
  return (
    <section className="p08-start" aria-labelledby="p08-start-title">
      <span className="p08-start-icon" aria-hidden>
        <CalendarPlus />
      </span>
      <div className="p08-start-copy">
        <h2 className="p08-start-title" id="p08-start-title">
          {access.canAddEvents ? 'Start your plan' : 'Nothing is planned yet'}
        </h2>
        <p className="p08-start-text">
          {access.canAddEvents
            ? `Add the places you want to go and they’ll line up here, day by day and in time order. Not sure where to start? Get ideas near ${dest}.`
            : `${ownerName} hasn’t added any events yet. They’ll appear here day by day.`}
        </p>
      </div>
      <div className="p08-start-actions">
        {access.canAddEvents && (
          <Button icon={<Plus />} to={addPath}>
            Add your first event
          </Button>
        )}
        <Button variant="secondary" icon={<Sparkles />} to={paths.ideas(trip.id)}>
          Get ideas near {dest}
        </Button>
        {access.canManagePeople && solo && (
          <Button variant="ghost" icon={<UserPlus />} to={paths.people(trip.id)}>
            Invite people
          </Button>
        )}
      </div>
    </section>
  );
}
