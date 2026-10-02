/**
 * Loading placeholders for the itinerary (state 8F, `?s=loading`).
 * They mirror the real layout (day heading, event rows, rail cards, chips)
 * so nothing jumps around when the data arrives.
 */

import { Loading, Skeleton } from '../../components/ui/Display';

/** Three day groups with a few event rows each. */
export function DayListSkeleton() {
  const rowsPerDay = [3, 2, 3];
  return (
    <Loading label="Loading the itinerary">
      <div className="p08-days">
        {rowsPerDay.map((rows, d) => (
          <div key={d} className="p08-day">
            <div className="p08-day-head">
              <div className="stack-sm">
                <Skeleton width={170} height={26} radius={8} />
                <Skeleton width={130} height={14} radius={6} />
              </div>
            </div>
            <div className="p08-events">
              {Array.from({ length: rows }, (_, i) => (
                <div key={i} className="p08-skel-row">
                  <Skeleton width={64} height={64} radius={10} />
                  <div className="stack-sm grow">
                    <Skeleton width="58%" height={16} radius={6} />
                    <Skeleton width="36%" height={13} radius={6} />
                  </div>
                  <Skeleton width={72} height={16} radius={6} />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Loading>
  );
}

/** Desktop rail placeholders. */
export function RailSkeleton() {
  return (
    <aside className="p08-rail" aria-hidden>
      {[260, 170, 130].map((h, i) => (
        <div key={i} className="p08-card">
          <Skeleton width={110} height={18} radius={6} />
          <Skeleton height={h - 60} radius={10} />
        </div>
      ))}
    </aside>
  );
}

/** Phone day chips placeholder. */
export function ChipsSkeleton() {
  return (
    <div className="p08-chips" aria-hidden>
      <div className="p08-chips-track">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} width={64} height={48} radius={12} className="p08-skel-chip" />
        ))}
      </div>
    </div>
  );
}
