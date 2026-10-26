import WebSocket from 'ws';
import { NormalizedPriceUpdate } from '../types/market';
import { DownstreamPriceUpdateMessage } from '../types/protocol';
import { SubscriptionManager } from './subscription-manager';
import { payloadSizeBytes } from '../metrics/prometheus';
import { logger } from '../utils/logger';

export interface PublisherOptions {
  maxPayloadBytes?: number;
  maxBufferedAmount?: number;
}

export class DownstreamPublisher {
  private maxPayloadBytes: number;
  private maxBufferedAmount: number;

  constructor(
    private subscriptionManager: SubscriptionManager,
    options: PublisherOptions = {}
  ) {
    this.maxPayloadBytes = options.maxPayloadBytes || 10 * 1024; // 10 KB
    this.maxBufferedAmount = options.maxBufferedAmount || 1024 * 1024; // 1 MB
  }

  /**
   * Broadcasts normalized price update to all interested subscribers.
   */
  public broadcastUpdate(update: NormalizedPriceUpdate): void {
    const clients = this.subscriptionManager.getSubscribersForSymbol(update.symbol);
    if (!clients || clients.size === 0) {
      return;
    }

    const message: DownstreamPriceUpdateMessage = {
      type: 'price_update',
      timestamp: Date.now(),
      data: {
        symbol: update.symbol,
        buy: update.buy,
        sell: update.sell,
        midpoint: update.midpoint,
        high_24h: update.high24h,
        low_24h: update.low24h,
        change_24h: update.change24h,
        timestamp: update.sourceTimestamp,
      },
    };

    const serialized = JSON.stringify(message);
    const byteLength = Buffer.byteLength(serialized, 'utf8');

    // Record outbound payload size
    payloadSizeBytes.observe({ direction: 'downstream' }, byteLength);

    // Enforce 10 KB outbound requirement
    if (byteLength > this.maxPayloadBytes) {
      logger.error(
        { symbol: update.symbol, byteLength, max: this.maxPayloadBytes },
        'Downstream payload exceeded maximum allowed size of 10 KB'
      );
      return;
    }

    for (const client of clients) {
      if (client.readyState === WebSocket.OPEN) {
        // Backpressure check: avoid buffering excessively on slow consumers
        if (client.bufferedAmount > this.maxBufferedAmount) {
          logger.warn(
            { bufferedAmount: client.bufferedAmount, max: this.maxBufferedAmount },
            'Client socket buffer full, dropping tick for slow client'
          );
          continue;
        }

        try {
          client.send(serialized);
        } catch (err) {
          logger.warn({ err: (err as Error).message }, 'Failed to send price update to client');
        }
      }
    }
  }

  /**
   * Sends a targeted message to a single client (e.g. initial snapshot, error, ack).
   */
  public sendToClient(client: WebSocket, payload: unknown): void {
    if (client.readyState !== WebSocket.OPEN) return;

    const serialized = typeof payload === 'string' ? payload : JSON.stringify(payload);
    const byteLength = Buffer.byteLength(serialized, 'utf8');
    payloadSizeBytes.observe({ direction: 'downstream' }, byteLength);

    if (byteLength > this.maxPayloadBytes) {
      logger.error({ byteLength, max: this.maxPayloadBytes }, 'Direct message exceeded 10 KB limit');
      return;
    }

    try {
      client.send(serialized);
    } catch (err) {
      logger.warn({ err: (err as Error).message }, 'Failed to send direct message to client');
    }
  }
}
