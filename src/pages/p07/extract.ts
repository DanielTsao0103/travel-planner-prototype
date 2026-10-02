/**
 * The SIMULATED screenshot reader (Page 7, 7E → 7F).
 *
 * Nothing actually reads the image. For the sample confirmation we "find"
 * what's printed on it; for a tester's own image we pretend to read part of
 * it (date, start time, booking code) and leave the rest for them to fill in.
 * The UI labels the whole flow "Simulated".
 */

import type { ISODate, Trip } from '../../data/types';
import { dayNumber, formatShortDate } from '../../lib/dates';
import { plural } from '../../lib/format';
import { blankDraft, formatAmount, type EventDraft, type FieldSources } from './draft';
import { sampleTicketFor } from './SampleConfirmation';

export interface Extraction {
  /** The form, prefilled with whatever was "found". */
  draft: EventDraft;
  /** Which fields came from the screenshot and which still need input. */
  sources: FieldSources;
  /** Shown under "Who's coming", e.g. "The confirmation lists 5 adult tickets." */
  attendeeHint: string | null;
  /** Shown under "Day" when the screenshot's date isn't one this person can edit. */
  dateNote: string | null;
  /** True for a tester's own image (we can't really read it). */
  fromUpload: boolean;
}

/** Read the sample confirmation: everything except the end time and who's going. */
export function extractFromSample(trip: Trip, editableDays: ISODate[], memberCount: number): Extraction {
  const t = sampleTicketFor(trip, memberCount);
  const usable = editableDays.includes(t.date);
  const draft: EventDraft = {
    ...blankDraft([]),
    place: t.place,
    date: usable ? t.date : '',
    start: t.start,
    costAmount: formatAmount(t.pricePer),
    costPer: 'person',
    confirmation: t.ref,
  };
  return {
    draft,
    sources: { place: 'found', date: usable ? 'found' : 'needs', start: 'found', end: 'needs', cost: 'found', attendees: 'needs', confirmation: 'found' },
    attendeeHint: `The confirmation lists ${plural(t.tickets, 'adult ticket')}.`,
    dateNote: usable ? null : `The screenshot says ${formatShortDate(t.date)} (Day ${dayNumber(trip, t.date)}), which isn’t one of your days. Pick a day you can edit.`,
    fromUpload: false,
  };
}

/**
 * "Read" a tester's own image: Day 1 (or their first editable day) at 7:00 PM
 * and a booking code. The place, end time, and people are left for them.
 */
export function extractFromUpload(trip: Trip, editableDays: ISODate[], file: { name: string; size: number }): Extraction {
  const date = editableDays.includes(trip.startDate) ? trip.startDate : (editableDays[0] ?? '');
  // A stable, made-up booking code based on the file (so re-reading gives the same one).
  const code = `RES-${((file.size + file.name.length * 7919) % 90000) + 10000}`;
  const draft: EventDraft = { ...blankDraft([]), date, start: '19:00', confirmation: code };
  return {
    draft,
    sources: { place: 'needs', date: date ? 'found' : 'needs', start: 'found', end: 'needs', attendees: 'needs', confirmation: 'found' },
    attendeeHint: null,
    dateNote: null,
    fromUpload: true,
  };
}
