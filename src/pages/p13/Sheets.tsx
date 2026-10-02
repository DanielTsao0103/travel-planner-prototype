/**
 * Page 13's owner-only dialogs (bottom sheets on phones):
 *   13D RoleSheet   — change someone's role; Day editors pick their days
 *   13E InviteSheet — invite someone by name + email (they start as a Viewer)
 *   13F RemoveSheet — confirm removing someone (or canceling their invite)
 *
 * Every change goes through a store action (setMemberRole, inviteMember,
 * removeMember). Nothing is really sent: toasts say "simulated".
 */

import { useEffect, useState, type FormEvent } from 'react';
import { AlertCircle, Send, UserMinus } from 'lucide-react';
import type { ISODate, Membership, Role, Trip } from '../../data/types';
import { firstName, listJoin, looksLikeEmail } from '../../lib/format';
import { dayNumber } from '../../lib/dates';
import { ROLE_DESCRIPTION, ROLE_LABEL } from '../../lib/permissions';
import { inviteMember, removeMember, setMemberRole } from '../../store/actions';
import { eventsOn, tripDays } from '../../store/selectors';
import { getState, update, useAppState } from '../../store/store';
import { toast } from '../../store/toast';
import { Button } from '../../components/ui/Button';
import { Avatar, DemoBadge, RoleBadge } from '../../components/ui/Display';
import { Checkbox, Field, TextInput } from '../../components/ui/Field';
import { Sheet } from '../../components/ui/Overlay';
import { eventLabel } from '../../components/domain/EventItem';
import { dayLabel, type Member } from './aggregate';

type AssignableRole = Exclude<Role, 'owner'>;

/** "an Editor", "a Day editor", "a Viewer" */
function withArticle(role: AssignableRole): string {
  return `${role === 'editor' ? 'an' : 'a'} ${ROLE_LABEL[role]}`;
}

/** "Day 3" or "Days 3 and 4" */
function dayNumbers(trip: Trip, days: ISODate[]): string {
  const nums = [...days].sort().map((d) => String(dayNumber(trip, d)));
  return nums.length === 1 ? `Day ${nums[0]}` : `Days ${listJoin(nums)}`;
}

/** Do two lists hold the same days (in any order)? */
function sameDays(a: ISODate[], b: ISODate[]): boolean {
  return a.length === b.length && [...a].sort().join() === [...b].sort().join();
}

/** Who someone is, at the top of a sheet. */
function PersonCard({ member }: { member: Member }) {
  return (
    <div className="p13-sheet-person">
      <Avatar person={member.person} size={40} />
      <div className="p13-sheet-person-text">
        <p className="p13-sheet-person-name">{member.person.name}</p>
        <p className="p13-sheet-person-email truncate">{member.person.email}</p>
      </div>
      <RoleBadge role={member.role} />
    </div>
  );
}

/* ================================================================ 13D */

