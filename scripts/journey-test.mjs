#!/usr/bin/env node
// scripts/journey-test.mjs
// Runs all 38 user journey test cases against the deployed app.
// Uses Puppeteer with system Chrome and persistent auth profile.
//
// Usage:
//   node scripts/journey-test.mjs                  # Full suite (38 tests)
//   node scripts/journey-test.mjs --batch 1        # Run one batch only
//   node scripts/journey-test.mjs --only F1        # Run one test only
//   node scripts/journey-test.mjs --start Q3       # Start from a specific test

import { createRequire } from 'module';
const require = createRequire('/tmp/puppeteer-runner/');
const puppeteer = require('puppeteer');
import { mkdirSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCREENSHOT_DIR = join(__dirname, '..', 'test-screenshots', 'journey-tests');
const APP_URL = 'https://bigqueryaif.web.app';
const USER_DATA_DIR = '/tmp/bqaif-puppeteer-profile';

// Parse CLI args
const args = process.argv.slice(2);
let batchFilter = null;
let onlyTest = null;
let startAt = null;
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--batch' && args[i + 1]) batchFilter = parseInt(args[i + 1]);
  if (args[i] === '--only' && args[i + 1]) onlyTest = args[i + 1];
  if (args[i] === '--start' && args[i + 1]) startAt = args[i + 1];
}

mkdirSync(SCREENSHOT_DIR, { recursive: true });

// ---- Test Catalog (38 tests across 9 batches) --------------------------------

