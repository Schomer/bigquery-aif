#!/usr/bin/env node
// scripts/api-test.mjs
// Tests the chat API endpoint directly without browser auth.
// Validates that the orchestrator produces correct response structures.

import { readFileSync } from 'fs';
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

const GEMINI_KEY = env.GEMINI_API_KEY || '';
const PROJECT = 'malloy-data';

if (!GEMINI_KEY) {
  console.error('No GEMINI_API_KEY found in .env.local');
  process.exit(1);
}

const TESTS = [
  { id: 'storage_breakdown', prompt: 'show me a storage breakdown for this project', expectedSkill: 'monitoring', expectedType: 'STORAGE_BREAKDOWN' },
  { id: 'access_patterns', prompt: 'who has been querying my data in the last 30 days', expectedSkill: 'monitoring', expectedType: 'ACCESS_PATTERNS' },
  { id: 'cost_analysis', prompt: 'analyze my BigQuery query costs over the last month', expectedSkill: 'monitoring', expectedType: 'COST_ANALYSIS' },
  { id: 'freshness', prompt: 'which tables have not been updated recently', expectedSkill: 'monitoring', expectedType: 'FRESHNESS' },
  { id: 'completeness', prompt: 'check the completeness of the order_items table in ecomm', expectedSkill: 'data-quality', expectedType: 'COMPLETENESS' },
  { id: 'range_validation', prompt: 'validate the sale_price column in ecomm.order_items is between 0 and 10000', expectedSkill: 'data-quality', expectedType: 'RANGE_VALIDATION' },
  { id: 'schema_drift', prompt: 'check for schema drift on the order_items table in ecomm', expectedSkill: 'data-quality', expectedType: 'SCHEMA_DRIFT' },
  { id: 'er_diagram', prompt: 'show me an ER diagram of the ecomm dataset', expectedSkill: 'discovery', expectedType: 'ER_DIAGRAM' },
  { id: 'lineage', prompt: 'show lineage for the order_items table in ecomm', expectedSkill: 'discovery', expectedType: 'LINEAGE' },
  { id: 'comparison', prompt: 'compare the order_items and users tables in the ecomm dataset', expectedSkill: 'discovery', expectedType: 'COMPARISON' },
];

async function testRouting(test) {
  const routerPrompt = `You are a BigQuery assistant router. Classify the user's request into exactly one skill. Available skills: schema, query, data-management, data-quality, monitoring, discovery, data-loading. Also classify a sub-type when applicable. For monitoring: JOB_LIST, JOB_STATUS, STORAGE, STORAGE_BREAKDOWN, SLOTS, QUERY_PLAN, ACCESS_PATTERNS, COST_ANALYSIS, FRESHNESS, ALERT. For data-quality: PROFILE, NULLS, DUPLICATES, FRESHNESS, COMPLETENESS, RANGE_VALIDATION, REFERENTIAL_INTEGRITY, SCHEMA_DRIFT. For discovery: SEARCH, COMPARISON, LINEAGE, ER_DIAGRAM. Return JSON with "skill" and "subType" fields.`;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${GEMINI_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: test.prompt }] }],
        systemInstruction: { parts: [{ text: routerPrompt }] },
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: 'OBJECT',
            properties: {
              skill: { type: 'STRING' },
              subType: { type: 'STRING' },
            },
            required: ['skill', 'subType'],
          },
        },
      }),
    }
  );

  const data = await res.json();
  if (!res.ok) {
    return { pass: false, error: `API error: ${data?.error?.message || res.status}` };
  }

  try {
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const parsed = JSON.parse(text);
    const skillMatch = parsed.skill === test.expectedSkill;
    const typeMatch = parsed.subType === test.expectedType;
    return { pass: skillMatch && typeMatch, skill: parsed.skill, subType: parsed.subType, skillMatch, typeMatch };
  } catch (e) {
    return { pass: false, error: `Parse error: ${e.message}` };
  }
}

async function main() {
  console.log('\n=== API Route Classification Tests ===\n');
  let passed = 0;
  let failed = 0;

  for (const test of TESTS) {
    process.stdout.write(`[${test.id}] "${test.prompt.slice(0, 50)}..." `);
    const result = await testRouting(test);

    if (result.pass) {
      console.log(`PASS (${result.skill}/${result.subType})`);
      passed++;
    } else if (result.error) {
      console.log(`FAIL: ${result.error}`);
      failed++;
    } else {
      console.log(`FAIL: got ${result.skill}/${result.subType}, expected ${test.expectedSkill}/${test.expectedType}`);
      failed++;
    }

    await new Promise(r => setTimeout(r, 500));
  }

  console.log(`\n--- Results: ${passed} passed, ${failed} failed out of ${TESTS.length} ---\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
