#!/usr/bin/env node
// End-to-end test: type "show tables in formula_1", click drivers row, capture agent logs
import { createRequire } from 'module';
const require = createRequire('/tmp/puppeteer-runner/');
const puppeteer = require('puppeteer');
import { mkdirSync } from 'fs';

const DIR = '/Users/schomer/Desktop/DATA APPS/bigquery-aif/test-screenshots';
mkdirSync(DIR, { recursive: true });

async function waitForResponse(page, maxMs = 120000) {
  let spinnerSeen = false, idle = 0;
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    await new Promise(r => setTimeout(r, 2000));
    try {
      const spinning = await page.evaluate(() => {
        const svgs = document.querySelectorAll('svg[viewBox="0 0 28 28"]');
        for (const svg of svgs) {
          const s = svg.querySelector('defs > style');
          if (s?.textContent?.includes('keyframes')) return true;
        }
        return false;
      });
      if (spinning) { spinnerSeen = true; idle = 0; }
      else if (spinnerSeen) { idle++; if (idle >= 2) return true; }
      if (!spinnerSeen && Date.now() - start > 30000) return false;
    } catch(e) {}
  }
  return false;
}

(async () => {
  const browser = await puppeteer.launch({
    headless: false,
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    userDataDir: '/tmp/bqaif-puppeteer-profile',
    args: ['--window-size=1440,900', '--no-first-run', '--no-default-browser-check',
           '--disable-blink-features=AutomationControlled'],
    ignoreDefaultArgs: ['--enable-automation'],
    defaultViewport: { width: 1440, height: 900 },
  });

  const page = (await browser.pages())[0] || await browser.newPage();
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
  });

  const consoleLogs = [];
  page.on('console', msg => {
    consoleLogs.push(msg.text());
    if (msg.text().includes('[Agent]')) console.log('BROWSER:', msg.text());
  });

  // Fresh conversation
  await page.goto('https://bigqueryaif.web.app?t=' + Date.now(), {
    waitUntil: 'networkidle2', timeout: 30000
  });
  await new Promise(r => setTimeout(r, 3000));

  // Select malloy-data project
  console.log('Selecting project...');
  const buttons = await page.$$('button');
  for (const btn of buttons) {
    const text = await btn.evaluate(el => el.textContent);
    if (text?.includes('malloy-data')) {
      await btn.click();
      console.log('Clicked malloy-data');
      break;
    }
  }
  await new Promise(r => setTimeout(r, 5000));

  // Verify we're in chat
  const hasTextarea = await page.evaluate(() => !!document.querySelector('textarea'));
  if (!hasTextarea) {
    console.log('ERROR: No textarea after project select');
    await page.screenshot({ path: `${DIR}/debug_error.png`, fullPage: true });
    await browser.close();
    return;
  }

  // STEP 1: Type and submit
  console.log('\nSTEP 1: show tables in formula_1');
  const textarea = await page.$('textarea');
  await textarea.click();
  await new Promise(r => setTimeout(r, 300));
  await page.keyboard.type('show tables in formula_1', { delay: 30 });
  await new Promise(r => setTimeout(r, 500));
  await page.keyboard.press('Enter');
  console.log('Submitted');

  console.log('Waiting for response...');
  const got = await waitForResponse(page);
  console.log('Response received:', got);
  await new Promise(r => setTimeout(r, 3000));
  await page.screenshot({ path: `${DIR}/debug_step1_tables.png`, fullPage: true });
  console.log('Saved: debug_step1_tables.png');

  // Check for schema-list-row elements
  const schemaRows = await page.evaluate(() => {
    const els = document.querySelectorAll('.schema-list-row');
    return Array.from(els).map(el => el.textContent?.trim()?.slice(0, 60));
  });
  console.log(`Found ${schemaRows.length} schema-list-rows:`, schemaRows.slice(0, 5));

  if (schemaRows.length === 0) {
    console.log('No schema-list-row found. Checking page content...');
    const content = await page.evaluate(() => document.body.textContent?.slice(-500));
    console.log('Page tail:', content?.slice(0, 300));
    await browser.close();
    return;
  }

  // STEP 2: Click drivers row
  console.log('\nSTEP 2: Clicking drivers...');
  const clickResult = await page.evaluate(() => {
    const els = document.querySelectorAll('.schema-list-row');
    for (const el of els) {
      if (el.textContent?.includes('drivers')) {
        el.click();
        return 'clicked drivers';
      }
    }
    // fallback: first row
    if (els[0]) { els[0].click(); return 'clicked first: ' + els[0].textContent?.trim()?.slice(0, 30); }
    return 'none';
  });
  console.log(clickResult);

  console.log('Waiting for drill-down...');
  const got2 = await waitForResponse(page);
  console.log('Drill-down received:', got2);
  await new Promise(r => setTimeout(r, 3000));
  await page.screenshot({ path: `${DIR}/debug_step2_drilldown.png`, fullPage: true });
  console.log('Saved: debug_step2_drilldown.png');

  // Dump ALL agent logs
  console.log('\n=== AGENT DEBUG LOGS ===');
  consoleLogs.filter(l => l.includes('[Agent]')).forEach(l => console.log(l));
  console.log('=== END ===');

  await browser.close();
})().catch(e => { console.error(e.message); process.exit(1); });