/** 13D: pick Editor, Day editor (+ days), or Viewer for one person. */
export function RoleSheet({ open, trip, member, onClose, onSaved }: { open: boolean; trip: Trip; member: Member | null; onClose: () => void; onSaved: (personId: string) => void }) {
  const state = useAppState();
  const days = tripDays(trip);
  const [role, setRole] = useState<AssignableRole>('viewer');
  const [picked, setPicked] = useState<ISODate[]>([]);
  const [error, setError] = useState<string | null>(null);
  const personId = member?.person.id;

  // Start from the person's current role each time the sheet opens.
  useEffect(() => {
    if (!open || !member) return;
    setRole(member.role === 'owner' ? 'editor' : member.role);
    setPicked(member.days ?? []);
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, personId]);

  if (!member) return null;
  const first = firstName(member.person.name);
  const currentDays = member.days ?? [];
  const unchanged = role === member.role && (role !== 'day' || sameDays(picked, currentDays));
  const saveLabel = unchanged ? 'Done' : role !== member.role ? `Make ${first} ${withArticle(role)}` : `Update ${first}’s days`;

  const save = () => {
    if (role === 'day' && picked.length === 0) {
      setError(`Pick at least one day ${first} can edit.`);
      return;
    }
    if (unchanged) {
      onClose();
      return;
    }
    const sorted = [...picked].sort();
    setMemberRole(trip.id, member.person.id, role, role === 'day' ? sorted : undefined);
    toast({
      title: role === 'day' ? `${first} is now a Day editor for ${dayNumbers(trip, sorted)}` : `${first} is now ${withArticle(role)}`,
      body: `We’d notify ${first} by email. Simulated: nothing was sent.`,
    });
    onSaved(member.person.id);
  };

  /** "Train to Sintra, Pena Palace +3 more" so the owner knows what each day holds. */
  const daySummary = (date: ISODate): string => {
    const evs = eventsOn(state, trip.id, date);
    if (evs.length === 0) return 'Nothing planned yet';
    const names = evs.slice(0, 2).map(eventLabel).join(', ');
    return evs.length > 2 ? `${names} +${evs.length - 2} more` : names;
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={`Change ${first}’s role`}
      description="Roles decide who can change the plan. Everyone can see it."
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant={unchanged ? 'secondary' : 'primary'} onClick={save}>
            {saveLabel}
          </Button>
        </>
      }
    >
      <div className="stack-md">
        <PersonCard member={member} />
        <fieldset className="p13-role-options">
          <legend className="sr-only">Role for {first}</legend>
          {(['editor', 'day', 'viewer'] as const).map((r) => (
            <div key={r} className={`p13-role-option ${role === r ? 'is-checked' : ''}`}>
              <label className="p13-role-label">
                <input
                  type="radio"
                  name="p13-role"
                  value={r}
                  checked={role === r}
                  // The Sheet focuses [data-autofocus] when it opens: start on the current role.
                  data-autofocus={role === r ? true : undefined}
                  onChange={() => {
                    setRole(r);
                    setError(null);
                  }}
                />
                <span className="p13-radio-dot" aria-hidden />
                <span className="p13-role-text">
                  <span className="p13-role-name">
                    {ROLE_LABEL[r]}
                    {member.role === r && <span className="p13-role-current">Current</span>}
                  </span>
                  <span className="p13-role-desc">{ROLE_DESCRIPTION[r]}</span>
                </span>
              </label>
              {r === 'day' && role === 'day' && (
                <fieldset className="p13-day-pick" aria-describedby={error ? 'p13-days-error' : undefined}>
                  <legend className="p13-day-legend">Days {first} can edit</legend>
                  <div className="p13-day-list">
                    {days.map((d) => (
                      <Checkbox
                        key={d}
                        label={dayLabel(trip, d)}
                        description={daySummary(d)}
                        checked={picked.includes(d)}
                        onChange={(checked) => {
                          setPicked((prev) => (checked ? [...prev, d] : prev.filter((x) => x !== d)));
                          setError(null);
                        }}
                      />
                    ))}
                  </div>
                  {error && (
                    <p id="p13-days-error" className="field-error" role="alert">
                      <AlertCircle aria-hidden />
                      <span>{error}</span>
                    </p>
                  )}
                </fieldset>
              )}
            </div>
          ))}
        </fieldset>
        <p className="p13-sim-note">
          <DemoBadge />
          <span>We’d let {first} know about the change. Nothing is sent in this prototype.</span>
        </p>
      </div>
    </Sheet>
  );
}

/* ================================================================ 13E */

