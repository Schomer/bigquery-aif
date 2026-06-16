# Test Loop — Quick Start Guide

## How to run the test loop

### Prerequisites
1. **Dev server running** — `npm run dev` in a terminal (port 5800)
2. **Fresh access token** — paste into `.env.local`:
   ```
   GOOGLE_ACCESS_TOKEN=ya29.xxx...
   ```
   **How to get it:**
   - Open http://localhost:5800 in your browser and sign in
   - Open DevTools (Cmd+Option+I) → Network tab
   - Filter by `bigquery.googleapis.com`
   - Click any BigQuery request → copy the `Authorization` header value (everything after `Bearer `)
   - Paste into `.env.local` and save

### Run everything in one command
```bash
npm run test:all
```

This runs the test loop → screenshot capture → report generation in sequence.

### Or run steps individually
```bash
# Step 0 (one-time): Set up reference dataset
npm run test:setup

# Step 1: Run all ~55 task tests
npm run test:run

# Step 2: Capture UI screenshots (Playwright)
npm run test:screenshots

# Step 3: Generate the Markdown report
npm run test:report
```

### Output
- `test-results/results.json` — structured results for all tasks
- `test-results/screenshots/*.png` — UI screenshots per task
- `test-results/report.md` — **the final report** with tables, screenshots, UX suggestions

---

## What the test loop does

For each of the ~55 tasks in the task taxonomy:

1. **Sends a natural-language prompt** to `/api/chat` with the `malloy-data.ecommerce` tables
2. **Evaluates the response** — did the right skill fire? Does the artifact have data?
3. **If it fails** → calls Gemini to analyze why and rewrite the prompt → retries (max 2x)
4. **If destructive** (dedup, DML) → verifies the confirmation card appears but does NOT execute
5. **Records** the attempt log, final prompt, envelopes, and any errors

After the loop runs, Playwright captures screenshots of each passing test in the live browser UI (auth token injected via sessionStorage — no manual sign-in needed).

---

## Coverage

| Category | Tasks |
|----------|-------|
| 1. Data Exploration & Discovery | 9 |
| 2. Data Transformation & Cleaning | 6 |
| 3. Data Quality & Validation | 7 |
| 4. Joining & Combining | 5 |
| 5. Aggregation & Analytics | 8 |
| 6. Schema & Table Operations | 6 |
| 7. Job & Cost Management | 5 |
| 8. Export & Sharing | 3 |
| 10. ML & Advanced Analytics | 4 |
| 11. Data Enrichment | 4 |
| 12. Monitoring & Alerts | 2 |
| **Total** | **~55** |

---

## Files created

```
scripts/
├── setup-reference-dataset.mjs   ← one-time BQ table setup (pre-existing)
├── task-catalog.mjs              ← all tasks with prompts & success criteria
├── test-loop.mjs                 ← main test harness
├── capture-screenshots.mjs       ← Playwright UI screenshots
└── generate-report.mjs           ← Markdown report generator

test-results/                     ← gitignored, generated at runtime
├── results.json
├── report.md
└── screenshots/
    └── *.png
```
