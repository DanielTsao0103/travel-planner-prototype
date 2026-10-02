/**
 * Live preview of the trip while you fill in the form (Page 6).
 *  - `card`: a TripCard look-alike for the desktop side column, plus what happens next
 *  - `compact`: a single summary row for phones, shown above the Save bar
 * Empty fields show gentle placeholders so the preview never looks broken.
 */

import type { ReactNode } from 'react';
import { CalendarDays, ImagePlus, MapPin } from 'lucide-react';
import type { Destination, ISODate, Person } from '../../data/types';
import { daysBetween, formatDateRange, relativeDays } from '../../lib/dates';
import { plural } from '../../lib/format';
import { PlacePhoto } from '../../components/domain/PlacePhoto';
import { AvatarStack, Badge, RoleBadge, Skeleton } from '../../components/ui/Display';
import type { CoverState } from './coverPhoto';

export interface TripPreviewProps {
  title: string;
  destinations: Destination[];
  startDate: ISODate | '';
  endDate: ISODate | '';
  /** You first, then everyone invited. */
  people: Array<Pick<Person, 'id' | 'name' | 'color'>>;
  cover: CoverState;
  today: ISODate;
  variant?: 'card' | 'compact';
  /** Edit mode hides the "what happens next" list. */
  showNextSteps?: boolean;
  /** Extra content under the card (the desktop Save / Cancel buttons). */
  children?: ReactNode;
  /** Overrides "You + 2 invited" (edit mode shows everyone on the trip). */
  peopleLabel?: string;
}

/** True when both dates are filled in and in order. */
function hasRange(start: string, end: string): boolean {
  return !!start && !!end && end >= start;
}

/** The preview card (or compact row) built from whatever the form has so far. */
export function TripPreview({ title, destinations, startDate, endDate, people, cover, today, variant = 'card', showNextSteps = true, children, peopleLabel }: TripPreviewProps) {
  const name = title.trim();
  const where = destinations.map((d) => d.name).join(' · ');
  const range = hasRange(startDate, endDate);
  const days = range ? daysBetween(startDate, endDate) + 1 : 0;
  const invited = Math.max(0, people.length - 1);

  const photo =
    cover.status === 'idle' ? (
      // No destination yet: explain where the cover photo will come from.
      <span className="p06-preview-empty">
        <ImagePlus aria-hidden />
        {variant === 'card' && <span>Add a destination to see a cover photo</span>}
      </span>
    ) : cover.status === 'loading' ? (
      <Skeleton width="100%" height="100%" radius={0} className="p06-preview-skel" />
    ) : (
      <PlacePhoto photo={cover.status === 'ready' ? cover.photo : undefined} alt="" category="landmark" size="full" rounded={false} className="p06-preview-photo" />
    );

  if (variant === 'compact') {
    return (
      <div className="p06-preview-compact" aria-label="Trip preview">
        <div className="p06-preview-compact-media">{photo}</div>
        <div className="p06-preview-compact-body">
          <p className={`p06-preview-compact-title ${name ? '' : 'is-placeholder'}`}>{name || 'Your trip name'}</p>
          <p className="p06-preview-line">
            <MapPin aria-hidden />
            <span className="truncate">{where || 'No destination yet'}</span>
          </p>
          <p className="p06-preview-line num">
            <CalendarDays aria-hidden />
            <span className="truncate">{range ? `${formatDateRange(startDate, endDate)} · ${plural(days, 'day')}` : 'No dates yet'}</span>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p06-preview">
      <p className="eyebrow">Preview</p>
      <article className="p06-preview-card" aria-label="Trip preview">
        <div className="p06-preview-media">
          {photo}
          {startDate && startDate >= today && (
            <span className="p06-preview-badges">
              <Badge tone="primary">Starts {relativeDays(today, startDate)}</Badge>
            </span>
          )}
        </div>
        <div className="p06-preview-body">
          <h3 className={`p06-preview-title ${name ? '' : 'is-placeholder'}`}>{name || 'Your trip name'}</h3>
          <p className="p06-preview-line">
            <MapPin aria-hidden />
            <span className="truncate">{where || 'Where are you going?'}</span>
          </p>
          <p className="p06-preview-line num">
            <CalendarDays aria-hidden />
            <span>{range ? `${formatDateRange(startDate, endDate)} · ${plural(days, 'day')}` : 'Pick your dates'}</span>
          </p>
          <div className="row-between p06-preview-foot">
            <span className="row p06-preview-people">
              <AvatarStack people={people} size={26} max={5} />
              <span className="small muted">{peopleLabel ?? (invited ? `You + ${invited} invited` : 'Just you so far')}</span>
            </span>
            <RoleBadge role="owner" />
          </div>
        </div>
      </article>

      {children}

      {showNextSteps && (
        <div className="p06-next">
          <p className="eyebrow">After you create it</p>
          <ol className="p06-next-list">
            <li>Add events to the day-by-day itinerary.</li>
            <li>Choose who can edit on the Collaborators page.</li>
            <li>Everyone shares their food and travel preferences.</li>
          </ol>
        </div>
      )}
    </div>
  );
}
