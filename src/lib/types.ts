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

export interface CostConditions {
  stayDays: StayDays;
  transportKm: TransportKm;
  nightTransport: boolean;
}

export interface DemoState {
  version: 1;
  inquiryStatus: InquiryStatus;
  conditions: CostConditions;
  hasReviewedEstimate: boolean;
  hasViewedFamily: boolean;
  firstReplyDueAt: number | null;
  followupReplyDueAt: number | null;
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
