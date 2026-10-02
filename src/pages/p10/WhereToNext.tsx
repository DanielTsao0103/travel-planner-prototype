/**
 * "Where to next" (Page 10): the traveler's simulated location, the next stop
 * on a map with the walking route, and when to leave.
 *
 * - layout="strip" (desktop): a wide map with the info card over its left side.
 * - layout="card" (phones/tablets): a map card with the info underneath.
 *
 * States: the next stop today (route loading → ready, walk or taxi, "leave by" /
 * "leave now" / "running late"), the next stop on a later day when today is
 * done, and nothing left on the plan at all.
 */

import type { ReactNode } from 'react';
import { CalendarClock, CarTaxiFront, Clock, Footprints, Map as MapIcon, Navigation, Sparkles, TrainFront } from 'lucide-react';
import type { AppState, ISODate, Time, Trip, TripEvent } from '../../data/types';
import { addDays, formatDuration, formatShortDate, formatTime, minToTime, timeToMin } from '../../lib/dates';
import { distanceMeters, estimateTaxiMinutes } from '../../lib/geo';
import { distanceLabel } from '../../lib/format';
import { eventsOn, nextEventAnyDay, nextEventToday, simulatedLocation, tripEvents } from '../../store/selectors';
import { navigate, withQuery } from '../../router/router';
import { paths } from '../../router/routes';
import { Button } from '../../components/ui/Button';
import { DemoBadge, Skeleton } from '../../components/ui/Display';
import type { MapMarker } from '../../components/domain/MapView';
import { PlacePhoto } from '../../components/domain/PlacePhoto';
import { eventLabel } from '../../components/domain/EventItem';
import { FramedMap } from './FramedMap';
import { directionsPath, isRide, LEAVE_BUFFER_MIN, MAX_WALK_MIN, useWalkingRoute } from './tripTime';
import './p10.css';

export interface WhereToNextProps {
  state: AppState;
  trip: Trip;
  today: ISODate;
  nowTime: Time;
  layout: 'strip' | 'card';
}

/** How to get to the next stop, worked out from the route (or an estimate). */
interface Travel {
  mode: 'walk' | 'taxi';
  minutes: number;
  distanceM: number;
  estimated: boolean;
}

