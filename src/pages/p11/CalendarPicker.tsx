/**
 * "Calendar" mode of the day page (11E). The Home menu's Calendar item lands
 * here (`?from=calendar`), so people need a quick way to pick which trip and
 * which day they're looking at. Changing either one navigates right away.
 */

import type { AppState, ISODate, Trip } from '../../data/types';
import { dayHeading, formatDateRange, weekdayShort } from '../../lib/dates';
import { myTrips, phaseOf, tripDays } from '../../store/selectors';
import { navigate, withQuery } from '../../router/router';
import { paths } from '../../router/routes';
import { Field, Select } from '../../components/ui/Field';
import './p11.css';

export function CalendarPicker({ state, trip, date, today }: { state: AppState; trip: Trip; date: ISODate; today: ISODate }) {
  const mine = myTrips(state);
  // The trip on screen is always listed, even if a filter (like "hide sample trip") left it out.
  const trips = mine.some((t) => t.id === trip.id) ? mine : [trip, ...mine];

  /** Open another trip on today's date if it's happening now, else on its first day. */
  const openTrip = (tripId: string) => {
    const next = trips.find((t) => t.id === tripId);
    if (!next) return;
    const day = today >= next.startDate && today <= next.endDate ? today : next.startDate;
    navigate(withQuery(paths.day(next.id, day), { from: 'calendar' }));
  };

  return (
    <div className="p11-cal" role="group" aria-labelledby="p11-cal-title">
      <p id="p11-cal-title" className="eyebrow">
        Calendar
      </p>
      <div className="p11-cal-fields">
        <Field label="Trip">
          {(p) => (
            <Select {...p} value={trip.id} onChange={(e) => openTrip(e.target.value)}>
              {trips.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title} · {formatDateRange(t.startDate, t.endDate)}
                  {phaseOf(state, t) === 'active' ? ' (now)' : ''}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Day">
          {(p) => (
            <Select {...p} value={date} onChange={(e) => navigate(withQuery(paths.day(trip.id, e.target.value), { from: 'calendar' }))}>
              {tripDays(trip).map((d) => (
                <option key={d} value={d}>
                  {dayHeading(trip, d)} · {weekdayShort(d)}
                  {d === today ? ' (today)' : ''}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>
    </div>
  );
}
