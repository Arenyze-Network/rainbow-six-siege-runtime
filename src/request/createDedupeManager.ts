export interface DedupeManager {
  run<T>(key: string, operation: () => Promise<T>): Promise<T>;
  clear(): void;
}

export function createDedupeManager(): DedupeManager {
  const pending = new Map<string, Promise<unknown>>();

  return {
    run<T>(key: string, operation: () => Promise<T>): Promise<T> {
      const existing = pending.get(key);

      if (existing) {
        return existing as Promise<T>;
      }

      const promise = operation().finally(() => {
        pending.delete(key);
      });

      pending.set(key, promise);

      return promise;
    },
    clear(): void {
      pending.clear();
    },
  };
}
