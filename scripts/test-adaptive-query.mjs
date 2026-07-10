#!/usr/bin/env node
// scripts/test-adaptive-query.mjs
// Tests the adaptive query pipeline by directly calling the Gemini API
// with BigQuery tools, simulating what the browser-side code does.

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// Load env
const envPath = join(ROOT, '.env.local');
const envLines = readFileSync(envPath, 'utf-8').split('\n');
const env = {};
for (const line of envLines) {
  const [k, ...v] = line.split('=');
  if (k && !k.startsWith('#') && k.trim()) env[k.trim()] = v.join('=').trim();
}

const PROJECT = env.GOOGLE_PROJECT_ID || 'malloy-data';
const GEMINI_KEY = env.NEXT_PUBLIC_GEMINI_API_KEY || env.GOOGLE_GENERATIVE_AI_API_KEY || '';

// Get access token for BigQuery calls
async function getAccessToken() {
  const credsPath = join(ROOT, '.oauth-credentials.json');
  if (existsSync(credsPath)) {
    const creds = JSON.parse(readFileSync(credsPath, 'utf-8'));
    if (creds.refresh_token) {
      const res = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: creds.client_id,
          client_secret: creds.client_secret,
          refresh_token: creds.refresh_token,
          grant_type: 'refresh_token',
        }),
      });
      const data = await res.json();
      if (data.access_token) return data.access_token;
    }
  }
  return env.GOOGLE_ACCESS_TOKEN || '';
}

// BigQuery REST helpers
const BQ_BASE = 'https://bigquery.googleapis.com/bigquery/v2/projects';
let ACCESS_TOKEN = '';

async function bqFetch(url, init) {
  const res = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${ACCESS_TOKEN}`,
      ...(init?.headers || {}),
    },
  });
  const data = await res.json();
  if (!res.ok || data.error) {
    throw new Error(data?.error?.message || `HTTP ${res.status}`);
  }
  return data;
}

async function executeQuery(sql) {
  const data = await bqFetch(`${BQ_BASE}/${encodeURIComponent(PROJECT)}/queries`, {
    method: 'POST',
    body: JSON.stringify({ query: sql, useLegacySql: false, maxResults: 1000 }),
  });
  const fields = data.schema?.fields ?? [];
  const columns = fields.map(f => f.name);
  const rawRows = data.rows ?? [];
  const rows = rawRows.map(r => (r.f ?? []).map(cell => cell.v ?? null));
  return { columns, rows, rowCount: parseInt(data.totalRows ?? '0', 10) };
}

async function fetchTableSchema(dataset, table) {
  const data = await bqFetch(
    `${BQ_BASE}/${encodeURIComponent(PROJECT)}/datasets/${encodeURIComponent(dataset)}/tables/${encodeURIComponent(table)}`
  );
  const fields = data.schema?.fields ?? [];
  return { columns: fields.map(f => ({ name: f.name, type: f.type })) };
}

async function listTables(dataset) {
  const data = await bqFetch(
    `${BQ_BASE}/${encodeURIComponent(PROJECT)}/datasets/${encodeURIComponent(dataset)}/tables?maxResults=200`
  );
  return { tables: (data.tables || []).map(t => t.tableReference?.tableId || '') };
}

async function listDatasets() {
  const data = await bqFetch(
    `${BQ_BASE}/${encodeURIComponent(PROJECT)}/datasets?maxResults=100`
  );
  return { datasets: (data.datasets || []).map(d => d.datasetReference?.datasetId || '') };
}

// Tool definitions for Gemini
const TOOLS = [
  {
    name: 'run_query',
    description: 'Execute a GoogleSQL query against BigQuery. Always wrap table refs in backticks: `project.dataset.table`.',
    parameters: { type: 'OBJECT', properties: { sql: { type: 'STRING' } }, required: ['sql'] },
  },
  {
    name: 'get_table_schema',
    description: 'Get column names and types for a table.',
    parameters: { type: 'OBJECT', properties: { dataset: { type: 'STRING' }, table: { type: 'STRING' } }, required: ['dataset', 'table'] },
  },
  {
    name: 'list_tables',
    description: 'List all tables in a dataset.',
    parameters: { type: 'OBJECT', properties: { dataset: { type: 'STRING' } }, required: ['dataset'] },
  },
  {
    name: 'list_datasets',
    description: 'List all datasets in the project.',
    parameters: { type: 'OBJECT', properties: {}, required: [] },
  },
];

async function executeTool(name, args) {
  switch (name) {
    case 'run_query': {
      const result = await executeQuery(args.sql);
      return { columns: result.columns, rowCount: result.rowCount, sampleRows: result.rows.slice(0, 10) };
    }
    case 'get_table_schema':
      return fetchTableSchema(args.dataset, args.table);
    case 'list_tables':
      return listTables(args.dataset);
    case 'list_datasets':
      return listDatasets();
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

// Gemini tool-calling loop (mirrors callGeminiWithTools)
async function runAgentLoop(systemPrompt, userMessage) {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${GEMINI_KEY}`;
  const contents = [{ role: 'user', parts: [{ text: userMessage }] }];
  const toolCalls = [];

  for (let i = 0; i < 10; i++) {
    const body = {
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents,
      tools: [{ functionDeclarations: TOOLS }],
      toolConfig: { functionCallingConfig: { mode: 'AUTO' } },
      generationConfig: { temperature: 0.1 },
    };

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    if (!res.ok || data.error) {
      throw new Error(`Gemini error: ${data?.error?.message || res.status}`);
    }

    const parts = data.candidates?.[0]?.content?.parts;
    if (!parts) throw new Error('No parts in response');

    const fcs = parts.filter(p => p.functionCall);
    if (fcs.length === 0) {
      const text = parts.find(p => p.text)?.text || '';
      return { textResponse: text, toolCalls };
    }

    contents.push({ role: 'model', parts });

    const responseParts = [];
    for (const fc of fcs) {
      const { name, args } = fc.functionCall;
      console.log(`    -> Tool: ${name}(${JSON.stringify(args).substring(0, 100)})`);
      try {
        const result = await executeTool(name, args || {});
        toolCalls.push({ name, args, result });
        responseParts.push({ functionResponse: { name, response: { result } } });
      } catch (err) {
        console.log(`    -> ERROR: ${err.message}`);
        toolCalls.push({ name, args, result: { error: err.message } });
        responseParts.push({ functionResponse: { name, response: { error: err.message } } });
      }
    }
    contents.push({ role: 'user', parts: responseParts });
  }

  return { textResponse: 'Max iterations reached', toolCalls };
}

