/**
 * A sample booking confirmation, drawn with HTML so it looks like a phone
 * screenshot of a ticket email (Page 7, "Use a sample confirmation").
 *
 * The vendor ("TicketLine") is FICTIONAL; the museum is real. Its date is
 * computed from the trip, so the sample always lands on the trip's Day 4
 * (Lisbon sample trip) or Day 2 (any other trip).
 */

import { ChevronLeft } from 'lucide-react';
import type { ISODate, Place, Time, Trip } from '../../data/types';
import { getPlace } from '../../data/places';
import { addDays, daysBetween, formatLongDate, formatTime, weekdayLong } from '../../lib/dates';
import { money } from '../../lib/format';
import { customPlace } from '../../services/places';

export interface SampleTicket {
  vendor: string;
  vendorEmail: string;
  subject: string;
  eventName: string;
  address: string;
  date: ISODate;
  start: Time;
  tickets: number;
  pricePer: number;
  ref: string;
  /** What the "reader" will fill in as the place. */
  place: Place;
}

/** Small, stable number from a string (so the same trip always gets the same booking code). */
function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Build the sample ticket for this trip. `ticketCount` = how many people are on the trip. */
export function sampleTicketFor(trip: Trip, ticketCount: number): SampleTicket {
  const lastIndex = daysBetween(trip.startDate, trip.endDate);
  const tickets = Math.max(1, ticketCount);
  if (trip.isSample) {
    return {
      vendor: 'TicketLine Portugal',
      vendorEmail: 'tickets@ticketline.example',
      subject: 'Your tickets: National Tile Museum',
      eventName: 'National Tile Museum',
      address: 'Rua da Madre de Deus 4, Lisbon',
      date: addDays(trip.startDate, Math.min(3, lastIndex)), // Day 4
      start: '14:30',
      tickets,
      pricePer: 8,
      ref: 'MNAZ-22871',
      place: getPlace('azulejo-museum'),
    };
  }
  // Any other trip: a guided walk in its first destination, on Day 2.
  const dest = trip.destinations.find((d) => !(d.lat === 0 && d.lng === 0)) ?? trip.destinations[0];
  const city = dest?.name ?? 'the city';
  const eventName = `${city} Highlights Walking Tour`;
  const place: Place = {
    ...customPlace(eventName, dest, city),
    id: `sample-tour-${trip.id}`,
    area: 'Meets in the city center',
    category: 'tour',
    busyProfile: 'landmark',
    blurb: 'A 2-hour guided walk (fictional tour company).',
    fictional: true,
  };
  return {
    vendor: 'TicketLine',
    vendorEmail: 'tickets@ticketline.example',
    subject: `Your booking: ${eventName}`,
    eventName,
    address: `Meeting point: ${city} city center`,
    date: addDays(trip.startDate, Math.min(1, lastIndex)), // Day 2 (Day 1 on a one-day trip)
    start: '10:00',
    tickets,
    pricePer: 25,
    ref: `TL-${(hashString(trip.id) % 90000) + 10000}`,
    place,
  };
}

/** A QR-like square pattern, generated from the booking code (decoration only). */
function CodePattern({ seed }: { seed: string }) {
  const size = 11;
  let h = hashString(seed);
  const cells: boolean[] = [];
  for (let i = 0; i < size * size; i++) {
    // xorshift: a cheap pseudo-random sequence from the seed
    h ^= h << 13;
    h ^= h >>> 17;
    h ^= h << 5;
    cells.push((h >>> 0) % 3 !== 0);
  }
  // Three "finder" corners, like a real QR code.
  const corner = (r: number, c: number) => {
    const inBox = (r0: number, c0: number) => r >= r0 && r < r0 + 3 && c >= c0 && c < c0 + 3;
    return inBox(0, 0) || inBox(0, size - 3) || inBox(size - 3, 0);
  };
  return (
    <span className="p07-sample-code" aria-hidden>
      {cells.map((on, i) => {
        const r = Math.floor(i / size);
        const c = i % size;
        return <i key={i} className={corner(r, c) || on ? 'on' : ''} />;
      })}
    </span>
  );
}

/** The fake "screenshot": an email from the fictional vendor, inside a phone screen. */
export function SampleConfirmation({ ticket }: { ticket: SampleTicket }) {
  const total = ticket.pricePer * ticket.tickets;
  const longDate = `${weekdayLong(ticket.date)}, ${formatLongDate(ticket.date)}`;
  return (
    <div
      className="p07-sample"
      role="img"
      aria-label={`Sample booking confirmation from ${ticket.vendor} (a fictional vendor): ${ticket.eventName}, ${longDate} at ${formatTime(ticket.start)}, ${ticket.tickets} adult tickets at ${money(ticket.pricePer)} per person, booking reference ${ticket.ref}.`}
    >
      <div className="p07-sample-status">
        <span>9:41</span>
        <span className="p07-sample-signal">
          <i />
          <i />
          <i />
        </span>
      </div>
      <div className="p07-sample-nav">
        <ChevronLeft aria-hidden /> Inbox
      </div>
      <div className="p07-sample-mail">
        <p className="p07-sample-subject">{ticket.subject}</p>
        <div className="p07-sample-from">
          <span className="p07-sample-logo">TL</span>
          <span className="p07-sample-from-text">
            <b>{ticket.vendor}</b>
            <small>{ticket.vendorEmail}</small>
          </span>
        </div>
        <div className="p07-sample-card">
          <p className="p07-sample-kicker">Booking confirmed</p>
          <p className="p07-sample-event">{ticket.eventName}</p>
          <p className="p07-sample-addr">{ticket.address}</p>
          <dl className="p07-sample-grid">
            <div>
              <dt>Date</dt>
              <dd>{longDate}</dd>
            </div>
            <div>
              <dt>Time</dt>
              <dd>{formatTime(ticket.start)}</dd>
            </div>
            <div>
              <dt>Tickets</dt>
              <dd>{ticket.tickets} × Adult</dd>
            </div>
            <div>
              <dt>Price</dt>
              <dd>{money(ticket.pricePer)} per person</dd>
            </div>
            <div className="is-total">
              <dt>Total paid</dt>
              <dd>{money(total)}</dd>
            </div>
          </dl>
          <div className="p07-sample-ref">
            <span>Booking ref</span>
            <b>{ticket.ref}</b>
          </div>
          <CodePattern seed={ticket.ref} />
        </div>
        <p className="p07-sample-foot">Show this email at the entrance. Reply to change your booking.</p>
      </div>
    </div>
  );
}
