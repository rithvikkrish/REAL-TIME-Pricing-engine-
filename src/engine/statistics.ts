import { calculateMidpoint, calculatePercentageChange, roundTo } from '../utils/math';

export interface CalculatedStats {
  midpoint: number;
  high24h: number;
  low24h: number;
  change24h: number;
}

export class StatisticsEngine {
  /**
   * Computes statistics given current buy/sell, rolling high/low values, and 24h reference midpoint.
   */
  public static compute(
    buy: number,
    sell: number,
    rollingHigh: number,
    rollingLow: number,
    referenceMidpoint: number | null
  ): CalculatedStats {
    const midpoint = calculateMidpoint(buy, sell);

    // High and low encompass the current midpoint and the rolling extremes
    const high24h = rollingHigh > 0 ? Math.max(rollingHigh, midpoint) : midpoint;
    const low24h = rollingLow > 0 ? Math.min(rollingLow, midpoint) : midpoint;

    // If referenceMidpoint is null or invalid, use current midpoint (0.0% change)
    const ref = referenceMidpoint && referenceMidpoint > 0 ? referenceMidpoint : midpoint;
    const change24h = calculatePercentageChange(midpoint, ref);

    return {
      midpoint: roundTo(midpoint, 6),
      high24h: roundTo(high24h, 6),
      low24h: roundTo(low24h, 6),
      change24h: roundTo(change24h, 4),
    };
  }
}
