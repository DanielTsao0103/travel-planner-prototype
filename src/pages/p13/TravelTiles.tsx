/**
 * Section 2 of Page 13 — "Travel preferences & limitations": accessibility
 * (with an itinerary check), walking limits, tickets, interests, and other
 * needs. Survey answers are combined with the planned stops so planners can
 * see exactly which stops need attention.
 */

import { useState } from 'react';
import {
  Accessibility,
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronRight,
  DoorOpen,
  Footprints,
  Landmark,
  MessageSquareText,
  Ticket,
} from 'lucide-react';
import type { Trip, TripEvent } from '../../data/types';
import { plural } from '../../lib/format';
import { Link } from '../../router/router';
import { paths } from '../../router/routes';
import { Badge } from '../../components/ui/Display';
import { eventLabel } from '../../components/domain/EventItem';
import { INTEREST_OPTIONS, MOBILITY_PHRASE, TICKET_OPTIONS, TICKET_PHRASE, walkLabel, type WalkLimit } from '../p15/vocab';
import {
  accessPeople,
  accessStops,
  dayLabel,
  interestsOf,
  otherNeeds,
  shortestWalk,
  tagCounts,
  ticketPrefs,
  ticketStops,
  unknownAccessCount,
  walkRows,
  type AccessStop,
  type Responder,
} from './aggregate';
import { agree, CountMeter, joinNames, ONE_ANSWER, PeopleInline, QuoteCard, Tile, TileEmpty, TileLabel, usePeople, useShowMore } from './TileParts';

/** The "Travel preferences & limitations" tiles, in a 2-column grid (1 column on phones). */
export function TravelTiles({ responders, events, trip }: { responders: Responder[]; events: TripEvent[]; trip: Trip }) {
  return (
    <div className="p13-grid">
      <AccessTile responders={responders} events={events} trip={trip} />
      <WalkTile responders={responders} />
      <OtherNeedsTile responders={responders} />
      <TicketsTile responders={responders} events={events} trip={trip} />
      <InterestsTile responders={responders} />
    </div>
  );
}

/* --------------------------------------------------------- accessibility */

const STOPS_PREVIEW = 4;

/** Who needs step-free access, plus an itinerary check of stops that aren’t fully step-free. */
function AccessTile({ responders, events, trip }: { responders: Responder[]; events: TripEvent[]; trip: Trip }) {
  const { name, highlightId } = usePeople();
  const [showAll, setShowAll] = useState(false);
  const people = accessPeople(responders);
  const needIds = people.map((p) => p.personId);
  const stops = accessStops(events, needIds);
  const unknown = unknownAccessCount(events);
  const needsLook = stops.filter((s) => s.going.length > 0);
  const plannedAround = stops.filter((s) => s.going.length === 0);
  const names = needIds.map(name);

  let note: string;
  if (people.length === 0) note = stops.length ? `Heads-up: ${plural(stops.length, 'planned stop')} ${stops.length === 1 ? 'isn’t' : 'aren’t'} fully step-free.` : 'Nobody uses a mobility aid or needs step-free entrances.';
  else if (events.length === 0) note = 'No stops planned yet. Check each new stop’s access as you add it.';
  else if (stops.length === 0) note = 'Every planned stop is step-free.';
  else {
    note = needsLook.length ? `${plural(needsLook.length, 'planned stop needs', 'planned stops need')} a closer look.` : 'Every stop that isn’t step-free is planned around.';
    if (needsLook.length && plannedAround.length) note += ` ${plannedAround.length} more ${plannedAround.length === 1 ? 'is' : 'are'} planned around ${joinNames(names)}.`;
  }

  const shown = showAll ? stops : stops.slice(0, STOPS_PREVIEW);

  return (
    <Tile wide icon={<Accessibility />} title="Accessibility" summary={people.length ? `Step-free access for ${joinNames(names)}` : 'No access needs'} note={note}>
      {people.length === 0 ? null : (
        <div className="p13-split">
          <div className="p13-tile-group">
            <TileLabel>Who needs it</TileLabel>
            <ul className="p13-needs">
              {people.map((p) => (
                <li key={p.personId} className={`p13-need ${p.personId === highlightId ? 'is-mine' : ''}`}>
                  <PeopleInline ids={[p.personId]} size={28} />
                  <ul className="p13-need-list">
                    {p.survey.mobility !== 'none' && (
                      <li>
                        <Accessibility aria-hidden />
                        {MOBILITY_PHRASE[p.survey.mobility]}
                      </li>
                    )}
                    {p.survey.stepFreeNeeded && (
                      <li>
                        <DoorOpen aria-hidden />
                        Needs step-free entrances
                      </li>
                    )}
                    {p.survey.maxWalkMinutes !== null && (
                      <li>
                        <Footprints aria-hidden />
                        Walks up to {p.survey.maxWalkMinutes} min at a time
                      </li>
                    )}
                  </ul>
                </li>
              ))}
            </ul>
          </div>

          <div className="p13-tile-group">
            <TileLabel>Itinerary check</TileLabel>
            {events.length === 0 ? (
              <TileEmpty>No stops planned yet.</TileEmpty>
            ) : stops.length === 0 ? (
              <p className="p13-ok">
                <Check aria-hidden /> All {plural(events.length, 'planned stop')} are step-free.
              </p>
            ) : (
              <>
                <ul className="p13-stops">
                  {shown.map((s) => (
                    <li key={s.event.id}>
                      <AccessStopRow stop={s} trip={trip} />
                    </li>
                  ))}
                </ul>
                {stops.length > STOPS_PREVIEW && (
                  <button type="button" className="p13-more" aria-expanded={showAll} onClick={() => setShowAll((v) => !v)}>
                    {showAll ? 'Show fewer' : `Show all ${stops.length} stops`}
                    <ChevronDown aria-hidden className={showAll ? 'is-flipped' : ''} />
                  </button>
                )}
              </>
            )}
            {unknown > 0 && <p className="p13-tile-foot">{plural(unknown, 'stop has', 'stops have')} no access info yet. Check before you go.</p>}
          </div>
        </div>
      )}
    </Tile>
  );
}

