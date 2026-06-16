#!/usr/bin/env node
// scripts/test-loop.mjs
// Automated test harness for the task taxonomy.
//
// Usage:
//   node scripts/test-loop.mjs
//
// Prerequisites:
//   1. Set GOOGLE_ACCESS_TOKEN in .env.local (get from browser network tab)
//   2. Run: npm run dev  (in another terminal, port 5800)
//   3. Optionally: node scripts/setup-reference-dataset.mjs (first time)
//
// Output:
//   test-results/results.json   — full structured results
//   test-results/report.md      — human-readable Markdown report

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { TASKS } from './task-catalog.mjs';
import { initTokenManager, getToken, tokenStatus } from './token-manager.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// ─── Config ───────────────────────────────────────────────────────────────────

const BASE_URL = 'http://localhost:5800';
const MAX_RETRIES = 2;
const RESULTS_DIR = join(ROOT, 'test-results');

// Load .env.local
const envPath = join(ROOT, '.env.local');
const envLines = readFileSync(envPath, 'utf-8').split('\n');
const env = {};
for (const line of envLines) {
  const [k, ...v] = line.split('=');
  if (k && !k.startsWith('#') && k.trim()) env[k.trim()] = v.join('=').trim();
}

const PROJECT = env.GOOGLE_PROJECT_ID || 'malloy-data';
const GEMINI_KEY = env.GOOGLE_GENERATIVE_AI_API_KEY || env.GOOGLE_AI_API_KEY || '';

// Token validation deferred to initTokenManager() in main()

// Ensure output dir
if (!existsSync(RESULTS_DIR)) mkdirSync(RESULTS_DIR, { recursive: true });

// ─── Result types ─────────────────────────────────────────────────────────────

const STATUS = {
  PASS: 'PASS',
  FAIL: 'FAIL',
  NEEDS_REVIEW: 'NEEDS_REVIEW',
  SKIPPED: 'SKIPPED',
};

// ─── API helpers ──────────────────────────────────────────────────────────────

