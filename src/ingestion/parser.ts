import { RawMarketTick } from '../types/market';
import { logger } from '../utils/logger';

export interface ParseResult {
  ticks: RawMarketTick[];
  rawSizeBytes: number;
  success: boolean;
  error?: string;
  isControlMessage?: boolean;
  controlData?: Record<string, unknown>;
}

export class MessageParser {
  public parse(rawData: unknown): ParseResult {
    let text: string;
    let rawSizeBytes = 0;

    if (typeof rawData === 'string') {
      text = rawData;
      rawSizeBytes = Buffer.byteLength(text, 'utf8');
    } else if (Buffer.isBuffer(rawData)) {
      text = rawData.toString('utf8');
      rawSizeBytes = rawData.length;
    } else if (rawData instanceof ArrayBuffer) {
      const buf = Buffer.from(rawData);
      text = buf.toString('utf8');
      rawSizeBytes = buf.length;
    } else if (typeof rawData === 'object' && rawData !== null) {
      text = JSON.stringify(rawData);
      rawSizeBytes = Buffer.byteLength(text, 'utf8');
    } else {
      return {
        ticks: [],
        rawSizeBytes: 0,
        success: false,
        error: 'Unsupported payload type received',
      };
    }

    try {
      const parsed = JSON.parse(text);

      // Handle control messages (e.g. auth acknowledgement, subscription ack, ping, error)
      if (
        parsed.action === 'auth' ||
        parsed.event === 'error' ||
        parsed.event === 'auth_success' ||
        parsed.status === 'success' ||
        parsed.type === 'heartbeat' ||
        parsed.event === 'subscribed'
      ) {
        return {
          ticks: [],
          rawSizeBytes,
          success: true,
          isControlMessage: true,
          controlData: parsed,
        };
      }

      // Check if it is an array of ticks
      if (Array.isArray(parsed)) {
        return {
          ticks: parsed as RawMarketTick[],
          rawSizeBytes,
          success: true,
        };
      }

      // Check if wrapped in data or ticks
      if (parsed.data && Array.isArray(parsed.data)) {
        return {
          ticks: parsed.data as RawMarketTick[],
          rawSizeBytes,
          success: true,
        };
      }

      if (parsed.data && typeof parsed.data === 'object' && parsed.data.symbol) {
        return {
          ticks: [parsed.data as RawMarketTick],
          rawSizeBytes,
          success: true,
        };
      }

      // Single tick object: { symbol, buy, sell, ... }
      if (parsed.symbol && (parsed.buy !== undefined || parsed.sell !== undefined)) {
        return {
          ticks: [parsed as RawMarketTick],
          rawSizeBytes,
          success: true,
        };
      }

      return {
        ticks: [],
        rawSizeBytes,
        success: true,
        isControlMessage: true,
        controlData: parsed,
      };
    } catch (err) {
      logger.error({ err, rawSizeBytes }, 'Failed to parse JSON payload');
      return {
        ticks: [],
        rawSizeBytes,
        success: false,
        error: (err as Error).message,
      };
    }
  }
}
