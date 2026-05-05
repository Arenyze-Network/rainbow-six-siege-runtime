import type { CacheAdapter } from './CacheAdapter';

interface CacheEntry<T> {
  value: T;
  expiresAt?: number;
}

export class MemoryCacheAdapter<T = unknown> implements CacheAdapter<T> {
  private readonly entries = new Map<string, CacheEntry<T>>();

  get(key: string): T | undefined {
    const entry = this.entries.get(key);

    if (!entry) {
      return undefined;
    }

    if (entry.expiresAt !== undefined && entry.expiresAt <= Date.now()) {
      this.entries.delete(key);
      return undefined;
    }

    return entry.value;
  }

  set(key: string, value: T, ttl?: number): void {
    const expiresAt = typeof ttl === 'number' && ttl > 0 ? Date.now() + ttl : undefined;

    this.entries.set(key, expiresAt === undefined ? { value } : { value, expiresAt });
  }

  delete(key: string): void {
    this.entries.delete(key);
  }

  clear(): void {
    this.entries.clear();
  }
}
