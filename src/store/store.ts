/**
 * The app's single source of truth.
 *
 * A tiny "external store": the state lives in a module variable, components
 * subscribe with React's `useSyncExternalStore`, and every change goes through
 * `update(recipe)`, which clones the state, lets the recipe mutate the copy,
 * then swaps it in. Because every page reads from this one object, a change on
 * one page (e.g. adding an event) is instantly reflected on all the others.
 *
 * The state is saved to localStorage so a tester's trip survives a reload.
 * localStorage can be unavailable (private mode, blocked storage), so every
 * access is wrapped in try/catch and the app still works without it.
 */

import { useSyncExternalStore } from 'react';
import { createInitialState, STATE_VERSION } from '../data/seed';
import type { AppState } from '../data/types';

const STORAGE_KEY = `wayfare-prototype-state-v${STATE_VERSION}`;

function loadState(): AppState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as AppState;
      if (parsed && parsed.version === STATE_VERSION) return parsed;
    }
  } catch {
    // Storage blocked or corrupted — fall through to fresh seed data.
  }
  return createInitialState();
}

let state: AppState = loadState();
const listeners = new Set<() => void>();
let persistTimer: number | undefined;

function persist(): void {
  window.clearTimeout(persistTimer);
  persistTimer = window.setTimeout(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Quota exceeded or storage blocked: the prototype keeps working in memory.
    }
  }, 120);
}

function emit(): void {
  listeners.forEach((listener) => listener());
}

/** Read the current state outside React (e.g. inside an action). */
export function getState(): AppState {
  return state;
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Change the state. The recipe receives a deep copy it may mutate freely:
 *   update((draft) => { draft.events.push(newEvent); });
 */
export function update(recipe: (draft: AppState) => void): void {
  const draft = structuredClone(state);
  recipe(draft);
  state = draft;
  emit();
  persist();
}

/** Throw away all changes and start from fresh seed data (Prototype drawer → Reset). */
export function resetState(): void {
  state = createInitialState();
  emit();
  persist();
}

/** React hook: re-renders the component whenever the state changes. */
export function useAppState(): AppState {
  return useSyncExternalStore(subscribe, getState, getState);
}
