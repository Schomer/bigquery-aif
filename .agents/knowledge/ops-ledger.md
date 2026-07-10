# Operations Ledger

A reverse-chronological log of changes, fixes, and lessons learned. Read this before making code changes to avoid repeating past mistakes.

## How to use this file
- **Before coding**: Scan recent entries for relevant context
- **After coding**: Add a new entry for any non-trivial change
- **When debugging**: Search for similar symptoms in past entries

## How to write an entry
Every entry should answer: What changed? What worked? What broke? Why? What's the generalizable lesson?

---

### 2026-07-10: Replace rigid query pipeline with Gemini tool-calling agent
**Scope**: handle-query.ts, gemini-client.ts, bq-tools.ts (new)
**What broke**: Simple queries like "show first 10 rows" took minutes due to ~30 BigQuery API calls in `buildSchemaContext()` fetching schema for all tables in the dataset.
**Root cause**: `handleQuery()` always ran a fixed pipeline: buildSchemaContext (fetch all table schemas) -> callGemini (generate SQL) -> dryRun -> executeQuery. No matter how simple the query, it fetched column lists for 5 tables + sample values + constraint queries.
**Fix**: Replaced with `callGeminiWithTools()` loop. The LLM gets 4 tools (run_query, get_table_schema, list_tables, list_datasets) and decides what context to fetch. Simple queries go directly to `run_query` (1 LLM call + 1 BQ call).
**Results**: Simple preview: 9s. Analytical query: 32s. Ambiguous query: 24s. All 4/4 test scenarios pass.
**Tuning applied**: (1) System prompt with explicit efficiency rules -- "don't call list_tables if the user named a table". (2) maxIterations increased from 6 to 10 -- analytical queries need 7+ iterations for schema exploration + SQL retry. (3) The LLM self-corrects errors naturally (tried `orders`, got 404, found `order_items` via list_tables).
**Rule**: The query handler must use tool-calling, not a fixed pipeline. Do not re-add buildSchemaContext or dryRun to handle-query.ts. maxIterations cap of 10 balances latency vs capability.

---

### 2026-07-10: Auth tokens stored in localStorage with expiry tracking
**Scope**: gis-auth.ts, auth-context.tsx
**What broke**: App showed the sign-in page on every tab close, new tab, or reload after ~1hr token expiry. Blocked Antigravity automated testing.
**Root cause**: OAuth access token was stored in `sessionStorage` (tab-scoped, dies on close). Firebase Auth itself persists via IndexedDB, so the *identity* survived but the *BigQuery token* did not. `bqAuthorized` requires both.
**Fix**: Moved to `localStorage`. Added `bqaif_token_ts` timestamp alongside the token. Added `isTokenLikelyExpired()` (50-min threshold). On `onAuthStateChanged`, if user exists but token is missing/expired, auto-trigger `signInWithPopup(refreshProvider)` which auto-closes in <1s.
**Rule**: OAuth token storage must use `localStorage`, not `sessionStorage`. Token freshness must be tracked via a companion timestamp key. Auto-refresh must be gated by a ref (`autoRefreshAttempted`) to prevent popup storms.

---

### 2026-07-09: Fix basic aggregation queries routed to multistep instead of single-step query
**Scope**: router.ts, chat-orchestrator.ts, intent-routing.md
**What broke**: "show me how many total sales there was for the store BARMUDA DISTRIBUTION" produced a 3-step multistep workflow (list tables, describe table, calculate total sales) instead of a single query skill producing a KPI card.
**Root cause**: Two compounding issues: (1) no keyword signals existed for basic aggregation phrases ("how many", "total", "sum of", etc.) so the router defaulted to `query` with `medium` confidence, forcing a round-trip to the LLM intent classifier; (2) the LLM classifier returned `isMultistep: true` with 3 steps despite the prompt saying single-verb requests are never multistep, and the existing guard only caught exactly 2-step schema+query patterns.
**Fix**: Added 27 analytical/aggregation phrases to `QUERY_SIGNALS` in router.ts (e.g., "how many" weight 3, "total" weight 2). This gives the target prompt a query score of 5, producing `high` confidence and bypassing the LLM classifier entirely. Also generalized the multistep collapse guard from `steps.length === 2 && steps[0].skill === 'schema' && steps[1].skill === 'query'` to `lastStep.skill === 'query' && allOtherSteps.every(s => s.skill === 'schema')`.
**Rule 1**: Any common analytical phrase that should obviously route to query must have a keyword signal. If users can express it in plain English and it unambiguously means "run a query", it needs a signal.
**Rule 2**: The multistep collapse guard must handle N-step patterns, not just exactly 2 steps.

