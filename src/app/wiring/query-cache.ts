interface CacheEntry<T> {
  value?: T;
  expiresAt: number;
  promise?: Promise<T>;
}

const cache = new Map<string, CacheEntry<unknown>>();

interface CachedResourceOptions<T> {
  force?: boolean;
  shouldCache?: (value: T) => boolean;
}

export async function getCachedResource<T>(
  key: string,
  ttlMs: number,
  loader: () => Promise<T>,
  options: CachedResourceOptions<T> = {},
): Promise<T> {
  const now = Date.now();
  const existing = cache.get(key) as CacheEntry<T> | undefined;

  if (!options.force && existing?.value !== undefined && existing.expiresAt > now) {
    return existing.value;
  }

  if (existing?.promise) {
    return existing.promise;
  }

  const promise = loader()
    .then((value) => {
      if (options.shouldCache ? options.shouldCache(value) : true) {
        cache.set(key, {
          value,
          expiresAt: Date.now() + ttlMs,
        });
      } else {
        cache.delete(key);
      }
      return value;
    })
    .catch((error) => {
      const latest = cache.get(key) as CacheEntry<T> | undefined;
      if (latest?.value !== undefined && latest.expiresAt > Date.now()) {
        cache.set(key, {
          value: latest.value,
          expiresAt: latest.expiresAt,
        });
      } else {
        cache.delete(key);
      }
      throw error;
    });

  cache.set(key, {
    value: existing?.value,
    expiresAt: existing?.expiresAt || 0,
    promise,
  });

  return promise;
}

export function primeCachedResource<T>(key: string, value: T, ttlMs: number): void {
  cache.set(key, {
    value,
    expiresAt: Date.now() + ttlMs,
  });
}

export function invalidateCachedResource(key: string): void {
  cache.delete(key);
}
