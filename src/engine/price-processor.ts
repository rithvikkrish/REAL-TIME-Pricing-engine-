import { EventEmitter } from 'events';
import { TickValidator, ValidatedTick } from '../ingestion/validator';
import { EventDeduplicator } from '../ingestion/deduplicator';
import { OrderManager } from '../ingestion/ordering';
import { SymbolRollingWindow } from './rolling-window';
import { StatisticsEngine } from './statistics';
import { NormalizedPriceUpdate, PriceObservation, Symbol24hSnapshot } from '../types/market';
import { incomingTicksTotal, processingLatency } from '../metrics/prometheus';
import { roundTo } from '../utils/math';
import { logger } from '../utils/logger';

import { CandleManager, Candle } from './candles';

export interface ProcessorOptions {
  windowMs?: number;
  spikeThresholdPercent?: number;
  lateToleranceMs?: number;
}

export class PriceProcessor extends EventEmitter {
  private validator: TickValidator;
  private deduplicator: EventDeduplicator;
  private orderManager: OrderManager;
  private windows: Map<string, SymbolRollingWindow> = new Map();
  private latestSnapshots: Map<string, Symbol24hSnapshot> = new Map();
  private candleManager: CandleManager = new CandleManager();
  private windowMs: number;

  constructor(options: ProcessorOptions = {}) {
    super();
    this.windowMs = options.windowMs || 24 * 60 * 60 * 1000;
    this.validator = new TickValidator(options.spikeThresholdPercent || 50);
    this.deduplicator = new EventDeduplicator(50000);
    this.orderManager = new OrderManager(options.lateToleranceMs || 60000, this.windowMs);
  }

  /**
   * Process a single raw tick through the full pipeline.
   */
  public processRawTick(rawTick: unknown, receiveTimestamp: number = Date.now()): NormalizedPriceUpdate | null {
    const hrStart = process.hrtime();

    // 1. Validation & Schema Enforcement
    const valResult = this.validator.validate(rawTick, receiveTimestamp);
    if (!valResult.isValid || !valResult.tick) {
      const sym = (rawTick as any)?.symbol || 'UNKNOWN';
      const status = valResult.isSpike ? 'spike' : 'rejected';
      incomingTicksTotal.inc({ symbol: sym, status });
      return null;
    }

    const tick: ValidatedTick = valResult.tick;

    // 2. Duplicate Detection
    if (this.deduplicator.isDuplicate(tick)) {
      incomingTicksTotal.inc({ symbol: tick.symbol, status: 'duplicate' });
      return null;
    }

    // 3. Ordering & Late Event Policy
    const orderDecision = this.orderManager.evaluate(tick);
    if (orderDecision.isExpired) {
      incomingTicksTotal.inc({ symbol: tick.symbol, status: 'rejected' });
      return null;
    }

    // 4. Update Rolling 24-hour Window
    let window = this.windows.get(tick.symbol);
    if (!window) {
      window = new SymbolRollingWindow(tick.symbol, this.windowMs);
      this.windows.set(tick.symbol, window);
    }

    const obs: PriceObservation = {
      timestamp: tick.sourceTimestamp,
      buy: tick.buy,
      sell: tick.sell,
      midpoint: tick.midpoint,
    };

    window.addObservation(obs);

    // 5. Compute Market Statistics
    const rollingStats = window.getRollingStats();
    const stats = StatisticsEngine.compute(
      tick.buy,
      tick.sell,
      rollingStats.high24h,
      rollingStats.low24h,
      rollingStats.referenceMidpoint
    );

    // Record high-resolution monotonic processing latency
    const hrDiff = process.hrtime(hrStart);
    const latencySeconds = hrDiff[0] + hrDiff[1] / 1e9;
    const latencyMs = roundTo(latencySeconds * 1000, 3);
    processingLatency.observe(latencySeconds);

    incomingTicksTotal.inc({
      symbol: tick.symbol,
      status: orderDecision.isLate ? 'out_of_order' : 'accepted',
    });

    const normalized: NormalizedPriceUpdate = {
      symbol: tick.symbol,
      buy: tick.buy,
      sell: tick.sell,
      midpoint: stats.midpoint,
      sourceTimestamp: tick.sourceTimestamp,
      receiveTimestamp: tick.receiveTimestamp,
      high24h: stats.high24h,
      low24h: stats.low24h,
      change24h: stats.change24h,
      latencyMs,
    };

    // If it's a current (not late) tick, update the cached latest snapshot
    if (orderDecision.isCurrent) {
      const snapshot: Symbol24hSnapshot = {
        symbol: tick.symbol,
        buy: tick.buy,
        sell: tick.sell,
        midpoint: stats.midpoint,
        high24h: stats.high24h,
        low24h: stats.low24h,
        change24h: stats.change24h,
        sourceTimestamp: tick.sourceTimestamp,
        receiveTimestamp: tick.receiveTimestamp,
        observationCount: rollingStats.observationCount,
      };
      this.latestSnapshots.set(tick.symbol, snapshot);
    }

    // Update OHLC candle (Bonus Requirement)
    this.candleManager.addPrice(tick.symbol, stats.midpoint, tick.sourceTimestamp);

    this.emit('price_update', normalized);

    return normalized;
  }

  public getCandles(symbol: string): Candle[] {
    return this.candleManager.getCandles(symbol);
  }

  public getSnapshot(symbol: string): Symbol24hSnapshot | undefined {
    return this.latestSnapshots.get(symbol);
  }

  public getAllSnapshots(): Symbol24hSnapshot[] {
    return Array.from(this.latestSnapshots.values());
  }

  public getWindow(symbol: string): SymbolRollingWindow | undefined {
    return this.windows.get(symbol);
  }

  public getAllWindows(): Map<string, SymbolRollingWindow> {
    return this.windows;
  }

  /**
   * Restores state into the engine from persistence.
   */
  public restoreSymbolState(
    symbol: string,
    observations: PriceObservation[],
    referenceObs: PriceObservation | null,
    latestSnapshot?: Symbol24hSnapshot
  ): void {
    let window = this.windows.get(symbol);
    if (!window) {
      window = new SymbolRollingWindow(symbol, this.windowMs);
      this.windows.set(symbol, window);
    }

    window.restoreState(observations, referenceObs);

    if (latestSnapshot) {
      this.latestSnapshots.set(symbol, latestSnapshot);
      this.orderManager.setLastTimestamp(symbol, latestSnapshot.sourceTimestamp);
    } else if (observations.length > 0) {
      const lastObs = observations[observations.length - 1];
      const stats = window.getRollingStats();
      const comp = StatisticsEngine.compute(
        lastObs.buy,
        lastObs.sell,
        stats.high24h,
        stats.low24h,
        stats.referenceMidpoint
      );
      this.latestSnapshots.set(symbol, {
        symbol,
        buy: lastObs.buy,
        sell: lastObs.sell,
        midpoint: comp.midpoint,
        high24h: comp.high24h,
        low24h: comp.low24h,
        change24h: comp.change24h,
        sourceTimestamp: lastObs.timestamp,
        receiveTimestamp: Date.now(),
        observationCount: stats.observationCount,
      });
      this.orderManager.setLastTimestamp(symbol, lastObs.timestamp);
    }
  }

  public clear(): void {
    this.windows.clear();
    this.latestSnapshots.clear();
    this.validator.reset();
    this.deduplicator.clear();
    this.orderManager.clear();
  }
}
