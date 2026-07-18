<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:model-requirement -->
# REQUIRED: Always use gemini-3.5-flash

**This project uses `gemini-3.5-flash` everywhere. Do NOT change this — ever.**

The model string in `src/lib/gemini-client.ts` (client-side proxy request) must always reference `gemini-3.5-flash`.

The model path in `functions/src/index.ts` (server-side proxy) must always be:
```
models/gemini-3.5-flash:generateContent
```

Do NOT change to pro-preview, flash-lite, 2.5-pro, or any other model variant.
If `gemini-3.5-flash` returns an error, fix the error — do not change the model.

Verify with: `grep -rn "gemini-" src/ functions/ scripts/` — all results must show `gemini-3.5-flash`.
<!-- END:model-requirement -->

<!-- BEGIN:no-emojis -->
# REQUIRED: No emojis. Ever.

Do NOT use emojis anywhere — not in code, comments, UI text, log messages, commit messages, responses, plans, documentation, or any other output. This rule has zero exceptions.
<!-- END:no-emojis -->

<!-- BEGIN:auto-build -->
# REQUIRED: Automatically build on file changes

This project uses static export (`output: 'export'` in `next.config.ts`) deployed to Firebase Hosting from `out/`. Gemini calls go through Firebase AI Logic SDK (no Cloud Functions). To validate that edits compile correctly, always run the build command after making changes to the source files before ending your turn:
1. `npm run build`
<!-- END:auto-build -->

<!-- BEGIN:auto-deploy -->
# REQUIRED: Always deploy after changes

After a successful build, always commit and push, then deploy hosting:
1. `git add -A && git commit -m "<descriptive message>" && git push`
2. `npx -y firebase-tools@latest deploy --only hosting --project malloy-data`

The user tests on the deployed app, not locally. Skipping this step means they cannot see changes.

Use `source "$HOME/.nvm/nvm.sh"` before any npm/node/git commands in the terminal.
<!-- END:auto-deploy -->

<!-- BEGIN:knowledge-system -->
# REQUIRED: Knowledge System

This project has a knowledge base in `.agents/knowledge/`. Read it before making changes. Update it after making changes. This is how the app gets smarter over time.

## Before Making Code Changes

1. **Read invariants**: Check `.agents/knowledge/invariants.md` -- does your change violate any rule?
2. **Read relevant sections**: Check the component map, data encyclopedia, and ops-ledger for context on the area you're changing.
3. **Check test cases**: Review `.agents/knowledge/test-cases.md` -- will your change break any canonical scenario?
4. **Check prompt versions**: If changing any LLM prompt, read `.agents/knowledge/prompt-versions.md` first.

## After Making Code Changes

1. **Update ops-ledger**: Add an entry to `.agents/knowledge/ops-ledger.md` for any non-trivial change. Include what worked, what broke, root cause, and the derived rule.
2. **Update changelog**: Add a session entry to `.agents/knowledge/changelog.md`.
3. **Update prompt versions**: If you changed any prompt, log the change in `.agents/knowledge/prompt-versions.md`.
4. **Update invariants**: If you discovered a new invariant, add it to `.agents/knowledge/invariants.md`.
5. **Update component map**: If file line ranges shifted significantly, update `.agents/knowledge/component-map.md`.
<!-- END:knowledge-system -->

<!-- BEGIN:commit-convention -->
# REQUIRED: Commit Message Convention

Use this format for all commits:
```
type(scope): description -- rationale
```

**Types**: fix, feat, refactor, docs, style, test, chore
**Scope**: the subsystem (router, orchestrator, schema, query, composer, ui, knowledge)
**Rationale**: after `--`, explain *why*, not just *what*

Examples:
- `fix(router): add word-boundary matching for mutating verbs -- table names like sales_deduped were false-matching dedupe`
- `feat(knowledge): add ops-ledger and invariants files -- prevents regressions by accumulating operational knowledge`
- `fix(schema): check availableDatasets before defaulting to TABLE scope -- was listing datasets when user asked for tables in a dataset`
<!-- END:commit-convention -->

<!-- BEGIN:test-gate -->
# RECOMMENDED: Test Gate

After making changes to the router, orchestrator, or skill handlers, run:
```
npm test
```
This runs vitest unit tests covering the router, sql-guard, format utilities, and composer. The router tests include all canonical scenarios from `.agents/knowledge/test-cases.md`.

For the legacy standalone snapshot test, you can also run:
```
node scripts/snapshot-test.mjs
```
<!-- END:test-gate -->

<!-- BEGIN:browser-testing -->
# REQUIRED: Browser testing works on macOS -- use browser_subagent

The `browser_subagent` tool works on macOS. It launches a browser, navigates to URLs, takes screenshots, clicks elements, types text, and reports back. **Do NOT claim browser testing is unavailable, unsupported, or requires Linux. That is false.**

When you need to visually verify the deployed app (after deploying UI changes, checking layout, verifying elements):
1. Use the `browser_subagent` tool to navigate to `https://bigqueryaif.web.app`
2. Take screenshots, inspect elements, verify layout

If `browser_subagent`'s internal `open_browser_url` tool fails with "local chrome mode is only supported on Linux", do NOT give up and do NOT say browser testing is unavailable. Instead, fall back to the Puppeteer screenshot script:
```bash
source "$HOME/.nvm/nvm.sh" && node scripts/screenshot.mjs https://bigqueryaif.web.app
```
Then read the saved screenshot with `view_file`. This uses system Chrome at `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome` and always works on macOS.

For the full automated 20-test suite, use the Puppeteer script: `node scripts/visual-test.mjs`

Read `.agents/skills/browser-testing/SKILL.md` for detailed usage examples.
<!-- END:browser-testing -->

