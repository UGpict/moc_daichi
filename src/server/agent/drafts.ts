import { z } from "zod";
import type { SelectionDraft, SelectedSpot } from "@/domain/schemas";
import { withStore } from "@/server/repositories/store";
import { newId } from "@/lib/ids";
import { realNowIso } from "@/lib/time";

const storedPickSchema = z.object({
  ids: z.array(z.string()).default([]),
  names: z.array(z.string()).default([]),
  vibes: z.array(z.string()).default([]),
  intents: z.array(z.enum(["MUST_VISIT", "PREFER_VISIT"])).optional(),
});

export function parseClientPicks(raw: string | null): z.infer<typeof storedPickSchema> | null {
  if (!raw) return null;
  try {
    const parsed = storedPickSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export async function createDraft(uid: string, areaId: string, spots: SelectedSpot[]): Promise<SelectionDraft> {
  const draft: SelectionDraft = {
    id: newId("draft"),
    ownerUid: uid,
    areaId,
    createdAt: realNowIso(),
    selectedSpots: spots,
    status: "OPEN",
    consumedAt: null,
  };
  await withStore((db) => {
    db.drafts ??= {};
    draft.id = Object.values(db.drafts).find((d) => d.ownerUid === uid && d.status === "OPEN")?.id ?? draft.id;
    db.drafts[draft.id] = { ...draft, selectedSpots: spots, status: "OPEN", consumedAt: null };
  }, { draftsForOwner: true, ownerUid: uid });
  return draft;
}

export async function clearDraft(uid: string, draftId?: string | null): Promise<void> {
  await withStore((db) => {
    db.drafts ??= {};
    for (const d of Object.values(db.drafts)) {
      if (d.ownerUid !== uid) continue;
      if (draftId && d.id !== draftId) continue;
      if (d.status === "OPEN") d.status = "CLEARED";
    }
  }, { draftsForOwner: true, ownerUid: uid, draftId: draftId ?? undefined });
}

export async function getOpenDraft(uid: string): Promise<SelectionDraft | null> {
  return withStore((db) => {
    db.drafts ??= {};
    return Object.values(db.drafts).find((d) => d.ownerUid === uid && d.status === "OPEN") ?? null;
  }, { draftsForOwner: true, ownerUid: uid });
}

export async function consumeDraft(uid: string, draftId: string | null | undefined): Promise<void> {
  if (!draftId) return;
  await withStore((db) => {
    const d = db.drafts?.[draftId];
    if (!d || d.ownerUid !== uid) return;
    d.status = "CONSUMED";
    d.consumedAt = realNowIso();
  }, { draftId, ownerUid: uid });
}
