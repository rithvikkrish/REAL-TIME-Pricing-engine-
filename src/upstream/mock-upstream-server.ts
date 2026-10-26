import WebSocket, { WebSocketServer, RawData } from 'ws';
import { REQUIRED_SYMBOLS } from '../config/symbols';

export interface MockUpstreamOptions {
  port: number;
  validApiKey?: string;
  validSecret?: string;
  tickIntervalMs?: number;
  enablePriceFeed?: boolean;
}

export class MockUpstreamServer {
  private wss: WebSocketServer;
  private validApiKey: string;
  private validSecret: string;
  private tickInterval: NodeJS.Timeout | null = null;
  private clients: Set<WebSocket> = new Set();
  private basePrices: Map<string, number> = new Map();

  constructor(options: MockUpstreamOptions) {
    this.validApiKey = options.validApiKey || 'test-api-key';
    this.validSecret = options.validSecret || 'test-secret-key';

    this.initBasePrices();

    this.wss = new WebSocketServer({ port: options.port });

    this.wss.on('connection', (socket: WebSocket) => {
      let isAuthenticated = false;
      this.clients.add(socket);

      socket.on('message', (raw: RawData) => {
        try {
          const msg = JSON.parse(raw.toString('utf8'));

          if (msg.action === 'auth') {
            if (msg.api_key === this.validApiKey && msg.secret === this.validSecret) {
              isAuthenticated = true;
              socket.send(JSON.stringify({ event: 'auth_success', message: 'Authenticated successfully' }));
            } else {
              socket.send(JSON.stringify({ event: 'error', message: 'invalid credentials' }));
              socket.close(4003, 'invalid credentials');
            }
            return;
          }

          if (msg.action === 'subscribeMarketPrice') {
            if (!isAuthenticated) {
              socket.send(JSON.stringify({ event: 'error', message: 'Unauthorized. Authenticate first.' }));
              socket.close(4001, 'Unauthorized');
              return;
            }

            socket.send(JSON.stringify({ event: 'subscribed', symbols: msg.symbols }));

            if (options.enablePriceFeed !== false && !this.tickInterval) {
              this.startFeed(options.tickIntervalMs || 50);
            }
          }
        } catch {
          socket.send(JSON.stringify({ event: 'error', message: 'Invalid payload' }));
        }
      });

      socket.on('close', () => {
        this.clients.delete(socket);
        if (this.clients.size === 0 && this.tickInterval) {
          clearInterval(this.tickInterval);
          this.tickInterval = null;
        }
      });
    });
  }

  private initBasePrices(): void {
    const defaults: Record<string, number> = {
      EURUSD: 1.085,
      GBPUSD: 1.295,
      USDJPY: 154.2,
      AUDUSD: 0.655,
      BTCUSD: 67500,
      ETHUSD: 3450,
      SOLUSD: 175,
      XAUUSD: 2380,
      XAGUSD: 30.5,
    };

    for (const sym of REQUIRED_SYMBOLS) {
      this.basePrices.set(sym, defaults[sym] || (sym.includes('JPY') ? 110.0 : 1.25));
    }
  }

  private startFeed(intervalMs: number): void {
    let tickCounter = 0;
    this.tickInterval = setInterval(() => {
      tickCounter++;
      // Pick random symbol from symbols
      const symbol = REQUIRED_SYMBOLS[tickCounter % REQUIRED_SYMBOLS.length];
      const base = this.basePrices.get(symbol) || 100;
      const spread = base * 0.0002;
      const noise = (Math.random() - 0.5) * (base * 0.001);
      const currentMid = base + noise;

      const buy = Math.round((currentMid - spread / 2) * 100000) / 100000;
      const sell = Math.round((currentMid + spread / 2) * 100000) / 100000;

      const tick = {
        symbol,
        buy,
        sell,
        low_24h: buy * 0.98, // To be ignored by assignment requirement
        high_24h: sell * 1.02, // To be ignored
        change_24h: 0.5, // To be ignored
        timestamp: Date.now(),
      };

      this.broadcast(tick);
    }, intervalMs);
  }

  public broadcast(payload: unknown): void {
    const serialized = JSON.stringify(payload);
    for (const client of this.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(serialized);
      }
    }
  }

  public close(): Promise<void> {
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }
    for (const c of this.clients) {
      c.terminate();
    }
    return new Promise((resolve) => {
      this.wss.close(() => resolve());
    });
  }
}
