/**
 * Read-only event detail (Page 7, states 7I and 7J): what Viewers see, what a
 * Day editor sees for a day that isn't theirs, and how past trips' events look.
 *
 * Same information as the form (place, day and time, cost, who's coming,
 * notes, booking code), laid out to read rather than edit, with a lock banner
 * that says why it can't be changed.
 */

import type { ReactNode } from 'react';
import { CalendarDays, MapPin, NotebookText, Ticket, UsersRound, Wallet } from 'lucide-react';
import type { Person, TripEvent } from '../../data/types';
import type { TripContext } from '../../hooks/useTrip';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import { dayNumber, formatDuration, formatShortDate } from '../../lib/dates';
import { listJoin, money } from '../../lib/format';
import { getPerson, personName } from '../../store/selectors';
import { PageHeader } from '../../components/layout/PageHeader';
import { eventLabel } from '../../components/domain/EventItem';
import { PlacePhoto } from '../../components/domain/PlacePhoto';
import { Button } from '../../components/ui/Button';
import { AvatarStack, Badge, Banner } from '../../components/ui/Display';
import { BusyChart } from './BusyChart';
import { dayOptionLabel, durationMin, formatTimeRange } from './draft';
import { placeAreaLine } from './PlaceSearch';

/** How the event got onto the trip ('' for events typed in by hand). */
export const SOURCE_LABEL: Record<TripEvent['source'], string> = {
  manual: '',
  screenshot: ' from a screenshot',
  suggestion: ' from a suggestion',
  nearby: ' from a nearby alert',
};

/** "Added by Jordan Reyes from a screenshot" / "Added by you". */
export function addedByLine(who: string, source: TripEvent['source']): string {
  return `Added by ${who === 'You' ? 'you' : who}${SOURCE_LABEL[source]}`;
}

/** One labeled row in the facts list. */
function Fact({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <div className="p07-fact">
      <dt>
        {icon}
        {label}
      </dt>
      <dd>{children}</dd>
    </div>
  );
}

/** The read-only event page (photo, facts, crowd estimate, and why it's locked). */
export function EventView({ ctx, event, back }: { ctx: TripContext; event: TripEvent; back: { to: string; label: string } }) {
  const { state, trip, access } = ctx;
  const bp = useBreakpoint();
  const isWide = bp === 'desktop';
  const name = eventLabel(event);
  const people = event.attendeeIds.map((id) => getPerson(state, id)).filter((p): p is Person => !!p);
  const names = event.attendeeIds.map((id) => personName(state, id, access.actingPersonId));
  const total = event.cost ? (event.cost.per === 'person' ? event.cost.amount * event.attendeeIds.length : event.cost.amount) : null;
  const addedBy = getPerson(state, event.createdById);
  const reason = access.lockReason('editThisDay');

  const lock = (
    <Banner tone="locked" title={access.isPast ? 'Past trip' : 'View only'}>
      {reason}
    </Banner>
  );
  const crowd = !access.isPast && <BusyChart place={event.place} date={event.date} start={event.start} end={event.end} />;

  const facts = (
    <dl className="p07-facts">
      <Fact icon={<CalendarDays aria-hidden />} label="When">
        <span className="num">
          Day {dayNumber(trip, event.date)} · {formatShortDate(event.date)}
        </span>
        <span className="p07-fact-sub num">
          {formatTimeRange(event.start, event.end)} · {formatDuration(durationMin(event.start, event.end))}
        </span>
      </Fact>
      <Fact icon={<MapPin aria-hidden />} label="Where">
        <span>{event.place.name}</span>
        {placeAreaLine(event.place) && <span className="p07-fact-sub">{placeAreaLine(event.place)}</span>}
        {event.place.ticketRequired && (
          <Badge tone="accent" icon={<Ticket aria-hidden />}>
            Tickets required
          </Badge>
        )}
      </Fact>
      <Fact icon={<Wallet aria-hidden />} label="Cost">
        {event.cost ? (
          event.cost.amount === 0 ? (
            <span>Free</span>
          ) : (
            <>
              <span className="num">
                {money(event.cost.amount)} {event.cost.per === 'person' ? 'per person' : 'total'}
              </span>
              {total !== null && event.cost.per === 'person' && <span className="p07-fact-sub num">{money(total)} for everyone going</span>}
            </>
          )
        ) : (
          <span className="muted">No cost added</span>
        )}
      </Fact>
      <Fact icon={<UsersRound aria-hidden />} label="Who’s coming">
        <span className="p07-fact-people">
          <AvatarStack people={people} size={26} max={6} />
          <span>{listJoin(names)}</span>
        </span>
      </Fact>
      {event.confirmation && (
        <Fact icon={<Ticket aria-hidden />} label="Booking code">
          <span className="num p07-code">{event.confirmation}</span>
        </Fact>
      )}
      {event.notes && (
        <Fact icon={<NotebookText aria-hidden />} label="Notes">
          <span className="p07-fact-notes">{event.notes}</span>
        </Fact>
      )}
    </dl>
  );

  return (
    <div className="container page p07 p07-view">
      <PageHeader
        back={back}
        eyebrow={dayOptionLabel(trip, event.date)}
        title={name}
        subtitle={addedByLine(addedBy ? personName(state, addedBy.id, access.actingPersonId) : 'someone', event.source)}
      />
      <div className={`p07-view-layout ${isWide ? 'is-wide' : ''}`}>
        <div className="p07-view-main">
          <PlacePhoto photo={event.place.photo} alt={event.place.name} category={event.place.category} size="full" className="p07-hero" />
          {!isWide && lock}
          {facts}
          {!isWide && crowd}
          {!isWide && (
            <Button to={back.to} variant="secondary" block>
              Back to {back.label === 'Itinerary' ? 'the itinerary' : back.label}
            </Button>
          )}
        </div>
        {isWide && (
          <aside className="p07-side">
            {lock}
            {crowd}
            <Button to={back.to} variant="secondary" block>
              Back to {back.label === 'Itinerary' ? 'the itinerary' : back.label}
            </Button>
          </aside>
        )}
      </div>
    </div>
  );
}
