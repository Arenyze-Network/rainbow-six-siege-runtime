import type { CacheAdapter } from './cache/CacheAdapter';

export type { CacheAdapter } from './cache/CacheAdapter';

export interface RetryOptions {
  retries?: number;
  delayMs?: number;
  retryOn?: number[];
}

export interface RateLimitOptions {
  maxRequests: number;
  intervalMs: number;
}

export interface R6RuntimeHookInfo {
  path: string;
  args: unknown[];
  cacheKey: string;
  durationMs?: number;
  fromCache?: boolean;
  attempt?: number;
  result?: unknown;
  error?: unknown;
}

export interface R6RuntimeOptions {
  cache?: CacheAdapter | false;
  ttl?: number;
  dedupe?: boolean;
  timeout?: number;
  retry?: RetryOptions;
  rateLimit?: RateLimitOptions;
  cacheKey?: (path: string, args: unknown[]) => string;
  shouldCache?: (path: string, args: unknown[], result: unknown) => boolean;
  onRequest?: (info: R6RuntimeHookInfo) => void;
  onResponse?: (info: R6RuntimeHookInfo) => void;
  onError?: (info: R6RuntimeHookInfo) => void;
}

export class R6RuntimeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'R6RuntimeError';
  }
}

export class R6RuntimeTimeoutError extends R6RuntimeError {
  constructor(timeout: number) {
    super(`R6 runtime request timed out after ${timeout}ms`);
    this.name = 'R6RuntimeTimeoutError';
  }
}

export class R6RuntimeRateLimitError extends R6RuntimeError {
  constructor(message = 'Invalid R6 runtime rate limit configuration') {
    super(message);
    this.name = 'R6RuntimeRateLimitError';
  }
}
