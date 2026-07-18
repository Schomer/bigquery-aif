# System Invariants

Rules that must hold true across all code changes. Violating any of these has caused bugs in the past or would break critical functionality. Before making a change, check it against this list. If a change would violate an invariant, either the invariant needs updating (with justification) or the change needs rethinking.

Last verified: 2026-07-16
Note: "Last verified" = last time this document was audited for completeness and accuracy. Individual invariants were added throughout July as new bugs were discovered and fixed. See ops-ledger.md for derivation history.

---

## Design Philosophy

These principles govern all design decisions. They are not suggestions -- they are requirements.

- **Conversational data tool, not pre-canned experiences**: This app exists to handle whatever data task the user needs, not to funnel users through pre-designed flows. Every prompt is part of an ongoing conversation about data. The system must be able to create whatever experience is needed for the task at hand, dynamically. Never design features that assume a fixed sequence of steps or a predetermined UX pattern. If a new data task doesn't fit existing skill categories, the system should adapt -- not force the task into an ill-fitting template.
- **Every prompt continues the conversation**: Each user prompt exists in the context of whatever output is currently on screen -- a table schema, query results, a quality report, a chart, monitoring data, anything. The system must treat follow-up prompts as continuations, not fresh requests. Re-deriving context that is already established (e.g., re-fetching a schema for a table the user is already looking at) is always a bug.
- **The LLM classifier must know the full conversational state**: The intent classifier receives conversation history and must also receive structured context about what the user is currently viewing (last skill, last table, last dataset). Without this, it cannot make correct routing or decomposition decisions.

---

## Global

- **Model**: Always `gemini-3.5-flash`. Never change to any other model variant. Verify: `grep -rn "gemini-" src/ functions/ scripts/`
- **No emojis**: Not in code, comments, UI text, log messages, commit messages, or any output.
- **Backtick-wrap table refs**: All fully qualified BigQuery table references must be wrapped in literal backticks: `` `project.dataset.table` ``. Project names often contain hyphens which break unquoted SQL.
- **INFORMATION_SCHEMA outside backticks**: INFORMATION_SCHEMA views must be OUTSIDE the backtick-quoted identifier. Correct: `` `project.dataset`.INFORMATION_SCHEMA.VIEW_NAME ``. Wrong: `` `project.dataset.INFORMATION_SCHEMA.VIEW_NAME` ``. The wrong form causes BigQuery to interpret `dataset.INFORMATION_SCHEMA` as a dataset name. Verify: `grep -rn 'INFORMATION_SCHEMA' src/lib/skills/` and check that no INFORMATION_SCHEMA reference is inside a backtick pair.
- **Build before deploy**: Run `npm run build` after every source change. This project uses static export (`output: 'export'`).
- **Deploy after build**: `git add -A && git commit && git push` then `npx -y firebase-tools@latest deploy --only hosting --project malloy-data`. User tests on deployed app, not localhost. Cloud Functions are no longer used.
- **Gemini calls use Firebase AI Logic SDK**: The client calls Gemini through `firebase/ai` (`getGenerativeModel` + `generateContent`). No custom Cloud Function proxy. The Firebase API key (NEXT_PUBLIC) authorizes the call through Firebase's infrastructure. The Gemini Developer API must be enabled on the project (`npx firebase-tools init ailogic`). Model name is set in `gemini-client.ts` as `GEMINI_MODEL = 'gemini-3.5-flash'`.
- **No Cloud Functions in this project**: The `functions/` directory exists but is not deployed. The org-level IAM policy blocks public Cloud Run access, which prevents any Firebase Hosting rewrite to Cloud Functions v2. Firebase AI Logic eliminates the need for a proxy entirely.
- **No API routes under static export**: `output: 'export'` silently excludes `src/app/api/` routes from the build. Do not add API routes -- they will compile but never run in production. Use Cloud Functions for server-side logic.
- **Escape column names in regex**: When using column names from BigQuery schema in `new RegExp()`, always pass them through `escapeRegExp()` from `src/lib/regex-utils.ts`. Column names can contain `$`, `(`, `)`, `.`, etc.
- **String-coerce all dynamic values in JSX**: Never render LLM-sourced or BigQuery-sourced values directly in JSX. Always wrap with `String(val)` or guard with `typeof val === 'string' ? val : String(val ?? '')`. Gemini structured output can return objects/numbers for STRING-typed fields; BigQuery RECORD/STRUCT fields return nested objects. Rendering these as React children causes error #310.
- **`INTERACTIVE_WIDGET` must never come from `inferVisualizationType()`**: The LLM query handler can return `suggestedVisualization: 'INTERACTIVE_WIDGET'` as a hint, but `inferVisualizationType()` must reject it (and `KPI_CARD`, `STAT_ROW`) from the LLM hint trust path. These types require either the full heuristics path or the special early-return in `composeQuery` that checks for `widgetData`. Trusting `INTERACTIVE_WIDGET` without widgetData produces an envelope with `type: 'INTERACTIVE_WIDGET'` but no `presentation: 'custom'`, which hits the `default` case in `Artifact`'s switch and dumps raw JSON.
- **`Artifact` switch default must not dump raw JSON**: The `default` case in the `Artifact` component (ArtifactCard.tsx) must degrade gracefully -- show a DataTable if the data has rows/columns, or return null. Never use `JSON.stringify(data)` as the fallback output; raw JSON is always a bug surface, not a valid fallback UX.
- **Tool declaration enums must include all values the skill doc instructs the LLM to use**: The Gemini function-calling API enforces enum constraints on tool parameters. If a skill doc tells the LLM to set a parameter to value X, but the tool declaration's enum doesn't include X, the LLM cannot comply. When adding a new semantic value to a skill doc instruction (e.g., a new `visualizationHint` value), always update the corresponding tool declaration enum in `bq-tools.ts`.

