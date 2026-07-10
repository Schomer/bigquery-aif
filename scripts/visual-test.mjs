#!/usr/bin/env node
// scripts/visual-test.mjs
// Puppeteer test harness using SYSTEM Chrome.
// Fixed: properly clears textarea, waits for response completion, starts new conversation per test.

import { createRequire } from 'module';
const require = createRequire('/tmp/puppeteer-runner/');
const puppeteer = require('puppeteer');
import { mkdirSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createInterface } from 'readline';
import { execSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCREENSHOT_DIR = join(__dirname, '..', 'test-screenshots');
const APP_URL = 'https://bigqueryaif.web.app';
const USER_DATA_DIR = '/tmp/bqaif-puppeteer-profile';

// Parse CLI args
const args = process.argv.slice(2);
let startAt = 1;
let onlyTest = null;
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--start' && args[i + 1]) startAt = parseInt(args[i + 1]);
  if (args[i] === '--only' && args[i + 1]) onlyTest = parseInt(args[i + 1]);
}

mkdirSync(SCREENSHOT_DIR, { recursive: true });
mkdirSync(USER_DATA_DIR, { recursive: true });

// ---- Test Prompts --------------------------------------------------------

const TESTS = [
  // Tier 1: Foundation
  { id: 1, tier: 'Foundation', prompt: 'What datasets are in this project?', expect: 'Dataset list in SCHEMA_VIEW' },
  { id: 2, tier: 'Foundation', prompt: 'What tables are in the ecomm dataset?', expect: 'Table list for ecomm dataset' },
  { id: 3, tier: 'Foundation', prompt: 'Describe the orders table in ecomm', expect: 'Column schema for orders table' },
  { id: 4, tier: 'Foundation', prompt: 'Show me the first 10 rows of orders in ecomm', expect: 'Data table with 10 rows' },
  { id: 5, tier: 'Foundation', prompt: 'How many rows are in the orders table in ecomm?', expect: 'KPI card with row count' },

  // Tier 2: Query Skill
  { id: 6, tier: 'Query', prompt: 'Show me orders by status in ecomm', expect: 'Bar chart or table grouped by status' },
  { id: 7, tier: 'Query', prompt: 'What are the top 10 products by revenue in ecomm?', expect: 'Bar chart or table with top products' },
  { id: 8, tier: 'Query', prompt: 'Show me total sale_price by month from order_items in ecomm', expect: 'Line chart with monthly revenue' },
  { id: 9, tier: 'Query', prompt: 'How many users are there by state in ecomm?', expect: 'Bar/column chart or map' },

  // Tier 3: Data Quality
  { id: 10, tier: 'Data Quality', prompt: 'Profile the order_items table in ecomm', expect: 'Data quality profile view' },
  { id: 11, tier: 'Data Quality', prompt: 'Check for nulls in the users table in ecomm', expect: 'Null check report' },
  { id: 12, tier: 'Data Quality', prompt: 'Are there any duplicates in order_items in ecomm?', expect: 'Duplicate check (data-quality)' },

  // Tier 4: Monitoring
  { id: 13, tier: 'Monitoring', prompt: 'Show me recent jobs in this project', expect: 'Jobs monitoring view' },
  { id: 14, tier: 'Monitoring', prompt: 'How much storage is each dataset using?', expect: 'Storage breakdown view' },

  // Tier 5: Discovery
  { id: 15, tier: 'Discovery', prompt: 'Search for tables that have a user_id column', expect: 'Discovery search results' },
  { id: 16, tier: 'Discovery', prompt: 'Compare the orders and order_items tables in ecomm', expect: 'Table comparison view' },

  // Tier 6: Visualization
  { id: 17, tier: 'Viz', prompt: 'Show me a pie chart of orders by status in ecomm', expect: 'Pie chart visualization' },
  { id: 18, tier: 'Viz', prompt: 'Show me total sale_price by month as a line chart from order_items in ecomm', expect: 'Line chart' },

  // Tier 7: Governance
  { id: 19, tier: 'Governance', prompt: 'Who has access to the ecomm dataset?', expect: 'Governance/access view' },

  // Tier 8: Data Loading
  { id: 20, tier: 'Data Loading', prompt: 'Export the orders table in ecomm to CSV', expect: 'Export/data loading view' },
];

// ---- Helpers -------------------------------------------------------------

