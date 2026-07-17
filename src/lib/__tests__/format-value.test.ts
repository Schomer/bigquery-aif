// src/lib/__tests__/format-value.test.ts
import { describe, it, expect } from 'vitest';
import {
  formatDisplayValue,
  formatCompactValue,
  isCurrencyColumn,
} from '../format-value';

// ---------------------------------------------------------------------------
// isCurrencyColumn
// ---------------------------------------------------------------------------

describe('isCurrencyColumn', () => {
  it('returns true for standard monetary column names', () => {
    const monetaryNames = [
      'revenue', 'total_revenue', 'price', 'unit_price',
      'cost', 'amount', 'spend', 'income', 'profit',
      'balance', 'fee', 'payment', 'gross', 'net',
    ];
    for (const name of monetaryNames) {
      expect(isCurrencyColumn(name), `expected "${name}" to be currency`).toBe(true);
    }
  });

  it('returns false when a non-currency suffix overrides the match', () => {
    expect(isCurrencyColumn('cost_count')).toBe(false);
    expect(isCurrencyColumn('price_id')).toBe(false);
    expect(isCurrencyColumn('revenue_pct')).toBe(false);
    expect(isCurrencyColumn('amount_ratio')).toBe(false);
    expect(isCurrencyColumn('cost_tier')).toBe(false);
  });

  it('returns false for non-monetary column names', () => {
    expect(isCurrencyColumn('user_id')).toBe(false);
    expect(isCurrencyColumn('event_name')).toBe(false);
    expect(isCurrencyColumn('row_count')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// formatDisplayValue
// ---------------------------------------------------------------------------

describe('formatDisplayValue', () => {
  describe('null / undefined handling', () => {
    it('returns em-dash for null', () => {
      expect(formatDisplayValue(null, 'any_col')).toBe('\u2014');
    });

    it('returns em-dash for undefined', () => {
      expect(formatDisplayValue(undefined, 'any_col')).toBe('\u2014');
    });
  });

  describe('non-numeric strings (STRING / TIMESTAMP / DATE / BOOL as string)', () => {
    it('returns the string as-is when it is not parseable as a number', () => {
      expect(formatDisplayValue('hello', 'name')).toBe('hello');
    });

    it('returns timestamp strings as-is', () => {
      const ts = '2024-01-15T12:30:00Z';
      expect(formatDisplayValue(ts, 'created_at')).toBe(ts);
    });

    it('returns date strings as-is', () => {
      expect(formatDisplayValue('2024-01-15', 'birth_date')).toBe('2024-01-15');
    });

    it('returns boolean strings as-is', () => {
      expect(formatDisplayValue('true', 'is_active')).toBe('true');
      expect(formatDisplayValue('false', 'is_active')).toBe('false');
    });

    it('handles empty string', () => {
      // Number('') is 0, so the numeric formatter returns '0'
      expect(formatDisplayValue('', 'some_col')).toBe('0');
    });
  });

  describe('INT64 values (plain numbers)', () => {
    it('formats small integers without commas', () => {
      expect(formatDisplayValue(42, 'row_count')).toBe('42');
    });

    it('formats integers with locale grouping', () => {
      const result = formatDisplayValue(1234567, 'event_count');
      // Locale-dependent, but should contain the digits
      expect(result).toContain('1');
      expect(result).toContain('234');
      expect(result).toContain('567');
    });

    it('handles zero', () => {
      expect(formatDisplayValue(0, 'count')).toBe('0');
    });

    it('handles negative integers', () => {
      const result = formatDisplayValue(-500, 'delta');
      expect(result).toContain('500');
      expect(result).toMatch(/^-/);
    });
  });

  describe('FLOAT64 values', () => {
    it('formats decimals with up to 2 fraction digits', () => {
      const result = formatDisplayValue(3.14159, 'ratio');
      // Should be truncated/rounded to at most 2 decimals
      expect(result).toMatch(/3\.14/);
    });

    it('handles string-encoded numbers (BigQuery INT64 as string)', () => {
      const result = formatDisplayValue('9007199254740993', 'big_id');
      // Should parse and format the number
      expect(result).toBeTruthy();
    });
  });

  describe('currency columns', () => {
    it('prepends $ for revenue column', () => {
      const result = formatDisplayValue(1500, 'revenue');
      expect(result).toContain('$');
      expect(result).toContain('1');
      expect(result).toContain('500');
    });

    it('formats small currency values with 2 decimal places', () => {
      const result = formatDisplayValue(0.75, 'price');
      expect(result).toBe('$0.75');
    });

    it('rounds large currency values to whole numbers', () => {
      const result = formatDisplayValue(1234.56, 'cost');
      expect(result).toContain('$');
      expect(result).toContain('1');
      expect(result).toContain('235');
    });
  });

  describe('edge cases', () => {
    it('handles very large numbers', () => {
      const result = formatDisplayValue(999999999999, 'big_value');
      expect(result).toBeTruthy();
      expect(typeof result).toBe('string');
    });

    it('handles NaN-producing string input', () => {
      expect(formatDisplayValue('not-a-number', 'col')).toBe('not-a-number');
    });
  });
});

// ---------------------------------------------------------------------------
// formatCompactValue
// ---------------------------------------------------------------------------

describe('formatCompactValue', () => {
  it('formats billions with B suffix', () => {
    expect(formatCompactValue(1_500_000_000, 'users')).toBe('1.5B');
  });

  it('formats millions with M suffix', () => {
    expect(formatCompactValue(2_300_000, 'events')).toBe('2.3M');
  });

  it('formats thousands with K suffix', () => {
    expect(formatCompactValue(45_000, 'sessions')).toBe('45K');
  });

  it('formats small values as plain numbers', () => {
    expect(formatCompactValue(123, 'count')).toBe('123');
  });

  it('adds $ prefix for currency columns', () => {
    expect(formatCompactValue(5_000_000, 'revenue')).toBe('$5M');
    expect(formatCompactValue(1_200, 'price')).toBe('$1.2K');
  });

  it('handles negative values', () => {
    expect(formatCompactValue(-3_000_000, 'delta')).toBe('-3M');
  });

  it('handles zero', () => {
    expect(formatCompactValue(0, 'count')).toBe('0');
  });
});
