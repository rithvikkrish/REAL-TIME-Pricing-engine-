import { describe, it, expect } from 'vitest';
import { StatisticsEngine } from '../../src/engine/statistics';
import { calculateMidpoint, calculatePercentageChange } from '../../src/utils/math';

describe('StatisticsEngine & Math', () => {
  it('calculates midpoint correctly', () => {
    expect(calculateMidpoint(1.08, 1.082)).toBe(1.081);
    expect(calculateMidpoint(60000, 60010)).toBe(60005);
  });

  it('calculates percentage change correctly', () => {
    // 100 to 110 = +10.0%
    expect(calculatePercentageChange(110, 100)).toBe(10);
    // 100 to 90 = -10.0%
    expect(calculatePercentageChange(90, 100)).toBe(-10);
    // 1.081 to 1.081 = 0%
    expect(calculatePercentageChange(1.081, 1.081)).toBe(0);
  });

  it('handles zero or missing reference gracefully with 0.0%', () => {
    expect(calculatePercentageChange(1.081, 0)).toBe(0);
    expect(calculatePercentageChange(1.081, -5)).toBe(0);
  });

  it('computes 24h stats independently', () => {
    const stats = StatisticsEngine.compute(1.08, 1.082, 1.095, 1.075, 1.05);
    expect(stats.midpoint).toBe(1.081);
    expect(stats.high24h).toBe(1.095);
    expect(stats.low24h).toBe(1.075);
    // Change from 1.05 to 1.081 = ((1.081 - 1.05) / 1.05) * 100 = 2.9524%
    expect(stats.change24h).toBeCloseTo(2.9524, 2);
  });
});