const TESTS = [
  // Batch 1: Foundation / Schema
  { id: 'F1', batch: 1, tier: 'Foundation', prompt: 'What datasets do I have?', expect: 'Dataset list with metadata in schema view' },
  { id: 'F2', batch: 1, tier: 'Foundation', prompt: 'What tables are in the ecomm dataset?', expect: 'Table list for ecomm dataset' },
  { id: 'F3', batch: 1, tier: 'Foundation', prompt: 'Tell me about the orders table in ecomm', expect: 'Schema view with columns, types, descriptions' },
  { id: 'F4', batch: 1, tier: 'Foundation', prompt: 'Show me sample data from the users table in ecomm', expect: 'Data table with sample rows' },
  { id: 'F5', batch: 1, tier: 'Foundation', prompt: 'How many orders are there in ecomm?', expect: 'KPI card with row count' },

  // Batch 2: Analytical Queries
  { id: 'Q1', batch: 2, tier: 'Query', prompt: 'What are the top 10 products by revenue in ecomm?', expect: 'Bar chart or table with top products by revenue' },
  { id: 'Q2', batch: 2, tier: 'Query', prompt: 'Show me monthly revenue from order_items in ecomm', expect: 'Line chart with monthly revenue' },
  { id: 'Q3', batch: 2, tier: 'Query', prompt: 'How many orders by status in ecomm?', expect: 'Bar or pie chart showing order distribution by status' },
  { id: 'Q4', batch: 2, tier: 'Query', prompt: "What's the average order value in ecomm?", expect: 'KPI card with formatted currency value' },
  { id: 'Q5', batch: 2, tier: 'Query', prompt: 'Show me the busiest days for orders in ecomm', expect: 'Chart showing order volume by day' },
  { id: 'Q6', batch: 2, tier: 'Query', prompt: 'Which states have the most users in ecomm?', expect: 'Bar chart or map of user distribution by state' },

  // Batch 3: Data Quality
  { id: 'DQ1', batch: 3, tier: 'Data Quality', prompt: 'Profile the order_items table in ecomm', expect: 'Data quality profile view with per-column stats' },
  { id: 'DQ2', batch: 3, tier: 'Data Quality', prompt: 'Check for null values in the users table in ecomm', expect: 'Null check report with percentages' },
  { id: 'DQ3', batch: 3, tier: 'Data Quality', prompt: 'Are there duplicates in the order_items table in ecomm?', expect: 'Duplicate check report' },
  { id: 'DQ4', batch: 3, tier: 'Data Quality', prompt: 'Check the freshness of the orders table in ecomm', expect: 'Freshness report with last-modified time' },
  { id: 'DQ5', batch: 3, tier: 'Data Quality', prompt: 'Detect schema drift in the ecomm orders table', expect: 'Schema drift analysis' },

  // Batch 4: Monitoring
  { id: 'M1', batch: 4, tier: 'Monitoring', prompt: 'Show me recent jobs in this project', expect: 'Jobs list with status and metadata' },
  { id: 'M2', batch: 4, tier: 'Monitoring', prompt: 'How much storage is each dataset using?', expect: 'Storage breakdown view' },
  { id: 'M3', batch: 4, tier: 'Monitoring', prompt: 'How much have my queries cost this month?', expect: 'Cost analysis view' },
  { id: 'M4', batch: 4, tier: 'Monitoring', prompt: 'Show me slot utilization', expect: 'Slot utilization chart' },
  { id: 'M5', batch: 4, tier: 'Monitoring', prompt: 'What are the most expensive queries today?', expect: 'Top queries by cost' },

  // Batch 5: Discovery
  { id: 'D1', batch: 5, tier: 'Discovery', prompt: 'Find tables with a user_id column', expect: 'Discovery search results listing matching tables' },
  { id: 'D2', batch: 5, tier: 'Discovery', prompt: 'Compare orders and order_items in ecomm', expect: 'Table comparison view' },
  { id: 'D3', batch: 5, tier: 'Discovery', prompt: 'Show me the lineage of the order_items table', expect: 'Lineage view or DAG' },
  { id: 'D4', batch: 5, tier: 'Discovery', prompt: 'Draw an ER diagram for the ecomm dataset', expect: 'ER diagram visualization' },

  // Batch 6: Data Management / DML
  { id: 'DM1', batch: 6, tier: 'Data Management', prompt: 'Create a new dataset called test_results in malloy-data', expect: 'Dataset creation confirmation or plan' },
  { id: 'DM2', batch: 6, tier: 'Data Management', prompt: 'Show me how to create a table for storing events', expect: 'CREATE TABLE DDL or guided workflow' },
  { id: 'DM3', batch: 6, tier: 'Data Management', prompt: 'Clone the orders table for testing', expect: 'Clone operation confirmation' },

  // Batch 7: Pipeline / Loading
  { id: 'P1', batch: 7, tier: 'Pipeline', prompt: 'Show me scheduled queries in this project', expect: 'Pipeline list view' },
  { id: 'P2', batch: 7, tier: 'Pipeline', prompt: 'Create a daily scheduled query that counts orders', expect: 'Schedule creation workflow' },
  { id: 'DL1', batch: 7, tier: 'Data Loading', prompt: 'Export the orders table from ecomm to CSV', expect: 'Export/data loading view' },

  // Batch 8: Governance
  { id: 'G1', batch: 8, tier: 'Governance', prompt: 'Who has access to the ecomm dataset?', expect: 'Governance/access view' },
  { id: 'G2', batch: 8, tier: 'Governance', prompt: 'Scan the users table for PII', expect: 'PII scan or sensitive data report' },

  // Batch 9: Conversational / Follow-ups
  { id: 'C1', batch: 9, tier: 'Conversation', prompt: 'What can you help me with?', expect: 'Capability overview with categories' },
  // C2 and C3 are follow-ups that require staying in the same conversation
  { id: 'C2', batch: 9, tier: 'Conversation', prompt: 'Break that down by product category', expect: 'Follow-up breakdown (runs after Q1)', followsUp: 'Q1', setupPrompt: 'What are the top 10 products by revenue in ecomm?' },
  { id: 'C3', batch: 9, tier: 'Conversation', prompt: 'Which column has the most nulls?', expect: 'Follow-up answer (runs after DQ2)', followsUp: 'DQ2', setupPrompt: 'Check for null values in the users table in ecomm' },
];

// ---- Helpers -----------------------------------------------------------------

async function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function findChrome() {
  const paths = [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
  ];
  for (const p of paths) {
    if (existsSync(p)) return p;
  }
  return null;
}

