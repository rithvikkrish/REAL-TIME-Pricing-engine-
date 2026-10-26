import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import WebSocket from 'ws';
import { SubscriptionManager } from '../../src/downstream/subscription-manager';
import { DownstreamPublisher } from '../../src/downstream/publisher';
import { DownstreamWebSocketServer } from '../../src/downstream/websocket-server';
import { PriceProcessor } from '../../src/engine/price-processor';

describe('Downstream WebSocket Server Integration', () => {
  let processor: PriceProcessor;
  let subManager: SubscriptionManager;
  let publisher: DownstreamPublisher;
  let server: DownstreamWebSocketServer;
  const PORT = 9234;

  beforeAll(async () => {
    processor = new PriceProcessor();
    subManager = new SubscriptionManager();
    publisher = new DownstreamPublisher(subManager);
    server = new DownstreamWebSocketServer(subManager, publisher, processor, {
      port: PORT,
      heartbeatIntervalMs: 10000,
    });
    await new Promise((r) => setTimeout(r, 100));
  });

  afterAll(async () => {
    await server.close();
  });

  it('allows clients to subscribe and receive instant snapshots', async () => {
    // Prime the processor with an initial tick
    processor.processRawTick({
      symbol: 'EURUSD',
      buy: 1.085,
      sell: 1.0852,
      timestamp: Date.now(),
    });

    const client = new WebSocket(`ws://localhost:${PORT}`);
    const receivedMessages: any[] = [];

    await new Promise<void>((resolve) => {
      client.on('open', () => {
        client.send(
          JSON.stringify({
            action: 'subscribe',
            symbols: ['EURUSD'],
          })
        );
      });

      client.on('message', (raw) => {
        const msg = JSON.parse(raw.toString());
        receivedMessages.push(msg);

        // Expect 'subscribed' ack followed by 'snapshot'
        if (receivedMessages.length >= 2) {
          resolve();
        }
      });
    });

    const subAck = receivedMessages.find((m) => m.type === 'subscribed');
    expect(subAck).toBeDefined();
    expect(subAck.symbols).toContain('EURUSD');

    const snapshot = receivedMessages.find((m) => m.type === 'snapshot');
    expect(snapshot).toBeDefined();
    expect(snapshot.data.length).toBe(1);
    expect(snapshot.data[0].symbol).toBe('EURUSD');
    expect(snapshot.data[0].buy).toBe(1.085);

    client.close();
  });

  it('broadcasts real-time price updates only to interested subscribers', async () => {
    const clientEUR = new WebSocket(`ws://localhost:${PORT}`);
    const clientBTC = new WebSocket(`ws://localhost:${PORT}`);

    const eurMessages: any[] = [];
    const btcMessages: any[] = [];

    await Promise.all([
      new Promise<void>((resolve) => {
        clientEUR.on('open', () => {
          clientEUR.send(JSON.stringify({ action: 'subscribe', symbols: ['EURUSD'] }));
          resolve();
        });
      }),
      new Promise<void>((resolve) => {
        clientBTC.on('open', () => {
          clientBTC.send(JSON.stringify({ action: 'subscribe', symbols: ['BTCUSD'] }));
          resolve();
        });
      }),
    ]);

    // Attach listeners
    clientEUR.on('message', (raw) => {
      eurMessages.push(JSON.parse(raw.toString()));
    });
    clientBTC.on('message', (raw) => {
      btcMessages.push(JSON.parse(raw.toString()));
    });

    // Wait for subscription handshake
    await new Promise((r) => setTimeout(r, 100));

    // Process EURUSD update
    const update = processor.processRawTick({
      symbol: 'EURUSD',
      buy: 1.086,
      sell: 1.0862,
      timestamp: Date.now(),
    });
    publisher.broadcastUpdate(update!);

    await new Promise((r) => setTimeout(r, 100));

    // Verify EUR client received price update
    const eurPriceUpdate = eurMessages.find((m) => m.type === 'price_update');
    expect(eurPriceUpdate).toBeDefined();
    expect(eurPriceUpdate.data.symbol).toBe('EURUSD');
    expect(eurPriceUpdate.data.buy).toBe(1.086);

    // Verify BTC client did NOT receive EURUSD update
    const btcUnexpectedUpdate = btcMessages.find(
      (m) => m.type === 'price_update' && m.data?.symbol === 'EURUSD'
    );
    expect(btcUnexpectedUpdate).toBeUndefined();

    clientEUR.close();
    clientBTC.close();
  });
});
