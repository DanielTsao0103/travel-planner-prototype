/**
 * "Invite people" (Page 6, create mode): name + email + Add, then the list of
 * everyone on the trip. Per the doc, nobody's permissions are set here:
 * everyone invited starts as a Viewer, and roles change later on Page 13.
 *
 * The parent form owns the inputs' state so that an email typed but not yet
 * "Added" can still be included (or flagged) when the trip is saved.
 */

import type { KeyboardEvent, Ref } from 'react';
import { ShieldCheck, UserPlus, X } from 'lucide-react';
import type { Person } from '../../data/types';
import { looksLikeEmail } from '../../lib/format';
import { Button, IconButton } from '../../components/ui/Button';
import { Avatar, DemoBadge, RoleBadge } from '../../components/ui/Display';
import { Field } from '../../components/ui/Field';

export interface Invitee {
  name: string;
  email: string;
}

/** Avatar colors for invitees (the owner keeps their own color). */
const INVITE_COLORS = ['av-2', 'av-3', 'av-4', 'av-5', 'av-6', 'av-7', 'av-8'];

/** The name we show for an invitee: their name, or the part of the email before "@". */
export function inviteeLabel(inv: Invitee): string {
  return inv.name.trim() || inv.email.split('@')[0];
}

/** Invitees as avatar-ready people (for the preview's avatar stack). */
export function inviteesAsPeople(invitees: Invitee[]): Array<Pick<Person, 'id' | 'name' | 'color'>> {
  return invitees.map((inv, i) => ({ id: `invitee-${inv.email}`, name: inviteeLabel(inv), color: INVITE_COLORS[i % INVITE_COLORS.length] }));
}

/** Check one invite before adding it. Returns an error message, or null when it's fine. */
export function checkInvite(email: string, invitees: Invitee[], ownerEmail?: string): string | null {
  const e = email.trim();
  if (!e) return 'Enter an email address to invite someone';
  if (!looksLikeEmail(e)) return 'Enter an email like name@example.com';
  if (ownerEmail && e.toLowerCase() === ownerEmail.toLowerCase()) return 'That’s your email. You’re already on this trip as the Owner.';
  if (invitees.some((i) => i.email.toLowerCase() === e.toLowerCase())) return `${e} is already on the list`;
  return null;
}

export interface InviteFieldsProps {
  me: Person | null;
  invitees: Invitee[];
  name: string;
  email: string;
  error: string | null;
  onName: (v: string) => void;
  onEmail: (v: string) => void;
  onAdd: () => void;
  onRemove: (email: string) => void;
  nameRef?: Ref<HTMLInputElement>;
  emailRef?: Ref<HTMLInputElement>;
  disabled?: boolean;
}

/** Name + email + Add, the list of people (you as Owner, invitees as Viewers), and the notes. */
export function InviteFields({ me, invitees, name, email, error, onName, onEmail, onAdd, onRemove, nameRef, emailRef, disabled }: InviteFieldsProps) {
  // Enter in either box adds the person instead of submitting the trip.
  const addOnEnter = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      onAdd();
    }
  };

  return (
    <div className="p06-invite">
      <div className="p06-invite-row">
        <Field label="Name" className="p06-invite-name">
          {(p) => (
            // A plain <input class="input"> (same look as TextInput) so we can attach a ref for focusing.
            <input
              {...p}
              ref={nameRef}
              className="input"
              value={name}
              onChange={(e) => onName(e.target.value)}
              onKeyDown={addOnEnter}
              placeholder="Jordan Reyes"
              autoComplete="off"
              autoCapitalize="words"
              disabled={disabled}
            />
          )}
        </Field>
        <Field label="Email" error={error} className="p06-invite-email">
          {(p) => (
            <input
              {...p}
              ref={emailRef}
              className="input"
              type="email"
              inputMode="email"
              value={email}
              onChange={(e) => onEmail(e.target.value)}
              onKeyDown={addOnEnter}
              placeholder="name@example.com"
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              disabled={disabled}
            />
          )}
        </Field>
        <Button variant="secondary" icon={<UserPlus />} onClick={onAdd} className="p06-invite-add" disabled={disabled}>
          Add
        </Button>
      </div>

      <ul className="p06-people" aria-label="People on this trip">
        {me && (
          <li className="p06-person">
            <Avatar person={me} size={36} />
            <span className="p06-person-text">
              <span className="p06-person-name">{me.name} (you)</span>
              <span className="p06-person-sub">{me.email}</span>
            </span>
            <RoleBadge role="owner" />
            <span className="p06-person-spacer" aria-hidden />
          </li>
        )}
        {invitees.map((inv, i) => (
          <li key={inv.email} className="p06-person">
            <Avatar person={{ name: inviteeLabel(inv), color: INVITE_COLORS[i % INVITE_COLORS.length] }} size={36} />
            <span className="p06-person-text">
              <span className="p06-person-name">{inviteeLabel(inv)}</span>
              <span className="p06-person-sub">{inv.email}</span>
            </span>
            <RoleBadge role="viewer" />
            <IconButton label={`Remove ${inviteeLabel(inv)}`} icon={<X />} onClick={() => onRemove(inv.email)} disabled={disabled} />
          </li>
        ))}
      </ul>

      <div className="p06-invite-notes">
        <p className="p06-note">
          <ShieldCheck aria-hidden />
          <span>Everyone you invite starts as a Viewer. You can change permissions on the Collaborators page after you create the trip.</span>
        </p>
        <p className="p06-note">
          <DemoBadge>Simulated</DemoBadge>
          <span>We’ll show them as invited. No email is sent in this prototype.</span>
        </p>
      </div>
    </div>
  );
}
