/**
 * Page 17 — Map.
 *
 * Doc: "a map page where the user can see the map for around them. I think
 * this should be a google maps api where we just have google maps built into
 * the app and page."
 *
 * Google Maps needs an API key with billing, so this is an interactive
 * OpenStreetMap map (Leaflet) designed to feel like Google Maps. The traveler's
 * location is always SIMULATED and labeled that way. "Open in Google Maps" is a
 * plain external link, not an integration.
 *
 * Layouts (genuinely different, not a shrunk desktop):
 *  - Desktop/tablet: a scrolling left panel (search, layer chips, route
 *    details, place list) next to a map that fills the rest of the screen.
 *  - Phone: a full-bleed map with a floating search pill and layer chips, a
 *    bottom sheet (peek → expanded), and a "Recenter on me" button.
 *
 * URL params (see src/proto/screens/p17.ts):
 *  - `to`   place / event / idea id to route to (e.g. padaria-celeste)
 *  - `from=nearby`  arrived from the Page 16 pop-up ("Route to a nearby match")
 *  - `layers=today,trip,ideas,food`  which layers start switched on
 *  - `s=layers`     open and highlight the layer list
 *  - `s=route-error`  directions service unavailable → straight-line estimate
 */

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';
import { ExternalLink, Layers, List, ListOrdered, LocateFixed, Map as MapIcon, Plus, Search, X } from 'lucide-react';
import { eventLabel } from '../../components/domain/EventItem';
import { MapView, type MapMarker } from '../../components/domain/MapView';
import { PlacePhoto } from '../../components/domain/PlacePhoto';
import { PageHeader } from '../../components/layout/PageHeader';
import { Button, IconButton } from '../../components/ui/Button';
import { Banner, EmptyState } from '../../components/ui/Display';
import type { SurveyResponse } from '../../data/types';
import { matchReasons } from '../../features/nearby';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import { useTrip, type TripContext } from '../../hooks/useTrip';
import { dayHeading, dayNumber, formatDateRange, formatTime, minToTime, timeToMin } from '../../lib/dates';
import { listJoin, plural } from '../../lib/format';
import { distanceMeters, type LatLng } from '../../lib/geo';
import { navigate, withQuery } from '../../router/router';
import { paths } from '../../router/routes';
import { addEvent } from '../../store/actions';
import {
  acceptedMemberIds,
  conflictsFor,
  currentTrip,
  eventsOn,
  now,
  personFirstName,
  phaseOf,
  simulatedLocation,
  tripEvents,
  tripSuggestions,
} from '../../store/selectors';
import { useAppState } from '../../store/store';
import { toast } from '../../store/toast';
import { useFoodPlaces, useWalkingDirections } from './hooks';
import { LayerChips, LayerPanel } from './LayerControls';
import { centerCamera, fitCamera, leafletMapIn, type Insets } from './mapCamera';
import {
  buildItems,
  connectRoute,
  framePoints,
  googleMapsUrl,
  LAYER_LABEL,
  LAYER_ORDER,
  matchesSearch,
  nextFiveMinuteMark,
  resolveTarget,
  routeOriginFor,
  type LayerId,
  type MapItem,
} from './mapData';
import { NearbyMatch } from './NearbyMatch';
import { PlaceList } from './PlaceList';
import { personalizeReason } from './placeText';
import { EstimateNote, itemContext, originText, RouteActions, RouteCard, RouteStats, RouteSteps } from './RouteDetails';
import './p17.css';

/* ================================================================== entry */

/** Routes `/map` (current trip) and `/trip/:id/map`. */
export function MapPage({ tripId, query }: { tripId?: string; query: URLSearchParams }) {
  const state = useAppState();
  const resolvedId = tripId ?? currentTrip(state)?.id;
  const ctx = useTrip(resolvedId);

  if (!resolvedId) return <NoTrips />;
  if (!ctx) return <TripMissing />;
  // `key` gives each trip a fresh map (layers, camera) when switching trips.
  return <TripMap key={ctx.trip.id} ctx={ctx} query={query} tripRoute={!!tripId} />;
}

