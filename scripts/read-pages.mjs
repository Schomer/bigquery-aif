#!/usr/bin/env node
// scripts/read-pages.mjs
// Opens multiple URLs in sequence using persistent Chrome profile and extracts text content.
// Usage: node scripts/read-pages.mjs

import { createRequire } from 'module';
const require = createRequire('/tmp/puppeteer-runner/');
const puppeteer = require('puppeteer');
import { mkdirSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, '..', 'test-screenshots', 'ca_skills');
const USER_DATA_DIR = '/tmp/bqaif-puppeteer-profile';

const BASE = 'https://source.corp.google.com/piper///depot/google3/experimental/users/romanomike/ca_skills/conversational-analytics';

const PAGES = [
  { name: 'references_dir', url: `${BASE}/references` },
  { name: 'planning', url: `${BASE}/references/planning.md` },
  { name: 'sql_gen', url: `${BASE}/references/sql_gen.md` },
  { name: 'viz_gen', url: `${BASE}/references/viz_gen.md` },
  { name: 'report_gen', url: `${BASE}/references/report_gen.md` },
  { name: 'follow_up_gen', url: `${BASE}/references/follow_up_gen.md` },
  { name: 'bqml_aiqe', url: `${BASE}/references/bqml_aiqe.md` },
];

mkdirSync(OUTPUT_DIR, { recursive: true });

function findChrome() {
  const paths = [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ];
  for (const p of paths) {
    if (existsSync(p)) return p;
  }
  return null;
}

async function main() {
  const chromePath = findChrome();
  if (!chromePath) {
    console.error('[read-pages] Could not find Chrome.');
    process.exit(1);
  }

  console.log('[read-pages] Launching Chrome...');
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

  for (const { name, url } of PAGES) {
    console.log(`[read-pages] --- ${name} ---`);
    console.log(`[read-pages] Navigating to ${url}...`);
    try {
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
      await new Promise(r => setTimeout(r, 4000)); // let content render

      // Screenshot
      const screenshotPath = join(OUTPUT_DIR, `${name}.png`);
      await page.screenshot({ path: screenshotPath, fullPage: true });
      console.log(`[read-pages] Screenshot: ${screenshotPath}`);

      // Extract text
      const textContent = await page.evaluate(() => document.body.innerText);
      const textPath = join(OUTPUT_DIR, `${name}.txt`);
      writeFileSync(textPath, textContent, 'utf8');
      console.log(`[read-pages] Text: ${textPath} (${textContent.length} chars)`);
    } catch (err) {
      console.error(`[read-pages] Error on ${name}: ${err.message}`);
    }
  }

  console.log('[read-pages] Done. Closing browser.');
  await browser.close();
}

main().catch(err => {
  console.error('[read-pages] Fatal:', err.message);
  process.exit(1);
});
