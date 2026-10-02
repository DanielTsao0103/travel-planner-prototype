/**
 * Page 4 — Home.
 *
 * Doc: three main buttons — the 3-line menu (in the header, on every page),
 * a full-width "+ New Trip" (→ Page 6), and a full-width "Open existing trip"
 * (→ Page 5) — then three suggested destinations with a photo, an estimated
 * cost, and a suggested length.
 *
 * Extras that support other requirements:
 *  - During a trip, a banner links back to the trip dashboard (Page 10 auto-opens
 *    once per launch, so Home stays reachable).
 *  - Pending invitations are surfaced so invitees can find them.
 */

import { useEffect, useState } from 'react';
import { ArrowRight, CalendarRange, FolderOpen, Mail, Plane, Sparkles } from 'lucide-react';
import { HOME_SUGGESTIONS, type SuggestedDestination } from '../../data/destinations';
import { photoUrl } from '../../data/places';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import { dayNumber, formatShortDate, formatTime, relativeDays, timeToMin } from '../../lib/dates';
import { firstName, moneyWhole, plural } from '../../lib/format';
import { simulateLatency } from '../../services/http';
import { activeTrip, currentPerson, myTrips, now, pendingInvites, personFirstName } from '../../store/selectors';
import { useAppState } from '../../store/store';
import { Link, withQuery } from '../../router/router';
import { paths } from '../../router/routes';
import { Button } from '../../components/ui/Button';
import { Banner, DemoBadge, Skeleton } from '../../components/ui/Display';
import './p04.css';

/** "Good morning" / "Good afternoon" / "Good evening" from the demo clock. */
function greeting(time: string): string {
  const minutes = timeToMin(time);
  if (minutes < 12 * 60) return 'Good morning';
  if (minutes < 18 * 60) return 'Good afternoon';
  return 'Good evening';
}

export function HomePage({ query }: { query: URLSearchParams }) {
  const state = useAppState();
  const bp = useBreakpoint();
  const me = currentPerson(state);
  const clock = now(state);
  const trips = myTrips(state);
  const live = activeTrip(state);
  const invites = pendingInvites(state);
  const forcedLoading = query.get('s') === 'loading';

  // Suggestions "load" like a real recommendation call (visible in Slow mode).
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    let alive = true;
    simulateLatency(450).then(() => alive && setLoaded(true));
    return () => {
      alive = false;
    };
  }, []);
  const showSkeleton = forcedLoading || !loaded;

  const upcoming = trips.filter((t) => t.startDate > clock.date);
  const nextTrip = upcoming[0];
  const tripCountLine = trips.length
    ? `${plural(trips.length, 'trip')}${nextTrip ? ` · next: ${nextTrip.title} ${relativeDays(clock.date, nextTrip.startDate)}` : ''}`
    : 'No trips yet';

  return (
    <div className="container page p04">
      <header className="p04-hello">
        <p className="eyebrow num">{formatShortDate(clock.date)} · {formatTime(clock.time)}</p>
        <h1 className="p04-title">
          {greeting(clock.time)}, {me ? firstName(me.name) : 'traveler'}.
          <span className="p04-title-sub"> Where to next?</span>
        </h1>
      </header>

      {live && (
        <Banner
          tone="info"
          icon={<CalendarRange aria-hidden />}
          className="p04-live"
          title={`You’re on your trip: ${live.title}`}
          action={
            <Button to={paths.dashboard(live.id)} size="sm" iconRight={<ArrowRight />}>
              Open trip dashboard
            </Button>
          }
        >
          Day {dayNumber(live, clock.date)} of {dayNumber(live, live.endDate)}. Your dashboard has today’s plan, to-dos, and where to go next.
        </Banner>
      )}

      {invites.length > 0 && (
        <Banner
          tone="info"
          icon={<Mail aria-hidden />}
          title={invites.length === 1 ? `${personFirstName(state, invites[0].ownerId)} invited you to ${invites[0].title}` : `You have ${invites.length} trip invitations`}
          action={
            <Button to={paths.trips()} size="sm" variant="secondary">
              View invitation{invites.length === 1 ? '' : 's'}
            </Button>
          }
        />
      )}

      {/* The doc's two full-width buttons (the third "button" is the header's 3-line menu). */}
      <nav className="p04-actions" aria-label="Trips">
        <Link to={paths.newTrip()} className="p04-action p04-action-new">
          <span className="p04-action-icon" aria-hidden>
            <Plane />
          </span>
          <span className="p04-action-text">
            <span className="p04-action-label">+ New Trip</span>
            <span className="p04-action-sub">Name it, pick where you’re going, and invite people</span>
          </span>
          <ArrowRight className="p04-action-arrow" aria-hidden />
        </Link>
        <Link to={paths.trips()} className="p04-action p04-action-open">
          <span className="p04-action-icon" aria-hidden>
            <FolderOpen />
          </span>
          <span className="p04-action-text">
            <span className="p04-action-label">Open existing trip</span>
            <span className="p04-action-sub num">{tripCountLine}</span>
          </span>
          <ArrowRight className="p04-action-arrow" aria-hidden />
        </Link>
      </nav>

      <section className="p04-suggest" aria-labelledby="p04-suggest-title">
        <div className="p04-suggest-head">
          <div className="stack-xs">
            <p className="eyebrow row">
              <Sparkles width={14} aria-hidden /> Suggested places to travel
            </p>
            <h2 id="p04-suggest-title">Ideas for your next trip</h2>
          </div>
          <DemoBadge title="Costs are illustrative estimates for the prototype">Estimates exclude flights</DemoBadge>
        </div>

        {showSkeleton ? (
          <div className="p04-cards" role="status" aria-label="Loading suggestions">
            {HOME_SUGGESTIONS.map((s) => (
              <div key={s.id} className="p04-card is-skeleton" aria-hidden>
                <Skeleton height={bp === 'mobile' ? 200 : 220} radius={14} />
                <div className="stack-sm" style={{ padding: '16px 4px 4px' }}>
                  <Skeleton width="60%" height={22} />
                  <Skeleton width="80%" height={14} />
                  <Skeleton width="40%" height={14} />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p04-cards">
            {HOME_SUGGESTIONS.map((s) => (
              <SuggestionCard key={s.id} suggestion={s} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

/** One suggested destination: photo, estimated cost per person, suggested length. */
function SuggestionCard({ suggestion: s }: { suggestion: SuggestedDestination }) {
  const length = s.days[0] === s.days[1] ? `${s.days[0]} days` : `${s.days[0]}–${s.days[1]} days`;
  return (
    <article className="p04-card">
      <div className="p04-card-media">
        <img src={photoUrl(s.photo, 'full')} alt={`${s.name}, ${s.region}`} loading="lazy" decoding="async" />
        <span className="p04-card-region">{s.region}</span>
      </div>
      <div className="p04-card-body">
        <h3 className="p04-card-title">{s.name}</h3>
        <dl className="p04-facts">
          <div>
            <dt>Est. cost</dt>
            <dd className="num">
              {moneyWhole(s.estCostPerPerson)}
              <span> / person</span>
            </dd>
          </div>
          <div>
            <dt>Suggested stay</dt>
            <dd className="num">{length}</dd>
          </div>
        </dl>
        <p className="p04-card-pitch">{s.pitch}</p>
        <Button to={withQuery(paths.newTrip(), { dest: s.id })} variant="secondary" block iconRight={<ArrowRight />}>
          Plan this trip
        </Button>
      </div>
    </article>
  );
}
