const KEY = /(sk-orca-[A-Za-z0-9_-]+|AIza[0-9A-Za-z_-]{20,}|ya29\.[0-9A-Za-z._-]+|Bearer\s+[A-Za-z0-9._-]+)/g;
const COORD = /\b(3[4-9]\.\d{3,}|13[5-9]\.\d{3,})\b/g;

export function maskSecrets(text: string): string {
  return text
    .replace(KEY, "[REDACTED]")
    .replace(/idToken":\s*"[^"]+"/gi, 'idToken":"[REDACTED]"')
    .replace(COORD, "[COORD]");
}

export function safeLogPayload(value: unknown): unknown {
  try {
    return JSON.parse(maskSecrets(JSON.stringify(value)));
  } catch {
    return { redacted: true };
  }
}
