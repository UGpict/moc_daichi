import type { FixedAppointment, Plan, PlanItem } from "@/domain/schemas";

export function validateTransition(args: {
  previous: Plan;
  next: Plan;
  fixedAppointments?: FixedAppointment[];
}): { ok: boolean; reasons: string[] } {
  const reasons: string[] = [];
  const nextBySpot = new Map(args.next.items.map((i) => [i.spotId, i]));
  const nextById = new Map(args.next.items.map((i) => [i.id, i]));

  for (const item of args.previous.items) {
    if (item.progress === "DONE" || item.progress === "IN_PROGRESS") {
      const found = nextBySpot.get(item.spotId) ?? nextById.get(item.id);
      if (!found) reasons.push(`${item.spotId} の完了済み／進行中が消えています`);
      else if (found.startAt !== item.startAt || found.endAt !== item.endAt || found.spotId !== item.spotId) {
        reasons.push(`${item.spotId} の完了済み／進行中は時刻も場所も変えられません`);
      }
    }
    if (item.locked) {
      const found = nextBySpot.get(item.spotId) ?? nextById.get(item.id);
      if (!found) reasons.push(`固定予定 ${item.spotId} が消えています`);
      else if (found.startAt !== item.startAt || found.endAt !== item.endAt || found.spotId !== item.spotId) {
        reasons.push(`固定予定 ${item.spotId} の時刻・場所は維持します`);
      }
    }
  }

  for (const appt of args.fixedAppointments ?? []) {
    const hit = args.next.items.find((it) => it.spotId === appt.spotId);
    if (appt.spotId && !hit) reasons.push(`固定予定 ${appt.label} が次案にありません`);
    if (hit && (hit.startAt !== appt.startAt || hit.endAt !== appt.endAt)) {
      reasons.push(`固定予定 ${appt.label} の時刻が変わっています`);
    }
  }

  return { ok: reasons.length === 0, reasons };
}

export function protectedItems(prev: PlanItem[]): PlanItem[] {
  return prev.filter((i) => i.locked || i.progress === "DONE" || i.progress === "IN_PROGRESS");
}
