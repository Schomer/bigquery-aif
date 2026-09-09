import { describe, it, expect } from 'vitest';
import { substituteSqlParameters } from '../app-executor';

describe('substituteSqlParameters', () => {
  it('substitutes date range placeholders correctly', () => {
    const template = "SELECT * FROM `p.d.t` WHERE date >= '{{start_date}}' AND date <= '{{end_date}}'";
    const result = substituteSqlParameters(template, { start_date: '2024-01-01', end_date: '2024-12-31' });
    expect(result).toBe("SELECT * FROM `p.d.t` WHERE date >= '2024-01-01' AND date <= '2024-12-31'");
  });

  it('substitutes string parameters with single quotes and escapes', () => {
    const template = "SELECT * FROM `p.d.t` WHERE country = '{{country}}'";
    const result = substituteSqlParameters(template, { country: "Côte d'Ivoire" });
    expect(result).toBe("SELECT * FROM `p.d.t` WHERE country = 'Côte d''Ivoire'");
  });

  it('substitutes numeric parameters unquoted', () => {
    const template = 'SELECT * FROM `p.d.t` WHERE min_score >= {{min_score}}';
    const result = substituteSqlParameters(template, { min_score: 85 });
    expect(result).toBe('SELECT * FROM `p.d.t` WHERE min_score >= 85');
  });

  it('substitutes boolean parameters unquoted', () => {
    const template = 'SELECT * FROM `p.d.t` WHERE is_active = {{is_active}}';
    const result = substituteSqlParameters(template, { is_active: true });
    expect(result).toBe('SELECT * FROM `p.d.t` WHERE is_active = TRUE');
  });

  it('substitutes multi-select array into SQL IN list', () => {
    const template = 'SELECT * FROM `p.d.t` WHERE region IN ({{regions}})';
    const result = substituteSqlParameters(template, { regions: ['US-East', 'US-West', 'EU-Central'] });
    expect(result).toBe("SELECT * FROM `p.d.t` WHERE region IN ('US-East', 'US-West', 'EU-Central')");
  });
});