---

## AI-First Architecture (CRITICAL -- read this before any routing/classification change)

These rules exist because keyword-based intent classification has failed repeatedly in this project. Every time someone adds a keyword, regex pattern, or signal array to fix a misrouted prompt, it fixes one case and breaks others. The AI (Gemini) must interpret all user prompts.

- **NEVER add keywords, regex patterns, or signal arrays to fix a routing or classification problem.** Keywords can never cover every way a user might say the same thing. If the AI misinterprets a prompt, fix the system prompt, the structured output schema, or the tool declarations. Adding keywords is always wrong.
- **NEVER write rigid either/or rules in skill docs** that prevent the AI from handling nuance. Rules like "top-N queries NEVER get filter controls" create false dichotomies. The AI should understand that "top countries" and "top countries with a filter for year" are different intents.
- **Trust AI output without double-gating.** If the AI produced a structured result (e.g., a widget spec in its response), that is sufficient signal. Do NOT require a second enum match or flag to "confirm" the AI really meant it. Double-condition gates silently drop features when any single condition fails.
- **Fix misinterpretation at the source.** When the AI gets a prompt wrong: (1) improve the system prompt with better instructions or examples, (2) expand the structured output schema so the AI can express its decision more precisely, (3) update tool declarations to give the AI the right options, (4) add examples to the skill doc showing correct behavior.

### Existing router context (legacy, do not expand)

