/**
 * Who can do what on a trip (plan §6 G6).
 *
 *  Owner      everything; the only role that can edit trip info, manage people,
 *             and set the budget mode/amount.
 *  Editor     add/edit/delete events, add suggestions, manage to-dos — any day.
 *  Day editor the same as Editor, but only on their assigned days; Viewer elsewhere.
 *  Viewer     read-only plan.
 *  Everyone   their own survey, their own expenses, "I paid for…", Go/No on
 *             nearby pop-ups. Only the person who is owed can mark a repayment paid.
 *
 * Past trips are view-only for the plan (the budget stays usable so people can settle up).
 */

import type { ISODate, Membership, Role, Trip } from '../data/types';
import { eachDay } from './dates';

export const ROLE_LABEL: Record<Role, string> = {
  owner: 'Owner',
  editor: 'Editor',
  day: 'Day editor',
  viewer: 'Viewer',
};

export const ROLE_DESCRIPTION: Record<Role, string> = {
  owner: 'Hosts the trip. Can change trip details, people, permissions, and the budget.',
  editor: 'Can add and edit events, accept suggestions, and manage to-dos on any day.',
  day: 'Can add and edit events only on the days they are assigned. View-only elsewhere.',
  viewer: 'Can see everything and log their own expenses, but can’t change the plan.',
};

export type LockedAction =
  | 'editTrip'
  | 'managePeople'
  | 'setBudget'
  | 'editEvents'
  | 'editThisDay'
  | 'manageTodos';

export interface TripAccess {
  trip: Trip;
  /** Effective role after the prototype's "View as" override. */
  role: Role;
  /** Person the app treats as "you" on this trip. */
  actingPersonId: string;
  membership: Membership | undefined;
  /** True when the "View as" prototype tool is changing the role. */
  isViewAs: boolean;
  isPast: boolean;
  canEditTrip: boolean;
  canManagePeople: boolean;
  canSetBudget: boolean;
  /** Owner/editor (and not a past trip). */
  canEditAnyDay: boolean;
  /** Days this person may add/edit events on. */
  editableDays: ISODate[];
  canEditDay: (date: ISODate) => boolean;
  /** At least one editable day. */
  canAddEvents: boolean;
  canManageTodos: boolean;
  /** Any accepted member can log expenses / "I paid for…" (their own money). */
  canLogExpenses: boolean;
  /** Plain-language reason a control is locked (for tooltips/banners). */
  lockReason: (action: LockedAction) => string;
}

/** Build the access object for one trip. `ownerName` is used in lock messages. */
export function buildTripAccess(params: {
  trip: Trip;
  actingPersonId: string;
  role: Role;
  isViewAs: boolean;
  today: ISODate;
  ownerName: string;
}): TripAccess {
  const { trip, actingPersonId, role, isViewAs, today, ownerName } = params;
  const membership = trip.members.find((m) => m.personId === actingPersonId);
  const isPast = today > trip.endDate;
  const allDays = eachDay(trip.startDate, trip.endDate);

  const isOwner = role === 'owner';
  const isEditor = role === 'editor';
  const isDayEditor = role === 'day';

  const editableDays = isPast
    ? []
    : isOwner || isEditor
      ? allDays
      : isDayEditor
        ? (membership?.days ?? []).filter((d) => allDays.includes(d))
        : [];

  const canEditDay = (date: ISODate) => editableDays.includes(date);

  const lockReason = (action: LockedAction): string => {
    if (isPast && action !== 'managePeople' && action !== 'setBudget') {
      return 'This trip has ended, so its plan is view-only.';
    }
    switch (action) {
      case 'editTrip':
        return `Only ${ownerName} (the trip owner) can change the trip’s details.`;
      case 'managePeople':
        return `Only ${ownerName} (the trip owner) can invite people or change permissions.`;
      case 'setBudget':
        return `Only ${ownerName} (the trip owner) can set the budget.`;
      case 'editThisDay':
        return isDayEditor
          ? `You can edit only the day${(membership?.days?.length ?? 0) > 1 ? 's' : ''} you’re assigned. Ask ${ownerName} for access.`
          : `You’re a Viewer on this trip. Ask ${ownerName} to make you an Editor.`;
      case 'editEvents':
      case 'manageTodos':
      default:
        return role === 'viewer'
          ? `You’re a Viewer on this trip. Ask ${ownerName} to make you an Editor.`
          : `You don’t have permission to do that. Ask ${ownerName}.`;
    }
  };

  return {
    trip,
    role,
    actingPersonId,
    membership,
    isViewAs,
    isPast,
    canEditTrip: isOwner && !isPast,
    canManagePeople: isOwner,
    canSetBudget: isOwner,
    canEditAnyDay: (isOwner || isEditor) && !isPast,
    editableDays,
    canEditDay,
    canAddEvents: editableDays.length > 0,
    canManageTodos: (isOwner || isEditor || isDayEditor) && !isPast,
    canLogExpenses: membership?.status === 'accepted' || isOwner,
    lockReason,
  };
}
