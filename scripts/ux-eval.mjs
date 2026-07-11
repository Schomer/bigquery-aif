#!/usr/bin/env node
// scripts/ux-eval.mjs
// UX Evaluation: captures screenshots of each supported task, sends them to
// Gemini for critical evaluation, and produces a scored report.
//
// Usage:
//   node scripts/ux-eval.mjs                    # Full suite (25 tests)
//   node scripts/ux-eval.mjs --only Q1          # Single test
//   node scripts/ux-eval.mjs --start DQ1        # Start from a test
//   node scripts/ux-eval.mjs --tier Query       # Run one tier
//   node scripts/ux-eval.mjs --capture-only     # Screenshots only, skip eval
//
// Prerequisites:
//   1. Puppeteer installed in /tmp/puppeteer-runner/
//   2. System Chrome with persistent profile at /tmp/bqaif-puppeteer-profile
//   3. GOOGLE_GENERATIVE_AI_API_KEY in .env.local (for Gemini evaluation)
//   4. malloy-data project with ecomm dataset (run setup-reference-dataset.mjs)

import { createRequire } from 'module';
const require = createRequire('/tmp/puppeteer-runner/');
const puppeteer = require('puppeteer');
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createInterface } from 'readline';
import { execSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const SCREENSHOT_DIR = join(ROOT, 'test-screenshots', 'ux-eval');
const RESULTS_DIR = join(ROOT, 'test-results');
const APP_URL = 'https://bigqueryaif.web.app';
const USER_DATA_DIR = '/tmp/bqaif-puppeteer-profile';

// Load .env.local
const envPath = join(ROOT, '.env.local');
let GEMINI_KEY = '';
if (existsSync(envPath)) {
  const envLines = readFileSync(envPath, 'utf-8').split('\n');
  const env = {};
  for (const line of envLines) {
    const [k, ...v] = line.split('=');
    if (k && !k.startsWith('#') && k.trim()) env[k.trim()] = v.join('=').trim();
  }
  GEMINI_KEY = env.NEXT_PUBLIC_GEMINI_API_KEY || env.GOOGLE_GENERATIVE_AI_API_KEY || env.GOOGLE_AI_API_KEY || '';
}

// ---- Test Catalog -----------------------------------------------------------
// 25 scenarios covering every supported skill, phrased as a real user would.
// Each includes a "smartResult" description that defines what a 4+ score looks like.

const TESTS = [
  // Foundation
  {
    id: 'F1', tier: 'Foundation',
    prompt: 'What datasets do I have?',
    smartResult: 'Card showing datasets with row counts, sizes, last-modified dates -- not just a list of names. Suggestions offer to explore each dataset by name.',
  },
  {
    id: 'F2', tier: 'Foundation',
    prompt: 'What tables are in the ecomm dataset?',
    smartResult: 'Table list showing types, row counts, sizes. Suggestions use actual table names like "Describe orders" or "Preview users".',
  },
  {
    id: 'F3', tier: 'Foundation',
    prompt: 'Tell me about the orders table in ecomm',
    smartResult: 'Schema view with field types and descriptions. Sample data tab. Headline like "orders -- 12 columns, 1.2M rows". Suggestions: "Query orders", "Profile orders".',
  },
  {
    id: 'F4', tier: 'Foundation',
    prompt: 'Show me sample data from the users table in ecomm',
    smartResult: 'Clean data table with formatted values, readable column headers. Row count shown. Suggestions: "Filter by state", "Show user signup trends".',
  },
  {
    id: 'F5', tier: 'Foundation',
    prompt: 'How many orders are there in ecomm?',
    smartResult: 'KPI card showing formatted count (e.g., "1,234,567 orders"). Not raw number. Suggestions: "Orders by status", "Orders by month".',
  },

  // Analytical Queries
  {
    id: 'Q1', tier: 'Query',
    prompt: 'What are the top 10 products by revenue in ecomm?',
    smartResult: 'Bar chart or sorted table, revenue formatted as currency. Headline: "Top 10 Products by Revenue". Suggestion: "Show revenue trend for [top product]".',
  },
  {
    id: 'Q2', tier: 'Query',
    prompt: 'Show me monthly revenue from order_items in ecomm',
    smartResult: 'Line chart with months on x-axis, revenue on y-axis formatted as currency. Headline calls out total or trend. Suggestion: "Compare by product category".',
  },
  {
    id: 'Q3', tier: 'Query',
    prompt: 'How many orders by status in ecomm?',
    smartResult: 'Bar or pie chart showing distribution. Headline: "Order Distribution by Status". Formatted counts or percentages.',
  },
  {
    id: 'Q4', tier: 'Query',
    prompt: "What's the average order value in ecomm?",
    smartResult: 'KPI card with formatted currency value. Headline: "Average Order Value". Suggestions: "AOV by month", "AOV by customer segment".',
  },
  {
    id: 'Q5', tier: 'Query',
    prompt: 'Show me the busiest days for orders in ecomm',
    smartResult: 'Chart showing order volume by day-of-week or date. Clear axis labels. Headline identifies the peak day.',
  },
  {
    id: 'Q6', tier: 'Query',
    prompt: 'Which states have the most users in ecomm?',
    smartResult: 'Map visualization or ranked bar chart. Headline: "User Distribution by State -- Top: California". Formatted counts.',
  },

  // Data Quality
  {
    id: 'DQ1', tier: 'Data Quality',
    prompt: 'Profile the order_items table in ecomm',
    smartResult: 'Per-column stats: type, null %, distinct values, distributions with histograms. Headline: "Data Profile: order_items -- N columns, M rows".',
  },
  {
    id: 'DQ2', tier: 'Data Quality',
    prompt: 'Check for null values in the users table in ecomm',
    smartResult: 'Report showing which columns have nulls with percentages and visual bars. Headline: "Null Analysis: users -- N columns with nulls".',
  },
  {
    id: 'DQ3', tier: 'Data Quality',
    prompt: 'Are there duplicates in the order_items table in ecomm?',
    smartResult: 'Clear yes/no answer with count. If yes, example groups. Headline: "N duplicate rows found". Suggestion: "Remove duplicates".',
  },

  // Monitoring
  {
    id: 'M1', tier: 'Monitoring',
    prompt: 'Show me recent jobs in this project',
    smartResult: 'Job list with status indicators, run times, bytes processed. Headline: "N jobs in the last 24 hours". Suggestions: "Show failed jobs", "Cost by job".',
  },
  {
    id: 'M2', tier: 'Monitoring',
    prompt: 'How much storage is each dataset using?',
    smartResult: 'Visual breakdown (bar chart or treemap) of storage by dataset. Formatted sizes (GB/MB). Headline: "Total Storage: X GB across N datasets".',
  },
  {
    id: 'M3', tier: 'Monitoring',
    prompt: 'How much have my queries cost this month?',
    smartResult: 'Cost breakdown with formatted currency. Headline: "Query Costs: $X.XX this month". Suggestions: "Cost by user", "Most expensive queries".',
  },

  // Discovery
  {
    id: 'D1', tier: 'Discovery',
    prompt: 'Find tables with a user_id column',
    smartResult: 'List of matching tables with the matching column highlighted. Headline: "N tables contain a user_id column". Suggestions: "Compare these tables".',
  },
  {
    id: 'D2', tier: 'Discovery',
    prompt: 'Compare orders and order_items in ecomm',
    smartResult: 'Side-by-side comparison: row counts, schemas, shared columns highlighted. Headline: "Comparison: orders vs order_items". Suggestion: "Join these tables".',
  },

  // Visualization
  {
    id: 'V1', tier: 'Viz',
    prompt: 'Show me a pie chart of orders by status in ecomm',
    smartResult: 'Pie chart with labels, percentages, legend. Colors distinguish each status. Headline includes the breakdown.',
  },
  {
    id: 'V2', tier: 'Viz',
    prompt: 'Chart total revenue by month from order_items in ecomm',
    smartResult: 'Line or bar chart, monthly x-axis, currency y-axis. Clean labels. Headline calls out the trend or total.',
  },

  // Governance
  {
    id: 'G1', tier: 'Governance',
    prompt: 'Who has access to the ecomm dataset?',
    smartResult: 'Access list with roles and principals. Headline: "Access Control: ecomm -- N principals". Clear IAM role formatting.',
  },

  // Data Loading
  {
    id: 'DL1', tier: 'Data Loading',
    prompt: 'Export the orders table from ecomm to CSV',
    smartResult: 'Export confirmation with row count, file info. Headline: "Export: orders to CSV". Clear status indicator.',
  },

  // Pipeline
  {
    id: 'P1', tier: 'Pipeline',
    prompt: 'Show me scheduled queries in this project',
    smartResult: 'List of scheduled queries with status, frequency, last run. Headline: "N scheduled queries". Suggestions: "Create new pipeline".',
  },

  // Conversational
  {
    id: 'C1', tier: 'Conversation',
    prompt: 'What can you help me with?',
    smartResult: 'Informative overview of capabilities organized by category. Not a wall of text. Suggestions point to common starting actions like "List my datasets".',
  },
];

// ---- CLI Args ---------------------------------------------------------------

const args = process.argv.slice(2);
let startAt = null;
let onlyTest = null;
let onlyTier = null;
let captureOnly = false;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--start' && args[i + 1]) startAt = args[i + 1];
  if (args[i] === '--only' && args[i + 1]) onlyTest = args[i + 1];
  if (args[i] === '--tier' && args[i + 1]) onlyTier = args[i + 1];
  if (args[i] === '--capture-only') captureOnly = true;
}

