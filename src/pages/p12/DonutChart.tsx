/**
 * Page 12 — a dependency-free SVG pie (drawn as a thick donut so the total can
 * sit in the middle, like Ramp's spend charts).
 *
 * Slices are drawn to scale: each one's angle is value / total × 360°.
 * Hovering a slice (or its legend row, via `activeKey`) lifts it slightly and
 * dims the others; the parent decides what the center text says.
 */

import { useId, type ReactNode } from 'react';

export interface DonutSlice {
  key: string;
  label: string;
  value: number;
  /** Any CSS color, usually a token like var(--cat-food). */
  color: string;
  /** Extra text for the slice's hover tooltip ("$2,680.00 · 76% of spent"). */
  detail?: string;
}

/** Point on a circle. Angles are degrees clockwise from 12 o'clock. */
function polar(cx: number, cy: number, radius: number, deg: number): [number, number] {
  const rad = ((deg - 90) * Math.PI) / 180;
  return [cx + radius * Math.cos(rad), cy + radius * Math.sin(rad)];
}

/** SVG path for a ring segment (a "donut slice") between two angles. */
function ringSegment(cx: number, cy: number, outer: number, inner: number, a0: number, a1: number): string {
  const large = a1 - a0 > 180 ? 1 : 0;
  const [x0, y0] = polar(cx, cy, outer, a0);
  const [x1, y1] = polar(cx, cy, outer, a1);
  const [x2, y2] = polar(cx, cy, inner, a1);
  const [x3, y3] = polar(cx, cy, inner, a0);
  const f = (n: number) => n.toFixed(3);
  return `M${f(x0)} ${f(y0)} A${outer} ${outer} 0 ${large} 1 ${f(x1)} ${f(y1)} L${f(x2)} ${f(y2)} A${inner} ${inner} 0 ${large} 0 ${f(x3)} ${f(y3)} Z`;
}

/** How far (px) a hovered slice grows outward. */
const LIFT = 4;

/** Pie/donut chart drawn to scale from `slices`; `center` is rendered in the hole. */
export function DonutChart({
  slices,
  size = 200,
  thickness = 34,
  activeKey,
  onActiveChange,
  onSliceClick,
  ariaLabel,
  center,
}: {
  slices: DonutSlice[];
  size?: number;
  /** Ring width in px. */
  thickness?: number;
  /** Slice to emphasize (hovered here or in the legend). */
  activeKey?: string | null;
  onActiveChange?: (key: string | null) => void;
  onSliceClick?: (key: string) => void;
  /** Full text alternative, e.g. "Lodging $2,680 (76%), Food $432 (12%)…". */
  ariaLabel: string;
  /** HTML shown in the hole (total, or the hovered slice). */
  center?: ReactNode;
}) {
  const titleId = useId();
  const visible = slices.filter((s) => s.value > 0);
  const total = visible.reduce((acc, s) => acc + s.value, 0);
  const cx = size / 2;
  const cy = size / 2;
  // Resting slices stop LIFT px short of the edge so a hovered one can grow without clipping.
  const outer = size / 2 - 1 - LIFT;
  const inner = Math.max(outer - thickness, 0);
  const mid = (outer + inner) / 2;

  // Running angle so each slice starts where the previous one ended.
  let cursor = 0;
  const arcs = visible.map((s) => {
    const sweep = total > 0 ? (s.value / total) * 360 : 0;
    const a0 = cursor;
    cursor += sweep;
    return { ...s, a0, a1: cursor, sweep };
  });

  return (
    <div className="p12-donut" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-labelledby={titleId} onMouseLeave={() => onActiveChange?.(null)}>
        <title id={titleId}>{ariaLabel}</title>
        {/* Empty track so the ring still reads as a chart when there's no data at all. */}
        {arcs.length === 0 && <circle cx={cx} cy={cy} r={mid} fill="none" style={{ stroke: 'var(--surface-2)' }} strokeWidth={thickness} />}
        {arcs.map((a) => {
          const isActive = activeKey === a.key;
          const dimmed = !!activeKey && !isActive;
          const common = {
            className: `p12-donut-slice${dimmed ? ' is-dimmed' : ''}${onSliceClick ? ' is-clickable' : ''}`,
            onMouseEnter: () => onActiveChange?.(a.key),
            onClick: onSliceClick ? () => onSliceClick(a.key) : undefined,
          };
          const tip = `${a.label}${a.detail ? ` · ${a.detail}` : ''}`;
          // One slice covering the whole ring can't be an arc (start = end), so draw a circle.
          // Stroke width goes in `style`: CSS (.p12-donut-slice) would otherwise override the SVG attribute.
          if (a.sweep >= 359.99) {
            return (
              <circle key={a.key} {...common} cx={cx} cy={cy} r={mid + (isActive ? LIFT / 2 : 0)} fill="none" style={{ stroke: a.color, strokeWidth: thickness + (isActive ? LIFT : 0) }}>
                <title>{tip}</title>
              </circle>
            );
          }
          return (
            <path key={a.key} {...common} d={ringSegment(cx, cy, outer + (isActive ? LIFT : 0), inner, a.a0, a.a1)} style={{ fill: a.color }}>
              <title>{tip}</title>
            </path>
          );
        })}
      </svg>
      {center && (
        <div className="p12-donut-center" style={{ width: Math.max(inner * 2 - 18, 60) }} aria-hidden>
          {center}
        </div>
      )}
    </div>
  );
}
