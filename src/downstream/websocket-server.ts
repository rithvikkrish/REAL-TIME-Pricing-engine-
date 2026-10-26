import WebSocket, { WebSocketServer, RawData } from 'ws';
import { Server as HttpServer } from 'http';
import { SubscriptionManager } from './subscription-manager';
import { DownstreamPublisher } from './publisher';
import { PriceProcessor } from '../engine/price-processor';
import { DownstreamClientMessage, DownstreamErrorMessage, DownstreamAckMessage, DownstreamSnapshotMessage } from '../types/protocol';
import { logger } from '../utils/logger';

interface ExtendedWebSocket extends WebSocket {
  isAlive: boolean;
  rateLimitTokens: number;
  lastTokenRefill: number;
}

export interface DownstreamServerOptions {
  server?: HttpServer;
  port?: number;
  rateLimitPerSec?: number;
  heartbeatIntervalMs?: number;
}

export class DownstreamWebSocketServer {
  private wss: WebSocketServer;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private rateLimitPerSec: number;

  constructor(
    private subscriptionManager: SubscriptionManager,
    private publisher: DownstreamPublisher,
    private processor: PriceProcessor,
    options: DownstreamServerOptions = {}
  ) {
    this.rateLimitPerSec = options.rateLimitPerSec || 50;

    if (options.server) {
      this.wss = new WebSocketServer({
        server: options.server,
        path: '/ws',
        perMessageDeflate: {
          zlibDeflateOptions: { level: 6 },
          threshold: 1024, // Deflate payloads > 1KB
        },
      });
    } else {
      this.wss = new WebSocketServer({
        port: options.port || 8080,
        perMessageDeflate: {
          zlibDeflateOptions: { level: 6 },
          threshold: 1024,
        },
      });
    }

    this.setupServer();
    this.startHeartbeat(options.heartbeatIntervalMs || 30000);
  }

  private setupServer(): void {
    this.wss.on('connection', (socket: WebSocket) => {
      const extSocket = socket as ExtendedWebSocket;
      extSocket.isAlive = true;
      extSocket.rateLimitTokens = this.rateLimitPerSec;
      extSocket.lastTokenRefill = Date.now();

      this.subscriptionManager.registerClient(socket);
      logger.debug('New downstream client connected');

      extSocket.on('pong', () => {
        extSocket.isAlive = true;
      });

      extSocket.on('message', (data: RawData) => {
        this.handleClientMessage(extSocket, data);
      });

      extSocket.on('close', () => {
        this.subscriptionManager.removeClient(socket);
        logger.debug('Downstream client disconnected');
      });

      extSocket.on('error', (err) => {
        logger.warn({ err: err.message }, 'Downstream client socket error');
        this.subscriptionManager.removeClient(socket);
      });
    });
  }

  private handleClientMessage(socket: ExtendedWebSocket, raw: RawData): void {
    // 1. Rate Limiting Check
    const now = Date.now();
    const elapsed = (now - socket.lastTokenRefill) / 1000;
    socket.rateLimitTokens = Math.min(this.rateLimitPerSec, socket.rateLimitTokens + elapsed * this.rateLimitPerSec);
    socket.lastTokenRefill = now;

    if (socket.rateLimitTokens < 1) {
      const err: DownstreamErrorMessage = {
        type: 'error',
        message: 'Rate limit exceeded. Please throttle subscription requests.',
        code: 'RATE_LIMIT_EXCEEDED',
        timestamp: now,
      };
      this.publisher.sendToClient(socket, err);
      return;
    }
    socket.rateLimitTokens -= 1;

    // 2. Parse & Validate
    let msg: DownstreamClientMessage;
    try {
      msg = JSON.parse(raw.toString('utf8'));
    } catch {
      const err: DownstreamErrorMessage = {
        type: 'error',
        message: 'Malformed JSON payload',
        code: 'INVALID_JSON',
        timestamp: now,
      };
      this.publisher.sendToClient(socket, err);
      return;
    }

    if (!msg || typeof msg.action !== 'string') {
      const err: DownstreamErrorMessage = {
        type: 'error',
        message: 'Action field is required (subscribe, unsubscribe, ping)',
        code: 'INVALID_ACTION',
        timestamp: now,
      };
      this.publisher.sendToClient(socket, err);
      return;
    }

    switch (msg.action) {
      case 'subscribe': {
        if (!Array.isArray(msg.symbols) || msg.symbols.length === 0) {
          const err: DownstreamErrorMessage = {
            type: 'error',
            message: 'Symbols array is required for subscribe action',
            code: 'INVALID_SYMBOLS',
            timestamp: now,
            requestId: msg.requestId,
          };
          this.publisher.sendToClient(socket, err);
          return;
        }

        const { valid, invalid } = this.subscriptionManager.subscribe(socket, msg.symbols);

        const ack: DownstreamAckMessage = {
          type: 'subscribed',
          symbols: valid,
          requestId: msg.requestId,
          timestamp: now,
        };
        this.publisher.sendToClient(socket, ack);

        // Immediately send latest snapshots for subscribed symbols
        const snapshots = valid
          .map((sym) => this.processor.getSnapshot(sym))
          .filter((s): s is NonNullable<typeof s> => s !== undefined);

        if (snapshots.length > 0) {
          const snapMsg: DownstreamSnapshotMessage = {
            type: 'snapshot',
            data: snapshots,
            timestamp: now,
          };
          this.publisher.sendToClient(socket, snapMsg);
        }

        if (invalid.length > 0) {
          const warn: DownstreamErrorMessage = {
            type: 'error',
            message: `Unsupported or invalid symbols ignored: ${invalid.join(', ')}`,
            code: 'UNKNOWN_SYMBOLS',
            timestamp: now,
          };
          this.publisher.sendToClient(socket, warn);
        }
        break;
      }

      case 'unsubscribe': {
        if (!Array.isArray(msg.symbols)) {
          const err: DownstreamErrorMessage = {
            type: 'error',
            message: 'Symbols array is required for unsubscribe action',
            code: 'INVALID_SYMBOLS',
            timestamp: now,
            requestId: msg.requestId,
          };
          this.publisher.sendToClient(socket, err);
          return;
        }

        const removed = this.subscriptionManager.unsubscribe(socket, msg.symbols);
        const ack: DownstreamAckMessage = {
          type: 'unsubscribed',
          symbols: removed,
          requestId: msg.requestId,
          timestamp: now,
        };
        this.publisher.sendToClient(socket, ack);
        break;
      }

      case 'ping': {
        const pong: DownstreamAckMessage = {
          type: 'pong',
          requestId: msg.requestId,
          timestamp: now,
        };
        this.publisher.sendToClient(socket, pong);
        break;
      }

      default: {
        const err: DownstreamErrorMessage = {
          type: 'error',
          message: `Unknown action: ${(msg as any).action}`,
          code: 'UNKNOWN_ACTION',
          timestamp: now,
        };
        this.publisher.sendToClient(socket, err);
      }
    }
  }

  private startHeartbeat(intervalMs: number): void {
    this.heartbeatInterval = setInterval(() => {
      for (const client of this.wss.clients) {
        const ext = client as ExtendedWebSocket;
        if (!ext.isAlive) {
          logger.debug('Terminating inactive downstream client (failed ping)');
          this.subscriptionManager.removeClient(client);
          client.terminate();
          continue;
        }
        ext.isAlive = false;
        client.ping();
      }
    }, intervalMs);
  }

  public getClientCount(): number {
    return this.wss.clients.size;
  }

  public close(): Promise<void> {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    return new Promise((resolve) => {
      this.wss.close(() => resolve());
    });
  }
}
