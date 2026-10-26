import { PriceRepository } from './price-repository';
import { PriceProcessor } from '../engine/price-processor';
import { REQUIRED_SYMBOLS } from '../config/symbols';
import { logger } from '../utils/logger';

export interface RecoveryResult {
  symbolsRecovered: number;
  totalObservationsRestored: number;
  durationMs: number;
  isDegraded: boolean;
  errors: string[];
}

export class StateRecoveryService {
  constructor(
    private repository: PriceRepository,
    private processor: PriceProcessor,
    private windowMs: number = 24 * 60 * 60 * 1000
  ) {}

  public async restore(): Promise<RecoveryResult> {
    const startTime = Date.now();
    let symbolsRecovered = 0;
    let totalObservationsRestored = 0;
    const errors: string[] = [];

    logger.info('Starting engine state restoration from persistent storage...');

    try {
      const now = Date.now();
      const cutoff = now - this.windowMs;

      for (const symbol of REQUIRED_SYMBOLS) {
        try {
          const [snapshot, observations, refObs] = await Promise.all([
            this.repository.getLatestSnapshot(symbol),
            this.repository.getObservations(symbol, cutoff, now),
            this.repository.getReferenceObservation(symbol),
          ]);

          if (snapshot || observations.length > 0) {
            this.processor.restoreSymbolState(
              symbol,
              observations,
              refObs || null,
              snapshot || undefined
            );
            symbolsRecovered++;
            totalObservationsRestored += observations.length;
          }
        } catch (err) {
          const msg = `Failed to recover state for symbol ${symbol}: ${(err as Error).message}`;
          logger.warn(msg);
          errors.push(msg);
        }
      }

      const durationMs = Date.now() - startTime;
      logger.info(
        { symbolsRecovered, totalObservationsRestored, durationMs },
        'State restoration process completed'
      );

      return {
        symbolsRecovered,
        totalObservationsRestored,
        durationMs,
        isDegraded: errors.length > 0,
        errors,
      };
    } catch (err) {
      const durationMs = Date.now() - startTime;
      const msg = `Fatal error during state recovery: ${(err as Error).message}`;
      logger.error(msg);
      return {
        symbolsRecovered,
        totalObservationsRestored,
        durationMs,
        isDegraded: true,
        errors: [msg],
      };
    }
  }
}
