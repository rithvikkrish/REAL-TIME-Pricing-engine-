/**
 * Safe rounding and financial arithmetic helpers.
 */

export function roundTo(val: number, decimals: number = 5): number {
  const factor = Math.pow(10, decimals);
  return Math.round((val + Number.EPSILON) * factor) / factor;
}

/**
 * Calculates midpoint price from buy (bid) and sell (ask).
 * Definition: midpoint = (buy + sell) / 2
 */
export function calculateMidpoint(buy: number, sell: number): number {
  return roundTo((buy + sell) / 2, 6);
}

/**
 * Calculates percentage change relative to a reference price:
 * percentageChange = ((current - reference) / reference) * 100
 * If reference is zero, invalid, or undefined, returns 0.00.
 */
export function calculatePercentageChange(current: number, reference: number): number {
  if (!reference || reference <= 0 || !Number.isFinite(reference)) {
    return 0;
  }
  const change = ((current - reference) / reference) * 100;
  return roundTo(change, 4);
}