mkdirSync(SCREENSHOT_DIR, { recursive: true });
mkdirSync(RESULTS_DIR, { recursive: true });

// ---- Puppeteer Helpers (reused from visual-test.mjs) ------------------------

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

async function waitForResponse(page, timeoutMs = 120000) {
  const startTime = Date.now();
  const pollInterval = 2000;

  async function isSpinnerPresent() {
    return page.evaluate(() => {
      const svgs = document.querySelectorAll('svg[viewBox="0 0 28 28"]');
      for (const svg of svgs) {
        const s = svg.querySelector('defs > style');
        if (s && s.textContent && s.textContent.includes('keyframes')) return true;
      }
      return false;
    });
  }

  // Phase 1: Wait for spinner to APPEAR (max 20s)
  let loadingStarted = false;
  while (Date.now() - startTime < 20000) {
    if (await isSpinnerPresent()) {
      loadingStarted = true;
      break;
    }
    await delay(500);
  }

  if (!loadingStarted) {
    await delay(8000);
  }

  // Phase 2: Wait for spinner to DISAPPEAR (2 consecutive idle polls)
  let consecutiveIdle = 0;
  while (Date.now() - startTime < timeoutMs) {
    const spinning = await isSpinnerPresent();
    if (!spinning) {
      consecutiveIdle++;
      if (consecutiveIdle >= 2) {
        await delay(2000);
        return true;
      }
    } else {
      consecutiveIdle = 0;
    }
    await delay(pollInterval);
  }

  console.warn(`[eval] Timed out after ${timeoutMs / 1000}s`);
  return false;
}

