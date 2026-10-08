// src/lib/__tests__/schema-progressive.test.ts
// Schema fetching: fast base result for the agent, background enrichment that
// the UI path waits for (bounded) and that is merged into the cached result.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../gis-auth', () => ({
  getAccessToken: () => 'test-token',
  setAccessToken: vi.fn(),
}));

import { fetchSchema, resetSchemaFetchState, ENRICH_WAIT_MS } from '../skills/schema';
import { clearCache } from '../schema-cache';

const BQ = 'https://bigquery.googleapis.com/bigquery/v2/projects';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** A promise with externally controlled resolution. */
function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

/** Build a jobs.query-style response from column names + rows of raw strings. */
function queryResponse(columns: Array<{ name: string; type: string }>, rows: Array<Array<string | null>>) {
  return {
    jobComplete: true,
    jobReference: { jobId: 'meta_job' },
    schema: { fields: columns },
    rows: rows.map((r) => ({ f: r.map((v) => ({ v })) })),
    totalRows: String(rows.length),
  };
}

type Route = (url: string, init?: RequestInit) => Promise<Response> | Response;

function installRouter(routes: Array<{ match: (url: string, init?: RequestInit) => boolean; handle: Route }>) {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const mock = vi.fn(async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    const route = routes.find((r) => r.match(url, init));
    if (!route) throw new Error(`No route for ${url}`);
    return route.handle(url, init);
  });
  vi.stubGlobal('fetch', mock);
  return { mock, calls };
}

const isQueryPost = (url: string, init?: RequestInit) => url.endsWith('/queries') && init?.method === 'POST';
const sqlOf = (init?: RequestInit) => JSON.parse(String(init?.body)).query as string;

