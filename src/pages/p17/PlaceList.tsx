/**
 * The list of places on the map, grouped by layer. Each row mirrors its pin
 * (same number / "+" / color), so people can match the list to the map.
 * Tapping a row selects the place and draws a walking route to it.
 */

import { Fragment } from 'react';
import { CalendarPlus, RotateCw, Search, UtensilsCrossed } from 'lucide-react';
import { PlacePhoto } from '../../components/domain/PlacePhoto';
import { Button } from '../../components/ui/Button';
import { Banner, EmptyState, Loading, Skeleton } from '../../components/ui/Display';
import type { Trip } from '../../data/types';
import { dayHeading, dayNumber, formatTime, timeToMin } from '../../lib/dates';
import { distanceLabel, plural } from '../../lib/format';
import { distanceMeters, estimateWalkMinutes, type LatLng } from '../../lib/geo';
import { Link } from '../../router/router';
import { paths } from '../../router/routes';
import { LIVE_FOOD_RADIUS_M, type FoodResult } from './hooks';
import { LAYER_LABEL, MAX_WALK_M, type LayerId, type MapItem } from './mapData';
import { categoryLine, personalizeReason, splitReason } from './placeText';

export interface PlaceListProps {
  /** Items after the search filter. */
  items: MapItem[];
  trip: Trip;
  /** Demo "today" while the trip is happening, else null. */
  activeDay: string | null;
  nowTime: string;
  /** Simulated location (distances are measured from here). */
  you: LatLng | null;
  selectedId: string | null;
  onSelect: (id: string) => void;
  layers: Set<LayerId>;
  onTurnOnLayer: (id: LayerId) => void;
  food: FoodResult;
  showAllFood: boolean;
  onShowAllFood: () => void;
  search: string;
  onClearSearch: () => void;
  canAddEvents: boolean;
  myFirstName?: string;
}

/** "Now" / "Next" / "Done" for today's stops, from the demo clock. */
function todayStatus(item: MapItem, nowTime: string, nextId: string | undefined): { label: string; tone: 'now' | 'next' | 'done' } | null {
  const e = item.event;
  if (!e) return null;
  const now = timeToMin(nowTime);
  if (timeToMin(e.start) <= now && now < timeToMin(e.end)) return { label: 'Now', tone: 'now' };
  if (timeToMin(e.end) <= now) return { label: 'Done', tone: 'done' };
  if (item.id === nextId) return { label: 'Next', tone: 'next' };
  return null;
}

/** One row: photo with a pin-style badge, name, details, and distance from you. */
function PlaceRow({ item, props, nextId }: { item: MapItem; props: PlaceListProps; nextId?: string }) {
  const { trip, nowTime, you, selectedId, onSelect, myFirstName } = props;
  const selected = item.id === selectedId;
  const status = item.layer === 'today' ? todayStatus(item, nowTime, nextId) : null;

  let meta: string;
  if (item.event && item.layer === 'today') meta = `${formatTime(item.event.start)} – ${formatTime(item.event.end)}`;
  else if (item.event) meta = [formatTime(item.event.start), item.event.title ? item.place.name : item.place.area].filter(Boolean).join(' · ');
  else if (item.suggestion) meta = `Idea for Day ${dayNumber(trip, item.suggestion.date)} · ${formatTime(item.suggestion.start)}`;
  else meta = categoryLine(item.place.category, item.place.area);

  const meters = you ? distanceMeters(you, item.place) : null;
  const reasons = (item.reasons ?? []).map((r) => personalizeReason(r, myFirstName));
  const mark = item.number !== undefined ? String(item.number) : item.kind === 'suggestion' ? '+' : '';

  return (
    <li>
      <button type="button" className={`p17-row ${selected ? 'is-selected' : ''} ${status?.tone === 'done' ? 'is-done' : ''}`} onClick={() => onSelect(item.id)} aria-current={selected ? 'true' : undefined}>
        <span className="p17-row-media" aria-hidden="true">
          <PlacePhoto photo={item.place.photo} alt="" category={item.place.category} className="p17-row-photo" />
          <span className={`p17-mark p17-mark-${item.kind} ${mark ? '' : 'is-dot'}`}>{mark}</span>
        </span>
        <span className="p17-row-main">
          <span className="p17-row-name">{item.title}</span>
          <span className="p17-row-meta num">
            {meta}
            {status && <span className={`p17-status is-${status.tone}`}>{status.label}</span>}
          </span>
          {reasons.length > 0 && (
            <span className="p17-row-reasons">
              {reasons.slice(0, 2).map((r) => (
                <span key={r} className="p17-mini-chip" title={r}>
                  {splitReason(r).need}
                </span>
              ))}
              {reasons.length > 2 && <span className="p17-mini-more">+{reasons.length - 2}</span>}
            </span>
          )}
        </span>
        {meters !== null && (
          <span className="p17-row-side num">
            <span>{distanceLabel(meters)}</span>
            {meters <= MAX_WALK_M && <span className="p17-row-walk">~{estimateWalkMinutes(meters)} min</span>}
          </span>
        )}
      </button>
    </li>
  );
}