async function startNewConversation(page, browser) {
  // Click the #new-btn button (the "+ New" button in the sidebar).
  // This calls React's newConversation() which resets state properly.
  try {
    // Check if page is still usable
    await page.evaluate(() => true);
  } catch {
    // Page is detached -- get a fresh one
    const pages = await browser.pages();
    page = pages[pages.length - 1] || await browser.newPage();
    await page.goto(APP_URL, { waitUntil: 'networkidle2', timeout: 30000 });
    await delay(3000);
    await page.waitForSelector('textarea', { timeout: 10000 });
    return page;
  }

  try {
    await page.click('#new-btn');
    console.log('[eval] Clicked #new-btn');
    await delay(2000);
  } catch (err) {
    // Fallback: reload the page
    console.log(`[eval] #new-btn click failed (${err.message}), reloading...`);
    await page.reload({ waitUntil: 'networkidle2', timeout: 30000 });
    await delay(3000);
  }

  // Wait for textarea
  await page.waitForSelector('textarea', { timeout: 10000 });

  // Verify the page is in a clean state (no result cards visible)
  const hasResults = await page.evaluate(() => {
    return document.querySelectorAll('[class*="tone-"]').length;
  });
  if (hasResults > 0) {
    // Stale results still showing -- force reload
    console.log('[eval] Stale results detected, reloading...');
    await page.reload({ waitUntil: 'networkidle2', timeout: 30000 });
    await delay(3000);
    await page.waitForSelector('textarea', { timeout: 10000 });
  }

  await delay(500);
  return page;
}

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

// ---- DOM Extraction ---------------------------------------------------------
// Captures structured metadata from the rendered result to supplement the
// screenshot for evaluation.

async function extractDomMetadata(page) {
  return page.evaluate(() => {
    const meta = {
      headline: null,
      chips: [],
      resultType: null,
      errorText: null,
      tableStats: null,
      chartPresent: false,
      kpiValue: null,
      visibleText: '',
    };

    // Headline: look for the artifact card headline (font-weight 500, inside card header)
    const headlineEls = document.querySelectorAll('[class*="tone-"] *');
    for (const el of headlineEls) {
      const style = window.getComputedStyle(el);
      if (style.fontWeight >= 500 && style.fontSize.startsWith('14') && el.textContent.trim().length > 3) {
        meta.headline = el.textContent.trim();
        break;
      }
    }
    // Fallback: look for any element that looks like a headline in card headers
    if (!meta.headline) {
      const cards = document.querySelectorAll('[class*="tone-neutral"], [class*="tone-positive"], [class*="tone-attention"]');
      for (const card of cards) {
        const firstChild = card.querySelector('div > div > span, div > div > div');
        if (firstChild && firstChild.textContent.trim().length > 3) {
          meta.headline = firstChild.textContent.trim().slice(0, 200);
          break;
        }
      }
    }

    // Suggestion chips
    const chipEls = document.querySelectorAll('.chip, [class*="chip"]');
    for (const chip of chipEls) {
      const text = chip.textContent.trim();
      if (text.length > 0 && text.length < 100) {
        meta.chips.push(text);
      }
    }

    // Result type detection
    const hasTable = document.querySelector('table') !== null;
    const hasSvgChart = document.querySelector('.recharts-wrapper, svg.recharts-surface') !== null;
    const hasKpi = (() => {
      const els = document.querySelectorAll('*');
      for (const el of els) {
        const s = window.getComputedStyle(el);
        if (s.fontSize && parseInt(s.fontSize) >= 40 && s.fontWeight >= 600) return el.textContent.trim();
      }
      return null;
    })();
    const hasSchema = document.querySelector('[data-tab], [role="tablist"]') !== null;

    if (hasKpi) {
      meta.resultType = 'KPI';
      meta.kpiValue = hasKpi;
    } else if (hasSvgChart) {
      meta.resultType = 'CHART';
    } else if (hasSchema) {
      meta.resultType = 'SCHEMA_VIEW';
    } else if (hasTable) {
      meta.resultType = 'TABLE';
    }

    // Table stats
    if (hasTable) {
      const rows = document.querySelectorAll('table tbody tr');
      const cols = document.querySelectorAll('table thead th');
      meta.tableStats = { rows: rows.length, columns: cols.length };
    }

    // Chart detection
    meta.chartPresent = hasSvgChart;

    // Error text
    const errorEls = document.querySelectorAll('[style*="fef2f2"], [style*="fed7aa"], [style*="fff7ed"], [style*="dc2626"], [style*="b91c1c"]');
    const errors = [];
    for (const el of errorEls) {
      const text = el.innerText || '';
      if (text.length > 5) errors.push(text.trim().slice(0, 300));
    }
    if (errors.length > 0) meta.errorText = errors.join(' | ');

    // Visible text from the last assistant message (for context)
    const msgs = document.querySelectorAll('[data-role="assistant"], [class*="assistant"]');
    if (msgs.length > 0) {
      const lastMsg = msgs[msgs.length - 1];
      meta.visibleText = (lastMsg.innerText || '').trim().slice(0, 2000);
    }
    // Fallback: grab text from artifact cards
    if (!meta.visibleText) {
      const cards = document.querySelectorAll('[class*="tone-"]');
      const texts = [];
      for (const card of cards) {
        texts.push((card.innerText || '').trim().slice(0, 500));
      }
      meta.visibleText = texts.join('\n---\n').slice(0, 2000);
    }

    return meta;
  });
}

