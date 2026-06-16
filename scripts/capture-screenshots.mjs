#!/usr/bin/env node
// scripts/capture-screenshots.mjs
// Uses Playwright to capture UI screenshots of each passing test result.
//
// How it works:
//   1. Launches headless Chromium
//   2. Navigates to localhost:5800
//   3. Injects the OAuth access token directly into sessionStorage (bypasses sign-in UI)
//   4. Sets up a mock Firebase auth state so the app shows the chat interface
//   5. For each passing task in results.json, replays the prompt via the chat input
//   6. Waits for the artifact card to render
//   7. Screenshots the artifact card (or full page if no card found)
//   8. Updates results.json with screenshot paths
//
// Prerequisites:
//   npx playwright install chromium --with-deps
//   node scripts/test-loop.mjs  (must have results.json)

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const RESULTS_DIR = join(ROOT, 'test-results');
const SCREENSHOTS_DIR = join(RESULTS_DIR, 'screenshots');

// Load .env.local
const envPath = join(ROOT, '.env.local');
const envLines = readFileSync(envPath, 'utf-8').split('\n');
const env = {};
for (const line of envLines) {
  const [k, ...v] = line.split('=');
  if (k && !k.startsWith('#') && k.trim()) env[k.trim()] = v.join('=').trim();
}

const ACCESS_TOKEN = process.env.GOOGLE_ACCESS_TOKEN || env.GOOGLE_ACCESS_TOKEN || '';
const BASE_URL = 'http://localhost:5800';
const FIREBASE_CONFIG = {
  apiKey: env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

if (!existsSync(SCREENSHOTS_DIR)) mkdirSync(SCREENSHOTS_DIR, { recursive: true });

// Load results
const resultsPath = join(RESULTS_DIR, 'results.json');
if (!existsSync(resultsPath)) {
  console.error('ERROR: results.json not found. Run test-loop.mjs first.');
  process.exit(1);
}
const results = JSON.parse(readFileSync(resultsPath, 'utf-8'));

// ─── Main ──────────────────────────────────────────────────────────────────────

async function captureScreenshots() {
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║  BigQuery AIF — Screenshot Capture                       ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  const passingTasks = results.tasks.filter(t => t.status === 'PASS');
  const reviewTasks = results.tasks.filter(t => t.status === 'NEEDS_REVIEW');
  const allToCapture = [...passingTasks, ...reviewTasks];

  console.log(`  Capturing screenshots for ${allToCapture.length} tasks (${passingTasks.length} passing, ${reviewTasks.length} needs-review)\n`);

  let browser;
  try {
    // Use system-installed Chrome — Playwright-managed binaries crash on macOS ARM sandbox
    browser = await chromium.launch({
      headless: true,
      channel: 'chrome',
      args: ['--no-sandbox', '--disable-gpu'],
    });
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 2, // Retina for crisp screenshots
    });

    // ── Auth injection page ────────────────────────────────────────────────────
    // Navigate to app and inject token before Firebase auth check runs
    const authPage = await context.newPage();

    console.log('  Setting up authentication...');

    // Go to the app first (loads Firebase)
    await authPage.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 15000 });

    // Inject token into sessionStorage so auth-context.tsx picks it up on reload
    await authPage.evaluate((token) => {
      sessionStorage.setItem('bq_access_token', token);
    }, ACCESS_TOKEN);

    // Also call the server-side token endpoint to cache it there
    await authPage.evaluate(async (token) => {
      await fetch('/api/auth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
    }, ACCESS_TOKEN);

    // Reload so auth-context restores from sessionStorage
    await authPage.reload({ waitUntil: 'networkidle', timeout: 20000 });

    // Wait for the chat interface to be visible (signed-in state)
    try {
      await authPage.waitForSelector('textarea[placeholder]', { timeout: 10000 });
      console.log('  ✅ Chat interface loaded\n');
    } catch {
      console.log('  ⚠ Timeout waiting for chat interface — app may still be loading\n');
    }

    await authPage.close();

    // ── Screenshot each task ───────────────────────────────────────────────────
    let captured = 0;
    let failed = 0;

    for (const task of allToCapture) {
      const finalPrompt = task.finalPrompt || task.attempts?.[task.attempts.length - 1]?.prompt;
      if (!finalPrompt) {
        console.log(`  [SKIP] ${task.taskName} — no prompt`);
        continue;
      }

      process.stdout.write(`  [${captured + failed + 1}/${allToCapture.length}] ${task.taskName}... `);

      const page = await context.newPage();
      try {
        // Navigate and ensure auth
        await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 20000 });

        // Re-inject token in case new page lost it
        await page.evaluate((token) => {
          sessionStorage.setItem('bq_access_token', token);
        }, ACCESS_TOKEN);

        // Wait for chat input to be ready
        const textarea = await page.waitForSelector('textarea[placeholder]', { timeout: 12000 }).catch(() => null);
        if (!textarea) {
          // Try clicking sign-in if visible
          const signInBtn = await page.$('button[id*="sign"], button[id*="login"], button:has-text("Sign in")');
          if (signInBtn) {
            console.log('needs sign-in → skipping');
            await page.close();
            failed++;
            continue;
          }
          throw new Error('Chat input not found');
        }

        // Type the prompt and send
        await textarea.click();
        await textarea.fill(finalPrompt);
        await page.keyboard.press('Enter');

        // Wait for loading to complete (dots disappear, artifact card appears)
        await page.waitForFunction(() => {
          // Check that loading dots are gone and at least one artifact is visible
          const loadingDots = document.querySelector('[style*="pulse"]');
          const artifactCard = document.querySelector('[class*="artifact"], [data-testid*="artifact"], div[style*="border-radius"][style*="border"]');
          return !loadingDots && artifactCard;
        }, { timeout: 45000 }).catch(async () => {
          // Fallback: just wait 8 seconds for whatever rendered
          await page.waitForTimeout(8000);
        });

        // Small extra wait for animations to settle
        await page.waitForTimeout(1500);

        // Screenshot the artifact area if found, else full page
        const screenshotPath = join(SCREENSHOTS_DIR, `${task.id}.png`);

        // Try to find the main content area (artifact cards)
        const contentArea = await page.$('div[style*="overflow-y: auto"], main, [class*="message"], [class*="chat"]');
        if (contentArea) {
          await contentArea.screenshot({ path: screenshotPath, type: 'png' });
        } else {
          await page.screenshot({ path: screenshotPath, fullPage: false, type: 'png' });
        }

        // Update result with screenshot path
        const resultTask = results.tasks.find(t => t.id === task.id);
        if (resultTask) {
          resultTask.screenshotPath = screenshotPath;
        }

        console.log(`✅ saved`);
        captured++;
      } catch (err) {
        console.log(`❌ ${err.message}`);
        failed++;
      } finally {
        await page.close();
      }

      // Brief pause between screenshots
      await new Promise(r => setTimeout(r, 800));
    }

    console.log(`\n  Screenshots: ${captured} captured, ${failed} failed`);

  } finally {
    if (browser) await browser.close();
  }

  // Save updated results with screenshot paths
  writeFileSync(resultsPath, JSON.stringify(results, null, 2));
  console.log(`\n  Updated results.json with screenshot paths`);
  console.log('\n  Next: node scripts/generate-report.mjs\n');
}

captureScreenshots().catch(err => {
  console.error('\nFatal error:', err);
  process.exit(1);
});
