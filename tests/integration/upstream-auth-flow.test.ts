import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { MockUpstreamServer } from '../../src/upstream/mock-upstream-server';
import { UpstreamClient } from '../../src/upstream/upstream-client';
import { PriceProcessor } from '../../src/engine/price-processor';

describe('Upstream Authentication & Subscription Flow', () => {
  let mockServer: MockUpstreamServer;
  const MOCK_PORT = 9123;
  const VALID_KEY = 'test-api-key-123';
  const VALID_SECRET = 'test-secret-456';

  beforeAll(async () => {
    mockServer = new MockUpstreamServer({
      port: MOCK_PORT,
      validApiKey: VALID_KEY,
      validSecret: VALID_SECRET,
      enablePriceFeed: false,
    });
    // Brief pause for socket server listen
    await new Promise((r) => setTimeout(r, 100));
  });

  afterAll(async () => {
    await mockServer.close();
  });

  it('successfully authenticates and subscribes when valid credentials are provided', async () => {
    const processor = new PriceProcessor();
    const client = new UpstreamClient(processor, {
      url: `ws://localhost:${MOCK_PORT}`,
      apiKey: VALID_KEY,
      secretKey: VALID_SECRET,
      initialBackoffMs: 200,
    });

    const authPromise = new Promise<void>((resolve) => {
      client.on('authenticated', () => resolve());
    });

    const subPromise = new Promise<void>((resolve) => {
      client.on('subscribed', (symbols) => {
        expect(symbols.length).toBe(61);
        resolve();
      });
    });

    client.connect();

    await Promise.all([authPromise, subPromise]);
    expect(client.getState()).toBe('AUTHENTICATED');

    client.close();
  });

  it('rejects subscription and reports error when credentials are invalid', async () => {
    const processor = new PriceProcessor();
    const client = new UpstreamClient(processor, {
      url: `ws://localhost:${MOCK_PORT}`,
      apiKey: 'wrong-key',
      secretKey: 'wrong-secret',
      initialBackoffMs: 200,
      maxReconnectAttempts: 1,
    });

    const authErrorPromise = new Promise<Error>((resolve) => {
      client.on('auth_error', (err) => resolve(err));
    });

    client.connect();

    const err = await authErrorPromise;
    expect(err.message).toContain('invalid credentials');
    expect(client.getState()).toBe('FAILED');

    client.close();
  });
});
