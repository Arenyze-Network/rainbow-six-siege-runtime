import { createCacheKey } from './cache/createCacheKey';
import { createDedupeManager } from './request/createDedupeManager';
import { createRateLimiter, type RateLimiter } from './request/createRateLimiter';
import { withRetry } from './request/withRetry';
import { withTimeout } from './request/withTimeout';
import type { CacheAdapter, R6RuntimeHookInfo, R6RuntimeOptions } from './types';

type AnyFunction = (...args: unknown[]) => unknown;

function isObject(value: unknown): value is object {
  return typeof value === 'object' && value !== null;
}

function isFunction(value: unknown): value is AnyFunction {
  return typeof value === 'function';
}

async function getFromCache(cache: CacheAdapter | false | undefined, key: string): Promise<unknown | undefined> {
  if (!cache) {
    return undefined;
  }

  return cache.get(key);
}

export function createR6Runtime<TClient extends object>(
  client: TClient,
  options: R6RuntimeOptions = {},
): TClient {
  const dedupe = options.dedupe ?? true;
  const cache = options.cache === undefined ? false : options.cache;
  const cacheKey = options.cacheKey ?? createCacheKey;
  const shouldCache = options.shouldCache ?? (() => true);
  const dedupeManager = createDedupeManager();
  const rateLimiter: RateLimiter | undefined = options.rateLimit
    ? createRateLimiter(options.rateLimit)
    : undefined;
  const proxyCache = new WeakMap<object, unknown>();

  async function executeMethod(
    method: AnyFunction,
    thisArg: unknown,
    path: string,
    args: unknown[],
  ): Promise<unknown> {
    const key = cacheKey(path, args);
    const startedAt = Date.now();
    const cached = await getFromCache(cache, key);

    if (cached !== undefined) {
      options.onResponse?.({
        path,
        args,
        cacheKey: key,
        durationMs: 0,
        fromCache: true,
        result: cached,
      });

      return cached;
    }

    const runRequest = async (): Promise<unknown> => {
      const operation = async (attempt: number): Promise<unknown> => {
        const executeAttempt = (): Promise<unknown> => {
          options.onRequest?.({ path, args, cacheKey: key, attempt });

          const call = Promise.resolve(method.apply(thisArg, args));
          return withTimeout(call, options.timeout);
        };

        return rateLimiter ? rateLimiter.schedule(executeAttempt) : executeAttempt();
      };

      const execute = (): Promise<unknown> => {
        if (options.retry) {
          return withRetry(operation, options.retry);
        }

        return operation(1);
      };

      try {
        const result = await execute();

        if (cache && shouldCache(path, args, result)) {
          await cache.set(key, result, options.ttl);
        }

        const info: R6RuntimeHookInfo = {
          path,
          args,
          cacheKey: key,
          durationMs: Date.now() - startedAt,
          fromCache: false,
          result,
        };

        options.onResponse?.(info);

        return result;
      } catch (error) {
        options.onError?.({ path, args, cacheKey: key, durationMs: Date.now() - startedAt, error });
        throw error;
      }
    };

    return dedupe ? dedupeManager.run(key, runRequest) : runRequest();
  }

  function createProxy<TTarget extends object>(target: TTarget, path: string[]): TTarget {
    const existing = proxyCache.get(target);

    if (existing) {
      return existing as TTarget;
    }

    const proxy = new Proxy(target, {
      get(currentTarget, property, receiver) {
        const value = Reflect.get(currentTarget, property, receiver);

        if (typeof property !== 'string') {
          return value;
        }

        const nextPath = [...path, property];

        if (isFunction(value)) {
          return (...args: unknown[]) => executeMethod(value, currentTarget, nextPath.join('.'), args);
        }

        if (isObject(value)) {
          return createProxy(value, nextPath);
        }

        return value;
      },
    });

    proxyCache.set(target, proxy);

    return proxy;
  }

  return createProxy(client, []);
}
