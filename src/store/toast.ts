/**
 * Toast messages ("Event added", "Instagram connected"…).
 * Kept outside the main app state because they're temporary and shouldn't be saved.
 */

import { useSyncExternalStore } from 'react';

export type ToastTone = 'success' | 'info' | 'warning' | 'error';

export interface Toast {
  id: number;
  title: string;
  body?: string;
  tone: ToastTone;
  action?: { label: string; onClick: () => void };
  /** Milliseconds before auto-dismiss (0 = stays until closed). */
  duration: number;
}

let toasts: Toast[] = [];
let nextId = 1;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

export function toast(input: { title: string; body?: string; tone?: ToastTone; action?: Toast['action']; duration?: number }): number {
  const id = nextId++;
  const item: Toast = { id, tone: 'success', duration: 4200, ...input };
  toasts = [...toasts.slice(-3), item];
  emit();
  if (item.duration > 0) window.setTimeout(() => dismissToast(id), item.duration);
  return id;
}

export function dismissToast(id: number): void {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

export function useToasts(): Toast[] {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => toasts,
    () => toasts,
  );
}