/** One stop in the itinerary check, linking to the event so a planner can act on it. */
function AccessStopRow({ stop, trip }: { stop: AccessStop; trip: Trip }) {
  const { name } = usePeople();
  const going = stop.going.map(name);
  const skipping = stop.skipping.map(name);
  return (
    <Link to={paths.event(trip.id, stop.event.id)} className="p13-stop">
      <span className="p13-stop-main">
        <span className="p13-stop-name">{eventLabel(stop.event)}</span>
        <span className="p13-stop-day num">{dayLabel(trip, stop.event.date)}</span>
      </span>
      <Badge tone={stop.access === 'no' ? 'danger' : 'warning'}>{stop.access === 'no' ? 'Not step-free' : 'Partly step-free'}</Badge>
      <span className={`p13-stop-who ${going.length ? 'is-going' : 'is-ok'}`}>
        {going.length ? <AlertTriangle aria-hidden /> : <Check aria-hidden />}
        {going.length ? `${joinNames(going, { start: true })} ${agree(going, 'is', 'are')} going` : `${joinNames(skipping, { start: true })} ${agree(skipping, 'isn’t', 'aren’t')} going`}
      </span>
      <ChevronRight className="p13-stop-chevron" aria-hidden />
    </Link>
  );
}

/* --------------------------------------------------------------- walking */

/** Position on the 5-step walking ruler (5 min … No limit). */
function walkLevel(m: WalkLimit): number {
  return m === null ? 5 : m <= 5 ? 1 : m <= 10 ? 2 : m <= 20 ? 3 : 4;
}

