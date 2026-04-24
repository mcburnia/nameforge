// Simple in-process TTL cache. Good enough for one-node MVP. Swap for Redis or
// a Prisma-backed store when we have horizontal scale or cross-process sharing.
// Clock is injectable so tests can advance time without faking timers globally.

export type Clock = () => number;

interface Entry<T> {
  value: T;
  expiresAt: number;
}

export interface TtlCache<T> {
  get(key: string): T | null;
  set(key: string, value: T): void;
  delete(key: string): void;
  clear(): void;
  size(): number;
}

export interface TtlCacheOptions {
  ttlMs: number;
  clock?: Clock;
  maxEntries?: number;
}

export function createTtlCache<T>(options: TtlCacheOptions): TtlCache<T> {
  const clock: Clock = options.clock ?? (() => Date.now());
  const ttlMs = options.ttlMs;
  const maxEntries = options.maxEntries ?? 10_000;
  const store = new Map<string, Entry<T>>();

  function evictExpired(): void {
    const now = clock();
    for (const [k, entry] of store) {
      if (entry.expiresAt <= now) store.delete(k);
    }
  }

  function evictOldest(): void {
    // Map preserves insertion order, so the first key is the oldest.
    const firstKey = store.keys().next().value;
    if (firstKey !== undefined) store.delete(firstKey);
  }

  return {
    get(key) {
      const entry = store.get(key);
      if (!entry) return null;
      if (entry.expiresAt <= clock()) {
        store.delete(key);
        return null;
      }
      return entry.value;
    },
    set(key, value) {
      if (store.size >= maxEntries && !store.has(key)) {
        evictExpired();
        if (store.size >= maxEntries) evictOldest();
      }
      store.set(key, { value, expiresAt: clock() + ttlMs });
    },
    delete(key) {
      store.delete(key);
    },
    clear() {
      store.clear();
    },
    size() {
      return store.size;
    },
  };
}
