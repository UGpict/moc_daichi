import { getEnv } from "@/config/env";
import { hmacSha256, newId } from "@/lib/ids";
import { realNowIso } from "@/lib/time";
import { withStore } from "@/server/repositories/store";
import { verifyFirebaseIdToken } from "./firebase";

const COOKIE = "futari_token";

export function tokenCookieName() {
  return COOKIE;
}

export function createUid(): string {
  return newId("anon");
}

export function signToken(uid: string): string {
  const env = getEnv();
  const secret = env.mockAuthSecret;
  if (!secret) throw new Error("MOCK_AUTH_SECRET is required for DEV tokens");
  const payload = `${uid}.${Date.now()}`;
  return `mock.${payload}.${hmacSha256(secret, payload)}`;
}

export function verifyDevToken(token: string | null | undefined): string | null {
  if (!token) return null;
  const env = getEnv();
  if (env.profile === "LIVE") return null;
  if (!env.mockAuthSecret) return null;
  const parts = token.split(".");
  if (parts.length < 4 || parts[0] !== "mock") return null;
  const uid = parts[1];
  const ts = parts[2];
  const sig = parts.slice(3).join(".");
  const payload = `${uid}.${ts}`;
  if (hmacSha256(env.mockAuthSecret, payload) !== sig) return null;
  return uid;
}

export async function verifyRequestToken(token: string | null | undefined): Promise<string | null> {
  if (!token) return null;
  const env = getEnv();
  if (token.startsWith("mock.")) {
    if (env.profile === "LIVE") return null;
    return verifyDevToken(token);
  }
  if (env.profile === "LIVE" || env.profile === "EMULATOR") {
    return verifyFirebaseIdToken(token);
  }
  return verifyDevToken(token);
}

export function verifyToken(token: string | null | undefined): string | null {
  return verifyDevToken(token);
}

export async function issueAnonymous(): Promise<{ uid: string; token: string }> {
  const env = getEnv();
  if (env.profile === "LIVE") {
    throw new Error("LIVE では開発用匿名トークンを発行しません。Firebase Auth を使ってください");
  }
  const uid = createUid();
  const token = signToken(uid);
  await withStore((db) => {
    db.tokens[token] = { uid, createdAt: realNowIso() };
  }, { token });
  return { uid, token };
}

export function demoAllowed(uid: string): boolean {
  const env = getEnv();
  if (!env.enableDemoControls) return false;
  if (env.profile === "DEV") return true;
  return env.demoAllowedUids.includes(uid);
}
