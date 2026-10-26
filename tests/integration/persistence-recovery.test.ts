import { describe, it, expect, beforeEach } from 'vitest';
import { RedisManager } from '../../src/persistence/redis-client';
import { PriceRepository } from '../../src/persistence/price-repository';
import { StateRecoveryService } from '../../src/persistence/state-recovery';
import { PriceProcessor } from '../../src/engine/price-processor';

describe('Persistence and State Recovery Lifecycle', () => {
  let redisManager: RedisManager;
  let repository: PriceRepository;

  beforeEach(() => {
    // Uses resilient in-memory mode for fast deterministic unit/integration testing
    redisManager = new RedisManager({ enabled: false });
    repository = new PriceRepository(redisManager);
  });

  it('preserves latest prices and 24h rolling stats across engine restarts', async () => {
    const processorInstance1 = new PriceProcessor();

    // Ingest initial base tick 10 hours ago
    const t0 = Date.now() - 10 * 3600 * 1000;
    const tick1 = processorInstance1.processRawTick({
      symbol: 'EURUSD',
      buy: 1.05,
      sell: 1.052,
      timestamp: t0,
    });

    // Save to repository
    const snap1 = processorInstance1.getSnapshot('EURUSD')!;
    await repository.saveLatestSnapshot(snap1);
    await repository.saveObservation('EURUSD', {
      timestamp: t0,
      buy: 1.05,
      sell: 1.052,
      midpoint: tick1!.midpoint,
    });

    // Ingest newer tick now with high price
    const t1 = Date.now();
    const tick2 = processorInstance1.processRawTick({
      symbol: 'EURUSD',
      buy: 1.10,
      sell: 1.102,
      timestamp: t1,
    });

    const snap2 = processorInstance1.getSnapshot('EURUSD')!;
    await repository.saveLatestSnapshot(snap2);
    await repository.saveObservation('EURUSD', {
      timestamp: t1,
      buy: 1.10,
      sell: 1.102,
      midpoint: tick2!.midpoint,
    });

    // SIMULATE ENGINE RESTART: create fresh PriceProcessor instance with no prior memory
    const processorInstance2 = new PriceProcessor();
    expect(processorInstance2.getSnapshot('EURUSD')).toBeUndefined();

    // Execute state recovery
    const recoveryService = new StateRecoveryService(repository, processorInstance2);
    const result = await recoveryService.restore();

    expect(result.symbolsRecovered).toBeGreaterThanOrEqual(1);
    expect(result.totalObservationsRestored).toBeGreaterThanOrEqual(2);

    // Verify recovered snapshot matches persisted metrics
    const recoveredSnapshot = processorInstance2.getSnapshot('EURUSD');
    expect(recoveredSnapshot).toBeDefined();
    expect(recoveredSnapshot?.buy).toBe(1.10);
    expect(recoveredSnapshot?.sell).toBe(1.102);
    expect(recoveredSnapshot?.high24h).toBe(1.101);
    expect(recoveredSnapshot?.low24h).toBe(1.051);
    expect(recoveredSnapshot?.observationCount).toBe(2);

    // Verify rolling window is restored and ready for new ticks without resetting
    const nextTick = processorInstance2.processRawTick({
      symbol: 'EURUSD',
      buy: 1.11,
      sell: 1.112,
      timestamp: t1 + 1000,
    });

    expect(nextTick?.high24h).toBe(1.111);
    expect(nextTick?.low24h).toBe(1.051); // 1.051 from 10 hours ago is still preserved!
  });
});