---

### 2026-07-09: Inline chat confirmations
**Scope**: InlineConfirmation.tsx (new), ChatThread.tsx, ResultsSidebar.tsx
**What changed**: Moved COST_CONFIRM_CARD and CONFIRMATION_CARD rendering from ArtifactCard (results panel in split layout) into lightweight inline chat messages with action buttons. Created InlineConfirmation.tsx with InlineCostConfirm and InlineDmlConfirm components. InlineDmlConfirm has a `compact` prop -- full detail (with DEDUPE preview table) in unified ChatThread layout, simplified summary in split-layout sidebar.
**What worked**: Intercepting confirmation envelopes in the message rendering loop (before they reach ArtifactCard) and filtering them from `allEnvelopes` in ResultsSidebar is clean and requires no backend changes.
**Rule**: Confirmation envelopes should render inline in the chat, not in the results panel. The existing handleConfirm/handleCancel state management in useChatOrchestration.ts did not need changes -- only the rendering location changed.

---

### 2026-07-09: Conversation continuity + export expansion
**Scope**: ConversationSummary.tsx, conversation-context.tsx, ChatThread.tsx, DataLoadingView.tsx, types.ts, useChatOrchestration.ts
**What changed**: Added ConversationSummary component that derives operation history from messages array. Enhanced conversation-context with operation log tracking. Expanded DataLoadingView with Create View DDL, Looker Studio links, Copy as Table, and Export Format Selector. Fixed duplicate PipelineResult type definition.
**What worked**: Deriving ConversationSummary entirely from the messages array avoids new state coordination. The scrollContainerRef approach for jump-to-message is clean. The `extractTable` utility reuse between ConversationSummary and the hook is consistent.
**Gotcha**: There were two `PipelineResult` interfaces in types.ts -- interface merging made the first definition's stricter `pipelineType: string` override the second's union literal, and the required `sql: string` in confirmation override the optional `sql?: string`. Removing the first (stricter) definition fixed all type errors.
**Rule**: Never define the same interface name twice in one file. TypeScript interface merging picks the intersection of property types, which can silently narrow optionals to required and break downstream consumers.

### 2026-07-09: Added governance skill (access audit, security, PII, classification)

**What worked**: Following the established skill handler pattern (router signals -> gemini-client schema -> handler -> composer -> view -> artifact card) made integration straightforward. All INFORMATION_SCHEMA queries are wrapped in try/catch because views like ROW_ACCESS_POLICIES and COLUMN_FIELD_PATHS may not be accessible in all projects.

**What to watch**: The PII scan is heuristic and samples only 1,000 rows. Phone number pattern (10-11 digits) may false-positive on numeric IDs. Credit card pattern (13-16 digits) may false-positive on large integers. The DLP recommendation banner makes this clear to users.

**Derived rule**: When adding INFORMATION_SCHEMA-based queries, always wrap in try/catch -- not all views are available in all projects/regions, and missing permissions should fail gracefully, not crash the handler.

---

### 2026-07-09: ML read-path routing and saved work system

**What**: Added QUERY_SIGNALS to the keyword router for ML function phrases (predict, evaluate, forecast, etc.), created a saved work system with Firestore persistence and a library UI, added save chips to query and data quality results.

**Worked**: ML-related queries now score into the query skill via the scoring engine instead of falling through to the no-signal default. Save action interception in handleChipClick uses dynamic import to lazy-load saved-work.ts, avoiding bundle bloat for users who never save. The existing Firestore user-document pattern (merge writes into `users/{uid}`) works cleanly for saved work items.

**Design decision**: Save actions are intercepted in handleChipClick before reaching the orchestrator. This avoids a round-trip through the LLM classifier and keeps saves instant. The `saveAction` flag in the chip context acts as a discriminator.

**Lesson**: When adding a new signal list to the scoring engine, the key in the scores Record must match an existing SkillName value. 'query' was not previously in the scored map because query was the default fallback. Adding it explicitly means ML phrases now outcompete weak signals from other skills.

