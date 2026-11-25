# @arenyze/rainbow-six-siege-runtime

Optional runtime layer for `@arenyze/rainbow-six-siege` with memory caching, request deduplication, retry, timeout and local rate limiting.

<div align="center">
  <p>
    <a href="https://github.com/Arenyze-Network/rainbow-six-siege-runtime/releases/latest">
      <img src="https://img.shields.io/github/v/release/Arenyze-Network/rainbow-six-siege-runtime?style=for-the-badge" alt="GitHub release (latest SemVer)" />
    </a>
    <a href="https://github.com/Arenyze-Network/rainbow-six-siege-runtime/releases/latest">
      <img src="https://img.shields.io/github/release-date/Arenyze-Network/rainbow-six-siege-runtime?label=latest%20release&style=for-the-badge" alt="Latest release" />
    </a>
    <a href="https://www.npmjs.com/package/@arenyze/rainbow-six-siege-runtime">
      <img src="https://img.shields.io/npm/v/@arenyze/rainbow-six-siege-runtime.svg?logo=npm&style=for-the-badge" alt="npm version" />
    </a>
    <a href="https://www.npmjs.com/package/@arenyze/rainbow-six-siege-runtime">
      <img src="https://img.shields.io/npm/dt/@arenyze/rainbow-six-siege-runtime.svg?style=for-the-badge" alt="NPM downloads" />
    </a>
  </p>
</div>

This package does not replace `@arenyze/rainbow-six-siege`. You still create and configure the main `R6Client` yourself, then pass that instance to `createR6Runtime`.

It does not make direct API calls to R6Data and has no runtime dependencies.

## Installation

```sh
npm install @arenyze/rainbow-six-siege @arenyze/rainbow-six-siege-runtime
```

## Basic Usage

```ts
import { R6Client } from '@arenyze/rainbow-six-siege';
import { createR6Runtime } from '@arenyze/rainbow-six-siege-runtime';

const client = new R6Client({ apiKey: process.env.R6_DATA_API_KEY! });
const r6 = createR6Runtime(client);

const profile = await r6.players.getProfile({
  nameOnPlatform: 'PlayerName',
  platformType: 'uplay',
  platform_families: 'pc',
});

console.log(profile.stats);
```

## Memory Cache

```ts
import { R6Client } from '@arenyze/rainbow-six-siege';
import { createR6Runtime, MemoryCacheAdapter } from '@arenyze/rainbow-six-siege-runtime';

const client = new R6Client({ apiKey: process.env.R6_DATA_API_KEY! });

const r6 = createR6Runtime(client, {
  cache: new MemoryCacheAdapter(),
  ttl: 60_000,
});
```

`MemoryCacheAdapter` supports TTL, `delete()` and `clear()`. Expired entries are removed when they are read. It does not use a required `setInterval`.

## Retry And Timeout

```ts
const r6 = createR6Runtime(client, {
  timeout: 10_000,
  retry: {
    retries: 2,
    delayMs: 500,
    retryOn: [408, 429, 500, 502, 503, 504],
  },
});
```

Retry uses a simple backoff: `delayMs * attempt`. Timeout rejects with `R6RuntimeTimeoutError`.

## Local Rate Limit

```ts
const r6 = createR6Runtime(client, {
  rateLimit: {
    maxRequests: 5,
    intervalMs: 1000,
  },
});
```

The rate limiter is an in-memory queue. It limits local execution only; it does not coordinate across multiple processes or servers.

## Custom Cache Adapter

```ts
import type { CacheAdapter } from '@arenyze/rainbow-six-siege-runtime';

class MyCache implements CacheAdapter {
  private values = new Map<string, unknown>();

  get(key: string) {
    return this.values.get(key);
  }

  set(key: string, value: unknown) {
    this.values.set(key, value);
  }

  delete(key: string) {
    this.values.delete(key);
  }

  clear() {
    this.values.clear();
  }
}
```

`@arenyze/rainbow-six-siege-runtime` intentionally does not include Redis, PostgreSQL, MongoDB or other databases. Use `CacheAdapter` if your app needs a custom cache backend.

## Options

```ts
createR6Runtime(client, {
  cache,
  ttl,
  dedupe,
  timeout,
  retry,
  rateLimit,
  cacheKey,
  shouldCache,
  onRequest,
  onResponse,
  onError,
});
```

- `cache`: `CacheAdapter` or `false`. Disabled by default.
- `ttl`: cache TTL in milliseconds.
- `dedupe`: avoids simultaneous duplicate calls with the same method path and args. Enabled by default.
- `timeout`: timeout in milliseconds.
- `retry`: retry settings for configured HTTP status codes.
- `rateLimit`: local queue settings.
- `cacheKey`: custom cache key function.
- `shouldCache`: decide whether a result should be cached.
- `onRequest`, `onResponse`, `onError`: lightweight lifecycle hooks.

## License

MIT
