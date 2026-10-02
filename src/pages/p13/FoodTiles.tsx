/**
 * Section 1 of Page 13 — "Food & dining": dietary needs, local vs. familiar,
 * spend per meal, simple vs. extravagant, and restaurant atmosphere.
 * Everything here is computed from the group's survey answers (Page 15).
 */

import type { ReactNode } from 'react';
import { AlertTriangle, Armchair, Check, ChevronRight, CircleDollarSign, Gem, Globe, UtensilsCrossed } from 'lucide-react';
import type { Trip, TripEvent } from '../../data/types';
import { listJoin, moneyWhole, plural } from '../../lib/format';
import { Link } from '../../router/router';
import { paths } from '../../router/routes';
import { Badge } from '../../components/ui/Display';
import { eventLabel } from '../../components/domain/EventItem';
import { ATMOSPHERE_OPTIONS, FANCY_SCALE, LOCAL_SCALE, SPEND_OPTIONS, spendOption, type ScaleDef } from '../p15/vocab';
import { dayLabel, dietGroups, dietNotes, MUST_PHRASE, plannedMeals, scaleResult, spendResult, tagCounts, type Responder, type ScaleResult } from './aggregate';
import { agree, CountMeter, joinNames, ONE_ANSWER, PeopleInline, QuoteCard, ScaleTrack, Tile, TileEmpty, TileLabel, usePeople, useShowMore } from './TileParts';

const KIND_TONE = { severe: 'danger', diet: 'neutral', mild: 'warning' } as const;

/** Capitalize the first letter ("nut-free and …" → "Nut-free and …"). */
function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** The five "Food & dining" tiles, in a 2-column grid (1 column on phones). */
export function FoodTiles({ responders, events, trip }: { responders: Responder[]; events: TripEvent[]; trip: Trip }) {
  return (
    <div className="p13-grid">
      <DietTile responders={responders} />
      <ScaleTile
        title="Local delights or a taste of home"
        icon={<Globe />}
        scale={LOCAL_SCALE}
        result={scaleResult(responders, (s) => s.localVsFamiliar)}
        highNote={(names) => `${joinNames(names, { start: true })} ${agree(names, 'wants', 'want')} all-local meals.`}
        lowNote={(names) => `${joinNames(names, { start: true })} ${agree(names, 'prefers', 'prefer')} familiar food, so keep a familiar option nearby.`}
      />
      <ScaleTile
        title="Simple or extravagant"
        icon={<Gem />}
        scale={FANCY_SCALE}
        result={scaleResult(responders, (s) => s.simpleVsExtravagant)}
        highNote={(names) => `${joinNames(names, { start: true })} would enjoy a splurge or two.`}
        lowNote={(names) => `${joinNames(names, { start: true })} ${agree(names, 'prefers', 'prefer')} simple meals.`}
      />
      <SpendTile responders={responders} events={events} trip={trip} />
      <AtmosphereTile responders={responders} />
    </div>
  );
}

/* -------------------------------------------------------- dietary needs */

