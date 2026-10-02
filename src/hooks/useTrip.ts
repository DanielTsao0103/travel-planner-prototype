/**
 * Load a trip by id for a page, plus the signed-in person's access to it.
 * Also remembers it as the "last opened" trip (used by the current-trip rule).
 */

import { useEffect } from 'react';
import { setLastTrip } from '../store/actions';
import { getTrip, tripAccess } from '../store/selectors';
import { useAppState } from '../store/store';
import type { TripAccess } from '../lib/permissions';
import type { AppState, Trip } from '../data/types';

export interface TripContext {
  state: AppState;
  trip: Trip;
  access: TripAccess;
}

/** Returns null when the trip doesn't exist or the person isn't on it. */
export function useTrip(tripId: string | undefined): TripContext | null {
  const state = useAppState();
  const trip = getTrip(state, tripId);
  const me = state.accounts.find((a) => a.id === state.sessionAccountId)?.personId;
  const isMember = !!trip && trip.members.some((m) => m.personId === me && m.status !== 'declined');

  useEffect(() => {
    if (trip && isMember) setLastTrip(trip.id);
  }, [trip?.id, isMember]);

  if (!trip || !isMember) return null;
  return { state, trip, access: tripAccess(state, trip) };
}
