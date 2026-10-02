/**
 * Desktop right rail for the itinerary (Page 8):
 *  - Jump to day (stays pinned while the list scrolls)
 *  - Who's going (avatars + roles → People)
 *  - Budget snapshot (spent vs. budget → Budget)
 *  - Ideas waiting for a decision (→ Ideas)
 */

import { ChevronRight } from 'lucide-react';
import type { ISODate, Suggestion, Trip } from '../../data/types';
import { PlacePhoto } from '../../components/domain/PlacePhoto';
import { Avatar, Badge, RoleBadge } from '../../components/ui/Display';
import { dayHeading } from '../../lib/dates';
import { moneyWhole, plural } from '../../lib/format';
import { Link } from '../../router/router';
import { paths } from '../../router/routes';
import type { DayGroup } from '../../store/selectors';
import { peopleLine, type BudgetSnapshot, type PeopleSummary } from './itinerary';

export interface ItineraryRailProps {
  trip: Trip;
  days: DayGroup[];
  active?: ISODate;
  todayIso: ISODate;
  onJump: (date: ISODate) => void;
  people: PeopleSummary;
  /** Display name for a person ("You" for the acting person). */
  nameOf: (personId: string) => string;
  budget: BudgetSnapshot;
  ideas: Suggestion[];
  /** The trip has no bundled ideas, so Page 9 fetches live ones. */
  liveIdeas: boolean;
  isPast: boolean;
  canManagePeople: boolean;
  canSetBudget: boolean;
}

export function ItineraryRail(props: ItineraryRailProps) {
  return (
    <aside className="p08-rail" aria-label="Trip summary">
      <JumpCard {...props} />
      <PeopleCard {...props} />
      <BudgetCard {...props} />
      {!props.isPast && <IdeasCard {...props} />}
    </aside>
  );
}

/* ------------------------------------------------------------ jump to day */

