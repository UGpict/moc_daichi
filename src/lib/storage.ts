import { DEFAULT_DEMO_STATE, EMPTY_CASE_INQUIRY, EMPTY_PERMIT } from "./sample-data";
import { createPrepStartState } from "./procedure";
import type {
  CaseInquiry,
  DeathCertificateStatus,
  DemoEventId,
  DemoState,
  DemoTrack,
  DomicileStatus,
  FormStatus,
  InquiryStatus,
  PermitFlags,
  ScheduleStatus,
  StayDays,
  TransportKm,
} from "./types";
import {
  DEATH_CERTIFICATE_STATUSES,
  DEMO_EVENT_IDS,
  DOMICILE_STATUSES,
  FORM_STATUSES,
  INQUIRY_STATUSES,
  SCHEDULE_STATUSES,
  STAY_DAY_OPTIONS,
  TRANSPORT_KM_OPTIONS,
} from "./types";

export const STORAGE_KEY = "sougi-agent-demo-v2";

function includes<T extends string>(list: readonly T[], value: unknown): value is T {
  return typeof value === "string" && (list as readonly string[]).includes(value);
}

function isStayDays(value: unknown): value is StayDays {
  return typeof value === "number" && (STAY_DAY_OPTIONS as readonly number[]).includes(value);
}

function isTransportKm(value: unknown): value is TransportKm {
  return typeof value === "number" && (TRANSPORT_KM_OPTIONS as readonly number[]).includes(value);
}

function parseCaseInquiry(value: unknown): CaseInquiry {
  const raw = value && typeof value === "object" ? (value as CaseInquiry) : EMPTY_CASE_INQUIRY;
  return {
    received: Boolean(raw.received),
    checkApproved: Boolean(raw.checkApproved),
    checkSent: Boolean(raw.checkSent),
    staffWillHandle: Boolean(raw.staffWillHandle),
    staffCompleted: Boolean(raw.staffCompleted),
    municipalityVerified: Boolean(raw.municipalityVerified),
  };
}

function parsePermit(value: unknown): PermitFlags {
  const raw = value && typeof value === "object" ? (value as PermitFlags) : EMPTY_PERMIT;
  return {
    issued: Boolean(raw.issued),
    received: Boolean(raw.received),
    handedOver: Boolean(raw.handedOver),
  };
}

function parseEvents(value: unknown): DemoEventId[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is DemoEventId => includes(DEMO_EVENT_IDS, item));
}

export function parseDemoState(value: unknown): DemoState | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const raw = value as Partial<DemoState>;
  if (raw.version !== 2 || !includes(INQUIRY_STATUSES, raw.inquiryStatus)) {
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

  const track: DemoTrack = raw.track === "procedure" ? "procedure" : "prep";
  const scheduleStatus: ScheduleStatus = includes(SCHEDULE_STATUSES, raw.scheduleStatus)
    ? raw.scheduleStatus
    : DEFAULT_DEMO_STATE.scheduleStatus;
  const formStatus: FormStatus = includes(FORM_STATUSES, raw.formStatus)
    ? raw.formStatus
    : DEFAULT_DEMO_STATE.formStatus;
  const domicileStatus: DomicileStatus = includes(DOMICILE_STATUSES, raw.domicileStatus)
    ? raw.domicileStatus
    : DEFAULT_DEMO_STATE.domicileStatus;
  const deathCertificate: DeathCertificateStatus = includes(
    DEATH_CERTIFICATE_STATUSES,
    raw.deathCertificate,
  )
    ? raw.deathCertificate
    : DEFAULT_DEMO_STATE.deathCertificate;

  return {
    version: 2,
    track,
    inquiryStatus: raw.inquiryStatus as InquiryStatus,
    conditions: {
      stayDays,
      transportKm,
      nightTransport: raw.conditions.nightTransport,
    },
    hasReviewedEstimate: Boolean(raw.hasReviewedEstimate),
    hasViewedFamily: Boolean(raw.hasViewedFamily),
    firstReplyDueAt: typeof raw.firstReplyDueAt === "number" ? raw.firstReplyDueAt : null,
    followupReplyDueAt: typeof raw.followupReplyDueAt === "number" ? raw.followupReplyDueAt : null,
    deathCertificate,
    domicileStatus,
    scheduleStatus,
    originalCremationDate:
      typeof raw.originalCremationDate === "string"
        ? raw.originalCremationDate
        : DEFAULT_DEMO_STATE.originalCremationDate,
    proposedCremationDate:
      typeof raw.proposedCremationDate === "string"
        ? raw.proposedCremationDate
        : DEFAULT_DEMO_STATE.proposedCremationDate,
    applicationCremationDate:
      typeof raw.applicationCremationDate === "string"
        ? raw.applicationCremationDate
        : DEFAULT_DEMO_STATE.applicationCremationDate,
    formStatus,
    caseInquiry: parseCaseInquiry(raw.caseInquiry),
    permit: parsePermit(raw.permit),
    autoPlay: Boolean(raw.autoPlay),
    nextAutoAt: typeof raw.nextAutoAt === "number" ? raw.nextAutoAt : null,
    appliedEventIds: parseEvents(raw.appliedEventIds),
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
  return createPrepStartState();
}
