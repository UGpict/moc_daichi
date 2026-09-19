import { getEnv } from "@/config/env";

export function workerBearer(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (header?.startsWith("Bearer ")) return header.slice(7);
  const key = request.headers.get("x-futari-worker-key");
  return key?.trim() ? key.trim() : null;
}

/** Cloud Run のジョブ起動。秘密鍵ファイルは使わない。 */
export function authorizeWorkerRequest(request: Request): { ok: true } | { ok: false; status: number; error: string } {
  const env = getEnv();
  const secret = env.workerSharedSecret;
  const token = workerBearer(request);
  if (secret) {
    if (token === secret) return { ok: true };
    return { ok: false, status: 401, error: "worker unauthorized" };
  }
  if (env.profile === "LIVE" && env.cloudRunService) {
    return { ok: false, status: 401, error: "WORKER_SHARED_SECRET required on Cloud Run" };
  }
  const host = (request.headers.get("host") ?? "").split(":")[0] ?? "";
  if (host === "127.0.0.1" || host === "localhost") return { ok: true };
  return { ok: false, status: 401, error: "worker unauthorized" };
}
