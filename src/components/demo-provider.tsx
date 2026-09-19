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
  getDemoReadyServerSnapshot,
  getDemoReadySnapshot,
  getDemoServerSnapshot,
  getDemoSnapshot,
  hydrateDemoStore,
  resetDemoStore,
  subscribeDemoStore,
  updateDemoStore,
} from "@/lib/demo-store";
import { applyInquiryAction, canApplyInquiryAction } from "@/lib/inquiry";
import { REPLY_DELAY_MS } from "@/lib/sample-data";
import type { CostConditions, DemoState } from "@/lib/types";

interface DemoContextValue {
  state: DemoState;
  ready: boolean;
  markEstimateReviewed: () => void;
  markFamilyViewed: () => void;
  approveInquiry: () => void;
  approveFollowup: () => void;
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
    if (!ready) {
      return;
    }

    if (state.inquiryStatus === "awaiting_first_reply") {
      const wait = Math.max(0, (state.firstReplyDueAt ?? 0) - Date.now());
      const timer = window.setTimeout(() => {
        updateDemoStore((current) => {
          if (!canApplyInquiryAction(current.inquiryStatus, "receive_first")) {
            return current;
          }
          return {
            ...current,
            inquiryStatus: applyInquiryAction(current.inquiryStatus, "receive_first"),
          };
        });
      }, wait);
      return () => window.clearTimeout(timer);
    }

    if (state.inquiryStatus === "awaiting_followup_reply") {
      const wait = Math.max(0, (state.followupReplyDueAt ?? 0) - Date.now());
      const timer = window.setTimeout(() => {
        updateDemoStore((current) => {
          if (!canApplyInquiryAction(current.inquiryStatus, "receive_followup")) {
            return current;
          }
          return {
            ...current,
            inquiryStatus: applyInquiryAction(
              current.inquiryStatus,
              "receive_followup",
            ),
          };
        });
      }, wait);
      return () => window.clearTimeout(timer);
    }
  }, [
    ready,
    state.inquiryStatus,
    state.firstReplyDueAt,
    state.followupReplyDueAt,
  ]);

  const markEstimateReviewed = useCallback(() => {
    updateDemoStore((current) =>
      current.hasReviewedEstimate
        ? current
        : { ...current, hasReviewedEstimate: true },
    );
  }, []);

  const markFamilyViewed = useCallback(() => {
    updateDemoStore((current) =>
      current.hasViewedFamily ? current : { ...current, hasViewedFamily: true },
    );
  }, []);

  const approveInquiry = useCallback(() => {
    updateDemoStore((current) => {
      if (!canApplyInquiryAction(current.inquiryStatus, "approve")) {
        return current;
      }
      return {
        ...current,
        hasReviewedEstimate: true,
        inquiryStatus: applyInquiryAction(current.inquiryStatus, "approve"),
        firstReplyDueAt: Date.now() + REPLY_DELAY_MS,
      };
    });
  }, []);

  const approveFollowup = useCallback(() => {
    updateDemoStore((current) => {
      if (!canApplyInquiryAction(current.inquiryStatus, "approve_followup")) {
        return current;
      }
      return {
        ...current,
        inquiryStatus: applyInquiryAction(current.inquiryStatus, "approve_followup"),
        followupReplyDueAt: Date.now() + REPLY_DELAY_MS,
      };
    });
  }, []);

  const updateConditions = useCallback((patch: Partial<CostConditions>) => {
    updateDemoStore((current) => ({
      ...current,
      conditions: { ...current.conditions, ...patch },
    }));
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
      approveInquiry,
      approveFollowup,
      updateConditions,
      resetDemo,
    }),
    [
      state,
      ready,
      markEstimateReviewed,
      markFamilyViewed,
      approveInquiry,
      approveFollowup,
      updateConditions,
      resetDemo,
    ],
  );

  return <DemoContext.Provider value={value}>{children}</DemoContext.Provider>;
}

export function DemoReady({ children }: { children: ReactNode }) {
  const { ready } = useDemo();
  if (!ready) {
    return <p className="text-base text-ink-soft">準備内容を読み込んでいます…</p>;
  }
  return children;
}

export function useDemo() {
  const context = useContext(DemoContext);
  if (!context) {
    throw new Error("useDemo must be used within DemoProvider");
  }
  return context;
}
