"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  applyDemoUserAction,
  getDemoReadyServerSnapshot,
  getDemoReadySnapshot,
  getDemoServerSnapshot,
  getDemoSnapshot,
  hydrateDemoStore,
  markEstimateReviewedStore,
  markFamilyViewedStore,
  resetDemoStore,
  setAutoPlay,
  setConditionsStore,
  startPrepStore,
  startProcedureStore,
  subscribeDemoStore,
  triggerDemoEvent,
} from "@/lib/demo-store";
import { getNextAutoEvent } from "@/lib/events";
import { REPLY_DELAY_MS } from "@/lib/sample-data";
import type { CostConditions, DemoEventId, DemoState, UserActionId } from "@/lib/types";

interface DemoContextValue {
  state: DemoState;
  ready: boolean;
  markEstimateReviewed: () => void;
  markFamilyViewed: () => void;
  applyAction: (action: UserActionId) => void;
  triggerEvent: (id: DemoEventId) => void;
  startPrep: () => void;
  startProcedure: (fromCurrent?: boolean) => void;
  startAutoPlay: () => void;
  stopAutoPlay: () => void;
  updateConditions: (patch: Partial<CostConditions>) => void;
  resetDemo: () => void;
}

const DemoContext = createContext<DemoContextValue | null>(null);

export function DemoProvider({ children }: { children: ReactNode }) {
  const state = useSyncExternalStore(
    subscribeDemoStore,
    getDemoSnapshot,
    getDemoServerSnapshot,
  );
  const ready = useSyncExternalStore(
    subscribeDemoStore,
    getDemoReadySnapshot,
    getDemoReadyServerSnapshot,
  );

  useEffect(() => {
    hydrateDemoStore();
  }, []);

  useEffect(() => {
    if (state.inquiryStatus === "awaiting_first_reply") {
      const wait = Math.max(0, (state.firstReplyDueAt ?? Date.now()) - Date.now());
      const timer = window.setTimeout(() => triggerDemoEvent("receive_first_reply"), wait);
      return () => window.clearTimeout(timer);
    }

    if (state.inquiryStatus === "awaiting_followup_reply") {
      const wait = Math.max(0, (state.followupReplyDueAt ?? Date.now()) - Date.now());
      const timer = window.setTimeout(() => triggerDemoEvent("receive_followup_reply"), wait);
      return () => window.clearTimeout(timer);
    }

    if (!state.autoPlay) {
      return;
    }

    const next = getNextAutoEvent(state);
    if (next === "wait_user" || next === null) {
      return;
    }

    const wait = Math.max(0, (state.nextAutoAt ?? Date.now()) - Date.now());
    const timer = window.setTimeout(() => {
      triggerDemoEvent(next);
      setAutoPlay(true);
    }, wait);
    return () => window.clearTimeout(timer);
  }, [
    state,
    state.autoPlay,
    state.nextAutoAt,
    state.inquiryStatus,
    state.firstReplyDueAt,
    state.followupReplyDueAt,
  ]);

  const markEstimateReviewed = useCallback(() => {
    markEstimateReviewedStore();
  }, []);

  const markFamilyViewed = useCallback(() => {
    markFamilyViewedStore();
  }, []);

  const applyAction = useCallback((action: UserActionId) => {
    applyDemoUserAction(action);
  }, []);

  const triggerEvent = useCallback((id: DemoEventId) => {
    triggerDemoEvent(id);
  }, []);

  const startPrep = useCallback(() => {
    startPrepStore();
  }, []);

  const startProcedure = useCallback((fromCurrent = false) => {
    startProcedureStore(fromCurrent);
  }, []);

  const startAutoPlay = useCallback(() => {
    setAutoPlay(true);
  }, []);

  const stopAutoPlay = useCallback(() => {
    setAutoPlay(false);
  }, []);

  const updateConditions = useCallback((patch: Partial<CostConditions>) => {
    setConditionsStore(patch);
  }, []);

  const resetDemo = useCallback(() => {
    resetDemoStore();
  }, []);

  const value = useMemo(
    () => ({
      state,
      ready,
      markEstimateReviewed,
      markFamilyViewed,
      applyAction,
      triggerEvent,
      startPrep,
      startProcedure,
      startAutoPlay,
      stopAutoPlay,
      updateConditions,
      resetDemo,
    }),
    [
      state,
      ready,
      markEstimateReviewed,
      markFamilyViewed,
      applyAction,
      triggerEvent,
      startPrep,
      startProcedure,
      startAutoPlay,
      stopAutoPlay,
      updateConditions,
      resetDemo,
    ],
  );

  return <DemoContext.Provider value={value}>{children}</DemoContext.Provider>;
}

export function DemoReady({ children }: { children: ReactNode }) {
  useDemo();
  return children;
}

export function useDemo() {
  const context = useContext(DemoContext);
  if (!context) {
    throw new Error("useDemo must be used within DemoProvider");
  }
  return context;
}

export const AUTO_STEP_MS = REPLY_DELAY_MS;