/** Every diet and allergy in the group (severe first), who has it, and their food notes. */
function DietTile({ responders }: { responders: Responder[] }) {
  const groups = dietGroups(responders);
  const notes = dietNotes(responders);
  const { highlightId } = usePeople();
  const severe = groups.filter((g) => g.kind === 'severe');
  const diets = groups.filter((g) => g.kind === 'diet');
  const mild = groups.filter((g) => g.kind === 'mild');

  // The takeaway: what every restaurant has to guarantee, then what to offer.
  let summary: string;
  let note: string;
  if (severe.length) {
    summary = capitalize(listJoin(severe.map((g) => MUST_PHRASE[g.key] ?? `${g.label.toLowerCase()}-free`)));
    note = `Every restaurant has to handle ${severe.length === 1 ? 'this' : 'these'}.${diets.length ? ` Also plan ${listJoin(diets.map((d) => d.label.toLowerCase()))} options.` : ''}`;
  } else if (diets.length) {
    summary = `${capitalize(listJoin(diets.map((d) => d.label.toLowerCase())))} options`;
    note = mild.length ? `Mild allergies: ${listJoin(mild.map((m) => m.label.toLowerCase()))}.` : 'No allergies in the group.';
  } else if (mild.length) {
    summary = 'No severe allergies';
    note = `Mild allergies: ${listJoin(mild.map((m) => m.label.toLowerCase()))}.`;
  } else {
    summary = 'No restrictions';
    note = 'Nobody listed a diet or allergy.';
  }

  return (
    <Tile wide icon={severe.length ? <AlertTriangle /> : <UtensilsCrossed />} tone={severe.length ? 'alert' : 'default'} title="Dietary needs & allergies" summary={summary} note={note}>
      {groups.length > 0 ? (
        <ul className="p13-diet-list">
          {groups.map((g) => {
            const Icon = g.icon ?? UtensilsCrossed;
            return (
              <li key={g.key} className={`p13-diet is-${g.kind} ${highlightId && g.personIds.includes(highlightId) ? 'is-mine' : ''}`}>
                <span className="p13-diet-icon" aria-hidden>
                  <Icon />
                </span>
                <span className="p13-diet-main">
                  <span className="p13-diet-label">{g.label}</span>
                  <Badge tone={KIND_TONE[g.kind]}>{g.badge}</Badge>
                </span>
                <PeopleInline ids={g.personIds} />
              </li>
            );
          })}
        </ul>
      ) : (
        <TileEmpty>Nobody in the group has a diet or food allergy.</TileEmpty>
      )}
      {notes.length > 0 && (
        <div className="p13-tile-group">
          <TileLabel>Notes from the group</TileLabel>
          <div className="p13-quotes">
            {notes.map((n) => (
              <QuoteCard key={n.personId} personId={n.personId} text={n.text} />
            ))}
          </div>
        </div>
      )}
    </Tile>
  );
}

/* ------------------------------------------------------------ the scales */

/** A 5-step scale tile (Local ↔ Home or Simple ↔ Extravagant) with a one-line takeaway. */
function ScaleTile({
  title,
  icon,
  scale,
  result,
  highNote,
  lowNote,
}: {
  title: string;
  icon: ReactNode;
  scale: ScaleDef;
  result: ScaleResult;
  /** Sentence about people well ABOVE the middle (higher stored values). */
  highNote: (names: string[]) => string;
  lowNote: (names: string[]) => string;
}) {
  const { name, total } = usePeople();
  const notes = [result.high.length ? highNote(result.high.map(name)) : '', result.low.length ? lowNote(result.low.map(name)) : ''].filter(Boolean);
  const note = !result.median ? undefined : total < 2 ? ONE_ANSWER : notes.length ? notes.join(' ') : 'Everyone is within a step of each other.';
  return (
    <Tile icon={icon} title={title} summary={result.median ? scale.labels[result.median] : 'No answers yet'} note={note}>
      <ScaleTrack scale={scale} buckets={result.buckets} median={result.median} />
    </Tile>
  );
}

/* ---------------------------------------------------------- spend per meal */

/** How many planned meals above the comfort zone to list before "and N more". */
const PRICEY_PREVIEW = 3;

