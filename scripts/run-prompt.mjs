#!/usr/bin/env node
// scripts/run-prompt.mjs
// Runs a single prompt against the deployed app and captures a screenshot.
// Usage: node scripts/run-prompt.mjs "What datasets are in this project?" output_name
// Reuses auth from persistent profile.

import { createRequire } from 'module';
const require = createRequire('/tmp/puppeteer-runner/');
const puppeteer = require('puppeteer');
import { mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCREENSHOT_DIR = join(__dirname, '..', 'test-screenshots');
const APP_URL = 'https://bigqueryaif.web.app';
const USER_DATA_DIR = '/tmp/bqaif-puppeteer-profile';

const prompt = process.argv[2];
const outputName = process.argv[3] || 'prompt_result';

if (!prompt) {
  console.error('Usage: node scripts/run-prompt.mjs "prompt text" output_name');
  process.exit(1);
}

mkdirSync(SCREENSHOT_DIR, { recursive: true });

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

async function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function run() {
  const chrome = findChrome();
  if (!chrome) { console.error('Chrome not found'); process.exit(1); }
  console.log(`[run] Prompt: "${prompt}"`);
  console.log(`[run] Output: ${outputName}`);

  const browser = await puppeteer.launch({
    headless: false,
    executablePath: chrome,
    userDataDir: USER_DATA_DIR,
    defaultViewport: { width: 1440, height: 900 },
    args: ['--no-first-run', '--no-default-browser-check', '--disable-extensions'],
  });

  try {
    const page = await browser.newPage();
    const freshUrl = `${APP_URL}?t=${Date.now()}&agent=v2`;
    console.log('[run] Navigating...');
    await page.goto(freshUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    await delay(4000);

    // Wait for textarea
    let textarea;
    for (let i = 0; i < 10; i++) {
      textarea = await page.$('textarea');
      if (textarea) break;
      console.log(`[run] Waiting for textarea... (${i + 1})`);
      await delay(2000);
    }
    if (!textarea) {
      console.error('[run] Textarea not found after 20s');
      await page.screenshot({ path: join(SCREENSHOT_DIR, `${outputName}_error.png`), fullPage: true });
      await browser.close();
      process.exit(1);
    }

    // Select malloy-data project if welcome screen shows favorites
    try {
      const clicked = await page.evaluate(() => {
        // Look for a chip/button containing 'malloy-data' in the main content area
        const allBtns = document.querySelectorAll('button, [role="button"]');
        for (const btn of allBtns) {
          const text = btn.textContent || '';
          const rect = btn.getBoundingClientRect();
          // Only click chips in the main content area (not the header project selector)
          if (text.includes('malloy-data') && rect.top > 100 && rect.left > 200) {
            btn.click();
            return true;
          }
        }
        return false;
      });
      if (clicked) {
        console.log('[run] Selected malloy-data from welcome screen');
        await delay(3000);
      } else {
        console.log('[run] Project already selected or no welcome chip found');
      }
    } catch { /* project may already be selected */ }

    // Type the prompt using React native setter
    await page.evaluate((text) => {
      const ta = document.querySelector('textarea');
      if (!ta) return;
      const nativeSetter = Object.getOwnPropertyDescriptor(
        window.HTMLTextAreaElement.prototype, 'value'
      ).set;
      nativeSetter.call(ta, text);
      ta.dispatchEvent(new Event('input', { bubbles: true }));
      ta.dispatchEvent(new Event('change', { bubbles: true }));
    }, prompt);
    await delay(500);

    // Click the send button (the circular button with arrow icon next to textarea)
    const submitted = await page.evaluate(() => {
      // Look for the send button - it's typically a button near the textarea
      const buttons = document.querySelectorAll('button');
      for (const btn of buttons) {
        // The send button has an SVG arrow or specific aria/title
        const rect = btn.getBoundingClientRect();
        const ta = document.querySelector('textarea');
        if (!ta) continue;
        const taRect = ta.getBoundingClientRect();
        // Send button is near the textarea (within 100px vertically)
        if (Math.abs(rect.top - taRect.top) < 100 && rect.left > taRect.right - 80) {
          btn.click();
          return true;
        }
      }
      return false;
    });

    if (!submitted) {
      // Fallback: try Enter key
      await page.focus('textarea');
      await page.keyboard.press('Enter');
    }
    console.log(`[run] Prompt submitted (button: ${submitted}), waiting for response...`);

    // Wait for spinner to appear
    const spinnerStart = Date.now();
    let spinnerSeen = false;
    while (Date.now() - spinnerStart < 20000) {
      const hasSpinner = await page.evaluate(() => {
        const svgs = document.querySelectorAll('svg[viewBox="0 0 28 28"]');
        for (const svg of svgs) {
          const s = svg.querySelector('defs > style');
          if (s && s.textContent && s.textContent.includes('keyframes')) return true;
        }
        return false;
      });
      if (hasSpinner) { spinnerSeen = true; break; }
      await delay(500);
    }
    if (spinnerSeen) console.log('[run] Spinner detected...');
    else console.log('[run] No spinner detected, waiting anyway...');

    // Wait for spinner to disappear (response complete)
    let idleCount = 0;
    const responseStart = Date.now();
    while (Date.now() - responseStart < 120000) {
      const hasSpinner = await page.evaluate(() => {
        const svgs = document.querySelectorAll('svg[viewBox="0 0 28 28"]');
        for (const svg of svgs) {
          const s = svg.querySelector('defs > style');
          if (s && s.textContent && s.textContent.includes('keyframes')) return true;
        }
        return false;
      });
      if (!hasSpinner) {
        idleCount++;
        if (idleCount >= 3) break;
      } else {
        idleCount = 0;
      }
      await delay(2000);
    }

    // Extra settle time for rendering
    await delay(3000);

    // Take full page screenshot
    const screenshotPath = join(SCREENSHOT_DIR, `${outputName}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`[run] Saved: ${screenshotPath}`);

    // Also try to scroll down to capture any content below the fold
    const pageHeight = await page.evaluate(() => document.body.scrollHeight);
    if (pageHeight > 1000) {
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await delay(1000);
      const scrolledPath = join(SCREENSHOT_DIR, `${outputName}_scrolled.png`);
      await page.screenshot({ path: scrolledPath, fullPage: true });
      console.log(`[run] Saved scrolled: ${scrolledPath}`);
    }

  } finally {
    await browser.close();
  }
}

run().catch(e => { console.error(e); process.exit(1); });
