/**
 * Illustrative "how busy is it usually" curves (Page 7).
 *
 * Real crowd data (like Google's "Popular times") isn't available from an
 * official API, so the prototype draws a plausible curve from the kind of
 * place + day of week. The UI always labels this as an estimate.
 */

import type { BusyProfile, ISODate, Time } from '../data/types';
import { parseISODate, timeToMin } from './dates';

/** 24 hourly values (0–100) for a typical weekday, by kind of place. */
const PROFILES: Record<BusyProfile, number[]> = {
  //          0  1  2  3  4  5  6   7   8   9  10  11  12  13  14  15  16  17  18  19  20  21  22  23
  landmark: [0, 0, 0, 0, 0, 0, 0, 0, 10, 35, 62, 80, 86, 84, 88, 90, 78, 55, 30, 12, 0, 0, 0, 0],
  museum: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 38, 58, 66, 70, 82, 80, 64, 40, 12, 0, 0, 0, 0, 0],
  market: [0, 0, 0, 0, 0, 0, 0, 0, 0, 18, 30, 52, 88, 96, 70, 48, 44, 58, 72, 80, 70, 52, 30, 10],
  restaurant: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 14, 52, 70, 46, 18, 12, 18, 40, 72, 92, 84, 50, 18],
  cafe: [0, 0, 0, 0, 0, 0, 0, 22, 54, 72, 76, 70, 62, 50, 44, 48, 50, 36, 18, 6, 0, 0, 0, 0],
  viewpoint: [0, 0, 0, 0, 0, 0, 0, 6, 12, 20, 30, 38, 44, 46, 50, 56, 66, 82, 94, 70, 40, 22, 10, 4],
  transit: [8, 2, 0, 0, 0, 4, 22, 70, 92, 66, 44, 40, 46, 44, 42, 50, 70, 90, 74, 44, 30, 22, 16, 10],
  bar: [40, 22, 8, 0, 0, 0, 0, 0, 0, 0, 0, 0, 10, 14, 14, 16, 22, 34, 48, 62, 76, 88, 92, 70],
  nature: [0, 0, 0, 0, 0, 0, 4, 14, 30, 48, 66, 78, 82, 80, 76, 66, 48, 28, 12, 4, 0, 0, 0, 0],
  lodging: [10, 4, 2, 2, 2, 4, 10, 24, 30, 22, 18, 16, 18, 22, 34, 46, 44, 36, 30, 28, 24, 20, 16, 12],
};

/** Weekends are busier at attractions and markets. */
function dayMultiplier(profile: BusyProfile, iso: ISODate): number {
  const dow = parseISODate(iso).getDay(); // 0 = Sun
  const weekend = dow === 0 || dow === 6;
  if (profile === 'transit') return weekend ? 0.75 : 1;
  if (profile === 'bar' || profile === 'restaurant') return dow === 5 || dow === 6 ? 1.12 : 0.95;
  return weekend ? 1.15 : 0.92;
}

/** Hourly busyness (0–100) for this kind of place on this date. */
export function busyCurve(profile: BusyProfile, iso: ISODate): number[] {
  const mult = dayMultiplier(profile, iso);
  return PROFILES[profile].map((v) => Math.min(100, Math.round(v * mult)));
}

export interface BusyEstimate {
  /** 0–100 at the selected time. */
  level: number;
  label: 'Closed or very quiet' | 'Not too busy' | 'A little busy' | 'Usually busy' | 'As busy as it gets';
  /** Short tip, e.g. "Usually calmer before 10 AM". */
  tip: string | null;
  curve: number[];
  hour: number;
}

/** Estimate for a specific date + time, with a plain-language label and a tip. */
export function estimateBusy(profile: BusyProfile, iso: ISODate, time: Time): BusyEstimate {
  const curve = busyCurve(profile, iso);
  const hour = Math.floor(timeToMin(time) / 60);
  const level = curve[hour] ?? 0;
  const label: BusyEstimate['label'] =
    level < 8 ? 'Closed or very quiet' : level < 35 ? 'Not too busy' : level < 60 ? 'A little busy' : level < 85 ? 'Usually busy' : 'As busy as it gets';

  // Suggest the quietest open hour (level > 8) within ±3 hours if it's notably calmer.
  let tip: string | null = null;
  if (level >= 60) {
    let best = hour;
    for (let h = Math.max(0, hour - 3); h <= Math.min(23, hour + 3); h++) {
      if (curve[h] > 8 && curve[h] < curve[best]) best = h;
    }
    if (best !== hour && curve[best] <= level - 20) {
      const h12 = best % 12 === 0 ? 12 : best % 12;
      tip = `Usually calmer around ${h12} ${best >= 12 ? 'PM' : 'AM'}.`;
    }
  }
  return { level, label, tip, curve, hour };
}