// ---- Gemini Evaluation ------------------------------------------------------

function buildEvalPrompt(test, domMeta) {
  return `You are a critical, experienced data analyst evaluating a BigQuery data assistant application. You are looking at a screenshot of the app's response to a user query. Your job is to evaluate whether this response is genuinely good -- not whether it technically works, but whether it delivers a smart, helpful, visually clear experience.

USER'S PROMPT: "${test.prompt}"

WHAT A SMART RESULT WOULD LOOK LIKE:
${test.smartResult}

EXTRACTED METADATA FROM THE PAGE:
- Headline text: ${domMeta.headline ? `"${domMeta.headline}"` : '(none detected)'}
- Suggestion chips: ${domMeta.chips.length > 0 ? domMeta.chips.map(c => `"${c}"`).join(', ') : '(none)'}
- Detected result type: ${domMeta.resultType || '(unknown)'}
- KPI value shown: ${domMeta.kpiValue || '(none)'}
- Table stats: ${domMeta.tableStats ? `${domMeta.tableStats.rows} rows, ${domMeta.tableStats.columns} columns` : '(no table)'}
- Chart present: ${domMeta.chartPresent ? 'Yes' : 'No'}
- Errors detected: ${domMeta.errorText || 'None'}

VISIBLE TEXT FROM THE RESPONSE:
${domMeta.visibleText.slice(0, 1000) || '(no text captured)'}

Score the result on these 6 dimensions using a 1-5 scale. A score of 4 is the MINIMUM acceptable standard -- anything below 4 needs to be fixed.

DIMENSIONS:

1. TASK COMPLETION (Did the app do what the user asked?)
   5: Nailed it -- returned exactly what was asked plus useful extras
   4: Completed the task correctly with appropriate detail
   3: Partially completed -- missing key aspects or returned tangential data
   2: Mostly wrong -- misunderstood the request or returned wrong data type
   1: Failed completely -- error, empty result, or unrelated response

2. HEADLINE QUALITY (Does the title add value and accurately describe the result?)
   5: Insightful headline that summarizes the key finding from the data
   4: Accurate, specific headline referencing actual data (counts, names, totals)
   3: Generic but not wrong -- describes the type of result but adds no insight
   2: Parrots the user's question or uses a placeholder like "Query Results"
   1: Missing, wrong, or misleading headline

3. VISUAL CLARITY (Is the result easy to read, well-formatted, and visually informative?)
   5: Polished display with proper formatting, visual hierarchy, and data presentation
   4: Clean, readable display with appropriate formatting (numbers, dates, currency)
   3: Readable but plain -- raw field names, unformatted numbers, no visual hierarchy
   2: Cluttered or hard to read -- too many columns, truncated data, poor contrast
   1: Broken layout, unreadable, or raw JSON/data dump

4. DATA INSIGHT (Does the output help the user understand their data, not just see it?)
   5: Proactively highlights patterns, anomalies, or key findings from the data
   4: Presents data in a way that makes trends and comparisons immediately obvious
   3: Shows the data but the user must do their own analysis to understand it
   2: Raw data dump with no summarization, context, or interpretive help
   1: No data shown or data is presented in a way that obscures understanding

5. SUGGESTION QUALITY (Are the next-step suggestions specific, relevant, and useful?)
   5: Suggestions use actual data values and anticipate the user's next logical question
   4: Suggestions are specific to the data shown and help the user go deeper
   3: Suggestions are topically relevant but generic (not using actual data values)
   2: Suggestions are vaguely related but not useful (e.g., "Try another query")
   1: No suggestions, or completely irrelevant suggestions

6. OVERALL INTELLIGENCE (Does this feel like a smart assistant or a dumb tool?)
   5: Feels like working with an expert who anticipates needs and presents data thoughtfully
   4: Competent and helpful -- gets the job done well with appropriate presentation
   3: Functional but mechanical -- ran the query, showed the result, nothing more
   2: Feels like a basic query runner with a chat interface bolted on
   1: Feels broken or confusing -- user would not trust this tool

BE CRITICAL. Do not give generous scores. A real user paying for this tool would expect at least a 4 on every dimension.

Specific things to watch for:
- Headlines that just repeat the user's question are a 2 at best
- Suggestions like "Ask another question" or "Suggest next steps" are a 1
- Tables with raw field names (e.g., "sale_price" instead of "Sale Price") are a 3
- Numbers without formatting (no commas, no currency symbols) are a 3
- Missing units on KPI cards are a 3
- Charts without axis labels are a 3
- Empty suggestion chips section is a 2

Respond ONLY with valid JSON in this exact format:
{
  "scores": {
    "taskCompletion": <1-5>,
    "headlineQuality": <1-5>,
    "visualClarity": <1-5>,
    "dataInsight": <1-5>,
    "suggestionQuality": <1-5>,
    "overallIntelligence": <1-5>
  },
  "critique": {
    "taskCompletion": "<1-2 sentence explanation>",
    "headlineQuality": "<1-2 sentence explanation>",
    "visualClarity": "<1-2 sentence explanation>",
    "dataInsight": "<1-2 sentence explanation>",
    "suggestionQuality": "<1-2 sentence explanation>",
    "overallIntelligence": "<1-2 sentence explanation>"
  },
  "improvements": [
    "<specific, actionable improvement 1>",
    "<specific, actionable improvement 2>",
    "<specific, actionable improvement 3>"
  ],
  "overallAssessment": "<2-3 sentence summary of this result's quality>"
}`;
}