function JumpCard({ trip, days, active, todayIso, onJump, isPast }: ItineraryRailProps) {
  return (
    <nav className="p08-card p08-jump" aria-labelledby="p08-jump-title">
      <h2 className="p08-card-title" id="p08-jump-title">
        Jump to day
      </h2>
      <ul className="p08-jump-list">
        {days.map((d) => {
          const isActive = d.date === active;
          return (
            <li key={d.date}>
              <button type="button" className={`p08-jump-item ${isActive ? 'is-active' : ''}`} aria-current={isActive ? 'true' : undefined} onClick={() => onJump(d.date)}>
                <span className="p08-jump-day num">{dayHeading(trip, d.date)}</span>
                {d.date === todayIso && <Badge tone="accent">Today</Badge>}
                <span className={`p08-jump-count ${d.events.length ? '' : 'is-empty'}`}>
                  {d.events.length ? plural(d.events.length, 'event') : isPast ? 'Nothing planned' : 'Nothing yet'}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/* ------------------------------------------------------------ who's going */

function PeopleCard({ trip, people, nameOf, isPast, canManagePeople }: ItineraryRailProps) {
  return (
    <section className="p08-card" aria-labelledby="p08-people-title">
      <div className="p08-card-head">
        <h2 className="p08-card-title" id="p08-people-title">
          {isPast ? 'Who went' : 'Who’s going'}
        </h2>
        <span className="p08-card-aside">{peopleLine(people, isPast)}</span>
      </div>
      <ul className="p08-people">
        {people.rows.map((r) => (
          <li key={r.person.id} className="p08-person">
            <Avatar person={r.person} size={28} />
            <span className="p08-person-name truncate">{nameOf(r.person.id)}</span>
            {r.status === 'pending' ? <Badge>Invited</Badge> : <RoleBadge role={r.role} days={r.role === 'day' ? r.days?.length : undefined} />}
          </li>
        ))}
      </ul>
      <Link to={paths.people(trip.id)} className="p08-card-link">
        {canManagePeople && !isPast ? 'Manage people' : 'See everyone'}
        <ChevronRight aria-hidden />
      </Link>
    </section>
  );
}

/* ----------------------------------------------------------------- budget */

function BudgetCard({ trip, budget, isPast, canSetBudget }: ItineraryRailProps) {
  const { spent, budget: limit, mode, openRepayments } = budget;
  const pct = limit ? Math.round((spent / limit) * 100) : 0;
  const over = limit !== null && spent > limit;
  return (
    <section className="p08-card" aria-labelledby="p08-budget-title">
      <div className="p08-card-head">
        <h2 className="p08-card-title" id="p08-budget-title">
          Budget
        </h2>
        <span className="p08-card-aside">{mode === 'group' ? 'Group' : 'Your share'}</span>
      </div>
      {limit !== null ? (
        <>
          <p className="p08-budget-figure">
            <span className="num">{moneyWhole(spent)}</span>
            <span className="p08-budget-of num">of {moneyWhole(limit)}</span>
          </p>
          <div
            className={`p08-meter ${over ? 'is-over' : ''}`}
            role="meter"
            aria-label="Budget spent"
            aria-valuemin={0}
            aria-valuemax={limit}
            aria-valuenow={Math.round(spent)}
            aria-valuetext={`${moneyWhole(spent)} of ${moneyWhole(limit)}`}
          >
            <span style={{ width: `${Math.min(100, pct)}%` }} />
          </div>
          <p className={`p08-budget-note num ${over ? 'is-over' : ''}`}>
            {over ? `${moneyWhole(spent - limit)} over budget` : `${moneyWhole(limit - spent)} left · ${pct}% spent`}
          </p>
        </>
      ) : (
        <>
          <p className="p08-budget-figure">
            <span className="num">{moneyWhole(spent)}</span>
            <span className="p08-budget-of">spent so far</span>
          </p>
          <p className="p08-budget-note">{mode === 'group' ? 'No group budget yet.' : 'You haven’t set a personal budget yet.'}</p>
        </>
      )}
      {openRepayments > 0 ? (
        <p className="p08-budget-note">{plural(openRepayments, 'repayment')} still open</p>
      ) : isPast ? (
        <p className="p08-budget-note is-settled">Everyone is settled up</p>
      ) : null}
      <Link to={paths.budget(trip.id)} className="p08-card-link">
        {limit === null && canSetBudget && mode === 'group' ? 'Set a budget' : 'Open budget'}
        <ChevronRight aria-hidden />
      </Link>
    </section>
  );
}

/* ------------------------------------------------------------------ ideas */

function IdeasCard({ trip, ideas, liveIdeas }: ItineraryRailProps) {
  const dest = trip.destinations[0]?.name ?? 'your destination';
  const shown = ideas.slice(0, 3);
  const extra = ideas.length - shown.length;
  return (
    <section className="p08-card" aria-labelledby="p08-ideas-title">
      <div className="p08-card-head">
        <h2 className="p08-card-title" id="p08-ideas-title">
          Ideas
        </h2>
        {ideas.length > 0 && <Badge tone="primary">{ideas.length} to review</Badge>}
      </div>
      {ideas.length > 0 ? (
        <>
          <div className="p08-ideas-photos" aria-hidden>
            {shown.map((s) => (
              <PlacePhoto key={s.id} photo={s.place.photo} alt="" category={s.place.category} className="p08-ideas-photo" />
            ))}
            {extra > 0 && <span className="p08-ideas-more num">+{extra}</span>}
          </div>
          <p className="p08-ideas-text">Picked from your plan, your free time, and what the group likes.</p>
        </>
      ) : (
        <p className="p08-ideas-text">{liveIdeas ? `Find things to do near ${dest}, matched to your free time.` : 'You’ve gone through every idea for this trip.'}</p>
      )}
      <Link to={paths.ideas(trip.id)} className="p08-card-link">
        {ideas.length > 0 ? 'Review ideas' : liveIdeas ? 'Get ideas' : 'Open ideas'}
        <ChevronRight aria-hidden />
      </Link>
    </section>
  );
}
