type CacheEntry<T> = {
  expiresAt: number;
  value: Promise<T>;
};

const globalForKxCache = globalThis as typeof globalThis & {
  kxReadOnlyCache?: Map<string, CacheEntry<unknown>>;
};

const defaultTtlMs = Number(process.env.KX_READ_CACHE_SECONDS ?? 45) * 1000;

function getCacheStore(): Map<string, CacheEntry<unknown>> {
  if (!globalForKxCache.kxReadOnlyCache) {
    globalForKxCache.kxReadOnlyCache = new Map();
  }
  return globalForKxCache.kxReadOnlyCache;
}

export function getCachedRead<T>(
  key: string,
  factory: () => Promise<T>,
  ttlMs = defaultTtlMs
): Promise<T> {
  const store = getCacheStore();
  const now = Date.now();
  const existing = store.get(key) as CacheEntry<T> | undefined;

  if (existing && existing.expiresAt > now) {
    return existing.value;
  }

  const value = factory().catch((error) => {
    store.delete(key);
    throw error;
  });
  store.set(key, { expiresAt: now + ttlMs, value });
  return value;
}

export function clearCachedRead(keyPrefix: string): void {
  const store = getCacheStore();
  for (const key of store.keys()) {
    if (key.startsWith(keyPrefix)) {
      store.delete(key);
    }
  }
}
