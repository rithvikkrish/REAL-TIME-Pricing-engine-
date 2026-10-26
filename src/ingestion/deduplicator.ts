import { ValidatedTick } from './validator';

export class EventDeduplicator {
  private seenKeys: Set<string> = new Set();
  private keyQueue: string[] = [];
  private maxCapacity: number;

  constructor(maxCapacity: number = 50000) {
    this.maxCapacity = maxCapacity;
  }

  /**
   * Generates a composite key for an incoming tick.
   */
  public generateKey(tick: ValidatedTick): string {
    return `${tick.symbol}:${tick.sourceTimestamp}:${tick.buy}:${tick.sell}`;
  }

  /**
   * Checks if tick is a duplicate. If not duplicate, records it.
   * Returns true if it is a DUPLICATE, false if UNIQUE.
   */
  public isDuplicate(tick: ValidatedTick): boolean {
    const key = this.generateKey(tick);
    if (this.seenKeys.has(key)) {
      return true;
    }

    this.seenKeys.add(key);
    this.keyQueue.push(key);

    if (this.keyQueue.length > this.maxCapacity) {
      const oldestKey = this.keyQueue.shift();
      if (oldestKey) {
        this.seenKeys.delete(oldestKey);
      }
    }

    return false;
  }

  public clear(): void {
    this.seenKeys.clear();
    this.keyQueue = [];
  }

  public size(): number {
    return this.seenKeys.size;
  }
}
