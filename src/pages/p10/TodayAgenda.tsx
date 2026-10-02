/**
 * Phone dashboard, "Today": what's still ahead today, in order.
 *
 * Shows a "now" marker, the event happening now (if any) and the next events
 * (up to three in total), with the free time between them ("Free 2:15–3:30 PM ·
 * See ideas"), then a button into the full day (Page 11).
 */

import { CalendarPlus, Sparkles, Sunrise } from 'lucide-react';
import type { AppState, ISODate, Time, Trip } from '../../data/types';
import type { TripAccess } from '../../lib/permissions';
import { formatDuration, formatTime, timeToMin } from '../../lib/dates';
import { plural } from '../../lib/format';
import { eventsOn, freeGaps } from '../../store/selectors';
import { Link, withQuery } from '../../router/router';
import { paths } from '../../router/routes';
import { Button } from '../../components/ui/Button';
import { Badge, EmptyState } from '../../components/ui/Display';
import { EventItem } from '../../components/domain/EventItem';
import { isEventNow, timeRangeLabel } from './tripTime';
import './p10.css';

export interface TodayAgendaProps {
  state: AppState;
  trip: Trip;
  access: TripAccess;
  today: ISODate;
  nowTime: Time;
}

/** One row of the agenda: an event, or a free stretch between events. */
type Row = { kind: 'event'; at: number; id: string } | { kind: 'gap'; at: number; start: Time; end: Time; minutes: number };

const MAX_EVENTS = 3;

export function TodayAgenda({ state, trip, access, today, nowTime }: TodayAgendaProps) {
  const nowMin = timeToMin(nowTime);
  const all = eventsOn(state, trip.id, today);
  const ahead = all.filter((e) => timeToMin(e.end) > nowMin); // happening now or later
  const shown = ahead.slice(0, MAX_EVENTS);
  const doneCount = all.length - ahead.length;
  const lastShownStart = shown.length ? timeToMin(shown[shown.length - 1].start) : -1;
  const ideasForToday = withQuery(paths.ideas(trip.id), { day: today });

  // Free time that is still ahead and sits before one of the shown events.
  const gaps = freeGaps(state, trip.id, today).filter((g) => timeToMin(g.end) > nowMin && timeToMin(g.start) < lastShownStart);
  const rows: Row[] = [
    ...shown.map((e) => ({ kind: 'event' as const, at: timeToMin(e.start), id: e.id })),
    ...gaps.map((g) => ({ kind: 'gap' as const, at: timeToMin(g.start), ...g })),
  ].sort((a, b) => a.at - b.at);

  return (
    <section className="p10-agenda" aria-labelledby="p10-agenda-title">
      <div className="p10-section-head">
        <h2 id="p10-agenda-title" className="p10-section-title">
          Today
        </h2>
        {all.length > 0 && <span className="p10-count num">{plural(all.length, 'event')}</span>}
      </div>

      {all.length === 0 ? (
        <EmptyState
          compact
          icon={<Sunrise />}
          title="Nothing planned today"
          actions={
            <>
              {access.canEditDay(today) && (
                <Button icon={<CalendarPlus />} to={withQuery(paths.newEvent(trip.id), { date: today, return: paths.dashboard(trip.id) })}>
                  Add event
                </Button>
              )}
              <Button variant="secondary" icon={<Sparkles />} to={ideasForToday}>
                See ideas for today
              </Button>
            </>
          }
        >
          A free day. Browse ideas that fit the group, or keep it open.
        </EmptyState>
      ) : (
        <>
          <p className="p10-agenda-now num">
            <span className="p10-agenda-now-dot" aria-hidden />
            Now · {formatTime(nowTime)}
            {doneCount > 0 && <span className="muted"> · {doneCount} done earlier</span>}
          </p>
          {rows.length === 0 ? (
            <p className="p10-agenda-quiet">That’s everything planned for today.</p>
          ) : (
            <ol className="p10-agenda-list">
              {rows.map((row) => {
                if (row.kind === 'gap') {
                  return (
                    <li key={`gap-${row.start}`} className="p10-agenda-gap">
                      <span className="num">
                        Free {timeRangeLabel(row.start, row.end)}
                        <span className="muted"> · {formatDuration(row.minutes)}</span>
                      </span>
                      <Link to={ideasForToday} className="p10-agenda-gap-link">
                        See ideas
                      </Link>
                    </li>
                  );
                }
                const e = shown.find((x) => x.id === row.id)!;
                const live = isEventNow(e, today, nowMin);
                return (
                  <li key={e.id}>
                    <EventItem
                      event={e}
                      compact
                      to={withQuery(paths.day(trip.id, today), { focus: e.id })}
                      meta={
                        live ? (
                          <>
                            <Badge tone="accent">Now</Badge>
                            <span className="num">until {formatTime(e.end)}</span>
                          </>
                        ) : (
                          <span className="num">{timeRangeLabel(e.start, e.end)}</span>
                        )
                      }
                    />
                  </li>
                );
              })}
            </ol>
          )}
          {ahead.length > shown.length && <p className="small muted">{plural(ahead.length - shown.length, 'more event')} later today</p>}
        </>
      )}

      {all.length > 0 && (
        <Button to={paths.day(trip.id, today)} variant="secondary" block>
          See full day
        </Button>
      )}
    </section>
  );
}