### 2026-07-09: Auth retry now re-sends original request after sign-in
**Scope**: `src/app/page.tsx` L479-492
**What changed**: The auth error retry function was `signIn` alone, which opened the sign-in popup but dropped the user's original request. Changed it to an async function that calls `signIn()`, and if successful, removes the failed message pair (user + empty assistant) from state and calls `sendMessage(text)` to replay the original request.
**What worked**: Capturing `text` in the closure at error time preserves the exact user input. Removing 2 messages (user + empty assistant) before calling `sendMessage` avoids duplicate user messages since `sendMessage` always appends a fresh user message.
**Gotcha**: Must remove the user message too (not just the empty assistant), because `sendMessage` unconditionally appends a new user message at the start.
**Rule**: When retrying after auth refresh, always clean up the messages added by the failed attempt before re-invoking the send function.

### 2026-07-07: Consolidated format utils and shared UI primitives
**Scope**: `src/lib/format.ts` (new), `src/components/ui/` (new), 12 consumer files
**What changed**: Extracted `formatBytes`, `truncateLabel`, `truncateEmail`, and `relativeTime` from 10 components into a single shared module. Created reusable `StatCard`, `Badge`, and `Tooltip` components to replace 5 local stat card variants and provide reusable UI primitives.
**What worked**: All builds passed on first attempt. The shared `formatBytes` uses log-based unit selection which is the superset of all existing variants.
**Gotcha**: Two components (LineageDagView, StorageBreakdownView) had `truncateLabel` functions that accepted pixel widths and internally converted to character counts. The shared `truncateLabel` takes character counts directly. The conversion was moved inline at the call sites (`Math.floor(px / 6.5)` for StorageBreakdownView, `Math.floor(px / 7)` for LineageDagView).
**Rule**: When consolidating functions with similar names but different parameter semantics, keep the simpler (more primitive) interface in the shared module and push domain-specific conversions to the call sites.

### 2026-07-07: Scientific notation in KPI cards for monetary aggregates
**Scope**: `src/lib/bigquery-client.ts`, `src/lib/format-value.ts` (new), `src/components/KpiCard.tsx`, `src/components/DataTable.tsx`, chart components
**What broke**: "Total sales" KPI displayed `5.0938588796004164E8` instead of `$509,385,888`. All numeric values rendered as raw strings throughout the app.
**Root cause**: BigQuery REST API returns all cell values as strings (including numbers). `parseQueryResponse` passed `cell.v` through without type coercion, so `typeof value === 'number'` checks always failed. Additionally, no formatting layer existed to detect monetary columns and apply currency symbols.
**Fix**: (1) Added `coerceValue()` in `parseQueryResponse` that uses BigQuery schema field types to convert strings to native JS numbers/booleans. (2) Created `format-value.ts` with `formatDisplayValue()` (detects currency columns via column name heuristics like `sale`, `revenue`, `price`, `cost`) and `formatCompactValue()` (compact notation for chart axes). (3) Updated all display components.
**Rule**: BigQuery REST API values are always strings. Any new data path from BigQuery must coerce types using the schema's field type metadata. Currency detection is heuristic-based on column names -- if a monetary column has an unusual name, add it to the `CURRENCY_PATTERNS` regex in `format-value.ts`.

---

### 2026-07-07: String entity filters returning zero rows due to exact match
**Scope**: `public/skills/query.md`, `src/lib/chat-orchestrator.ts` (`buildSchemaContext`)
**What broke**: "total sales for HY-VEE FOOD STORE" returned a KPI card with zero/null total. The SQL used `WHERE store_name = 'HY-VEE FOOD STORE'` but actual values have location suffixes (e.g., "HY-VEE FOOD STORE / IOWA FALLS").
**Root cause**: Two issues: (1) No prompt guidance for fuzzy/partial string matching -- the LLM defaulted to `=` for all string filters. (2) `buildSchemaContext()` only sent column names and types, not sample values, so the LLM had no visibility into actual data patterns.
**Fix**: (1) Added a "String filtering" section to `query.md` instructing the LLM to use `UPPER(column) LIKE UPPER('%value%')` by default for entity name filters, reserving `=` for short enumerated values. (2) Enhanced `buildSchemaContext()` to fetch 3 sample DISTINCT values for up to 3 STRING columns of the priority/target table via lightweight queries.
**Rule**: Entity name string filters must default to LIKE, not =. The LLM needs sample values to understand data patterns -- schema context must include them for the target table.

