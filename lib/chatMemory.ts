export type MemoryTurn = {
  role: "user" | "assistant";
  content: string;
  at: number;
};

type SessionMemory = {
  turns: MemoryTurn[];
  touchedAt: number;
};

const MAX_TURNS = 10;
const TTL_MS = 6 * 60 * 60 * 1000;
const GLOBAL_KEY = Symbol.for("rouda.chatMemory.v1");

type Store = Map<string, SessionMemory>;

const globalRef = globalThis as { [k: symbol]: unknown };
if (!globalRef[GLOBAL_KEY]) globalRef[GLOBAL_KEY] = new Map<string, SessionMemory>();
const store = globalRef[GLOBAL_KEY] as Store;

function prune(now: number) {
  for (const [sessionId, memory] of store) {
    if (now - memory.touchedAt > TTL_MS) {
      store.delete(sessionId);
    }
  }
}

function getOrCreate(sessionId: string): SessionMemory {
  const now = Date.now();
  prune(now);

  const existing = store.get(sessionId);
  if (existing) {
    existing.touchedAt = now;
    return existing;
  }

  const fresh: SessionMemory = { turns: [], touchedAt: now };
  store.set(sessionId, fresh);
  return fresh;
}

export function getSessionTurns(sessionId: string): MemoryTurn[] {
  return [...getOrCreate(sessionId).turns];
}

export function appendSessionTurn(
  sessionId: string,
  role: MemoryTurn["role"],
  content: string,
): void {
  const memory = getOrCreate(sessionId);
  const trimmed = content.trim();
  if (!trimmed) return;

  memory.turns.push({ role, content: trimmed, at: Date.now() });
  if (memory.turns.length > MAX_TURNS) {
    memory.turns.splice(0, memory.turns.length - MAX_TURNS);
  }
}
