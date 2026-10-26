import { roundTo } from '../utils/math';

export interface Candle {
  timestamp: number; // Start of candle period in ms
  open: number;
  high: number;
  low: number;
  close: number;
  tickCount: number;
}

export class CandleManager {
  // symbol -> array of candles (chronological order)
  private symbolCandles: Map<string, Candle[]> = new Map();
  private readonly candleIntervalMs: number;
  private readonly maxCandlesPerSymbol: number;

  constructor(candleIntervalMs: number = 60000, maxCandlesPerSymbol: number = 60) {
    this.candleIntervalMs = candleIntervalMs; // Default: 1 minute
    this.maxCandlesPerSymbol = maxCandlesPerSymbol; // Default: keep 60 candles (1 hour)
  }

  public addPrice(symbol: string, price: number, timestamp: number): void {
    const bucket = Math.floor(timestamp / this.candleIntervalMs) * this.candleIntervalMs;
    let candles = this.symbolCandles.get(symbol);

    if (!candles) {
      candles = [];
      this.symbolCandles.set(symbol, candles);
    }

    if (candles.length === 0 || candles[candles.length - 1].timestamp < bucket) {
      // Create new candle
      candles.push({
        timestamp: bucket,
        open: roundTo(price, 5),
        high: roundTo(price, 5),
        low: roundTo(price, 5),
        close: roundTo(price, 5),
        tickCount: 1,
      });

      // Maintain max length
      if (candles.length > this.maxCandlesPerSymbol) {
        candles.shift();
      }
    } else {
      // Update existing current candle
      const current = candles[candles.length - 1];
      current.high = roundTo(Math.max(current.high, price), 5);
      current.low = roundTo(Math.min(current.low, price), 5);
      current.close = roundTo(price, 5);
      current.tickCount += 1;
    }
  }

  public getCandles(symbol: string): Candle[] {
    return this.symbolCandles.get(symbol) || [];
  }

  public clear(): void {
    this.symbolCandles.clear();
  }
}
