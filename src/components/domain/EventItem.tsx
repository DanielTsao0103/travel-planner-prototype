/**
 * One itinerary event row: photo, location name, and "@ time" — the format
 * the doc asks for on Page 8 ("pic location @ hh:mm"). Reused on Pages 10 and 11.
 */

import type { ReactNode } from 'react';
import { ChevronRight, Ticket } from 'lucide-react';
import type { TripEvent } from '../../data/types';
import { formatTime } from '../../lib/dates';
import { Link } from '../../router/router';
import { PlacePhoto } from './PlacePhoto';
import './domain.css';

export function eventLabel(event: Pick<TripEvent, 'title' | 'place'>): string {
  return event.title ?? event.place.name;
}

export function EventItem({
  event,
  to,
  highlight,
  meta,
  trailing,
  compact,
}: {
  event: TripEvent;
  /** Where tapping the row goes (usually the event's Page 7 view/edit). */
  to?: string;
  /** Briefly highlight (e.g. just added). */
  highlight?: boolean;
  /** Extra line under the name (area, cost, badges). */
  meta?: ReactNode;
  /** Content on the right instead of the chevron. */
  trailing?: ReactNode;
  compact?: boolean;
}) {
  const name = eventLabel(event);
  const body = (
    <>
      <PlacePhoto photo={event.place.photo} alt={event.place.name} category={event.place.category} className="event-photo" />
      <span className="event-main">
        <span className="event-name">{name}</span>
        <span className="event-meta">
          {meta ?? (
            <>
              {event.title ? event.place.name : event.place.area}
              {event.place.ticketRequired && (
                <span className="event-ticket" title="Tickets required">
                  <Ticket aria-hidden /> Tickets
                </span>
              )}
            </>
          )}
        </span>
      </span>
      <span className="event-time num">@ {formatTime(event.start)}</span>
      {trailing ?? (to ? <ChevronRight className="event-chevron" aria-hidden /> : null)}
    </>
  );
  const classes = `event-item ${compact ? 'is-compact' : ''} ${highlight ? 'is-highlight' : ''}`;
  return to ? (
    <Link to={to} className={classes} aria-label={`${name} at ${formatTime(event.start)}`}>
      {body}
    </Link>
  ) : (
    <div className={classes}>{body}</div>
  );
}
