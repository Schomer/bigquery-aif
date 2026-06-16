#!/usr/bin/env node
// scripts/setup-reference-dataset.mjs
// Runs the reference dataset setup SQL from docs/reference-dataset.md
// Usage:
//   node scripts/setup-reference-dataset.mjs
//   (reads GOOGLE_ACCESS_TOKEN and GOOGLE_PROJECT_ID from .env.local)

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// Load .env.local
const envPath = join(ROOT, '.env.local');
const envLines = readFileSync(envPath, 'utf-8').split('\n');
const env = {};
for (const line of envLines) {
  const [k, ...v] = line.split('=');
  if (k && !k.startsWith('#')) env[k.trim()] = v.join('=').trim();
}

const PROJECT = env.GOOGLE_PROJECT_ID || 'malloy-data';
const TOKEN = env.GOOGLE_ACCESS_TOKEN;
const BQ_API = 'https://bigquery.googleapis.com/bigquery/v2';

if (!TOKEN) {
  console.error(`
ERROR: No GOOGLE_ACCESS_TOKEN set in .env.local

To get a fresh token:
1. Open http://localhost:5800 in your browser
2. Open DevTools (Cmd+Option+I) → Network tab
3. Click any operation that queries BigQuery
4. In the network tab, find a request to bigquery.googleapis.com
5. Copy the Authorization header value (the part after "Bearer ")
6. Paste it into .env.local as: GOOGLE_ACCESS_TOKEN=ya29.xxx...
7. Run this script again
`);
  process.exit(1);
}

const headers = {
  'Authorization': `Bearer ${TOKEN}`,
  'Content-Type': 'application/json',
};

async function runQuery(sql, description) {
  console.log(`\n▶ ${description}`);
  const trimmed = sql.trim();
  if (!trimmed) return;

  // Create job
  const jobRes = await fetch(`${BQ_API}/projects/${PROJECT}/jobs`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      configuration: {
        query: { query: trimmed, useLegacySql: false, location: 'US' },
      },
    }),
  });

  const job = await jobRes.json();
  if (job.error) {
    console.error(`  ERROR: ${job.error.message}`);
    return false;
  }

  const jobId = job.jobReference?.jobId;
  console.log(`  Job: ${jobId}`);

  // Poll
  for (let i = 0; i < 120; i++) {
    await new Promise(r => setTimeout(r, 1000));
    const statusRes = await fetch(`${BQ_API}/projects/${PROJECT}/jobs/${jobId}`, { headers });
    const status = await statusRes.json();
    const state = status.status?.state;

    if (state === 'DONE') {
      const errors = status.status?.errors;
      if (errors?.length) {
        // Table already exists is fine
        if (errors[0].message?.includes('Already Exists')) {
          console.log(`  Already exists — skipping`);
          return true;
        }
        console.error(`  ERROR: ${errors[0].message}`);
        return false;
      }
      const rows = status.statistics?.query?.numDmlAffectedRows;
      console.log(`  Done${rows ? ` (${rows} rows affected)` : ''}`);
      return true;
    }
  }
  console.error(`  Timed out`);
  return false;
}

// ─── Setup SQL ─────────────────────────────────────────────────────────────────