The keyword router in `router.ts` exists as a latency optimization. It is NOT the intent classification system. The AI (LLM classifier in the orchestrator, or the conversation handler) is the intent classification system. The keyword router's role is limited to:
- **Ambiguous read/write defaults to read**: If a message has both mutating and quality signals, route to data-quality (or query), never to data-management.
- **No-signal default is conversation with medium confidence**: When no signals match, the LLM classifier decides.
- **Destructive DML is intercepted in the conversation handler**: The conversation agent's `execute_dml` tool intercepts DELETE/TRUNCATE/DROP and adds safety gates. This works with any phrasing because the AI wrote the SQL, not keyword matching.
- **Conversation handler is a tool-calling agent**: `handleConversation()` uses `callGeminiWithTools()` with 6 tools. It can both converse AND execute operations.
- **Final fallback is conversation, not keyword result**: When both keyword router and LLM classifier fail, the orchestrator defaults to conversation.
- **Dispatch uses manifest-driven lookup, not switch-case**: `SKILL_MAP.get(skill)` retrieves the handler function. Unknown skills fall back to `handleQuery()`. Do not re-introduce a switch-case.
- **All handler signatures are (message, history, context, onStatus)**: The 4-arg pattern enables uniform dispatch through the manifest. Do not add or remove parameters.
- **Data-management safety net (high confidence only)**: `handleDataManagement()` re-checks the message against the keyword router before proceeding. If the router disagrees **at high confidence**, it redirects to `handleQuery()`. Medium/low confidence disagreements do not redirect -- the LLM classifier already decided this is data-management intent.
- **Query handler uses tool-calling agent loop**: `handleQuery()` uses `callGeminiWithTools()` with 4 tools (`run_query`, `get_table_schema`, `list_tables`, `list_datasets`). The LLM decides what context to fetch. Do NOT re-introduce the old pipeline of `buildSchemaContext()` + `callGemini()` + `dryRun()` + `executeQuery()`.
- **Query handler pre-fetches the table list**: When a dataset is resolved, `handleQuery()` calls `fetchSchema(dataset)` and includes the table names in the system prompt. This eliminates `list_tables`/`list_datasets` tool calls in the common case. The prompt tells the LLM not to call these tools unless querying a different dataset.
- **Query auto-retry is implicit**: Errors from `run_query` tool calls feed back to the LLM as function responses. The LLM can fix its SQL and call `run_query` again within the iteration cap. Do not add explicit retry logic.
- **The iteration cap is a runaway guard, not a task budget**: `callGeminiWithTools()` defaults to 8 iterations, but handlers should override this to match their task complexity. `handleQuery()` uses 15; `handleConversation()` uses 30. The real protection against infinite loops is the tool-call deduplication cache -- identical calls are never re-executed, so a high cap is safe. Do NOT lower caps to fix correctness bugs; use `terminateAfter` instead.
- **`terminateAfter: ['run_query']` is set in `handleQuery()`**: After `run_query` succeeds, the loop exits immediately. This is a code-level guarantee -- do NOT rely only on the system prompt instruction "STOP after run_query succeeds".
- **`terminateAfter: ['execute_dml', 'create_dataset']` is set in `handleConversation()`**: After any terminal DML or dataset creation succeeds, the loop exits immediately. This prevents the agent from continuing to make tool calls after a task is complete.
- **Self-review is non-fatal**: The `selfReviewEnvelope()` function catches all errors and returns the original envelope if review fails. Never make self-review failures block response delivery.
- **buildSchemaContext still used by data-management**: `buildSchemaContext()` in `orchestrator-utils.ts` is used by `handle-data-management.ts`. Do not remove it.
- **Available datasets are fetched once per turn**: The `getAvailableDatasets()` result is passed through `enrichedContext` to all handlers. Handlers must not re-fetch this list independently.
- **Cross-dataset search on table not found**: When `handleSchema()` gets a 'Not found' error for a table, it searches all other datasets in parallel before failing. This is intentional -- users often reference tables without specifying the dataset.
- **Schema+query multistep is always redundant**: `handleQuery()` fetches schema via tool calls as needed. A multistep workflow that fetches schema in step 1 and runs a query in step 2 is structurally redundant and must be collapsed to a single query step.
- **Dataset name vs project name guard**: `fetchSchema()` in `src/lib/skills/schema.ts` checks if the requested dataset name equals the project name and ignores it if so. This prevents the confusing case where the project name is treated as a dataset.
- **callGemini retries transient errors 3 times**: 429, 5xx, and errors containing 'demand', 'temporary', 'limit', 'quota', or 'resource' get exponential backoff with jitter. Auth errors (401/403) are never retried.
- **No dry run for queries**: The dry run step was removed. Queries execute directly. Do not re-introduce `dryRun()` in the query handler.
- **Schema columns from prior turns are threaded through `lastTableSchema` in context**: `ChatContext.lastTableSchema` stores the columns from the most recent table-scope SCHEMA_VIEW result. `handleQuery()` checks this first before calling `fetchSchema`. When present, it is used directly (no fetch at all) and the LLM prompt states the schema is "complete and authoritative -- do NOT call get_table_schema under any circumstances." Do not weaken this instruction to a suggestion.


