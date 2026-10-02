/**
 * Page 2 helpers: a checklist status per service, the features each service
 * powers (and whether they're on), and small URL helpers shared with Page 3.
 */

import type { Connection, ServiceId } from '../../data/types';
import { SERVICES, type ServiceInfo } from '../../data/services';

/**
 * What a checklist row shows:
 *  - not-connected      nothing granted yet
 *  - connected          connected with every permission
 *  - needs-permission   connected, but an optional permission is still off
 *  - failed             the last attempt didn't go through
 */
export type RowStatus = 'not-connected' | 'connected' | 'needs-permission' | 'failed';

export function rowStatus(conn: Connection | undefined): RowStatus {
  if (!conn) return 'not-connected';
  if (conn.status === 'connected') return conn.permissions.some((p) => !p.granted) ? 'needs-permission' : 'connected';
  if (conn.status === 'failed') return 'failed';
  return 'not-connected';
}

/** How many permissions are still off on a connected service. */
export function missingCount(conn: Connection | undefined): number {
  return conn?.status === 'connected' ? conn.permissions.filter((p) => !p.granted).length : 0;
}

export function isConnected(conn: Connection | undefined): boolean {
  return conn?.status === 'connected';
}

/** Type guard: is this string one of the four connectable services? */
export function asServiceId(value: string | null | undefined): ServiceId | null {
  return SERVICES.some((s) => s.id === value) ? (value as ServiceId) : null;
}

/**
 * The features a service powers, each tied to the permission it needs.
 * `lostFeatures` in services.ts lists one feature per non-profile permission,
 * in the same order (e.g. Instagram: saved posts → ideas, location tags → map).
 */
export function serviceFeatures(info: ServiceInfo, conn: Connection | undefined): Array<{ text: string; on: boolean }> {
  const featurePerms = info.permissions.filter((p) => p.key !== 'profile');
  return info.lostFeatures.map((text, i) => {
    const key = featurePerms[i]?.key;
    const granted = key ? conn?.permissions.find((p) => p.key === key)?.granted : isConnected(conn);
    return { text, on: isConnected(conn) && !!granted };
  });
}

/**
 * A `?return=` path (e.g. Page 12 sends people here to connect Gmail and
 * expects to get them back). Only in-app paths are accepted.
 */
export function safeReturnPath(raw: string | null): string | null {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//')) return null;
  return raw;
}

/* ------------------------------------------------- "just changed" highlight */

// Page 3 marks the service it just connected (or failed to connect) so Page 2
// can highlight that row on return. Module-level because it only needs to
// survive one navigation, and it shouldn't be saved with the app state.
let justChanged: { service: ServiceId; at: number } | null = null;

export function markJustChanged(service: ServiceId): void {
  justChanged = { service, at: Date.now() };
}

/** True for a few seconds after Page 3 changed this service. */
export function wasJustChanged(service: ServiceId): boolean {
  return !!justChanged && justChanged.service === service && Date.now() - justChanged.at < 4000;
}