/** Each person’s walking limit, shortest first; the shortest sets the group’s pace. */
function WalkTile({ responders }: { responders: Responder[] }) {
  const { name, highlightId } = usePeople();
  const rows = walkRows(responders);
  const shortest = shortestWalk(rows);
  const who = shortest ? shortest.personIds.map(name) : [];

  return (
    <Tile
      icon={<Footprints />}
      title="Walking limits"
      summary={shortest ? `${shortest.minutes} min at a time` : responders.length ? 'No limits' : 'No answers yet'}
      note={
        shortest
          ? `${joinNames(who, { start: true })} can walk about ${shortest.minutes} minutes at a time. Plan rest stops or a short taxi for longer stretches.`
          : responders.length
            ? 'Nobody set a walking limit.'
            : undefined
      }
    >
      {rows.length > 0 && (
        <ul className="p13-rows">
          {rows.map((r) => {
            const level = walkLevel(r.minutes);
            const isLimit = !!shortest && r.minutes === shortest.minutes;
            return (
              <li key={r.personId} className={`p13-row p13-walk-row ${isLimit ? 'is-limit' : ''} ${r.personId === highlightId ? 'is-mine' : ''}`}>
                <span className="p13-row-people">
                  <PeopleInline ids={[r.personId]} />
                </span>
                <span className="p13-ruler" aria-hidden>
                  {[1, 2, 3, 4, 5].map((i) => (
                    <i key={i} className={i <= level ? 'is-on' : ''} />
                  ))}
                </span>
                <span className="p13-walk-label num">{walkLabel(r.minutes)}</span>
              </li>
            );
          })}
        </ul>
      )}
    </Tile>
  );
}

/* --------------------------------------------------------------- tickets */

