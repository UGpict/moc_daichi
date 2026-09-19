import {
  DEFAULT_DEMO_STATE,
  DEFAULT_FAMILY_JUDGMENT,
  DEFAULT_SHARE,
  EMPTY_CASE_INQUIRY,
  EMPTY_PERMIT,
  OPENING_MESSAGES,
} from "./sample-data";
import { createPrepStartState } from "./procedure";
import type {
  ArrivalSlot,
  CaseInquiry,
  DeathCertificateStatus,
  DemoEventId,
  DemoState,
  DemoTrack,
  DomicileStatus,
  FamilyJudgment,
  FormStatus,
  InquiryStatus,
  MemoryKind,
  MemoryRecord,
  PermitFlags,
  ScheduleStatus,
  ShareSelection,
  StayDays,
  SummaryDecision,
  TalkMessage,
  TalkStep,
  TransportKm,
  ViewerRole,
} from "./types";
import {
  DEATH_CERTIFICATE_STATUSES,
  DEMO_EVENT_IDS,
  DOMICILE_STATUSES,
  FORM_STATUSES,
  INQUIRY_STATUSES,
  SCHEDULE_STATUSES,
  STAY_DAY_OPTIONS,
  TALK_STEPS,
  TRANSPORT_KM_OPTIONS,
} from "./types";

export const STORAGE_KEY = "sougi-agent-demo-v4";

const MEMORY_KINDS: MemoryKind[] = [
  "said",
  "interpretation",
  "confirmed",
  "external_fact",
];

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

function parseMessages(value: unknown): TalkMessage[] {
  if (!Array.isArray(value)) {
    return OPENING_MESSAGES.map((item) => ({ ...item }));
  }
  return value
    .filter((item): item is TalkMessage => {
      if (!item || typeof item !== "object") {
        return false;
      }
      const raw = item as TalkMessage;
      return (
        typeof raw.id === "string" &&
        (raw.from === "shirube" || raw.from === "user") &&
        typeof raw.text === "string"
      );
    })
    .map((item) => ({
      id: item.id,
      from: item.from,
      text: item.text,
      private: Boolean(item.private) || undefined,
    }));
}

function parseMemories(value: unknown): MemoryRecord[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter((item): item is MemoryRecord => {
      if (!item || typeof item !== "object") {
        return false;
      }
      const raw = item as MemoryRecord;
      return (
        typeof raw.id === "string" &&
        includes(MEMORY_KINDS, raw.kind) &&
        typeof raw.category === "string" &&
        typeof raw.text === "string"
      );
    })
    .map((item) => ({
      id: item.id,
      kind: item.kind,
      category: item.category,
      text: item.text,
      sourceQuote: typeof item.sourceQuote === "string" ? item.sourceQuote : undefined,
      private: Boolean(item.private),
    }));
}

function parseShare(value: unknown): ShareSelection {
  const raw = value && typeof value === "object" ? (value as ShareSelection) : DEFAULT_SHARE;
  return {
    includeWishes: raw.includeWishes !== false,
    includeConfirmed: raw.includeConfirmed !== false,
    includeUndecided: raw.includeUndecided !== false,
    includeEstimate: raw.includeEstimate !== false,
    includePrivate: Boolean(raw.includePrivate),
    sharedWithKenichi: Boolean(raw.sharedWithKenichi),
  };
}

function parseFamilyJudgment(value: unknown): FamilyJudgment {
  const raw =
    value && typeof value === "object" ? (value as FamilyJudgment) : DEFAULT_FAMILY_JUDGMENT;
  const arrival: ArrivalSlot | null =
    raw.arrival === "apr16_evening" ||
    raw.arrival === "apr16_morning" ||
    raw.arrival === "undecided"
      ? raw.arrival
      : null;
  return {
    statusNote: typeof raw.statusNote === "string" ? raw.statusNote : null,
    arrival,
    wantsRelatives: Boolean(raw.wantsRelatives),
    acceptedProposal: Boolean(raw.acceptedProposal),
    proposedDate: typeof raw.proposedDate === "string" ? raw.proposedDate : null,
    proposedReason: typeof raw.proposedReason === "string" ? raw.proposedReason : null,
  };
}

export function parseDemoState(value: unknown): DemoState | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const raw = value as Partial<DemoState>;
  if (raw.version !== 4 || !includes(INQUIRY_STATUSES, raw.inquiryStatus)) {
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
  const talkStep: TalkStep = includes(TALK_STEPS, raw.talkStep)
    ? raw.talkStep
    : DEFAULT_DEMO_STATE.talkStep;
  const resumeStep: TalkStep = includes(TALK_STEPS, raw.resumeStep)
    ? raw.resumeStep
    : talkStep;
  const viewerRole: ViewerRole = raw.viewerRole === "family" ? "family" : "mother";
  const summaryDecision: SummaryDecision =
    raw.summaryDecision === "confirmed" || raw.summaryDecision === "deferred"
      ? raw.summaryDecision
      : "undecided";

  return {
    version: 4,
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
    viewerRole,
    talkStep,
    resumeStep,
    messages: parseMessages(raw.messages),
    memories: parseMemories(raw.memories),
    summaryDecision,
    share: parseShare(raw.share),
    familyJudgment: parseFamilyJudgment(raw.familyJudgment),
    timePassed: Boolean(raw.timePassed),
    messageSeq: typeof raw.messageSeq === "number" ? raw.messageSeq : 1,
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
