import { getEnv } from "@/config/env";
import { getApps, initializeApp, cert, applicationDefault, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

let app: App | null = null;

export function firebaseAdminApp(): App | null {
  const env = getEnv();
  if (getApps().length) return getApps()[0]!;
  try {
    if (env.authEmulatorHost || env.firestoreEmulatorHost) {
      if (env.authEmulatorHost && !process.env.FIREBASE_AUTH_EMULATOR_HOST) {
        process.env.FIREBASE_AUTH_EMULATOR_HOST = env.authEmulatorHost;
      }
      if (env.firestoreEmulatorHost && !process.env.FIRESTORE_EMULATOR_HOST) {
        process.env.FIRESTORE_EMULATOR_HOST = env.firestoreEmulatorHost;
      }
      app = initializeApp({ projectId: env.firebaseProjectId ?? "futari-log-dev" });
      return app;
    }
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      app = initializeApp({ credential: applicationDefault(), projectId: env.firebaseProjectId ?? undefined });
      return app;
    }
    if (env.firebaseProjectId && env.profile !== "DEV") {
      app = initializeApp({ credential: applicationDefault(), projectId: env.firebaseProjectId });
      return app;
    }
  } catch {
    return null;
  }
  return getApps()[0] ?? null;
}

export async function verifyFirebaseIdToken(token: string): Promise<string | null> {
  const a = firebaseAdminApp();
  if (!a) return null;
  try {
    const decoded = await getAuth(a).verifyIdToken(token);
    return decoded.uid;
  } catch {
    return null;
  }
}

export function firestoreDb() {
  const a = firebaseAdminApp();
  if (!a) return null;
  return getFirestore(a);
}

void cert;