async function evaluateWithGemini(test, screenshotPath, domMeta) {
  if (!GEMINI_KEY) {
    console.warn('[eval] No Gemini API key found -- skipping evaluation');
    return null;
  }

  const imageData = readFileSync(screenshotPath);
  const base64 = imageData.toString('base64');
  const prompt = buildEvalPrompt(test, domMeta);

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${GEMINI_KEY}`;

  const body = {
    contents: [
      {
        role: 'user',
        parts: [
          { text: prompt },
          {
            inlineData: {
              mimeType: 'image/png',
              data: base64,
            },
          },
        ],
      },
    ],
    generationConfig: {
      responseMimeType: 'application/json',
      maxOutputTokens: 4096,
      temperature: 0.1,
    },
  };

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error(`[eval] Gemini API error ${res.status}: ${errText.slice(0, 200)}`);
      return null;
    }

    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (!text) {
      console.error('[eval] Gemini returned empty response');
      return null;
    }

    // Try parsing directly, then try repairing common issues
    try {
      return JSON.parse(text);
    } catch (parseErr) {
      // Attempt repair: strip markdown fences, fix trailing commas, close truncated strings
      let cleaned = text
        .replace(/^```json\s*/i, '').replace(/```\s*$/, '')  // strip markdown fences
        .replace(/,\s*([}\]])/g, '$1');  // trailing commas
      
      // If truncated, try to close the JSON structure
      if (!cleaned.endsWith('}')) {
        // Find the last complete property
        const lastBrace = cleaned.lastIndexOf('}');
        if (lastBrace > 0) {
          cleaned = cleaned.slice(0, lastBrace + 1);
          // Close any open outer braces
          const opens = (cleaned.match(/{/g) || []).length;
          const closes = (cleaned.match(/}/g) || []).length;
          for (let j = 0; j < opens - closes; j++) cleaned += '}';
        }
      }
      try {
        return JSON.parse(cleaned);
      } catch (e2) {
        console.error(`[eval] Gemini JSON repair failed: ${parseErr.message}`);
        return null;
      }
    }
  } catch (err) {
    console.error(`[eval] Gemini evaluation failed: ${err.message}`);
    return null;
  }
}

// ---- Report Generation ------------------------------------------------------

const DIMENSIONS = [
  'taskCompletion', 'headlineQuality', 'visualClarity',
  'dataInsight', 'suggestionQuality', 'overallIntelligence',
];

const DIM_LABELS = {
  taskCompletion: 'Task Completion',
  headlineQuality: 'Headline Quality',
  visualClarity: 'Visual Clarity',
  dataInsight: 'Data Insight',
  suggestionQuality: 'Suggestion Quality',
  overallIntelligence: 'Overall Intelligence',
};

function generateReport(results) {
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
  const evaluated = results.filter((r) => r.evaluation);
  const totalTests = results.length;
  const evalCount = evaluated.length;

  // Compute averages per dimension
  const dimAverages = {};
  const dimMins = {};
  const dimBelowFour = {};
  for (const dim of DIMENSIONS) {
    const scores = evaluated.map((r) => r.evaluation.scores[dim]).filter((s) => s != null);
    dimAverages[dim] = scores.length > 0 ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1) : 'N/A';
    dimMins[dim] = scores.length > 0 ? Math.min(...scores) : 'N/A';
    dimBelowFour[dim] = scores.filter((s) => s < 4).length;
  }

  // Overall average per test
  const testAverages = evaluated.map((r) => {
    const scores = DIMENSIONS.map((d) => r.evaluation.scores[d]).filter((s) => s != null);
    return scores.reduce((a, b) => a + b, 0) / scores.length;
  });
  const passing = testAverages.filter((a) => a >= 4).length;
  const needsWork = testAverages.filter((a) => a >= 3 && a < 4).length;
  const failing = testAverages.filter((a) => a < 3).length;

  // Collect all improvements and find patterns
  const allImprovements = [];
  for (const r of evaluated) {
    for (const imp of r.evaluation.improvements || []) {
      allImprovements.push({ test: r.test.id, improvement: imp });
    }
  }

  // Find dimensions that are consistently low
  const systemicIssues = [];
  for (const dim of DIMENSIONS) {
    const count = dimBelowFour[dim];
    if (count > 0) {
      systemicIssues.push({ dimension: DIM_LABELS[dim], count, total: evalCount });
    }
  }
  systemicIssues.sort((a, b) => b.count - a.count);

  // Build report
  let report = `# UX Evaluation Report

Generated: ${now}
Tests run: ${totalTests} | Evaluated: ${evalCount} | Passing (avg 4+): ${passing} | Needs work: ${needsWork} | Failing (avg <3): ${failing}

---

## Scorecard

| Dimension | Average | Lowest | Tests Below 4 |
|-----------|---------|--------|----------------|
`;

  for (const dim of DIMENSIONS) {
    report += `| ${DIM_LABELS[dim]} | ${dimAverages[dim]} | ${dimMins[dim]} | ${dimBelowFour[dim]}/${evalCount} |\n`;
  }

  // Systemic issues
  if (systemicIssues.length > 0) {
    report += `\n---\n\n## Systemic Issues\n\nDimensions that consistently score below 4, ranked by frequency:\n\n`;
    for (const issue of systemicIssues) {
      const pct = Math.round((issue.count / issue.total) * 100);
      report += `- **${issue.dimension}** -- below 4 in ${issue.count}/${issue.total} tests (${pct}%)\n`;
    }
  }

  // Common improvements
  if (allImprovements.length > 0) {
    report += `\n---\n\n## Improvement Themes\n\n`;
    // Group by similarity (simple keyword grouping)
    const themes = {};
    for (const imp of allImprovements) {
      const key = imp.improvement.toLowerCase().slice(0, 60);
      if (!themes[key]) themes[key] = { text: imp.improvement, tests: [] };
      themes[key].tests.push(imp.test);
    }
    const sortedThemes = Object.values(themes)
      .filter((t) => t.tests.length >= 2)
      .sort((a, b) => b.tests.length - a.tests.length);

    for (const theme of sortedThemes.slice(0, 10)) {
      report += `- (${theme.tests.length} tests) ${theme.text} -- [${theme.tests.join(', ')}]\n`;
    }
    if (sortedThemes.length === 0) {
      report += `No repeated improvement themes found. See individual test results below.\n`;
    }
  }

  // Per-test details
  report += `\n---\n\n## Individual Test Results\n\n`;

  for (const r of results) {
    const t = r.test;
    report += `### ${t.id}: "${t.prompt}"\n\n`;
    report += `**Tier**: ${t.tier}\n`;
    report += `**Screenshot**: [${t.id}.png](file://${r.screenshotPath || 'not captured'})\n`;

    if (r.error) {
      report += `**Error**: ${r.error}\n\n`;
      report += `---\n\n`;
      continue;
    }

    if (r.domMeta) {
      report += `**Detected headline**: ${r.domMeta.headline || '(none)'}\n`;
      report += `**Detected type**: ${r.domMeta.resultType || '(unknown)'}\n`;
      report += `**Suggestion chips**: ${r.domMeta.chips.length > 0 ? r.domMeta.chips.join(' | ') : '(none)'}\n`;
      if (r.domMeta.errorText) report += `**Page errors**: ${r.domMeta.errorText.slice(0, 200)}\n`;
    }

    if (r.evaluation) {
      const e = r.evaluation;
      const avg = (
        DIMENSIONS.map((d) => e.scores[d]).filter((s) => s != null).reduce((a, b) => a + b, 0) /
        DIMENSIONS.filter((d) => e.scores[d] != null).length
      ).toFixed(1);

      const scoreStr = DIMENSIONS.map((d) => `${DIM_LABELS[d].split(' ')[0]}: ${e.scores[d]}`).join(' | ');
      report += `\n**Scores**: ${scoreStr}\n`;
      report += `**Average**: ${avg} ${parseFloat(avg) >= 4 ? 'PASS' : parseFloat(avg) >= 3 ? 'NEEDS WORK' : 'FAIL'}\n\n`;

      report += `**Critique**:\n`;
      for (const dim of DIMENSIONS) {
        if (e.critique[dim]) {
          const marker = e.scores[dim] < 4 ? '[!]' : '';
          report += `- ${DIM_LABELS[dim]} (${e.scores[dim]}): ${e.critique[dim]} ${marker}\n`;
        }
      }

      if (e.improvements && e.improvements.length > 0) {
        report += `\n**Improvements**:\n`;
        for (const imp of e.improvements) {
          report += `- ${imp}\n`;
        }
      }

      if (e.overallAssessment) {
        report += `\n**Assessment**: ${e.overallAssessment}\n`;
      }
    } else {
      report += `\n*Evaluation skipped (no Gemini API key or --capture-only mode)*\n`;
    }

    report += `\n---\n\n`;
  }

  return report;
}

