/**
 * Page 16 — Nearby suggestion pop-up.
 *
 * Doc: "pop up asking if they would like to add suggested event. Behind the
 * scenes, the system is automatically scanning the area that the user is
 * located in, within 500 ft or so, and finding a match to their trip
 * preferences and restrictions … allows the user to click, go or no. If the
 * user selects go, it immediately pulls up the app into the map interface and
 * routes to the location that is matched. These locations should usually be a
 * 5 minute walk away."
 *
 * How it works here:
 *  - `triggerNearby()` (src/features/nearby.ts) does the "scan" and stores the
 *    match in `state.ui.nearby`; App renders this component while it's set.
 *  - 500 ft and "5-minute walk" are different measurements, so the card shows
 *    both: the straight-line distance and the walking time along streets
 *    ("450 ft away · about 3 min walk").
 *  - It's a notification, not a modal: it doesn't block the page or grab
 *    focus. Screen readers hear a polite announcement. Escape = No.
 *  - Go → the map (Page 17) with a walking route to the place.
 *    No → dismiss, and that place isn't suggested again today.
 *
 * Phones: docked above the bottom tab bar like a notification that became a
 * sheet. Desktop: a floating card under the header, top right.
 *
 * Deep link: `?nearby-answer=no` presses "No" automatically after a moment
 * (screen 16B, so the dismissed state is reproducible).
 */

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Check, Footprints, MapPin, Navigation, Radar } from 'lucide-react';
import { PlacePhoto } from '../../components/domain/PlacePhoto';
import { Button } from '../../components/ui/Button';
import { DemoBadge } from '../../components/ui/Display';
import type { NearbyMatch } from '../../data/types';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import { distanceLabel } from '../../lib/format';
import { navigate, useRoute, withQuery } from '../../router/router';
import { matchRoute, paths, type RouteName } from '../../router/routes';
import { dismissNearby } from '../../store/actions';
import { getTrip, personFirstName, tripAccess } from '../../store/selectors';
import { useAppState } from '../../store/store';
import { toast } from '../../store/toast';
import { categoryLine, personalizeReason, splitReason } from '../p17/placeText';
import './p16.css';

/** Routes that show the phone's bottom tab bar (mirrors AppShell's trip routes). */
const TAB_BAR_ROUTES: RouteName[] = ['itinerary', 'ideas', 'dashboard', 'day', 'budget', 'people', 'trip-map'];

/** How long the card exits before it's removed (matches p16.css). */
const EXIT_MS = 170;

export function NearbyPopup() {
  const state = useAppState();
  const match = state.ui.nearby;
  if (!match) return null;
  // A new match gets a fresh card (resets the exit animation and the announcement).
  return <NearbyCard key={`${match.tripId}:${match.place.id}`} match={match} />;
}

