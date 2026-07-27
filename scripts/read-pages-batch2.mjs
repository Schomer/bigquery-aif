#!/usr/bin/env node
// scripts/read-pages-batch2.mjs
// Captures the remaining CA skill reference files not grabbed in the first batch.

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
  // AlloyDB variants
  { name: 'alloydb_planning', url: `${BASE}/references/alloydb_planning.md` },
  { name: 'alloydb_sql_gen', url: `${BASE}/references/alloydb_sql_gen.md` },
  { name: 'alloydb_viz_gen', url: `${BASE}/references/alloydb_viz_gen.md` },
  // AI/ML detailed rules
  { name: 'bigquery-ai-ml-ca-rules', url: `${BASE}/references/bigquery-ai-ml-ca-rules.md` },
  { name: 'bigquery-multimodal-objectref-rules', url: `${BASE}/references/bigquery-multimodal-objectref-rules.md` },
  // Individual AI function docs
  { name: 'bigquery_ai_agg', url: `${BASE}/references/bigquery_ai_agg.md` },
  { name: 'bigquery_ai_classify', url: `${BASE}/references/bigquery_ai_classify.md` },
  { name: 'bigquery_ai_detect_anomalies', url: `${BASE}/references/bigquery_ai_detect_anomalies.md` },
  { name: 'bigquery_ai_forecast', url: `${BASE}/references/bigquery_ai_forecast.md` },
  { name: 'bigquery_ai_generate', url: `${BASE}/references/bigquery_ai_generate.md` },
  { name: 'bigquery_ai_if', url: `${BASE}/references/bigquery_ai_if.md` },
  { name: 'bigquery_ai_key_drivers', url: `${BASE}/references/bigquery_ai_key_drivers.md` },
  { name: 'bigquery_ai_score', url: `${BASE}/references/bigquery_ai_score.md` },
  { name: 'bigquery_ai_search', url: `${BASE}/references/bigquery_ai_search.md` },
  { name: 'bigquery_ai_similarity', url: `${BASE}/references/bigquery_ai_similarity.md` },
  // ML function docs
  { name: 'bigquery_ml_describe_data', url: `${BASE}/references/bigquery_ml_describe_data.md` },
  { name: 'bigquery_ml_seasonality', url: `${BASE}/references/bigquery_ml_seasonality.md` },
  { name: 'bigquery_ml_trend', url: `${BASE}/references/bigquery_ml_trend.md` },
  // Object ref docs
  { name: 'bigquery_obj_get_access_url', url: `${BASE}/references/bigquery_obj_get_access_url.md` },
  { name: 'bigquery_obj_make_ref', url: `${BASE}/references/bigquery_obj_make_ref.md` },
  // Anomaly detection workflow
  { name: 'continuous-anomaly-detection-workflow-setup', url: `${BASE}/references/continuous-anomaly-detection-workflow-setup.md` },
  { name: 'continuous_anomaly_calibration', url: `${BASE}/references/continuous_anomaly_calibration.md` },
  { name: 'continuous_anomaly_presentation', url: `${BASE}/references/continuous_anomaly_presentation.md` },
  { name: 'continuous_anomaly_query_templates', url: `${BASE}/references/continuous_anomaly_query_templates.md` },
  { name: 'continuous_anomaly_schema', url: `${BASE}/references/continuous_anomaly_schema.md` },
  // Graph and joins
  { name: 'federated_join', url: `${BASE}/references/federated_join.md` },
  { name: 'property-graph-guidelines', url: `${BASE}/references/property-graph-guidelines.md` },
  { name: 'semantic-graph-guidelines', url: `${BASE}/references/semantic-graph-guidelines.md` },
];

mkdirSync(OUTPUT_DIR, { recursive: true });

function findChrome() {
  const paths = ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'];
  for (const p of paths) { if (existsSync(p)) return p; }
  return null;
}

async function main() {
  const chromePath = findChrome();
  if (!chromePath) { console.error('[read-pages] No Chrome.'); process.exit(1); }

  console.log(`[read-pages] Launching Chrome... (${PAGES.length} pages to capture)`);
  const browser = await puppeteer.launch({
    headless: false,
    executablePath: chromePath,
    userDataDir: USER_DATA_DIR,
    defaultViewport: { width: 1440, height: 900 },
    args: ['--window-size=1440,900', '--no-first-run', '--no-default-browser-check', '--disable-blink-features=AutomationControlled'],
    ignoreDefaultArgs: ['--enable-automation'],
  });

  const page = (await browser.pages())[0] || await browser.newPage();
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
  });

  for (let i = 0; i < PAGES.length; i++) {
    const { name, url } = PAGES[i];
    console.log(`[read-pages] [${i+1}/${PAGES.length}] ${name}`);
    try {
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
      await new Promise(r => setTimeout(r, 3000));

      const textContent = await page.evaluate(() => document.body.innerText);
      const textPath = join(OUTPUT_DIR, `${name}.txt`);
      writeFileSync(textPath, textContent, 'utf8');
      console.log(`[read-pages]   -> ${textContent.length} chars`);
    } catch (err) {
      console.error(`[read-pages]   ERROR: ${err.message}`);
    }
  }

  console.log('[read-pages] Done. Closing browser.');
  await browser.close();
}

main().catch(err => { console.error('[read-pages] Fatal:', err.message); process.exit(1); });