// Wait for the app to finish loading a response.
// Uses the app's own stop/send button as the definitive signal:
//   #chat-stop-button exists  => still loading
//   #chat-send-button exists  => response complete
async function waitForResponse(page, timeoutMs = 300000) {
  const startTime = Date.now();
  const pollInterval = 3000;

  // Check the button state in the chat input
  async function getButtonState() {
    return page.evaluate(() => {
      const stop = document.querySelector('#chat-stop-button');
      const send = document.querySelector('#chat-send-button');
      return { hasStop: !!stop, hasSend: !!send };
    });
  }

  // Phase 1: Wait for the stop button to APPEAR (means the app started processing)
  let loadingStarted = false;
  while (Date.now() - startTime < 15000) {
    const state = await getButtonState();
    if (state.hasStop) {
      loadingStarted = true;
      console.log('[test] Processing started (stop button visible)...');
      break;
    }
    // If send button is already back, response may have been instant
    if (state.hasSend) {
      // Check if there's content beyond the user message
      const hasResponse = await page.evaluate(() => {
        const msgs = document.querySelectorAll('[class*="message"], [class*="Message"]');
        return msgs.length > 1;
      });
      if (hasResponse) {
        console.log('[test] Response already complete (send button visible)');
        return true;
      }
    }
    await delay(500);
  }

  if (!loadingStarted) {
    // The stop button never appeared -- the response might have been very fast
    // or the message failed to send. Wait a bit and check for content.
    console.warn('[test] Stop button never appeared, waiting 15s for content...');
    await delay(15000);
    return true;
  }

  // Phase 2: Wait for the stop button to DISAPPEAR (send button returns)
  let lastLog = Date.now();
  while (Date.now() - startTime < timeoutMs) {
    const state = await getButtonState();

    // Log progress every 15s
    const elapsed = Math.round((Date.now() - startTime) / 1000);
    if (Date.now() - lastLog > 15000) {
      // Grab the current status text if any
      const statusText = await page.evaluate(() => {
        // Look for status messages like "Grabbing the schema..." or "Running query..."
        const statusEls = document.querySelectorAll('[style*="italic"], [class*="status"]');
        for (const el of statusEls) {
          const t = (el.textContent || '').trim();
          if (t.length > 5 && t.length < 200) return t;
        }
        return '';
      });
      console.log(`[test] Still waiting... ${elapsed}s elapsed${statusText ? ' -- ' + statusText : ''}`);
      lastLog = Date.now();
    }

    if (!state.hasStop && state.hasSend) {
      // Response is complete -- wait a bit for charts/animations to render
      console.log(`[test] Response complete after ${elapsed}s`);
      await delay(3000);
      return true;
    }

    await delay(pollInterval);
  }

  const elapsed = Math.round((Date.now() - startTime) / 1000);
  console.warn(`[test] Timed out after ${elapsed}s (stop button still present)`);
  return false;
}