function NearbyCard({ match }: { match: NearbyMatch }) {
  const state = useAppState();
  const location = useRoute();
  const isMobile = useBreakpoint() === 'mobile';
  const titleId = useId();
  const descId = useId();
  const cardRef = useRef<HTMLDivElement>(null);
  const [leaving, setLeaving] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  const { place } = match;

  // Is the phone's bottom tab bar on screen? Then dock above it.
  const route = matchRoute(location.path);
  const hasTabBar = isMobile && TAB_BAR_ROUTES.includes(route.name) && !!getTrip(state, route.params.tripId);

  // Show "You" instead of your own name in the reasons.
  const trip = getTrip(state, match.tripId);
  const myFirstName = trip ? personFirstName(state, tripAccess(state, trip).actingPersonId) : undefined;
  const reasons = match.reasons.map((r) => personalizeReason(r, myFirstName));

  const distance = `${distanceLabel(match.distanceM)} away`;
  const walk = `about ${match.walkMin} min walk`;

  /** "No": slide away, forget the match, and confirm with a toast. */
  const answerNo = useCallback(() => {
    if (leaving) return;
    setLeaving(true);
    window.setTimeout(() => {
      dismissNearby(); // triggerNearby already remembered this place as "seen"
      toast({ title: `Okay, we won’t suggest ${place.name} again today.`, tone: 'info' });
    }, EXIT_MS);
  }, [leaving, place.name]);

  /** "Go": open the map with a walking route to the place. */
  const answerGo = () => {
    dismissNearby();
    navigate(withQuery(paths.tripMap(match.tripId), { to: place.id, from: 'nearby' }));
  };

  // Announce politely once the card is on screen (a live region must exist before its text changes).
  useEffect(() => {
    const t = window.setTimeout(() => setAnnouncement(`Nearby match for your group: ${place.name}, ${distance}, ${walk}. Choose Go or No.`), 400);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Escape = No, unless another overlay (sheet, menu, popover) or a text field is handling it.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      if (document.querySelector('.sheet-root, .main-menu-root, .popover-panel')) return;
      const el = e.target as HTMLElement | null;
      const typing = !!el && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName));
      if (typing && !cardRef.current?.contains(el)) return;
      answerNo();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [answerNo]);

  // Screen 16B: `?nearby-answer=no` presses "No" after the card has been seen.
  const autoAnswer = location.query.get('nearby-answer');
  useEffect(() => {
    if (autoAnswer !== 'no') return;
    const t = window.setTimeout(() => {
      const rest = new URLSearchParams(location.query);
      rest.delete('nearby-answer'); // only once
      const qs = rest.toString();
      navigate(qs ? `${location.path}?${qs}` : location.path, { replace: true });
      answerNo();
    }, 1400);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoAnswer]);

  return (
    <div
      ref={cardRef}
      className={`p16 ${isMobile ? 'is-mobile' : 'is-desktop'} ${hasTabBar ? 'has-tabbar' : ''} ${leaving ? 'is-leaving' : ''}`}
      role="dialog"
      aria-modal="false"
      aria-labelledby={titleId}
      aria-describedby={descId}
    >
      <p className="sr-only" role="status" aria-live="polite">
        {announcement}
      </p>

      <div className="p16-head">
        <span className="p16-eyebrow">
          <span className="p16-live" aria-hidden="true" />
          Nearby · matches your group
        </span>
        <DemoBadge title="Prototype: your location and this alert are simulated">Simulated</DemoBadge>
      </div>

      <div className="p16-place">
        <PlacePhoto photo={place.photo} place={place} alt={place.name} category={place.category} size="full" className="p16-photo" />
        <div className="p16-info">
          <h2 id={titleId} className="p16-name">
            {place.name}
          </h2>
          <p className="p16-cat">{categoryLine(place.category, place.area)}</p>
          <p id={descId} className="p16-distance num">
            <span className="p16-measure" title="Straight-line distance from you">
              <MapPin aria-hidden />
              {distance}
            </span>
            <span className="p16-dot" aria-hidden="true">
              ·
            </span>
            <span className="p16-measure" title="Walking time along streets">
              <Footprints aria-hidden />
              {walk}
            </span>
          </p>
        </div>
      </div>

      {!isMobile && place.blurb && <p className="p16-blurb">{place.blurb}</p>}

      {reasons.length > 0 && (
        <ul className="p16-reasons" aria-label="Why it fits your group">
          {reasons.map((r) => {
            const { need, who } = splitReason(r);
            return (
              <li key={r} className="p16-reason">
                <Check aria-hidden />
                <span className="p16-reason-text">
                  <span className="p16-reason-need">{need}</span>
                  {who && <span className="p16-reason-who">{who}</span>}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      <p className="p16-rule">
        <Radar aria-hidden />
        <span>We look for places within about 500 ft of you that fit everyone’s needs.</span>
      </p>

      <div className="p16-actions">
        <Button variant="secondary" onClick={answerNo} aria-label={`No, don’t suggest ${place.name} again today`}>
          No
        </Button>
        <Button icon={<Navigation />} onClick={answerGo} aria-label={`Go: walking directions to ${place.name}`}>
          Go
        </Button>
      </div>
    </div>
  );
}
