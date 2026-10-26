import { describe, it, expect } from 'vitest';
import { CandleManager } from '../../src/engine/candles';

describe('CandleManager (Bonus OHLC)', () => {
  it('groups ticks into OHLC candlesticks properly', () => {
    const manager = new CandleManager(60000, 10);
    const t0 = 1700000000000;

    manager.addPrice('EURUSD', 1.085, t0);
    manager.addPrice('EURUSD', 1.089, t0 + 10000); // High
    manager.addPrice('EURUSD', 1.082, t0 + 20000); // Low
    manager.addPrice('EURUSD', 1.086, t0 + 30000); // Close

    const candles = manager.getCandles('EURUSD');
    expect(candles.length).toBe(1);
    expect(candles[0].open).toBe(1.085);
    expect(candles[0].high).toBe(1.089);
    expect(candles[0].low).toBe(1.082);
    expect(candles[0].close).toBe(1.086);
    expect(candles[0].tickCount).toBe(4);
  });

  it('rolls to a new candle when crossing interval boundary', () => {
    const manager = new CandleManager(60000, 10);
    const t0 = 1700000000000;

    manager.addPrice('BTCUSD', 65000, t0);
    manager.addPrice('BTCUSD', 66000, t0 + 65000); // 65 seconds later -> next candle

    const candles = manager.getCandles('BTCUSD');
    expect(candles.length).toBe(2);
    expect(candles[0].close).toBe(65000);
    expect(candles[1].open).toBe(66000);
  });
});
