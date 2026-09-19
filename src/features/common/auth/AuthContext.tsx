"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { api, ensureAuth } from "@/lib/client";
import type { Me } from "@/lib/types";

type AuthState = {
  me: Me | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<Me | null>;
  signInGuest: () => Promise<Me>;
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
    const next = await ensureAuth();
    setMe(next);
    setError(null);
    return next;
  }, []);

  useEffect(() => {
    void ensureAuth()
      .then((next) => {
        setMe(next);
        setError(null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "auth"))
      .finally(() => setLoading(false));
  }, []);

  const value = useMemo(
    () => ({ me, loading, error, refresh, signInGuest }),
    [me, loading, error, refresh, signInGuest],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
