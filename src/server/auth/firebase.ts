import { getEnv } from "@/config/env";
import { getApps, initializeApp, applicationDefault, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { stripPlaceholderAdc } from "./adc";
import { applyEmulatorEnv, emulatorStatus } from "./emulatorGuard";
import { PersistBlockedError } from "@/server/repositories/persistErrors";

let app: App | null = null;
let lastInitError: { operation: string; name: string; message: string; code: string | null } | null = null;
let emulatorReadyChecked = false;

export function lastFirebaseAdminInitError() {
  return lastInitError;
}

export function resetFirebaseAdminForTests() {
  app = null;
  lastInitError = null;
  emulatorReadyChecked = false;
}

function recordInitError(operation: string, error: unknown) {
  lastInitError = {
    operation,
    name: error instanceof Error ? error.name : "Error",
    message: error instanceof Error ? error.message : String(error),
    code: error && typeof error === "object" && "code" in error ? String((error as { code?: unknown }).code) : null,
  };
}

export function firebaseAdminApp(): App | null {
  const env = getEnv();
  if (getApps().length) return getApps()[0]!;
  try {
    if (env.profile === "EMULATOR" || env.authEmulatorHost || env.firestoreEmulatorHost) {
      const hosts = applyEmulatorEnv();
      if (!emulatorReadyChecked) {
        emulatorReadyChecked = true;
      }
      app = initializeApp({ projectId: env.firebaseProjectId || "futari-log-dev" });
      lastInitError = null;
      void hosts;
      return app;
    }
    stripPlaceholderAdc();
    app = initializeApp({
      credential: applicationDefault(),
      projectId: env.firebaseProjectId ?? undefined,
    });
    lastInitError = null;
    return app;
  } catch (error) {
    recordInitError("firebase-admin initializeApp(applicationDefault)", error);
    return null;
  }
}

/** Emulator 指定時は本番へ繋がない。未起動なら明示停止。 */
export async function assertEmulatorOrThrow(): Promise<void> {
  const env = getEnv();
  if (env.profile !== "EMULATOR" && !env.firestoreEmulatorHost && !env.authEmulatorHost) return;
  applyEmulatorEnv();
  const status = await emulatorStatus();
  if (status.ready) return;
  throw new PersistBlockedError(
    "CONNECT",
    `Firebase Emulator が未起動（firestore=${status.firestore} auth=${status.auth}）。本番 Firestore へは接続しない`,
    { operation: "probe FIRESTORE_EMULATOR_HOST / FIREBASE_AUTH_EMULATOR_HOST" },
  );
}

export async function verifyFirebaseIdToken(token: string): Promise<string | null> {
  const adminUid = await verifyWithAdmin(token);
  if (adminUid) return adminUid;
  return verifyWithIdentityToolkit(token);
}

async function verifyWithAdmin(token: string): Promise<string | null> {
  const a = firebaseAdminApp();
  if (!a) return null;
  try {
    const decoded = await getAuth(a).verifyIdToken(token);
    return decoded.uid;
  } catch {
    return null;
  }
}

/** LIVE で Admin が無いとき、ウェブ API キーで ID トークンを確認する。Emulator / mock トークンは使わない。 */
async function verifyWithIdentityToolkit(token: string): Promise<string | null> {
  const env = getEnv();
  if (env.profile !== "LIVE" || !env.firebaseApiKey) return null;
  try {
    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(env.firebaseApiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken: token }),
        signal: AbortSignal.timeout(8000),
      },
    );
    if (!res.ok) return null;
    const json = (await res.json()) as { users?: { localId?: string }[] };
    return json.users?.[0]?.localId ?? null;
  } catch {
    return null;
  }
}

export function firestoreDb() {
  const a = firebaseAdminApp();
  if (!a) return null;
  return getFirestore(a);
}
