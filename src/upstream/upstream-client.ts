import WebSocket, { RawData } from 'ws';
import { EventEmitter } from 'events';
import { REQUIRED_SYMBOLS } from '../config/symbols';
import { MessageParser } from '../ingestion/parser';
import { PriceProcessor } from '../engine/price-processor';
import {
  upstreamConnectionStatus,
  upstreamAuthTotal,
  upstreamReconnectionsTotal,
  payloadSizeBytes,
} from '../metrics/prometheus';
import { logger } from '../utils/logger';

export interface UpstreamClientOptions {
  url: string;
  apiKey?: string;
  secretKey?: string;
  initialBackoffMs?: number;
  maxBackoffMs?: number;
  backoffFactor?: number;
  maxReconnectAttempts?: number;
  watchdogIntervalMs?: number;
}

export type ConnectionState = 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED' | 'AUTHENTICATING' | 'AUTHENTICATED' | 'FAILED';

export class UpstreamClient extends EventEmitter {
  private url: string;
  private apiKey: string;
  private secretKey: string;
  private ws: WebSocket | null = null;
  private state: ConnectionState = 'DISCONNECTED';
  private reconnectAttempts = 0;
  private maxReconnectAttempts: number;
  private initialBackoffMs: number;
  private maxBackoffMs: number;
  private backoffFactor: number;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private watchdogTimer: NodeJS.Timeout | null = null;
  private watchdogIntervalMs: number;
  private parser: MessageParser;
  private isExplicitlyClosed = false;

  constructor(
    private processor: PriceProcessor,
    options: UpstreamClientOptions
  ) {
    super();
    this.url = options.url;
    this.apiKey = options.apiKey || '';
    this.secretKey = options.secretKey || '';
    this.initialBackoffMs = options.initialBackoffMs || 1000;
    this.maxBackoffMs = options.maxBackoffMs || 30000;
    this.backoffFactor = options.backoffFactor || 1.5;
    this.maxReconnectAttempts = options.maxReconnectAttempts || 50;
    this.watchdogIntervalMs = options.watchdogIntervalMs || 30000;
    this.parser = new MessageParser();
  }

  public connect(): void {
    if (this.state === 'CONNECTING' || this.state === 'CONNECTED' || this.state === 'AUTHENTICATED') {
      return;
    }

    this.isExplicitlyClosed = false;
    this.setState('CONNECTING');
    logger.info({ url: this.url }, 'Connecting to upstream market feed...');

    try {
      this.ws = new WebSocket(this.url, {
        handshakeTimeout: 10000,
      });

      this.ws.on('open', () => this.handleOpen());
      this.ws.on('message', (data: RawData) => this.handleMessage(data));
      this.ws.on('close', (code: number, reason: Buffer) => this.handleClose(code, reason.toString()));
      this.ws.on('error', (err: Error) => this.handleError(err));
      this.ws.on('pong', () => this.resetWatchdog());
    } catch (err) {
      this.handleError(err as Error);
    }
  }

  private handleOpen(): void {
    logger.info('Connected to upstream WebSocket endpoint');
    this.setState('CONNECTED');
    this.reconnectAttempts = 0;
    upstreamConnectionStatus.set(1);
    this.startWatchdog();

    // Authenticate immediately upon connection
    this.authenticate();
  }

  private authenticate(): void {
    if (!this.apiKey || !this.secretKey) {
      logger.error('Cannot authenticate: UPSTREAM_API_KEY or UPSTREAM_SECRET_KEY is missing');
      this.setState('FAILED');
      this.emit('auth_error', new Error('Missing API credentials'));
      return;
    }

    this.setState('AUTHENTICATING');
    logger.info('Sending upstream authentication handshake...');

    const authPayload = {
      action: 'auth',
      api_key: this.apiKey,
      secret: this.secretKey,
    };

    this.send(authPayload);
  }

  private subscribeToMarkets(): void {
    logger.info({ symbolCount: REQUIRED_SYMBOLS.length }, 'Subscribing to required market symbols...');
    const subPayload = {
      action: 'subscribeMarketPrice',
      symbols: [...REQUIRED_SYMBOLS],
    };
    this.send(subPayload);
    this.emit('subscribed', REQUIRED_SYMBOLS);
  }