---

### 2026-07-07: Cost confirm card not dismissed on Run Anyway / Cancel
**Scope**: `src/app/page.tsx` (`handleConfirm`)
**What broke**: Clicking "Run anyway" on a `COST_CONFIRM_CARD` executed the query but left the confirmation card visible in the chat. The card never disappeared.
**Root cause**: `handleConfirm` appended the new response to `messages` via `[...messages, assistantMsg]` but never removed the old envelope containing the `COST_CONFIRM_CARD`. The `handleCancel` function already had the correct removal logic; `handleConfirm` was missing it.
**Fix**: Before appending the new response, filter out the confirmed envelope from existing messages using the same pattern as `handleCancel`.
**Rule**: Any handler that replaces a confirmation card with a new response must also remove the original confirmation envelope from messages.

---

### 2026-07-01: OAuth token expiration breaks app mid-session
**Scope**: `src/lib/auth-context.tsx`, `src/lib/bigquery-client.ts`, `src/app/page.tsx`
**What broke**: The Google OAuth access token (for BigQuery/Cloud Platform) expires after ~1 hour. Firebase Auth stays signed in but all API calls fail with 401. The user sees "Session Expired" and has to manually re-authenticate, losing their in-progress query.
**Root cause**: Three problems: (1) No automatic token refresh mechanism. (2) `handleAuthError()` did a hard page redirect, blowing away app state. (3) The error catch block only showed a banner, never attempted to recover.
**Fix**: (1) Added `refreshAccessToken()` using a Google provider without `prompt: 'consent'` -- popup auto-completes instantly. (2) Removed the hard redirect from `handleAuthError()`. (3) Added `withAuthRetry()` wrapper around all orchestrator call sites that catches auth errors, refreshes token, and retries once.
**Rule**: All orchestrator calls must go through `withAuthRetry()`. `handleAuthError()` must never redirect.

### 2026-07-01: Follow-up prompts treated as fresh requests (redundant schema+query multistep)
**Scope**: `src/lib/chat-orchestrator.ts` (LLM classifier prompt), `src/lib/router.ts` (filter regex)
**What broke**: When a table schema was displayed and the user asked to "filter the table down to only rum categories," the system created a 2-step workflow: (1) re-fetch the schema (redundant), (2) run the filter query. This caused double cost confirmations and a frustrating UX.
**Root cause**: The LLM intent classifier prompt received no conversational state. It knew the project, dataset, and available datasets, but not what the user was currently looking at (lastSkill, lastTable). Without this, it treated every prompt as a fresh start and decomposed it into schema-fetch + query. Additionally, the keyword router's filter regex only matched "filter" followed by {where, by, the, this, that}, missing natural phrasings like "filter it down", "filter to only".
**Fix**:
1. Added `buildConversationStateSummary()` -- a skill-agnostic function that describes the full conversational state (what the user is viewing, which skill produced it, which table/dataset) and injects it into the classifier prompt.
2. Added a structural guard: if the LLM decomposes into schema+query, collapse to single-step query. `handleQuery()` calls `buildSchemaContext()` internally, so a separate schema step is always redundant.
3. Expanded the filter regex to include {it, down, out, only, to} as defense-in-depth.
**Rule**: The LLM classifier must always receive the full conversational state. Every prompt is a continuation of the conversation unless the user explicitly changes subject. Schema+query multistep decomposition is structurally redundant and must be collapsed.

