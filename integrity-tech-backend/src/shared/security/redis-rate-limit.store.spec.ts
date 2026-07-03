import { RedisRateLimitStore } from './redis-rate-limit.store';
import Redis from 'ioredis';

jest.mock('ioredis', () => ({
  __esModule: true,
  default: jest.fn(),
}));

describe('RedisRateLimitStore', () => {
  const previousNodeEnv = process.env.NODE_ENV;
  const previousStore = process.env.RATE_LIMIT_STORE;
  const previousRedisRequired = process.env.RATE_LIMIT_REDIS_REQUIRED;

  const RedisMock = Redis as unknown as jest.Mock;

  afterEach(() => {
    process.env.NODE_ENV = previousNodeEnv;
    process.env.RATE_LIMIT_STORE = previousStore;
    process.env.RATE_LIMIT_REDIS_REQUIRED = previousRedisRequired;
    RedisMock.mockReset();
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

  it('creates a single persistent Redis client and connects once', async () => {
    process.env.NODE_ENV = 'test';
    process.env.RATE_LIMIT_STORE = 'redis';
    process.env.RATE_LIMIT_REDIS_REQUIRED = 'true';
    const client = buildRedisClient();
    RedisMock.mockReturnValue(client);
    const store = new RedisRateLimitStore();

    await store.increment('key-a', 60_000);
    client.status = 'ready';
    await store.increment('key-b', 60_000);

    expect(RedisMock).toHaveBeenCalledTimes(1);
    expect(client.connect).toHaveBeenCalledTimes(1);
    expect(client.incr).toHaveBeenCalledTimes(2);
  });

  it('waits for the first Redis connection before running increment', async () => {
    process.env.NODE_ENV = 'test';
    process.env.RATE_LIMIT_STORE = 'redis';
    process.env.RATE_LIMIT_REDIS_REQUIRED = 'true';
    const deferred = createDeferred<void>();
    const client = buildRedisClient({
      connect: jest.fn(async () => {
        await deferred.promise;
        client.status = 'ready';
      }),
    });
    RedisMock.mockReturnValue(client);
    const store = new RedisRateLimitStore();

    const incrementPromise = store.increment('key-a', 60_000);
    await Promise.resolve();
    expect(client.incr).not.toHaveBeenCalled();

    deferred.resolve();
    await incrementPromise;

    expect(client.connect).toHaveBeenCalledTimes(1);
    expect(client.incr).toHaveBeenCalledTimes(1);
  });

  it('reuses the same in-flight connection for concurrent increments', async () => {
    process.env.NODE_ENV = 'test';
    process.env.RATE_LIMIT_STORE = 'redis';
    process.env.RATE_LIMIT_REDIS_REQUIRED = 'true';
    const deferred = createDeferred<void>();
    const client = buildRedisClient({
      connect: jest.fn(async () => {
        await deferred.promise;
        client.status = 'ready';
      }),
    });
    RedisMock.mockReturnValue(client);
    const store = new RedisRateLimitStore();

    const first = store.increment('key-a', 60_000);
    const second = store.increment('key-b', 60_000);
    await Promise.resolve();
    deferred.resolve();
    await Promise.all([first, second]);

    expect(RedisMock).toHaveBeenCalledTimes(1);
    expect(client.connect).toHaveBeenCalledTimes(1);
    expect(client.incr).toHaveBeenCalledTimes(2);
  });

  it('propagates real Redis connection failures when Redis is required', async () => {
    process.env.NODE_ENV = 'test';
    process.env.RATE_LIMIT_STORE = 'redis';
    process.env.RATE_LIMIT_REDIS_REQUIRED = 'true';
    const client = buildRedisClient({
      connect: jest.fn().mockRejectedValue(new Error('redis down')),
    });
    RedisMock.mockReturnValue(client);
    const store = new RedisRateLimitStore();

    await expect(store.increment('key-a', 60_000)).rejects.toThrow('redis down');
    expect(client.incr).not.toHaveBeenCalled();
  });

  function buildRedisClient(overrides: Record<string, unknown> = {}) {
    let count = 0;
    return {
      status: 'wait',
      connect: jest.fn(async function (this: any) {
        this.status = 'ready';
      }),
      incr: jest.fn(async () => {
        count += 1;
        return count;
      }),
      pexpire: jest.fn().mockResolvedValue(1),
      pttl: jest.fn().mockResolvedValue(60_000),
      on: jest.fn(),
      disconnect: jest.fn(),
      ...overrides,
    } as any;
  }

  function createDeferred<T>() {
    let resolve!: (value: T | PromiseLike<T>) => void;
    let reject!: (reason?: unknown) => void;
    const promise = new Promise<T>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  }
});