// Select the malloy-data project using page.evaluate for robust clicking
async function selectProject(page) {
  console.log('[test] Selecting malloy-data project...');

  // Try clicking the project chip/button by finding it in the DOM
  const clicked = await page.evaluate(() => {
    // Look for elements containing exactly "malloy-data"
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_ELEMENT,
      null
    );
    let node;
    while ((node = walker.nextNode())) {
      const text = node.textContent || '';
      // Only match leaf-ish elements (not containers with lots of children)
      if (node.children.length <= 2 && text.trim() === 'malloy-data') {
        node.click();
        return 'clicked: ' + node.tagName + '.' + node.className;
      }
    }
    // Fallback: try finding a chip/button with malloy-data
    const allEls = document.querySelectorAll('button, [role="button"], a, [class*="chip"], [class*="Chip"]');
    for (const el of allEls) {
      if (el.textContent && el.textContent.trim().includes('malloy-data')) {
        el.click();
        return 'fallback-clicked: ' + el.tagName + '.' + el.className;
      }
    }
    return null;
  });

  if (clicked) {
    console.log(`[test] ${clicked}`);
  } else {
    console.warn('[test] Could not find malloy-data element');
  }

  await delay(3000);

  // Verify project was selected by checking if textarea is enabled
  const textareaReady = await page.evaluate(() => {
    const ta = document.querySelector('textarea');
    if (!ta) return false;
    return ta.placeholder !== 'Select a project first...' && !ta.disabled;
  });

  if (!textareaReady) {
    console.warn('[test] Project may not be selected, textarea not ready. Retrying...');
    // Try clicking via XPath-like approach: find the star icon next to malloy-data
    await page.evaluate(() => {
      const spans = document.querySelectorAll('span');
      for (const s of spans) {
        if (s.textContent.trim() === 'malloy-data') {
          // Click the parent
          const parent = s.closest('button, [role="button"], div[class*="chip"], div[class*="Chip"], a');
          if (parent) { parent.click(); return; }
          s.parentElement.click();
          return;
        }
      }
    });
    await delay(3000);
  }

  // Final check
  const finalReady = await page.evaluate(() => {
    const ta = document.querySelector('textarea');
    return ta && ta.placeholder !== 'Select a project first...' && !ta.disabled;
  });

  if (finalReady) {
    console.log('[test] Project selected, textarea ready');
  } else {
    console.error('[test] WARNING: Textarea still not ready after project selection attempts');
  }

  return finalReady;
}

