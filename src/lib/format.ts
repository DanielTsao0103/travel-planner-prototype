/** Formatting helpers for money, distances, names, and lists. */

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const usdWhole = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

/** 1234.5 -> '$1,234.50' (always two decimals, as in "Name 1 owes Name 2 $000.00"). */
export function money(amount: number): string {
  return usd.format(round2(amount));
}

/** 1234.5 -> '$1,235' (for big summary figures and estimates). */
export function moneyWhole(amount: number): string {
  return usdWhole.format(amount);
}

/** Round to cents without floating-point drift (0.1 + 0.2 problems). */
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * Split an amount into `n` shares that add back up exactly to the total
 * (the first shares absorb any leftover cents).
 */
export function splitEvenly(total: number, n: number): number[] {
  if (n <= 0) return [];
  const cents = Math.round(total * 100);
  const base = Math.floor(cents / n);
  const remainder = cents - base * n;
  return Array.from({ length: n }, (_, i) => (base + (i < remainder ? 1 : 0)) / 100);
}

const FEET_PER_METER = 3.28084;

/** Distance for US readers: '450 ft' under ~0.1 mi, otherwise '0.7 mi'. */
export function distanceLabel(meters: number): string {
  const feet = meters * FEET_PER_METER;
  if (feet < 1000) return `${Math.round(feet / 10) * 10} ft`;
  const miles = meters / 1609.344;
  return `${miles < 10 ? miles.toFixed(1) : Math.round(miles)} mi`;
}

export function metersToFeet(meters: number): number {
  return meters * FEET_PER_METER;
}

/** 'Maya Chen' -> 'MC' */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** 'Maya Chen' -> 'Maya' */
export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
}

/** ['A', 'B', 'C'] -> 'A, B, and C' */
export function listJoin(items: string[]): string {
  if (items.length <= 1) return items.join('');
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;
}

/** 1 -> '1 event', 2 -> '2 events' */
export function plural(n: number, singular: string, pluralForm = `${singular}s`): string {
  return `${n} ${n === 1 ? singular : pluralForm}`;
}

/** Basic email shape check for form validation. */
export function looksLikeEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim());
}