export function WhereToNext({ state, trip, today, nowTime, layout }: WhereToNextProps) {
  const you = simulatedLocation(state, trip);
  const nowMin = timeToMin(nowTime);
  const nextToday = nextEventToday(state, trip);
  const nextLater = nextToday ? undefined : nextEventAnyDay(state, trip);
  // Today's remaining stops, numbered in order (1 = next). On a quiet evening: just the next day's first stop.
  const stops: TripEvent[] = nextToday ? eventsOn(state, trip.id, today).filter((e) => timeToMin(e.start) > nowMin) : nextLater ? [nextLater] : [];

  // The shared location rule puts you at (or just outside) the event you're on or just left. For a train
  // ride that's the station it *left from*, so a far-away next stop would get a nonsense taxi estimate.
  // In that case we skip the estimate and say where the ride stands instead.
  const lastPlace = you?.eventId ? state.events.find((e) => e.id === you.eventId) : undefined;
  const ride = lastPlace && isRide(lastPlace) && nextToday && you && distanceMeters(you, nextToday.place) > 3000 ? lastPlace : undefined;
  const youShown = ride ? null : you;

  const { loading, route } = useWalkingRoute(nextToday && !ride ? you : null, nextToday && !ride ? nextToday.place : null);

  let travel: Travel | null = null;
  if (nextToday && route && you && !ride) {
    travel =
      route.minutes > MAX_WALK_MIN
        ? { mode: 'taxi', minutes: estimateTaxiMinutes(distanceMeters(you, nextToday.place)), distanceM: route.distanceM, estimated: true }
        : { mode: 'walk', minutes: route.minutes, distanceM: route.distanceM, estimated: route.source === 'estimate' };
  }

  const markers: MapMarker[] = stops.map((e, i) => ({
    id: e.id,
    lat: e.place.lat,
    lng: e.place.lng,
    kind: 'event',
    label: `${eventLabel(e)} · ${formatTime(e.start)}`,
    number: nextToday ? i + 1 : undefined,
    selected: i === 0,
  }));

  const openStop = (id: string) => {
    const e = stops.find((s) => s.id === id);
    if (e) navigate(withQuery(paths.day(trip.id, e.date), { focus: e.id }));
  };

  // Frame the stops and "you" (not the route, which arrives later), so the map never has to re-zoom.
  const framePts = [...stops.map((e) => ({ lat: e.place.lat, lng: e.place.lng })), ...(youShown ? [youShown] : [])];
  const map = (
    <FramedMap
      ariaLabel={nextToday ? `Map: your location and the route to ${eventLabel(nextToday)}` : 'Map of your location'}
      markers={markers}
      you={youShown}
      route={nextToday && route && travel?.mode === 'walk' ? route.coords : null}
      routeEstimated={route?.source === 'estimate'}
      static
      onMarkerClick={openStop}
      frame={framePts}
      fallback={trip.destinations[0]}
      // Desktop: keep the pins clear of the info card over the map's left side.
      insetLeft={layout === 'strip' ? (w) => Math.min(360, w * 0.44) + 16 : undefined}
      frameKey={framePts.map((p) => `${p.lat.toFixed(4)},${p.lng.toFixed(4)}`).join('|')}
      className={layout === 'strip' ? 'p10-where-mapview' : 'p10-where-cardmap'}
    />
  );

  const info = <NextStopInfo trip={trip} today={today} nowMin={nowMin} nextToday={nextToday} nextLater={nextLater} laterToday={nextToday ? stops.slice(1) : []} ride={ride ? { event: ride, onIt: you?.basis === 'at-event' } : undefined} hadEventsToday={eventsOn(state, trip.id, today).length > 0} planIsEmpty={tripEvents(state, trip.id).length === 0} travel={travel} loading={loading && !!nextToday} layout={layout} />;

  if (layout === 'strip') {
    return (
      <section className="p10-where is-strip" aria-labelledby="p10-where-title">
        <div className="p10-where-frame">
          {map}
          <div className="p10-where-card">{info}</div>
        </div>
      </section>
    );
  }
  return (
    <section className="p10-where is-card" aria-labelledby="p10-where-title">
      <div className="p10-section-head">
        <h2 id="p10-where-title" className="p10-section-title">
          Where to next
        </h2>
        <Button to={paths.tripMap(trip.id)} variant="ghost" size="sm" icon={<MapIcon />}>
          Open map
        </Button>
      </div>
      <div className="p10-where-box">
        {map}
        <div className="p10-where-info">{info}</div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------- info panel */

function NextStopInfo({
  trip,
  today,
  nowMin,
  nextToday,
  nextLater,
  laterToday,
  ride,
  hadEventsToday,
  planIsEmpty,
  travel,
  loading,
  layout,
}: {
  trip: Trip;
  today: ISODate;
  nowMin: number;
  nextToday?: TripEvent;
  nextLater?: TripEvent;
  laterToday: TripEvent[];
  /** You're on (or just got off) a train or similar ride, so there's no walking estimate. */
  ride?: { event: TripEvent; onIt: boolean };
  /** Whether anything was planned today at all (changes "Nothing else…" to "Nothing…"). */
  hadEventsToday: boolean;
  /** The trip has no events at all yet. */
  planIsEmpty: boolean;
  travel: Travel | null;
  loading: boolean;
  layout: 'strip' | 'card';
}) {
  const heading =
    layout === 'strip' ? (
      <h2 id="p10-where-title" className="p10-where-heading">
        Where to next
      </h2>
    ) : null;

  /* Nothing else today, and maybe nothing else at all. */
  if (!nextToday) {
    return (
      <div className="p10-next">
        {heading}
        <p className="p10-next-quiet">
          {nextLater ? (hadEventsToday ? 'Nothing else is planned today.' : 'Nothing is planned today.') : planIsEmpty ? 'Nothing on the plan yet.' : 'Nothing left on the plan.'}
        </p>
        {nextLater ? (
          <>
            <StopRow event={nextLater} kicker={`${nextLater.date === addDays(today, 1) ? 'Tomorrow' : formatShortDate(nextLater.date)} @ ${formatTime(nextLater.start)}`} icon={<CalendarClock aria-hidden />} />
            <p className="p10-next-line muted">{nowMin >= 17 * 60 ? 'Free tonight? Find something close by that suits the group.' : 'Free time today? Find something close by that suits the group.'}</p>
          </>
        ) : (
          <p className="p10-next-line muted">
            {planIsEmpty ? 'Once the trip has stops, this shows the walk to the next one. For now, look for something close by.' : 'You’ve done everything you planned. Look for something close by.'}
          </p>
        )}
        <div className="p10-next-actions">
          <Button to={paths.ideas(trip.id)} icon={<Sparkles />} variant={nextLater ? 'secondary' : 'primary'}>
            Find something nearby
          </Button>
          {nextLater && (
            <Button to={directionsPath(trip.id, nextLater)} variant="ghost" icon={<Navigation />}>
              Directions
            </Button>
          )}
        </div>
      </div>
    );
  }

  /* The next stop today. */
  const startMin = timeToMin(nextToday.start);
  // The desktop card sits inside the map strip, so it has room for two "later" stops.
  const maxLater = layout === 'strip' ? 2 : 3;
  const leaveBy = travel ? startMin - travel.minutes - LEAVE_BUFFER_MIN : null;
  const lateBy = travel ? nowMin + travel.minutes - startMin : 0;
  return (
    <div className="p10-next">
      {heading}
      <StopRow event={nextToday} kicker={`Next @ ${formatTime(nextToday.start)}`} number={1} />
      {ride ? (
        <ul className="p10-next-facts">
          <li>
            <TrainFront aria-hidden />
            <span className="num">
              {ride.onIt ? `On ${eventLabel(ride.event)} until ${formatTime(ride.event.end)}` : `${eventLabel(ride.event)} got in at ${formatTime(ride.event.end)}`}
            </span>
          </li>
          <li>
            <Clock aria-hidden />
            <span className="num">{startMin > nowMin ? `Starts in ${formatDuration(startMin - nowMin)}` : 'Starting now'}</span>
          </li>
        </ul>
      ) : loading || !travel ? (
        <div className="stack-sm" aria-busy="true">
          <span className="sr-only">Checking the walking route…</span>
          <Skeleton width="70%" height={16} />
          <Skeleton width="50%" height={16} />
        </div>
      ) : (
        <ul className="p10-next-facts">
          <li>
            {travel.mode === 'walk' ? <Footprints aria-hidden /> : <CarTaxiFront aria-hidden />}
            <span className="num">
              {travel.mode === 'walk' ? `${travel.minutes} min walk · ${distanceLabel(travel.distanceM)}` : `~${travel.minutes} min by taxi`}
            </span>
            {travel.estimated && <DemoBadge title="Straight-line estimate: the routing service didn’t answer">Estimate</DemoBadge>}
          </li>
          <li className={lateBy > 0 ? 'is-warning' : leaveBy !== null && nowMin >= leaveBy ? 'is-now' : ''}>
            <Clock aria-hidden />
            {lateBy > 0 ? (
              <span>Leave now · you’ll be about {formatDuration(lateBy)} late</span>
            ) : leaveBy !== null && nowMin >= leaveBy ? (
              <span>Leave now to arrive on time</span>
            ) : (
              <span className="num">
                Leave by {formatTime(minToTime(leaveBy ?? startMin))}
                <span className="muted"> · in {formatDuration((leaveBy ?? startMin) - nowMin)}</span>
              </span>
            )}
          </li>
        </ul>
      )}
      <div className="p10-next-actions">
        <Button to={directionsPath(trip.id, nextToday)} icon={<Navigation />}>
          Directions
        </Button>
        {layout === 'strip' && (
          <Button to={paths.tripMap(trip.id)} variant="secondary" icon={<MapIcon />}>
            Open map
          </Button>
        )}
      </div>
      {laterToday.length > 0 && (
        <div className="p10-next-later">
          <p className="eyebrow">{laterToday.length > maxLater ? `Later today · ${laterToday.length} more stops` : 'Later today'}</p>
          <ol className="p10-next-later-list">
            {laterToday.slice(0, maxLater).map((e, i) => (
              <li key={e.id}>
                <span className="p10-num-dot">{i + 2}</span>
                <span className="truncate">{eventLabel(e)}</span>
                <span className="num muted">{formatTime(e.start)}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

/** Photo, name, and a small line above it ("Next @ 3:30 PM", the app's "place @ time" format). */
function StopRow({ event, kicker, number, icon }: { event: TripEvent; kicker: string; number?: number; icon?: ReactNode }) {
  return (
    <div className="p10-stop">
      <PlacePhoto photo={event.place.photo} place={event.place} alt={event.place.name} category={event.place.category} className="p10-stop-photo" />
      <div className="p10-stop-text">
        <span className="p10-stop-kicker num">
          {number !== undefined && <span className="p10-num-dot is-next">{number}</span>}
          {icon}
          {kicker}
        </span>
        <span className="p10-stop-name">{eventLabel(event)}</span>
        <span className="p10-stop-area">{event.title ? event.place.name : event.place.area}</span>
      </div>
    </div>
  );
}