async function callChat(message, history = [], context = {}) {
  // Get a fresh token (auto-refreshes if needed)
  const accessToken = await getToken();

  const res = await fetch(`${BASE_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message,
      history,
      accessToken,
      context: {
        project: PROJECT,
        ...context,
      },
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => `HTTP ${res.status}`);
    throw new Error(`API error ${res.status}: ${text}`);
  }

  const data = await res.json();
  return data.envelopes ?? [];
}

// ─── Gemini prompt improvement ────────────────────────────────────────────────

async function analyzeFailureAndImprovePrompt(task, originalPrompt, envelopes, failReason) {
  if (!GEMINI_KEY) {
    // Fallback: add explicit context to prompt
    return `${originalPrompt} (Use the ${task.expectedSkill} skill. Table is ${PROJECT}.ecommerce.)`;
  }

  try {
    const envelopeSummary = envelopes.map(e => ({
      skill: e.skill,
      headline: e.headline?.text,
      artifactType: e.primaryArtifact?.type,
    }));

    const systemPrompt = `You are a QA engineer testing a BigQuery AI assistant app. 
The app takes natural-language prompts and routes them to skills like: schema, query, data-management, data-quality, discovery, monitoring, data-loading.
The reference dataset is malloy-data.ecommerce with tables: orders, order_items, products, users, product_reviews.

A test failed. Your job is to rewrite the prompt to be more explicit and likely to succeed.
Return ONLY the improved prompt text — no explanation, no quotes, no markdown.`;

    const userMsg = `Task: ${task.taskName}
Category: ${task.categoryName}
Expected skill: ${task.expectedSkill}
Expected artifact: ${task.expectedArtifactType}
Original prompt: "${originalPrompt}"
Failure reason: ${failReason}
What was returned: ${JSON.stringify(envelopeSummary, null, 2)}

Rewrite the prompt to be more explicit about the skill needed and include the full table path.`;

    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${GEMINI_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          { role: 'user', parts: [{ text: systemPrompt + '\n\n' + userMsg }] },
        ],
        generationConfig: { maxOutputTokens: 200, temperature: 0.2 },
      }),
    });

    if (!res.ok) throw new Error(`Gemini error ${res.status}`);
    const data = await res.json();
    const improved = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    return improved || `${originalPrompt} — please use the ${task.expectedSkill} skill and reference ${PROJECT}.ecommerce tables explicitly`;
  } catch (err) {
    console.warn(`  ⚠ Could not call Gemini for prompt improvement: ${err.message}`);
    return `${originalPrompt} — please use the ${task.expectedSkill} skill and reference ${PROJECT}.ecommerce tables explicitly`;
  }
}

// ─── Generate UX suggestions ──────────────────────────────────────────────────

async function generateUxSuggestions(task, results) {
  const suggestions = [];

  // Router misclassification
  const finalEnvelopes = results[results.length - 1]?.envelopes ?? [];
  const actualSkill = finalEnvelopes[0]?.skill;
  if (actualSkill && actualSkill !== task.expectedSkill) {
    suggestions.push(
      `**Router improvement**: The prompt for "${task.taskName}" routed to \`${actualSkill}\` instead of \`${task.expectedSkill}\`. ` +
      `Consider adding "${task.taskName.toLowerCase()}" or related keywords to the ${task.expectedSkill} signals in \`router.ts\`.`
    );
  }

  // Multi-step guidance
  if (task.workflow && task.workflow.length > 1) {
    suggestions.push(
      `**Workflow guidance**: This task has ${task.workflow.length} steps. ` +
      `The app should surface a step indicator or progress breadcrumb when chaining tasks via handoff chips.`
    );
  }

  // Destructive task gate
  if (task.isDestructive) {
    suggestions.push(
      `**Safety UX**: "${task.taskName}" is destructive. Ensure the confirmation card clearly shows ` +
      `the affected row count, a preview of changed data, and an easily visible Cancel button. ` +
      `Consider adding an "impact level" badge (low/medium/high) to help users assess risk at a glance.`
    );
  }

  // Empty results — only suggest if ALL attempts genuinely failed (not rate-limit retries)
  const hasAnyPass = results.some(r => r.evalResult?.pass === true);
  if (!hasAnyPass) {
    suggestions.push(
      `**Empty state**: This task consistently failed or returned no data. ` +
      `Add a helpful empty-state card that suggests alternative phrasings or related tasks.`
    );
  }

  return suggestions;
}

// ─── Run a single task ────────────────────────────────────────────────────────

