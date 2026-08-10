/**
 * A tiny fan-out bus so every connected browser sees the machine tick in real
 * time. Held on globalThis so Next's dev HMR doesn't orphan subscribers.
 */

type Listener = (event: string, data: unknown) => void;

const g = globalThis as unknown as { __adsBus?: Set<Listener> };
const listeners: Set<Listener> = (g.__adsBus ??= new Set());

export function subscribe(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function emit(event: string, data: unknown) {
  for (const fn of listeners) {
    try {
      fn(event, data);
    } catch {
      // A broken client must not stall the loop.
    }
  }
}

let dirty = false;
let flushTimer: NodeJS.Timeout | null = null;

/**
 * Coalesce state pushes. The machine mutates state many times per phase; the
 * UI only needs the latest snapshot a few times a second.
 */
export function pushState(getSnapshot: () => unknown, immediate = false) {
  if (immediate) {
    if (flushTimer) {
      clearTimeout(flushTimer);
      flushTimer = null;
    }
    dirty = false;
    emit("state", getSnapshot());
    return;
  }
  dirty = true;
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    if (!dirty) return;
    dirty = false;
    emit("state", getSnapshot());
  }, 120);
}
