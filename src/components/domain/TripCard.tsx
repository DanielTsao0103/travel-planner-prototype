/** Trip card for lists (Page 5) and summaries: cover photo, dates, role, people. */

import type { ReactNode } from 'react';
import { CalendarDays, MapPin } from 'lucide-react';
import type { Person, Role, Trip } from '../../data/types';
import { formatDateRange, relativeDays, type TripPhase } from '../../lib/dates';
import { Link } from '../../router/router';
import { AvatarStack, Badge, RoleBadge } from '../ui/Display';
import { PlacePhoto } from './PlacePhoto';
import './domain.css';

export function PhaseBadge({ phase, startDate, today }: { phase: TripPhase; startDate: string; today: string }) {
  if (phase === 'active') return <Badge tone="accent">Happening now</Badge>;
  if (phase === 'past') return <Badge tone="neutral">Past trip</Badge>;
  return <Badge tone="primary">Starts {relativeDays(today, startDate)}</Badge>;
}

export function TripCard({
  trip,
  role,
  people,
  phase,
  today,
  to,
  actions,
  highlight,
}: {
  trip: Trip;
  role: Role;
  people: Person[];
  phase: TripPhase;
  today: string;
  to: string;
  actions?: ReactNode;
  highlight?: boolean;
}) {
  return (
    <article className={`trip-card ${highlight ? 'is-highlight' : ''} ${phase === 'past' ? 'is-past' : ''}`}>
      <Link to={to} className="trip-card-link" aria-label={`Open ${trip.title}`}>
        <div className="trip-card-media">
          <PlacePhoto photo={trip.coverPhoto} alt="" category="landmark" size="full" rounded={false} className="trip-card-photo" />
          <div className="trip-card-badges">
            <PhaseBadge phase={phase} startDate={trip.startDate} today={today} />
            {trip.isSample && <Badge tone="neutral">Sample</Badge>}
          </div>
        </div>
        <div className="trip-card-body">
          <h3 className="trip-card-title">{trip.title}</h3>
          <p className="trip-card-line">
            <MapPin aria-hidden />
            <span className="truncate">{trip.destinations.map((d) => d.name).join(' · ')}</span>
          </p>
          <p className="trip-card-line num">
            <CalendarDays aria-hidden />
            <span>{formatDateRange(trip.startDate, trip.endDate)}</span>
          </p>
          <div className="row-between trip-card-foot">
            <AvatarStack people={people} size={26} max={5} />
            <RoleBadge role={role} />
          </div>
        </div>
      </Link>
      {actions && <div className="trip-card-actions">{actions}</div>}
    </article>
  );
}
