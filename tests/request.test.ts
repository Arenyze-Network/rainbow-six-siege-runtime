import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createRateLimiter,
  R6RuntimeTimeoutError,
  withRetry,
  withTimeout,
} from '../src';

afterEach(() => {
  vi.useRealTimers();
});

describe('withRetry', () => {
  it('retries configured status errors and then resolves', async () => {
    let calls = 0;

    const result = await withRetry(
      async () => {
        calls += 1;

        if (calls === 1) {
          throw { response: { status: 500 } };
        }

        return 'ok';
      },
      { retries: 1, delayMs: 1 },
    );

    expect(result).toBe('ok');
    expect(calls).toBe(2);
  });

  it('does not retry non-configured status errors', async () => {
    let calls = 0;

    await expect(
      withRetry(
        async () => {
          calls += 1;
          throw { status: 400 };
        },
        { retries: 2, delayMs: 1 },
      ),
    ).rejects.toEqual({ status: 400 });

    expect(calls).toBe(1);
  });
});

describe('withTimeout', () => {
  it('rejects when the promise takes too long', async () => {
    vi.useFakeTimers();

    const promise = withTimeout(
      new Promise((resolve) => {
        setTimeout(() => resolve('late'), 100);
      }),
      50,
    );
    const expectation = expect(promise).rejects.toBeInstanceOf(R6RuntimeTimeoutError);

    await vi.advanceTimersByTimeAsync(51);

    await expectation;
  });
});

describe('createRateLimiter', () => {
  it('limits execution to maxRequests per interval', async () => {
    vi.useFakeTimers();

    const limiter = createRateLimiter({ maxRequests: 1, intervalMs: 100 });
    const order: number[] = [];

    const first = limiter.schedule(() => {
      order.push(1);
      return 1;
    });
    const second = limiter.schedule(() => {
      order.push(2);
      return 2;
    });

    await expect(first).resolves.toBe(1);
    expect(order).toEqual([1]);

    await vi.advanceTimersByTimeAsync(99);
    expect(order).toEqual([1]);

    await vi.advanceTimersByTimeAsync(1);

    await expect(second).resolves.toBe(2);
    expect(order).toEqual([1, 2]);
  });
});