function rl() {
  return createInterface({ input: process.stdin, output: process.stdout });
}

async function waitForInput(prompt) {
  const r = rl();
  return new Promise((resolve) => {
    r.question(prompt, (answer) => {
      r.close();
      resolve(answer.trim());
    });
  });
}

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
// Two-phase: (1) wait for loading to START, (2) wait for loading to END.
async function waitForResponse(page, timeoutMs = 90000) {
  const startTime = Date.now();
  const pollInterval = 1500;

  const THINKING_REGEX = /Gazing|Reading the query|crystals are computing|Communing|Divining|Scanning|Interrogating|Decoding|Classifying intent|Building SQL|Dry-running|Matched skill|Retrying|Query failed, asking|Fetching|Analyzing|Running|Checking/;

  // Phase 1: Wait for loading to START (max 15s)
  // The query must show a thinking phrase or spinner before we consider it "started"
  let loadingStarted = false;
  while (Date.now() - startTime < 15000) {
    const isLoading = await page.evaluate((regex) => {
      const bodyText = document.body.innerText;
      const hasThinking = new RegExp(regex).test(bodyText);
      const hasSpinner = !!document.querySelector('.spark-spinner');
      return hasThinking || hasSpinner;
    }, THINKING_REGEX.source);

    if (isLoading) {
      loadingStarted = true;
      console.log('[test] Loading detected, waiting for completion...');
      break;
    }
    await delay(500);
  }

  if (!loadingStarted) {
    console.warn('[test] Loading never started, waiting extra time...');
    await delay(5000);
  }

  // Phase 2: Wait for loading to END
  // Loading is done when thinking phrases are gone AND the page has settled
  let consecutiveIdle = 0;
  while (Date.now() - startTime < timeoutMs) {
    const state = await page.evaluate((regex) => {
      const bodyText = document.body.innerText;
      const hasThinking = new RegExp(regex).test(bodyText);
      const hasSpinner = !!document.querySelector('.spark-spinner');
      const isLoading = hasThinking || hasSpinner;
      const hasErrorCard = bodyText.includes('Something Went Wrong');
      return { isLoading, hasErrorCard };
    }, THINKING_REGEX.source);

    if (!state.isLoading) {
      consecutiveIdle++;
      // Require 2 consecutive idle checks (3s total) to avoid transient gaps
      if (consecutiveIdle >= 2) {
        // Extra settle time for charts/animations
        await delay(2000);
        return true;
      }
    } else {
      consecutiveIdle = 0;
    }

    await delay(pollInterval);
  }

  console.warn(`[test] Timed out after ${timeoutMs / 1000}s`);
  return false;
}

// Start a new conversation by reloading the page fresh
async function startNewConversation(page) {
  // Navigate with a cache-busting param to force React to remount
  const freshUrl = `${APP_URL}?t=${Date.now()}`;
  await page.goto(freshUrl, { waitUntil: 'networkidle2', timeout: 30000 });
  await delay(3000);

  // Wait for textarea to appear and be empty
  await page.waitForSelector('textarea', { timeout: 10000 });

  // Verify textarea is actually empty
  const taValue = await page.evaluate(() => {
    const ta = document.querySelector('textarea');
    return ta ? ta.value : null;
  });
  if (taValue && taValue.length > 0) {
    console.log(`[test] Textarea not empty after nav (${taValue.length} chars), clearing via native setter`);
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
  }
  return true;
}

