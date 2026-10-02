/**
 * The day page's supporting cards (Page 11): a day summary (events, planned
 * cost per person, ticketed stops) and a small map with the day's stops
 * numbered in order. On desktop they sit in the right-hand panel; on phones
 * they follow the timeline.
 */

import { Map as MapIcon } from 'lucide-react';
import type { AppState, ISODate, Trip, TripEvent } from '../../data/types';
import { formatTime } from '../../lib/dates';
import { plural } from '../../lib/format';
import { simulatedLocation } from '../../store/selectors';
import { navigate, withQuery } from '../../router/router';
import { paths } from '../../router/routes';
import { Button } from '../../components/ui/Button';
import type { MapMarker } from '../../components/domain/MapView';
import { FramedMap } from '../p10/FramedMap';
import { eventLabel } from '../../components/domain/EventItem';
import { dollars } from '../p10/tripTime';
import { daySummary } from './dayModel';
import './p11.css';

/** Three numbers for the day, plus when it starts and ends. */
export function DaySummaryCard({ events }: { events: TripEvent[] }) {
  const s = daySummary(events);
  const first = events[0];
  const lastEnd = events.reduce((latest, e) => (e.end > latest ? e.end : latest), '00:00');
  return (
    <section className="p11-card p11-summary" aria-labelledby="p11-summary-title">
      <h2 id="p11-summary-title" className="p11-card-title">
        Day at a glance
      </h2>
      <dl className="p11-stats">
        <div>
          <dt>{s.count === 1 ? 'Event' : 'Events'}</dt>
          <dd className="num">{s.count}</dd>
        </div>
        <div>
          <dt>Planned per person</dt>
          <dd className="num">{dollars(Math.round(s.perPerson * 100) / 100)}</dd>
        </div>
        <div>
          <dt>{s.ticketed === 1 ? 'Ticketed stop' : 'Ticketed stops'}</dt>
          <dd className="num">{s.ticketed}</dd>
        </div>
      </dl>
      {first && (
        <p className="p11-summary-foot num">
          Starts {formatTime(first.start)} · ends {formatTime(lastEnd)}
          {s.ticketed > 0 && ` · ${s.booked} of ${plural(s.ticketed, 'ticket')} booked`}
        </p>
      )}
    </section>
  );
}

/** Small, non-draggable map of the day's stops (and you, if it's today). Tapping a pin highlights that event. */
export function DayMapCard({ state, trip, date, today, events }: { state: AppState; trip: Trip; date: ISODate; today: ISODate; events: TripEvent[] }) {
  const markers: MapMarker[] = events.map((e, i) => ({
    id: e.id,
    lat: e.place.lat,
    lng: e.place.lng,
    kind: 'event',
    label: `${i + 1}. ${eventLabel(e)} · ${formatTime(e.start)}`,
    number: i + 1,
  }));
  const you = date === today ? simulatedLocation(state, trip) : null;
  return (
    <section className="p11-card p11-map-card" aria-labelledby="p11-map-title">
      <div className="p11-card-head">
        <h2 id="p11-map-title" className="p11-card-title">
          Map of the day
        </h2>
        <Button to={paths.tripMap(trip.id)} variant="ghost" size="sm" icon={<MapIcon />}>
          Open map
        </Button>
      </div>
      <FramedMap
        ariaLabel={`Map of ${plural(events.length, 'stop')}, numbered in order`}
        markers={markers}
        you={you}
        static
        frame={[...events.map((e) => ({ lat: e.place.lat, lng: e.place.lng })), ...(you ? [you] : [])]}
        // A new day gets a fresh map instead of animating the old one across the country.
        frameKey={`${date}:${events.map((e) => e.id).join(',')}`}
        className="p11-minimap"
        onMarkerClick={(id) => navigate(withQuery(paths.day(trip.id, date), { focus: id }), { replace: true })}
      />
    </section>
  );
}
