import {
  clearDemoState,
  createInitialDemoState,
  loadDemoState,
  saveDemoState,
} from "@/lib/storage";
import type { DemoState } from "@/lib/types";

const listeners = new Set<() => void>();
const serverSnapshot = createInitialDemoState();
let snapshot = serverSnapshot;
let hydrated = false;

function emit() {
  for (const listener of listeners) {
    listener();
  }
}

export function subscribeDemoStore(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getDemoSnapshot() {
  return snapshot;
}

export function getDemoServerSnapshot() {
  return serverSnapshot;
}

export function getDemoReadySnapshot() {
  return hydrated;
}

export function getDemoReadyServerSnapshot() {
  return false;
}

export function hydrateDemoStore() {
  if (hydrated) {
    return;
  }

  const stored = loadDemoState();
  snapshot = stored ?? createInitialDemoState();
  hydrated = true;
  emit();
}

export function updateDemoStore(updater: (current: DemoState) => DemoState) {
  const next = updater(snapshot);
  if (next === snapshot) {
    return;
  }

  snapshot = next;
  saveDemoState(snapshot);
  emit();
}

export function resetDemoStore() {
  clearDemoState();
  snapshot = createInitialDemoState();
  hydrated = true;
  emit();
}
