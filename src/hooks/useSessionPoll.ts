"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/client";
import { useAuth } from "@/features/common/auth/AuthContext";
import type { Snapshot } from "@/lib/types";

export function useSessionPoll(sessionId: string | undefined) {
  const { me } = useAuth();
  const [data, setData] = useState<Snapshot | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId || !me?.uid) return;
    let cancelled = false;
    const load = async () => {
      try {
        const snap = await api<Snapshot>(`/api/sessions/${sessionId}`);
        if (!cancelled) {
          setData(snap);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "error");
      }
    };
    void load();
    const t = setInterval(() => void load(), 1200);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [sessionId, me?.uid]);

  return { data, error, setData };
}