/** Planned stops that need tickets (still to book / booked) and how people feel about booking. */
function TicketsTile({ responders, events, trip }: { responders: Responder[]; events: TripEvent[]; trip: Trip }) {
  const { name, highlightId } = usePeople();
  const stops = ticketStops(events);
  const prefs = ticketPrefs(responders);
  const help = prefs['need-help'].map(name);
  const walkIn = prefs['prefer-walk-in'].map(name);

  const noteParts: string[] = [];
  if (stops.all.length) noteParts.push(`${plural(stops.all.length, 'planned stop needs', 'planned stops need')} tickets.`);
  if (help.length) noteParts.push(`${joinNames(help, { start: true })} would like help booking.`);
  if (walkIn.length) noteParts.push(`${joinNames(walkIn, { start: true })} ${agree(walkIn, 'prefers', 'prefer')} walk-in places.`);

  const hasStops = stops.toBook.length > 0 || stops.booked.length > 0;

  return (
    <Tile
      wide
      icon={<Ticket />}
      title="Tickets & booking"
      summary={stops.all.length === 0 ? 'No ticketed stops yet' : stops.toBook.length ? `${stops.toBook.length} of ${stops.all.length} still to book` : `All ${stops.all.length} booked`}
      note={noteParts.join(' ') || undefined}
    >
      <div className={hasStops ? 'p13-split' : undefined}>
        {hasStops && (
          <div className="p13-tile-group">
            {stops.toBook.length > 0 && (
              <>
                <TileLabel>Still to book</TileLabel>
                <ul className="p13-stops is-compact">
                  {stops.toBook.map((e) => (
                    <li key={e.id}>
                      <Link to={paths.event(trip.id, e.id)} className="p13-stop">
                        <span className="p13-stop-main">
                          <span className="p13-stop-name">{eventLabel(e)}</span>
                          <span className="p13-stop-day num">{dayLabel(trip, e.date)}</span>
                        </span>
                        <Badge tone="warning">Not booked</Badge>
                        <ChevronRight className="p13-stop-chevron" aria-hidden />
                      </Link>
                    </li>
                  ))}
                </ul>
              </>
            )}
            {stops.booked.length > 0 && (
              <details className="p13-details">
                <summary>
                  <span>Booked ({stops.booked.length})</span>
                  <ChevronDown aria-hidden />
                </summary>
                <ul className="p13-stops is-compact">
                  {stops.booked.map((e) => (
                    <li key={e.id}>
                      <Link to={paths.event(trip.id, e.id)} className="p13-stop">
                        <span className="p13-stop-main">
                          <span className="p13-stop-name">{eventLabel(e)}</span>
                          <span className="p13-stop-day num">
                            {dayLabel(trip, e.date)} · {e.confirmation}
                          </span>
                        </span>
                        <Badge tone="success">Booked</Badge>
                        <ChevronRight className="p13-stop-chevron" aria-hidden />
                      </Link>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        )}
        {responders.length > 0 && (
          <div className="p13-tile-group">
            <TileLabel>How people feel about booking</TileLabel>
            <ul className="p13-feel">
              {TICKET_OPTIONS.filter((o) => prefs[o.value].length > 0).map((o) => (
                <li key={o.value} className={`p13-feel-item ${highlightId && prefs[o.value].includes(highlightId) ? 'is-mine' : ''}`}>
                  <span className="p13-feel-label">{TICKET_PHRASE[o.value]}</span>
                  <PeopleInline ids={prefs[o.value]} />
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Tile>
  );
}

/* ------------------------------------------------------------- interests */

/** The doc's own examples: modern vs. ancient vs. cultural sights. */
const TRIO = ['historic', 'cultural', 'modern'] as const;

/** Interests: historic vs. cultural vs. modern up top, then everything else with counts. */
function InterestsTile({ responders }: { responders: Responder[] }) {
  const { total, highlightId } = usePeople();
  const counts = tagCounts(responders, interestsOf, INTEREST_OPTIONS);
  const trio = TRIO.map((k) => counts.find((c) => c.value === k)!);
  const others = counts.filter((c) => !(TRIO as readonly string[]).includes(c.value));
  const picked = others.filter((c) => c.personIds.length > 0);
  const nobody = others.filter((c) => c.personIds.length === 0);
  const { visible, toggle } = useShowMore(picked, 4, 'interests');
  const top = counts[0];
  const historic = trio[0].personIds.length;
  const modern = trio[2].personIds.length;

  const lean =
    historic > modern
      ? `The group leans historic over modern, ${historic} to ${modern}.`
      : modern > historic
        ? `The group leans modern over historic, ${modern} to ${historic}.`
        : historic > 0
          ? 'The group is split between modern and historic sights.'
          : '';

  return (
    <Tile
      wide
      icon={<Landmark />}
      title="Interests"
      summary={top && top.personIds.length ? top.label : 'No interests yet'}
      note={top && top.personIds.length ? (total < 2 ? ONE_ANSWER : `${top.personIds.length} of ${total} picked it. ${lean}`.trim()) : undefined}
    >
      {responders.length > 0 && (
        <>
          <div className="p13-trio" role="list">
            {trio.map((c) => (
              <div key={c.value} role="listitem" className={`p13-trio-item ${highlightId && c.personIds.includes(highlightId) ? 'is-mine' : ''}`}>
                <span className="p13-trio-num num">{c.personIds.length}</span>
                <span className="p13-trio-label">{c.label}</span>
                {c.personIds.length ? <PeopleInline ids={c.personIds} size={20} /> : <span className="p13-nobody">Nobody yet</span>}
              </div>
            ))}
          </div>
          {picked.length > 0 && (
            <div className="p13-tile-group">
              <TileLabel>Other interests</TileLabel>
              <ul className="p13-rows is-columns">
                {visible.map((c) => (
                  <li key={c.value} className={`p13-row ${highlightId && c.personIds.includes(highlightId) ? 'is-mine' : ''}`}>
                    <span className="p13-row-label">
                      <strong>{c.label}</strong>
                    </span>
                    <span className="p13-row-meter">
                      <CountMeter count={c.personIds.length} total={total} />
                      <span className="sr-only">
                        {c.personIds.length} of {total}
                      </span>
                    </span>
                    <span className="p13-row-people">
                      <PeopleInline ids={c.personIds} />
                    </span>
                  </li>
                ))}
              </ul>
              {toggle}
            </div>
          )}
          {nobody.length > 0 && <p className="p13-tile-foot">Nobody picked: {nobody.map((c) => c.label.toLowerCase()).join(', ')}.</p>}
        </>
      )}
    </Tile>
  );
}

/* ----------------------------------------------------------- other needs */

/** Free-text "anything else" notes from the survey, in each person’s own words. */
function OtherNeedsTile({ responders }: { responders: Responder[] }) {
  const notes = otherNeeds(responders);
  return (
    <Tile icon={<MessageSquareText />} title="Other needs" note={notes.length ? 'In their own words, from the survey.' : undefined}>
      {notes.length ? (
        <div className="p13-quotes">
          {notes.map((n) => (
            <QuoteCard key={n.personId} personId={n.personId} text={n.text} />
          ))}
        </div>
      ) : (
        <TileEmpty>Nobody added other needs.</TileEmpty>
      )}
    </Tile>
  );
}
