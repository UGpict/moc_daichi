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
const AUTH_WAIT_MS = 8_000;

function withDeadline<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label}がタイムアウトしました`)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const next = await withDeadline(api<Me>("/api/me"), AUTH_WAIT_MS, "認証の確認");
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
      try {
        const token = await withDeadline(signInFirebaseAnonymous(), AUTH_WAIT_MS, "ゲストログイン");
        setBearerToken(token);
      } catch {
        /* MOCK 見た目デモでは開発用匿名へ落とす。LIVE は /api/auth/anonymous が 403 */
      }
    }
    const next = await withDeadline(ensureAuth(), AUTH_WAIT_MS, "認証の確認");
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
    let cancelled = false;
    const safety = window.setTimeout(() => {
      if (cancelled) return;
      setLoading(false);
      setError((cur) => cur ?? "認証の確認がタイムアウトしました");
    }, AUTH_WAIT_MS);
    const finish = () => {
      if (!cancelled) setLoading(false);
      window.clearTimeout(safety);
    };

    if (firebaseConfigured()) {
      const unsub = watchIdToken(async (token) => {
        setBearerToken(token);
        if (!token) {
          setMe(null);
          finish();
          return;
        }
        try {
          const next = await withDeadline(api<Me>("/api/me"), AUTH_WAIT_MS, "認証の確認");
          if (cancelled) return;
          setMe(next);
          setError(null);
        } catch (e) {
          if (!cancelled) setError(e instanceof Error ? e.message : "auth");
        } finally {
          finish();
        }
      });
      return () => {
        cancelled = true;
        window.clearTimeout(safety);
        unsub();
      };
    }
    void withDeadline(ensureAuth(), AUTH_WAIT_MS, "認証の確認")
      .then((next) => {
        if (cancelled) return;
        setMe(next);
        setError(null);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "auth");
      })
      .finally(finish);
    return () => {
      cancelled = true;
      window.clearTimeout(safety);
    };
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