/** A section heading inside the list. */
function SectionHead({ title, aside }: { title: string; aside?: string }) {
  return (
    <div className="p17-list-head">
      <h2 className="p17-list-title">{title}</h2>
      {aside && <span className="p17-list-aside num">{aside}</span>}
    </div>
  );
}

/** The food layer's loading / error / "nothing fits" states. */
function FoodStatus({ props }: { props: PlaceListProps }) {
  const { food, showAllFood, onShowAllFood, trip } = props;
  if (food.status === 'loading') {
    return (
      <Loading label="Looking for places to eat nearby">
        <div className="stack-sm p17-food-loading">
          <p className="small muted">Looking for places to eat within {distanceLabel(LIVE_FOOD_RADIUS_M)}…</p>
          {[0, 1, 2].map((i) => (
            <div key={i} className="p17-skel-row">
              <Skeleton width={52} height={52} radius={10} />
              <div className="stack-xs grow">
                <Skeleton width="70%" height={14} />
                <Skeleton width="45%" height={12} />
              </div>
            </div>
          ))}
        </div>
      </Loading>
    );
  }
  if (food.status === 'error') {
    return (
      <Banner
        tone="warning"
        title="Couldn’t load places to eat"
        action={
          <Button size="sm" variant="secondary" icon={<RotateCw />} onClick={food.retry}>
            Try again
          </Button>
        }
      >
        OpenStreetMap’s places service didn’t respond. Your trip’s own places still work.
      </Banner>
    );
  }
  if (food.status === 'ready' && food.fits.length === 0 && !showAllFood) {
    return food.all.length > 0 ? (
      <div className="p17-note">
        <p className="small">
          We found {plural(food.all.length, 'place')} to eat within {distanceLabel(LIVE_FOOD_RADIUS_M)}, but none list anything{' '}
          {trip.members.filter((m) => m.status === 'accepted').length > 1 ? 'your group’s survey answers ask for (diets, allergies, step-free access)' : 'your survey answers ask for'}.
        </p>
        <Button size="sm" variant="secondary" onClick={onShowAllFood}>
          Show all {food.all.length}
        </Button>
      </div>
    ) : (
      <p className="small muted p17-note">No places to eat found within {distanceLabel(LIVE_FOOD_RADIUS_M)}.</p>
    );
  }
  return null;
}

