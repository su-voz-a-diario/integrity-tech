import { RedisRateLimitStore } from './redis-rate-limit.store';

describe('RedisRateLimitStore', () => {
  const previousNodeEnv = process.env.NODE_ENV;
  const previousStore = process.env.RATE_LIMIT_STORE;

  afterEach(() => {
    process.env.NODE_ENV = previousNodeEnv;
    process.env.RATE_LIMIT_STORE = previousStore;
  });

  it('uses local fallback only when explicitly configured outside production', async () => {
    process.env.NODE_ENV = 'test';
    process.env.RATE_LIMIT_STORE = 'memory';
    const store = new RedisRateLimitStore();

    const first = await store.increment('key-a', 60_000);
    const second = await store.increment('key-a', 60_000);

    expect(first.source).toBe('memory');
    expect(second.count).toBe(2);
  });
});
