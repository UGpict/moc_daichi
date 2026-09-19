import {
  applyDemoEvent,
  applyUserAction,
  canApplyEvent,
  canApplyUserAction,
} from "@/lib/events";
import {
  beginProcedureFromPrep,
  createPrepStartState,
  createProcedureStartState,
} from "@/lib/procedure";
import { REPLY_DELAY_MS } from "@/lib/sample-data";
import {
  clearDemoState,
  createInitialDemoState,
  loadDemoState,
  saveDemoState,
} from "@/lib/storage";
import type { CostConditions, DemoEventId, DemoState, UserActionId } from "@/lib/types";

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

function commit(next: DemoState) {
  snapshot = next;
  saveDemoState(snapshot);
  emit();
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
  commit(next);
}

export function resetDemoStore() {
  clearDemoState();
  snapshot = createInitialDemoState();
  hydrated = true;
  emit();
}

export function startPrepStore() {
  commit({ ...createPrepStartState(), autoPlay: false, nextAutoAt: null });
}

export function startProcedureStore(fromCurrent = false) {
  const next = fromCurrent
    ? beginProcedureFromPrep(snapshot)
    : createProcedureStartState();
  commit({ ...next, autoPlay: false, nextAutoAt: null });
}

export function triggerDemoEvent(id: DemoEventId) {
  if (!canApplyEvent(snapshot, id)) {
    return;
  }
  commit(applyDemoEvent(snapshot, id));
}

export function applyDemoUserAction(action: UserActionId) {
  if (!canApplyUserAction(snapshot, action)) {
    return;
  }
  commit(applyUserAction(snapshot, action));
}

export function setAutoPlay(running: boolean) {
  const nextAutoAt = running ? Date.now() + REPLY_DELAY_MS : null;
  if (snapshot.autoPlay === running && snapshot.nextAutoAt === nextAutoAt) {
    return;
  }
  if (!running && !snapshot.autoPlay && snapshot.nextAutoAt === null) {
    return;
  }
  commit({
    ...snapshot,
    autoPlay: running,
    nextAutoAt,
  });
}

export function setConditionsStore(patch: Partial<CostConditions>) {
  commit({
    ...snapshot,
    conditions: { ...snapshot.conditions, ...patch },
  });
}

export function markEstimateReviewedStore() {
  if (snapshot.hasReviewedEstimate) {
    return;
  }
  commit({ ...snapshot, hasReviewedEstimate: true });
}

export function markFamilyViewedStore() {
  if (snapshot.hasViewedFamily) {
    return;
  }
  commit({ ...snapshot, hasViewedFamily: true });
}
