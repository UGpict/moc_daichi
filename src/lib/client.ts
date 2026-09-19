let bearerToken: string | null = null;

export function setBearerToken(token: string | null) {
  bearerToken = token;
}

export function getBearerToken() {
  return bearerToken;
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (init?.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (bearerToken && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${bearerToken}`);
  }
  const res = await fetch(path, {
    ...init,
    headers,
    credentials: "include",
  });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) {
    throw new Error(data.error ?? `HTTP ${res.status}`);
  }
  return data;
}

export async function ensureAuth(): Promise<{
  uid: string;
  coupleId: string | null;
  runtime: string;
  demoAreaName: string;
  demoDate: string;
  demoLat: number;
  demoLng: number;
  blockers: { code: string; item: string }[];
}> {
  try {
    return await api("/api/me");
  } catch {
    const anon = await api<{ uid: string; token?: string }>("/api/auth/anonymous", { method: "POST" });
    if (anon.token) setBearerToken(anon.token);
    return api("/api/me");
  }
}

export function clearClientCache() {
  setBearerToken(null);
  try {
    const keys: string[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i);
      if (k?.startsWith("futari.")) keys.push(k);
    }
    for (const k of keys) sessionStorage.removeItem(k);
  } catch {
    /* ignore */
  }
}
