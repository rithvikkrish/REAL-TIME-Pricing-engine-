import { describe, it, expect, beforeEach } from 'vitest';
import { TickValidator } from '../../src/ingestion/validator';
import { REQUIRED_SYMBOLS } from '../../src/config/symbols';

describe('TickValidator', () => {
  let validator: TickValidator;

  beforeEach(() => {
    validator = new TickValidator(50);
  });

  it('validates a correct market tick successfully', () => {
    const raw = {
      symbol: 'EURUSD',
      buy: 1.085,
      sell: 1.0852,
      timestamp: Date.now(),
    };

    const res = validator.validate(raw);
    expect(res.isValid).toBe(true);
    expect(res.tick?.symbol).toBe('EURUSD');
    expect(res.tick?.buy).toBe(1.085);
    expect(res.tick?.sell).toBe(1.0852);
    expect(res.tick?.midpoint).toBe(1.0851);
  });

  it('supports all 61 required symbols', () => {
    for (const sym of REQUIRED_SYMBOLS) {
      const res = validator.validate({
        symbol: sym,
        buy: 100,
        sell: 100.1,
        timestamp: Date.now(),
      });
      expect(res.isValid).toBe(true);
      expect(res.tick?.symbol).toBe(sym);
    }
  });

  it('rejects unsupported or invalid symbols', () => {
    const res = validator.validate({
      symbol: 'INVALIDCOIN',
      buy: 1.0,
      sell: 1.1,
      timestamp: Date.now(),
    });
    expect(res.isValid).toBe(false);
    expect(res.reason).toContain('Unsupported or unknown symbol');
  });

  it('rejects crossed market spread (sell < buy)', () => {
    const res = validator.validate({
      symbol: 'EURUSD',
      buy: 1.085,
      sell: 1.084, // lower than buy
      timestamp: Date.now(),
    });
    expect(res.isValid).toBe(false);
    expect(res.reason).toContain('Crossed market spread');
  });

  it('rejects non-positive and NaN prices', () => {
    const res1 = validator.validate({
      symbol: 'EURUSD',
      buy: 0,
      sell: 1.0,
      timestamp: Date.now(),
    });
    expect(res1.isValid).toBe(false);

    const res2 = validator.validate({
      symbol: 'EURUSD',
      buy: -1.05,
      sell: 1.05,
      timestamp: Date.now(),
    });
    expect(res2.isValid).toBe(false);

    const res3 = validator.validate({
      symbol: 'EURUSD',
      buy: 'invalid-number',
      sell: 1.05,
      timestamp: Date.now(),
    });
    expect(res3.isValid).toBe(false);
  });

  it('detects and flags price spikes exceeding threshold', () => {
    // Initial normal tick
    validator.validate({
      symbol: 'BTCUSD',
      buy: 60000,
      sell: 60010,
      timestamp: 1000,
    });

    // Sudden 80% jump
    const res = validator.validate({
      symbol: 'BTCUSD',
      buy: 110000,
      sell: 110010,
      timestamp: 2000,
    });

    expect(res.isValid).toBe(false);
    expect(res.isSpike).toBe(true);
    expect(res.reason).toContain('Price spike');
  });
});