export function PlaceList(props: PlaceListProps) {
  const { items, trip, layers, activeDay, search, onClearSearch, canAddEvents, onTurnOnLayer, food } = props;
  const today = items.filter((i) => i.layer === 'today');
  const tripItems = items.filter((i) => i.layer === 'trip');
  const ideas = items.filter((i) => i.layer === 'ideas');
  const foodItems = items.filter((i) => i.layer === 'food');
  const nextToday = today.find((i) => i.event && timeToMin(i.event.start) > timeToMin(props.nowTime));

  if (layers.size === 0) {
    return (
      <EmptyState compact title="No layers are on">
        Turn on Today’s plan, Ideas, or Food above to see places on the map.
      </EmptyState>
    );
  }
  if (search.trim() && items.length === 0 && !(layers.has('food') && food.status === 'loading')) {
    return (
      <EmptyState
        compact
        icon={<Search />}
        title={`No places match “${search.trim()}”`}
        actions={
          <Button size="sm" variant="secondary" onClick={onClearSearch}>
            Clear search
          </Button>
        }
      >
        The search looks at the places in the layers that are on.
      </EmptyState>
    );
  }

  // Whole-trip events grouped by day ("Day 3 — 10/17").
  const days = new Map<string, MapItem[]>();
  for (const it of tripItems) {
    const d = it.event!.date;
    days.set(d, [...(days.get(d) ?? []), it]);
  }
  const noEvents = layers.has('trip') && tripItems.length === 0 && today.length === 0 && !search.trim();

  return (
    <div className="p17-list stack-lg">
      {layers.has('today') && activeDay && (
        <section aria-label={LAYER_LABEL.today}>
          <SectionHead title={LAYER_LABEL.today} aside={dayHeading(trip, activeDay)} />
          {today.length > 0 ? (
            <ul className="p17-rows">
              {today.map((it) => (
                <PlaceRow key={it.id} item={it} props={props} nextId={nextToday?.id} />
              ))}
            </ul>
          ) : (
            !search.trim() && <p className="small muted p17-note">Nothing planned today.</p>
          )}
        </section>
      )}

      {layers.has('trip') && (tripItems.length > 0 || noEvents) && (
        <section aria-label={LAYER_LABEL.trip}>
          <SectionHead title={layers.has('today') && activeDay ? 'Rest of the trip' : LAYER_LABEL.trip} aside={tripItems.length ? plural(tripItems.length, 'stop') : undefined} />
          {noEvents ? (
            <EmptyState
              compact
              icon={<CalendarPlus />}
              title="Nothing planned yet"
              actions={
                <>
                  {canAddEvents && (
                    <Button size="sm" to={paths.newEvent(trip.id)} icon={<CalendarPlus />}>
                      Add an event
                    </Button>
                  )}
                  {!layers.has('food') && (
                    <Button size="sm" variant="secondary" icon={<UtensilsCrossed />} onClick={() => onTurnOnLayer('food')}>
                      Show food nearby
                    </Button>
                  )}
                </>
              }
            >
              Events you add to the itinerary show up here and on the map.
            </EmptyState>
          ) : (
            Array.from(days.entries()).map(([date, list]) => (
              <Fragment key={date}>
                <h3 className="p17-day-head num">{dayHeading(trip, date)}</h3>
                <ul className="p17-rows">
                  {list.map((it) => (
                    <PlaceRow key={it.id} item={it} props={props} />
                  ))}
                </ul>
              </Fragment>
            ))
          )}
        </section>
      )}

      {layers.has('ideas') && (
        <section aria-label={LAYER_LABEL.ideas}>
          <SectionHead title={LAYER_LABEL.ideas} aside={ideas.length ? plural(ideas.length, 'idea') : undefined} />
          {ideas.length > 0 ? (
            <ul className="p17-rows">
              {ideas.map((it) => (
                <PlaceRow key={it.id} item={it} props={props} />
              ))}
            </ul>
          ) : (
            !search.trim() && (
              <p className="small muted p17-note">
                No open ideas for this trip. <Link to={paths.ideas(trip.id)}>See Ideas</Link>
              </p>
            )
          )}
        </section>
      )}

      {layers.has('food') && (
        <section aria-label={LAYER_LABEL.food}>
          <SectionHead title={LAYER_LABEL.food} aside={foodItems.length ? plural(foodItems.length, 'place') : undefined} />
          <FoodStatus props={props} />
          {foodItems.length > 0 && (
            <ul className="p17-rows">
              {foodItems.map((it) => (
                <PlaceRow key={it.id} item={it} props={props} />
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
