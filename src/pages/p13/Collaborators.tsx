/**
 * Section 3 of Page 13 — "Collaborators": everyone invited to the trip, their
 * role (Owner, Editor, Day editor + days, Viewer), invite status, and whether
 * they've shared preferences.
 *
 * Only the Owner gets controls (change role, remove, invite). Everyone else
 * sees the same list read-only, with a lock note that explains why.
 */

import { CalendarDays, ChevronDown, CircleCheck, CircleDashed, Mail, UserMinus, UserPlus } from 'lucide-react';
import type { SurveyResponse, Trip } from '../../data/types';
import { formatMonthDay } from '../../lib/dates';
import { firstName } from '../../lib/format';
import { ROLE_DESCRIPTION, ROLE_LABEL, type TripAccess } from '../../lib/permissions';
import { Button } from '../../components/ui/Button';
import { Avatar, Badge, LockNote, RoleBadge } from '../../components/ui/Display';
import { daysLabel, type Member } from './aggregate';

export interface CollaboratorsProps {
  trip: Trip;
  access: TripAccess;
  members: Member[];
  surveys: Record<string, SurveyResponse>;
  /** Row to briefly highlight (just invited or role just changed). */
  flashId: string | null;
  /** Briefly highlight the whole panel (deep link to ?section=collaborators on desktop). */
  flashPanel?: boolean;
  /** Desktop: shown as the sticky right-hand rail. */
  rail?: boolean;
  onInvite: () => void;
  onChangeRole: (personId: string) => void;
  onRemove: (personId: string) => void;
}

/** The collaborators list with its header (count + Invite) and the role guide. */
export function Collaborators({ trip, access, members, surveys, flashId, flashPanel, rail, onInvite, onChangeRole, onRemove }: CollaboratorsProps) {
  const canManage = access.canManagePeople;
  const lockReason = access.lockReason('managePeople');
  const acceptedCount = members.filter((m) => m.status === 'accepted').length;
  const pendingCount = members.filter((m) => m.status === 'pending').length;

  return (
    <section id="p13-people" className={`p13-collab ${rail ? 'is-rail' : ''} ${flashPanel ? 'is-flash' : ''}`} aria-labelledby="p13-people-title">
      <div className="p13-collab-head">
        <div className="p13-collab-heading">
          <h2 id="p13-people-title" className="p13-section-title" tabIndex={-1}>
            Collaborators
          </h2>
          <p className="p13-collab-count">
            {acceptedCount} on the trip{pendingCount ? ` · ${pendingCount} invite${pendingCount === 1 ? '' : 's'} pending` : ''}
          </p>
        </div>
        {canManage ? (
          <Button size="sm" variant="secondary" icon={<UserPlus />} onClick={onInvite}>
            Invite
          </Button>
        ) : (
          <Button size="sm" variant="secondary" locked={lockReason}>
            Invite
          </Button>
        )}
      </div>

      {!canManage && <LockNote>{lockReason} Roles are shown read-only.</LockNote>}

      <ul className="p13-members">
        {members.map((m) => (
          <MemberRow
            key={m.person.id}
            member={m}
            trip={trip}
            isActing={m.person.id === access.actingPersonId}
            hasSurvey={!!surveys[m.person.id]}
            canManage={canManage}
            flash={flashId === m.person.id}
            onChangeRole={() => onChangeRole(m.person.id)}
            onRemove={() => onRemove(m.person.id)}
          />
        ))}
      </ul>

      <details className="p13-roles-help">
        <summary>
          <span>What each role can do</span>
          <ChevronDown aria-hidden />
        </summary>
        <dl>
          {(['owner', 'editor', 'day', 'viewer'] as const).map((r) => (
            <div key={r}>
              <dt>
                <RoleBadge role={r} />
              </dt>
              <dd>{ROLE_DESCRIPTION[r]}</dd>
            </div>
          ))}
        </dl>
        <p className="p13-roles-foot">New people always join as Viewers.</p>
      </details>
    </section>
  );
}

/** One person: avatar, name, email, role (a button for the Owner), and invite/survey status. */
function MemberRow({
  member,
  trip,
  isActing,
  hasSurvey,
  canManage,
  flash,
  onChangeRole,
  onRemove,
}: {
  member: Member;
  trip: Trip;
  isActing: boolean;
  hasSurvey: boolean;
  canManage: boolean;
  flash: boolean;
  onChangeRole: () => void;
  onRemove: () => void;
}) {
  const { person, role, status, days } = member;
  const pending = status === 'pending';
  const isOwnerRow = role === 'owner';
  const manageable = canManage && !isOwnerRow;
  const first = firstName(person.name);
  const invitedAt = trip.members.find((x) => x.personId === person.id)?.invitedAt;

  return (
    <li className={`p13-member ${pending ? 'is-pending' : ''} ${flash ? 'is-flash' : ''}`}>
      <span className="p13-member-avatar">
        <Avatar person={person} size={40} />
      </span>
      <div className="p13-member-main">
        <div className="p13-member-top">
          <p className="p13-member-name">
            <span className="truncate">{person.name}</span>
            {isActing && <span className="p13-you">(you)</span>}
          </p>
          {manageable && (
            <Button size="sm" variant="ghost" icon={<UserMinus />} className="p13-remove" onClick={onRemove} aria-label={pending ? `Cancel invite for ${first}` : `Remove ${first} from the trip`}>
              {pending ? 'Cancel invite' : 'Remove'}
            </Button>
          )}
        </div>
        <p className="p13-member-email truncate" title={person.email}>
          {person.email}
        </p>
        <div className="p13-member-meta">
          {manageable ? (
            <button type="button" className="p13-role-btn" onClick={onChangeRole} aria-haspopup="dialog" aria-label={`Change ${first}’s role. Currently ${ROLE_LABEL[role]}`}>
              <span className={`badge role-badge role-${role}`}>
                {ROLE_LABEL[role]}
                <ChevronDown aria-hidden />
              </span>
            </button>
          ) : (
            <RoleBadge role={role} />
          )}
          {role === 'day' && (
            <span className="p13-member-days num">
              <CalendarDays aria-hidden />
              {daysLabel(trip, days ?? [])}
            </span>
          )}
          {pending ? (
            <>
              <Badge tone="warning" icon={<Mail aria-hidden />}>
                Invite pending
              </Badge>
              {invitedAt && <span className="p13-member-sent">Sent {formatMonthDay(invitedAt.slice(0, 10))}</span>}
            </>
          ) : hasSurvey ? (
            <span className="p13-survey-done">
              <CircleCheck aria-hidden /> Shared preferences
            </span>
          ) : (
            <span className="p13-survey-missing">
              <CircleDashed aria-hidden /> No preferences yet
            </span>
          )}
        </div>
      </div>
    </li>
  );
}
