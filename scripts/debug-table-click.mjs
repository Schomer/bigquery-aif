#!/usr/bin/env node
// Test script: type a prompt, click a table, capture console logs + screenshots
import { createRequire } from 'module';
const require = createRequire('/tmp/puppeteer-runner/noop.js');
const puppeteer = require('puppeteer');

const APP_URL = 'https://bigqueryaif.web.app';
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PROFILE = '/tmp/bqaif-puppeteer-profile';
const SCREENSHOT_DIR = '/Users/schomer/Desktop/DATA APPS/bigquery-aif/test-screenshots';

import { mkdirSync } from 'fs';
mkdirSync(SCREENSHOT_DIR, { recursive: true });

async function waitForResponse(page, timeoutMs = 120000) {
  // Wait for spinner to appear then disappear
  const start = Date.now();
  let spinnerSeen = false;
  let idleCount = 0;

  while (Date.now() - start < timeoutMs) {
    const hasSpinner = await page.evaluate(() => {
      return !!document.querySelector('.spark-spinner, [class*="spinner"], [class*="Spinner"]');
    });
    
    if (hasSpinner) {
      spinnerSeen = true;
      idleCount = 0;
    } else if (spinnerSeen) {
      idleCount++;
      if (idleCount >= 3) return true;
    }
    
    // Also check for loading state via the status text
    const hasStatus = await page.evaluate(() => {
      return !!document.querySelector('[class*="status"]');
    });
    if (hasStatus && !spinnerSeen) {
      spinnerSeen = true;
    }
    
    await new Promise(r => setTimeout(r, 1500));
  }
  
  // If we never saw a spinner, just wait a bit and check if content appeared
  if (!spinnerSeen) {
    await new Promise(r => setTimeout(r, 5000));
    return true;
  }
  
  return false;
}

async function typeInTextarea(page, text) {
  // Clear and type using React-compatible approach
  await page.evaluate((txt) => {
    const ta = document.querySelector('textarea');
    if (!ta) throw new Error('No textarea found');
    const nativeSet = Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype, 'value'
    ).set;
    nativeSet.call(ta, txt);
    ta.dispatchEvent(new Event('input', { bubbles: true }));
  }, text);
}