// Clear the textarea properly using React's internal setter
async function clearAndType(page, text) {
  const textarea = await page.$('textarea');
  if (!textarea) return false;

  // Use React's internal value setter to clear the controlled input
  await page.evaluate(() => {
    const ta = document.querySelector('textarea');
    if (!ta) return;
    // Get the native setter from HTMLTextAreaElement prototype
    const nativeSetter = Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype, 'value'
    ).set;
    nativeSetter.call(ta, '');
    ta.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await delay(200);

  // Now type the new text
  await textarea.click();
  await delay(100);
  await textarea.type(text, { delay: 10 });
  return true;
}

// ---- Main ----------------------------------------------------------------

async function main() {
  const chromePath = findChrome();
  if (!chromePath) {
    console.error('[test] Could not find system Chrome.');
    process.exit(1);
  }
  console.log(`[test] Using Chrome at: ${chromePath}`);

  try { execSync('pkill -f "bqaif-puppeteer-profile" 2>/dev/null || true'); } catch {}
  await delay(500);

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

  await page.screenshot({ path: join(SCREENSHOT_DIR, '00_initial_state.png'), fullPage: false });
  console.log('[test] Saved: 00_initial_state.png');

  // Wait for user to sign in
  console.log('\n========================================');
  console.log('  Please sign in to the app in the');
  console.log('  browser window that just opened.');
  console.log('========================================\n');
  await waitForInput('Press Enter after signing in > ');

  await delay(3000);
  await page.screenshot({ path: join(SCREENSHOT_DIR, '00_after_auth.png'), fullPage: false });

  // Select malloy-data project
  console.log('[test] Selecting malloy-data project...');
  const elements = await page.$$('button, div, span, a');
  for (const el of elements) {
    const text = await el.evaluate(e => e.textContent || '');
    if (text.trim() === 'malloy-data') {
      await el.click();
      console.log('[test] Clicked malloy-data');
      break;
    }
  }
  await delay(3000);
  await page.screenshot({ path: join(SCREENSHOT_DIR, '00_project_selected.png'), fullPage: false });

  // Run tests
  const testsToRun = onlyTest
    ? TESTS.filter((t) => t.id === onlyTest)
    : TESTS.filter((t) => t.id >= startAt);

  for (const test of testsToRun) {
    const prefix = String(test.id).padStart(2, '0');
    const tierSlug = test.tier.toLowerCase().replace(/\s+/g, '_');

    console.log(`\n--- Test ${test.id}: [${test.tier}] ---`);
    console.log(`Prompt: "${test.prompt}"`);
    console.log(`Expect: ${test.expect}`);

    try {
      // Start a new conversation for each test to avoid context bleed
      if (test.id > testsToRun[0].id) {
        console.log('[test] Starting new conversation...');
        await startNewConversation(page);
      }

      // Clear textarea and type prompt
      const typed = await clearAndType(page, test.prompt);
      if (!typed) {
        console.error('[test] Could not find textarea!');
        await page.screenshot({ path: join(SCREENSHOT_DIR, `${prefix}_ERROR.png`), fullPage: false });
        continue;
      }

      await delay(200);

      // Submit
      await page.keyboard.press('Enter');
      console.log('[test] Message sent, waiting for response...');

      // Wait for the response to complete
      const responded = await waitForResponse(page);

      // Extra time for chart rendering
      await delay(2000);

      // Take full-page screenshot
      await page.screenshot({
        path: join(SCREENSHOT_DIR, `${prefix}_${tierSlug}_full.png`),
        fullPage: false,
      });
      console.log(`[test] Saved: ${prefix}_${tierSlug}_full.png`);

      // Check for errors
      const errorText = await page.evaluate(() => {
        const errorEls = document.querySelectorAll('[style*="fef2f2"], [style*="fed7aa"], [style*="fff7ed"]');
        return Array.from(errorEls).map(el => el.innerText).filter(t => t.length > 5).join(' | ') || null;
      });

      if (errorText) {
        console.error(`[test] ERROR: ${errorText.slice(0, 200)}`);
        writeFileSync(join(SCREENSHOT_DIR, `${prefix}_error.txt`), errorText);
      }

      const summary = {
        id: test.id,
        tier: test.tier,
        prompt: test.prompt,
        expected: test.expect,
        error: errorText || null,
        responded,
      };
      writeFileSync(join(SCREENSHOT_DIR, `${prefix}_summary.json`), JSON.stringify(summary, null, 2));
      console.log(`[test] Test ${test.id} complete.${errorText ? ' (WITH ERROR)' : ''}`);

    } catch (err) {
      console.error(`[test] Test ${test.id} crashed:`, err.message);
      try {
        await page.screenshot({ path: join(SCREENSHOT_DIR, `${prefix}_CRASH.png`), fullPage: false });
      } catch {}
    }

    await delay(1000);
  }

  console.log('\n========================================');
  console.log('  All tests complete!');
  console.log(`  Screenshots: ${SCREENSHOT_DIR}`);
  console.log('========================================\n');

  await waitForInput('Press Enter to close browser > ');
  await browser.close();
}

main().catch((err) => {
  console.error('[test] Fatal:', err);
  process.exit(1);
});