/** The person has no trips yet. */
function NoTrips() {
  return (
    <div className="container page">
      <PageHeader title="Map" back={{ to: paths.home(), label: 'Home' }} />
      <EmptyState
        icon={<MapIcon />}
        title="Create a trip to see it on the map"
        actions={
          <>
            <Button to={paths.newTrip()} icon={<Plus />}>
              New trip
            </Button>
            <Button to={paths.trips()} variant="secondary">
              Open existing trip
            </Button>
          </>
        }
      >
        The map shows your plan, ideas, and places to eat around you while you travel.
      </EmptyState>
    </div>
  );
}

/** Unknown trip id, or the person isn't on that trip. */
function TripMissing() {
  return (
    <div className="container page">
      <PageHeader title="Map" back={{ to: paths.trips(), label: 'My trips' }} />
      <EmptyState
        icon={<MapIcon />}
        title="We couldn’t find that trip"
        actions={
          <Button to={paths.trips()} variant="secondary">
            Go to My trips
          </Button>
        }
      >
        It may have been deleted, or you’re not a member of it.
      </EmptyState>
    </div>
  );
}

/* ================================================================ helpers */

/** Returns `value` after it stops changing for `ms` (so the camera doesn't jump on every keystroke). */
function useDebounced<T>(value: T, ms: number): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const t = window.setTimeout(() => setSettled(value), ms);
    return () => window.clearTimeout(t);
  }, [value, ms]);
  return settled;
}

/** Fixed space for floating map controls on desktop (sim badge, zoom, recenter, attribution). */
const DESKTOP_INSETS: Insets = { top: 52, right: 64, bottom: 48, left: 48 };

/* ============================================================== trip map */

