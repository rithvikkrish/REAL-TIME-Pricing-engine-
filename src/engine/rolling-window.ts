import { MonotonicMinMaxDeque } from '../utils/deque';
import { PriceObservation } from '../types/market';
import { roundTo } from '../utils/math';

export interface RollingWindowState {
  observations: PriceObservation[];
  referenceObservation: PriceObservation | null;
  high24h: number;
  low24h: number;
  observationCount: number;
}

export class SymbolRollingWindow {
  public readonly symbol: string;
  private readonly windowMs: number;
  private observations: PriceObservation[] = [];
  private minMaxDeque: MonotonicMinMaxDeque = new MonotonicMinMaxDeque();
  private referenceObservation: PriceObservation | null = null;

  constructor(symbol: string, windowMs: number = 24 * 60 * 60 * 1000) {
    this.symbol = symbol;
    this.windowMs = windowMs;
  }

  /**
   * Adds a new observation, updates sliding window deque, and prunes expired records.
   */
  public addObservation(obs: PriceObservation): void {
    if (this.observations.length === 0) {
      this.observations.push(obs);
      this.minMaxDeque.push(obs.midpoint, obs.timestamp);
      this.referenceObservation = obs;
      return;
    }

    const lastObs = this.observations[this.observations.length - 1];

    if (obs.timestamp >= lastObs.timestamp) {
      // Normal in-order append
      this.observations.push(obs);
      this.minMaxDeque.push(obs.midpoint, obs.timestamp);
    } else {
      // Late / out-of-order observation: binary insert into correct chronological position
      this.insertSorted(obs);
      // Rebuild monotonic deque to maintain strict sliding invariant
      this.rebuildDeque();
    }

    // Prune observations older than 24 hours from the current latest timestamp
    const latestTimestamp = this.observations[this.observations.length - 1].timestamp;
    this.pruneExpired(latestTimestamp - this.windowMs);
  }

  /**
   * Prunes observations older than the cutoff timestamp.
   * Keeps the most recently expired observation as the 24-hour reference point!
   */
  public pruneExpired(cutoffTimestamp: number): void {
    let expiredCount = 0;
    while (expiredCount < this.observations.length && this.observations[expiredCount].timestamp < cutoffTimestamp) {
      expiredCount++;
    }

    if (expiredCount > 0) {
      // The last expired observation immediately preceding the 24-hour window is our reference point!
      this.referenceObservation = this.observations[expiredCount - 1];
      this.observations.splice(0, expiredCount);
      // Prune monotonic deque
      this.minMaxDeque.prune(cutoffTimestamp);
    }

    // If no expired observation exists yet, the reference point is the first available observation
    if (!this.referenceObservation && this.observations.length > 0) {
      this.referenceObservation = this.observations[0];
    }
  }

  /**
   * Returns current rolling 24-hour stats.
   */
  public getRollingStats(): {
    high24h: number;
    low24h: number;
    referenceMidpoint: number | null;
    observationCount: number;
  } {
    if (this.observations.length === 0) {
      return {
        high24h: 0,
        low24h: 0,
        referenceMidpoint: null,
        observationCount: 0,
      };
    }

    const high = this.minMaxDeque.getMax(this.observations[0].midpoint);
    const low = this.minMaxDeque.getMin(this.observations[0].midpoint);
    const refMid = this.referenceObservation ? this.referenceObservation.midpoint : this.observations[0].midpoint;

    return {
      high24h: roundTo(high, 6),
      low24h: roundTo(low, 6),
      referenceMidpoint: roundTo(refMid, 6),
      observationCount: this.observations.length,
    };
  }

  /**
   * Binary insertion for out-of-order historical observations.
   */
  private insertSorted(obs: PriceObservation): void {
    let low = 0;
    let high = this.observations.length;

    while (low < high) {
      const mid = (low + high) >>> 1;
      if (this.observations[mid].timestamp < obs.timestamp) {
        low = mid + 1;
      } else {
        high = mid;
      }
    }

    this.observations.splice(low, 0, obs);
  }

  private rebuildDeque(): void {
    this.minMaxDeque.clear();
    for (const item of this.observations) {
      this.minMaxDeque.push(item.midpoint, item.timestamp);
    }
  }

  public getObservations(): ReadonlyArray<PriceObservation> {
    return this.observations;
  }

  public getReferenceObservation(): PriceObservation | null {
    return this.referenceObservation;
  }

  /**
   * Restores state from persisted observations.
   */
  public restoreState(observations: PriceObservation[], referenceObs: PriceObservation | null): void {
    this.observations = observations.slice().sort((a, b) => a.timestamp - b.timestamp);
    this.referenceObservation = referenceObs;
    this.rebuildDeque();

    if (this.observations.length > 0) {
      const latestTimestamp = this.observations[this.observations.length - 1].timestamp;
      this.pruneExpired(latestTimestamp - this.windowMs);
    }
  }

  public clear(): void {
    this.observations = [];
    this.minMaxDeque.clear();
    this.referenceObservation = null;
  }
}
