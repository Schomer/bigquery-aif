// src/lib/__tests__/bigquery-client.test.ts
// Fast-path query execution: one synchronous jobs.query round trip for quick
// queries, server-side long-polling (no client sleep) for slow ones.

import { describe, it, expect, vi, afterEach } from 'vitest';

vi.mock('../gis-auth', () => ({
  getAccessToken: () => 'test-token',
  setAccessToken: vi.fn(),
}));

import { executeQuery, executeDml } from '../bigquery-client';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const completeResponse = {
  jobComplete: true,
  jobReference: { jobId: 'job_fast', location: 'US' },
  schema: {
    fields: [
      { name: 'n', type: 'INTEGER' },
      { name: 's', type: 'STRING' },
      { name: 'b', type: 'BOOLEAN' },
    ],
  },
  rows: [
    { f: [{ v: '1' }, { v: 'a' }, { v: 'true' }] },
    { f: [{ v: '2' }, { v: null }, { v: 'false' }] },
  ],
  totalRows: '2',
  totalBytesProcessed: '512',
};

function installFetch(responses: Array<Response | (() => Response)>): ReturnType<typeof vi.fn> {
  const queue = [...responses];
  const mock = vi.fn(async () => {
    const next = queue.shift();
    if (!next) throw new Error('Unexpected extra fetch call');
    return typeof next === 'function' ? next() : next;
  });
  vi.stubGlobal('fetch', mock);
  return mock;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('executeQuery fast path', () => {
  it('returns parsed rows from a single jobs.query round trip', async () => {
    const fetchMock = installFetch([jsonResponse(completeResponse)]);

    const result = await executeQuery('SELECT 1', 'my-proj');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://bigquery.googleapis.com/bigquery/v2/projects/my-proj/queries');
    expect(init.method).toBe('POST');
    const body = JSON.parse(String(init.body));
    expect(body).toMatchObject({
      query: 'SELECT 1',
      useLegacySql: false,
      maxResults: 1000,
      timeoutMs: 10000,
      useQueryCache: true,
    });
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer test-token');

    expect(result.columns).toEqual(['n', 's', 'b']);
    expect(result.columnTypes).toEqual(['INTEGER', 'STRING', 'BOOLEAN']);
    expect(result.rows).toEqual([[1, 'a', true], [2, null, false]]);
    expect(result.rowCount).toBe(2);
    expect(result.jobId).toBe('job_fast');
  });

  it('long-polls getQueryResults without any client-side sleep when the job is not complete', async () => {
    // Fake timers: if the implementation slept on setTimeout, this test would
    // never resolve because no timers are advanced.
    vi.useFakeTimers();

    const pending = {
      jobComplete: false,
      jobReference: { jobId: 'job_slow', location: 'us-central1' },
    };
    const stillPending = { ...pending, totalBytesProcessed: '4096' };
    const done = {
      ...completeResponse,
      jobReference: { jobId: 'job_slow', location: 'us-central1' },
    };
    const fetchMock = installFetch([
      jsonResponse(pending),
      jsonResponse(stillPending),
      jsonResponse(done),
    ]);

    const progress: Array<{ state: string; jobId: string; bytesProcessed?: number }> = [];
    const result = await executeQuery('SELECT slow FROM t', 'my-proj', {
      onProgress: (e) => progress.push(e),
    });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    const pollUrl1 = String(fetchMock.mock.calls[1][0]);
    const pollUrl2 = String(fetchMock.mock.calls[2][0]);
    for (const u of [pollUrl1, pollUrl2]) {
      expect(u.startsWith('https://bigquery.googleapis.com/bigquery/v2/projects/my-proj/queries/job_slow?')).toBe(true);
      const params = new URL(u).searchParams;
      expect(params.get('timeoutMs')).toBe('5000');
      expect(params.get('maxResults')).toBe('1000');
      expect(params.get('location')).toBe('us-central1');
    }
    // Polls are GET requests (no method/body)
    expect((fetchMock.mock.calls[1][1] as RequestInit | undefined)?.method).toBeUndefined();

    expect(progress).toHaveLength(2);
    expect(progress[0]).toEqual({ state: 'RUNNING', jobId: 'job_slow', bytesProcessed: undefined });
    expect(progress[1]).toEqual({ state: 'RUNNING', jobId: 'job_slow', bytesProcessed: 4096 });

    expect(result.rows).toHaveLength(2);
    expect(result.jobId).toBe('job_slow');
  });

  it('accepts the legacy progress-callback third argument', async () => {
    installFetch([
      jsonResponse({ jobComplete: false, jobReference: { jobId: 'j' } }),
      jsonResponse({ ...completeResponse, jobReference: { jobId: 'j' } }),
    ]);
    const cb = vi.fn();
    await executeQuery('SELECT 1', 'p', cb);
    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb.mock.calls[0][0]).toMatchObject({ jobId: 'j', state: 'RUNNING' });
  });

  it('omits the location parameter when the job reference has none', async () => {
    const fetchMock = installFetch([
      jsonResponse({ jobComplete: false, jobReference: { jobId: 'j2' } }),
      jsonResponse({ ...completeResponse, jobReference: { jobId: 'j2' } }),
    ]);
    await executeQuery('SELECT 1', 'p');
    const params = new URL(String(fetchMock.mock.calls[1][0])).searchParams;
    expect(params.has('location')).toBe(false);
  });

  it('forwards an abort signal to fetch', async () => {
    const fetchMock = installFetch([jsonResponse(completeResponse)]);
    const controller = new AbortController();
    await executeQuery('SELECT 1', 'p', { signal: controller.signal });
    expect((fetchMock.mock.calls[0][1] as RequestInit).signal).toBe(controller.signal);
  });

  it('surfaces HTTP errors with the BigQuery message', async () => {
    installFetch([jsonResponse({ error: { code: 404, message: 'Not found: Table p:d.t' } }, 404)]);
    await expect(executeQuery('SELECT * FROM `p.d.t`', 'p')).rejects.toThrow(
      'BigQuery query failed: Not found: Table p:d.t',
    );
  });

  it('treats a completed response with errors and no schema as a failure', async () => {
    installFetch([jsonResponse({ jobComplete: true, jobReference: { jobId: 'x' }, errors: [{ message: 'boom' }] })]);
    await expect(executeQuery('SELECT 1', 'p')).rejects.toThrow('BigQuery query failed: boom');
  });

  it('does not treat warnings as fatal when results came back', async () => {
    installFetch([jsonResponse({ ...completeResponse, errors: [{ message: 'just a warning' }] })]);
    const result = await executeQuery('SELECT 1', 'p');
    expect(result.rows).toHaveLength(2);
  });

  it('fails clearly if an incomplete response carries no job reference', async () => {
    installFetch([jsonResponse({ jobComplete: false })]);
    await expect(executeQuery('SELECT 1', 'p')).rejects.toThrow(/did not return a job reference/);
  });

  it('honours custom maxResults and initialWaitMs options', async () => {
    const fetchMock = installFetch([jsonResponse(completeResponse)]);
    await executeQuery('SELECT 1', 'p', { maxResults: 50, initialWaitMs: 2000 });
    const body = JSON.parse(String((fetchMock.mock.calls[0][1] as RequestInit).body));
    expect(body.maxResults).toBe(50);
    expect(body.timeoutMs).toBe(2000);
  });
});

