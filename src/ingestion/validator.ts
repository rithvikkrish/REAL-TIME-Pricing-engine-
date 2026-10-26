import { z } from 'zod';
import { isValidSymbol, SupportedSymbol } from '../config/symbols';
import { RawMarketTick } from '../types/market';
import { calculateMidpoint } from '../utils/math';
import { logger } from '../utils/logger';

export interface ValidatedTick {
  symbol: SupportedSymbol;
  buy: number;
  sell: number;
  midpoint: number;
  sourceTimestamp: number;
  receiveTimestamp: number;
}

export interface ValidationResult {
  isValid: boolean;
  tick?: ValidatedTick;
  reason?: string;
  isSpike?: boolean;
}

const rawTickSchema = z.object({
  symbol: z.string(),
  buy: z.union([z.number(), z.string()]),
  sell: z.union([z.number(), z.string()]),
  timestamp: z.union([z.number(), z.string()]),
  low_24h: z.union([z.number(), z.string()]).optional(),
  high_24h: z.union([z.number(), z.string()]).optional(),
  change_24h: z.union([z.number(), z.string()]).optional(),
});

export class TickValidator {
  private lastMidpoints: Map<string, number> = new Map();
  private spikeThresholdPercent: number;

  constructor(spikeThresholdPercent: number = 50) {
    this.spikeThresholdPercent = spikeThresholdPercent;
  }

  public validate(raw: unknown, receiveTimestamp: number = Date.now()): ValidationResult {
    const parseRes = rawTickSchema.safeParse(raw);
    if (!parseRes.success) {
      return {
        isValid: false,
        reason: `Schema validation failed: ${parseRes.error.message}`,
      };
    }

    const data = parseRes.data;

    // Symbol validation
    const upperSymbol = data.symbol.toUpperCase().trim();
    if (!isValidSymbol(upperSymbol)) {
      return {
        isValid: false,
        reason: `Unsupported or unknown symbol: ${data.symbol}`,
      };
    }

    // Number conversion
    const buy = typeof data.buy === 'number' ? data.buy : parseFloat(data.buy);
    const sell = typeof data.sell === 'number' ? data.sell : parseFloat(data.sell);

    if (isNaN(buy) || isNaN(sell) || buy <= 0 || sell <= 0) {
      return {
        isValid: false,
        reason: `Invalid non-positive price values: buy=${data.buy}, sell=${data.sell}`,
      };
    }

    if (sell < buy) {
      return {
        isValid: false,
        reason: `Crossed market spread: sell (${sell}) is less than buy (${buy})`,
      };
    }

    // Timestamp parsing (handles ms, s, or ISO strings)
    let sourceTimestamp: number;
    if (typeof data.timestamp === 'number') {
      // If timestamp is in seconds (< 1e11), convert to ms
      sourceTimestamp = data.timestamp < 100000000000 ? Math.round(data.timestamp * 1000) : Math.round(data.timestamp);
    } else {
      const parsedTs = Number(data.timestamp);
      if (!isNaN(parsedTs)) {
        sourceTimestamp = parsedTs < 100000000000 ? Math.round(parsedTs * 1000) : Math.round(parsedTs);
      } else {
        const dateParsed = Date.parse(data.timestamp);
        if (isNaN(dateParsed)) {
          return {
            isValid: false,
            reason: `Invalid timestamp format: ${data.timestamp}`,
          };
        }
        sourceTimestamp = dateParsed;
      }
    }

    // Sanity check: timestamp shouldn't be too far in the future (> 5 minutes)
    if (sourceTimestamp > receiveTimestamp + 300000) {
      return {
        isValid: false,
        reason: `Timestamp too far in the future: ${sourceTimestamp}`,
      };
    }

    const midpoint = calculateMidpoint(buy, sell);

    // Spike filter
    const lastMid = this.lastMidpoints.get(upperSymbol);
    let isSpike = false;
    if (lastMid !== undefined && lastMid > 0) {
      const deltaPercent = Math.abs((midpoint - lastMid) / lastMid) * 100;
      if (deltaPercent >= this.spikeThresholdPercent) {
        logger.warn(
          { symbol: upperSymbol, lastMid, midpoint, deltaPercent, threshold: this.spikeThresholdPercent },
          'Price spike detected exceeding threshold'
        );
        isSpike = true;
        // Documented policy: reject extreme unverified single-tick spikes > threshold
        return {
          isValid: false,
          reason: `Price spike of ${deltaPercent.toFixed(2)}% exceeded threshold ${this.spikeThresholdPercent}%`,
          isSpike: true,
        };
      }
    }

    this.lastMidpoints.set(upperSymbol, midpoint);

    return {
      isValid: true,
      tick: {
        symbol: upperSymbol,
        buy,
        sell,
        midpoint,
        sourceTimestamp,
        receiveTimestamp,
      },
    };
  }

  public reset(): void {
    this.lastMidpoints.clear();
  }
}