function TripMap({ ctx, query, tripRoute }: { ctx: TripContext; query: URLSearchParams; tripRoute: boolean }) {
  const { state, trip, access } = ctx;
  const bp = useBreakpoint();
  const isMobile = bp === 'mobile';

  /* ---- time, place, and URL state ---- */
  const clock = now(state);
  const phase = phaseOf(state, trip);
  const activeDay = phase === 'active' ? clock.date : null;
  const you = simulatedLocation(state, trip); // null before/after the trip
  const s = query.get('s');
  const to = query.get('to');
  const from = query.get('from');
  const forceEstimate = s === 'route-error';
  const basePath = tripRoute ? paths.tripMap(trip.id) : paths.map();
  const destName = trip.destinations[0]?.name ?? 'your destination';

  /* ---- page-local UI state ---- */
  const available: LayerId[] = activeDay ? LAYER_ORDER : LAYER_ORDER.filter((l) => l !== 'today');
  const [layers, setLayers] = useState<Set<LayerId>>(() => {
    // `?layers=today,food` picks the starting layers (screen index); otherwise today's plan during the trip.
    const asked = (query.get('layers') ?? '').split(',').filter((l): l is LayerId => available.includes(l as LayerId));
    return new Set<LayerId>(asked.length ? asked : [activeDay ? 'today' : 'trip']);
  });
  const [layersOpen, setLayersOpen] = useState(s === 'layers');
  const [sheetOpen, setSheetOpen] = useState(s === 'layers');
  const [search, setSearch] = useState('');
  const [showAllFood, setShowAllFood] = useState(false);
  const debouncedSearch = useDebounced(search, 350);

  /* ---- the group's survey answers (for "fits the group") ---- */
  const surveys = acceptedMemberIds(trip)
    .map((id) => state.surveys[id])
    .filter((x): x is SurveyResponse => !!x);
  const names = Object.fromEntries(state.people.map((p) => [p.id, p.name]));
  const myFirstName = personFirstName(state, access.actingPersonId);

  /* ---- places ---- */
  const foodCenter: LatLng | null = you ?? trip.destinations[0] ?? null;
  const food = useFoodPlaces({ trip, center: foodCenter, enabled: layers.has('food'), surveys, names });
  const items = buildItems({ state, trip, layers, activeDay, food: showAllFood ? food.all : food.fits });
  const visible = items.filter((i) => matchesSearch(i, search));
  const target: MapItem | null = to ? resolveTarget(to, items, state, trip, food.all) : null;
  const unresolved = !!to && !target;

  /* ---- route ---- */
  const events = tripEvents(state, trip.id);
  const origin = target ? routeOriginFor(target.place, you, events, trip) : null;
  const directions = useWalkingDirections(origin, target?.place ?? null, forceEstimate);
  // While directions load we draw the straight-line preview (dashed), then the real route.
  const shownRoute = directions.status === 'ready' ? directions.route : directions.status === 'loading' ? directions.preview : null;
  const routeCoords = shownRoute && origin && target ? connectRoute(shownRoute.coords, origin, target.place) : null;
  const routeEstimated = shownRoute?.source === 'estimate';
  const nearbyMode = from === 'nearby' && !!target;

  /* ---- navigation helpers (selection lives in the URL so it survives reloads) ---- */
  const keepS = forceEstimate ? s : undefined;
  const select = (id: string) => {
    const stillNearby = nearbyMode && target && (id === target.id || id === target.place.id);
    navigate(withQuery(basePath, { to: id, from: stillNearby ? 'nearby' : undefined, s: keepS }), { replace: true });
    if (isMobile) setSheetOpen(false); // show the route on the map, summary in the peek
  };
  const clearRoute = () => navigate(withQuery(basePath, { s: keepS }), { replace: true });
  const toggleLayer = (id: LayerId) =>
    setLayers((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const turnOnLayer = (id: LayerId) => setLayers((prev) => new Set(prev).add(id));

  /* ---- "Add to today’s plan" (from the nearby pop-up) ---- */
  const addAt = nextFiveMinuteMark(clock.time);
  const addedEvent = target && activeDay ? eventsOn(state, trip.id, activeDay).find((e) => e.place.id === target.place.id) : undefined;
  const canAddToday = !!activeDay && access.canEditDay(activeDay);
  const dayLabel = activeDay ? `Day ${dayNumber(trip, activeDay)}` : null;
  const addToToday = () => {
    if (!target || !activeDay) return;
    const end = minToTime(timeToMin(addAt) + 30);
    const overlaps = conflictsFor(state, trip.id, activeDay, addAt, end);
    addEvent({
      tripId: trip.id,
      place: target.place,
      date: activeDay,
      start: addAt,
      end,
      attendeeIds: [access.actingPersonId],
      source: 'nearby',
      notes: 'Added from a nearby match on the map.',
    });
    toast({
      title: `Added to ${dayLabel} at ${formatTime(addAt)}`,
      body: overlaps.length ? `It overlaps with ${listJoin(overlaps.map(eventLabel))}.` : undefined,
      tone: 'success',
      action: { label: 'View day', onClick: () => navigate(paths.day(trip.id, activeDay)) },
    });
  };
  const nearbyReasons = target ? matchReasons(target.place, surveys, names).map((r) => personalizeReason(r, myFirstName)) : [];
  const nearbyBlock = (compact: boolean) =>
    nearbyMode && target ? (
      <NearbyMatch
        compact={compact}
        straightM={you ? distanceMeters(you, target.place) : directions.status !== 'none' ? directions.straightM : 0}
        reasons={nearbyReasons}
        addedEvent={addedEvent}
        dayLabel={dayLabel}
        dayPath={activeDay ? paths.day(trip.id, activeDay) : null}
        addAt={addAt}
        canAdd={canAddToday}
        lockReason={access.lockReason('editThisDay')}
        onAdd={addToToday}
      />
    ) : null;

  /* ---- map markers ---- */
  const markers: MapMarker[] = [];
  const toMarker = (it: MapItem, selected: boolean): MapMarker => ({
    id: it.id,
    lat: it.place.lat,
    lng: it.place.lng,
    // The nearby match gets the marigold "★" pin until it's part of the plan.
    kind: selected && nearbyMode && it.kind !== 'event' ? 'nearby' : it.kind,
    label: it.number !== undefined ? `${it.number}. ${it.title}` : it.title,
    number: it.number,
    selected,
  });
  for (const it of visible) markers.push(toMarker(it, !!target && it.id === target.id));
  if (target && !markers.some((m) => m.id === target.id)) markers.push(toMarker(target, true));
  if (origin && origin.kind !== 'you' && !markers.some((m) => Math.abs(m.lat - origin.lat) < 1e-6 && Math.abs(m.lng - origin.lng) < 1e-6)) {
    markers.push({ id: 'p17-origin', lat: origin.lat, lng: origin.lng, kind: 'destination', label: `Start: ${origin.label}` });
  }
  if (markers.length === 0 && !you) {
    trip.destinations.forEach((d) => markers.push({ id: `p17-dest-${d.id}`, lat: d.lat, lng: d.lng, kind: 'destination', label: d.name }));
  }
  const onMarkerClick = (id: string) => {
    if (id.startsWith('p17-')) return; // start point / town pins aren't selectable places
    select(id);
  };

  /* ---- camera: what to fit, and when ---- */
  const rootRef = useRef<HTMLDivElement>(null);
  const topRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLElement>(null);
  const panelBodyRef = useRef<HTMLDivElement>(null);
  const [overlay, setOverlay] = useState({ top: 0, sheet: 0 });

  /**
   * How much of the map the floating UI covers on phones (search pill + chips
   * on top, the sheet at the bottom). We use layout sizes (offsetHeight), not
   * getBoundingClientRect, so the sheet's slide-in animation doesn't skew it.
   */
  const measureOverlay = () => ({
    top: topRef.current ? topRef.current.offsetTop + topRef.current.offsetHeight : 0,
    sheet: sheetRef.current ? sheetRef.current.offsetHeight : 0,
  });
  /** The sheet's height when collapsed (handle + peek), even while it's expanded. */
  const peekHeight = () => {
    const peek = sheetRef.current?.querySelector<HTMLElement>('.p17-peek');
    return peek ? peek.offsetTop + peek.offsetHeight : measureOverlay().sheet;
  };
  const measureInsets = (): Insets => {
    if (!isMobile) return DESKTOP_INSETS;
    // Frame for the collapsed sheet: an expanded list is temporary, and fitting
    // into the sliver above it would zoom the map far out.
    return { top: measureOverlay().top + 18, right: 28, bottom: peekHeight() + 18, left: 28 };
  };

  // Keep CSS variables in sync with the overlay sizes (lifts the map attribution and the recenter button).
  useLayoutEffect(() => {
    if (!isMobile) return;
    const update = () => {
      const { top, sheet } = measureOverlay();
      setOverlay((prev) => (prev.top === top && prev.sheet === sheet ? prev : { top, sheet }));
    };
    update();
    const ro = new ResizeObserver(update);
    [rootRef.current, topRef.current, sheetRef.current].forEach((el) => el && ro.observe(el));
    return () => ro.disconnect();
  }, [isMobile]);

  const searchForCamera = debouncedSearch;
  let cameraKey: string;
  let cameraPoints: LatLng[];
  if (target) {
    const ready = directions.status === 'ready' && routeCoords;
    cameraKey = `t|${target.place.id}|${origin ? `${origin.lat.toFixed(5)},${origin.lng.toFixed(5)}` : '-'}|${ready ? `${routeCoords!.length}${routeEstimated ? 'e' : 'r'}` : directions.status}`;
    cameraPoints = ready ? routeCoords!.map(([lat, lng]) => ({ lat, lng })) : [target.place, ...(origin ? [origin] : [])];
  } else {
    const shown: LatLng[] = items.filter((i) => matchesSearch(i, searchForCamera)).map((i) => i.place);
    cameraKey = `a|${[...layers].sort().join(',')}|${searchForCamera}|${shown.length}|${food.status}|${you ? `${you.lat.toFixed(4)},${you.lng.toFixed(4)}` : '-'}`;
    if (searchForCamera.trim()) {
      // Searching: show the results (and you, if they're near you).
      const nearYou = you && shown.some((p) => distanceMeters(you, p) < 5000) ? you : null;
      cameraPoints = nearYou ? [nearYou, ...shown] : shown;
    } else {
      cameraPoints = framePoints(shown, you, trip.destinations[0] ?? null);
    }
    if (cameraPoints.length === 0) cameraPoints = you ? [you] : trip.destinations;
  }
  const pointsRef = useRef(cameraPoints);
  pointsRef.current = cameraPoints;
  const fittedMap = useRef<unknown>(null);
  const [initialCenter, setInitialCenter] = useState<LatLng | undefined>(() => cameraPoints[0]);

  useEffect(() => {
    const map = leafletMapIn(rootRef.current);
    if (!map) return;
    // Animate camera moves after the first one (not on page load).
    const animate = fittedMap.current === map;
    fitCamera(map, pointsRef.current, measureInsets(), { animate, maxZoom: target ? 17 : 16 });
    fittedMap.current = map;
    if (initialCenter) setInitialCenter(undefined); // MapView only needs it to create the map
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraKey, bp]);

  /** "Recenter on me": glide back to the simulated location (zooming in if far out). */
  const recenter = () => {
    const map = leafletMapIn(rootRef.current);
    if (map && you) centerCamera(map, you, Math.max(map.getZoom(), 16), measureInsets(), true);
  };

  // Desktop: bring the route card into view when a new place is picked.
  useEffect(() => {
    if (target && !isMobile) panelBodyRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target?.id]);

  /* ---- shared pieces ---- */
  const describeLayer = (id: LayerId): string => {
    switch (id) {
      case 'today': {
        const n = activeDay ? eventsOn(state, trip.id, activeDay).length : 0;
        return `${dayLabel ?? 'Today'} · ${plural(n, 'stop')}, numbered in order`;
      }
      case 'trip':
        return events.length ? `All ${plural(events.length, 'event')} across ${plural(new Set(events.map((e) => e.date)).size, 'day')}` : 'Nothing planned yet';
      case 'ideas': {
        const n = tripSuggestions(state, trip.id).filter((x) => !state.decisions.some((d) => d.tripId === trip.id && d.suggestionId === x.id)).length;
        return n ? `${plural(n, 'suggestion')} you haven’t added yet` : 'No open ideas yet';
      }
      case 'food':
        if (food.status === 'loading') return 'Looking for places to eat…';
        if (food.status === 'error') return 'Couldn’t load places to eat. Try again.';
        return you ? 'Places near you that fit everyone’s diets and access needs' : `Places in ${destName} that fit everyone’s diets and access needs`;
    }
  };

  const phaseBanner =
    phase === 'upcoming' ? (
      <Banner tone="info" title={`You’re not in ${destName} yet.`} className="p17-phase">
        Showing your trip’s places. During the trip your (simulated) location appears here.
      </Banner>
    ) : phase === 'past' ? (
      <Banner tone="info" title="This trip has ended." className="p17-phase">
        Showing the places from your trip. Your (simulated) location only appears during a trip.
      </Banner>
    ) : null;

  const unresolvedBanner = unresolved ? (
    <Banner
      tone="warning"
      title="We couldn’t find that place on this trip"
      action={
        <Button size="sm" variant="secondary" onClick={clearRoute}>
          Show all places
        </Button>
      }
    >
      The link may point to a place that was removed.
    </Banner>
  ) : null;

  const list = (
    <PlaceList
      items={visible}
      trip={trip}
      activeDay={activeDay}
      nowTime={clock.time}
      you={you}
      selectedId={target?.id ?? null}
      onSelect={select}
      layers={layers}
      onTurnOnLayer={turnOnLayer}
      food={food}
      showAllFood={showAllFood}
      onShowAllFood={() => setShowAllFood(true)}
      search={search}
      onClearSearch={() => setSearch('')}
      canAddEvents={access.canAddEvents}
      myFirstName={myFirstName}
    />
  );

  const layerPanel = (onClose?: () => void) => (
    <LayerPanel available={available} layers={layers} onToggle={toggleLayer} describe={describeLayer} onClose={onClose} emphasize={s === 'layers'} />
  );

  /** Enter in the search box picks the first match (like a maps app). */
  const onSearchKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && visible[0]) {
      e.preventDefault();
      select(visible[0].id);
      (e.target as HTMLInputElement).blur();
    }
    if (e.key === 'Escape' && search) setSearch('');
  };

  const mapView = (
    <MapView
      ariaLabel={`Map of ${trip.title}${you ? '. Your location is simulated.' : ''}`}
      markers={markers}
      you={you ? { lat: you.lat, lng: you.lng, label: you.label } : null}
      route={routeCoords}
      routeEstimated={routeEstimated}
      center={initialCenter}
      zoom={15}
      fit="none"
      onMarkerClick={onMarkerClick}
      className="p17-mapview"
    />
  );

  const eyebrow = nearbyMode ? 'Route to a nearby match' : 'Walking directions';
  const routeProps = target
    ? { item: target, trip, origin, directions, nowTime: clock.time, showArrival: !!you, onClear: clearRoute }
    : null;

  /* ============================================================ desktop */
  if (!isMobile) {
    const subtitle = activeDay ? `${dayHeading(trip, activeDay)} · ${formatTime(clock.time)}` : formatDateRange(trip.startDate, trip.endDate);
    return (
      <div ref={rootRef} className={`p17 p17-d ${tripRoute ? '' : 'p17-no-tabs'}`}>
        <aside className="p17-panel" aria-label="Places and directions">
          <div className="p17-panel-head">
            <div className="p17-title-row">
              <div className="p17-title-text">
                <p className="eyebrow truncate">{trip.title}</p>
                <h1 className="p17-h1">{you ? 'Around you' : 'Trip map'}</h1>
                <p className="small muted num">{subtitle}</p>
              </div>
              <Button
                size="sm"
                variant={layersOpen ? 'subtle' : 'ghost'}
                className="p17-layers-btn"
                icon={<Layers />}
                aria-expanded={layersOpen}
                aria-controls="p17-layers"
                onClick={() => setLayersOpen((v) => !v)}
              >
                Layers
              </Button>
            </div>
            <SearchBox value={search} onChange={setSearch} onKeyDown={onSearchKey} />
            <LayerChips available={available} layers={layers} onToggle={toggleLayer} className="p17-chips-wrap" />
          </div>
          <div className="p17-panel-body" ref={panelBodyRef}>
            {phaseBanner}
            {unresolvedBanner}
            {layersOpen && layerPanel(() => setLayersOpen(false))}
            {routeProps && <RouteCard {...routeProps} eyebrow={eyebrow} asPlace={nearbyMode} extra={nearbyBlock(false)} />}
            {list}
            <p className="p17-credit xsmall muted">
              Map data © OpenStreetMap contributors. {you ? 'Your location is simulated for this prototype.' : ''}
            </p>
          </div>
        </aside>
        <div className="p17-mapwrap">
          {mapView}
          {you && (
            <button type="button" className="p17-recenter" onClick={recenter} aria-label="Recenter on me (simulated location)" title="Recenter on me">
              <LocateFixed aria-hidden />
            </button>
          )}
        </div>
      </div>
    );
  }

  /* ============================================================= phone */
  const style = { '--p17-top-h': `${overlay.top}px`, '--p17-sheet-h': `${overlay.sheet}px` } as CSSProperties;
  const openLayers = () => {
    setLayersOpen(true);
    setSheetOpen(true);
  };
  const layerNames = available.filter((l) => layers.has(l)).map((l) => LAYER_LABEL[l]);
  // What the collapsed sheet says when there's nothing on the map yet.
  const peekEmpty: { title: string; hint?: string } =
    layers.size === 0
      ? { title: 'All layers are off', hint: 'Turn on a layer to see places' }
      : search.trim()
        ? { title: `No places match “${search.trim()}”` }
        : layers.has('food') && food.status === 'loading'
          ? { title: 'Looking for places to eat…' }
          : layers.has('food') && food.status === 'error'
            ? { title: 'Couldn’t load places to eat', hint: 'Open the list to try again' }
            : layers.has('food') && food.all.length > 0 && !showAllFood
              ? { title: 'No matches for your group yet', hint: `${plural(food.all.length, 'place')} to eat nearby · open the list` }
              : events.length === 0
                ? { title: 'Nothing planned yet', hint: 'Open the list to add an event or find food nearby' }
                : { title: 'Nothing on the map yet' };

  let peek: ReactNode;
  if (routeProps && target) {
    peek = (
      <div className="p17-peek-route">
        <div className="p17-peek-place">
          <span aria-hidden="true">
            <PlacePhoto photo={target.place.photo} alt="" category={target.place.category} className="p17-peek-photo" />
          </span>
          <div className="p17-peek-text">
            <span className="p17-peek-eyebrow">{eyebrow}</span>
            <h2 className="p17-peek-name">{target.title}</h2>
            <RouteStats directions={directions} nowTime={clock.time} showArrival={!!you} compact />
          </div>
          <IconButton label="Clear route" icon={<X />} onClick={clearRoute} />
        </div>
        {origin && !nearbyMode && <p className="p17-peek-from truncate">{originText(origin)}</p>}
        <EstimateNote directions={directions} />
        {nearbyBlock(true)}
        <div className="p17-peek-actions">
          <Button variant="secondary" icon={<ListOrdered />} aria-expanded={sheetOpen} aria-controls="p17-sheet-body" onClick={() => setSheetOpen((v) => !v)} disabled={directions.status === 'loading'}>
            {sheetOpen ? 'Hide steps' : 'Steps'}
          </Button>
          {origin && (
            <Button variant="secondary" href={googleMapsUrl(origin, target.place, directions.status !== 'too-far')} iconRight={<ExternalLink />} aria-label={`Open directions to ${target.place.name} in Google Maps (opens a new tab)`}>
              Google Maps
            </Button>
          )}
        </div>
      </div>
    );
  } else {
    peek = (
      <div className="stack-sm">
        {phaseBanner}
        {unresolvedBanner}
        <div className="p17-peek-summary">
          <div className="grow">
            <p className="p17-peek-count">
              {visible.length > 0 ? (
                <>
                  <strong className="num">{plural(visible.length, 'place')}</strong> · tap a pin
                </>
              ) : (
                <strong>{peekEmpty.title}</strong>
              )}
            </p>
            <p className="xsmall muted truncate">{visible.length > 0 || !peekEmpty.hint ? layerNames.join(' · ') || 'Turn on a layer to see places' : peekEmpty.hint}</p>
          </div>
          <Button variant="secondary" icon={<List />} aria-expanded={sheetOpen} aria-controls="p17-sheet-body" onClick={() => setSheetOpen((v) => !v)}>
            {sheetOpen ? 'Hide list' : 'List'}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div ref={rootRef} className={`p17 p17-m ${tripRoute ? '' : 'p17-no-tabs'}`} style={style}>
      <h1 className="sr-only">Map of {trip.title}</h1>
      {mapView}

      <div className="p17-top" ref={topRef}>
        <SearchBox
          value={search}
          onChange={(v) => {
            setSearch(v);
            if (v && !sheetOpen && !target) setSheetOpen(true);
          }}
          onKeyDown={onSearchKey}
          pill
          trailing={<IconButton label="Map layers" icon={<Layers />} onClick={openLayers} aria-expanded={layersOpen && sheetOpen} className="p17-pill-layers" />}
        />
        <LayerChips available={available} layers={layers} onToggle={toggleLayer} className="p17-chips-scroll" />
      </div>

      {you && (
        <button type="button" className="p17-fab" onClick={recenter} aria-label="Recenter on me (simulated location)">
          <LocateFixed aria-hidden />
        </button>
      )}

      <section ref={sheetRef} className={`p17-sheet ${sheetOpen ? 'is-open' : ''}`} aria-label="Places and directions">
        <SheetHandle open={sheetOpen} onChange={setSheetOpen} label={target ? 'walking steps' : 'place list'} />
        <div className="p17-peek">{peek}</div>
        {sheetOpen && (
          <div id="p17-sheet-body" className="p17-sheet-body">
            {routeProps && target ? (
              <>
                {directions.status === 'ready' && <h2 className="p17-list-title">Steps</h2>}
                <RouteSteps item={target} directions={directions} />
                {directions.status === 'too-far' && <p className="small muted">Open Google Maps for transit or driving directions.</p>}
                <p className="small muted">{itemContext(target, trip, nearbyMode)}</p>
                <RouteActions item={target} origin={null} directions={directions} onClear={clearRoute} />
                <div className="p17-sheet-sep" />
                <h2 className="p17-list-title">Other places</h2>
                {list}
              </>
            ) : (
              <>
                {layersOpen && layerPanel(() => setLayersOpen(false))}
                {list}
              </>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

/* ============================================================ small parts */

/** Search field: a panel input on desktop, a floating rounded pill on phones. */
function SearchBox({
  value,
  onChange,
  onKeyDown,
  pill,
  trailing,
}: {
  value: string;
  onChange: (v: string) => void;
  onKeyDown: (e: KeyboardEvent<HTMLInputElement>) => void;
  pill?: boolean;
  trailing?: ReactNode;
}) {
  return (
    <div className={`p17-search ${pill ? 'is-pill' : ''}`} role="search">
      <Search className="p17-search-icon" aria-hidden />
      <input
        type="search"
        className="p17-search-input"
        placeholder="Search places on this map"
        aria-label="Search places on this map"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        enterKeyHint="search"
        autoComplete="off"
      />
      {value && (
        <button type="button" className="p17-search-clear" aria-label="Clear search" onClick={() => onChange('')}>
          <X aria-hidden />
        </button>
      )}
      {trailing}
    </div>
  );
}

/**
 * The bottom sheet's grab handle: tap to expand/collapse, or swipe it up/down.
 * (A full drag-to-resize sheet is optional for the prototype.)
 */
function SheetHandle({ open, onChange, label }: { open: boolean; onChange: (open: boolean) => void; label: string }) {
  const startY = useRef<number | null>(null);
  const swiped = useRef(false);
  return (
    <button
      type="button"
      className="p17-sheet-handle"
      aria-expanded={open}
      aria-controls="p17-sheet-body"
      aria-label={open ? `Collapse the ${label}` : `Expand the ${label}`}
      onPointerDown={(e: PointerEvent<HTMLButtonElement>) => {
        startY.current = e.clientY;
        swiped.current = false;
      }}
      onPointerUp={(e: PointerEvent<HTMLButtonElement>) => {
        if (startY.current === null) return;
        const dy = e.clientY - startY.current;
        startY.current = null;
        if (Math.abs(dy) > 28) {
          swiped.current = true;
          onChange(dy < 0); // swipe up opens, swipe down closes
        }
      }}
      onClick={() => {
        if (swiped.current) {
          swiped.current = false;
          return;
        }
        onChange(!open);
      }}
    >
      <span className="p17-grabber" aria-hidden />
    </button>
  );
}
