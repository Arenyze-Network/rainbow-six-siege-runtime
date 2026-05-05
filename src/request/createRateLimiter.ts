import { R6RuntimeRateLimitError, type RateLimitOptions } from '../types';

interface QueueItem<T> {
  operation: () => Promise<T> | T;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
}

export interface RateLimiter {
  schedule<T>(operation: () => Promise<T> | T): Promise<T>;
}

export function createRateLimiter(options: RateLimitOptions): RateLimiter {
  const maxRequests = Math.floor(options.maxRequests);
  const intervalMs = Math.floor(options.intervalMs);

  if (maxRequests <= 0 || intervalMs <= 0) {
    throw new R6RuntimeRateLimitError('maxRequests and intervalMs must be greater than 0');
  }

  const queue: QueueItem<unknown>[] = [];
  const starts: number[] = [];
  let timer: ReturnType<typeof setTimeout> | undefined;

  function prune(now: number): void {
    while (starts.length > 0 && now - starts[0]! >= intervalMs) {
      starts.shift();
    }
  }

  function scheduleNext(): void {
    if (timer !== undefined || queue.length === 0 || starts.length === 0) {
      return;
    }

    const waitMs = Math.max(0, intervalMs - (Date.now() - starts[0]!));

    timer = setTimeout(() => {
      timer = undefined;
      processQueue();
    }, waitMs);
  }

  function processQueue(): void {
    prune(Date.now());

    while (queue.length > 0 && starts.length < maxRequests) {
      const item = queue.shift()!;
      starts.push(Date.now());

      Promise.resolve()
        .then(item.operation)
        .then(item.resolve, item.reject)
        .finally(() => {
          processQueue();
        });
    }

    scheduleNext();
  }

  return {
    schedule<T>(operation: () => Promise<T> | T): Promise<T> {
      return new Promise<T>((resolve, reject) => {
        queue.push({
          operation,
          resolve: resolve as (value: unknown) => void,
          reject,
        });
        processQueue();
      });
    },
  };
}
