interface CacheEntry {
  expiresAt: number;
  answers: unknown[];
}

const store = new Map<string, CacheEntry>();

function key(name: string, type: string): string {
  return `${name.toLowerCase()}|${type}`;
}

export function getCached(name: string, type: string): unknown[] | undefined {
  const entry = store.get(key(name, type));
  if (!entry) return undefined;
  if (entry.expiresAt <= Date.now()) {
    store.delete(key(name, type));
    return undefined;
  }
  return entry.answers;
}

export function setCached(name: string, type: string, answers: unknown[], ttlSeconds: number): void {
  if (ttlSeconds <= 0 || answers.length === 0) return;
  store.set(key(name, type), {
    expiresAt: Date.now() + ttlSeconds * 1000,
    answers,
  });
}

export function cacheSize(): number {
  return store.size;
}
