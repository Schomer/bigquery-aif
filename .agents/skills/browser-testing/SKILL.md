---
name: browser-testing
description: How to do browser-based visual testing of the BigQuery AIF app. Use this when you need to take screenshots, verify UI output, or test the deployed app visually.
---

# Browser Testing

## Overview

There are two approaches to browser testing:

1. **Puppeteer scripts** -- primary path for all test passes and screenshots. No permission prompt. Uses system Chrome with a persistent auth profile.
   - `scripts/screenshot.mjs` -- ad-hoc single-URL screenshot
   - `scripts/visual-test.mjs` -- full 20-test automated suite
2. **`browser_subagent` tool** -- secondary, for interactive/exploratory sessions when the user is present to click Allow on the permission prompt.

---

## Method 1: browser_subagent (Ad-Hoc Testing)

The `browser_subagent` tool launches a browser, navigates to URLs, takes screenshots, clicks elements, types text, and reports back. Use this for quick visual verification of UI changes after deployment.

### How to Use

Call `browser_subagent` with a task description. The subagent controls the browser and returns a report when done.

Example -- take a screenshot of the deployed app:
```
browser_subagent(
  TaskName: "Screenshot deployed app",
  Task: "Navigate to https://bigqueryaif.web.app. Wait for the page to fully load. Take a screenshot and describe what you see. Return when the screenshot is captured.",
  TaskSummary: "Take a screenshot of the deployed app to verify UI changes.",
  RecordingName: "deployed_app_check"
)
```

Example -- verify a specific UI element:
```
browser_subagent(
  TaskName: "Verify sidebar layout",
  Task: "Navigate to https://bigqueryaif.web.app. Wait for the page to fully load. Look at the left sidebar navigation. Take a screenshot. Describe the sidebar items, their icons, and their order. Return your findings.",
  TaskSummary: "Check the sidebar layout on the deployed app.",
  RecordingName: "sidebar_check"
)
```

### When to Use browser_subagent

- Quick screenshot after deploying a UI change
- Verifying layout, colors, typography, or element visibility
- Checking that a page loads without errors
- Interactive exploration (clicking buttons, filling forms, navigating)

### Limitations

- OAuth-protected pages require the user to already be signed in (the subagent cannot complete Google OAuth flows)
- For pages behind auth, use the Puppeteer method instead (it uses a persistent profile with saved auth)

### Recordings

All browser_subagent sessions are automatically recorded as WebP videos saved to the artifacts directory. Use descriptive `RecordingName` values.

---

## Method 2: Puppeteer Script (Full Test Suite)

The Puppeteer script runs 20 canonical test prompts against the deployed app, capturing full-page screenshots for each response.

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

### Prerequisites

Puppeteer is installed in `/tmp/puppeteer-runner/`. If missing:
```bash
source "$HOME/.nvm/nvm.sh" && mkdir -p /tmp/puppeteer-runner && cd /tmp/puppeteer-runner && npm init -y && npm install puppeteer
```

### Key Technical Details

- **Browser**: System Chrome at `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`
- **Profile**: Persistent at `/tmp/bqaif-puppeteer-profile` (auth persists across runs)
- **Viewport**: 1440x900
- **Response detection**: Waits for SparkSpinner SVG to appear then disappear (2 consecutive idle polls)
- **Textarea clearing**: Uses React's native HTMLTextAreaElement.prototype setter to avoid stale state
- **New conversation**: Navigates to `APP_URL?t=${Date.now()}` between tests to force React remount
- **Timeout**: 120s per test
