"use client";

import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import {
  getAuth,
  signInAnonymously,
  GoogleAuthProvider,
  signInWithPopup,
  onIdTokenChanged,
  signOut,
  connectAuthEmulator,
  type User,
} from "firebase/auth";

function config() {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  const authDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN;
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const appId = process.env.NEXT_PUBLIC_FIREBASE_APP_ID;
  if (!apiKey || !authDomain || !projectId || !appId) return null;
  return { apiKey, authDomain, projectId, appId };
}

let app: FirebaseApp | null = null;

export function firebaseConfigured() {
  return Boolean(config());
}

function appOrNull(): FirebaseApp | null {
  const c = config();
  if (!c) return null;
  if (getApps().length) return getApps()[0]!;
  app = initializeApp(c);
  const auth = getAuth(app);
  const emu = process.env.NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST;
  if (emu) {
    try {
      connectAuthEmulator(auth, emu.startsWith("http") ? emu : `http://${emu}`, { disableWarnings: true });
    } catch {
      /* already connected */
    }
  }
  return app;
}

export function watchIdToken(cb: (token: string | null, user: User | null) => void) {
  const a = appOrNull();
  if (!a) return () => undefined;
  return onIdTokenChanged(getAuth(a), async (user) => {
    const token = user ? await user.getIdToken() : null;
    cb(token, user);
  });
}

export async function signInFirebaseAnonymous() {
  const a = appOrNull();
  if (!a) throw new Error("Firebase 未設定");
  const cred = await signInAnonymously(getAuth(a));
  return cred.user.getIdToken();
}

export async function signInGoogle() {
  const a = appOrNull();
  if (!a) throw new Error("Firebase 未設定");
  const cred = await signInWithPopup(getAuth(a), new GoogleAuthProvider());
  return cred.user.getIdToken();
}

export async function signOutFirebase() {
  const a = appOrNull();
  if (!a) return;
  await signOut(getAuth(a));
}