/** Spend per meal: who picked each price level, the comfort zone, and planned meals that cost more. */
function SpendTile({ responders, events, trip }: { responders: Responder[]; events: TripEvent[]; trip: Trip }) {
  const { name, total, highlightId } = usePeople();
  const spend = spendResult(responders);
  const comfort = SPEND_OPTIONS.find((o) => o.value === spend.comfort);
  const belowNames = spend.below.map(name);
  // Check the itinerary: which planned meals cost more than the comfort zone?
  const meals = plannedMeals(events);
  const pricey = spend.comfort ? meals.filter((m) => m.tier > spend.comfort!) : [];

  return (
    <Tile
      icon={<CircleDollarSign />}
      title="Spend per meal"
      summary={
        comfort ? (
          <>
            <span className="num">{comfort.symbol}</span> comfort zone
          </>
        ) : (
          'No answers yet'
        )
      }
      note={
        !comfort
          ? undefined
          : total < 2
            ? `${comfort.range} per person. ${ONE_ANSWER}`
            : `${comfort.range} per person. ${spend.fine} of ${total} ${spend.fine === 1 ? 'is' : 'are'} fine with this.${belowNames.length ? ` ${joinNames(belowNames, { start: true })} ${agree(belowNames, 'prefers', 'prefer')} less, so mix in cheaper spots.` : ''}`
      }
    >
      <ul className="p13-rows">
        {SPEND_OPTIONS.map((o) => {
          const ids = spend.buckets[o.value];
          const isComfort = o.value === spend.comfort;
          return (
            <li key={o.value} className={`p13-row p13-spend-row ${isComfort ? 'is-comfort' : ''} ${highlightId && ids.includes(highlightId) ? 'is-mine' : ''}`}>
              <span className="p13-row-label">
                <strong className="num">{o.symbol}</strong>
                <span className="p13-row-sub num">{o.range}</span>
              </span>
              <span className="p13-row-meter">
                <CountMeter count={ids.length} total={total} />
                <span className="sr-only">
                  {ids.length} of {total}
                  {isComfort ? ', the group’s comfort zone' : ''}
                </span>
              </span>
              <span className="p13-row-people">{ids.length ? <PeopleInline ids={ids} /> : <span className="p13-nobody">Nobody</span>}</span>
            </li>
          );
        })}
      </ul>

      {comfort && meals.length > 0 && (
        <div className="p13-tile-group">
          <TileLabel>Planned meals</TileLabel>
          {pricey.length === 0 ? (
            <p className="p13-ok">
              <Check aria-hidden /> All {plural(meals.length, 'planned meal')} fit the {comfort.symbol} comfort zone.
            </p>
          ) : (
            <>
              <p className="p13-tile-note">
                {pricey.length} of {meals.length} cost more than {comfort.symbol} per person.
              </p>
              <ul className="p13-stops is-compact">
                {pricey.slice(0, PRICEY_PREVIEW).map((m) => (
                  <li key={m.event.id}>
                    <Link to={paths.event(trip.id, m.event.id)} className="p13-stop">
                      <span className="p13-stop-main">
                        <span className="p13-stop-name">{eventLabel(m.event)}</span>
                        <span className="p13-stop-day num">
                          {dayLabel(trip, m.event.date)} · {moneyWhole(m.perPerson)} per person
                        </span>
                      </span>
                      <Badge tone="warning">
                        <span className="num">{spendOption(m.tier).symbol}</span>
                      </Badge>
                      <ChevronRight className="p13-stop-chevron" aria-hidden />
                    </Link>
                  </li>
                ))}
              </ul>
              {pricey.length > PRICEY_PREVIEW && <p className="p13-tile-foot">And {pricey.length - PRICEY_PREVIEW} more. See each day’s plan for details.</p>}
            </>
          )}
        </div>
      )}
    </Tile>
  );
}

/* ------------------------------------------------------------ atmosphere */

/** Opposite pairs worth flagging when the group is split. */
const SPLITS: Array<{ a: string; b: string; topic: string }> = [
  { a: 'quiet', b: 'lively', topic: 'noise' },
  { a: 'casual', b: 'upscale', topic: 'dress-up' },
];

/** Restaurant atmosphere: how many picked each vibe, and where the group is split. */
function AtmosphereTile({ responders }: { responders: Responder[] }) {
  const { name, total, highlightId } = usePeople();
  const counts = tagCounts(responders, (s) => s.atmosphere, ATMOSPHERE_OPTIONS);
  const picked = counts.filter((c) => c.personIds.length > 0);
  const nobody = counts.filter((c) => c.personIds.length === 0);
  const { visible, toggle } = useShowMore(picked, 4, 'atmospheres');
  const top = picked.filter((c) => c.personIds.length >= 2).slice(0, 3);
  const headline = (top.length ? top : picked.slice(0, 2)).map((c) => c.label.toLowerCase());

  // "Split on noise: quiet (Priya, Linda) or lively (You)."
  const splits = SPLITS.flatMap(({ a, b, topic }) => {
    const ca = counts.find((c) => c.value === a);
    const cb = counts.find((c) => c.value === b);
    if (!ca?.personIds.length || !cb?.personIds.length) return [];
    return [`Split on ${topic}: ${ca.label.toLowerCase()} (${joinNames(ca.personIds.map(name))}) or ${cb.label.toLowerCase()} (${joinNames(cb.personIds.map(name))}).`];
  });

  return (
    <Tile icon={<Armchair />} title="Restaurant atmosphere" summary={headline.length ? capitalize(listJoin(headline)) : 'No preference'} note={splits.length ? splits.join(' ') : !picked.length ? 'Nobody picked an atmosphere.' : total < 2 ? ONE_ANSWER : 'No strong disagreements.'}>
      {picked.length > 0 && (
        <ul className="p13-rows">
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
      )}
      {toggle}
      {nobody.length > 0 && picked.length > 0 && <p className="p13-tile-foot">Nobody picked: {nobody.map((c) => c.label.toLowerCase()).join(', ')}.</p>}
    </Tile>
  );
}
