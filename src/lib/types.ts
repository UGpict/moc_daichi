export const INQUIRY_STATUSES = [
  "awaiting_approval",
  "awaiting_first_reply",
  "awaiting_followup_approval",
  "awaiting_followup_reply",
  "answers_confirmed",
] as const;

export type InquiryStatus = (typeof INQUIRY_STATUSES)[number];

export const STAY_DAY_OPTIONS = [2, 3, 4, 5, 6, 7] as const;
export type StayDays = (typeof STAY_DAY_OPTIONS)[number];

export const TRANSPORT_KM_OPTIONS = [10, 20, 30, 40] as const;
export type TransportKm = (typeof TRANSPORT_KM_OPTIONS)[number];

export type CheckItemId = "stay" | "transport" | "cremation" | "food";

export type ItemReviewStatus = "unconfirmed" | "waiting" | "confirmed";

export type ProgressStatus = "todo" | "current" | "done";

export type DemoTrack = "prep" | "procedure";

export const SCHEDULE_STATUSES = [
  "not_started",
  "adjusting",
  "awaiting_adjust_approval",
  "paused_for_family",
  "awaiting_confirm",
  "confirmed",
] as const;

export type ScheduleStatus = (typeof SCHEDULE_STATUSES)[number];

export const FORM_STATUSES = [
  "not_started",
  "drafted",
  "mismatch",
  "updated",
  "ready",
  "submit_requested",
  "submitted",
] as const;

export type FormStatus = (typeof FORM_STATUSES)[number];

export const DOMICILE_STATUSES = [
  "unknown",
  "reviewing_sample",
  "sample_provided",
  "consulting",
  "consulting_sent",
  "consult_replied",
  "consult_acknowledged",
  "staff_recorded",
] as const;

export type DomicileStatus = (typeof DOMICILE_STATUSES)[number];

export const DEATH_CERTIFICATE_STATUSES = ["unchecked", "received"] as const;
export type DeathCertificateStatus = (typeof DEATH_CERTIFICATE_STATUSES)[number];

export type EvidenceId =
  | "estimate"
  | "first_reply"
  | "followup_reply"
  | "schedule_offer"
  | "municipality_inquiry"
  | "staff_will_handle"
  | "staff_completed"
  | "municipality_verified"
  | "permit";

export const DEMO_EVENT_IDS = [
  "receive_first_reply",
  "receive_followup_reply",
  "receive_schedule_offer",
  "receive_schedule_confirm",
  "receive_domicile_consult_reply",
  "receive_domicile_recorded",
  "receive_forms_submitted",
  "receive_municipality_inquiry",
  "receive_staff_will_handle",
  "receive_staff_completed",
  "receive_municipality_verified",
  "receive_permit_issued",
  "receive_permit_received",
  "receive_permit_handover",
] as const;

export type DemoEventId = (typeof DEMO_EVENT_IDS)[number];

export const USER_ACTION_IDS = [
  "approve_inquiry",
  "approve_followup",
  "choose_domicile_has_docs",
  "choose_domicile_unknown",
  "provide_domicile_sample",
  "approve_domicile_consult",
  "acknowledge_domicile_consult",
  "approve_schedule_adjust",
  "pause_schedule_for_family",
  "resume_schedule_decision",
  "approve_submit",
  "approve_municipality_check",
] as const;

export type UserActionId = (typeof USER_ACTION_IDS)[number];

export interface CostConditions {
  stayDays: StayDays;
  transportKm: TransportKm;
  nightTransport: boolean;
}

export interface PermitFlags {
  issued: boolean;
  received: boolean;
  handedOver: boolean;
}

export interface CaseInquiry {
  received: boolean;
  checkApproved: boolean;
  checkSent: boolean;
  staffWillHandle: boolean;
  staffCompleted: boolean;
  municipalityVerified: boolean;
}

export interface DemoState {
  version: 3;
  track: DemoTrack;
  inquiryStatus: InquiryStatus;
  conditions: CostConditions;
  hasReviewedEstimate: boolean;
  hasViewedFamily: boolean;
  firstReplyDueAt: number | null;
  followupReplyDueAt: number | null;
  deathCertificate: DeathCertificateStatus;
  domicileStatus: DomicileStatus;
  scheduleStatus: ScheduleStatus;
  originalCremationDate: string;
  proposedCremationDate: string;
  applicationCremationDate: string;
  formStatus: FormStatus;
  caseInquiry: CaseInquiry;
  permit: PermitFlags;
  autoPlay: boolean;
  nextAutoAt: number | null;
  appliedEventIds: DemoEventId[];
}

export interface CostLine {
  id: string;
  label: string;
  amount: number;
  note: string;
}

export interface CostBreakdown {
  lines: CostLine[];
  total: number;
  includedStayDays: number;
  stayExtensionDays: number;
  transportOverageKm: number;
}

export interface ProgressStep {
  id: string;
  label: string;
  status: ProgressStatus;
  statusLabel: string;
}

export interface DashboardItem {
  id: string;
  title: string;
  detail: string;
  href?: string;
  evidenceId?: EvidenceId;
}

export interface ApprovalItem {
  id: UserActionId;
  label: string;
  href: string;
}

export interface ActivityItem {
  id: string;
  title: string;
  checked: string;
  found: string;
  unresolved: string | null;
  evidenceId?: EvidenceId;
}

export interface ShirubeReport {
  message: string;
  next: string;
}
