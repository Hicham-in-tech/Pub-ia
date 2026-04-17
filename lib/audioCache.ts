/**
 * Short-lived in-memory audio buffer cache. The /api/chat route writes a clip
 * when the backend generates one, and /api/audio/[id] reads it back as a normal HTTP
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
const TEXT_INDEX_KEY = Symbol.for("rouda.audioCache.textIndex.v1");
type Store = Map<string, Entry>;
type TextIndex = Map<string, string>;
const globalRef = globalThis as { [k: symbol]: unknown };
if (!globalRef[GLOBAL_KEY]) globalRef[GLOBAL_KEY] = new Map<string, Entry>();
if (!globalRef[TEXT_INDEX_KEY]) globalRef[TEXT_INDEX_KEY] = new Map<string, string>();
const store = globalRef[GLOBAL_KEY] as Store;
const textIndex = globalRef[TEXT_INDEX_KEY] as TextIndex;

function removeTextKeysForId(id: string) {
  for (const [key, mappedId] of textIndex) {
    if (mappedId === id) textIndex.delete(key);
  }
}

function evictExpired(now: number) {
  for (const [id, entry] of store) {
    if (now - entry.createdAt > TTL_MS) {
      store.delete(id);
      removeTextKeysForId(id);
    }
  }

  for (const [textKey, id] of textIndex) {
    if (!store.has(id)) textIndex.delete(textKey);
  }

  // hard cap: drop oldest
  while (store.size > MAX_ENTRIES) {
    const oldest = store.keys().next().value;
    if (!oldest) break;
    store.delete(oldest);
    removeTextKeysForId(oldest);
  }
}

export function putAudio(bytes: Uint8Array, mimeType = "audio/mpeg", textKey?: string): string {
  const id = (crypto as Crypto).randomUUID();
  const now = Date.now();
  evictExpired(now);
  store.set(id, { bytes, mimeType, createdAt: now });
  if (textKey) textIndex.set(textKey, id);
  return id;
}

export function getAudioIdByText(textKey: string): string | null {
  const id = textIndex.get(textKey);
  if (!id) return null;

  const entry = store.get(id);
  if (!entry) {
    textIndex.delete(textKey);
    return null;
  }

  if (Date.now() - entry.createdAt > TTL_MS) {
    store.delete(id);
    textIndex.delete(textKey);
    removeTextKeysForId(id);
    return null;
  }

  return id;
}

export function getAudio(id: string): Entry | null {
  const entry = store.get(id);
  if (!entry) return null;
  if (Date.now() - entry.createdAt > TTL_MS) {
    store.delete(id);
    removeTextKeysForId(id);
    return null;
  }
  return entry;
}
