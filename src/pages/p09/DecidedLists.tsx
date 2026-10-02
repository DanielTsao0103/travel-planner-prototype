/**
 * Collapsed lists under the ideas grid:
 *  - "Not interested (n)" with Undo (declining is personal, so Viewers can too)
 *  - "Added to your trip (n)" with a link to the day each idea landed on
 */

import { useId, type ReactNode } from 'react';
import { ChevronDown, ChevronRight, Undo2 } from 'lucide-react';
import type { Suggestion, Trip, TripEvent } from '../../data/types';
import { PlacePhoto } from '../../components/domain/PlacePhoto';
import { Button } from '../../components/ui/Button';
import { dayNumber, formatTime } from '../../lib/dates';
import { paths } from '../../router/routes';
import { slotLabel } from './ideas';

/** A heading button that shows/hides its list (aria-expanded tells screen readers). */
function Disclosure({ id, label, count, open, onToggle, children }: { id?: string; label: string; count: number; open: boolean; onToggle: () => void; children: ReactNode }) {
  const listId = useId();
  return (
    <section className="p09-decided" id={id}>
      <h2 className="p09-decided-head">
        <button type="button" className="p09-disclosure" aria-expanded={open} aria-controls={listId} onClick={onToggle}>
          <span>
            {label} <span className="num">({count})</span>
          </span>
          <ChevronDown className={`p09-disclosure-icon ${open ? 'is-open' : ''}`} aria-hidden />
        </button>
      </h2>
      {open && (
        <ul id={listId} className="p09-decided-list">
          {children}
        </ul>
      )}
    </section>
  );
}

function Row({ s, meta, action }: { s: Suggestion; meta: string; action: ReactNode }) {
  return (
    <li className="p09-decided-row">
      <PlacePhoto photo={s.place.photo} alt="" category={s.place.category} className="p09-decided-thumb" />
      <div className="p09-decided-text">
        <p className="p09-decided-name">{s.place.name}</p>
        <p className="p09-decided-meta num">{meta}</p>
      </div>
      {action}
    </li>
  );
}

export function DeclinedList({ trip, items, open, onToggle, onUndo }: { trip: Trip; items: Suggestion[]; open: boolean; onToggle: () => void; onUndo: (s: Suggestion) => void }) {
  if (items.length === 0) return null;
  return (
    <Disclosure id="p09-declined" label="Not interested" count={items.length} open={open} onToggle={onToggle}>
      {items.map((s) => (
        <Row
          key={s.id}
          s={s}
          meta={`Suggested for ${slotLabel(trip, s)}`}
          action={
            <Button size="sm" variant="ghost" icon={<Undo2 />} onClick={() => onUndo(s)} aria-label={`Undo: ${s.place.name}`}>
              Undo
            </Button>
          }
        />
      ))}
    </Disclosure>
  );
}

export function AddedList({ trip, items, eventFor, open, onToggle }: { trip: Trip; items: Suggestion[]; eventFor: (s: Suggestion) => TripEvent | undefined; open: boolean; onToggle: () => void }) {
  if (items.length === 0) return null;
  return (
    <Disclosure label="Added to your trip" count={items.length} open={open} onToggle={onToggle}>
      {items.map((s) => {
        const ev = eventFor(s);
        return (
          <Row
            key={s.id}
            s={s}
            meta={ev ? `Added to Day ${dayNumber(trip, ev.date)} at ${formatTime(ev.start)}` : 'Added, then removed from the itinerary'}
            action={
              ev ? (
                <Button size="sm" variant="ghost" to={paths.day(trip.id, ev.date)} iconRight={<ChevronRight />} aria-label={`View day: Day ${dayNumber(trip, ev.date)}`}>
                  View day
                </Button>
              ) : null
            }
          />
        );
      })}
    </Disclosure>
  );
}