/** 13E: invite someone by name and email; they join as a pending Viewer. */
export function InviteSheet({ open, trip, onClose, onInvited }: { open: boolean; trip: Trip; onClose: () => void; onInvited: (personId: string | null) => void }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [errors, setErrors] = useState<{ name?: string; email?: string }>({});

  // Fresh, empty form every time it opens.
  useEffect(() => {
    if (!open) return;
    setName('');
    setEmail('');
    setErrors({});
  }, [open]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const next: { name?: string; email?: string } = {};
    if (!name.trim()) next.name = 'Enter their name so the group knows who’s coming.';
    if (!email.trim()) next.email = 'Enter their email address.';
    else if (!looksLikeEmail(email)) next.email = 'Enter a full email address, like alex@example.com.';
    if (next.name || next.email) {
      setErrors(next);
      return;
    }
    const result = inviteMember(trip.id, name.trim(), email.trim());
    const person = getState().people.find((p) => p.email.toLowerCase() === email.trim().toLowerCase());
    if (!result.ok) {
      setErrors({ email: `${person?.name ?? 'Someone with this email'} is already on this trip.` });
      return;
    }
    toast({ title: 'Invitation simulated', body: `No email was sent. ${firstName(name.trim())} shows as a pending Viewer.` });
    onInvited(person?.id ?? null);
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Invite people"
      description={`Add someone to ${trip.title}.`}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="p13-invite-form" icon={<Send />}>
            Send invite
          </Button>
        </>
      }
    >
      <form id="p13-invite-form" className="stack-md" onSubmit={submit} noValidate>
        <Field label="Name" error={errors.name} required>
          {(p) => (
            <TextInput
              {...p}
              data-autofocus
              value={name}
              autoComplete="off"
              placeholder="Alex Kim"
              onChange={(e) => {
                setName(e.target.value);
                setErrors((x) => ({ ...x, name: undefined }));
              }}
            />
          )}
        </Field>
        <Field label="Email" error={errors.email} required>
          {(p) => (
            <TextInput
              {...p}
              type="email"
              inputMode="email"
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              value={email}
              placeholder="alex@example.com"
              onChange={(e) => {
                setEmail(e.target.value);
                setErrors((x) => ({ ...x, email: undefined }));
              }}
            />
          )}
        </Field>
        <div className="p13-invite-info">
          <RoleBadge role="viewer" />
          <p>New people join as Viewers: they can see the plan but can’t change it. You can change their role anytime.</p>
        </div>
        <p className="p13-sim-note">
          <DemoBadge />
          <span>Invitations are simulated. No email is sent.</span>
        </p>
      </form>
    </Sheet>
  );
}

/* ================================================================ 13F */

/**
 * Undo for "Remove": put the exact membership (role, days, status) back.
 * There is no shared store action for this, so it uses the store's `update`
 * escape hatch (see docs/ARCHITECTURE.md). It also drops the simulated
 * "you were removed" message, since the removal never really happened.
 */
function restoreMembership(tripId: string, membership: Membership): void {
  update((draft) => {
    const trip = draft.trips.find((t) => t.id === tripId);
    if (!trip || trip.members.some((m) => m.personId === membership.personId)) return;
    trip.members.push({ ...membership });
    const index = draft.messages.map((m) => m.kind === 'removed' && m.tripId === tripId && m.toPersonId === membership.personId).lastIndexOf(true);
    if (index >= 0) draft.messages.splice(index, 1);
  });
}

/** 13F: confirm removing someone (or canceling a pending invite), with Undo in the toast. */
export function RemoveSheet({ open, trip, member, onClose, onRemoved }: { open: boolean; trip: Trip; member: Member | null; onClose: () => void; onRemoved: () => void }) {
  if (!member) return null;
  const first = firstName(member.person.name);
  const pending = member.status === 'pending';

  const remove = () => {
    const snapshot = trip.members.find((m) => m.personId === member.person.id);
    removeMember(trip.id, member.person.id);
    toast({
      title: pending ? `${first}’s invitation was canceled` : `${first} was removed from the trip`,
      body: `We’d let ${first} know. Simulated: nothing was sent.`,
      duration: 7000,
      action: snapshot ? { label: 'Undo', onClick: () => restoreMembership(trip.id, snapshot) } : undefined,
    });
    onRemoved();
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={pending ? `Cancel ${first}’s invitation?` : `Remove ${first} from the trip?`}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {pending ? 'Keep invite' : 'Cancel'}
          </Button>
          <Button variant="danger" icon={<UserMinus />} onClick={remove}>
            {pending ? 'Cancel invitation' : `Remove ${first}`}
          </Button>
        </>
      }
    >
      <div className="stack-md">
        <PersonCard member={member} />
        <ul className="p13-consequences">
          {pending ? (
            <>
              <li>{first} won’t be able to join with this invitation.</li>
              <li>You can invite {first} again later.</li>
            </>
          ) : (
            <>
              <li>
                {first} loses access to {trip.title}.
              </li>
              <li>{first}’s preferences stop counting toward the group tiles.</li>
              <li>Events, expenses, and to-dos {first} added stay on the trip.</li>
            </>
          )}
        </ul>
        <p className="p13-sim-note">
          <DemoBadge />
          <span>We’d let {first} know. Nothing is sent in this prototype.</span>
        </p>
      </div>
    </Sheet>
  );
}
