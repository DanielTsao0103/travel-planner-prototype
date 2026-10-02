/**
 * A pending trip invitation (Page 5): cover photo, the trip's facts, who
 * invited you, and Accept / Decline.
 *
 * Declining removes the trip from your list, so it asks for a quick inline
 * confirmation first (no pop-up dialog: the question appears right where the
 * buttons were, which keeps the flow on one surface on phones too).
 */

import { useEffect, useRef, useState } from 'react';
import { CalendarDays, Check, MapPin } from 'lucide-react';
import type { Person, Role, Trip } from '../../data/types';
import { formatDateRange, relativeDays } from '../../lib/dates';
import { firstName, plural } from '../../lib/format';
import { ROLE_LABEL } from '../../lib/permissions';
import { PlacePhoto } from '../../components/domain/PlacePhoto';
import { Button } from '../../components/ui/Button';
import { Avatar, AvatarStack, Badge } from '../../components/ui/Display';

export interface InviteCardProps {
  trip: Trip;
  /** The person who sent the invitation (falls back to the trip owner). */
  inviter: Person | undefined;
  /** People who already accepted, shown as an avatar stack. */
  people: Person[];
  /** The role you'll have once you accept (invitees start as Viewers). */
  role: Role;
  /** Demo "today", for the "starts in N days" countdown. */
  today: string;
  onAccept: () => void;
  onDecline: () => void;
}

/** One invitation card with Accept / Decline (and an inline "are you sure?" for Decline). */
export function InviteCard({ trip, inviter, people, role, today, onAccept, onDecline }: InviteCardProps) {
  const [confirming, setConfirming] = useState(false);
  const keepRef = useRef<HTMLButtonElement>(null);
  const declineRef = useRef<HTMLButtonElement>(null);
  const wasConfirming = useRef(false);
  const inviterName = inviter?.name ?? 'Someone';
  const titleId = `p05-invite-${trip.id}`;

  // Move keyboard focus into the confirmation, and back to "Decline" if they keep it.
  useEffect(() => {
    if (confirming) keepRef.current?.focus();
    else if (wasConfirming.current) declineRef.current?.focus();
    wasConfirming.current = confirming;
  }, [confirming]);

  return (
    <article className="p05-invite" aria-labelledby={titleId}>
      <div className="p05-invite-media">
        <PlacePhoto photo={trip.coverPhoto} alt="" category="landmark" size="full" rounded={false} className="p05-invite-photo" />
        <Badge tone="info" className="p05-invite-flag">
          Invitation
        </Badge>
      </div>

      <div className="p05-invite-body">
        <p className="p05-invite-from">
          {inviter && <Avatar person={inviter} size={26} />}
          <span>
            <strong>{inviterName}</strong> invited you
          </span>
        </p>
        <h3 id={titleId} className="p05-invite-title">
          {trip.title}
        </h3>
        <p className="p05-invite-line">
          <MapPin aria-hidden />
          <span className="truncate">{trip.destinations.map((d) => d.name).join(' · ')}</span>
        </p>
        <p className="p05-invite-line num">
          <CalendarDays aria-hidden />
          <span>
            {formatDateRange(trip.startDate, trip.endDate)} · starts {relativeDays(today, trip.startDate)}
          </span>
        </p>
        <div className="p05-invite-meta">
          <AvatarStack people={people} size={24} max={4} />
          <span>
            {plural(people.length, 'person', 'people')} going · you’d join as a {ROLE_LABEL[role]}
          </span>
        </div>
      </div>

      <div className="p05-invite-actions">
        {confirming ? (
          <div className="p05-decline" role="group" aria-label="Confirm declining the invitation">
            <p className="p05-decline-text">
              Decline {firstName(inviterName)}’s invitation? {trip.title} won’t appear in your trips.
            </p>
            <div className="p05-decline-buttons">
              <Button variant="danger" onClick={onDecline}>
                Decline invitation
              </Button>
              <Button variant="ghost" ref={keepRef} onClick={() => setConfirming(false)}>
                Keep it
              </Button>
            </div>
          </div>
        ) : (
          <>
            <Button onClick={onAccept} icon={<Check />} aria-label={`Accept the invitation to ${trip.title}`}>
              Accept
            </Button>
            <Button variant="secondary" ref={declineRef} onClick={() => setConfirming(true)} aria-label={`Decline the invitation to ${trip.title}`}>
              Decline
            </Button>
          </>
        )}
      </div>
    </article>
  );
}
