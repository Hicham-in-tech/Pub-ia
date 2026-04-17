/**
 * Short-lived in-memory audio buffer cache. The /api/chat route writes a clip
 * when n8n returns one, and /api/audio/[id] reads it back as a normal HTTP
 * stream. This keeps the browser playing real URLs (no data-URI size limits,
 * no base64 encoding, no JSON payload inflation).
 *
 * Entries expire after TTL_MS or when the ring exceeds MAX_ENTRIES.
 */

type Entry = {
  bytes: Uint8Array;
  mimeType: string;
  createdAt: number;
};

const TTL_MS = 5 * 60 * 1000;
const MAX_ENTRIES = 64;

// Survive HMR / dev rebuilds by stashing on globalThis.
const GLOBAL_KEY = Symbol.for("rouda.audioCache.v1");
type Store = Map<string, Entry>;
const globalRef = globalThis as { [k: symbol]: unknown };
if (!globalRef[GLOBAL_KEY]) globalRef[GLOBAL_KEY] = new Map<string, Entry>();
const store = globalRef[GLOBAL_KEY] as Store;

function evictExpired(now: number) {
  for (const [id, entry] of store) {
    if (now - entry.createdAt > TTL_MS) store.delete(id);
  }
  // hard cap: drop oldest
  while (store.size > MAX_ENTRIES) {
    const oldest = store.keys().next().value;
    if (!oldest) break;
    store.delete(oldest);
  }
}

export function putAudio(bytes: Uint8Array, mimeType = "audio/mpeg"): string {
  const id = (crypto as Crypto).randomUUID();
  const now = Date.now();
  evictExpired(now);
  store.set(id, { bytes, mimeType, createdAt: now });
  return id;
}

export function getAudio(id: string): Entry | null {
  const entry = store.get(id);
  if (!entry) return null;
  if (Date.now() - entry.createdAt > TTL_MS) {
    store.delete(id);
    return null;
  }
  return entry;
}
