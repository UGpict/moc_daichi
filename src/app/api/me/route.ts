import { json, persistHttp, requireUid } from "@/server/api/http";
import { DEMO_AREAS } from "@/config/areas";
import { getEnv, persistBlockers, publicBlockers } from "@/config/env";
import { ownerCoupleId } from "@/server/api/actions";
import { isPersistBlocked } from "@/server/repositories/persistErrors";

export async function GET(request: Request) {
  const auth = await requireUid(request);
  if ("error" in auth) return auth.error;
  const env = getEnv();
  let persist: Record<string, unknown> = {
    backend: env.persistBackend,
    kind: "ok",
    detail: env.persistBackend === "json" ? "DEV はローカル JSON" : "Firestore",
  };
  try {
    const { diagnosePersistSync } = await import("@/server/repositories/persistDiagnose");
    persist = diagnosePersistSync();
  } catch (error) {
    if (isPersistBlocked(error)) {
      persist = { backend: env.persistBackend, kind: error.kind, detail: error.message, operation: error.operation };
    } else {
      persist = {
        backend: env.persistBackend,
        kind: "UNIMPLEMENTED",
        detail: error instanceof Error ? error.message : "persist inspect",
      };
    }
  }
  let coupleId: string | null = null;
  try {
    coupleId = await ownerCoupleId(auth.uid);
  } catch (error) {
    const blocked = persistHttp(error);
    if (!blocked && !isPersistBlocked(error)) throw error;
    if (isPersistBlocked(error)) persist = { backend: env.persistBackend, kind: error.kind, detail: error.message };
  }
  return json({
    uid: auth.uid,
    coupleId,
    runtime: env.profile === "LIVE" ? "LIVE" : env.profile === "EMULATOR" ? "EMULATOR" : "DEV",
    demoControls: env.enableDemoControls,
    demoAreaName: env.demoAreaName,
    demoDate: env.demoDate,
    demoLat: env.demoLat,
    demoLng: env.demoLng,
    areas: Object.values(DEMO_AREAS),
    blockers: publicBlockers(),
    persist,
    persistBlockers: persistBlockers(),
  });
}
