import { afterEach, describe, expect, it, vi } from 'vitest';
import { createCacheKey, MemoryCacheAdapter } from '../src';

afterEach(() => {
  vi.useRealTimers();
});

describe('MemoryCacheAdapter', () => {
  it('gets, sets, deletes and clears values', async () => {
    const cache = new MemoryCacheAdapter<string>();

    await cache.set('player:1', 'value');
    expect(await cache.get('player:1')).toBe('value');

    await cache.delete('player:1');
    expect(await cache.get('player:1')).toBeUndefined();

    await cache.set('player:2', 'value');
    await cache.clear();
    expect(await cache.get('player:2')).toBeUndefined();
  });

  it('expires values when ttl passes', async () => {
    vi.useFakeTimers();

    const cache = new MemoryCacheAdapter<string>();

    await cache.set('short', 'value', 100);
    expect(await cache.get('short')).toBe('value');

    await vi.advanceTimersByTimeAsync(101);

    expect(await cache.get('short')).toBeUndefined();
  });
});

describe('createCacheKey', () => {
  it('creates stable keys for object arguments', () => {
    const first = createCacheKey('players.getProfile', [{ b: 2, a: 1 }]);
    const second = createCacheKey('players.getProfile', [{ a: 1, b: 2 }]);

    expect(first).toBe(second);
  });

  it('keeps undefined object properties distinct from missing properties', () => {
    const withUndefined = createCacheKey('game.getMaps', [{ name: undefined }]);
    const withoutProperty = createCacheKey('game.getMaps', [{}]);

    expect(withUndefined).not.toBe(withoutProperty);
  });

  it('creates stable keys for Date, Map and Set arguments', () => {
    const first = createCacheKey('game.getMaps', [
      {
        date: new Date('2026-05-05T00:00:00.000Z'),
        map: new Map<string, number>([
          ['b', 2],
          ['a', 1],
        ]),
        set: new Set([2, 1]),
      },
    ]);
    const second = createCacheKey('game.getMaps', [
      {
        set: new Set([1, 2]),
        map: new Map<string, number>([
          ['a', 1],
          ['b', 2],
        ]),
        date: new Date('2026-05-05T00:00:00.000Z'),
      },
    ]);

    expect(first).toBe(second);
  });

  it('supports repeated object references without falling back', () => {
    const shared = { platformType: 'uplay' };

    expect(createCacheKey('players.getProfile', [shared, shared])).toBe(
      createCacheKey('players.getProfile', [
        { platformType: 'uplay' },
        { platformType: 'uplay' },
      ]),
    );
  });

  it('falls back for unserializable arguments', () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;

    expect(createCacheKey('players.getProfile', [circular])).toBe(
      'players.getProfile:unserializable:object',
    );
  });
});
