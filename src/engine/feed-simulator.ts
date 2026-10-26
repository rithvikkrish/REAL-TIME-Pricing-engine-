import { PriceProcessor } from './price-processor';
import { REQUIRED_SYMBOLS } from '../config/symbols';
import { logger } from '../utils/logger';

export class FeedSimulator {
  private timer: NodeJS.Timeout | null = null;
  private basePrices: Map<string, number> = new Map();
  private tickCounter = 0;

  constructor(private processor: PriceProcessor) {
    this.initPrices();
  }

  private initPrices(): void {
    const defaults: Record<string, number> = {
      BTCUSD: 67450.0,
      ETHUSD: 3480.0,
      SOLUSD: 178.5,
      XAUUSD: 2385.2,
      XAGUSD: 31.4,
      EURUSD: 1.0854,
      GBPUSD: 1.2965,
      USDJPY: 154.35,
      AUDUSD: 0.6545,
      USDCAD: 1.368,
      USDCHF: 0.902,
      EURJPY: 167.5,
      GBPJPY: 200.1,
    };

    for (const sym of REQUIRED_SYMBOLS) {
      this.basePrices.set(sym, defaults[sym] || (sym.includes('JPY') ? 120.0 : 1.2));
    }
  }

  public start(intervalMs: number = 200): void {
    if (this.timer) return;
    logger.info({ intervalMs }, 'Starting internal market feed simulator for real-time demonstration');

    this.timer = setInterval(() => {
      this.tickCounter++;
      const symbol = REQUIRED_SYMBOLS[this.tickCounter % REQUIRED_SYMBOLS.length];
      const base = this.basePrices.get(symbol) || 100;
      const spread = base * 0.0003;
      // Brownian motion with mild mean-reversion
      const changePercent = (Math.sin(this.tickCounter / 15) * 0.001) + ((Math.random() - 0.495) * 0.002);
      const newMid = Math.max(0.0001, base * (1 + changePercent));
      this.basePrices.set(symbol, newMid);

      const decimals = symbol.includes('JPY') ? 3 : symbol.includes('BTC') ? 2 : 5;
      const factor = Math.pow(10, decimals);

      const buy = Math.round((newMid - spread / 2) * factor) / factor;
      const sell = Math.round((newMid + spread / 2) * factor) / factor;

      const rawTick = {
        symbol,
        buy,
        sell,
        low_24h: buy * 0.98,
        high_24h: sell * 1.02,
        change_24h: 0.0,
        timestamp: Date.now(),
      };

      this.processor.processRawTick(rawTick);
    }, intervalMs);
  }

  public stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      logger.info('Market feed simulator stopped');
    }
  }

  public isRunning(): boolean {
    return this.timer !== null;
  }
}
