export interface CacheAdapter<T = unknown> {
  get(key: string): Promise<T | undefined> | T | undefined;
  set(key: string, value: T, ttl?: number): Promise<void> | void;
  delete(key: string): Promise<void> | void;
  clear?(): Promise<void> | void;
}