describe('executeDml fast path', () => {
  it('returns affected rows from the synchronous response without polling', async () => {
    vi.useFakeTimers();
    const fetchMock = installFetch([
      jsonResponse({ jobComplete: true, jobReference: { jobId: 'dml_1' }, numDmlAffectedRows: '42' }),
    ]);

    const result = await executeDml('UPDATE `p.d.t` SET x = 1 WHERE TRUE', 'p');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://bigquery.googleapis.com/bigquery/v2/projects/p/queries');
    const body = JSON.parse(String(init.body));
    expect(body.timeoutMs).toBe(10000);
    expect(body.maxResults).toBe(1);
    expect(result).toEqual({ rowsAffected: 42, jobId: 'dml_1' });
  });

  it('long-polls slow DML statements and reads the final affected-row count', async () => {
    vi.useFakeTimers();
    installFetch([
      jsonResponse({ jobComplete: false, jobReference: { jobId: 'dml_2', location: 'EU' } }),
      jsonResponse({ jobComplete: true, jobReference: { jobId: 'dml_2', location: 'EU' }, numDmlAffectedRows: '7' }),
    ]);
    const result = await executeDml('DELETE FROM `p.d.t` WHERE TRUE', 'p');
    expect(result).toEqual({ rowsAffected: 7, jobId: 'dml_2' });
  });

  it('wraps failures with the DML prefix', async () => {
    installFetch([jsonResponse({ error: { message: 'Syntax error: Unexpected keyword' } }, 400)]);
    await expect(executeDml('UPDATE nope', 'p')).rejects.toThrow('BigQuery DML failed: Syntax error: Unexpected keyword');
  });
});