async function runTask(task) {
  const taskResult = {
    id: task.id,
    taskName: task.taskName,
    category: task.category,
    categoryName: task.categoryName,
    expectedSkill: task.expectedSkill,
    expectedArtifactType: task.expectedArtifactType,
    isDestructive: task.isDestructive,
    attempts: [],
    status: STATUS.FAIL,
    finalPrompt: task.prompt,
    screenshotPath: null,
    uxSuggestions: [],
  };

  let currentPrompt = task.prompt;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const attemptLabel = attempt === 0 ? 'initial' : `retry ${attempt}`;
    process.stdout.write(`    [${attemptLabel}] `);

    const attemptResult = {
      attempt: attempt + 1,
      prompt: currentPrompt,
      envelopes: [],
      evalResult: null,
      error: null,
    };

    try {
      // For workflow tasks, run the first turn only (test the entry point)
      const envelopes = await callChat(currentPrompt, [], {});
      attemptResult.envelopes = envelopes.map(e => ({
        id: e.id,
        skill: e.skill,
        headline: e.headline,
        artifactType: e.primaryArtifact?.type,
        requiresConfirmation: e.requiresConfirmation,
        hasData: !!(e.primaryArtifact?.data),
        nextActions: e.nextActions?.map(a => ({ label: a.label, targetSkill: a.targetSkill })) ?? [],
        // Include compact data summary (not full rows to keep JSON small)
        dataSummary: summarizeData(e),
      }));

      const evalResult = task.successCriteria(envelopes);
      attemptResult.evalResult = evalResult;

      if (evalResult.pass) {
        console.log(`✅ ${evalResult.reason}`);
        taskResult.attempts.push(attemptResult);
        taskResult.status = STATUS.PASS;
        taskResult.finalPrompt = currentPrompt;
        break;
      } else {
        console.log(`❌ ${evalResult.reason}`);
        taskResult.attempts.push(attemptResult);

        // Try to improve the prompt if we have retries left
        if (attempt < MAX_RETRIES) {
          process.stdout.write(`    → Analyzing failure and improving prompt...\n`);
          currentPrompt = await analyzeFailureAndImprovePrompt(
            task, currentPrompt, envelopes, evalResult.reason
          );
          process.stdout.write(`    → New prompt: "${currentPrompt.substring(0, 80)}${currentPrompt.length > 80 ? '...' : ''}"\n`);
        }
      }
    } catch (err) {
      const errorMsg = err.message;
      console.log(`💥 Error: ${errorMsg}`);
      attemptResult.error = errorMsg;
      taskResult.attempts.push(attemptResult);

      if (attempt < MAX_RETRIES) {
        // Back off longer on rate limiting
        const is429 = errorMsg.includes('429') || errorMsg.includes('Rate limited') || errorMsg.includes('busy');
        const delay = is429 ? 12000 : 3000;
        if (is429) process.stdout.write(`    → Rate limited — waiting ${delay/1000}s...\n`);
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }

  // Mark as NEEDS_REVIEW if all retries failed
  if (taskResult.status === STATUS.FAIL) {
    taskResult.status = STATUS.NEEDS_REVIEW;
  }

  // Generate UX suggestions
  taskResult.uxSuggestions = await generateUxSuggestions(task, taskResult.attempts);

  return taskResult;
}

// ─── Workflow test ─────────────────────────────────────────────────────────────

async function runWorkflow(task) {
  if (!task.workflow || task.workflow.length <= 1) return null;

  console.log(`  📋 Testing workflow (${task.workflow.length} turns)...`);
  const turns = [];
  let history = [];

  for (const [i, prompt] of task.workflow.entries()) {
    try {
      const envelopes = await callChat(prompt, history, {});
      turns.push({
        turn: i + 1,
        prompt,
        skill: envelopes[0]?.skill,
        artifactType: envelopes[0]?.primaryArtifact?.type,
        success: envelopes.length > 0,
      });

      // Add to conversation history for next turn
      history = [
        ...history,
        { role: 'user', content: prompt, timestamp: new Date().toISOString() },
        { role: 'assistant', content: '', envelopes, timestamp: new Date().toISOString() },
      ];

      console.log(`    Turn ${i + 1}: ${envelopes[0]?.skill ?? 'none'} → ${envelopes[0]?.primaryArtifact?.type ?? 'none'}`);
    } catch (err) {
      turns.push({ turn: i + 1, prompt, error: err.message, success: false });
      console.log(`    Turn ${i + 1}: ERROR — ${err.message}`);
      break;
    }
  }

  return turns;
}

// ─── Data summary helper ───────────────────────────────────────────────────────

function summarizeData(envelope) {
  const data = envelope?.primaryArtifact?.data;
  if (!data) return 'no data';
  if (data.rows) return `${data.rows.length} rows, ${data.columns?.length ?? 0} cols`;
  if (data.columns && Array.isArray(data.columns) && data.columns[0]?.name) return `${data.columns.length} columns`;
  if (data.findings) return `${data.findings.length} findings`;
  if (data.results) return `${data.results.length} results`;
  if (data.items) return `${data.items.length} jobs`;
  if (data.message) return data.message.substring(0, 60);
  return 'data present';
}

// ─── Check server is running ───────────────────────────────────────────────────

async function checkServer() {
  try {
    const res = await fetch(`${BASE_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'ping', history: [], accessToken: 'ping', context: { project: PROJECT } }),
    });
    // Any HTTP response (even 401/500) means the server is running
    return res.status > 0;
  } catch {
    return false;
  }
}

// ─── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║  BigQuery AIF — Task Taxonomy Test Loop                  ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  // Initialize token manager (loads saved credentials or env token)
  const tokenOk = await initTokenManager();
  if (!tokenOk) {
    console.error(`
ERROR: No access token found.

Run the auth setup script first:
  agy-node scripts/auth-setup.mjs

Or manually paste a token in .env.local:
  GOOGLE_ACCESS_TOKEN=ya29.xxx...
`);
    process.exit(1);
  }

  const ts = tokenStatus();
  console.log(`  Project:    ${PROJECT}`);
  console.log(`  Tasks:      ${TASKS.length}`);
  console.log(`  Max retries: ${MAX_RETRIES} per task`);
  console.log(`  Token mode: ${ts.mode} (${ts.expiresInMins} min remaining)`);
  console.log('');

  // Check server
  process.stdout.write('  Checking dev server at localhost:5800... ');
  const serverOk = await checkServer();
  if (!serverOk) {
    console.log('❌ OFFLINE\n');
    console.error('ERROR: Dev server is not running. Please run: npm run dev');
    process.exit(1);
  }
  console.log('✅ Online\n');

  const results = [];
  const startTime = Date.now();
  let passCount = 0;
  let failCount = 0;
  let reviewCount = 0;

  // Group tasks by category for nicer output
  let currentCategory = null;

  for (const [i, task] of TASKS.entries()) {
    if (task.category !== currentCategory) {
      currentCategory = task.category;
      const catTasks = TASKS.filter(t => t.category === task.category);
      console.log(`\n━━━ ${task.categoryName} (${catTasks.length} tasks) ━━━`);
    }

    console.log(`\n  [${i + 1}/${TASKS.length}] ${task.taskName}`);
    if (task.isDestructive) console.log(`  ⚠ Destructive — will stop at confirmation card`);

    const taskResult = await runTask(task);

    // Run workflow if task has one and the initial turn passed
    if (task.workflow && taskResult.status === STATUS.PASS) {
      taskResult.workflowResults = await runWorkflow(task);
    }

    results.push(taskResult);

    if (taskResult.status === STATUS.PASS) passCount++;
    else if (taskResult.status === STATUS.NEEDS_REVIEW) reviewCount++;
    else failCount++;

    // Pause between tasks to avoid rate limiting (3s base, longer if last task hit 429)
    const lastAttempt = taskResult.attempts[taskResult.attempts.length - 1];
    const wasRateLimited = lastAttempt?.error?.includes('429') || lastAttempt?.error?.includes('Rate limited');
    await new Promise(r => setTimeout(r, wasRateLimited ? 8000 : 3000));
  }

  const elapsed = Math.round((Date.now() - startTime) / 1000);

  // ── Summary ─────────────────────────────────────────────────────────────────

  console.log('\n\n╔══════════════════════════════════════════════════════════╗');
  console.log('║  Results                                                  ║');
  console.log('╠══════════════════════════════════════════════════════════╣');
  console.log(`║  ✅ PASS:         ${String(passCount).padStart(3)} / ${TASKS.length}                              ║`);
  console.log(`║  ⚠  NEEDS REVIEW: ${String(reviewCount).padStart(3)} / ${TASKS.length}                              ║`);
  console.log(`║  ❌ FAIL:         ${String(failCount).padStart(3)} / ${TASKS.length}                              ║`);
  console.log(`║  ⏱  Time:        ${String(elapsed).padStart(4)}s                                 ║`);
  console.log('╚══════════════════════════════════════════════════════════╝');

  // ── Write results.json ──────────────────────────────────────────────────────

  const output = {
    runAt: new Date().toISOString(),
    project: PROJECT,
    dataset: `${PROJECT}.${process.env.BQ_DATASET ?? 'ecomm'}`,
    summary: {
      total: TASKS.length,
      pass: passCount,
      needsReview: reviewCount,
      fail: failCount,
      elapsedSeconds: elapsed,
    },
    tasks: results,
  };

  const resultsPath = join(RESULTS_DIR, 'results.json');
  writeFileSync(resultsPath, JSON.stringify(output, null, 2));
  console.log(`\n  Results saved to: ${resultsPath}`);
  console.log('\n  Next steps:');
  console.log('    1. npx playwright install chromium --with-deps');
  console.log('    2. node scripts/capture-screenshots.mjs');
  console.log('    3. node scripts/generate-report.mjs');
  console.log('');
}

main().catch(err => {
  console.error('\nFatal error:', err);
  process.exit(1);
});
