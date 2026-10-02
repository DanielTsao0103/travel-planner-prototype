/**
 * Scrolling behavior for the itinerary (Page 8):
 *  - useDayScroll: "scroll spy" (which day is on screen) + smooth jump to a day
 *  - useEventHighlight: scroll a just-added / focused event into view and
 *    highlight it for a few seconds
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ISODate } from '../../data/types';
import { clearHighlights } from '../../store/actions';
import { dayAnchorId, eventAnchorId } from './itinerary';

/** True when the person asked their device for less motion (we jump instead of gliding). */
export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Height of everything pinned to the top of the window: the app header, the
 * trip tabs (tablet/desktop), and our own sticky day chips (phones/tablets).
 * Measured live so it stays right if the header ever changes size.
 */
function pinnedHeight(bar: HTMLElement | null): number {
  const header = document.querySelector<HTMLElement>('.app-header');
  const tabs = document.querySelector<HTMLElement>('.trip-tabs');
  return (header?.offsetHeight ?? 64) + (tabs?.offsetHeight ?? 0) + (bar?.offsetHeight ?? 0);
}

/**
 * Tracks which day section is at the top of the screen and scrolls to a day
 * on request. `barRef` goes on the sticky chip bar so its height is accounted for.
 */
export function useDayScroll(dates: ISODate[], initial?: ISODate) {
  const [active, setActive] = useState<ISODate | undefined>(initial ?? dates[0]);
  const barRef = useRef<HTMLElement | null>(null);
  // While we glide to a day, ignore scroll events so the chips don't flicker
  // through every day we pass.
  const lockUntil = useRef(0);
  const key = dates.join('|');

  useEffect(() => {
    let frame = 0;
    const measure = () => {
      frame = 0;
      if (Date.now() < lockUntil.current) return;
      const limit = pinnedHeight(barRef.current) + 32;
      let current = dates[0];
      for (const d of dates) {
        const el = document.getElementById(dayAnchorId(d));
        if (el && el.getBoundingClientRect().top <= limit) current = d;
      }
      // At the very bottom the last day wins, even if it's too short to reach the top.
      const doc = document.documentElement;
      if (window.scrollY > 0 && window.innerHeight + window.scrollY >= doc.scrollHeight - 4) current = dates[dates.length - 1];
      setActive(current);
    };
    // requestAnimationFrame batches scroll events: at most one measurement per frame.
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(measure);
    };
    // Scroll only (not resize): until you scroll, the chips keep showing today / Day 1.
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
    // `key` stands in for `dates` (a new array every render).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  /** Glide to a day and move keyboard focus to its heading. */
  const scrollToDay = useCallback((date: ISODate) => {
    const el = document.getElementById(dayAnchorId(date));
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY - pinnedHeight(barRef.current) - 12;
    lockUntil.current = Date.now() + 900;
    setActive(date);
    window.scrollTo({ top: Math.max(0, top), behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
    // preventScroll: focusing would otherwise jump the page before the glide finishes.
    el.querySelector<HTMLElement>('[data-day-heading]')?.focus({ preventScroll: true });
  }, []);

  return { active, scrollToDay, barRef };
}

/**
 * Highlights one event for ~4 seconds and scrolls it into view.
 * `targetId` comes from `?focus=<id>`, `?s=highlight`, or the store's
 * "just added" marker; when the highlight ends we clear that marker so it
 * doesn't flash again on the next visit.
 */
export function useEventHighlight(targetId: string | null, validIds: string[]): string | null {
  const [shown, setShown] = useState<string | null>(null);
  const isValid = !!targetId && validIds.includes(targetId);
  // Counts highlight runs so an older timer never ends a newer highlight early.
  const runRef = useRef(0);

  useEffect(() => {
    if (!targetId || !isValid) return;
    const run = ++runRef.current;
    setShown(targetId);
    // Wait a beat: the app scrolls to the top on every page change, and that runs after us.
    const scrollTimer = window.setTimeout(() => {
      document.getElementById(eventAnchorId(targetId))?.scrollIntoView({ block: 'center', behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
    }, 250);
    // Not cancelled on cleanup on purpose: even if the marker is cleared elsewhere,
    // the highlight should still fade out after its 4 seconds.
    window.setTimeout(() => {
      if (runRef.current !== run) return;
      setShown(null);
      clearHighlights();
    }, 4000);
    return () => window.clearTimeout(scrollTimer);
  }, [targetId, isValid]);

  return shown;
}

/** True once the page has scrolled more than `threshold` px (the floating button shrinks then). */
export function useScrolledPast(threshold: number): boolean {
  const [past, setPast] = useState(() => typeof window !== 'undefined' && window.scrollY > threshold);
  useEffect(() => {
    // Setting the same boolean again doesn't re-render, so this stays cheap.
    const onScroll = () => setPast(window.scrollY > threshold);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [threshold]);
  return past;
}