  private handleMessage(data: RawData): void {
    this.resetWatchdog();
    const receiveTimestamp = Date.now();

    const parseResult = this.parser.parse(data);
    payloadSizeBytes.observe({ direction: 'upstream' }, parseResult.rawSizeBytes);

    if (!parseResult.success) {
      logger.warn({ error: parseResult.error }, 'Failed to parse incoming upstream message');
      return;
    }

    // Handle authentication / control responses
    if (parseResult.isControlMessage && parseResult.controlData) {
      const c = parseResult.controlData;

      // Check for auth error
      if (c.event === 'error' || c.status === 'error' || c.status === 'failed') {
        const errorMsg = String(c.message || 'Authentication failed');
        logger.error({ error: errorMsg }, 'Upstream authentication rejected by server');
        upstreamAuthTotal.inc({ status: 'failure' });
        this.setState('FAILED');
        this.emit('auth_error', new Error(errorMsg));
        return;
      }

      // Check for auth success
      if (
        c.event === 'auth_success' ||
        c.event === 'authenticated' ||
        c.status === 'success' ||
        c.action === 'auth' ||
        (c.event === 'info' && String(c.message).toLowerCase().includes('success'))
      ) {
        logger.info('Upstream authentication succeeded');
        upstreamAuthTotal.inc({ status: 'success' });
        this.setState('AUTHENTICATED');
        upstreamConnectionStatus.set(2);
        this.emit('authenticated');
        this.subscribeToMarkets();
        return;
      }
    }

    // Process market data ticks
    if (parseResult.ticks && parseResult.ticks.length > 0) {
      for (const rawTick of parseResult.ticks) {
        this.processor.processRawTick(rawTick, receiveTimestamp);
      }
    }
  }

  private handleClose(code: number, reason: string): void {
    logger.warn({ code, reason }, 'Upstream connection closed');
    this.cleanupSocket();
    this.setState('DISCONNECTED');
    upstreamConnectionStatus.set(0);
    this.emit('disconnected', { code, reason });

    // Handle auth failure code (e.g. 4003 invalid credentials)
    if (code === 4003 || reason.toLowerCase().includes('invalid credentials')) {
      logger.error('Upstream closed connection with invalid credentials (4003). Bounded retry will wait.');
      upstreamAuthTotal.inc({ status: 'failure' });
      this.setState('FAILED');
    }

    if (!this.isExplicitlyClosed) {
      this.scheduleReconnect();
    }
  }

  private handleError(err: Error): void {
    logger.warn({ err: err.message }, 'Upstream WebSocket client error');
    this.emit('error', err);
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      logger.error('Maximum upstream reconnection attempts reached. Entering degraded mode.');
      this.setState('FAILED');
      return;
    }

    this.reconnectAttempts++;
    upstreamReconnectionsTotal.inc();

    // Exponential backoff with jitter
    const backoff = Math.min(
      this.initialBackoffMs * Math.pow(this.backoffFactor, this.reconnectAttempts - 1),
      this.maxBackoffMs
    );
    const jitter = backoff * (0.8 + Math.random() * 0.4);

    logger.info(
      { attempt: this.reconnectAttempts, backoffMs: Math.round(jitter) },
      'Scheduling upstream reconnection attempt...'
    );

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, jitter);
  }

  private send(payload: unknown): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const serialized = JSON.stringify(payload);
      this.ws.send(serialized);
    } else {
      logger.warn('Cannot send payload: WebSocket is not open');
    }
  }

  private startWatchdog(): void {
    this.resetWatchdog();
  }

  private resetWatchdog(): void {
    if (this.watchdogTimer) {
      clearTimeout(this.watchdogTimer);
    }
    this.watchdogTimer = setTimeout(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        logger.debug('Watchdog timeout: sending heartbeat ping to upstream');
        this.ws.ping();
      }
    }, this.watchdogIntervalMs);
  }

  private cleanupSocket(): void {
    if (this.watchdogTimer) {
      clearTimeout(this.watchdogTimer);
      this.watchdogTimer = null;
    }
    if (this.ws) {
      this.ws.removeAllListeners();
      this.ws = null;
    }
  }

  private setState(newState: ConnectionState): void {
    this.state = newState;
    this.emit('state_change', newState);
  }

  public getState(): ConnectionState {
    return this.state;
  }

  public close(): void {
    this.isExplicitlyClosed = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.cleanupSocket();
    if (this.ws) {
      this.ws.close();
    }
    this.setState('DISCONNECTED');
    upstreamConnectionStatus.set(0);
  }
}