---

## Conversation Skill (`src/lib/skills/handle-conversation.ts`)

- **No keyword signals, LLM-routed only**: The conversation manifest has an empty `signals` array. It is never reached by keyword scoring -- only by the LLM classifier or as the no-signal default.
- **Loads skill doc summaries for capability awareness**: `getSkillKnowledge()` loads the first 20 lines of each skill doc to give the LLM awareness of what the app can do. Cached per session.
- **Skips self-review**: Conversation envelopes set `skipSelfReview: true` because they contain no data artifacts that need quality review.
- **Chip-based action handoffs**: The `suggestedActions` array in the response becomes `nextActions` on the envelope, rendered as pill-shaped buttons. Users click chips to invoke task skills.
- **CONVERSATION artifact type renders as prose**: ChatThread renders CONVERSATION as plain styled text with optional action chips. It does NOT go through ArtifactCard.

---

## Schema Skill (`src/lib/skills/schema.ts`)

- **Three scopes, strict hierarchy**: PROJECT (list datasets) -> DATASET (list tables) -> TABLE (full schema). Each scope has its own fetch function. Never mix them.
- **`fetchSchema()` requires both project AND dataset for table lookups**: Calling `fetchSchema(dataset, table, project)` with a dataset but no table returns dataset-level listing. With both dataset and table, returns full table schema.
- **Schema results are cached in memory**: `schema-cache.ts` provides `getFromCache`/`setInCache` keyed by `(project, dataset, table)`. Cache is per-session (browser tab). Do not add persistent caching without considering staleness.
- **Pagination is mandatory for list operations**: Both `fetchProjectSchema()` and `fetchDatasetSchema()` loop on `nextPageToken`. Removing pagination will break for projects with >1000 datasets or tables.
- **Table constraints query may fail**: INFORMATION_SCHEMA constraint tables may not be accessible. `fetchTableConstraints()` catches all errors and returns empty arrays. This is intentional.

---

## Composer (`src/lib/composer.ts`)

- **Chart type is determined by data shape, not user intent**: The composer selects visualization based on the actual result columns and row count. The LLM's `suggestedVisualization` is a hint, not a mandate.
- **Null/undefined cells must not throw**: Table rendering code must handle null, undefined, and empty string cell values gracefully.
- **Next-action chips are capped at 4 per envelope**: Each composed result generates at most 4 handoff chips. This is a UX constraint. Quality flag suggested actions also count toward this cap.
- **Quality flags are capped at 5 per result**: `analyzeResultQuality()` returns at most 5 flags to avoid overwhelming the UI.
- **Zero-row results always use diagnostic headlines, never LLM summaries**: When `rowCount === 0`, the composer skips the LLM `resultSummary` and uses `buildQueryHeadline()` which generates SQL-aware diagnostic messages (INFORMATION_SCHEMA, WHERE-filtered, or generic). The LLM summary is written at query-generation time before results are known, so it cannot account for empty results. Zero-row results also force TABLE artifact type and generate recovery chips (sample table, view schema).
- **Sample/preview queries force TABLE artifact type**: Any query matching `SELECT * FROM ... LIMIT N` is treated as a sample query and forced to TABLE view. Chart inference should only apply to aggregated/analytical results, not random row samples.
- **Time-series charts sort chronologically**: `useChartSetup` in `recharts-charts.tsx` detects date-like x-axis values and sorts data oldest-to-newest. This ensures line/area charts read left-to-right in temporal order regardless of the SQL ORDER BY direction.
- **`buildQueryHeadline` receives columns and rows**: The headline builder has access to actual data values to produce context-aware headlines (KPI values, data shape descriptions) instead of generic "X rows from table" messages.
- **Briefing must be set in both heuristic and LLM paths**: Every compose function sets a heuristic `briefing` on the envelope. Self-review may override it with an LLM-generated briefing. If a new compose function is added, it must also set `briefing`.
- **Narrative-only briefings are suppressed at render time**: ArtifactCard only renders BriefingBlock when `briefing.findings` has entries. Narrative-only briefings always restate the headline and are not displayed. To show additional text beyond the headline, use structured `findings` (bullet points) or the `insight` field.

