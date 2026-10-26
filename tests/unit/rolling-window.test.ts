import { describe, it, expect, beforeEach } from 'vitest';
import { SymbolRollingWindow } from '../../src/engine/rolling-window';

describe('SymbolRollingWindow', () => {
  let window: SymbolRollingWindow;
  const WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours

  beforeEach(() => {
    window = new SymbolRollingWindow('EURUSD', WINDOW_MS);
  });

  it('tracks rolling high, low, and reference midpoint', () => {
    const t0 = 1700000000000;

    window.addObservation({ timestamp: t0, buy: 1.08, sell: 1.082, midpoint: 1.081 });
    let stats = window.getRollingStats();
    expect(stats.high24h).toBe(1.081);
    expect(stats.low24h).toBe(1.081);
    expect(stats.referenceMidpoint).toBe(1.081);

    // Higher tick
    window.addObservation({ timestamp: t0 + 1000, buy: 1.09, sell: 1.092, midpoint: 1.091 });
    stats = window.getRollingStats();
    expect(stats.high24h).toBe(1.091);
    expect(stats.low24h).toBe(1.081);

    // Lower tick
    window.addObservation({ timestamp: t0 + 2000, buy: 1.07, sell: 1.072, midpoint: 1.071 });
    stats = window.getRollingStats();
    expect(stats.high24h).toBe(1.091);
    expect(stats.low24h).toBe(1.071);
  });

  it('prunes observations older than 24h and maintains reference observation', () => {
    const t0 = 1700000000000;

    // t0 (initial reference)
    window.addObservation({ timestamp: t0, buy: 1.05, sell: 1.052, midpoint: 1.051 });

    // t0 + 12h
    window.addObservation({ timestamp: t0 + 12 * 3600 * 1000, buy: 1.10, sell: 1.102, midpoint: 1.101 });

    // t0 + 25h (t0 has now expired past 24h window)
    window.addObservation({ timestamp: t0 + 25 * 3600 * 1000, buy: 1.08, sell: 1.082, midpoint: 1.081 });

    const stats = window.getRollingStats();
    expect(stats.observationCount).toBe(2); // t0 pruned, 12h and 25h remaining
    // Reference point kept is the pruned t0 midpoint (1.051)
    expect(stats.referenceMidpoint).toBe(1.051);
  });

  it('handles out-of-order historical observations correctly', () => {
    const t0 = 1700000000000;

    window.addObservation({ timestamp: t0 + 1000, buy: 1.08, sell: 1.082, midpoint: 1.081 });
    window.addObservation({ timestamp: t0 + 3000, buy: 1.09, sell: 1.092, midpoint: 1.091 });

    // Late tick arriving with t0 + 2000 and extreme low
    window.addObservation({ timestamp: t0 + 2000, buy: 1.06, sell: 1.062, midpoint: 1.061 });

    const stats = window.getRollingStats();
    expect(stats.high24h).toBe(1.091);
    expect(stats.low24h).toBe(1.061);
    expect(stats.observationCount).toBe(3);
  });
});
