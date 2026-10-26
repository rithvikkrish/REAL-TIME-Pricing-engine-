import { ValidatedTick } from './validator';

export interface OrderingDecision {
  isCurrent: boolean;
  isLate: boolean;
  isExpired: boolean;
  timeDeltaMs: number;
}

export class OrderManager {
  private lastTimestamps: Map<string, number> = new Map();
  private lateToleranceMs: number;
  private maxHistoryWindowMs: number;

  constructor(lateToleranceMs: number = 60000, maxHistoryWindowMs: number = 24 * 60 * 60 * 1000) {
    this.lateToleranceMs = lateToleranceMs;
    this.maxHistoryWindowMs = maxHistoryWindowMs;
  }

  public evaluate(tick: ValidatedTick): OrderingDecision {
    const lastTs = this.lastTimestamps.get(tick.symbol);

    if (lastTs === undefined) {
      this.lastTimestamps.set(tick.symbol, tick.sourceTimestamp);
      return {
        isCurrent: true,
        isLate: false,
        isExpired: false,
        timeDeltaMs: 0,
      };
    }

    const timeDelta = tick.sourceTimestamp - lastTs;

    // Normal forward in-order tick
    if (timeDelta >= 0) {
      this.lastTimestamps.set(tick.symbol, tick.sourceTimestamp);
      return {
        isCurrent: true,
        isLate: false,
        isExpired: false,
        timeDeltaMs: timeDelta,
      };
    }

    // Out-of-order / late tick (timeDelta < 0)
    const absDelta = Math.abs(timeDelta);
    const isExpired = absDelta > this.maxHistoryWindowMs;

    return {
      isCurrent: false,
      isLate: true,
      isExpired,
      timeDeltaMs: timeDelta,
    };
  }

  public getLastTimestamp(symbol: string): number | undefined {
    return this.lastTimestamps.get(symbol);
  }

  public setLastTimestamp(symbol: string, timestamp: number): void {
    this.lastTimestamps.set(symbol, timestamp);
  }

  public clear(): void {
    this.lastTimestamps.clear();
  }
}
