// src/agent/__tests__/result-cache.test.ts
// The in-memory hot layer must serve reads instantly and keep working when
// IndexedDB is unavailable (as it is in this node test environment).

import { describe, it, expect } from 'vitest';
import { resultCache, estimateResultBytes, type CachedResult } from '../result-cache';

function makeResult(id: string, rowCount = 3): CachedResult {
  return {
    result_id: id,
    sql: `SELECT ${id}`,
    schema: [{ name: 'a', type: 'INTEGER' }, { name: 'b', type: 'STRING' }],
    rows: Array.from({ length: rowCount }, (_, i) => [i, `row_${i}`]),
    created: Date.now(),
    bytes: 0,
  };
}

describe('resultCache hot layer', () => {
  it('serves a just-put result from memory immediately', async () => {
    const start = Date.now();
    await resultCache.put(makeResult('res_hot_1'));
    const got = await resultCache.get('res_hot_1');
    expect(Date.now() - start).toBeLessThan(200);
    expect(got?.result_id).toBe('res_hot_1');
    expect(got?.rows).toHaveLength(3);
  });

  it('fills in a byte estimate when the caller passes 0', async () => {
    await resultCache.put(makeResult('res_bytes', 100));
    const got = await resultCache.get('res_bytes');
    expect(got?.bytes).toBeGreaterThan(0);
  });

  it('returns null for unknown ids without throwing', async () => {
    expect(await resultCache.get('does_not_exist')).toBeNull();
  });

  it('forgets entries beyond the hot-layer limit when IndexedDB is unavailable', async () => {
    for (let i = 0; i < 30; i++) {
      await resultCache.put(makeResult(`res_many_${i}`));
    }
    expect(await resultCache.get('res_many_29')).not.toBeNull();
    expect(await resultCache.get('res_many_0')).toBeNull();
  });

  it('removes entries from the hot layer on remove() and clear()', async () => {
    await resultCache.put(makeResult('res_rm'));
    await resultCache.remove('res_rm');
    expect(await resultCache.get('res_rm')).toBeNull();

    await resultCache.put(makeResult('res_clear'));
    await resultCache.clear();
    expect(await resultCache.get('res_clear')).toBeNull();
  });

  it('warm() never throws without IndexedDB', async () => {
    await expect(resultCache.warm()).resolves.toBeUndefined();
  });
});

describe('estimateResultBytes', () => {
  it('returns 0 for empty results', () => {
    expect(estimateResultBytes([])).toBe(0);
  });

  it('extrapolates from a sample for large results', () => {
    const small = estimateResultBytes(Array.from({ length: 10 }, () => [1, 'abc']));
    const large = estimateResultBytes(Array.from({ length: 1000 }, () => [1, 'abc']));
    expect(large).toBeGreaterThan(small * 50);
    expect(large).toBeLessThan(small * 150);
  });
});