// ---- Main -------------------------------------------------------------------

async function main() {
  console.log('=== UX Evaluation: BigQuery AIF ===\n');

  // Validate API key for evaluation
  if (!captureOnly && !GEMINI_KEY) {
    console.warn('[eval] WARNING: No Gemini API key found in .env.local');
    console.warn('[eval] Set GOOGLE_GENERATIVE_AI_API_KEY or NEXT_PUBLIC_GEMINI_API_KEY');
    console.warn('[eval] Running in capture-only mode\n');
    captureOnly = true;
  }

  // Filter tests
  let testsToRun = TESTS;
  if (onlyTest) {
    testsToRun = TESTS.filter((t) => t.id === onlyTest.toUpperCase());
    if (testsToRun.length === 0) {
      console.error(`[eval] No test found with ID "${onlyTest}". Available: ${TESTS.map((t) => t.id).join(', ')}`);
      process.exit(1);
    }
  } else if (onlyTier) {
    testsToRun = TESTS.filter((t) => t.tier.toLowerCase() === onlyTier.toLowerCase());
    if (testsToRun.length === 0) {
      console.error(`[eval] No tests found for tier "${onlyTier}". Available: ${[...new Set(TESTS.map((t) => t.tier))].join(', ')}`);
      process.exit(1);
    }
  } else if (startAt) {
    const idx = TESTS.findIndex((t) => t.id === startAt.toUpperCase());
    if (idx === -1) {
      console.error(`[eval] No test found with ID "${startAt}". Available: ${TESTS.map((t) => t.id).join(', ')}`);
      process.exit(1);
    }
    testsToRun = TESTS.slice(idx);
  }

  console.log(`[eval] Running ${testsToRun.length} test(s): ${testsToRun.map((t) => t.id).join(', ')}`);
  console.log(`[eval] Mode: ${captureOnly ? 'capture-only' : 'capture + evaluate'}\n`);

  // Launch browser
  const chromePath = findChrome();
  if (!chromePath) {
    console.error('[eval] Could not find system Chrome.');
    process.exit(1);
  }

  try { execSync('pkill -f "bqaif-puppeteer-profile" 2>/dev/null || true'); } catch {}
  await delay(500);

  console.log('[eval] Launching browser...');
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

  let page = (await browser.pages())[0] || (await browser.newPage());

  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
  });

  // Navigate and wait for auth
  console.log(`[eval] Navigating to ${APP_URL}...`);
  await page.goto(APP_URL, { waitUntil: 'networkidle2', timeout: 30000 });
  console.log('[eval] Waiting for auth to load...');
  await delay(5000);

  // Select malloy-data project if needed
  const elements = await page.$$('button, div, span, a');
  for (const el of elements) {
    const text = await el.evaluate((e) => e.textContent || '');
    if (text.trim() === 'malloy-data') {
      await el.click();
      console.log('[eval] Selected malloy-data project');
      break;
    }
  }
  await delay(3000);

  // Run tests
  const results = [];

  for (let i = 0; i < testsToRun.length; i++) {
    const test = testsToRun[i];
    const screenshotPath = join(SCREENSHOT_DIR, `${test.id}.png`);

    console.log(`\n--- [${i + 1}/${testsToRun.length}] ${test.id}: "${test.prompt}" ---`);

    try {
      // New conversation for each test
      if (i > 0) {
        page = await startNewConversation(page, browser);
      }

      // Type and submit
      const typed = await clearAndType(page, test.prompt);
      if (!typed) {
        console.error('[eval] Could not find textarea');
        results.push({ test, screenshotPath: null, domMeta: null, evaluation: null, error: 'textarea not found' });
        continue;
      }

      await delay(200);

      // Count existing artifact cards before sending
      const cardCountBefore = await page.evaluate(() => {
        return document.querySelectorAll('[class*="tone-"]').length;
      });

      await page.keyboard.press('Enter');
      console.log('[eval] Sent, waiting for response...');

      const responded = await waitForResponse(page);
      await delay(3000); // Extra time for charts and animations

      // Scroll to the bottom to ensure the latest result is visible
      await page.evaluate(() => {
        // Scroll the main content area
        const scrollable = document.querySelector('[style*="overflow"]') || document.documentElement;
        scrollable.scrollTop = scrollable.scrollHeight;
        window.scrollTo(0, document.body.scrollHeight);
      });
      await delay(1000);

      // Verify a new response appeared (card count increased)
      const cardCountAfter = await page.evaluate(() => {
        return document.querySelectorAll('[class*="tone-"]').length;
      });
      if (cardCountAfter <= cardCountBefore && responded) {
        console.warn(`[eval] WARNING: No new artifact card detected (before=${cardCountBefore}, after=${cardCountAfter})`);
      }

      // Screenshot
      await page.screenshot({ path: screenshotPath, fullPage: false });
      console.log(`[eval] Screenshot: ${test.id}.png`);

      // Extract DOM metadata
      const domMeta = await extractDomMetadata(page);
      console.log(`[eval] Headline: "${domMeta.headline || '(none)'}"`);
      console.log(`[eval] Type: ${domMeta.resultType || '(unknown)'}, Chips: ${domMeta.chips.length}`);
      if (domMeta.errorText) console.log(`[eval] Error: ${domMeta.errorText.slice(0, 100)}`);

      // Evaluate with Gemini
      let evaluation = null;
      if (!captureOnly) {
        console.log('[eval] Evaluating with Gemini...');
        evaluation = await evaluateWithGemini(test, screenshotPath, domMeta);
        if (evaluation) {
          const avg = (
            DIMENSIONS.map((d) => evaluation.scores[d]).filter((s) => s != null).reduce((a, b) => a + b, 0) /
            DIMENSIONS.filter((d) => evaluation.scores[d] != null).length
          ).toFixed(1);
          const worstDim = DIMENSIONS.reduce((worst, d) =>
            (evaluation.scores[d] < evaluation.scores[worst] ? d : worst)
          );
          console.log(`[eval] Score: ${avg} avg | Worst: ${DIM_LABELS[worstDim]} (${evaluation.scores[worstDim]})`);
          if (parseFloat(avg) < 4) {
            console.log(`[eval] NEEDS WORK: ${evaluation.overallAssessment || ''}`);
          }
        }
      }

      results.push({ test, screenshotPath, domMeta, evaluation, error: null });

      // Rate limiting for Gemini API
      if (!captureOnly && i < testsToRun.length - 1) {
        await delay(2000);
      }

    } catch (err) {
      console.error(`[eval] Test ${test.id} crashed: ${err.message}`);
      try {
        await page.screenshot({ path: join(SCREENSHOT_DIR, `${test.id}_CRASH.png`), fullPage: false });
      } catch {}
      results.push({ test, screenshotPath: null, domMeta: null, evaluation: null, error: err.message });
    }
  }

  // Generate report
  console.log('\n[eval] Generating report...');
  const report = generateReport(results);
  const reportPath = join(RESULTS_DIR, 'ux-eval-report.md');
  writeFileSync(reportPath, report);
  console.log(`[eval] Report: ${reportPath}`);

  // Save raw results as JSON
  const jsonPath = join(RESULTS_DIR, 'ux-eval-results.json');
  writeFileSync(jsonPath, JSON.stringify(results, null, 2));
  console.log(`[eval] Raw results: ${jsonPath}`);

  // Print summary
  const evaluated = results.filter((r) => r.evaluation);
  if (evaluated.length > 0) {
    console.log('\n========================================');
    console.log('  UX Evaluation Summary');
    console.log('========================================\n');

    for (const dim of DIMENSIONS) {
      const scores = evaluated.map((r) => r.evaluation.scores[dim]).filter((s) => s != null);
      const avg = (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1);
      const belowFour = scores.filter((s) => s < 4).length;
      const label = DIM_LABELS[dim].padEnd(22);
      console.log(`  ${label} ${avg} avg  ${belowFour > 0 ? `(${belowFour} below 4)` : 'OK'}`);
    }

    const overallScores = evaluated.map((r) => {
      const s = DIMENSIONS.map((d) => r.evaluation.scores[d]).filter((v) => v != null);
      return s.reduce((a, b) => a + b, 0) / s.length;
    });
    const overallAvg = (overallScores.reduce((a, b) => a + b, 0) / overallScores.length).toFixed(1);
    const overallPassing = overallScores.filter((a) => a >= 4).length;

    console.log(`\n  Overall: ${overallAvg} avg | ${overallPassing}/${evaluated.length} passing (4+)`);

    // List tests that need work
    const needsWork = evaluated
      .map((r) => {
        const s = DIMENSIONS.map((d) => r.evaluation.scores[d]).filter((v) => v != null);
        const avg = s.reduce((a, b) => a + b, 0) / s.length;
        return { id: r.test.id, avg, worst: DIMENSIONS.reduce((w, d) => r.evaluation.scores[d] < r.evaluation.scores[w] ? d : w) };
      })
      .filter((t) => t.avg < 4)
      .sort((a, b) => a.avg - b.avg);

    if (needsWork.length > 0) {
      console.log('\n  Tests needing improvement:');
      for (const t of needsWork) {
        console.log(`    ${t.id}: ${t.avg.toFixed(1)} avg (worst: ${DIM_LABELS[t.worst]})`);
      }
    }

    console.log(`\n  Full report: ${reportPath}`);
    console.log('========================================\n');
  }

  // Close browser
  console.log('[eval] Closing browser...');
  await delay(1000);
  await browser.close();

  // Exit with failure if any test below threshold
  if (evaluated.length > 0) {
    const anyFailing = evaluated.some((r) => {
      const s = DIMENSIONS.map((d) => r.evaluation.scores[d]).filter((v) => v != null);
      return (s.reduce((a, b) => a + b, 0) / s.length) < 4;
    });
    process.exit(anyFailing ? 1 : 0);
  }
}

main().catch((err) => {
  console.error('[eval] Fatal:', err);
  process.exit(1);
});
