/**
 * Route table. Each route maps to one of the doc's numbered pages.
 * `paths` builds URLs so pages never hand-type them (typos = broken links).
 */

import type { ISODate, ServiceId } from '../data/types';

export type RouteName =
  | 'login'
  | 'signup'
  | 'connect'
  | 'connect-service'
  | 'home'
  | 'trips'
  | 'trip-new'
  | 'trip-edit'
  | 'event-new'
  | 'event-edit'
  | 'itinerary'
  | 'ideas'
  | 'dashboard'
  | 'day'
  | 'calendar'
  | 'budget'
  | 'budget-current'
  | 'people'
  | 'people-current'
  | 'survey'
  | 'map'
  | 'trip-map'
  | 'proto-index'
  | 'proto-checklist'
  | 'proto-credits'
  | 'not-found';

export interface MatchedRoute {
  name: RouteName;
  /** The doc's page number this route belongs to (0 = prototype tools). */
  page: number;
  params: Record<string, string>;
}

const TABLE: Array<{ name: RouteName; page: number; pattern: string }> = [
  { name: 'login', page: 1, pattern: '/login' },
  { name: 'signup', page: 1, pattern: '/signup' },
  { name: 'connect', page: 2, pattern: '/connect' },
  { name: 'connect-service', page: 3, pattern: '/connect/:service' },
  { name: 'home', page: 4, pattern: '/home' },
  { name: 'trips', page: 5, pattern: '/trips' },
  { name: 'trip-new', page: 6, pattern: '/trips/new' },
  { name: 'trip-edit', page: 6, pattern: '/trip/:tripId/edit' },
  { name: 'event-new', page: 7, pattern: '/trip/:tripId/event/new' },
  { name: 'event-edit', page: 7, pattern: '/trip/:tripId/event/:eventId' },
  { name: 'ideas', page: 9, pattern: '/trip/:tripId/ideas' },
  { name: 'dashboard', page: 10, pattern: '/trip/:tripId/dashboard' },
  { name: 'day', page: 11, pattern: '/trip/:tripId/day/:date' },
  { name: 'calendar', page: 11, pattern: '/calendar' },
  { name: 'budget', page: 12, pattern: '/trip/:tripId/budget' },
  { name: 'budget-current', page: 12, pattern: '/budget' },
  { name: 'people', page: 13, pattern: '/trip/:tripId/people' },
  { name: 'people-current', page: 13, pattern: '/people' },
  { name: 'survey', page: 15, pattern: '/survey' },
  { name: 'trip-map', page: 17, pattern: '/trip/:tripId/map' },
  { name: 'map', page: 17, pattern: '/map' },
  { name: 'itinerary', page: 8, pattern: '/trip/:tripId' },
  { name: 'proto-index', page: 0, pattern: '/proto/index' },
  { name: 'proto-checklist', page: 0, pattern: '/proto/checklist' },
  { name: 'proto-credits', page: 0, pattern: '/proto/credits' },
];

export function matchRoute(path: string): MatchedRoute {
  const parts = path.split('/').filter(Boolean);
  for (const r of TABLE) {
    const pat = r.pattern.split('/').filter(Boolean);
    if (pat.length !== parts.length) continue;
    const params: Record<string, string> = {};
    let ok = true;
    for (let i = 0; i < pat.length; i++) {
      if (pat[i].startsWith(':')) params[pat[i].slice(1)] = decodeURIComponent(parts[i]);
      else if (pat[i] !== parts[i]) {
        ok = false;
        break;
      }
    }
    if (ok) return { name: r.name, page: r.page, params };
  }
  return { name: 'not-found', page: 0, params: {} };
}

/** Routes you can see without signing in. */
export const PUBLIC_ROUTES: RouteName[] = ['login', 'signup', 'proto-index', 'proto-checklist', 'proto-credits', 'not-found'];

/** URL builders. */
export const paths = {
  login: () => '/login',
  signup: () => '/signup',
  connect: () => '/connect',
  connectService: (service: ServiceId) => `/connect/${service}`,
  home: () => '/home',
  trips: () => '/trips',
  newTrip: () => '/trips/new',
  editTrip: (tripId: string) => `/trip/${tripId}/edit`,
  newEvent: (tripId: string) => `/trip/${tripId}/event/new`,
  event: (tripId: string, eventId: string) => `/trip/${tripId}/event/${eventId}`,
  itinerary: (tripId: string) => `/trip/${tripId}`,
  ideas: (tripId: string) => `/trip/${tripId}/ideas`,
  dashboard: (tripId: string) => `/trip/${tripId}/dashboard`,
  day: (tripId: string, date: ISODate) => `/trip/${tripId}/day/${date}`,
  calendar: () => '/calendar',
  budget: (tripId: string) => `/trip/${tripId}/budget`,
  budgetCurrent: () => '/budget',
  people: (tripId: string) => `/trip/${tripId}/people`,
  peopleCurrent: () => '/people',
  survey: () => '/survey',
  map: () => '/map',
  tripMap: (tripId: string) => `/trip/${tripId}/map`,
  protoIndex: () => '/proto/index',
  protoChecklist: () => '/proto/checklist',
  protoCredits: () => '/proto/credits',
};