---

## Plan Cache (`src/lib/plan-cache.ts`)

- **Session-scoped, not persistent**: The plan cache lives in module-level memory. It resets on page reload. Do not add persistent storage without considering SQL staleness (schema changes invalidate cached plans).
- **FIFO eviction at 20 entries**: When the cache exceeds 20 entries, the oldest is removed. Do not increase this without measuring memory impact.
- **Parameter substitution is conservative**: `trySubstitute()` only replaces date literals and LIMIT values. It does not rewrite WHERE clauses, table references, or GROUP BY columns. If substitution fails, the cache misses and Gemini generates fresh SQL.
- **Cache key is dataset, not table**: Plans are matched by dataset name. SQL template reuse across different tables in the same dataset is intentional but relies on structural similarity (same operation shape).

---

## Result Quality (`src/lib/result-quality.ts`)

- **No model calls, ever**: This module is pure heuristic analysis. Adding a Gemini call here would defeat the purpose (latency budget is zero).
- **Single-value column check suppresses WHERE columns**: Columns appearing in the SQL's WHERE clause are expected to have a single value (the user filtered on it). Do not flag these.
- **Null rate threshold is 20%**: Columns with >20% null/empty values are flagged. Adjusting this threshold changes sensitivity -- test with real data before modifying.

---

## Self-Review Gating (`src/lib/chat-orchestrator.ts`)

- **Self-review is skipped for simple, high-confidence results**: Schema PROJECT/DATASET scope, KPI_CARD artifacts, and high-confidence keyword-routed queries with <100 rows skip the self-review Gemini call.
- **Self-review always runs for**: data-management confirmations, complex queries (100+ rows), monitoring/quality reports, LLM-classified requests (medium/low confidence). Do not expand skip conditions to cover these.

---

## BigQuery Client (`src/lib/bigquery-client.ts`)

- **OAuth token is fetched per-request via `getAccessToken()`**: Never cache the token at module level. The GIS auth module manages token refresh internally.
- **`handleAuthError()` clears the token, does NOT redirect**: It calls `setAccessToken(null)` and lets the error propagate. The UI layer's `withAuthRetry` handles refresh. Never add `window.location.href` back.
- **`dryRun()` must be called before `executeQuery()` for user-initiated queries**: The dry run checks estimated bytes and returns a cost tier. Tier 3+ requires user confirmation.
- **DML operations use `executeDml()`**, not `executeQuery()`: These are separate functions with different error handling.
- **`parseQueryResponse` coerces types based on schema**: BigQuery REST API returns all cell values as strings. `coerceValue()` converts them to native JS types using the schema field's `type` property (INTEGER/FLOAT/NUMERIC -> Number, BOOLEAN -> boolean). Do not revert this or pass raw `cell.v` strings through.

---

## Value Formatting (`src/lib/format-value.ts`)

- **Currency detection is heuristic**: `isCurrencyColumn()` matches column names against `CURRENCY_PATTERNS` regex. New monetary column name patterns must be added to this regex. `NON_CURRENCY_SUFFIXES` prevents false positives (e.g., `cost_tier`).
- **All display components must use `formatDisplayValue()`**: KpiCard, DataTable, and chart tooltip formatters use this function. Do not add raw `toLocaleString()` or `String()` calls for user-facing values.
- **`formatCompactValue()` is for space-constrained contexts**: Chart Y-axis ticks and compact displays use this (e.g., `$509.4M`). Full displays use `formatDisplayValue()`.

---

## Auth Token Refresh (`src/lib/auth-context.tsx`, `src/lib/gis-auth.ts`, `src/app/api/auth/refresh/route.ts`)

