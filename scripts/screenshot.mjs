#!/usr/bin/env node
// scripts/screenshot.mjs
// Usage: node scripts/screenshot.mjs [url] [output-path]
// Defaults: url=https://bigqueryaif.web.app, output=test-screenshots/adhoc_<timestamp>.png
//
// Uses the same persistent Chrome profile as visual-test.mjs so auth is preserved.
// Output file is printed to stdout for easy reading with view_file.

import { createRequire } from 'module';
const require = createRequire('/tmp/puppeteer-runner/');
const puppeteer = require('puppeteer');
import { mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCREENSHOT_DIR = join(__dirname, '..', 'test-screenshots');
const USER_DATA_DIR = '/tmp/bqaif-puppeteer-profile';

const url = process.argv[2] || 'https://bigqueryaif.web.app';
const out = process.argv[3] || join(SCREENSHOT_DIR, `adhoc_${Date.now()}.png`);

mkdirSync(SCREENSHOT_DIR, { recursive: true });
mkdirSync(USER_DATA_DIR, { recursive: true });

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

async function main() {
  const chromePath = findChrome();
  if (!chromePath) {
    console.error('[screenshot] Could not find system Chrome.');
    process.exit(1);
  }

  try { execSync('pkill -f "bqaif-puppeteer-profile" 2>/dev/null || true'); } catch {}
  await new Promise(r => setTimeout(r, 500));

  console.log(`[screenshot] Launching Chrome...`);
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

  console.log(`[screenshot] Navigating to ${url}...`);
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

  // Wait for page to settle
  await new Promise(r => setTimeout(r, 3000));

  await page.screenshot({ path: out, fullPage: false });

  console.log(`[screenshot] Saved: ${out}`);
  await browser.close();
}

main().catch(err => {
  console.error('[screenshot] Fatal:', err.message);
  process.exit(1);
});
