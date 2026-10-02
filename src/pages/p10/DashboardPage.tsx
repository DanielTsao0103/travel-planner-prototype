/**
 * Page 10 — Active-trip dashboard (the "Today" tab).
 *
 * Doc: "(specifically only opens during the dates of the trip) the active trip
 * day is the basic all in one dashboard control center of the trip. While on
 * the trip it auto opens to this page. And it shows the week calendar, it has a
 * to do list on the side of the calender, and then at the bottom it has the map
 * of where to next."
 *
 * Layouts (genuinely different, picked with useBreakpoint):
 *  - desktop (≥1100px): week calendar (2/3) with the to-do list beside it (1/3),
 *    then a full-width "Where to next" map strip.
 *  - tablet: the calendar full width, then to-do and the map card side by side.
 *  - phone: a 7-day pill strip, today's agenda, to-do (first 3), map card.
 * Before or after the trip it shows a designed locked state instead (10C/10D).
 *
 * Query params: `auto=1` means App opened this page by itself (banner, 10B).
 * All data comes from the shared store, so it matches Page 8 and Page 11.
 */

import { useState } from 'react';
import { ArrowRight, Plane, X } from 'lucide-react';
import { APP_NAME } from '../../config';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import { useTrip } from '../../hooks/useTrip';
import { dayNumber, formatShortDate, formatTime, tripPhase } from '../../lib/dates';
import { eventsOn, now, tripDays } from '../../store/selectors';
import { navigate } from '../../router/router';
import { paths } from '../../router/routes';
import { Button, IconButton } from '../../components/ui/Button';
import { Banner, DemoBadge, EmptyState } from '../../components/ui/Display';
import { DayPills } from './DayPills';
import { AfterTrip, BeforeTrip } from './PhaseStates';
import { TodayAgenda } from './TodayAgenda';
import { TodoList } from './TodoList';
import { WeekCalendar } from './WeekCalendar';
import { WhereToNext } from './WhereToNext';
import { dayCity, useLiveClock } from './tripTime';
import './p10.css';

export function DashboardPage({ tripId, query }: { tripId: string; query: URLSearchParams }) {
  const ctx = useTrip(tripId);
  const bp = useBreakpoint();
  useLiveClock();
  const [autoDismissed, setAutoDismissed] = useState(false);

  if (!ctx) return <TripUnavailable />;
  const { state, trip, access } = ctx;
  const clock = now(state);
  const today = clock.date;
  const phase = tripPhase(trip, today);

  if (phase === 'upcoming') return <BeforeTrip state={state} trip={trip} access={access} today={today} />;
  if (phase === 'past') return <AfterTrip state={state} trip={trip} access={access} today={today} />;

  const days = tripDays(trip);
  const counts = Object.fromEntries(days.map((d) => [d, eventsOn(state, trip.id, d).length]));
  const showAutoBanner = query.get('auto') === '1' && !autoDismissed;

  const dismissAuto = () => {
    setAutoDismissed(true);
    // Drop ?auto=1 so a reload doesn't bring the banner back.
    navigate(paths.dashboard(trip.id), { replace: true });
  };

  const header = (
    <header className="p10-head">
      <div className="p10-head-text">
        <p className="eyebrow">
          Day {dayNumber(trip, today)} of {days.length} · {dayCity(state, trip, today)}
        </p>
        <h1 className="p10-title">{formatShortDate(today)}</h1>
      </div>
      <div className="p10-head-side">
        <div className="p10-clock-wrap">
          <p className="p10-clock" aria-label={`Current time ${formatTime(clock.time)}`}>
            <span className="p10-clock-dot" aria-hidden />
            <span className="num">{formatTime(clock.time)}</span>
          </p>
          {state.demo.clock && <DemoBadge title="Set with the demo clock in Prototype controls">Demo clock</DemoBadge>}
        </div>
        {bp !== 'mobile' && (
          <Button to={paths.day(trip.id, today)} variant="secondary" iconRight={<ArrowRight />}>
            Today’s timeline
          </Button>
        )}
      </div>
    </header>
  );

  const autoBanner = showAutoBanner && (
    <Banner
      tone="info"
      className="p10-auto"
      title="Opened automatically because your trip is happening now."
      action={
        <div className="p10-auto-actions">
          <Button to={paths.home()} size="sm" variant="secondary">
            Go to Home
          </Button>
          <IconButton label="Hide this message" icon={<X />} size="sm" onClick={dismissAuto} />
        </div>
      }
    >
      While you’re traveling, {APP_NAME} opens on this dashboard. Home is still one tap away.
    </Banner>
  );

  const common = { state, trip, access, today };

  if (bp === 'mobile') {
    return (
      <div className="container page p10 is-mobile">
        {header}
        {autoBanner}
        <DayPills trip={trip} days={days} counts={counts} today={today} hrefFor={(d) => paths.day(trip.id, d)} label="Trip days" />
        <TodayAgenda {...common} nowTime={clock.time} />
        <TodoList {...common} previewCount={3} className="p10-panel" />
        <WhereToNext state={state} trip={trip} today={today} nowTime={clock.time} layout="card" />
      </div>
    );
  }

  if (bp === 'tablet') {
    return (
      <div className="container page p10">
        {header}
        {autoBanner}
        <WeekCalendar {...common} nowTime={clock.time} />
        <div className="p10-tablet-row">
          <TodoList {...common} className="p10-panel" />
          <WhereToNext state={state} trip={trip} today={today} nowTime={clock.time} layout="card" />
        </div>
      </div>
    );
  }

  return (
    <div className="container page p10">
      {header}
      {autoBanner}
      <div className="p10-top">
        <WeekCalendar {...common} nowTime={clock.time} />
        <TodoList {...common} className="p10-panel" />
      </div>
      <WhereToNext state={state} trip={trip} today={today} nowTime={clock.time} layout="strip" />
    </div>
  );
}

/** Not found, or the signed-in person isn't on this trip. */
function TripUnavailable() {
  return (
    <div className="container page">
      <EmptyState
        icon={<Plane />}
        title="This trip isn’t available"
        actions={
          <Button to={paths.trips()} iconRight={<ArrowRight />}>
            Go to My trips
          </Button>
        }
      >
        It may have been deleted, or you’re not a member of it.
      </EmptyState>
    </div>
  );
}
