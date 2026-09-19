"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { api, ensureAuth, setBearerToken, clearClientCache } from "@/lib/client";
import type { Me } from "@/lib/types";
import {
  firebaseConfigured,
  signInFirebaseAnonymous,
  signInGoogle,
  signOutFirebase,
  watchIdToken,
} from "./firebaseClient";

type AuthState = {
  me: Me | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<Me | null>;
  signInGuest: () => Promise<Me>;
  signInWithGoogle: () => Promise<Me>;
  signOutUser: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const next = await api<Me>("/api/me");
      setMe(next);
      setError(null);
      return next;
    } catch (e) {
      setMe(null);
      setError(e instanceof Error ? e.message : "auth");
      return null;
    }
  }, []);

  const signInGuest = useCallback(async () => {
    if (firebaseConfigured()) {
      const token = await signInFirebaseAnonymous();
      setBearerToken(token);
    }
    const next = await ensureAuth();
    setMe(next);
    setError(null);
    return next;
  }, []);

  const signInWithGoogle = useCallback(async () => {
    const token = await signInGoogle();
    setBearerToken(token);
    const next = await api<Me>("/api/me");
    setMe(next);
    setError(null);
    return next;
  }, []);

  const signOutUser = useCallback(async () => {
    await signOutFirebase();
    await api("/api/auth/logout", { method: "POST", body: "{}" }).catch(() => undefined);
    clearClientCache();
    setMe(null);
  }, []);

  useEffect(() => {
    if (firebaseConfigured()) {
      const unsub = watchIdToken(async (token) => {
        setBearerToken(token);
        if (!token) {
          setMe(null);
          setLoading(false);
          return;
        }
        try {
          const next = await api<Me>("/api/me");
          setMe(next);
          setError(null);
        } catch (e) {
          setError(e instanceof Error ? e.message : "auth");
        } finally {
          setLoading(false);
        }
      });
      return () => unsub();
    }
    void ensureAuth()
      .then((next) => {
        setMe(next);
        setError(null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "auth"))
      .finally(() => setLoading(false));
    return undefined;
  }, []);

  const value = useMemo(
    () => ({ me, loading, error, refresh, signInGuest, signInWithGoogle, signOutUser }),
    [me, loading, error, refresh, signInGuest, signInWithGoogle, signOutUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
