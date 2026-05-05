import { afterEach, describe, expect, it, vi } from 'vitest';
import { createR6Runtime, MemoryCacheAdapter } from '../src';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;

  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });

  return { promise, resolve, reject };
}

afterEach(() => {
  vi.useRealTimers();
});

describe('createR6Runtime', () => {
  it('keeps nested methods from the original client', async () => {
    const client = {
      players: {
        async getPlayerStats(params: { nameOnPlatform: string }) {
          return { name: params.nameOnPlatform };
        },
      },
    };

    const runtime = createR6Runtime(client);

    await expect(runtime.players.getPlayerStats({ nameOnPlatform: 'PlayerName' })).resolves.toEqual({
      name: 'PlayerName',
    });
  });

  it('dedupes two simultaneous equal calls', async () => {
    const pending = deferred<{ ok: boolean }>();
    let calls = 0;

    const client = {
      players: {
        async getPlayerStats() {
          calls += 1;
          return pending.promise;
        },
      },
    };

    const runtime = createR6Runtime(client, { dedupe: true });

    const first = runtime.players.getPlayerStats();
    const second = runtime.players.getPlayerStats();

    await Promise.resolve();

    expect(calls).toBe(1);

    pending.resolve({ ok: true });

    await expect(first).resolves.toEqual({ ok: true });
    await expect(second).resolves.toEqual({ ok: true });
  });

  it('wraps promise-returning methods that are not declared async', async () => {
    let calls = 0;
    const cache = new MemoryCacheAdapter();

    const client = {
      players: {
        getPlayerStats() {
          calls += 1;
          return Promise.resolve({ calls });
        },
      },
    };

    const runtime = createR6Runtime(client, { cache });

    await expect(runtime.players.getPlayerStats()).resolves.toEqual({ calls: 1 });
    await expect(runtime.players.getPlayerStats()).resolves.toEqual({ calls: 1 });
    expect(calls).toBe(1);
  });

  it('calls onError once for a final failed request', async () => {
    const onError = vi.fn();
    const error = { status: 400 };

    const client = {
      players: {
        async getPlayerStats() {
          throw error;
        },
      },
    };

    const runtime = createR6Runtime(client, { onError });

    await expect(runtime.players.getPlayerStats()).rejects.toBe(error);

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({
        path: 'players.getPlayerStats',
        error,
      }),
    );
  });

  it('applies rate limit to each retry attempt', async () => {
    vi.useFakeTimers();

    let calls = 0;

    const client = {
      players: {
        getPlayerStats() {
          calls += 1;

          if (calls === 1) {
            return Promise.reject({ status: 500 });
          }

          return Promise.resolve('ok');
        },
      },
    };

    const runtime = createR6Runtime(client, {
      rateLimit: {
        maxRequests: 1,
        intervalMs: 100,
      },
      retry: {
        retries: 1,
        delayMs: 0,
      },
    });

    const result = runtime.players.getPlayerStats();

    await vi.advanceTimersByTimeAsync(0);
    expect(calls).toBe(1);

    await vi.advanceTimersByTimeAsync(99);
    expect(calls).toBe(1);

    await vi.advanceTimersByTimeAsync(1);

    await expect(result).resolves.toBe('ok');
    expect(calls).toBe(2);
  });

  it('reads from cache before calling the client again', async () => {
    let calls = 0;
    const cache = new MemoryCacheAdapter();

    const client = {
      players: {
        async getPlayerStats() {
          calls += 1;
          return { calls };
        },
      },
    };

    const runtime = createR6Runtime(client, {
      cache,
      ttl: 1000,
    });

    await expect(runtime.players.getPlayerStats()).resolves.toEqual({ calls: 1 });
    await expect(runtime.players.getPlayerStats()).resolves.toEqual({ calls: 1 });
    expect(calls).toBe(1);
  });
});
