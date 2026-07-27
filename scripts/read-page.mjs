#!/usr/bin/env node
// scripts/read-page.mjs
// Opens a URL in headed Chrome with persistent profile, waits for user to press Enter,
// then extracts the page text content and saves it + a screenshot.
// Usage: node scripts/read-page.mjs <url>

import { createRequire } from 'module';
const require = createRequire('/tmp/puppeteer-runner/');
const puppeteer = require('puppeteer');
import { mkdirSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createInterface } from 'readline';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCREENSHOT_DIR = join(__dirname, '..', 'test-screenshots');
const USER_DATA_DIR = '/tmp/bqaif-puppeteer-profile';

const url = process.argv[2];
if (!url) {
  console.error('Usage: node scripts/read-page.mjs <url>');
  process.exit(1);
}

mkdirSync(SCREENSHOT_DIR, { recursive: true });
mkdirSync(USER_DATA_DIR, { recursive: true });

function findChrome() {
  const paths = [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
  ];
  for (const p of paths) {
    if (existsSync(p)) return p;
  }
  return null;
}

async function waitForEnter(prompt) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => {
    rl.question(prompt, () => { rl.close(); resolve(); });
  });
}

async function main() {
  const chromePath = findChrome();
  if (!chromePath) {
    console.error('[read-page] Could not find Chrome.');
    process.exit(1);
  }

  // Do NOT kill existing Chrome -- we want to preserve auth sessions
  console.log('[read-page] Launching Chrome (preserving existing sessions)...');
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

  console.log(`[read-page] Navigating to ${url}...`);
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
  await new Promise(r => setTimeout(r, 2000));

  // Check if we're on SSO
  const title = await page.title();
  if (title.toLowerCase().includes('sign') || title.toLowerCase().includes('sso')) {
    console.log('[read-page] SSO detected. Please sign in manually in the browser window.');
    console.log('[read-page] Press Enter after signing in and the page has loaded...');
    await waitForEnter('');
    // Wait for page to settle after auth redirect
    await new Promise(r => setTimeout(r, 5000));
  }

  // Take screenshot
  const screenshotPath = join(SCREENSHOT_DIR, `adhoc_${Date.now()}.png`);
  await page.screenshot({ path: screenshotPath, fullPage: true });
  console.log(`[read-page] Screenshot saved: ${screenshotPath}`);

  // Extract text content
  const textContent = await page.evaluate(() => {
    // Try to find a code/pre/markdown container first (source code viewer)
    const codeEl = document.querySelector('pre, code, .source-code, .file-content, [class*="content"], [class*="source"]');
    // Get full body text as fallback
    return document.body.innerText;
  });

  const textPath = join(SCREENSHOT_DIR, `page_content_${Date.now()}.txt`);
  writeFileSync(textPath, textContent, 'utf8');
  console.log(`[read-page] Text content saved: ${textPath}`);
  console.log(`[read-page] Text length: ${textContent.length} chars`);

  await browser.close();
}

main().catch(err => {
  console.error('[read-page] Fatal:', err.message);
  process.exit(1);
});