### 2026-07-01: LLM generates SQL against wrong table (liquor_backup -> faa.airports)
**Scope**: `src/lib/chat-orchestrator.ts` (`buildSchemaContext`, `handleQuery`, `handleDataManagement`)
**What broke**: When the user asked to "filter the liquor_backup table for rum categories," the system generated SQL against `malloy-data.faa.airports` -- a completely different table. The subtitle correctly identified the target table, but the SQL was wrong.
**Root cause**: Two compounding issues:
1. `buildSchemaContext()` only sent schemas for the first 5 tables (alphabetically) in the dataset. If the target table wasn't in the first 5, the LLM never saw its schema.
2. `handleQuery()` accepted `context.lastTable` in its signature but never used it. The system instruction sent to the LLM contained no explicit mention of which table the user was asking about, leaving the LLM to guess from whatever schemas it received -- or hallucinate from training data (faa.airports is a well-known BigQuery public dataset).
**Fix**: (1) `buildSchemaContext()` now accepts a `priorityTable` parameter. When set, that table's schema is always fetched first, and the remaining 4 slots are filled with other tables. (2) `handleQuery()` extracts the target table from the message (by matching against the dataset's actual table names) or from `context.lastTable`, then passes it to `buildSchemaContext` and adds a `CRITICAL` instruction to the LLM prompt: "You MUST use this exact table in your SQL query." Same fix applied to `handleDataManagement()`.
**Rule**: When the user references a specific table by name, the LLM prompt must (a) always include that table's schema in the context and (b) explicitly name the target table in the system instruction. Never rely on the LLM to pick the right table from an incomplete list of schemas.

### 2026-07-01: Session expired "Try again" was looping instead of re-authenticating
**Scope**: `src/app/page.tsx`, `src/lib/bigquery-client.ts`
**What broke**: After the OAuth access token expired (~1 hour), the "Session Expired" banner appeared with a "Try again" button. Clicking it retried the same message with the same expired token, failing again immediately. Two separate issues:
1. The `retryFn` for auth errors was `() => sendMessage(text)` -- it retried the message instead of calling `signIn()`.
2. `handleAuthError()` in `bigquery-client.ts` did `window.location.href = '/'` without clearing the stale token from sessionStorage. The redirect landed back on the app (not the sign-in page) because `bqAuthorized` still evaluated to true.
**Fix**: (1) Auth errors now set `retryFn = signIn` and the button label changes to "Sign in again". (2) `handleAuthError()` now clears `bqaif_access_token` from sessionStorage before redirecting.
**Rule**: When an auth error occurs, the recovery action must obtain a new token, not retry with the old one. Any auth error handler that redirects must also clear cached credentials.

### 2026-07-01: Plan caching, conditional self-review, and result quality flags
**Scope**: `src/lib/plan-cache.ts` [NEW], `src/lib/result-quality.ts` [NEW], `src/lib/chat-orchestrator.ts`, `src/lib/composer.ts`, `src/lib/types.ts`, `src/components/ArtifactCard.tsx`
**What changed**: Three latency and quality improvements:
1. **Plan cache**: Session-scoped cache of recent query plans. When the user iterates on the same question with different parameters (dates, filters, LIMIT), the cached SQL template is reused with parameter substitution, skipping the Gemini SQL generation call entirely. FIFO eviction at 20 entries.
2. **Conditional self-review**: The self-review Gemini call is now skipped for: (a) schema results at PROJECT/DATASET scope, (b) KPI_CARD results, (c) high-confidence keyword-routed queries with <100 rows. Saves 1-3s on ~40-60% of requests.
3. **Result quality flags**: After query execution, `analyzeResultQuality()` scans result rows for null rates >20%, categorical near-duplicates, zero-row results, and single-value columns. Flags appear as dismissible banners in the UI with context-aware next-action chips.
**Design decision**: Single-value column detection suppresses columns that appear in WHERE clauses, since a single value is expected when the user explicitly filtered on that column.
**Rule**: When adding new heuristic flags, cap total flags at 5 per result and next-action chips at 4 per envelope (existing invariant). Plan cache entries are keyed by dataset, not table -- SQL template substitution handles the rest.

### 2026-07-01: Freshness monitoring handler treating project name as dataset name
**Scope**: `src/lib/chat-orchestrator.ts` (handleMonitoring FRESHNESS block), `src/lib/types.ts`, `src/lib/composer.ts`, `src/components/FreshnessView.tsx`
**What broke**: "check data freshness" returned "No tables found in the 'malloy-data' dataset" -- but malloy-data is a project, not a dataset.
**Root cause**: `handleMonitoring()`'s context type only accepted `project`, `uid`, and `handoffContext`. The FRESHNESS handler's dataset resolution (`const dataset = (hc?.dataset as string) || ''`) only checked handoff context, ignoring `context.resolvedDataset` and `context.dataset` from the enriched context. When dataset was empty, it set `result.dataset = dataset || project`, making the project name appear as a dataset name in the UI.
**Fix**: (1) Expanded `handleMonitoring` context type to include `resolvedDataset`, `dataset`, `availableDatasets`. (2) Changed FRESHNESS dataset resolution to fall through: `hc.dataset -> context.resolvedDataset -> context.dataset -> extractDatasetFromMessage()`. (3) Made `FreshnessResult.dataset` nullable (null = project scope). (4) Updated composer and FreshnessView to distinguish project-scope vs dataset-scope labeling.
**Rule**: Every skill handler that needs dataset context MUST accept and use `resolvedDataset` from the enriched context, not just handoff context. When a result can be at project scope, the `dataset` field should be null/empty, with a separate `project` field for labeling.

