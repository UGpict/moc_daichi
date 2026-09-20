import { json, persistHttp, requireUid } from "@/server/api/http";
import { getEnv } from "@/config/env";
import { maybeRefreshDailyDigest, readTodayDigest } from "@/server/providers/dailyDigest";

export async function GET(request: Request) {
  const auth = await requireUid(request);
  if ("error" in auth) return auth.error;
  try {
    let digest = await readTodayDigest();
    if (!digest || digest.status !== "READY") {
      const env = getEnv();
      if (env.runtime === "MOCK" || env.workerMode === "sync") {
        await maybeRefreshDailyDigest();
      } else {
        void maybeRefreshDailyDigest();
      }
      digest = await readTodayDigest();
    }
    const items = (digest?.items ?? []).map((item) => ({
      ...item,
      spot: digest?.spots[item.spotId] ?? null,
    }));
    return json({
      tokyoDate: digest?.tokyoDate ?? null,
      fetchedAt: digest?.fetchedAt ?? null,
        status: digest?.status ?? "FETCHING",
      note: digest?.note ?? "一日一回の取得を待っています",
      areaName: digest?.areaName ?? null,
      items: items.filter((i) => i.spot),
    });
  } catch (error) {
    const blocked = persistHttp(error);
    if (blocked) return blocked;
    throw error;
  }
}
