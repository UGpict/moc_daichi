import { DEFAULT_DEMO_STATE } from "./sample-data";
import type { DemoState, InquiryStatus, StayDays, TransportKm } from "./types";
import { INQUIRY_STATUSES, STAY_DAY_OPTIONS, TRANSPORT_KM_OPTIONS } from "./types";

export const STORAGE_KEY = "shirube-demo-v1";

function isInquiryStatus(value: unknown): value is InquiryStatus {
  return (
    typeof value === "string" &&
    (INQUIRY_STATUSES as readonly string[]).includes(value)
  );
}

function isStayDays(value: unknown): value is StayDays {
  return (
    typeof value === "number" &&
    (STAY_DAY_OPTIONS as readonly number[]).includes(value)
  );
}

function isTransportKm(value: unknown): value is TransportKm {
  return (
    typeof value === "number" &&
    (TRANSPORT_KM_OPTIONS as readonly number[]).includes(value)
  );
}

export function parseDemoState(value: unknown): DemoState | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const raw = value as Partial<DemoState>;
  if (raw.version !== 1 || !isInquiryStatus(raw.inquiryStatus)) {
    return null;
  }

  const stayDays = raw.conditions?.stayDays;
  const transportKm = raw.conditions?.transportKm;
  if (!isStayDays(stayDays) || !isTransportKm(transportKm)) {
    return null;
  }

  if (typeof raw.conditions?.nightTransport !== "boolean") {
    return null;
  }

  return {
    version: 1,
    inquiryStatus: raw.inquiryStatus,
    conditions: {
      stayDays,
      transportKm,
      nightTransport: raw.conditions.nightTransport,
    },
    hasReviewedEstimate: Boolean(raw.hasReviewedEstimate),
    hasViewedFamily: Boolean(raw.hasViewedFamily),
    firstReplyDueAt:
      typeof raw.firstReplyDueAt === "number" ? raw.firstReplyDueAt : null,
    followupReplyDueAt:
      typeof raw.followupReplyDueAt === "number" ? raw.followupReplyDueAt : null,
  };
}

export function loadDemoState(): DemoState | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }

    return parseDemoState(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function saveDemoState(state: DemoState): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function clearDemoState(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(STORAGE_KEY);
}

export function createInitialDemoState(): DemoState {
  return {
    ...DEFAULT_DEMO_STATE,
    conditions: { ...DEFAULT_DEMO_STATE.conditions },
  };
}