const SETUP_STEPS = [
  {
    description: 'Create ecommerce schema',
    sql: `CREATE SCHEMA IF NOT EXISTS \`${PROJECT}.ecommerce\``,
  },
  {
    description: 'Copy orders table',
    sql: `CREATE TABLE IF NOT EXISTS \`${PROJECT}.ecommerce.orders\` AS
SELECT * FROM \`bigquery-public-data.thelook_ecommerce.orders\``,
  },
  {
    description: 'Copy order_items table (with updated_at column)',
    sql: `CREATE TABLE IF NOT EXISTS \`${PROJECT}.ecommerce.order_items\` AS
SELECT *, CURRENT_TIMESTAMP() AS updated_at
FROM \`bigquery-public-data.thelook_ecommerce.order_items\``,
  },
  {
    description: 'Copy products table',
    sql: `CREATE TABLE IF NOT EXISTS \`${PROJECT}.ecommerce.products\` AS
SELECT * FROM \`bigquery-public-data.thelook_ecommerce.products\``,
  },
  {
    description: 'Copy users table',
    sql: `CREATE TABLE IF NOT EXISTS \`${PROJECT}.ecommerce.users\` AS
SELECT * FROM \`bigquery-public-data.thelook_ecommerce.users\``,
  },
  {
    description: 'Inject 15 duplicate rows into order_items (for dedup testing)',
    sql: `INSERT INTO \`${PROJECT}.ecommerce.order_items\`
SELECT * EXCEPT(updated_at), TIMESTAMP_ADD(updated_at, INTERVAL 1 DAY)
FROM \`${PROJECT}.ecommerce.order_items\`
WHERE id IN (
  SELECT id FROM \`${PROJECT}.ecommerce.order_items\` ORDER BY id LIMIT 15
)`,
  },
  {
    description: 'Create product_reviews table (sentiment/translation test data)',
    sql: `CREATE TABLE IF NOT EXISTS \`${PROJECT}.ecommerce.product_reviews\` AS
WITH sample_products AS (
  SELECT id AS product_id, ROW_NUMBER() OVER () AS rn
  FROM \`${PROJECT}.ecommerce.products\`
  LIMIT 8
),
sample_users AS (
  SELECT id AS user_id, ROW_NUMBER() OVER () AS rn
  FROM \`${PROJECT}.ecommerce.users\`
  LIMIT 8
),
review_text AS (
  SELECT * FROM UNNEST([
    STRUCT(1 AS rn, 5 AS rating, 'Absolutely love this — fits perfectly and the material feels premium.' AS review_text, 'en' AS language),
    STRUCT(2, 2, 'Sleeves run way too long and the zipper jammed within a week. Disappointed.', 'en'),
    STRUCT(3, 4, 'Good value for the price, though it runs a size small.', 'en'),
    STRUCT(4, 1, 'Arrived with a tear in the lining. Returning this.', 'en'),
    STRUCT(5, 5, 'Très confortable et chaud, parfait pour l\\'hiver !', 'fr'),
    STRUCT(6, 3, 'Calidad decente pero el color es más claro de lo que se ve en la foto.', 'es'),
    STRUCT(7, 5, 'Exactly as described, fast shipping too.', 'en'),
    STRUCT(8, 2, 'Stitching came undone after light use.', 'en')
  ])
)
SELECT
  rn AS review_id,
  sp.product_id,
  su.user_id,
  rt.rating,
  rt.review_text,
  rt.language,
  TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL CAST(RAND() * 180 AS INT64) DAY) AS created_at
FROM review_text rt
JOIN sample_products sp USING (rn)
JOIN sample_users su USING (rn)`,
  },
];

// ─── Verify results ────────────────────────────────────────────────────────────

async function verifySetup() {
  console.log('\n\n── Verification ──────────────────────────────────────');
  const checks = [
    { table: 'orders', col: 'order_id' },
    { table: 'order_items', col: 'id' },
    { table: 'products', col: 'id' },
    { table: 'users', col: 'id' },
    { table: 'product_reviews', col: 'review_id' },
  ];

  for (const { table, col } of checks) {
    const sql = `SELECT COUNT(*) as cnt FROM \`${PROJECT}.ecommerce.${table}\``;
    const jobRes = await fetch(`${BQ_API}/projects/${PROJECT}/jobs`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        configuration: { query: { query: sql, useLegacySql: false, location: 'US' } },
      }),
    });
    const job = await jobRes.json();
    const jobId = job.jobReference?.jobId;

    for (let i = 0; i < 30; i++) {
      await new Promise(r => setTimeout(r, 1000));
      const res = await fetch(`${BQ_API}/projects/${PROJECT}/queries/${jobId}?maxResults=1`, { headers });
      const data = await res.json();
      if (data.jobComplete) {
        const count = data.rows?.[0]?.f?.[0]?.v ?? '?';
        console.log(`  ${table.padEnd(20)} ${Number(count).toLocaleString()} rows`);
        break;
      }
    }
  }
}

// ─── Main ──────────────────────────────────────────────────────────────────────

console.log(`\nHey Data Now — Reference Dataset Setup`);
console.log(`Project: ${PROJECT}`);
console.log(`═══════════════════════════════════════`);

let success = 0;
for (const step of SETUP_STEPS) {
  const ok = await runQuery(step.sql, step.description);
  if (ok !== false) success++;
}

console.log(`\n\n${success}/${SETUP_STEPS.length} steps completed`);
await verifySetup();
console.log('\nDone. You can now run eval traces against the ecommerce dataset.\n');
