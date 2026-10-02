/**
 * One idea (Page 9): photo, name, kind · area, the "Since you planned …, you
 * might also like …" reason, fit chips, suggested slot, estimated cost, and
 * the two decisions: "Add to trip" (opens the day/time sheet) or "Not interested".
 *
 * Two layouts:
 *  - 'photo' (tablet/desktop grid): a wide photo on top with the slot on it.
 *  - 'compact' (phones): a square thumbnail beside the name, so a phone
 *    screen shows more than one idea at a time.
 */

import type { ReactNode } from 'react';
import { Accessibility, CalendarCheck, CheckCircle2, ChevronRight, Clock, Footprints, Plus, TriangleAlert, Users, X } from 'lucide-react';
import type { ISODate, Suggestion, Time, Trip } from '../../data/types';
import { PlacePhoto } from '../../components/domain/PlacePhoto';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Display';
import { dayNumber, formatTime } from '../../lib/dates';
import { paths } from '../../router/routes';
import { categoryLine, type FitChip, type FitKind } from './ideas';

const FIT_ICON: Partial<Record<FitKind, ReactNode>> = {
  person: <Users aria-hidden />,
  time: <CalendarCheck aria-hidden />,
  walk: <Footprints aria-hidden />,
  access: <Accessibility aria-hidden />,
  warn: <TriangleAlert aria-hidden />,
};

/** The reason sentence with the planned stop it's based on in bold. */
export function ReasonText({ s }: { s: Suggestion }) {
  const i = s.basedOnLabel ? s.reason.indexOf(s.basedOnLabel) : -1;
  if (i < 0) return <>{s.reason}</>;
  return (
    <>
      {s.reason.slice(0, i)}
      <strong>{s.basedOnLabel}</strong>
      {s.reason.slice(i + s.basedOnLabel.length)}
    </>
  );
}

/** The row of fit chips (also used in the Add sheet). */
export function FitChips({ chips, className = '' }: { chips: FitChip[]; className?: string }) {
  if (chips.length === 0) return null;
  return (
    <ul className={`p09-fits ${className}`} aria-label="Why it fits">
      {chips.map((c) => (
        <li key={c.label} className={`p09-fit is-${c.kind}`}>
          {FIT_ICON[c.kind]}
          <span>{c.label}</span>
        </li>
      ))}
    </ul>
  );
}

export interface SuggestionCardProps {
  suggestion: Suggestion;
  trip: Trip;
  fits: FitChip[];
  /** "Day 2 · 2:20–2:50 PM" */
  slot: string;
  isToday: boolean;
  /** The suggested time already started (during the trip). */
  passed: boolean;
  cost: string | null;
  layout: 'photo' | 'compact';
  /** Lock reason for Viewers / past trips (false = can add). */
  addLocked: string | false;
  /** Set when this idea was added during this visit (the card stays, showing where it went). */
  added?: { date: ISODate; start: Time };
  onAdd: () => void;
  onDecline: () => void;
}

export function SuggestionCard({ suggestion: s, trip, fits, slot, isToday, passed, cost, layout, addLocked, added, onAdd, onDecline }: SuggestionCardProps) {
  const titleId = `p09-card-${s.id}`;
  const slotLine = (
    <>
      <Clock aria-hidden />
      <span className="num">{slot}</span>
      {isToday && !passed && <span className="p09-slot-today">Today</span>}
    </>
  );
  const passedBadge = passed ? (
    <Badge tone="warning" className="p09-passed">
      {isToday ? 'Earlier today' : 'Day has passed'}
    </Badge>
  ) : null;

  return (
    <article className={`p09-card is-${layout} ${added ? 'is-added' : ''}`} aria-labelledby={titleId}>
      {layout === 'photo' && (
        <div className="p09-card-media">
          <PlacePhoto photo={s.place.photo} alt={s.place.name} category={s.place.category} size="full" rounded={false} className="p09-card-photo" />
          <div className="p09-card-overlay">
            <span className="p09-slot-badge">{slotLine}</span>
            {passedBadge}
          </div>
        </div>
      )}
      <div className="p09-card-body">
        <div className="p09-card-top">
          {layout === 'compact' && <PlacePhoto photo={s.place.photo} alt={s.place.name} category={s.place.category} className="p09-card-thumb" />}
          <div className="p09-card-heading">
            <h3 className="p09-card-name" id={titleId}>
              {s.place.name}
            </h3>
            <p className="p09-card-cat">{categoryLine(s)}</p>
            {layout === 'compact' && (
              <>
                <p className="p09-card-slot">{slotLine}</p>
                {passedBadge}
              </>
            )}
            {layout === 'compact' && cost && <p className="p09-card-cost num">{cost}</p>}
          </div>
          {layout === 'photo' && cost && <p className="p09-card-cost is-aside num">{cost}</p>}
        </div>

        <p className="p09-card-reason">
          <ReasonText s={s} />
        </p>

        <FitChips chips={fits} />

        {added ? (
          <div className="p09-added" role="status">
            <CheckCircle2 aria-hidden />
            <span className="grow">
              Added to Day {dayNumber(trip, added.date)} at {formatTime(added.start)}
            </span>
            <Button size="sm" variant="ghost" to={paths.day(trip.id, added.date)} iconRight={<ChevronRight />}>
              View day
            </Button>
          </div>
        ) : (
          <div className="p09-card-actions">
            <Button icon={<Plus />} onClick={onAdd} locked={addLocked} aria-label={`Add to trip: ${s.place.name}`}>
              Add to trip
            </Button>
            <Button variant="ghost" icon={<X />} onClick={onDecline} aria-label={`Not interested: ${s.place.name}`}>
              Not interested
            </Button>
          </div>
        )}
      </div>
    </article>
  );
}
