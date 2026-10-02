/**
 * Desktop week calendar for the trip dashboard (Page 10).
 *
 * One column per trip day and a compact time grid (8 AM–11 PM, stretched if an
 * event starts earlier or ends later). Event blocks are placed by their start
 * and end times. Day headers open that day (Page 11); an event block opens the
 * day scrolled to that event (`?focus=<eventId>`).
 *
 * Today's column is tinted marigold with a "now" line at the demo time, and
 * events that already happened are dimmed. Trips longer than 7 days page
 * through weeks with the arrows.
 */

import { useState, type CSSProperties } from 'react';
import { CalendarPlus, ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';
import type { AppState, ISODate, Time, Trip } from '../../data/types';
import type { TripAccess } from '../../lib/permissions';
import { dayNumber, formatDateRange, formatHour, formatMMDD, formatShortDate, formatTime, timeToMin, weekdayShort } from '../../lib/dates';
import { nextEventToday, tripDays, tripEvents } from '../../store/selectors';
import { Link, withQuery } from '../../router/router';
import { paths } from '../../router/routes';
import { Button, IconButton } from '../../components/ui/Button';
import { eventLabel } from '../../components/domain/EventItem';
import { hourRange, isEventNow, isEventOver, layoutLanes, timeRangeLabel, tripWeeks } from './tripTime';
import './p10.css';

/** Height of one hour row in pixels (every position below is computed from it). */
const HOUR_PX = 38;
/** Space above the first hour line so its label isn't clipped. */
const GRID_PAD = 10;

export interface WeekCalendarProps {
  state: AppState;
  trip: Trip;
  access: TripAccess;
  today: ISODate;
  nowTime: Time;
}

export function WeekCalendar({ state, trip, access, today, nowTime }: WeekCalendarProps) {
  const weeks = tripWeeks(tripDays(trip));
  const todayWeek = weeks.findIndex((w) => w.includes(today));
  const [weekIndex, setWeekIndex] = useState(Math.max(0, todayWeek));
  const week = weeks[Math.min(weekIndex, weeks.length - 1)] ?? [];
  const events = tripEvents(state, trip.id).filter((e) => week.includes(e.date));
  const { startHour, endHour } = hourRange(events, 8, 23);
  const gridStart = startHour * 60;
  const nowMin = timeToMin(nowTime);
  const nextId = nextEventToday(state, trip)?.id;
  const hours = Array.from({ length: endHour - startHour + 1 }, (_, i) => startHour + i);
  const bodyHeight = GRID_PAD * 2 + (endHour - startHour) * HOUR_PX;
  /** Minutes after midnight → pixels from the top of the grid body. */
  const y = (min: number) => GRID_PAD + ((min - gridStart) / 60) * HOUR_PX;
  const showNow = week.includes(today) && nowMin >= gridStart && nowMin <= endHour * 60;
  const gridVars = { '--p10-cols': week.length } as CSSProperties;

  return (
    <section className="p10-panel p10-week" aria-labelledby="p10-week-title">
      <div className="p10-panel-head">
        <div className="p10-panel-head-text">
          <h2 id="p10-week-title" className="p10-section-title">
            {weeks.length > 1 ? `Week ${weekIndex + 1} of ${weeks.length}` : 'This week'}
          </h2>
          <p className="small muted num">
            {week.length > 0 && formatDateRange(week[0], week[week.length - 1])} · Pick a day to see its full timeline
          </p>
        </div>
        {weeks.length > 1 && (
          <div className="row p10-week-nav">
            <IconButton label="Previous week" icon={<ChevronLeft />} variant="secondary" size="sm" disabled={weekIndex === 0} onClick={() => setWeekIndex((i) => Math.max(0, i - 1))} />
            <IconButton label="Next week" icon={<ChevronRight />} variant="secondary" size="sm" disabled={weekIndex >= weeks.length - 1} onClick={() => setWeekIndex((i) => Math.min(weeks.length - 1, i + 1))} />
          </div>
        )}
      </div>

      {/* Day headers: each one opens that day's page. */}
      <div className="p10-week-head" style={gridVars}>
        <span className="p10-week-corner" aria-hidden />
        {week.map((d) => {
          const n = dayNumber(trip, d);
          const isToday = d === today;
          return (
            <Link
              key={d}
              to={paths.day(trip.id, d)}
              className={`p10-week-day ${isToday ? 'is-today' : ''} ${d < today ? 'is-past' : ''}`}
              aria-label={`Day ${n}, ${formatShortDate(d)}${isToday ? ', today' : ''}. Open this day`}
              aria-current={isToday ? 'date' : undefined}
            >
              <span className="p10-week-dow">{weekdayShort(d)}</span>
              <span className="p10-week-date num">{formatMMDD(d)}</span>
              <span className="p10-week-dayno">{isToday ? `Day ${n} · Today` : `Day ${n}`}</span>
            </Link>
          );
        })}
      </div>

      <div className="p10-week-body" style={{ ...gridVars, height: bodyHeight }}>
        {/* Hour lines and labels (decorative: each event says its own time). */}
        <div className="p10-week-lines" aria-hidden>
          {hours.map((h) => (
            <div key={h} className="p10-week-line" style={{ top: y(h * 60) }}>
              <span className="p10-week-hour">{h < 24 ? formatHour(h) : '12 AM'}</span>
            </div>
          ))}
        </div>
        <span className="p10-week-corner" aria-hidden />
        {week.map((d) => {
          const dayEvents = layoutLanes(events.filter((e) => e.date === d));
          const isToday = d === today;
          return (
            <div key={d} className={`p10-week-col ${isToday ? 'is-today' : ''}`}>
              {dayEvents.map(({ event: e, lane, lanes }) => {
                const top = y(timeToMin(e.start));
                const height = Math.max(16, y(timeToMin(e.end)) - top - 2);
                const over = isEventOver(e, today, nowMin);
                const live = isEventNow(e, today, nowMin);
                const style: CSSProperties = {
                  top,
                  height,
                  left: `calc(${(lane / lanes) * 100}% + 3px)`,
                  width: `calc(${100 / lanes}% - 6px)`,
                };
                return (
                  <Link
                    key={e.id}
                    to={withQuery(paths.day(trip.id, d), { focus: e.id })}
                    className={`p10-wk-ev ${over ? 'is-past' : ''} ${live ? 'is-now' : ''} ${e.id === nextId ? 'is-next' : ''} ${height < 30 ? 'is-short' : height < 52 ? 'is-one-line' : ''}`}
                    style={style}
                    title={`${eventLabel(e)} · ${timeRangeLabel(e.start, e.end)}`}
                    aria-label={`${eventLabel(e)}, ${formatShortDate(d)}, ${timeRangeLabel(e.start, e.end)}${live ? ', happening now' : ''}${e.id === nextId ? ', next up' : ''}`}
                  >
                    <span className="p10-wk-ev-name">{eventLabel(e)}</span>
                    {height >= 30 && <span className="p10-wk-ev-time num">{formatTime(e.start)}</span>}
                  </Link>
                );
              })}
              {isToday && showNow && (
                <div className="p10-wk-now" style={{ top: y(nowMin) }} aria-hidden>
                  <span className="p10-wk-now-dot" />
                </div>
              )}
            </div>
          );
        })}

        {events.length === 0 && (
          <div className="p10-week-empty">
            <p className="p10-week-empty-title">Nothing planned for these days yet</p>
            <div className="cluster">
              {access.canAddEvents && (
                <Button size="sm" icon={<CalendarPlus />} to={withQuery(paths.newEvent(trip.id), { date: week.includes(today) ? today : week[0] })}>
                  Add event
                </Button>
              )}
              <Button size="sm" variant="secondary" icon={<Sparkles />} to={paths.ideas(trip.id)}>
                See ideas
              </Button>
            </div>
          </div>
        )}
      </div>
      {showNow && <p className="sr-only">Current time: {formatTime(nowTime)}</p>}
    </section>
  );
}
