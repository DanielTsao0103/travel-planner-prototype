/**
 * A tiny hash router.
 *
 * URLs look like  https://…/travel-planner-prototype/#/trip/abc/day/2026-10-16?s=empty
 * Using the hash (#) means GitHub Pages always serves the same index.html,
 * so deep links and page reloads work without any server configuration.
 */

import { useSyncExternalStore, type AnchorHTMLAttributes, type MouseEvent, type ReactNode } from 'react';

export interface RouteLocation {
  /** Path without the query, e.g. '/trip/abc/day/2026-10-16'. */
  path: string;
  segments: string[];
  query: URLSearchParams;
  /** Full hash string without the leading '#'. */
  full: string;
}

function readHash(): string {
  const raw = window.location.hash.replace(/^#/, '');
  return raw.startsWith('/') ? raw : '/' + raw;
}

let cachedFull = '';
let cached: RouteLocation = parse('/');

function parse(full: string): RouteLocation {
  const [path, qs = ''] = full.split('?');
  const cleanPath = path.replace(/\/+$/, '') || '/';
  return { path: cleanPath, segments: cleanPath.split('/').filter(Boolean), query: new URLSearchParams(qs), full };
}

function getLocation(): RouteLocation {
  const full = readHash();
  if (full !== cachedFull) {
    cachedFull = full;
    cached = parse(full);
  }
  return cached;
}

function subscribe(listener: () => void): () => void {
  window.addEventListener('hashchange', listener);
  return () => window.removeEventListener('hashchange', listener);
}

/** React hook: the current route; re-renders on every navigation. */
export function useRoute(): RouteLocation {
  return useSyncExternalStore(subscribe, getLocation, getLocation);
}

/** Go to an in-app path like '/trip/abc'. `replace` avoids adding a history entry. */
export function navigate(to: string, options: { replace?: boolean } = {}): void {
  const target = '#' + (to.startsWith('/') ? to : '/' + to);
  if (target === window.location.hash) return;
  if (options.replace) {
    window.history.replaceState(null, '', target);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  } else {
    window.location.hash = target;
  }
}

/**
 * "Back" buttons go to an explicit parent page (e.g. Day detail → Trip dashboard)
 * rather than browser history, so they behave the same after a reload or deep link.
 */
export function goBack(parentPath: string): void {
  navigate(parentPath);
}

/** Build a path with query params, skipping empty values. */
export function withQuery(path: string, params: Record<string, string | number | undefined | null | false>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== false && v !== '') q.set(k, String(v));
  }
  const qs = q.toString();
  return qs ? `${path}?${qs}` : path;
}

type LinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & { to: string; replace?: boolean; children: ReactNode };

/** An in-app link (a real <a href>, so it's keyboard- and screen-reader-friendly). */
export function Link({ to, replace, onClick, children, ...rest }: LinkProps) {
  const href = '#' + (to.startsWith('/') ? to : '/' + to);
  const handle = (e: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(e);
    if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    if (replace) {
      e.preventDefault();
      navigate(to, { replace: true });
    }
  };
  return (
    <a href={href} onClick={handle} {...rest}>
      {children}
    </a>
  );
}
