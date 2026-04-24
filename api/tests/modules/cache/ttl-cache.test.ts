import { describe, expect, it } from 'vitest';
import { createTtlCache } from '../../../src/modules/cache/ttl-cache.js';

function makeClock(initial = 0) {
  let now = initial;
  return {
    clock: () => now,
    advance(ms: number) {
      now += ms;
    },
  };
}

describe('createTtlCache', () => {
  it('stores and retrieves a value within the TTL window', () => {
    const { clock } = makeClock();
    const cache = createTtlCache<string>({ ttlMs: 1000, clock });
    cache.set('k', 'v');
    expect(cache.get('k')).toBe('v');
  });

  it('returns null after the TTL expires', () => {
    const c = makeClock();
    const cache = createTtlCache<string>({ ttlMs: 1000, clock: c.clock });
    cache.set('k', 'v');
    c.advance(1001);
    expect(cache.get('k')).toBeNull();
  });

  it('refreshes the TTL when a key is re-set', () => {
    const c = makeClock();
    const cache = createTtlCache<string>({ ttlMs: 1000, clock: c.clock });
    cache.set('k', 'v1');
    c.advance(800);
    cache.set('k', 'v2');
    c.advance(500);
    expect(cache.get('k')).toBe('v2');
  });

  it('returns null for an unknown key', () => {
    const cache = createTtlCache<string>({ ttlMs: 1000 });
    expect(cache.get('missing')).toBeNull();
  });

  it('delete removes a key', () => {
    const cache = createTtlCache<string>({ ttlMs: 1000 });
    cache.set('k', 'v');
    cache.delete('k');
    expect(cache.get('k')).toBeNull();
  });

  it('clear empties the cache', () => {
    const cache = createTtlCache<string>({ ttlMs: 1000 });
    cache.set('a', '1');
    cache.set('b', '2');
    cache.clear();
    expect(cache.size()).toBe(0);
  });

  it('evicts oldest entry when maxEntries is reached', () => {
    const c = makeClock();
    const cache = createTtlCache<string>({ ttlMs: 1_000_000, clock: c.clock, maxEntries: 2 });
    cache.set('a', '1');
    cache.set('b', '2');
    cache.set('c', '3'); // should evict 'a'
    expect(cache.get('a')).toBeNull();
    expect(cache.get('b')).toBe('2');
    expect(cache.get('c')).toBe('3');
  });

  it('evicts expired entries before falling back to oldest eviction', () => {
    const c = makeClock();
    const cache = createTtlCache<string>({ ttlMs: 500, clock: c.clock, maxEntries: 2 });
    cache.set('a', '1');
    c.advance(600); // 'a' expired
    cache.set('b', '2');
    cache.set('c', '3'); // 'a' gets evicted via expired sweep, not via oldest
    expect(cache.get('b')).toBe('2');
    expect(cache.get('c')).toBe('3');
  });
});