- **OAuth access token is stored in `localStorage`, not `sessionStorage`**: This ensures tokens survive tab close, new tabs, and browser restarts. The companion timestamp key `bqaif_token_ts` tracks when the token was acquired. Do not switch back to `sessionStorage`.
- **Refresh token is stored in `localStorage`**: Captured during initial sign-in (via `access_type: 'offline'` on the consent provider). Long-lived -- does not expire unless the user revokes access. Cleared on explicit sign-out.
- **`isTokenLikelyExpired()` uses a 50-minute threshold**: Google OAuth tokens expire at 60 minutes. The 10-minute buffer allows proactive refresh before a 401 hits. Do not reduce below 45 minutes.
- **Token refresh uses server-side `/api/auth/refresh` first**: `refreshAccessTokenSilently()` in `gis-auth.ts` POSTs the stored refresh token to the server endpoint, which exchanges it for a new access token using the client secret. No popup, no user interaction. Falls back to popup-based refresh only when no refresh token is stored.
- **`/api/auth/refresh` requires `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` env vars**: These are server-only (no `NEXT_PUBLIC_` prefix). Set in `.env.local` for local dev and in `PROD_ENV` in `deploy.mjs` for Cloud Run.
- **Consent provider uses `access_type: 'offline'`**: This is what triggers Google to return a refresh token on the consent sign-in. Do not remove this parameter.
- **Auto-refresh on page load**: When `onAuthStateChanged` detects an existing user but the stored token is missing or expired, `refreshAccessTokenSilently()` is called automatically. Falls back to popup-based refresh if server-side fails. The `autoRefreshAttempted` ref prevents duplicate attempts.
- **All orchestrator calls must be wrapped in `withAuthRetry()`**: This wrapper catches expired-token errors, calls `refreshAccessToken()` to get a fresh token, and retries the call once.
- **Auth retry is one-shot**: The `authRetrying` ref prevents infinite retry loops. If the refresh fails, the error propagates to the existing catch block which shows the error banner.

---

## UI Components

- **`SchemaView.tsx` is the largest component (67KB)**: Changes here are high-risk. Test all three schema scopes (project/dataset/table) after any modification.
- **Error boundaries wrap skill-specific views**: Each view component should gracefully handle missing or malformed data from the orchestrator.
- **Google Sans is the only non-code font**: All UI text must use `'Google Sans', sans-serif`. Do not introduce Inter, Roboto, or other font families. Monospace (`var(--font-mono)`) is reserved for code blocks, SQL, and technical identifiers -- not table data cells.
- **Confirmation cards block execution**: `ConfirmationCard` and `CostConfirmCard` must prevent any data-modifying operation until the user explicitly confirms.
- **No CSS class names ending in `-body`**: Tailwind 4's CSS processor extracts element selectors from class name suffixes. A class like `.my-component-body` compiles to a bare `body{}` rule in the output, corrupting global layout. Use `-list`, `-content`, `-wrap`, `-container`, or `-inner` instead. Verify: after build, `grep -o 'body{[^}]*}' .next/static/chunks/*.css` must return only one rule.

---

## Task Framework (`src/lib/tasks/`)

- **Executor host allowlist is mandatory**: `executeApiCall()` validates the resolved URL host against `ALLOWED_API_HOSTS`. Adding a new googleapis.com subdomain requires updating this list. Never remove the validation.
- **Learned plans are per-project, not per-user**: Stored in a top-level `learnedPlans` Firestore collection with a `project` field. The `getLearnedPlans()` query filters by project.
- **Zod v4 record syntax**: Always use `z.record(z.string(), valueSchema)` with two arguments. Single-argument `z.record(valueSchema)` does not compile in Zod v4.
- **Resolver uses callGeminiWithSchema, not ai-sdk**: All LLM calls in the task resolver use `callGeminiWithSchema` from `gemini-client.ts` with OpenAPI-style JSON schemas. Do not re-introduce `@ai-sdk/google` or `generateObject`.
- **Learned plan match threshold is 0.7**: Plans with Gemini-scored semantic confidence below 0.7 are not reused. Lowering this risks reusing inappropriate plans.
- **In-memory cache is per-session**: The learned plans cache resets on page reload. Do not persist it.
- **Action shortcuts are checked before learned plans**: Resolution order in `resolveTask()` is: action shortcuts (instant, no LLM) -> learned plans (1 LLM call for semantic match) -> full 2-phase resolution (2 LLM calls). Do not reorder these.

---

## Orchestrator Architecture