beforeEach(() => {
  clearCache();
  resetSchemaFetchState();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('TABLE scope', () => {
  const tableMeta = {
    schema: { fields: [{ name: 'id', type: 'INTEGER', mode: 'REQUIRED' }, { name: 'name', type: 'STRING' }] },
    numRows: '10',
    numBytes: '2048',
    type: 'TABLE',
  };

  it('enrich: false resolves as soon as table metadata lands, before the constraints query', async () => {
    const constraints = deferred<Response>();
    const { calls } = installRouter([
      { match: (u) => u.endsWith('/datasets/ds/tables/t'), handle: () => jsonResponse(tableMeta) },
      { match: isQueryPost, handle: () => constraints.promise },
    ]);

    const base = await fetchSchema('ds', 't', 'proj', { enrich: false });

    expect(base.scope).toBe('TABLE');
    expect(base.columns.map((c) => c.name)).toEqual(['id', 'name']);
    expect(base.rowCount).toBe(10);
    expect(base.tableConstraints).toEqual({ primaryKey: [], foreignKeys: [] });
    // The constraints query was started in the background but has not resolved
    expect(calls.filter((c) => isQueryPost(c.url, c.init))).toHaveLength(1);
    expect(sqlOf(calls[1].init)).toContain('INFORMATION_SCHEMA.TABLE_CONSTRAINTS');

    // Now let the constraints land; the UI path picks them up from the same cached object
    constraints.resolve(jsonResponse(queryResponse(
      [
        { name: 'CONSTRAINT_TYPE', type: 'STRING' }, { name: 'COLUMN_NAME', type: 'STRING' },
        { name: 'ref_project', type: 'STRING' }, { name: 'ref_dataset', type: 'STRING' },
        { name: 'ref_table', type: 'STRING' }, { name: 'ref_column', type: 'STRING' },
      ],
      [['PRIMARY KEY', 'id', null, null, null, null]],
    )));

    const full = await fetchSchema('ds', 't', 'proj');
    expect(full).toBe(base); // same cached object, patched in place
    expect(full.tableConstraints.primaryKey).toEqual(['id']);

    // No second metadata fetch and no second constraints query
    expect(calls.filter((c) => c.url.endsWith('/datasets/ds/tables/t'))).toHaveLength(1);
    expect(calls.filter((c) => isQueryPost(c.url, c.init))).toHaveLength(1);
  });

  it('enrich: true waits at most ENRICH_WAIT_MS and renders without constraints if they are slow', async () => {
    vi.useFakeTimers();
    const neverResolves = deferred<Response>();
    installRouter([
      { match: (u) => u.endsWith('/datasets/ds/tables/slow'), handle: () => jsonResponse(tableMeta) },
      { match: isQueryPost, handle: () => neverResolves.promise },
    ]);

    const pending = fetchSchema('ds', 'slow', 'proj');
    await vi.advanceTimersByTimeAsync(ENRICH_WAIT_MS);
    const result = await pending;

    expect(result.columns).toHaveLength(2);
    expect(result.tableConstraints.primaryKey).toEqual([]);
  });

  it('deduplicates concurrent base fetches for the same key', async () => {
    const constraints = deferred<Response>();
    const { calls } = installRouter([
      { match: (u) => u.endsWith('/datasets/ds/tables/t'), handle: () => jsonResponse(tableMeta) },
      { match: isQueryPost, handle: () => constraints.promise },
    ]);

    const [a, b] = await Promise.all([
      fetchSchema('ds', 't', 'proj', { enrich: false }),
      fetchSchema('ds', 't', 'proj', { enrich: false }),
    ]);
    expect(a).toBe(b);
    expect(calls.filter((c) => c.url.endsWith('/datasets/ds/tables/t'))).toHaveLength(1);
    constraints.resolve(jsonResponse(queryResponse([{ name: 'CONSTRAINT_TYPE', type: 'STRING' }], [])));
  });
});

describe('DATASET scope', () => {
  const tableList = {
    tables: [
      { tableReference: { tableId: 'orders' }, type: 'TABLE', numRows: '100' },
      { tableReference: { tableId: 'customers' }, type: 'TABLE', numRows: '50' },
    ],
  };

  it('returns the table list immediately and merges counts/frequency when the UI asks', async () => {
    const columnCounts = deferred<Response>();
    const frequency = deferred<Response>();
    const { calls } = installRouter([
      { match: (u) => u.includes('/datasets/ds/tables?'), handle: () => jsonResponse(tableList) },
      { match: (u, i) => isQueryPost(u, i) && sqlOf(i).includes('INFORMATION_SCHEMA.COLUMNS'), handle: () => columnCounts.promise },
      { match: (u, i) => isQueryPost(u, i) && sqlOf(i).includes('JOBS_BY_PROJECT'), handle: () => frequency.promise },
    ]);

    const base = await fetchSchema('ds', undefined, 'proj', { enrich: false });
    expect(base.scope).toBe('DATASET');
    expect(base.columns.map((c) => c.name)).toEqual(['orders', 'customers']);
    expect(base.columns[0].columnCount).toBeNull();
    expect(base.columns[0].queryFrequency).toBe(0);
    // Both enrichment queries were started in parallel
    expect(calls.filter((c) => isQueryPost(c.url, c.init))).toHaveLength(2);

    columnCounts.resolve(jsonResponse(queryResponse(
      [{ name: 'table_name', type: 'STRING' }, { name: 'column_count', type: 'INTEGER' }],
      [['orders', '12'], ['customers', '7']],
    )));
    frequency.resolve(jsonResponse(queryResponse(
      [{ name: 'table_name', type: 'STRING' }, { name: 'freq', type: 'INTEGER' }],
      [['customers', '30'], ['orders', '5']],
    )));

    const full = await fetchSchema('ds', undefined, 'proj');
    expect(full).toBe(base);
    // Re-sorted by query frequency (customers first), with column counts merged
    expect(full.columns.map((c) => c.name)).toEqual(['customers', 'orders']);
    expect(full.columns[0].columnCount).toBe(7);
    expect(full.columns[0].queryFrequency).toBe(30);
    expect(full.columns[1].columnCount).toBe(12);
  });

  it('keeps the base result usable when enrichment queries fail', async () => {
    installRouter([
      { match: (u) => u.includes('/datasets/ds/tables?'), handle: () => jsonResponse(tableList) },
      { match: isQueryPost, handle: () => jsonResponse({ error: { message: 'Access Denied' } }, 403) },
    ]);
    const result = await fetchSchema('ds', undefined, 'proj');
    expect(result.columns).toHaveLength(2);
    expect(result.columns[0].columnCount).toBeNull();
  });
});

describe('PROJECT scope', () => {
  it('lists datasets without table counts, then fills counts in the background', async () => {
    const counts = deferred<Response>();
    const { calls } = installRouter([
      { match: (u) => u.includes('/proj/datasets?'), handle: () => jsonResponse({
        datasets: [{ datasetReference: { datasetId: 'a' } }, { datasetReference: { datasetId: 'b' } }],
      }) },
      { match: (u) => u.includes('/datasets/a/tables?'), handle: () => counts.promise },
      { match: (u) => u.includes('/datasets/b/tables?'), handle: () => jsonResponse({ totalItems: '3', tables: [] }) },
    ]);

    const base = await fetchSchema(undefined, undefined, 'proj', { enrich: false });
    expect(base.scope).toBe('PROJECT');
    expect(base.columns.map((c) => c.name)).toEqual(['a', 'b']);
    expect(base.columns.map((c) => c.tableCount)).toEqual([null, null]);
    // Count requests were kicked off in the background
    expect(calls.filter((c) => c.url.includes('/tables?'))).toHaveLength(2);

    counts.resolve(jsonResponse({ tables: [{}, {}, {}, {}, {}] }));
    const full = await fetchSchema(undefined, undefined, 'proj');
    expect(full).toBe(base);
    expect(full.columns.map((c) => c.tableCount)).toEqual([5, 3]);
  });

  it('starts a fresh enrichment when the cache entry is refetched', async () => {
    const { calls } = installRouter([
      { match: (u) => u.includes('/proj2/datasets?'), handle: () => jsonResponse({
        datasets: [{ datasetReference: { datasetId: 'only' } }],
      }) },
      { match: (u) => u.includes('/datasets/only/tables?'), handle: () => jsonResponse({ totalItems: '2' }) },
    ]);

    const first = await fetchSchema(undefined, undefined, 'proj2');
    expect(first.columns[0].tableCount).toBe(2);

    clearCache(); // simulate TTL expiry / invalidation
    const second = await fetchSchema(undefined, undefined, 'proj2');
    expect(second).not.toBe(first);
    expect(second.columns[0].tableCount).toBe(2);
    expect(calls.filter((c) => c.url.includes('/datasets/only/tables?'))).toHaveLength(2);
  });
});

describe('project-name-as-dataset guard', () => {
  it('ignores a dataset argument equal to the project name', async () => {
    installRouter([
      { match: (u) => u.includes('/proj3/datasets?'), handle: () => jsonResponse({ datasets: [] }) },
    ]);
    const result = await fetchSchema('proj3', undefined, 'proj3', { enrich: false });
    expect(result.scope).toBe('PROJECT');
  });
});
