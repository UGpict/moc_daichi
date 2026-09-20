/** Client-safe names/sizes for the Vercel JSON carry store. No Node APIs. */

export const STORE_HEADER = "x-futari-store";
export const STORE_HEADER_COUNT = "x-futari-store-n";
export const STORE_HEADER_PREFIX = "x-futari-store-";
export const STORE_COOKIE_COUNT = "futari_db_n";
export const STORE_COOKIE_PREFIX = "futari_db_";
export const STORE_CLIENT_KEY = "futari.store";
export const STORE_CHUNK = 2800;
export const STORE_MAX_CHUNKS = 16;

export function splitCarryChunks(encoded: string, size = STORE_CHUNK): string[] {
  if (!encoded) return [];
  const chunks: string[] = [];
  for (let i = 0; i < encoded.length; i += size) {
    chunks.push(encoded.slice(i, i + size));
  }
  return chunks.slice(0, STORE_MAX_CHUNKS);
}

export function joinCarryChunks(chunks: string[]): string {
  return chunks.join("");
}

export function readCarryHeader(get: (name: string) => string | null): string | null {
  const single = get(STORE_HEADER);
  if (single) return single;
  const n = Number(get(STORE_HEADER_COUNT) ?? 0);
  if (!Number.isFinite(n) || n <= 0) return null;
  const chunks: string[] = [];
  for (let i = 0; i < n; i++) {
    const part = get(`${STORE_HEADER_PREFIX}${i}`);
    if (!part) return null;
    chunks.push(part);
  }
  return joinCarryChunks(chunks);
}

export function writeCarryHeaders(encoded: string, set: (name: string, value: string) => void) {
  const chunks = splitCarryChunks(encoded);
  if (chunks.length <= 1) {
    set(STORE_HEADER, encoded);
    return;
  }
  set(STORE_HEADER_COUNT, String(chunks.length));
  chunks.forEach((chunk, i) => set(`${STORE_HEADER_PREFIX}${i}`, chunk));
}