async function main() {
  const consoleLogs = [];
  
  const browser = await puppeteer.launch({
    headless: false,
    executablePath: CHROME,
    userDataDir: PROFILE,
    args: ['--window-size=1440,900', '--no-first-run'],
    defaultViewport: { width: 1440, height: 900 },
  });

  const page = await browser.newPage();
  
  // Capture ALL console logs from the page
  page.on('console', msg => {
    const text = msg.text();
    consoleLogs.push({ type: msg.type(), text });
    if (text.includes('[Agent]')) {
      console.log('BROWSER CONSOLE:', text);
    }
  });

  try {
    // Step 1: Navigate to app with fresh conversation
    console.log('--- Step 1: Navigate to app ---');
    await page.goto(`${APP_URL}?t=${Date.now()}`, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(r => setTimeout(r, 3000));
    
    // Check if signed in
    const hasTextarea = await page.evaluate(() => !!document.querySelector('textarea'));
    if (!hasTextarea) {
      console.log('ERROR: No textarea found -- app may not be loaded or not signed in');
      await page.screenshot({ path: `${SCREENSHOT_DIR}/debug_no_textarea.png`, fullPage: true });
      return;
    }

    // Step 2: Type "show tables in formula_1" and submit
    console.log('--- Step 2: Type "show tables in formula_1" ---');
    await typeInTextarea(page, 'show tables in formula_1');
    await new Promise(r => setTimeout(r, 500));
    await page.keyboard.press('Enter');
    
    console.log('--- Waiting for response... ---');
    await waitForResponse(page);
    await new Promise(r => setTimeout(r, 2000));
    
    await page.screenshot({ path: `${SCREENSHOT_DIR}/debug_step1_tables.png`, fullPage: true });
    console.log('Screenshot: debug_step1_tables.png');

    // Step 3: Find and click a table row (look for "drivers" or any clickable row)
    console.log('--- Step 3: Looking for clickable table rows ---');
    
    const clickableInfo = await page.evaluate(() => {
      // Find ClickableRow elements or table rows in SchemaView
      const rows = document.querySelectorAll('[class*="clickable-row"], [role="button"], tr[style*="cursor"]');
      const info = [];
      for (const row of rows) {
        const text = row.textContent?.trim().slice(0, 80);
        if (text) info.push(text);
      }
      
      // Also look for any element containing "drivers"
      const allElements = document.querySelectorAll('*');
      let driversEl = null;
      for (const el of allElements) {
        if (el.children.length === 0 && el.textContent?.trim() === 'drivers') {
          driversEl = { tag: el.tagName, text: el.textContent.trim(), parentTag: el.parentElement?.tagName };
          break;
        }
      }
      
      return { rowCount: rows.length, rowTexts: info.slice(0, 10), driversEl };
    });
    
    console.log('Clickable rows found:', JSON.stringify(clickableInfo, null, 2));

    // Try to click on a table row -- find the first row that looks like a table name
    const clicked = await page.evaluate(() => {
      // Strategy 1: Look for elements with onClick that contain table names
      const rows = document.querySelectorAll('[class*="schema-row"], [class*="clickable"]');
      for (const row of rows) {
        const text = row.textContent?.trim();
        if (text && text.includes('drivers')) {
          row.click();
          return `Clicked row with text: ${text.slice(0, 60)}`;
        }
      }
      
      // Strategy 2: Look for any row in the schema view
      const schemaRows = document.querySelectorAll('[class*="schema"] tr, [class*="Schema"] tr');
      for (const row of schemaRows) {
        const text = row.textContent?.trim();
        if (text && !text.includes('Name') && !text.includes('Type')) {
          row.click();
          return `Clicked schema row: ${text.slice(0, 60)}`;
        }
      }
      
      // Strategy 3: Just find anything with "drivers" text and click its parent
      const allElements = document.querySelectorAll('*');
      for (const el of allElements) {
        if (el.children.length === 0 && el.textContent?.trim() === 'drivers') {
          // Click the closest interactive parent
          const clickTarget = el.closest('[role="button"], button, tr, [onclick]') || el.parentElement;
          if (clickTarget) {
            clickTarget.click();
            return `Clicked element near "drivers": ${clickTarget.tagName}`;
          }
        }
      }
      
      return 'NO_CLICK_TARGET_FOUND';
    });
    
    console.log('Click result:', clicked);
    
    if (clicked === 'NO_CLICK_TARGET_FOUND') {
      console.log('Could not find a clickable table row. Taking debug screenshot...');
      await page.screenshot({ path: `${SCREENSHOT_DIR}/debug_no_click_target.png`, fullPage: true });
      
      // Dump the page HTML structure for debugging
      const htmlStructure = await page.evaluate(() => {
        const container = document.querySelector('[class*="chat"], [class*="Chat"], main');
        return container ? container.innerHTML.slice(0, 3000) : 'No container found';
      });
      console.log('Page structure:', htmlStructure.slice(0, 1000));
    } else {
      // Step 4: Wait for the drill-down response
      console.log('--- Step 4: Waiting for drill-down response... ---');
      await waitForResponse(page);
      await new Promise(r => setTimeout(r, 2000));
      
      await page.screenshot({ path: `${SCREENSHOT_DIR}/debug_step2_drilldown.png`, fullPage: true });
      console.log('Screenshot: debug_step2_drilldown.png');
    }

    // Step 5: Dump all captured console logs containing [Agent]
    console.log('\n=== AGENT CONSOLE LOGS ===');
    const agentLogs = consoleLogs.filter(l => l.text.includes('[Agent]') || l.text.includes('Tool calls'));
    for (const log of agentLogs) {
      console.log(`[${log.type}] ${log.text}`);
    }
    console.log('=== END AGENT LOGS ===\n');

    // Also dump any errors
    const errorLogs = consoleLogs.filter(l => l.type === 'error');
    if (errorLogs.length > 0) {
      console.log('=== ERRORS ===');
      for (const log of errorLogs.slice(0, 5)) {
        console.log(log.text.slice(0, 200));
      }
      console.log('=== END ERRORS ===');
    }

  } catch (err) {
    console.error('Test error:', err.message);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/debug_error.png`, fullPage: true });
  } finally {
    await browser.close();
  }
}

main().catch(console.error);
