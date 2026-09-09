import { describe, it, expect, vi } from 'vitest';
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

describe('saveDocumentToBigQuery', () => {
  it('ensures dataset exists and persists dashboard document successfully', async () => {
    const { saveDocumentToBigQuery } = await import('../app-executor');
    const bqClient = await import('../bigquery-client');

    const ensureDsSpy = vi.spyOn(bqClient, 'ensureDatasetExists').mockResolvedValue({ datasetId: '_metadata', location: 'us' });
    const executeDmlSpy = vi.spyOn(bqClient, 'executeDml').mockResolvedValue({ rowsAffected: 1, jobId: 'job_123' });

    const doc = {
      id: 'doc_1',
      type: 'dashboard' as const,
      name: 'Test Dashboard',
      description: 'A test dashboard',
      tiles: [],
      globalFilters: [],
      createdAt: '2026-09-08T00:00:00Z',
      updatedAt: '2026-09-08T00:00:00Z',
    };

    const result = await saveDocumentToBigQuery(doc, 'malloy-data', '_metadata');

    expect(ensureDsSpy).toHaveBeenCalledWith('malloy-data', '_metadata');
    expect(executeDmlSpy).toHaveBeenCalledTimes(2); // CREATE TABLE + MERGE
    expect(result.success).toBe(true);
    expect(result.table).toBe('malloy-data._metadata._aif_dashboards');

    ensureDsSpy.mockRestore();
    executeDmlSpy.mockRestore();
  });

  it('falls back to existing dataset if creating _metadata fails', async () => {
    const { saveDocumentToBigQuery } = await import('../app-executor');
    const bqClient = await import('../bigquery-client');

    const ensureDsSpy = vi.spyOn(bqClient, 'ensureDatasetExists').mockRejectedValue(new Error('Permission denied'));
    const listDsSpy = vi.spyOn(bqClient, 'listDatasets').mockResolvedValue([{ datasetId: 'analytics_dataset', id: 'malloy-data:analytics_dataset', location: 'us' }]);
    const executeDmlSpy = vi.spyOn(bqClient, 'executeDml').mockResolvedValue({ rowsAffected: 1, jobId: 'job_123' });

    const doc = {
      id: 'doc_2',
      type: 'dashboard' as const,
      name: 'Fallback Dashboard',
      description: '',
      tiles: [],
      globalFilters: [],
      createdAt: '2026-09-08T00:00:00Z',
      updatedAt: '2026-09-08T00:00:00Z',
    };

    const result = await saveDocumentToBigQuery(doc, 'malloy-data', '_metadata');

    expect(ensureDsSpy).toHaveBeenCalledWith('malloy-data', '_metadata');
    expect(listDsSpy).toHaveBeenCalledWith('malloy-data');
    expect(result.success).toBe(true);
    expect(result.table).toBe('malloy-data.analytics_dataset._aif_dashboards');

    ensureDsSpy.mockRestore();
    listDsSpy.mockRestore();
    executeDmlSpy.mockRestore();
  });
});
