process.env.APP_RUNTIME ??= "MOCK";
process.env.ENABLE_DEMO_CONTROLS ??= "true";

import { getEnv, publicBlockers } from "../src/config/env";

type Status = "PASS" | "FAIL" | "BLOCKED";
type Row = { name: string; status: Status; detail: string };

async function check(name: string, fn: () => Promise<{ status: Status; detail: string }>): Promise<Row> {
  try {
    const result = await fn();
    return { name, ...result };
  } catch (error) {
    return { name, status: "FAIL", detail: error instanceof Error ? error.message : "error" };
  }
}

async function main() {
  const env = getEnv();
  const rows: Row[] = [];

  rows.push(
    await check("env:firebase", async () => ({
      status: env.firebaseConfigured ? "PASS" : "BLOCKED",
      detail: env.firebaseConfigured ? "configured" : "keys missing; mock auth in use",
    })),
  );
  rows.push(
    await check("env:orcarouter", async () => ({
      status: env.orcaConfigured ? "PASS" : "BLOCKED",
      detail: env.orcaConfigured ? "key present" : "ORCAROUTER_API_KEY missing",
    })),
  );
  rows.push(
    await check("env:maps", async () => ({
      status: env.mapsConfigured ? "PASS" : "BLOCKED",
      detail: env.mapsConfigured ? "key present" : "GOOGLE_MAPS_API_KEY missing",
    })),
  );

  rows.push(
    await check("open-meteo", async () => {
      const url =
        "https://api.open-meteo.com/v1/forecast?latitude=35.17&longitude=136.88&hourly=precipitation&forecast_days=1&timezone=Asia%2FTokyo";
      const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
      return {
        status: res.ok ? "PASS" : "FAIL",
        detail: `HTTP ${res.status}`,
      };
    }),
  );

  if (env.orcaConfigured) {
    rows.push(
      await check("orcarouter mundane", async () => {
        const res = await fetch(`${env.orcaBaseUrl.replace(/\/$/, "")}/chat/completions`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${env.orcaApiKey}`,
            "Content-Type": "application/json",
            "X-OrcaRouter-Include-Cost": "true",
          },
          body: JSON.stringify({
            model: env.orcaMundaneModel,
            messages: [{ role: "user", content: "ping" }],
            temperature: 0.2,
            max_tokens: 8,
          }),
          signal: AbortSignal.timeout(20000),
        });
        return { status: res.ok ? "PASS" : "FAIL", detail: `HTTP ${res.status}` };
      }),
    );
    rows.push(
      await check("orcarouter hard", async () => {
        const res = await fetch(`${env.orcaBaseUrl.replace(/\/$/, "")}/chat/completions`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${env.orcaApiKey}`,
            "Content-Type": "application/json",
            "X-OrcaRouter-Include-Cost": "true",
          },
          body: JSON.stringify({
            model: env.orcaHardModel,
            messages: [{ role: "user", content: "ping" }],
            temperature: 0.2,
            max_tokens: 8,
          }),
          signal: AbortSignal.timeout(20000),
        });
        return { status: res.ok ? "PASS" : "FAIL", detail: `HTTP ${res.status}` };
      }),
    );
  } else {
    rows.push({ name: "orcarouter mundane", status: "BLOCKED", detail: "no key" });
    rows.push({ name: "orcarouter hard", status: "BLOCKED", detail: "no key" });
  }

  if (env.mapsConfigured) {
    rows.push(
      await check("places nearby", async () => {
        const res = await fetch("https://places.googleapis.com/v1/places:searchNearby", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": env.googleMapsApiKey!,
            "X-Goog-FieldMask": "places.id,places.displayName",
          },
          body: JSON.stringify({
            includedTypes: ["cafe"],
            maxResultCount: 1,
            locationRestriction: {
              circle: { center: { latitude: 35.170915, longitude: 136.881537 }, radius: 500 },
            },
          }),
          signal: AbortSignal.timeout(10000),
        });
        return { status: res.ok ? "PASS" : "FAIL", detail: `HTTP ${res.status}` };
      }),
    );
  } else {
    rows.push({ name: "places nearby", status: "BLOCKED", detail: "no key" });
    rows.push({ name: "routes", status: "BLOCKED", detail: "no key" });
  }

  if (env.orcaConfigured) {
    rows.push(
      await check("orcarouter named futari", async () => {
        const res = await fetch(`${env.orcaBaseUrl.replace(/\/$/, "")}/models`, {
          headers: { Authorization: `Bearer ${env.orcaApiKey}` },
          signal: AbortSignal.timeout(15000),
        });
        if (!res.ok) {
          return { status: "BLOCKED", detail: `GET /models HTTP ${res.status}。orcarouter/futari-* は作らない` };
        }
        const json = (await res.json()) as { data?: { id?: string }[] };
        const ids = (json.data ?? []).map((m) => m.id).filter((id): id is string => Boolean(id));
        const named = ids.filter((id) => id.startsWith("orcarouter/futari"));
        if (named.length) {
          return { status: "PASS", detail: named.join(", ") };
        }
        return {
          status: "BLOCKED",
          detail: `/v1/models に orcarouter/futari-* なし（${ids.length}件中）。命名は捏造せず ${env.orcaMundaneModel} / ${env.orcaHardModel}`,
        };
      }),
    );
  } else {
    rows.push({ name: "orcarouter named futari", status: "BLOCKED", detail: "no key" });
  }

  rows.push(
    await check("persist", async () => {
      const { diagnosePersistSync } = await import("../src/server/repositories/persistDiagnose");
      const d = diagnosePersistSync();
      const detail = `${d.kind} ${d.detail}${d.operation ? ` op=${d.operation}` : ""}${d.errorCode ? ` code=${d.errorCode}` : ""}`;
      if (d.kind === "ok") return { status: "PASS", detail };
      if (d.kind === "UNIMPLEMENTED") return { status: "FAIL", detail };
      return { status: "BLOCKED", detail };
    }),
  );

  rows.push({
    name: "venue",
    status: "BLOCKED",
    detail: "東京の発表会場住所・駅は未提供。開発デモは名古屋駅と東京駅を設定で切替",
  });

  for (const row of rows) {
    console.log(`${row.status}\t${row.name}\t${row.detail}`);
  }
  for (const b of publicBlockers()) {
    console.log(`BLOCKED\tlisted\t${b.item}`);
  }
  const failed = rows.some((r) => r.status === "FAIL");
  process.exit(failed ? 1 : 0);
}

void main();
