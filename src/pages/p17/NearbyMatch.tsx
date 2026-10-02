/**
 * Shown on the map after someone taps "Go" on the nearby pop-up (Page 16):
 * how close the match is, why it fits the group, and "Add to today’s plan".
 * Viewers (and day editors on other days) see the button locked, with the reason.
 */

import { CalendarCheck, CalendarPlus, Check, Radar } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import type { TripEvent } from '../../data/types';
import { formatTime } from '../../lib/dates';
import { distanceLabel } from '../../lib/format';
import { Link } from '../../router/router';
import { splitReason } from './placeText';

export interface NearbyMatchProps {
  /** Straight-line meters from the traveler (the "within ~500 ft" check). */
  straightM: number;
  /** Already personalized reasons ("Local favorite · You, Jordan"). */
  reasons: string[];
  /** Today's event at this place, once it has been added. */
  addedEvent?: TripEvent;
  /** "Day 2" when the trip is happening (adding needs a "today"). */
  dayLabel: string | null;
  /** Path to today's Day page. */
  dayPath: string | null;
  /** Start time the new stop would get ('14:25'). */
  addAt: string;
  canAdd: boolean;
  lockReason: string;
  onAdd: () => void;
  compact?: boolean;
}

export function NearbyMatch(props: NearbyMatchProps) {
  const { straightM, reasons, addedEvent, dayLabel, dayPath, addAt, canAdd, lockReason, onAdd, compact } = props;
  return (
    <div className={`p17-nearby ${compact ? 'is-compact' : ''}`}>
      <p className="p17-nearby-line num">
        <Radar aria-hidden />
        <span>
          {distanceLabel(straightM)} away in a straight line. We suggest places within about 500 ft of you.
        </span>
      </p>
      {reasons.length > 0 && (
        <ul className="p17-reasons" aria-label="Why it fits your group">
          {reasons.map((r) => {
            const { need, who } = splitReason(r);
            return (
              <li key={r} className="p17-reason">
                <Check aria-hidden />
                <span className="p17-reason-text">
                  <span className="p17-reason-need">{need}</span>
                  {who && <span className="p17-reason-who">{who}</span>}
                </span>
              </li>
            );
          })}
        </ul>
      )}
      {addedEvent ? (
        <div className="p17-added">
          <CalendarCheck aria-hidden />
          <span className="grow">
            In today’s plan at <strong className="num">{formatTime(addedEvent.start)}</strong>
          </span>
          {dayPath && dayLabel && (
            <Link to={dayPath} className="p17-added-link">
              Open {dayLabel}
            </Link>
          )}
        </div>
      ) : dayLabel ? (
        <div className="stack-xs">
          <Button block icon={<CalendarPlus />} onClick={onAdd} locked={canAdd ? false : lockReason}>
            Add to today’s plan
          </Button>
          {canAdd && !compact && <p className="xsmall muted p17-add-hint num">Adds a 30-minute stop at {formatTime(addAt)} on {dayLabel}.</p>}
        </div>
      ) : null}
    </div>
  );
}
