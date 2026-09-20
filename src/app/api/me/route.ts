import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function fail(error: unknown) {
  return NextResponse.json(
    { error: error instanceof Error ? error.message : "me failed" },
    { status: 500 },
  );
}

export async function GET(request: Request) {
  try {
    const { json, persistHttp, requireUid } = await import("@/server/api/http");
    const { DEMO_AREAS } = await import("@/config/areas");
    const { getEnv, persistBlockers, providerModes, publicBlockers } = await import("@/config/env");
    const { isPersistBlocked } = await import("@/server/repositories/persistErrors");
    const auth = await requireUid(request);
    if ("error" in auth) return auth.error;
    const env = getEnv();
    let persist: Record<string, unknown> = {
      backend: env.persistBackend,
      kind: "ok",
      detail: env.persistBackend === "json" ? "DEV はローカル JSON" : "Firestore",
    };
    try {
      const { diagnosePersist } = await import("@/server/repositories/persistDiagnose");
      persist = await Promise.race([
        diagnosePersist(),
        new Promise<Record<string, unknown>>((resolve) => {
          setTimeout(
            () =>
              resolve({
                backend: env.persistBackend,
                kind: "CONNECT",
                detail: "persist 診断がタイムアウトした。metadata 待ちで準備中のままにしない",
                operation: "diagnosePersist",
              }),
            2500,
          );
        }),
      ]);
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
      const { ownerCoupleId } = await import("@/server/api/actions");
      coupleId = await ownerCoupleId(auth.uid);
    } catch (error) {
      const blocked = persistHttp(error);
      if (!blocked && !isPersistBlocked(error)) {
        persist = {
          backend: env.persistBackend,
          kind: "CONNECT",
          detail: error instanceof Error ? error.message : "couple lookup",
        };
      }
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
      providers: providerModes(),
      countedAs: env.profile === "LIVE" ? "LIVE" : env.profile === "EMULATOR" ? "EMULATOR" : "DEV",
    });
  } catch (error) {
    return fail(error);
  }
}