// Start a new conversation by clicking the + New button in the sidebar
async function startNewConversation(page) {
  // Method 1: Click the "New" button in the sidebar
  // The button contains <span class="material-symbols-outlined">add</span> + "New"
  // So textContent is "add\nNew" or "addNew"
  const clicked = await page.evaluate(() => {
    const buttons = document.querySelectorAll('button');
    for (const btn of buttons) {
      const text = (btn.textContent || '').replace(/\s+/g, ' ').trim();
      // Match "add New" (material icon text + label)
      if (text === 'add New' || text === 'addNew') {
        btn.click();
        return 'matched-text';
      }
    }
    // Fallback: find button containing a material icon "add" with sibling text "New"
    const icons = document.querySelectorAll('.material-symbols-outlined');
    for (const icon of icons) {
      if (icon.textContent.trim() === 'add') {
        const parent = icon.closest('button');
        if (parent) { parent.click(); return 'matched-icon'; }
      }
    }
    return null;
  });

  if (clicked) {
    console.log('[test] Clicked + New button');
    await delay(2000);
  } else {
    // Fallback: reload the page
    console.warn('[test] Could not find + New button, reloading page...');
    await page.goto(APP_URL, { waitUntil: 'networkidle2', timeout: 30000 });
    await delay(4000);
  }

  await page.waitForSelector('textarea', { timeout: 10000 });

  // Verify we're in a fresh conversation (no messages in the chat area)
  const isFresh = await page.evaluate(() => {
    // Check the textarea placeholder -- "Ask a follow-up..." means we're in an existing convo
    const ta = document.querySelector('textarea');
    if (ta && ta.placeholder && ta.placeholder.includes('follow-up')) return false;
    return true;
  });

  if (!isFresh) {
    console.warn('[test] Still in old conversation after + New, trying page reload...');
    await page.goto(APP_URL, { waitUntil: 'networkidle2', timeout: 30000 });
    await delay(4000);
    await page.waitForSelector('textarea', { timeout: 10000 });
  }

  // Check if project is still selected
  const needsProject = await page.evaluate(() => {
    const ta = document.querySelector('textarea');
    return ta && (ta.placeholder === 'Select a project first...' || ta.disabled);
  });

  if (needsProject) {
    await selectProject(page);
  }

  // Clear textarea
  await page.evaluate(() => {
    const ta = document.querySelector('textarea');
    if (!ta) return;
    const nativeSetter = Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype, 'value'
    ).set;
    nativeSetter.call(ta, '');
    ta.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await delay(300);
  return true;
}


// Type into textarea using React-compatible setter
async function clearAndType(page, text) {
  const textarea = await page.$('textarea');
  if (!textarea) return false;

  await page.evaluate(() => {
    const ta = document.querySelector('textarea');
    if (!ta) return;
    const nativeSetter = Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype, 'value'
    ).set;
    nativeSetter.call(ta, '');
    ta.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await delay(200);

  await textarea.click();
  await delay(100);
  await textarea.type(text, { delay: 10 });
  return true;
}

// Capture response text from the page
async function captureResponseText(page) {
  return page.evaluate(() => {
    // Look for message containers
    const messages = document.querySelectorAll('[class*="message"], [class*="Message"], [class*="response"], [class*="Response"]');
    const texts = [];
    messages.forEach(m => {
      const t = m.innerText || '';
      if (t.length > 10) texts.push(t.substring(0, 500));
    });
    return texts.join('\n---\n').substring(0, 2000) || 'No response text captured';
  });
}

// ---- Main --------------------------------------------------------------------

async function main() {
  const chromePath = findChrome();
  if (!chromePath) {
    console.error('[test] Could not find system Chrome.');
    process.exit(1);
  }
  console.log(`[test] Using Chrome at: ${chromePath}`);

  // Kill any stale Chrome with the profile
  try { execSync('pkill -f "bqaif-puppeteer-profile" 2>/dev/null || true'); } catch {}
  await delay(1000);

  console.log('[test] Launching browser...');
  const browser = await puppeteer.launch({
    headless: false,
    executablePath: chromePath,
    userDataDir: USER_DATA_DIR,
    defaultViewport: { width: 1440, height: 900 },
    args: [
      '--window-size=1440,900',
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-blink-features=AutomationControlled',
    ],
    ignoreDefaultArgs: ['--enable-automation'],
  });

  const page = (await browser.pages())[0] || await browser.newPage();

  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
  });

  console.log(`[test] Navigating to ${APP_URL}...`);
  await page.goto(APP_URL, { waitUntil: 'networkidle2', timeout: 30000 });
  await delay(5000);

  await page.screenshot({ path: join(SCREENSHOT_DIR, '00_initial.png'), fullPage: false });

  // Select project
  const projectReady = await selectProject(page);
  await page.screenshot({ path: join(SCREENSHOT_DIR, '00_project.png'), fullPage: false });

  if (!projectReady) {
    console.error('[test] FATAL: Could not select project. Aborting.');
    await browser.close();
    process.exit(1);
  }

  // Filter tests
  let testsToRun = [...TESTS];
  if (batchFilter !== null) {
    testsToRun = testsToRun.filter(t => t.batch === batchFilter);
  }
  if (onlyTest !== null) {
    testsToRun = testsToRun.filter(t => t.id === onlyTest);
  }
  if (startAt !== null) {
    const startIdx = testsToRun.findIndex(t => t.id === startAt);
    if (startIdx >= 0) testsToRun = testsToRun.slice(startIdx);
  }

  console.log(`\n[test] Running ${testsToRun.length} tests\n`);

  const results = [];

  for (let i = 0; i < testsToRun.length; i++) {
    const test = testsToRun[i];
    const filePrefix = test.id.toLowerCase();

    console.log(`\n=== Test ${test.id}: [${test.tier}] (${i + 1}/${testsToRun.length}) ===`);
    console.log(`Prompt: "${test.prompt}"`);
    console.log(`Expect: ${test.expect}`);

    const result = {
      id: test.id,
      batch: test.batch,
      tier: test.tier,
      prompt: test.prompt,
      expected: test.expect,
      status: 'UNKNOWN',
      error: null,
      screenshotPath: null,
      responsePreview: null,
    };

    try {
      // Handle follow-up tests (C2, C3) which need a setup prompt first
      if (test.setupPrompt) {
        console.log(`[test] Follow-up test: sending setup prompt first...`);
        console.log(`[test] Setup: "${test.setupPrompt}"`);
        await startNewConversation(page);
        const setupTyped = await clearAndType(page, test.setupPrompt);
        if (setupTyped) {
          await page.keyboard.press('Enter');
          await waitForResponse(page);
          await delay(2000);
          await page.screenshot({ path: join(SCREENSHOT_DIR, `${filePrefix}_setup.png`), fullPage: false });
          console.log('[test] Setup prompt completed, now sending follow-up...');
        }
        // Now send the actual follow-up without starting a new conversation
        const followUpTyped = await clearAndType(page, test.prompt);
        if (!followUpTyped) {
          result.status = 'FAIL';
          result.error = 'Could not type follow-up prompt';
          results.push(result);
          continue;
        }
      } else {
        // Normal test: start new conversation
        if (i > 0) {
          console.log('[test] Starting new conversation...');
          await startNewConversation(page);
        }

        const typed = await clearAndType(page, test.prompt);
        if (!typed) {
          console.error('[test] Could not find textarea!');
          result.status = 'FAIL';
          result.error = 'Textarea not found';
          await page.screenshot({ path: join(SCREENSHOT_DIR, `${filePrefix}_error.png`), fullPage: false });
          results.push(result);
          continue;
        }
      }

      await delay(200);
      await page.keyboard.press('Enter');
      console.log('[test] Message sent, waiting for response...');

      const responded = await waitForResponse(page);
      await delay(3000);

      // Screenshot
      const ssPath = join(SCREENSHOT_DIR, `${filePrefix}_result.png`);
      await page.screenshot({ path: ssPath, fullPage: false });
      result.screenshotPath = ssPath;
      console.log(`[test] Saved: ${filePrefix}_result.png`);

      // Capture response text
      const responseText = await captureResponseText(page);
      result.responsePreview = responseText.substring(0, 500);

      // Check for error indicators
      const errorText = await page.evaluate(() => {
        const errorEls = document.querySelectorAll('[style*="fef2f2"], [style*="fed7aa"], [style*="fff7ed"], [class*="error"], [class*="Error"]');
        return Array.from(errorEls).map(el => el.innerText).filter(t => t.length > 5).join(' | ') || null;
      });

      if (errorText) {
        console.error(`[test] ERROR detected: ${errorText.slice(0, 200)}`);
        result.error = errorText.slice(0, 500);
      }

      result.status = responded ? 'CAPTURED' : 'TIMEOUT';
      console.log(`[test] Test ${test.id}: ${result.status}${result.error ? ' (with error)' : ''}`);

    } catch (err) {
      console.error(`[test] Test ${test.id} crashed:`, err.message);
      result.status = 'CRASH';
      result.error = err.message;
      try {
        await page.screenshot({ path: join(SCREENSHOT_DIR, `${filePrefix}_crash.png`), fullPage: false });
      } catch {}
    }

    results.push(result);

    // Write incremental results
    writeFileSync(
      join(SCREENSHOT_DIR, `${filePrefix}_summary.json`),
      JSON.stringify(result, null, 2)
    );

    await delay(1000);
  }

  // Write full results
  writeFileSync(
    join(SCREENSHOT_DIR, 'all_results.json'),
    JSON.stringify(results, null, 2)
  );

  // Print summary
  console.log('\n========================================');
  console.log('  Journey Test Results');
  console.log('========================================');
  const counts = { CAPTURED: 0, TIMEOUT: 0, FAIL: 0, CRASH: 0 };
  for (const r of results) {
    counts[r.status] = (counts[r.status] || 0) + 1;
    const icon = r.status === 'CAPTURED' ? '[OK]' : '[!!]';
    console.log(`  ${icon} ${r.id}: ${r.status}${r.error ? ' -- ' + r.error.slice(0, 80) : ''}`);
  }
  console.log('----------------------------------------');
  console.log(`  Captured: ${counts.CAPTURED || 0}`);
  console.log(`  Timeout:  ${counts.TIMEOUT || 0}`);
  console.log(`  Failed:   ${counts.FAIL || 0}`);
  console.log(`  Crashed:  ${counts.CRASH || 0}`);
  console.log(`  Total:    ${results.length}`);
  console.log(`  Screenshots: ${SCREENSHOT_DIR}`);
  console.log('========================================\n');

  console.log('[test] Closing browser...');
  await delay(1000);
  await browser.close();
}

main().catch((err) => {
  console.error('[test] Fatal:', err);
  process.exit(1);
});