- **Any skill handler exceeding 300 lines must be extracted to its own file in `src/lib/skills/`.**
- **Adding a new skill requires exactly 2 files**: Create `handle-{name}.ts` with a `manifest` export, then add one import + one array entry in `src/lib/skills/index.ts`. No other files need editing.
- **Each handler must export a `manifest: SkillManifest`**: The manifest declares skill name, label, signals array, and handler function. The barrel file aggregates them.
- **`IntentClassifierSchema` is lazily initialized**: Because `gemini-client.ts` and `skills/index.ts` have a circular import, the schema is built via a `Proxy` that defers initialization until first property access.
- **Total LLM prompt (system instruction + schema context + conversation history + skill doc) should stay under 28,000 tokens when practical.** Use shorter context when full context is not needed.
- **A single user turn should do whatever Gemini calls are needed to serve the request -- there is no hard cap.** If more than 6 calls happen in one turn, log a warning for visibility.

---

## Timeout & Rate Handling

- **Any BigQuery query that does not return within 30 seconds must be cancelled and the user informed.** No silent hanging.
- **Send at most the last 10 message pairs to the LLM classifier.** Truncate older history.

---

## State Management

- **Any handler that replaces a confirmation card must remove the original envelope from the message list.** (from ops-ledger 07-07)
- **Auth state handlers must be idempotent -- only call setState when the value differs from current state.** (from ops-ledger 06-30)
- **Initial render state for any component must match between server and client to prevent hydration flash.** (from ops-ledger 06-24)
- **Every skill handler must use `resolvedDataset` from enriched context, never raw user input for dataset names.** (from ops-ledger 07-01)

---

## Types (`src/lib/types.ts`)

- **Never define the same interface name twice in one file**: TypeScript declaration merging intersects property types, which silently narrows optionals to required. This caused the `PipelineResult` type error where `confirmation.sql` became required and `confirmation.schedule` disappeared.
- **`OperationLogEntry` is the canonical type for conversation operation tracking**: Used by `conversation-context.tsx` and `useChatOrchestration.ts`. Changes to its shape affect the ConversationSummary derivation logic.

---

## Dependencies

- **Adding a new npm dependency requires documenting the rationale in the commit message and verifying bundle size impact.**

---

## Saved Artifacts

- **Saved artifacts execute cached SQL directly, not via Gemini**: The `handle-saved.ts` skill handler runs `executeQuery(step.cachedSql)` without calling the LLM. This is intentional -- saved items should not burn Gemini tokens on re-execution.
- **Parameter extraction happens at query-generation time, not at save time**: The `QueryResponseSchema` includes a `parameters` field that Gemini populates alongside SQL. This avoids a second LLM call when saving.
- **Old `SavedItem` format is migrated on read**: `saved-work.ts` checks `isNewFormat()` (presence of `steps` array) and calls `migrateItem()` for legacy records. Both old and new formats coexist in the same `savedWork.{id}` Firestore location.
- **The page key for saved items is `'spaces'`** (renamed from `'saved'`): Updated in SideNav, page.tsx, page-context.tsx, and all hide-list conditions. The component export is `SpacesPage` from `SavedPage.tsx`.
- **Spaces are stored in `users/{uid}/spaces/{id}`**: Each space is a `{ id, name, createdAt, updatedAt }` object. Deleting a space moves its items back to root (spaceId = undefined), not deleted.
- **`SavedArtifact.spaceId` is optional**: Items not in a space have `spaceId` as undefined. Items in a space store the space's ID.
- **Overview page was removed**: The nav item and page rendering for 'overview' are gone. The default page is 'chat' (displayed as "AI" in the sidebar).
- **"Chat" is displayed as "AI"** in the sidebar nav with the `auto_awesome` icon. The page key remains `'chat'`.
- **Chat sidebar is a single panel in all layouts**: ChatSidebar always shows the chat list. In unified layout, it's an overlay toggled by the AI button (via `chatListOpen` in layout-context.tsx). In split layouts (chat-left/chat-right), it occupies the sidebar slot -- clicking a chat replaces it with ResultsSidebar (the thread view), which has a "All chats" back button (`onBackToChats` prop) to return to the list. The `splitView` state (`'list'` | `'thread'`) in page.tsx manages this swap. ChatSidebar no longer has a `mode` prop.
- **AI button toggles chat list in unified mode**: Clicking the AI nav item in SideNav toggles `chatListOpen` (via layout context) when already on the chat page in unified mode. In split modes, the AI button just navigates to the chat page since the sidebar is always visible.
- **Chat titles use the most recent user prompt**: `persistConversation` always sets the title to `autoTitle(lastUserMsg)` where `lastUserMsg` is the last message with `role === 'user'`. The `titleSetRef` guard was removed.