### 2026-06-30: Data lineage visualization implementation
**Scope**: `src/components/LineageDagView.tsx`, `src/lib/chat-orchestrator.ts` -- `handleDiscovery()`
**What worked**: Built a DAG visualization using JOBS_BY_PROJECT INFORMATION_SCHEMA to extract source->destination table relationships from job history.
**Rule**: Lineage data comes from `INFORMATION_SCHEMA.JOBS_BY_PROJECT` -- filter for `statement_type` in ('SELECT', 'CREATE_TABLE_AS_SELECT', 'INSERT', 'MERGE') and extract referenced/destination tables.

### 2026-06-30: Dataset table listing returning all datasets instead of tables in dataset
**Scope**: `src/lib/chat-orchestrator.ts` -- `handleSchema()` / `extractSchemaIdentifiers()`
**What worked**: The schema handler needed to check if the extracted name matches a known dataset name before defaulting to TABLE scope. Added dataset name validation against available datasets list.
**What broke on first attempt**: Changed the conditional but didn't account for unqualified names (no project prefix). Entity resolution in the router doesn't distinguish dataset names from table names when no qualifier is present.
**Root cause**: `extractSchemaIdentifiers()` was using `TABLE_DESCRIBE_SIGNALS` matches without checking if the extracted name was actually a dataset. When user says "what's in analytics", "analytics" is a dataset, not a table.
**Rule**: Always check extracted identifiers against the `availableDatasets` list before deciding scope. A name that matches a known dataset should route to DATASET scope, not TABLE scope.

### 2026-06-30: Infinite refresh loop after session expiration
**Scope**: `src/app/layout.tsx`, `src/app/page.tsx`, authentication middleware
**What worked**: Added proper session state guards to prevent re-render cycles when auth token expires.
**What broke on first attempt**: The auth context was triggering a re-render which triggered auth check which triggered re-render.
**Root cause**: The auth state change handler was calling setState unconditionally, causing a render loop when the token was expired.
**Rule**: Auth state handlers must be idempotent -- only call setState when the new state actually differs from current state. Use a ref to track the previous auth state and compare before updating.

### 2026-06-26: Table duplication task routing
**Scope**: `src/lib/router.ts` -- `MUTATING_VERBS`
**What worked**: Added 'duplicate', 'copy', 'replicate', 'make a copy' to mutating verbs list.
**What broke on first attempt**: 'duplicate' as a noun ("find duplicates") was now routing to data-management instead of data-quality.
**Root cause**: The word 'duplicate' is ambiguous -- as a verb it means 'copy this table', as a noun/adjective it means 'find duplicate rows'.
**Rule**: When adding ambiguous words to MUTATING_VERBS, also add the full-phrase counterpart to DATA_QUALITY_SIGNALS with high weight (>=3). The scoring system resolves conflicts by checking if a multi-word quality phrase is present alongside the verb match.

### 2026-06-24: Dataset listing performance issues
**Scope**: `src/lib/skills/schema.ts` -- `fetchProjectSchema()`
**What worked**: Added pagination support and parallel table count fetching.
**Root cause**: Was fetching all datasets sequentially without pagination. Large projects with many datasets would timeout.
**Rule**: All BigQuery list operations must support pagination (check for `nextPageToken`). Use `Promise.all()` for independent per-dataset fetches.

### 2026-06-24: App flashing on reload
**Scope**: `src/app/page.tsx`, `src/app/globals.css`
**What worked**: Ensured initial render state matches server-side render to prevent hydration flash.
**Root cause**: Client-side state initialization differed from server-side, causing a visible flash during hydration.
**Rule**: Initial state for any component that renders on first paint must produce the same HTML on server and client. Use CSS to hide content until hydrated if necessary, not conditional rendering.
