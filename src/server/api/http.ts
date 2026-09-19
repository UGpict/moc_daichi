import { NextResponse } from "next/server";
import { getEnv } from "@/config/env";
import { verifyRequestToken } from "@/server/auth";
import { isPersistBlocked } from "@/server/repositories/persistErrors";

export function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

export function bearer(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (header?.startsWith("Bearer ")) return header.slice(7);
  const env = getEnv();
  if (env.profile === "LIVE" || env.profile === "EMULATOR") return null;
  const cookie = request.headers.get("cookie") ?? "";
  const match = cookie.split(";").map((s) => s.trim()).find((s) => s.startsWith("futari_token="));
  return match ? decodeURIComponent(match.split("=")[1] ?? "") : null;
}

export async function requireUid(request: Request): Promise<{ uid: string } | { error: NextResponse }> {
  const uid = await verifyRequestToken(bearer(request));
  if (!uid) return { error: json({ error: "unauthorized" }, 401) };
  return { uid };
}

export function idempotencyKey(request: Request): string | null {
  return request.headers.get("idempotency-key");
}

export function persistHttp(error: unknown): NextResponse | null {
  if (!isPersistBlocked(error)) return null;
  return json(
    {
      error: error.message,
      persistKind: error.kind,
      blocked: true,
      outcome: "BLOCKED",
    },
    503,
  );
}

export async function withPersistHttp<T>(fn: () => Promise<T>): Promise<T | NextResponse> {
  try {
    return await fn();
  } catch (error) {
    const http = persistHttp(error);
    if (http) return http;
    throw error;
  }
}
