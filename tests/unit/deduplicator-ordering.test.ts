import { describe, it, expect, beforeEach } from 'vitest';
import { EventDeduplicator } from '../../src/ingestion/deduplicator';
import { OrderManager } from '../../src/ingestion/ordering';
import { ValidatedTick } from '../../src/ingestion/validator';

describe('EventDeduplicator & OrderManager', () => {
  let deduplicator: EventDeduplicator;
  let orderManager: OrderManager;

  const sampleTick: ValidatedTick = {
    symbol: 'EURUSD',
    buy: 1.085,
    sell: 1.0852,
    midpoint: 1.0851,
    sourceTimestamp: 1700000000000,
    receiveTimestamp: 1700000000005,
  };

  beforeEach(() => {
    deduplicator = new EventDeduplicator(100);
    orderManager = new OrderManager(60000, 24 * 3600 * 1000);
  });

  it('detects duplicate events using composite key', () => {
    expect(deduplicator.isDuplicate(sampleTick)).toBe(false);
    expect(deduplicator.isDuplicate(sampleTick)).toBe(true);
  });

  it('allows different ticks through deduplicator', () => {
    expect(deduplicator.isDuplicate(sampleTick)).toBe(false);

    const tick2: ValidatedTick = {
      ...sampleTick,
      sourceTimestamp: sampleTick.sourceTimestamp + 100,
    };
    expect(deduplicator.isDuplicate(tick2)).toBe(false);
  });

  it('detects normal in-order progression', () => {
    const d1 = orderManager.evaluate(sampleTick);
    expect(d1.isCurrent).toBe(true);
    expect(d1.isLate).toBe(false);

    const d2 = orderManager.evaluate({
      ...sampleTick,
      sourceTimestamp: sampleTick.sourceTimestamp + 500,
    });
    expect(d2.isCurrent).toBe(true);
    expect(d2.isLate).toBe(false);
  });

  it('detects out-of-order late ticks', () => {
    orderManager.evaluate({
      ...sampleTick,
      sourceTimestamp: 1700000010000,
    });

    const lateDecision = orderManager.evaluate({
      ...sampleTick,
      sourceTimestamp: 1700000005000, // 5s older than last
    });

    expect(lateDecision.isCurrent).toBe(false);
    expect(lateDecision.isLate).toBe(true);
    expect(lateDecision.isExpired).toBe(false);
  });
});
