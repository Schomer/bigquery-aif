---
name: browser-testing
description: How to do browser-based visual testing of the BigQuery AIF app. Use this when you need to take screenshots, verify UI output, or test the deployed app visually.
---

# Browser Testing

## Overview

Browser testing on macOS uses **Puppeteer scripts** that control system Chrome. Two scripts are available:

1. `scripts/screenshot.mjs` -- ad-hoc single-URL screenshot (quick visual check after deploy)
2. `scripts/visual-test.mjs` -- full 20-test automated suite with screenshot capture

The `browser_subagent` and `open_browser_url` tools do NOT work on macOS (they fail with "local chrome mode is only supported on Linux"). Do not attempt to use them.

---

## Method 1: Ad-Hoc Screenshot (scripts/screenshot.mjs)

Takes a single screenshot of any URL. Use this for quick visual verification after deploying UI changes.

### Usage

```bash
source "$HOME/.nvm/nvm.sh" && node "/Users/schomer/Desktop/DATA APPS/bigquery-aif/scripts/screenshot.mjs" https://bigqueryaif.web.app
```

The script outputs the path to the saved screenshot. Read it with `view_file` (supports binary images, renders inline).

### Options

```bash
# Screenshot a specific path
node scripts/screenshot.mjs https://bigqueryaif.web.app/some-page

# Custom output filename
node scripts/screenshot.mjs https://bigqueryaif.web.app --output my-screenshot.png
```

---

## Method 2: Full Test Suite (scripts/visual-test.mjs)

Runs 20 canonical test prompts against the deployed app, capturing full-page screenshots for each response.

### Running Tests

#### Full suite (20 tests)
```bash
source "$HOME/.nvm/nvm.sh" && cd "/Users/schomer/Desktop/DATA APPS/bigquery-aif" && node scripts/visual-test.mjs
```

#### Single test by ID
```bash
node scripts/visual-test.mjs --only 4
```

#### Start from a specific test
```bash
node scripts/visual-test.mjs --start 7
```

#### Launch as background task
Always use `WaitMsBeforeAsync: 500` so it runs as a background task. The script is interactive (requires auth input).

### Auth Flow

1. Launch the script as a background task
2. Wait for output to stabilize showing "Press Enter after signing in"
3. If the persistent profile already has auth (profile at `/tmp/bqaif-puppeteer-profile`), it may skip the sign-in step
4. Send `\n` via `manage_task send_input` with the task ID

### Reading Results

Screenshots are saved to: `/Users/schomer/Desktop/DATA APPS/bigquery-aif/test-screenshots/`

Screenshot naming: `{NN}_{tier}_full.png` (e.g., `04_foundation_full.png`)

Read them with:
```
view_file /Users/schomer/Desktop/DATA APPS/bigquery-aif/test-screenshots/04_foundation_full.png
```

The `view_file` tool renders binary images inline.

---

## Prerequisites

Puppeteer is installed in `/tmp/puppeteer-runner/`. If missing:
```bash
source "$HOME/.nvm/nvm.sh" && mkdir -p /tmp/puppeteer-runner && cd /tmp/puppeteer-runner && npm init -y && npm install puppeteer
```

## Key Technical Details

- **Browser**: System Chrome at `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`
- **Profile**: Persistent at `/tmp/bqaif-puppeteer-profile` (auth persists across runs)
- **Viewport**: 1440x900
- **Response detection**: Waits for SparkSpinner SVG to appear then disappear (2 consecutive idle polls)
- **Textarea clearing**: Uses React's native HTMLTextAreaElement.prototype setter to avoid stale state
- **New conversation**: Navigates to `APP_URL?t=${Date.now()}` between tests to force React remount
- **Timeout**: 120s per test

## Do NOT Use

- `browser_subagent` tool -- fails with "local chrome mode is only supported on Linux"
- `open_browser_url` tool -- same error