---

## Table Name Resolution

- **Fuzzy table name matching on "Not found"**: Both `handle-schema.ts` and `bq-tools.ts:get_table_schema` perform fuzzy matching when a table is not found in its dataset. The search order is: exact variants (plural/singular, `v_` prefix), then substring matching on the dataset's table list. The shortest substring match wins.
- **Query handler must verify table names before writing SQL**: The system prompt in `handle-query.ts` instructs the LLM to call `get_table_schema` first to verify tables exist. If the tool returns `actualTableName`, the LLM must use that name in SQL.

---

## Suggestion Chips

- **Query results must generate data-driven chips**: The `composeQuery()` function in `composer.ts` generates suggestion chips based on the actual result data (chart suggestions, drill-down by top value, profile source table, view schema). The UI fallback chips ("Suggest next steps", "Generate insights") only appear when the composer returns zero `nextActions`.
- **Chip cap is 4**: All chip generation logic must respect the 4-chip limit. Quality flag chips take priority, then data-driven chips fill remaining slots.

---

## Visualization Selection -- Explicit User Intent

- **Explicit chart type always wins**: When the user explicitly names a chart type (e.g., "show as a bar chart", "bar chart", "line chart"), `extractVisualizationIntent()` returns a non-null `userIntent`. This value is threaded through `enrichedContext.userIntent` → `handleQuery()` → `compose()` → `inferVisualizationType()`. `inferVisualizationType()` returns `userIntent` immediately at Step 0 before any heuristic runs. This is absolute -- geographic detection, LLM visualization hints, and self-review overrides cannot supersede it.
- **Interactive widget inner chart respects user intent**: When a query is rendered as an INTERACTIVE_WIDGET (e.g., user asked for a date picker), the inner chart type (`widgetData.visualization`) must also respect `context?.userIntent` with highest priority. The LLM's `widgetSpec.visualization` and `result.suggestedVisualization` are only consulted when no explicit intent is present.
- **Cached-plan path must forward user intent**: `executeCachedPlan()` calls `compose()` and must pass `context?.userIntent ?? null` as the 4th argument. Omitting it causes geographic heuristics to override the user's explicit request when data contains country/state columns.
- **Self-review visualization override is code-blocked when userIntent is set**: `selfReviewEnvelope()` accepts a `userIntent` parameter. When non-null, the `betterVisualization` field from the LLM review is silently ignored in code -- this is not a prompt instruction but a hard code-level guard. A prompt-only guard is insufficient because the LLM can still return a `betterVisualization` value.
- **viz-intent.ts EXPLICIT_INTENT_MAP is first-match-wins**: The array is ordered so that explicit named chart types (BAR_CHART, COLUMN_CHART, etc.) appear before geographic patterns (WORLD_MAP, USA_MAP). A prompt like "show population for each country as a bar chart" matches COLUMN_CHART first and returns before reaching WORLD_MAP. Do NOT reorder the EXPLICIT_INTENT_MAP entries.
- **Ambiguous geographic phrases are NOT explicit map requests**: Phrases like "by country", "by state", "each country" indicate categorical grouping (like "by month" or "by year"), not a map visualization. They must NOT appear in EXPLICIT_INTENT_MAP for USA_MAP/WORLD_MAP. Only phrases that explicitly name a map ("world map", "show on a map", "choropleth") should trigger map intent. Geographic data gets a bar/column chart by default; the map is available via the UI toggle.
- **Map toggle appears when geographic columns are detected**: The Chart/Table segmented control in both ArtifactCard and InteractiveWidgetView shows a third "Map" option when `classifyColumns()` detects `geo-state` or `geo-country` roles. The map type (USA_MAP vs WORLD_MAP) is determined by `detectChoroplethType()`.