// Test runner
async function runTest(name, message, dataset) {
  const systemPrompt = `You are a data assistant for BigQuery. When a user asks you to do something with their data, your job is to actually do it.

The BigQuery project is: ${PROJECT}
The active dataset is: ${dataset || 'not specified'}
Today's date: ${new Date().toISOString().split('T')[0]}

CRITICAL: Always wrap fully qualified table references in literal backticks: \`${PROJECT}.DATASET.tablename\`

You have tools to interact with BigQuery. Follow these rules strictly:

EFFICIENCY RULES (most important):
1. If the user names a specific table (e.g. "orders in ecomm"), go DIRECTLY to run_query or get_table_schema. Do NOT call list_tables first -- you already know the table.
2. For simple queries (SELECT *, LIMIT, COUNT, basic WHERE), call run_query directly without fetching schema. You do not need column names to write SELECT * FROM table LIMIT N.
3. Only call get_table_schema when you genuinely need column names to write a query (aggregations, JOINs, specific column references).
4. Only call list_tables when the user does NOT name a specific table and you need to find one.
5. Only call list_datasets when the user does NOT name a specific dataset.
6. STOP after run_query succeeds. Do not call additional tools after you have query results. Just summarize the results and respond.

After running the query, provide a brief one-line summary of what the results show.`;

  console.log(`\n${'='.repeat(70)}`);
  console.log(`TEST: ${name}`);
  console.log(`  Message: "${message}"`);
  console.log(`${'='.repeat(70)}`);

  const start = Date.now();
  try {
    const result = await runAgentLoop(systemPrompt, message);
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);

    // Find the last successful run_query (earlier ones may have errored before LLM self-corrected)
    const queryCalls = result.toolCalls.filter(tc => tc.name === 'run_query');
    const queryCall = queryCalls.reverse().find(tc => tc.result?.columns) || queryCalls[0];
    const toolNames = result.toolCalls.map(tc => tc.name);

    console.log(`  Time: ${elapsed}s`);
    console.log(`  Tools called: ${toolNames.join(' -> ')}`);
    console.log(`  LLM summary: ${result.textResponse.substring(0, 150)}`);

    if (queryCall?.result?.columns) {
      console.log(`  Columns: ${queryCall.result.columns.join(', ')}`);
      console.log(`  Rows: ${queryCall.result.rowCount}`);
    }

    const pass = queryCall?.result?.rowCount > 0;
    console.log(`  Result: ${pass ? 'PASS' : 'FAIL'}`);
    return { name, pass, time: elapsed, tools: toolNames };
  } catch (err) {
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    console.log(`  Time: ${elapsed}s`);
    console.log(`  ERROR: ${err.message}`);
    return { name, pass: false, time: elapsed, error: err.message };
  }
}

async function main() {
  console.log('Adaptive Query Pipeline -- Direct Gemini Test');
  console.log(`Project: ${PROJECT}`);
  console.log(`Gemini Key: ${GEMINI_KEY ? '***' + GEMINI_KEY.slice(-4) : 'MISSING'}`);

  ACCESS_TOKEN = await getAccessToken();
  if (!ACCESS_TOKEN) {
    console.error('No access token. Set up .oauth-credentials.json');
    process.exit(1);
  }
  console.log('BigQuery access token acquired.');

  const results = [];

  results.push(await runTest(
    '1. Simple preview',
    'Show me the first 10 rows of orders in ecomm',
    'ecomm'
  ));

  results.push(await runTest(
    '2. Analytical query',
    'What are the top 5 products by revenue in ecomm?',
    'ecomm'
  ));

  results.push(await runTest(
    '3. Ambiguous query',
    'Show me recent sales data',
    'ecomm'
  ));

  results.push(await runTest(
    '4. Repeat (simulated cache hit)',
    'Show me the first 10 rows of orders in ecomm',
    'ecomm'
  ));

  console.log(`\n${'='.repeat(70)}`);
  console.log('SUMMARY');
  console.log(`${'='.repeat(70)}`);
  for (const r of results) {
    const icon = r.pass ? '[PASS]' : '[FAIL]';
    const tools = r.tools ? ` (${r.tools.join(' -> ')})` : '';
    console.log(`  ${icon} ${r.name} -- ${r.time}s${tools}${r.error ? ' -- ' + r.error : ''}`);
  }

  const passed = results.filter(r => r.pass).length;
  console.log(`\n  ${passed}/${results.length} tests passed.`);
}

main().catch(console.error);
