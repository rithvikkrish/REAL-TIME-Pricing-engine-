export interface DequeNode {
  value: number;
  timestamp: number;
}

/**
 * Efficient Monotonic Deque for Sliding Window High (Max) and Low (Min).
 * Time complexity per tick: O(1) amortized.
 * Space complexity: O(K) where K <= total observations.
 */
export class MonotonicMinMaxDeque {
  private maxDeque: DequeNode[] = [];
  private minDeque: DequeNode[] = [];

  /**
   * Push a new price observation into the sliding window.
   */
  public push(value: number, timestamp: number): void {
    // Maintain decreasing order for max: drop any elements <= new value
    while (this.maxDeque.length > 0 && this.maxDeque[this.maxDeque.length - 1].value <= value) {
      this.maxDeque.pop();
    }
    this.maxDeque.push({ value, timestamp });

    // Maintain increasing order for min: drop any elements >= new value
    while (this.minDeque.length > 0 && this.minDeque[this.minDeque.length - 1].value >= value) {
      this.minDeque.pop();
    }
    this.minDeque.push({ value, timestamp });
  }

  /**
   * Prune elements older than cutoffTimestamp from the front.
   */
  public prune(cutoffTimestamp: number): void {
    while (this.maxDeque.length > 0 && this.maxDeque[0].timestamp < cutoffTimestamp) {
      this.maxDeque.shift();
    }
    while (this.minDeque.length > 0 && this.minDeque[0].timestamp < cutoffTimestamp) {
      this.minDeque.shift();
    }
  }

  /**
   * Returns current maximum within the window, or fallback if empty.
   */
  public getMax(fallback: number = 0): number {
    return this.maxDeque.length > 0 ? this.maxDeque[0].value : fallback;
  }

  /**
   * Returns current minimum within the window, or fallback if empty.
   */
  public getMin(fallback: number = 0): number {
    return this.minDeque.length > 0 ? this.minDeque[0].value : fallback;
  }

  /**
   * Clear all stored observations in the deque.
   */
  public clear(): void {
    this.maxDeque = [];
    this.minDeque = [];
  }

  /**
   * Returns the count of tracked extremes.
   */
  public size(): { maxCount: number; minCount: number } {
    return {
      maxCount: this.maxDeque.length,
      minCount: this.minDeque.length,
    };
  }
}
