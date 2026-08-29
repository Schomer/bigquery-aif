# Operations Ledger

## 2026-08-28 -- Single card for table exploration & suppressed preparatory schema cards

**What broke**:
1. Analytical query prompts (e.g. "Top 20 Items by total sales", "by item_description") displayed two result cards: a table schema card (`Schema: dataset.table`) and a query chart/table card (`Top 20 Items by Total Sales`).
2. Selecting/clicking a table in schema views triggered 3 cards (Schema view, Data Preview table, and Data Profile stats).

**Root cause**:
1. In `processWithAgentLoop` (`src/agent/index.ts`), envelope construction iterated through all successful tool events and generated a card for every tool call without distinguishing primary results from preparatory lookups. Since the agent always calls `get_schema` before writing SQL to verify table schemas, `get_schema` produced a `SCHEMA_VIEW` card alongside the `run_query` card on every turn.
2. In `SchemaView.tsx`, clicking a table sent "Give me an overview of the table", matching a legacy prompt recipe that instructed the AI to call `get_schema`, a preview query, and a profile query. In reality, the table view (`TableSchemaView`) already embeds schema, interactive sample data, and profile tabs in a single component.

**Fix applied**:
1. `src/agent/index.ts`: Added `hasPrimaryAction` check (`run_query`, `execute_dml`, `manage_pipeline`, `export_data`, `present_result`). When a primary action succeeds, preparatory `get_schema` and `list_resources` calls are skipped during envelope generation, producing only the primary result envelope(s). `SCHEMA_VIEW` envelopes are now only generated when schema inspection/exploration is the terminal action (e.g. "show schema for X", "list tables in Y").
2. `src/agent/prompts/flash.ts`: Replaced the 3-query table overview recipe with a clear 1-card budget rule. When inspecting/exploring a table or dataset, calling `get_schema` produces the complete interactive view without extraneous preview/profile queries.
3. `src/components/SchemaView.tsx`: Updated table click message to natural prompt `"Tell me more about the ${table} table in the ${dataset} dataset"`.

**Rule derived**: Table exploration must produce a single comprehensive `SCHEMA_VIEW` card (which already provides Schema, Sample, and Profile tabs). Never execute auxiliary preview or profiling queries when inspecting a table.

## 2026-08-28 -- BigQuery Studio (Dataform) saved query integration and two-way sync

**What**: Connected BigQuery Studio saved queries via Google Cloud Dataform API (`dataform.googleapis.com`). Users can save queries as BigQuery Studio SQL code assets (`queries/<name>.sql`), browse existing Studio queries under a dedicated "BigQuery Studio" Library tab, preview/copy SQL, and execute them directly in chat.

**Why**: BigQuery Studio manages saved queries as Dataform code assets rather than database views. Users need to save SQL so it appears in BigQuery Studio's Explorer panel and load existing Studio queries into the app without leaving the conversation.

**Fix**:
1. `src/lib/dataform-client.ts`: Implemented REST client for Dataform API with automatic repository (`studio-queries`) and workspace (`studio-workspace`) discovery and initialization, query file listing (`queryDirectoryContents`), reading (`readFile` base64 decoding), and writing (`writeFile` base64 encoding).
2. Added `normalizeDataformLocation()`: Dataform is a regional service (`us-central1`, `europe-west1`, etc.) and does not support multi-regions like `us` or `eu`. Normalizes multi-region BQ locations to regional endpoints and provides fallback discovery.
3. Fixed workspace naming: Dataform forbids naming workspaces the same as the repository's default Git branch (e.g. `main` or `master`). Changed default workspace name to `studio-workspace`.
4. `src/components/SaveModal.tsx`: Added "Save to BigQuery Studio" option alongside BigQuery View option when SQL is present in the artifact.
5. `src/hooks/useChatOrchestration.ts`: Wired BigQuery Studio options in `handleSaveConfirm`, syncing SQL to Dataform workspace and reporting created path in chat.
6. `src/components/SavedPage.tsx`: Added "BigQuery Studio" tab, state loader, card and list renderers with Run, Copy SQL, and Console links.

**Rule derived**: Modern BigQuery Studio query assets are powered by Dataform API. Dataform is regional; multi-region BigQuery locations (`us`, `eu`) must be normalized to valid regional endpoints (`us-central1`, `europe-west1`). Development workspaces in Dataform must never be named `main` or `master` because those names conflict with the protected default Git branch.

## 2026-08-28 -- Save queries directly to BigQuery as Views

**What**: When users save a query or chart, provide direct persistence into BigQuery as a BigQuery View (`CREATE OR REPLACE VIEW \`project.dataset.viewName\` AS <sql>`).

**Why**: Saving queries only into app-level storage (Firestore) meant users could not see or query their saved queries directly in BigQuery Console or connect them to external BI tools.

**Fix**:
1. `src/agent/index.ts`: Fixed bug where `queryResult.sql` was hardcoded to `''` when constructing query envelopes from `run_query` events. Now extracts SQL from `event.tool_args.sql` and `cached.sql`.
2. `src/lib/bigquery-client.ts`: Added `createBigQueryView()` using DDL execution (`CREATE OR REPLACE VIEW \`project.dataset.viewName\` OPTIONS(...) AS <sql>`).
3. `src/components/SaveModal.tsx`: Added BigQuery dataset selection, view name slugification/validation, and target preview (`` `project.dataset.view_name` ``).
4. `src/hooks/useChatOrchestration.ts`: Extracted dataset from source SQL/context and invoked `createBigQueryView()` upon saving with confirmation in the chat stream.

**Rule derived**: Saving queries or analytical artifacts with underlying SQL should always provide the option to persist directly to BigQuery as standard database Views so the logic is accessible directly in Google Cloud BigQuery. Always propagate `sql` from tool results into envelope provenance.

## 2026-08-11 -- Persist chart data across sessions (dehydration/hydration)

**What broke**: Charts and tables in old conversations were blank when re-opened. The conversation messages (including full result row arrays) were serialized into `messagesJson` in a single Firestore document per user. Large result sets pushed the document past Firestore's 1MB limit, causing `saveConversation()` to fail silently (`.catch(e => console.warn(...))`). Even when saves succeeded, the JSON payloads were unnecessarily large.

**Root cause**: No separation between conversation metadata (headline, SQL, columns) and result data (rows). Everything was in one Firestore document field.

**Fix**: Added IndexedDB-based dehydration/hydration:
1. `result-cache.ts`: Added a second IndexedDB store `persistent_results` (500MB budget) alongside the existing `results` store (200MB LRU). Bumped DB_VERSION to 2.
2. `firestore-service.ts`: `saveConversation()` now dehydrates messages before saving -- strips `rows` from data-bearing envelopes, persists them to IndexedDB under `envelope.id`, replaces with `rows: []` + `_resultCacheId` marker. Added `getConversationHydrated()` which restores rows from IndexedDB on load.
3. `page.tsx`: Conversation load effect uses `getConversationHydrated()` instead of `getConversations()`.
4. `ArtifactCard.tsx`: Added fallback card when `_dataMissing: true` (data cleared/different device) -- shows "Re-run query" button using preserved `provenance.sql`.

**Rule derived**: Conversation result data must be stored separately from conversation metadata. Large binary data (row arrays) goes to IndexedDB; only references go to Firestore. Always provide a re-run fallback for missing data.

## 2026-07-30 -- Library rename, tab/nav bug fixes, pin/favorite cleanup

**What**: Renamed "Content" to "Library" across UI. Fixed 8 navigation/tab bugs. Cleaned up pin vs favorite terminology.

**Bugs fixed**:
1. TabBar stayed visible on sidebar overlay pages (Favorites, Library, Prompts, Templates) -- added activePage check
2. closeTab() did not reset activePage, leaving stale overlay state -- added setActivePageState('chat')
3. No way to return to open builder/dashboard tabs from sidebar -- added "Open" group to SideNav showing non-chat tabs
4. activePage and activeTabId could get out of sync -- fixed by ensuring closeTab resets both
5. "Open" on saved artifacts duplicated onRun logic inline -- consolidated to use chat.runSavedArtifact()
6. Builder documents not shown on All tab -- added condition to show documents on both All and Documents tabs
7. Builder documents disappeared after discardDocument() until page reload -- SavedPage now fetches from Firestore directly
8. "Pinned" label on Library items renamed to "Favorited" with star icon

**Rule derived**: The sidebar group for saved items must always be labeled "Library". Pin = chats only. Favorite = Library items only. TabBar visibility must account for activePage, not just tab count.

## 2026-07-30: Dataset info producing 3 cards + Chart/Map toggle mismatch

**What broke (1)**: Asking for info about a dataset produced three cards (schema, chart/map, KPI) instead of one. The TABLE OVERVIEW recipe in the system prompt applied to dataset-level queries, causing the agent to call get_schema, run_query (data preview), and run_query (profile) for datasets.

**Fix (1)**: Scoped the TABLE OVERVIEW recipe in `flash.ts` to "specific table only" and added a DATASET INFO section instructing the agent to produce a single `get_schema` card for dataset-level requests.

**What broke (2)**: The Chart/Map/Table segmented control showed "Chart" as selected but rendered a map. When `chartType` was a map type (e.g., `USA_MAP`), `ChartWithToggle` initialized view state to `'chart'`, but `ChartView` rendered the map renderer because `RENDERERS['USA_MAP'] = USAMapRenderer`.

**Fix (2)**: In both `ArtifactCard.tsx` (ChartWithToggle) and `InteractiveWidgetView.tsx`, detect map artifact types and initialize view state to `'map'`. When user selects "Chart", override map-type chartType with `BAR_CHART` so an actual chart renders.

**Rules**:
- The system prompt's overview/info recipes must distinguish between table-level and dataset-level requests. Table overview = 3 cards; dataset info = 1 card.
- When a component's artifact type is a map, the initial view state must match. Chart/Map/Table toggle state and rendered content must always agree.
- When `view === 'chart'`, `ChartView` must receive a non-map chart type. Map types render map components, which violates the user's expectation of seeing a chart.

## 2026-07-30: Recent item chips fail when item belongs to a different project

**What broke**: Clicking a recent dataset/table chip on the empty chat view failed silently when the item belonged to a different project than the currently selected one. The query ran against the wrong project.

**Root cause**: `RecentItem` did not store a `project` field, so the click handler had no way to know the item came from a different project. It just sent the prompt with the current project context.

**Fix**: (1) Added `project?: string` to the `RecentItem` interface. (2) Updated `updateRecentItemsFromEnvelopes()` to capture the project from envelope data (`data.project`) and from fully-qualified SQL references. (3) Updated click handlers in both `page.tsx` and `ResultsSidebar.tsx` to call `setActiveProject(item.project)` before sending the message, when the item's project differs from the active one.

**Rule**: Any clickable entity reference (chip, row, link) that can target a specific project must switch to that project before executing. The project context is not optional -- queries fail without it.

## 2026-07-30: Large project dataset lists unusable -- added search filter and skipped table counts

**Context**: When a project has hundreds or thousands of datasets, listing them produced an unusable flat list. The `fetchProjectSchema()` function also fired N parallel API calls (one per dataset) to get table counts, making it slow and likely to hit rate limits.

**Changes**: (1) Added `ProjectDatasetList` component in `SchemaView.tsx` with client-side search/filter input. Shows for >15 datasets, auto-focuses for >50. List is capped at 400px height with scrolling. (2) In `schema.ts`, skipped per-dataset table-count fetches when there are >50 datasets (sets `tableCount` to `null`, which the UI handles gracefully). (3) Adjusted composer headline for >50 datasets to mention the search field.

**Rule**: For large list responses, always provide client-side filtering. The BigQuery datasets.list API has no server-side name filter, so client-side is the only option. Per-entity metadata fetches (like table counts) should be skipped when the entity count is large -- the user's goal is finding the right item, not comparing metadata across hundreds.

## 2026-07-28: Duplicate cards when agent calls both run_query and present_result

**What broke**: Queries like "What is the total percentage of the top 10 tickers?" rendered two cards: a bare KPI (31.87) and a richer multi-metric summary (31.87% + 68.13% remaining + 10 tickers). The second card was strictly better.

**Root cause**: The agent loop in `src/agent/index.ts` iterates over all successful tool_result events and builds a card for each. The AI called `run_query` (data gathering) and then `present_result` (formatted output) in the same turn, producing two envelopes. The invariants already documented the priority order (present_result > query) but the code didn't enforce it.

**Fix**: Added `hasPresentResult` flag before the main event loop. When true, `run_query` events are skipped (they were data-gathering steps, not the final presentation). The `present_result` card is the agent's deliberate formatting choice and subsumes the raw query output.

**Derived rule**: When `present_result` is in the success events for a turn, `run_query` results are intermediate data-gathering steps and must not produce their own cards.

## 2026-07-28: Chart selection -- added validation layer, ranking detection, test suite

**What broke (previously)**: No test coverage for chart selection. AI hints like LINE_CHART for 2-row data or PIE_CHART for 15 categories were blindly trusted. Rankings >25 rows always became TABLE even when sorted. Several chart types (RADAR, DONUT_CHART, TREEMAP) were unreachable due to Step 7 intercepting.

**Root cause**: `inferVisualizationType()` combined AI hint trust, data validation, and shape inference in one function with no separation of concerns. No tests meant regressions went undetected. Magic numbers scattered throughout the function made threshold changes risky.

**Fix**: (1) Extracted `inferFromDataShape()` (pure shape-based tree) from `inferVisualizationType()` (orchestrator). (2) Added `validateHint()` that checks data preconditions before trusting AI hints -- LINE_CHART needs >=5 points, PIE needs <=6 slices, SCATTER needs >=5 points, etc. (3) Added `isRankingResult()` using SQL ORDER BY + value monotonicity to allow sorted 26-50 row data as BAR_CHART. (4) Created `chartThresholds.ts` as single source of truth for all numeric constants. (5) Added 151 tests including 40-entry golden corpus.

**Derived rule**: AI hints must pass data precondition validation before being trusted. The tree is the final authority for data shape -> chart type. This prevents the AI from producing charts that don't render well with the actual data.


## 2026-07-27: "Clean up the data" produced 22 cards instead of phased workflow

**What broke**: User asked to "clean up the data" in a table. The agent ran 22 separate tool calls (queries + DML), each producing a visible card. User expected: (1) assessment of issues found, (2) confirmation prompt, (3) single final result.

**Root cause**: Two prompt-level issues. (1) MULTI-RESULT DISPLAY said "Do NOT hold back from calling multiple tools when they would each add value" -- actively encouraged card floods. (2) No guidance existed for broad, multi-step data operations. The model treated "clean up" as a series of independent operations and executed them all in one loop run (soft cap 15, hard cap 25).

**Fix**: (1) Added card budget (1-4 cards per response) to MULTI-RESULT DISPLAY. (2) Added MULTI-STEP OPERATIONS section to the system prompt with a 3-phase approach: Phase 1 (ASSESS with 1-2 queries, present findings), Phase 2 (STOP and let user review), Phase 3 (EXECUTE after confirmation). Applies to any request that would produce more than 2 data-modifying operations.

**Rule**: Broad data modification requests must use assess-confirm-execute phasing. The model should never execute more than 2 DML operations without pausing for user review. Card budget is 1-4 per response.

## 2026-07-27: CREATE TABLE listed tables instead of creating one

**What broke**: User said "create a table named holdings in the hey_data_data dataset". Instead of creating the table or asking for column definitions, the model called `list_resources` on the dataset and displayed a "Tables in hey_data_data" card.

**Root cause**: Decision Rules 5 and 6 in `src/agent/prompts/flash.ts` conflicted. Rule 5 said to use `execute_dml` for CREATE TABLE. Rule 6 said to ALWAYS call `get_schema`/`list_resources` when datasets/tables are mentioned. The model saw "hey_data_data dataset" and triggered Rule 6 (list tables) instead of Rule 5 (create table). Since every tool result renders a card, the schema listing was displayed as the response.

**Fix**: (1) Expanded Rule 5 to explicitly say: when CREATE TABLE has no columns specified, ask ONE question for column definitions -- do NOT list existing tables. If the user describes data conceptually, infer columns. (2) Added EXCEPTION to Rule 6: do NOT call schema tools as a preparatory step for mutating operations.

**Rule**: Schema/list tools should never be called as preparation for DDL operations. The model should either execute the DDL directly or ask for missing info -- never inspect the dataset first, because every tool call produces a visible card.

## 2026-07-27: Transient Gemini 500s not retried in adapter path

**What broke**: When Gemini returned a 500 "high demand" error during a tool-calling request (e.g., "create a table"), the raw error was surfaced immediately to the user as "Something Went Wrong" with the full API error text.

**Root cause**: Two issues. (1) `FirebaseAiLogicAdapter.call()` in `firebase-ai-adapter.ts` had no retry logic -- it threw on the first non-OK response. The other code path (`callGemini()` in `gemini-client.ts`) already had 3 retries with exponential backoff, but that path is only used for non-tool-calling structured output. (2) The error classification in `useChatOrchestration.ts` only matched `quota`, `rate limit`, `RESOURCE_EXHAUSTED`, and `429` for the "Temporarily Busy" banner. The 500 error message containing "high demand", "temporary", and "INTERNAL" fell through to the generic "Something Went Wrong" type.

**Fix**: (1) Added retry loop to `FirebaseAiLogicAdapter.call()` -- retries up to 3 times with exponential backoff and jitter for HTTP 429, 500, 503. (2) Expanded the rate_limit error classification to also match `500`, `503`, `high demand`, `temporary`, and `INTERNAL`.

**Rule**: Both model call paths (SDK and REST adapter) must have retry logic for transient errors. Error classification must cover all transient error patterns, not just quota/rate-limit ones.

## 2026-07-27: CSV upload broken -- forcedSkill and handoffContext dropped

**What broke**: Attaching a CSV file and clicking send caused the app to ask the user to paste CSV contents into chat instead of showing the upload preview card.

**Root cause**: `ChatOrchestrator.processMessage()` cherry-picks context properties when forwarding to `processWithAgentLoop()` (lines 93-103). It passed `project`, `dataset`, `lastTable`, etc. but silently dropped `forcedSkill` and `handoffContext`. The `sendMessageWithFile` function in `useChatOrchestration.ts` sets both of these to route CSV data to the data-loading skill, but the orchestrator never saw them. The prompt went through normal AI routing, and the LLM -- having no CSV upload tool and no knowledge of the attached file -- fell back to asking the user to paste data.

**Fix**: Added CSV upload interception in `processMessage()` before the agent loop, mirroring the existing pattern for `confirmedPayload`. Two operation types are handled:
- `UPLOAD_CSV`: Parses the CSV content client-side (header extraction, sample rows), builds a `DataLoadingResult` with `operationType: 'UPLOAD_PREVIEW'`, and composes a `CSV_UPLOAD_VIEW` envelope.
- `UPLOAD_CSV_EXECUTE`: Calls `loadCsvToTable()` (BigQuery Jobs API multipart upload), then composes a success envelope.

**Derived rule**: Any context property that triggers a non-agent-loop code path must be intercepted in `processMessage()` before the `processWithAgentLoop()` call. The agent loop only receives the properties listed in `AgentProcessArgs.context` -- everything else is silently dropped.

---

## 2026-07-27: Multi-envelope display and table overview

**What changed**: Replaced the single-winner heuristic chain in `src/agent/index.ts` (lines 252-561) with a loop that builds an envelope for every successful tool result. Previously, if the AI called get_schema and then run_query, only the query result was shown. Now both produce visible cards.

**Other changes**:
- System prompt (`src/agent/prompts/flash.ts`) now includes MULTI-RESULT DISPLAY and TABLE OVERVIEW sections telling the AI to call multiple tools for comprehensive answers.
- Table click messages in SchemaView.tsx changed from "Show me more about X" to "Give me an overview of the X table in the Y dataset" -- prompts the AI to show schema + data preview + profile.
- Composer (`src/lib/composer.ts`) now trusts AI visualization hints for KPI_CARD and STAT_ROW instead of overriding them with heuristics.

**Key design decisions**:
- Schema deduplication: when the AI calls get_schema(dataset=X) then get_schema(dataset=X, table=Y), only the table-level result is shown. The dataset-level call is treated as preparatory.
- Text fallback only fires if zero structured envelopes were built.

**Derived rule**: Every successful tool call produces a visible card. The system does not pick winners.

---

## 2026-07-27: Auth errors now propagate from agent loop instead of being swallowed

**What broke**: When a BigQuery tool call returned a 401 inside the agent loop, the loop caught the error and fed it back to the LLM as a function response. The LLM composed a polite response about "authentication issue" with a "Credentials Expired" chip. The user saw this in the output area with no way to re-authenticate.

**Root cause**: `loop.ts` catch block (line ~330) treated all tool errors the same -- catching them and feeding the error message back to the LLM. Auth errors need to propagate to the UI layer's `withAuthRetry` wrapper in `useChatOrchestration.ts`, which handles token refresh + retry, or shows the `ErrorCard` with a "Sign in and continue" button.

**Fix**: Added `looksLikeAuthError()` function to `loop.ts` that matches the same patterns as `useChatOrchestration.ts`. Both the `result.error` path and the `catch` block now re-throw when an auth error is detected.

**Derived rule**: Auth errors (401, expired credentials, unauthenticated) must never be handled by the LLM. They must propagate to the UI layer so the user can re-authenticate.

---

## 2026-07-27: Removal of legacy keyword router and dead skill code

**Context**: Cleaned up legacy dead code paths following the migration to the agent-loop architecture (`processWithAgentLoop`).

**Code removed**:
- `src/lib/router.ts` (keyword router) and `src/lib/__tests__/router.test.ts`
- `src/lib/self-review.ts` (legacy self-review pass)
- `src/lib/bq-tools.ts` (legacy tool definitions)
- 14 legacy skill handlers under `src/lib/skills/`: `handle-query.ts`, `handle-schema.ts`, `handle-conversation.ts`, `handle-data-quality.ts`, `handle-monitoring.ts`, `handle-discovery.ts`, `handle-data-loading.ts`, `handle-pipeline.ts`, `handle-task.ts`, `handle-governance.ts`, `handle-saved.ts`, `handle-dashboard.ts`, `handle-data-management.ts` (with `executeConfirmedOperation` extracted to `execute-confirmed.ts`)
- Dead response schemas from `src/lib/gemini-client.ts` (`SchemaResponseSchema`, `SelfReviewResponseSchema`, `DataManagementResponseSchema`, `MonitoringIntentSchema`, `DqIntentSchema`, `DiscoveryResponseSchema`, `DataLoadingIntentSchema`, `IntentClassifierSchema`, etc.) and `SKILL_NAMES` import.

**Current structure**:
- `src/lib/skills/` contains only `schema.ts`, `execute-confirmed.ts`, and `index.ts`.
- Active flow: User message -> `chat-orchestrator.ts` -> `processWithAgentLoop()` (`src/agent/index.ts`) -> tools (`src/agent/tools/`) -> `compose()` (`src/lib/composer.ts`) -> UI rendering.

**Derived rule**: Rely exclusively on the agent loop and tool definitions for request routing and execution. Do not maintain unused legacy schemas or skill handlers.

---

## 2026-07-27: Duplicate progress messages in status area

**Context**: The progress area showed repetitive identical messages (e.g. "Query running..." appearing 3-4 times in the breadcrumb trail). Four sources of duplication were identified.

**Root causes**:
1. BigQuery polling loop in `bq-tools.ts` emitted "Query running..." every 1.5s with identical text.
2. `gemini-client.ts` emitted `onStatus` before checking the tool call cache, so cached calls still produced progress messages.
3. `useChatOrchestration.ts` appended every status message unconditionally to `liveSteps` without checking for consecutive duplicates.
4. Neither `QueryProgressPanel` nor `ResultsSidebar` filtered consecutive duplicates at display time.

**Fix applied**: Four-layer fix:
- `useChatOrchestration.ts`: Skip appending to `liveSteps`/`pendingStepsRef` when text matches the last entry.
- `gemini-client.ts`: Move `onStatus` call after the cache check (cached calls emit nothing).
- `ChatThread.tsx` `QueryProgressPanel`: Filter consecutive duplicates in `priorSteps`.
- `ResultsSidebar.tsx`: Filter consecutive duplicates in thinking steps accordion.

**Derived rule**: Progress message deduplication should happen at the collection layer (hook) as primary defense, with display-layer deduplication as a safety net.

---

## 2026-07-27: Clicking table row re-shows dataset listing instead of table schema

**Context**: After the schema-to-SchemaView reconnection, clicking a table row (e.g., "drivers" in formula_1) sent "Show me more about formula_1.drivers" but the response showed the same dataset-level table listing instead of the table's column schema.

**Root cause**: Lines 445-455 of `src/agent/index.ts` had logic that explicitly preferred dataset-scope events over table-scope events. When the agent called both `get_schema(dataset='formula_1')` and `get_schema(dataset='formula_1', table='drivers')` in the same turn, the code picked the dataset-scope event and called `fetchSchema('formula_1', undefined, project)`, producing a dataset-level SchemaView.

**Fix applied**: Reversed the preference. Now prefers the most specific scope (table > dataset > project). When a table-scope event exists, it's used for the envelope. The agent typically drills down from dataset to table, so the table result is the user's actual answer.

**Derived rule**: **Schema envelope scope preference: most specific wins.** Always prefer table-scope events over dataset-scope events. The agent fetches dataset schema as a precursor to table schema, not as the final answer.

---

## 2026-07-27: Three quick wins from CA skills analysis

**Context**: After analyzing Google's internal Conversational Analytics skills system, identified three low-risk improvements: visualization row budget, SQL error rewrite recipes, and smarter follow-up chip suggestions.

**Changes**:
1. `flash.ts` -- Added VISUALIZATION BUDGET rule (1000-row cap for charts), specific SQL error fix recipes (column not found, ambiguous reference, resources exceeded, access denied), and biased follow-up instructions (forecast for time-series, root-cause for declines, map for geographic data).
2. `result-quality.ts` -- Added `HIGH_ROW_COUNT` quality flag type and `checkHighRowCount()` function. Fires when query returns >1000 rows.

**Derived rules**:
- Prompt-only changes are the safest improvement vector -- they don't touch code paths, only influence model behavior.
- Quality flags should be additive (new types), never modify existing flag logic.
- Follow-up bias should guide the model toward analytical depth, not dictate specific suggestions.

---

## 2026-07-27: Query results showing as schema views (priority bug)

**Context**: When the user asked "top 10 products by revenue from order_items in ecomm", the app showed "Tables in ecomm" instead of query results. The agent was calling `get_schema` first (to discover columns) then `run_query`, but the schema result was displayed instead of the query result.

**Root cause**: In `index.ts` envelope builder, the `schemaEvents.length > 0` check came BEFORE `queryEvents.length > 0` and had no guard against query events. The DML, pipeline, and export branches all had `&& queryEvents.length === 0` guards, but schema did not.

**Fix**: Moved query event check above schema event check. Added `&& queryEvents.length === 0` guard to schema branch. Now query results always take priority over schema exploration.

**Derived rules**:
- Every `else if` branch in the envelope priority chain MUST have a `queryEvents.length === 0` guard (except query itself). Query is what the user asked for; everything else is context-gathering.
- When adding new tool types to the envelope builder, add them BELOW query but ABOVE the text fallback.

---

## 2026-07-27: Query results rendering as text (result_id truncation bug)

**Context**: Even after fixing priority order, some queries (like "top 10 products") still rendered as plain text instead of charts/tables. The agent ran `run_query` successfully but the result cache lookup failed.

**Root cause**: The `detail` field on `StepEvent` was `JSON.stringify(contextData).slice(0, 500)`. For result sets with long column names or many rows, the JSON was truncated at 500 characters, cutting off the `result_id` that the envelope builder needed to retrieve the cached result from IndexedDB.

**Fix**: Added a dedicated `result_id` field to `StepEvent` interface. The loop now stores `result_id` directly on the event (not inside the truncated detail string). The envelope builder reads `event.result_id` first, falling back to parsing detail for backward compatibility.

**Derived rules**:
- Never rely on parsing truncated JSON for critical data. If a value is needed downstream, give it its own field.
- The `detail` field is for human-readable debugging info; machine-readable fields go on the event object directly.



## 2026-07-26: Wordy headline from present_result

**Context**: When the user asks "list my datasets", the headline shows the AI's chatty narration ("I have retrieved the list of datasets available in your malloy-data project. You have 13 datasets, including ecomm, faa, formula_1, imdb, iowa_liquor_sales, and several sandbox or test env") instead of a concise title like "13 datasets in project malloy-data".

**Root cause**: The `present_result` tool's `title` parameter was optional with a vague description ("Headline for the presented content"), so the AI often omitted it. The fallback used `result.text.split('\n')[0]` -- the first line of the AI's conversational prose, which is always chatty narration that restates the request.

**Fix applied**: Made `title` required on `present_result` with a descriptive instruction and examples (matching the quality of `run_query`'s `result_title`). The description explicitly says: describe the content, not how you got it. Examples: "13 datasets in project malloy-data", "Tables in ecomm", "Top sales by category in the USA". The agent/index.ts headline code was simplified to trust the AI's title with a minimal fallback chain.

**Derived rules**:
- **Never use `result.text` as a headline fallback**: The AI's conversational text always restates the request ("I have retrieved...", "Here are the..."). Headlines should describe what the data shows, not narrate the action taken.
- **Fix headline problems through the AI, not mechanical derivation**: Making `title` required with good examples is better than counting items in code. The AI understands context (project name, dataset scope) that mechanical code would need to reconstruct.
- **Tool parameter descriptions need examples**: A vague description like "Headline for the presented content" gets vague output. Examples like "13 datasets in project malloy-data" show the AI exactly what quality to target.

---

## 2026-07-25: Agent v2 loop producing plain text for schema operations

**Context**: The v2 agent loop (`processWithAgentLoop` in `src/agent/index.ts`) produced `CONVERSATION` (plain text) envelopes for all non-query tool results. Schema operations ("list my datasets", "show tables in X") rendered as raw text bullets instead of the rich interactive SchemaView.

**Root cause**: The post-loop envelope construction in `processWithAgentLoop()` only had wiring for `run_query` results (routed through `compose('query', ...)`) and destructive SQL (CONFIRMATION_CARD). Everything else fell through to `buildTextEnvelope()` which wrapped the LLM's prose summary in a bare CONVERSATION envelope. The structured data from `get_schema` and `list_resources` tool calls was consumed by the LLM during the loop but discarded for UI composition.

**Fix applied**: Added a 4th priority tier in the envelope construction chain. After checking for queries (which take priority because schema fetches are often context-gathering for queries), scan events for successful `get_schema`/`list_resources` calls. Extract the tool args, call `fetchSchema()` (cache-warm from the loop), and route through `compose('schema', schemaResult)` to produce a SCHEMA_VIEW envelope. Also created `ConversationRenderer.tsx` to make remaining text responses interactive (clickable entity chips, styled entity card lists).

**Derived rules**:
- **Every new agent tool must have a corresponding envelope builder**: When adding a tool to the Phase 0 belt, also add a result-to-envelope mapping in `processWithAgentLoop()`. Defaulting to `buildTextEnvelope()` discards structured data.
- **Query results take priority over schema results**: Schema fetches are often precursors to queries. Only build a SCHEMA_VIEW when schema was the terminal action.
- **CONVERSATION text should never be raw**: Even pure conversational responses should render entity references as interactive elements via ConversationRenderer.

---

## 2026-07-25: Recent dataset/table chips not showing in empty state

**Context**: User reported that recent dataset/table chips no longer appear in the main chat area when starting a new conversation. The chips are rendered in the empty state when `activeProject && recentItems.length > 0`.

**Root cause**: `getRecentDatasets()` reads ALL conversations from a single Firestore document (`users/{uid}`) by calling `getConversations()`. As conversations accumulated (with full envelope data including query results, chart data, etc.), the document likely approached or exceeded Firestore's 1MB document size limit. The read either failed silently (swallowed by `.catch(() => {})`) or returned successfully but took too long for the user to see the chips before interacting. Additionally, the recents were only fetched once on component mount (`[user]` dependency), never refreshed after new conversations produced new envelopes.

**Fix applied**:
1. `firestore-service.ts`: Added localStorage-based cache (`hdn_recent_items`) for recent items. New functions: `getRecentItemsFromCache()` (sync read), `updateRecentItemsFromEnvelopes()` (merge new envelope data into cache). `getRecentDatasets()` now reads localStorage first (instant), falls back to Firestore mining only when localStorage is empty (one-time backfill).
2. `page.tsx`: Initialize `recentItems` state from localStorage synchronously via `useState(() => getRecentItemsFromCache())` so chips appear immediately. Firestore backfill only runs if cache is empty. Added effect on `chat.messages` to update the cache whenever new envelopes arrive.

**Derived rules**:
- **Recent items must use localStorage, not Firestore mining**: The single-document storage model cannot support reading all conversations on every page load. localStorage gives instant access with zero network cost.
- **Never use `.catch(() => {})` on data-loading promises**: Silent error swallowing makes bugs invisible. Always log at minimum.
- **Single Firestore document is a scaling risk**: Everything stored in `users/{uid}` (conversations, preferences, favorites, saved work) will eventually hit the 1MB limit. Future work should migrate conversations to subcollections.

---

## 2026-07-24: Gemini 3.5 Flash thought_signature 400 error

**Context**: All function-calling requests started returning 400 errors: "Function call is missing a thought_signature in functionCall parts."

**Root cause**: Gemini 3.5 Flash now attaches a `thoughtSignature` field to each `functionCall` part in model responses. This signature must be echoed back in the conversation contents for the next turn. Both code paths (legacy `callGeminiWithTools` adapter path and v2 agent `loop.ts`) were synthetically reconstructing the model's function-call turn from just `{ name, args }`, discarding `thoughtSignature`.

The direct SDK path in `callGeminiWithTools` (lines 284-286) already preserved raw `candidate.content.parts`, so it was unaffected. Only the adapter-based paths were broken.

**Fix applied**:
1. `model-adapter.ts`: Added optional `rawModelParts` to `AdapterResponse` `tool_calls` variant.
2. `firebase-ai-adapter.ts`: Extract `candidate.content.parts` after `generateContent` and return as `rawModelParts`.
3. `loop.ts`: Use `response.rawModelParts` when available instead of synthetic reconstruction.
4. `gemini-client.ts`: Same change in the adapter path of `callGeminiWithTools`.

**Derived rule**: When appending model function-call turns to the `contents` array, always use the raw parts from the API response rather than reconstructing from extracted fields. Raw parts contain opaque fields (`thoughtSignature`, etc.) that the API requires on subsequent turns. Added to invariants.

---

## 2026-07-22: Save button on artifact output not persisting to content library

**Context**: User reported clicking the save button on an artifact in the output, filling in the SaveModal, and clicking Save, but the item not appearing in the content library (Content > All or Content > Queries).

**Root cause**: Firestore SDK v9+ throws `FirebaseError: Function setDoc() called with invalid data. Unsupported field value: undefined` when any field in the written object has an `undefined` value. The `handleSaveConfirm` function passed several potentially-undefined fields:
- `project: activeProject || undefined` (explicitly undefined)
- `cachedSql: env.provenance?.sql` (undefined when no SQL)
- `visualizationType: env.primaryArtifact?.type` (undefined when missing)
- `parameters: env.extractedParameters` (undefined when no params on step)

The Firestore `setDoc` call threw on these undefined values. The error was caught by `catch(err)` which only called `console.error` -- invisible to the user. The modal closed, giving the false impression the save succeeded.

**Additional fix**: Firestore security rules used `match /users/{uid}/{document=**}` which did not cover the root `/users/{uid}` document. Split into `match /users/{uid}` + nested `match /{document=**}`.

**Fix applied**:
1. `saved-work.ts`: Added `stripUndefined()` helper that recursively removes keys with `undefined` values from objects/arrays. Applied to `saveArtifact`, `updateArtifact`, and `publishArtifact` before any `setDoc` call.
2. `firestore.rules`: Split rule to cover both root document and subcollections.
3. `handleSaveConfirm`: Uses `saveModalRef` for reliable state access. Shows chat error messages on failure.

**Rules derived**:
- **Always strip undefined values before Firestore writes.** The `stripUndefined()` helper in `saved-work.ts` must be used on any object passed to `setDoc()` or `updateDoc()`. Firebase SDK v9+ does not have `ignoreUndefinedProperties` enabled by default.
- Firestore's `{document=**}` wildcard matches one or more segments, not zero. Always add a separate rule for the root document.
- Never catch Firestore write errors silently. User-facing operations must surface errors.

---




## 2026-07-21: Fix map tooltip, missing year filter, and invented region data

**Context**: User prompted "show population by country in a bar chart with a year filter" and saw three bugs: (1) map tooltip appeared in the bottom-left corner instead of following the mouse, (2) chart view had no year filter dropdown despite "with a year filter" in the prompt, (3) results showed invented aggregate categories ("World", "Asia", "Upper-middle-income countries") that don't exist in the table data.

**Root causes**:
1. **Tooltip**: `ChoroplethTooltip` uses `position: fixed` with `e.clientX/clientY` but is rendered inside a container with `overflow: hidden`. If any ancestor has a CSS `transform` (e.g., from animation `forwards` fill), it creates a new containing block for `position: fixed`, causing the tooltip to be positioned relative to the ancestor rather than the viewport.
2. **Missing filter**: The LLM sometimes fails to produce the required `WIDGET_SPEC_START...WIDGET_SPEC_END` block when the user asks for a filter, falling back to a plain chart. The prompt had the rule but lacked a concrete example for the most common case (integer year dropdown on population data).
3. **Invented regions**: The LLM fabricated aggregate categories ("World", "Asia", etc.) that weren't in the source data. The prompt had no rule forbidding this.

**Changes**:
- `src/components/charts/map-charts.tsx`: Render `ChoroplethTooltip` via `createPortal(... , document.body)` so it escapes all ancestor positioning/overflow constraints.
- `public/skills/query.md`: Added concrete WIDGET_SPEC example for "population by country with a year filter" (DROPDOWN, INT64 year, BAR_CHART). Added rule: "NEVER fabricate or invent aggregate categories the data does not contain."
- `src/lib/skills/handle-query.ts`: Added `tryAutoConstructWidget()` fallback using schema-driven heuristics. When the LLM produces a query with no WHERE clause and the table schema contains a DATE/TIMESTAMP or numeric column, the code auto-constructs a DROPDOWN widget -- no keyword or phrase matching involved. It extracts the table reference from the executed SQL, builds parameterized SQL with a WHERE clause, fetches distinct values via optionsSql, and returns a full InteractiveWidgetData envelope.

**Rules derived**:
- Tooltips using `position: fixed` must be rendered via React Portal when they live inside scrollable/clipped/animated containers.
- The LLM prompt must explicitly forbid fabricating data. "Query real columns and return real values" is now an explicit rule.
- Concrete examples in skill docs improve LLM compliance but are not sufficient alone. Critical output formats (like WIDGET_SPEC) need code-level fallbacks.
- Never use keyword or phrase matching to detect user intent for features. Schema-driven heuristics (checking query structure + column types) are deterministic and work regardless of how the user phrases their request.

---

## 2026-07-18: Geographic data defaults to bar/column chart, map via toggle

**Context**: User prompted "show the population by country with a filter for year" and got a choropleth map with no year filter. Two root causes: (1) `viz-intent.ts` had `/\bby country\b/i` as an explicit WORLD_MAP pattern, which hijacked the intent before the LLM could produce a widget spec with a year dropdown. (2) The composer's `inferVisualizationType()` auto-detected country/state columns and forced map types.

**What broke**: "by country" is an ambiguous phrase -- it can mean categorical grouping (like "by month") or geographic mapping. Treating it as an explicit map request prevented the interactive widget flow from activating, which is why the year filter was missing.

**Changes**:
- `viz-intent.ts`: Removed `by country`, `each country`, `by state` from explicit map intent patterns. Explicit map-requesting phrases ("world map", "show map", "choropleth") still work.
- `composer.ts`: Disabled Step 3 (geographic auto-detection) in `inferVisualizationType()`. Geographic data now falls through to categorical chart selection.
- `ArtifactCard.tsx`, `InteractiveWidgetView.tsx`: Added a third "Map" option to the Chart/Table segmented control. Appears only when `classifyColumns()` detects `geo-state` or `geo-country` roles. Uses `detectChoroplethType()` to pick USA_MAP vs WORLD_MAP.

**Derived rule**: Ambiguous phrases like "by X" where X is a geographic entity should be treated as categorical grouping, not map requests. The map should be available via UI toggle, not forced by default. Only phrases that explicitly name a map visualization ("world map", "show on a map") should trigger map intent.

---


**Context**: Follow-up to the INTERACTIVE_WIDGET enum fix. The broader problem: the widget parsing had a double-condition gate (`widgetSpecMatch && captured.visualizationHint === 'INTERACTIVE_WIDGET'`) that silently dropped filter controls whenever either condition failed. This is a pattern of not trusting AI output -- requiring redundant confirmation signals.

**Root pattern**: The codebase has accumulated keyword-based routing, regex intent detection, and double-gating patterns that undermine the AI's ability to interpret user prompts. These have failed repeatedly: every keyword fix breaks other cases, every rigid skill doc rule creates false dichotomies.

**Changes**:
- `src/lib/skills/handle-query.ts`: Removed the `captured.visualizationHint === 'INTERACTIVE_WIDGET'` condition from the widget parsing gate. If the AI produced a WIDGET_SPEC block, that's sufficient -- the JSON parse and field validation that follow are the real safety checks.
- `AGENTS.md`: Added `ai-first-architecture` rule section that explicitly bans keyword-based intent classification and documents the correct patterns for fixing misinterpretation.
- `.agents/knowledge/invariants.md`: Replaced the keyword router invariants with AI-first architecture invariants. Added "Trust AI output without double-gating" and "NEVER write rigid either/or rules in skill docs" as hard rules.

**Rules derived**:
- If the AI produced a structured result, trust it. Don't require a second signal to confirm.
- Never add keywords, regex patterns, or signal arrays to fix a routing problem. Fix the AI's prompt/schema/tools instead.
- Never write rigid rules in skill docs that prevent the AI from handling nuance.

---

## 2026-07-18: INTERACTIVE_WIDGET missing from run_query tool enum

**Context**: User asked "show the top countries by population with a filter for year" and got a plain bar chart with no year filter control. The interactive widget mode never triggered.

**Root cause**: Two issues:
1. The `run_query` tool declaration in `bq-tools.ts` defined `visualizationHint` as an enum that did NOT include `INTERACTIVE_WIDGET`. The Gemini function-calling API enforces enum constraints, so the LLM could never set `visualizationHint: "INTERACTIVE_WIDGET"` even though the skill doc instructed it to. The widget spec parsing code in `handle-query.ts:380` requires `captured.visualizationHint === 'INTERACTIVE_WIDGET'`, which could never be true.
2. The skill doc (`query.md`) had an anti-widget guard that blocked widget mode for "top N" queries unconditionally, even when the user explicitly asked for a filter control.
3. The router's `hasFilterPhrase` regex did not include `for` in its alternatives, so "filter for year" didn't match the fast-path filter pattern (though it still routed correctly via scored signals).

**Fix**:
- `src/lib/bq-tools.ts`: Added `'INTERACTIVE_WIDGET'` to the `visualizationHint` enum.
- `public/skills/query.md`: Relaxed the anti-widget guard to allow widget mode when the user explicitly asks for a filter alongside "top N".
- `src/lib/router.ts`: Added `for` to the `hasFilterPhrase` regex alternatives.

**Rule derived**: When adding a new value that the LLM must be able to set on a tool parameter, the value must be added to the tool declaration's enum. Prompt-level instructions alone are insufficient when the API enforces enum constraints.

---

## 2026-07-18: Cloud Function proxy replaced with Firebase AI Logic SDK

**Context**: The `geminiProxy` Cloud Function consistently returned 403 Forbidden because the org-level IAM policy blocks `allUsers` invoker bindings on Cloud Run services. Firebase CLI v13+ forcefully deploys all Cloud Functions as 2nd Gen (Cloud Run), making the proxy permanently unreachable through Firebase Hosting rewrites. Downgrading to CLI v12 / SDK v5 failed due to Node 22 runtime and peer dependency conflicts.

**What worked**: Migrated to Firebase AI Logic (`firebase/ai`) SDK. The client calls `getGenerativeModel()` + `generateContent()` directly, using the Firebase API key for authorization. No custom proxy, no Cloud Run, no IAM issue.

**Changes**:
- `src/lib/gemini-client.ts`: Replaced all `fetch('/gemini-proxy')` calls with `firebase/ai` SDK calls. Removed `getFirebaseIdToken()`. Added lazy Firebase AI initialization via `getAI(app, { backend: new GoogleAIBackend() })`.
- `src/lib/firebase.ts`: Exported `app` for use by AI Logic SDK.
- `.env.local`: Added `NEXT_PUBLIC_FIREBASE_APP_ID` and `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`.
- `firebase.json`: Removed `/gemini-proxy` rewrite.
- Deleted the deployed `geminiProxy` Cloud Function via `firebase functions:delete`.

**Rules derived**:
- Firebase AI Logic SDK bypasses all Cloud Function IAM issues. Use it instead of custom proxies when the org policy blocks public Cloud Run access.
- The `functions/` directory still exists but is not deployed. If Cloud Functions are needed in the future, the org IAM policy must be addressed first.
- Deploy command is now `--only hosting` (no functions).

---

## 2026-07-16: Security and consistency overhaul

**Context**: Code review identified 8 issues: hardcoded secrets, client-side API key, contradictory deployment config, dead refresh-token code, regex escaping bug, no unit tests, hardcoded paths, stale README.

**Key decisions**:
- Gemini API key moved server-side via Cloud Function proxy (not Vertex AI or Firebase AI Logic SDK). Client sends Firebase ID token to `/gemini-proxy`; function verifies and forwards with API key.
- OAuth scopes narrowed from `cloud-platform` to `bigquery` + `spreadsheets` + `devstorage.read_write`. Users see one-time re-consent.
- Refresh token scheme (setRefreshToken/getRefreshToken/refreshAccessTokenSilently) was all dead code; `/api/auth/refresh` never ran in production due to static export. Removed entirely.
- `src/app/api/` directory was dead code under `output: 'export'`. Deleted.
- Docker/Cloud Run files moved to `deploy-alternatives/cloud-run/` for reference.

**Rules derived**:
- Always check if `output: 'export'` is set before adding API routes -- they silently get excluded from the build.
- The `AuthState` interface should not carry vestigial properties (bqRefreshToken, setBqTokenState) as no-ops. If a feature is removed, clean the interface.
- Column names in RegExp constructors must be escaped via `escapeRegExp()` from `regex-utils.ts`.

---

## 2026-07-16: Fix raw JSON dump on Regenerate (INTERACTIVE_WIDGET leak)

**Symptom**: Clicking Regenerate on a "show population over time with a country filter" query displayed raw JSON (`{"skill":"query","sql":"...","columns":[...],"rows":[...]}`) instead of a chart or table.

**Root cause**: Two-part:
1. The query handler LLM can return `suggestedVisualization: 'INTERACTIVE_WIDGET'` in a non-widget context (when the user asks for a filter but the query is too coarse for a widget). `inferVisualizationType()` in `composer.ts` trusted any non-TABLE `suggestedVisualization` value from the LLM, including `INTERACTIVE_WIDGET`. This caused `composeQuery()` to set `primaryArtifact.type = 'INTERACTIVE_WIDGET'` without also setting `presentation: 'custom'` (that only happens in the early-return widget path that checks for `widgetData`). The resulting envelope hit the `default` case in the `Artifact` switch in `ArtifactCard.tsx`, which `JSON.stringify`'d the `QueryResult` data.
2. The `default` case in `Artifact`'s switch was a raw JSON dump — fully visible to users.

**Fix**:
- `composer.ts` `inferVisualizationType()`: Added `NON_CHART_VIZ_TYPES = Set(['TABLE', 'INTERACTIVE_WIDGET', 'KPI_CARD', 'STAT_ROW'])` and skipped the LLM hint for values in that set, falling through to heuristics instead.
- `ArtifactCard.tsx` `Artifact` default case: Replaced JSON dump with a DataTable fallback (when data has rows/columns) and a `console.warn`. Zero user-visible raw JSON even if a future unknown type slips through.

**Why it happened on Regenerate specifically**: The initial run likely returned a different `suggestedVisualization` (or the self-review produced a good viz). On Regenerate, without conversation context, the LLM returned `INTERACTIVE_WIDGET` as a hint.

**Rule**: `inferVisualizationType()` must never trust `INTERACTIVE_WIDGET`, `KPI_CARD`, or `STAT_ROW` from the LLM hint path -- these require the full query path heuristics or special-case early returns with `widgetData`. The `Artifact` switch `default` case must never produce raw JSON.

---



**What changed**: Replaced the single-line spinner + status text with a `QueryProgressPanel` that shows (A) elapsed time, (B) a breadcrumb log of prior steps, and (D) live BigQuery job state during `run_query`.

**Key technical points**:
- `executeQuery` in `bigquery-client.ts` was switched from the synchronous `/queries` endpoint to `POST /jobs` + poll loop (every 1.5s), identical to `executeDml`. After DONE, results are fetched from `/queries/{jobId}?maxResults=1000&timeoutMs=0`.
- An `onJobProgress` callback threads from `bigquery-client` → `run_query` tool → `handle-query` / `handle-conversation` → `gemini-client` toolExecutor → orchestration hook → UI.
- `useChatOrchestration` now maintains `liveSteps` (accumulated steps visible during loading) and `loadingStartTime` (epoch ms for timer). Both are reset on load start and cleared in all finally blocks.
- `QueryProgressPanel` is defined in `ChatThread.tsx` and exported for reuse in `ResultsSidebar.tsx`.
- The `StatusCallback` type (`string | StepInfo`) was propagated up through `gemini-client.ts`, `bq-tools.ts`, `handle-query.ts`, and `handle-conversation.ts` toolExecutor signatures.

**Rule**: `executeQuery` is now async-job-based. Do not revert it to the synchronous `/queries` endpoint. If polling causes issues, fix the poll logic, not the job submission.

---

## 2026-07-16: Iteration cap raised to 30, terminateAfter on DML tools, graceful MAX_ITERATIONS sentinel

**What changed**: `handle-conversation.ts` now passes `maxIterations: 30` and `terminateAfter: ['execute_dml', 'create_dataset']` to `callGeminiWithTools`. The exhausted-cap sentinel was changed from a user-visible string to `__MAX_ITERATIONS_REACHED__`; the caller converts it to a friendly message.

**Rule**: The dedupe cache in `callGeminiWithTools` (identical calls are never re-executed) is the real runaway guard — a high iteration cap is safe. `terminateAfter` ensures the agent exits as soon as a terminal action succeeds rather than spinning for another LLM round.

---

## 2026-07-16: Fix "Reached maximum tool-call iterations" on de-dupe and multi-step tasks

**Symptom**: User asked to de-duplicate table rows and received "Reached maximum tool-call iterations." The conversation agent was hitting the 8-iteration cap before completing the task.

**Root cause**: `handleConversation()` had no `terminateAfter` — unlike `handleQuery()` which exits immediately after `run_query` succeeds. A de-dupe task needs at minimum: schema fetch + count preview + execute_dml = 3 tool-call iterations, often more if the agent does exploratory calls first. With a hard cap of 8 and no code-level exit, complex tasks exhausted the budget.

Secondary issue: when the cap was hit, the raw internal string `'Reached maximum tool-call iterations.'` was surfaced directly to the user with no context or guidance.

**Fix**:
- `callGeminiWithTools()`: replaced `'Reached maximum tool-call iterations.'` with sentinel `'__MAX_ITERATIONS_REACHED__'` so callers can detect and handle it.
- `handleConversation()`: raised `maxIterations` from 8 to 30. The deduplication cache (identical tool calls are never re-executed) is the real runaway guard. An arbitrary low cap is the wrong abstraction.
- `handleConversation()`: added `terminateAfter: ['execute_dml', 'create_dataset']` — loop exits by code immediately after a terminal tool succeeds, not by LLM discretion.
- `handleConversation()` system prompt: added rules 7 and 8 — skip schema fetch if schema is already in context; for de-dupe write the SQL directly and call execute_dml once.
- `handleConversation()`: sentinel is caught and converted to a user-friendly message explaining what happened and what to try.

**Rule**: The iteration cap is a runaway guard, not a task budget. The real protection against infinite loops is the deduplication cache. `terminateAfter` is the right way to guarantee loop exit at task completion — prompt instructions alone are probabilistic.

---

## 2026-07-16: Non-numeric columns plotted as chart bars (dataset_id, table_id, last_modified)

**Symptom**: Bar chart for a metadata query (e.g. `INFORMATION_SCHEMA.TABLES`) showed a giant single-color blob with string columns like `dataset_id`, `last_modified`, and `table_id` listed in the legend alongside actual numeric columns like `size_bytes` and `row_count`.

**Root cause**: `resolveAxes()` in `chart-utils.ts` defaulted `yKeys` to every column that wasn't the x-axis. It had no awareness of column types, so string, date, and ID columns were all handed to Recharts as numeric series. Recharts coerced them to `NaN` / 0, producing nonsensical bars.

**Fix**:
- `src/components/charts/chart-utils.ts`: `resolveAxes()` now accepts an optional `rows` parameter and runs `classifyColumns()` to identify `'measure'` (numeric) columns. Only those are used as yKeys. Falls back to all non-x columns only if no numeric columns exist (so purely-string results still render rather than crashing).
- `src/components/charts/recharts-charts.tsx`: `useChartSetup()` passes `rows` to `resolveAxes()`.

**Rule**: `resolveAxes()` must never include non-numeric columns in `yKeys` by default. Always run `classifyColumns()` to filter. Only override with explicit `yAxis` from the query result.

---

## 2026-07-15: Wrong country data + single line chart for multi-series queries

**Symptom**: "show the population of China and USA over time" returned Aruba rows in the table and a single line chart instead of two lines.

**Root causes**:

1. **Wrong data (Aruba)**: `query.md` had no explicit rule requiring `IN (...)` filters when the user names multiple entities. The LLM was generating SQL without a WHERE clause (or with a broken single-value filter), returning all countries alphabetically. Aruba appeared first. The headline "Aruba leads China by 2.0K in Year" confirmed the visualization layer was treating `year` as the metric (wrong axis assignment from the 3-column long-format schema).

2. **Single line instead of two**: The query correctly returned long-format data: `[country, year, population]`. `resolveAxes()` treated column[0] (`country`) as xKey and `[year, population]` as yKeys — so the chart drew two lines (year values and population values), but year values are tiny (~1960) relative to population (billions), making one line invisible. The real fix is to pivot long-format data to wide format before rendering: `[year, China, United States]` with one row per year.

**Fixes**:
- `public/skills/query.md`: Added explicit rule — when user names multiple specific entities, always use `IN (...)` with case-insensitive matching, add common name variants, never omit the filter.
- `src/components/charts/chart-utils.ts`: Added `pivotLongFormat()` — detects long-format data (3 columns, category col with 2–20 unique values and cardinality < 50% of row count) and pivots to wide format.
- `src/components/charts/recharts-charts.tsx`: `LineChartRenderer` and `AreaChartRenderer` now use `useChartSetupWithPivot()` which applies the pivot before rendering.

**Rule**: Long-format multi-series data `[category, x, metric]` must be pivoted to wide format before chart rendering. The pivot heuristic: exactly 3 columns, first column has 2–20 unique values AND cardinality < 50% of row count.

---

## 2026-07-15: Fix "Reached maximum tool-call iterations" on simple data queries

**Symptom**: User gets "Reached maximum tool-call iterations" after a query runs and returns results. The query DID succeed (data visible in the card) but the LLM kept calling additional tools, exhausting the 10-iteration cap before producing a text response.

**Root cause**: `callGeminiWithTools()` relies on the LLM to stop calling tools once it has the data it needs. The system prompt says "STOP after run_query succeeds" but the LLM occasionally makes additional exploratory tool calls (another `get_table_schema`, a `list_tables`). With only 10 iterations and no code-level enforcement, simple queries could exhaust the cap.

**Fix**: Added `terminateAfter?: string[]` to `CallGeminiWithToolsArgs`. When set, the loop exits immediately after any of the named tools succeeds — before feeding results back for another LLM round. `handleQuery()` sets `terminateAfter: ['run_query']`. The LLM's pre-call text (including WIDGET_SPEC blocks) from that same response is still captured and returned. Also raised `handleQuery()` cap from 10 to 15 (complex widgets legitimately need: schema fetch + base query + options fetch = 3+ rounds).

**Files changed**:
- `src/lib/gemini-client.ts`: Added `terminateAfter` option; default cap raised from 6 to 8
- `src/lib/skills/handle-query.ts`: `maxIterations: 15`, `terminateAfter: ['run_query']`

**Rule**: Never rely only on a prompt instruction to guarantee loop termination. Prompt instructions are probabilistic. Use `terminateAfter` for hard code-level loop control.

---

## 2026-07-15: Replaced Google Maps choropleth with react-simple-maps SVG

**Root cause (days of debugging)**: Google Maps Data Layer + GeoJSON fetch is inherently async. The `useEffect` deps array included `valueMap` (a new object every query result). This caused the effect to re-fire after data loaded, creating a second Maps instance on the same DOM element. The first GeoJSON fetch attached to the abandoned first instance; the second fetch completed correctly but by then the data was loaded. Even when split into two effects, the browser couldn't render country fills reliably through the Data Layer API.

**Fix**: Replaced both `WorldMapRenderer` and `USAMapRenderer` with `react-simple-maps` SVG choropleth:
- `ComposableMap` + `Geographies` + `Geography` render all countries as `<path>` SVG elements synchronously
- `fill` is computed directly as a JavaScript value — no async, no Google Maps styling API
- World map uses `geoNaturalEarth1` projection; US map uses `geoAlbersUsa` (repositions AK/HI)
- Both load local GeoJSON files from `public/`: `world-countries.geojson` (819KB), `us-states.geojson` (87KB)
- GeoPointMapRenderer (DOT_MAP) still uses Google Maps — it needs actual map tiles for lat/lng scatter

**.npmrc**: Added `legacy-peer-deps=true` so Cloud Build installs `react-simple-maps` without requiring a flag. `react-simple-maps@3.0.0` lists React <19 as peer dep but is compatible.

**Rule**: For choropleth maps, always use SVG-based rendering (react-simple-maps, d3-geo, or similar). Never use Google Maps Data Layer for this purpose — it has no synchronous fill API.

---

## 2026-07-15: AI-driven dashboard builder + tab navigation

**Feature**: User asks "create a dashboard showing X, Y, Z" in chat. The dashboard skill handler generates SQL for each tile, fetches initial data, saves to Firestore, and returns a `DASHBOARD_VIEW` artifact card. Clicking "Open Dashboard" opens a new tab in the main view without losing the chat context.

**Architecture decisions**:
- `page-context.tsx` extended from a single `activePage` string to a full tab system (`tabs: AppTab[]`, `activeTabId`). Chat tab is always present and not closeable.
- Dashboard tabs are stored by id `dashboard:{dashboardId}`. Multiple can be open simultaneously.
- `TabBar` component renders only when `tabs.length > 1` (no visual noise when only chat is open).
- Chat/split layout areas hide themselves when `activeTabId !== 'chat'` so dashboard fills the full content area.
- `DashboardPage` accepts `initialDashboardId` prop. When set (from tab), it auto-selects and runs that dashboard's queries on mount.

**Stale-while-revalidate**: Dashboard tiles store `lastSnapshot` (last executed result). On open, the snapshot renders instantly. Background queries run in parallel and update tiles as they complete. An `AbortController` prevents stale results from landing after the user switches dashboards.

**Skeleton loading**: New tiles that have no snapshot yet show an animated shimmer skeleton while their query runs.

**Edit mode**: Editing controls (drag handles, span controls, remove buttons, "Add tile" / "Add text") are hidden behind an "Edit" toggle button to keep the default view clean.

**Pre-existing build error fixed**: `react-simple-maps` had no `@types` package. Added `src/types/react-simple-maps.d.ts` as a declaration shim.

**Rule**: Always check that the `compose()` function result has `presentation: 'custom'` set for any artifact type handled by `CustomArtifact` dispatcher, otherwise the card renders with the default chrome instead of the custom view.

---

## 2026-07-15: Saved chart not appearing in Queries page after save

**Symptom**: User saves a chart via the save button, names it, and then navigates to the Queries page -- the new item does not appear.

**Root cause**: `SpacesPage` is permanently mounted (just hidden/shown with `display:none/flex`) so sidebar navigation is instant. Because it is never unmounted, its `loadData` `useCallback` only fires on initial mount and when its deps (`userId`, `activeTab`, `searchQuery`) change. After a save from the chat page those deps are unchanged, so `loadData` never re-runs and the page shows stale data.

**Fix**:
- Added `saveCount: number` state to `useChatOrchestration`. It increments after each successful `saveArtifact` call.
- Exposed `saveCount` from the hook and passed it as `refreshKey` to `SpacesPage`.
- `SpacesPage` accepts `refreshKey?: number` and includes it in `loadData`'s dependency array, triggering a re-fetch on every successful save.

**Rule**: Any always-mounted page that fetches on load must expose a `refreshKey` prop (or equivalent) so parent can signal that its data may be stale. Never rely solely on mount-time fetching for pages that are hidden/shown rather than unmounted/remounted.

---

## 2026-07-15: Blank world map + filter pre-selecting a value

**Issue 1 — Blank map (legend showed "Country" with 0→1 scale):**
Root cause: The LLM generated SQL with the numeric population column first and the country name column second. `resolveAxes` honored that order, making `valueKey = "Country"`. `Number("China") = NaN` → every country skipped → all grey. The 0→1 scale appeared because `maxValue: max || 1` with zero valid values.

Fix: `WorldMapRenderer` now inspects the first data row after `resolveAxes`. If `valueKey`'s data is non-numeric AND `xKey`'s data is numeric → columns are reversed → swap `safeXKey` and `valueKey`. This handles column order bugs without requiring the LLM to always get it right.

**Issue 2 — Filter dropdown pre-selected "2023" without being asked:**
Root cause: The model was choosing a "sensible default" (most recent year) rather than null. The previous prompt rule said `defaultValue` is "the pre-selected option, or null" — the model interpreted this as permission to pick a default.

Fix: Strengthened the `query.md` rule: `defaultValue` must always be `null` unless the user explicitly asked for a pre-selected value. Added specific examples of what "explicitly asked" means.

**Rule**: Map renderers should never trust column order — always validate that the resolved value column contains numeric data and the dimension column contains string data. Swap if wrong.

---

## 2026-07-15: Sample rows tab -- pagination, page size, and filtering

**What happened**: User wanted to see more than 20 rows, page through the table, and filter rows.

**Changes**:
- `src/lib/preview-client.ts`: Added `fetchTablePage()` -- builds a `SELECT * WHERE (CAST(col AS STRING) LIKE '%filter%' OR ...) LIMIT n OFFSET m` query plus a parallel `COUNT(*)` query. WHERE clause covers all non-GEOGRAPHY/STRUCT/ARRAY/JSON columns to avoid BigQuery CAST errors.
- `src/components/SchemaView.tsx`: Rewrote `SampleTab` component with: filter input (Enter to apply, x to clear), Filter button, rows-per-page selector (20/50/100/500), and first/prev/next/last pagination buttons with a `1-N of total` row range indicator. Loading overlay keeps table visible during re-fetches. Page 0 / 20 rows / no filter still uses the eagerly-fetched sampleData prop with zero extra cost.

**Rule**: The filter uses SQL LIKE on CAST(...AS STRING). This means: (1) it is case-sensitive on some BQ storage backends, (2) GEOGRAPHY/STRUCT/ARRAY/JSON columns must be excluded from the filter clause or BQ will error.

---



**What happened**: User asked "Show me the 10 most expensive BigQuery queries run in the past 7 days, with bytes billed and estimated cost." The app displayed "Reached maximum tool-call iterations." -- the LLM burned all 10 iterations without ever calling `run_query`.

**Root cause**: The query handler pre-fetches the active dataset's table list and injects it into the system prompt. For an `INFORMATION_SCHEMA.JOBS` query, there is no relevant table -- it is a region-level view. The LLM had no template for the correct syntax, so it made repeated exploratory calls (`list_datasets`, `get_table_schema`, etc.) trying to figure out how to query job history, exhausting the 10-iteration cap before ever writing SQL.

**Fix**: Added an `INFORMATION_SCHEMA.JOBS` section to `public/skills/query.md` with:
- The correct backtick form for region-level INFORMATION_SCHEMA access (`region-us.INFORMATION_SCHEMA.JOBS`)
- A ready-to-use SQL template for "most expensive queries in past N days" including cost formula
- Explicit instruction NOT to call `get_table_schema` or `list_tables` for INFORMATION_SCHEMA queries
- Notes on common region identifiers (US multi-region, EU multi-region, specific regions)

**Also fixed**: `INFORMATION_SCHEMA.MODELS` was using the wrong backtick form: `` `project.dataset.INFORMATION_SCHEMA.MODELS` `` -- this is the prohibited form per the invariants doc. Corrected to `` `project.dataset`.INFORMATION_SCHEMA.MODELS ``.

**Rule**: Any INFORMATION_SCHEMA view that is not dataset-scoped (JOBS, RESERVATION_*, etc.) needs an explicit SQL template in the skill doc. Without one, the LLM loops exhaustively trying to find the right table.

---

## 2026-07-15: Data type handling audit -- seven gaps fixed across the stack


**What happened**: Comprehensive audit of how every BigQuery column type flows through the pipeline (SQL generation, widget substitution, BQ client coercion, chart rendering).

**Fixes applied:**

1. **MULTI_SELECT numeric detection** (`InteractiveWidgetView.tsx`): MULTI_SELECT always quoted all values. If all selected values are pure integers/decimals (INT64/FLOAT64 columns), it now substitutes bare numbers. Prevents `WHERE year IN ('2020', '2021')` type errors.
2. **DROPDOWN BOOL detection** (`InteractiveWidgetView.tsx`): `true`/`false`/`TRUE`/`FALSE` dropdown values now substitute as unquoted `TRUE`/`FALSE` SQL keywords, not strings. Prevents `WHERE active = 'TRUE'` type errors on BOOL columns.
3. **Numeric regex: scientific notation** (`InteractiveWidgetView.tsx`): Extended `/^-?\d+(\.\d+)?$/` to `/^-?\d+(\.\d+)?([eE][+-]?\d+)?$/`. FLOAT64 dropdowns can produce values like `1.5e10` which were mis-classified as strings.
4. **BOOL coercion: '1'/'0' and 'True'** (`bigquery-client.ts`): BQ REST API can return BOOLEAN columns as `'1'`/`'0'`/`'True'`. Only `'true'` and `'TRUE'` were handled before.
5. **Null values in choropleth** (`map-charts.tsx`): `Number(null) === 0` in JS, so countries with null measure values were colored as the minimum-value blue instead of "no data" grey. Added explicit `== null` check before `Number()` coercion.
6. **BOOL SQL rule in prompt** (`query.md`): Added rule: BOOL/BOOLEAN columns use unquoted `TRUE` or `FALSE` in WHERE clauses — never `'TRUE'` or `1`.
7. **MULTI_SELECT scope warning in prompt** (`query.md`): MULTI_SELECT is for STRING/categorical columns only. Numeric dimensions should use DROPDOWN.

**Deferred**: BIGNUMERIC/large INT64 precision loss (requires string-value pipeline), REPEATED/ARRAY type classifier, TIME fallback heuristic. All low-frequency in practice.

**Rule**: Any new filter control type must handle numeric, boolean, and string values explicitly. Never assume "everything should be quoted".

---

## 2026-07-15: Data task routing -- keywords are the wrong tool

**What happened**: User asked to perform data tasks like "delete all rows that have a date less than 0". The app was routing through the conversation agent, which called `execute_dml` directly with no preview or confirmation step.

**First (wrong) attempt**: Added `'data-management'` to `KEYWORD_FAST_PATH_SKILLS` so delete/remove/truncate keywords would route to `handleDataManagement`. User immediately pointed out this would never work well enough -- keywords can't cover all phrasings ("get rid of", "clean out", "remove the bad rows", "take out nulls", etc.).

**Correct fix**: The conversation agent already understands intent in any phrasing -- that's why it exists. The problem was not routing, it was the execution layer. Added a destructive DML intercept in the conversation handler's `execute_dml` tool call. When the LLM calls `execute_dml` with a DELETE/TRUNCATE/DROP statement, the handler intercepts it, runs a `SELECT COUNT(*)` preview, and returns a `CONFIRMATION_CARD` envelope instead of executing. The LLM writes the SQL; the execution layer adds the safety gate.

**Lesson -- permanently recorded**: NEVER fix data task routing with keywords. The LLM understands intent in any phrasing. Keywords require maintaining an exhaustive synonym list and will always have gaps. Fix the system prompt or the execution-layer intercept instead.

**Files changed**: `src/lib/skills/handle-conversation.ts` (destructive DML intercept + count preview + confirmation card), `src/lib/chat-orchestrator.ts` (reverted keyword fast-path change).

---

## 2026-07-15: Map chart query failing -- INT64 = STRING type error

**What happened**: User asked for a map chart and got: `No matching signature for operator = for argument types: INT64, STRING`.

**Root cause**: The LLM wrote a WHERE clause like `WHERE Year = '2023'` (quoted string literal) against an INT64 `Year` column. BigQuery does not coerce string literals to integers in comparisons.

**Fix**: Added a rule to `public/skills/query.md` (SQL rules section):
> Match literal types to column types in WHERE clauses. If a column is INTEGER/INT64/FLOAT/NUMERIC, use an unquoted numeric literal (`WHERE Year = 2023`, NOT `WHERE Year = '2023'`). Only use quoted string literals for STRING/VARCHAR columns. Check the schema column type before writing any filter.

**Rule**: Never quote a numeric literal in a WHERE clause. INT64 columns require bare integers; STRING columns require quoted strings. When in doubt, call `get_table_schema` first.

---

## 2026-07-15: Zero-row results on population_data -- LLM adding implicit year filter

**What happened**: Querying `population_data` (117,648 rows, columns: Country, Code, Year, Population) consistently returned 0 rows with the headline "No population data found for the requested countries or dates".

**Root cause**: The system prompt in `handle-query.ts` injects `Today's date: <ISO date>`. The LLM interpreted this as an instruction to filter to current data and added `WHERE Year = 2026` (or similar). The `population_data` table has `Year` as an integer column (including ancient negative years), and has no rows for 2026 or recent years beyond its data cutoff. Result: 0 rows, LLM summary becomes the headline.

**Fix**: Added a CRITICAL rule to `public/skills/query.md` (SQL rules section):
> Do NOT apply implicit year or date filters based on today's date. Today's date is for relative date range computation only. Many tables have integer Year columns that don't include the current year. When no year is specified, omit the filter or use `WHERE year = (SELECT MAX(year) FROM ...)`.

**Rule**: `Today's date` in the system prompt is for relative ranges ("last 30 days"), not for implying recency filters. Any WHERE clause on a year/date column must be traceable to an explicit user request.

---

## 2026-07-14: Interactive widget with date range picker added


**What was built**: When a user asks for "a date range picker", "filter by date", "date filter", "let me filter", etc., the query skill now returns an `INTERACTIVE_WIDGET` artifact instead of a plain query result. The widget has:
- Date range pickers (start/end, empty by default, all data shown on load)
- Chart/table switcher (same toggle pill as existing query results)
- Apply button that re-runs parameterized SQL directly against BigQuery (no chat API round-trip)
- Clear button to revert to all-data view

**How it works**:
- Router: added 11 new signals to query manifest (`date range` weight 5, `date filter`, `date picker`, `filter control`, etc.)
- Skill doc: new "Interactive Widget Mode" section instructs LLM to generate `baseSql` + `parameterizedSql` with `{{start_date}}`/`{{end_date}}` placeholders, set `visualizationHint: "INTERACTIVE_WIDGET"`, and emit a `WIDGET_SPEC_START...WIDGET_SPEC_END` JSON block
- handle-query.ts: after capture, checks for `visualizationHint === 'INTERACTIVE_WIDGET'` + parsed widgetSpec, builds `InteractiveWidgetData`, short-circuits with `compose('query', widgetResult, ..., 'INTERACTIVE_WIDGET')`
- composer.ts: `composeQuery` detects `suggestedVisualization === 'INTERACTIVE_WIDGET'` early-returns with `presentation: 'custom'`, `skipSelfReview: true`
- New component: `InteractiveWidgetView.tsx` — `CustomViewProps` component, calls `executeQuery` directly on Apply
- ArtifactCard: `INTERACTIVE_WIDGET` added to `CustomArtifact` dispatcher

**Key design decisions**:
- `defaultStart`/`defaultEnd` are null unless the user explicitly requested a default. Pickers start empty, all data shown on initial load.
- Graceful degradation: if widgetSpec JSON parsing fails, falls through to a normal `QueryResult` with the baseSql result.
- The re-query calls `executeQuery` client-side (already available on the client via the GIS token) — no new API route needed.

**Rule**: `{{start_date}}`/`{{end_date}}` are the canonical placeholder strings. Use `BETWEEN '{{start_date}}' AND '{{end_date}}'` for DATE; cast for TIMESTAMP.

---

## 2026-07-15: Fix "entitys" pluralization bug + widget mis-trigger on ranking queries

**Root cause**: Two bugs found from a screenshot of "column chart showing the top 15 countries by population in 2023" being rendered as an interactive widget with a broken time-series chart.

**Bug 1 — "entitys" typo in chart title**:
`InteractiveWidgetView.tsx` line 347 was appending `s` to the control label verbatim: `"entity" + "s"` → `"entitys"`. Fixed by adding a `pluralize()` helper that handles the `-y → -ies` rule (entity→entities, country→countries) and the `-s/-sh/-ch/-x/-z → -es` rule, falling back to `+ "s"`.

**Bug 2 — LLM generating interactive widget for "top N" ranking queries**:
The user asked "column chart showing the top 15 countries by population in 2023". The LLM triggered `INTERACTIVE_WIDGET` mode with a `MULTI_SELECT` on the categorical `entity` column, producing 17,599 base rows (all country×year combinations) rendered as a column chart. The result was a meaningless spike chart.

**Fix**: Added a CRITICAL section to `public/skills/query.md` under "Interactive Widget Mode" explicitly listing what must NOT trigger widget mode:
- "top N [entities]" → write direct `ORDER BY ... DESC LIMIT N` query, use `COLUMN_CHART`/`BAR_CHART`
- "show me the biggest/smallest" → ranking query, fixed answer, no widget
- "which [entities] have the highest/lowest [metric]" → direct aggregate query

**Rule**: Interactive widgets are for user-driven **exploration**. Ranking queries have a fixed answer — compute and return it directly as a `COLUMN_CHART` or `BAR_CHART`.

---


## 2026-07-14: Heatmap shown for ranked country list -- filter column leaking into SELECT


**What happened**: Query "top 10 countries by total population in year 900" rendered as a heatmap instead of a bar chart.

**Root cause**: Two compounding issues. (1) The LLM generated SQL including `year` in SELECT/GROUP BY even though it was only a WHERE filter -- producing 3 columns (country, year, population) instead of 2. (2) The composer's heatmap rule fired on `catCols.length === 2 && numericCols.length === 1`, treating the constant `year=900` column as a second categorical dimension and routing to HEATMAP.

**Fix** (2 files):
- `public/skills/query.md`: Added SQL rule -- do NOT SELECT columns that are used only as WHERE filters. Includes a concrete example matching the exact failure pattern.
- `src/lib/composer.ts`: Both heatmap rules (Step 4 and Step 8) now check that each categorical column has >1 unique value across the rows before committing to HEATMAP. A constant-valued column (all rows = 900) fails the check and falls through to bar/column chart.

**Rule**: A categorical column where all rows share the same value is a filter artifact, not a matrix dimension. Never use it to justify HEATMAP.

---

## 2026-07-14: React error #310 -- objects rendered as React children

**What happened**: User got a runtime crash ("Minified React error #310") when creating a query. The error means "Objects are not valid as a React child."

**Root cause**: Multiple rendering paths assumed string values but received objects at runtime. Three sources: (1) Gemini's structured output for self-review `briefingFindings` can return numbers or objects for fields typed as STRING; (2) BigQuery RECORD/STRUCT fields pass through `coerceValue` as raw `{f: [{v: ...}]}` objects because only NUMERIC and BOOLEAN types were coerced; (3) `envelope.insight` and `convData.text` rendered directly without type guards.

**Fix** (4 files):
- `BriefingBlock.tsx`: Wrapped `f.label`, `f.value`, `f.detail`, and `briefing.narrative` in `String()` coercion.
- `bigquery-client.ts`: Added `typeof raw === 'object'` check in `coerceValue` to JSON.stringify RECORD/STRUCT field values.
- `ArtifactCard.tsx`: Guarded `{envelope.insight}` with `typeof` check.
- `ChatThread.tsx`: Guarded `{convData.text}` with `typeof` check.

**Rule**: Never render LLM-sourced or BigQuery-sourced values directly in JSX without a `String()` or `typeof === 'string'` guard. Structured output schemas say STRING but can return other types at runtime.

---

## 2026-07-14: Resume from saved query -- virtual CTE table context

**What happened**: When a user ran a saved artifact and then asked a follow-up query (e.g., "group by month"), the orchestrator had no memory that the prior result came from a saved query. It tried to query a real BigQuery table and often produced irrelevant SQL.

**Root cause**: `ChatContext` had no fields to carry the saved artifact's SQL or metadata. `extractContextFromEnvelope` discarded the artifact provenance. `handle-query.ts` had no CTE-wrapping logic.

**Fix** (4 files):
- `useChatOrchestration.ts`: Added `lastSavedArtifactSql`, `lastSavedArtifactName`, `lastSavedArtifactVizType` to `ChatContext`. Extended `extractContextFromEnvelope` to read `savedArtifactSql/Name/VizType` from envelope data and populate `lastTableSchema` from result columns. Clears fields when a normal query runs.
- `handle-saved.ts`: Injects `savedArtifactSql`, `savedArtifactName`, `savedArtifactVizType` into the `QueryResult` data payload (as extra fields via type assertion) so the envelope carries them.
- `orchestrator-utils.ts`: `buildConversationStateSummary` now has a priority branch for saved artifact context that tells the LLM classifier exactly how to route follow-up prompts (as CTE-wrapped SQL against a named virtual table).
- `handle-query.ts`: Added `lastSavedArtifactSql/Name/VizType` to the context type. When `lastSavedArtifactSql` is set, injects a `VIRTUAL TABLE CONTEXT` block into the system prompt instructing the LLM to write all SQL as a CTE wrapping the saved SQL.

**Rule**: When a user runs a saved artifact and follows up, the follow-up SQL must wrap the saved artifact's SQL as a CTE. Never query a real BigQuery table in that flow. The clearing logic (on real-table results) prevents stale artifact context.

---



**What happened**: Asking "Show me population.population_data" (or any `dataset.table` lookup) caused the app to hang indefinitely on the "Checking the results look right..." status message.

**Root cause**: The self-review skip gate in `chat-orchestrator.ts` only exempted SCHEMA_VIEW at PROJECT and DATASET scope. TABLE scope fell through to `selfReviewEnvelope` → `callGemini`. While `gemini-3.5-flash` does respond correctly, it was taking 25-30+ seconds for even short prompts. The browser's `fetch()` has no timeout, so the spinner hung forever. Self-review on a schema TABLE view adds zero value — it's factual metadata.

**Fix**: Extended the skip condition from `scope === 'PROJECT' || scope === 'DATASET'` to cover all `SCHEMA_VIEW` artifacts unconditionally. One line change in `chat-orchestrator.ts`.

**Rule**: SCHEMA_VIEW is factual metadata at all scopes (PROJECT, DATASET, TABLE). Self-review never improves it. Always skip self-review for all SCHEMA_VIEW results, not just PROJECT/DATASET.

---

## 2026-07-14: Sidebar cleanup -- Queries/Admin groups removed

**What happened**: The sidebar had "Queries" (Saved Queries, Query History) and "Admin" (Cost) groups that were dead links. Clicking them set `activePage` to `'saved-queries'`, `'query-history'`, or `'cost'` — none of which had handlers in `page.tsx`, so they rendered nothing.

**Root cause**: Stale nav items from an earlier design. The intended flow is: save a query/chart result via the save button → artifact stored in `savedWork` (Firestore) → visible in Spaces page. Saved queries are `SavedArtifact` objects, not `SavedConversation` (chat thread) objects — they are stored at separate Firestore paths.

**Fix**: Removed the `'Queries'` and `'Admin'` groups from `NAV_GROUPS` in `SideNav.tsx`. Only the `'Data'` group remains (Datasets, Tables, Schema Explorer).

**Rule**: Saved items (queries, workflows, pipelines) live in `savedWork` and are shown by the Spaces page. They are NOT the same as chat threads (`conversations`). Do not add sidebar links to pages that don't have route handlers in `page.tsx`.

---

## 2026-07-14: Duplicate titles in query/schema result cards

**What happened**: Result cards showed the same text two or three times. Schema results: headline "Found 13 datasets" + briefing "Here are the datasets available in `malloy-data`. Found 13 datasets." Query results: briefing narrative was literally set to `headlineText`. Additionally, ChatThread rendered BriefingBlock outside the card while ArtifactCard rendered it again internally.

**Root cause**: (1) ChatThread rendered `BriefingBlock` externally AND ArtifactCard rendered it internally. (2) In composer.ts, narrative-only briefings were always paraphrases of the headline.

**Fix**: Removed external BriefingBlock from ChatThread. In ArtifactCard, briefing only renders when it has structured `findings` (bullet points). Narrative-only briefings are suppressed.

**Rule**: Briefing blocks render only when they have structured findings. A narrative-only briefing is always redundant with the headline. If a new compose function needs distinct narrative text, add it as findings or use the insight field.

---

## 2026-07-13: COMPLETION_CARD type mismatch crash

**What happened**: CSV upload to a new table crashed with "Cannot read properties of undefined (reading 'toLocaleString')".

**Root cause**: The composer used `COMPLETION_CARD` artifact type for upload completion, but `CompletionCard` component expects `DataManagementCompleteResult` (with `rowsAffected`, `operation`). Upload results are `DataLoadingResult` (with `message`, `rowCount`). The component accessed `result.rowsAffected` which was `undefined`.

**Fix**: Changed upload completion to use `DATA_LOADING_VIEW` instead of `COMPLETION_CARD`.

**Rule**: Never reuse `COMPLETION_CARD` for non-data-management results. Each artifact type is tightly coupled to a specific result interface. Use `DATA_LOADING_VIEW` for all `DataLoadingResult` types.

---

A reverse-chronological log of changes, fixes, and lessons learned. Read this before making code changes to avoid repeating past mistakes.

## How to use this file
- **Before coding**: Scan recent entries for relevant context
- **After coding**: Add a new entry for any non-trivial change
- **When debugging**: Search for similar symptoms in past entries

## How to write an entry
Every entry should answer: What changed? What worked? What broke? Why? What's the generalizable lesson?

## 2026-07-13: Fix "+ New" button requiring double-click

**What changed**: SideNav's "+ New" button now also navigates to the chat page and closes the chat list overlay (in unified mode).

**Root cause**: The onClick handler only called `newConversation()` which creates a new conversation ID in context, but did not call `setActivePage('chat')`. If the user was on any other page, or if the chat list overlay was covering the chat view, the new conversation was created invisibly. The user had to click a second time (or click "AI") to actually see it.

**Derived rule**: Any UI action that creates or switches conversations must also ensure the chat view is visible -- call `setActivePage('chat')` and manage overlay state as needed.

## 2026-07-13: Conversational AI + Routing Fixes

**What changed**: Added `conversation` skill for natural dialogue + fixed three routing bugs.

**What worked**: 
- Safety net fix (high-confidence-only redirect) immediately unblocks "make a new dataset" and similar prompts that were being silently redirected to query.
- Conversation skill picks up greetings, questions, and help requests that previously either failed or produced wrong data results.
- Empty `signals: []` on the conversation manifest means it never steals routing from task skills in the keyword scorer.
- 19/19 snapshot routing tests pass without modification -- existing routing is not disturbed.

**Root cause (dataset verbs)**: "make a new dataset" had no matching pattern in MUTATING_VERBS, so the keyword router returned no-signal default (query at medium confidence). Even when the LLM classifier correctly identified data-management, the safety net in `handleDataManagement()` re-ran the keyword router which returned query, causing a redirect. Two bugs compounded: missing verbs + too-strict safety net.

**Derived rule**: The safety net should only override the LLM when the keyword router has **high confidence** that the skill is wrong. Medium/low confidence means the keyword router is unsure, so the LLM's judgment should stand.

## 2026-07-12: User Q&A Session -- A/B/C/D + Bug Fixes

**What changed**: Addressed four open design questions and fixed four confirmed bugs.

**A -- Shared link page** (`/shared`):
- Built `/shared` static page that reads share ID from URL hash (`#share_xyz`) to avoid dynamic route segment incompatibility with `output: 'export'`.
- ShareLinkButton URL updated from `/shared/${id}` to `/shared#${id}`.
- Auth-gated: signed-in users see headline + SQL; others see sign-in prompt. 7-day expiry shown.

**B -- Live-executing dashboard**:
- Rewrote `/dashboard/page.tsx` from skeleton to functional dashboard.
- Tiles re-run their `cachedSql` on open; show `lastSnapshot` instantly then update.
- Added artifact picker modal, width/height span controls, refresh button, save to Firestore.
- Extended `DashboardTile` type in `types.ts` with `cachedSql` and `lastSnapshot` fields.

**C -- Quality trend sparkline**:
- Added `QualityTrendSparkline` component to `DataQualityView.tsx`.
- Reads last 30 snapshots from `monitoringHistory/{tableRef}/snapshots` via `getMonitoringHistory()`.
- Renders SVG line chart (green = improving, red = worsening) with +/- delta. Hidden when < 2 points.
- Fixed `getMonitoringHistory()` call: signature is `(tableRef, limit)` not `(tableRef, checkType, limit)`. Filter checkType client-side.

**D -- Dashboard in sidebar**:
- Added `{ label: 'Dashboards', icon: 'dashboard', page: 'dashboard' }` to SideNav top-level items.
- Wired `activePage === 'dashboard'` in `page.tsx` with dynamic import and hide-list conditions for both unified and split layouts.

**Bug: Top-N without metric**:
- Strengthened `query.md` with explicit rule: "Top N entity with NO metric specified" must GROUP BY entity, pick best numeric column (revenue/price/amount), ORDER BY DESC LIMIT N. Never return scalar COUNT(*). Added wrong/correct examples.

**Bug: CSV export dataset resolution**:
- `handle-data-loading.ts` line 46: changed `if (!dataset && intent.dataset)` to `if (intent.dataset)`.
- Root cause: when user named a specific dataset ("orders in ecomm"), the LLM-extracted dataset was ignored if context already had a dataset from a prior turn.

**W1-14: Save as Workflow**:
- `saveChatAsWorkflow()` was already implemented in `useChatOrchestration.ts` but had no UI entry point.
- Added "Save as Workflow" button to `page.tsx` above ChatThread (visible only when `hasChat`).
- Reuses `SaveModal` with `artifactType='workflow'`, wired to `chat.saveChatAsWorkflow`.

**W1-12: Grain inference**:
- Added `inferGrainStatement(result: SchemaResult): string | null` pure function to `SchemaView.tsx`.
- Priority order: (1) explicit PK columns, (2) table name pattern + partition field, (3) table name pattern alone, (4) single _id column heuristic.
- Renders as a subtle banner between stats row and tab bar. Returns null (no banner) for ambiguous cases.

**Rules derived**:
1. `output: 'export'` Next.js static config prohibits dynamic route segments like `[id]`. Use hash-based routing (`/page#id`) as the workaround for user-generated content URLs.
2. `generateStaticParams` cannot be in a `'use client'` file. If needed, split into server wrapper + client component.
3. Always prefer LLM-extracted explicit values over context when the user names something specific in their request (dataset, table, project).
4. `getMonitoringHistory()` signature: `(tableRef: string, limit?: number)` — no checkType param. Filter client-side.
5. New pages that replace the chat area must be added to BOTH the unified-layout hide condition AND the split-layout hide condition in `page.tsx`.

## 2026-07-12: Wave 3 — All Items Implemented

**Items completed in this session**: W3-05, W3-08, W3-11, W3-12, W3-13, W3-14, W3-15, W3-16, W3-17, W3-18, W3-19, W3-20 (previous session covered W3-01 through W3-10).

**Key changes**:
- **W3-05 (Annotation write-back)**: Added annotation verbs to MUTATING_VERBS router (`annotate`, `describe column`, `set description`, etc.). Added `ALTER TABLE ... ALTER COLUMN SET OPTIONS (description=...)` DDL to data-management skill doc. Routed to existing LLM-driven DML handler.
- **W3-08 (Calendar heatmap)**: Added monthly coverage grid inside `DateRangeVizLarge` in `SchemaView.tsx`. Computes month buckets from min/max dates, renders 12-col grid with intensity gradient.
- **W3-11/12 (Firestore types)**: Added `SavedDashboard`, `DashboardTile`, `JoinDefinition` types to `types.ts`.
- **W3-13 (Join discovery)**: Added `JOIN_DISCOVERY` to discovery LLM prompt and handler. Extracts overlapping column names, prefers *_id/*_key patterns, runs match rate SQL against top candidate.
- **W3-14 (Query parameterization UI)**: Extended `SaveModal` with `sql` prop, auto-detects `@param` patterns, shows collapsible parameter editor with type/default fields.
- **W3-15 (Dashboard editor)**: New `/dashboard` page with split-panel layout: saved dashboard list + artifact picker on left, CSS grid tile canvas on right. Saves to `users/{uid}/savedDashboards` Firestore collection.
- **W3-16 (URL sharing)**: Added `ShareLinkButton` to ArtifactCard kebab menu. Writes to `sharedArtifacts/{id}` Firestore collection, copies URL to clipboard.
- **W3-17 (Pipeline DAG)**: Added pipeline flow diagram to `ScheduleDetails`. Extracts source tables from SQL via FROM/JOIN regex, renders source → schedule job → destination node flow.
- **W3-18 (Slot utilization)**: Changed SLOTS monitoring handler to return `LINE_CHART` `QueryResult` instead of `JOB_LIST`. Reuses existing chart infrastructure.
- **W3-19 (Monitoring history)**: New `src/lib/monitoring-history.ts` module with `saveMonitoringSnapshot()` / `getMonitoringHistory()`. Wired fire-and-forget calls into FRESHNESS and COMPLETENESS DQ handlers.

**Rules derived**:
1. `DiscoveryResult.query` must be optional (`?`) when adding new discoveryType variants that don't use a query string.
2. `ParameterDef` type uses lowercase type values (`'string'`, `'number'`, `'date'`) and `default` field (not `defaultValue`).
3. When adding new Firestore collections to client-side code, use dynamic `import()` to avoid server-side SSR errors.
4. `getArtifacts(userId)` in `saved-work.ts` only accepts `(userId, type?)` — no limit parameter.
5. The monitoring SLOTS handler can reuse the existing `compose('query', ...)` path with `LINE_CHART` suggestion — no new chart component needed.

### 2026-07-12: Batch 3-6 Bug Fixes from Visual Test Suite

**What changed**: Four bugs found from the 20-prompt Puppeteer test suite and fixed:

**Bug A (query skill)**: "Show me orders by status" returned raw rows (SELECT ... LIMIT 10) instead of an aggregation (SELECT status, COUNT(*) GROUP BY status). Root cause: query.md lacked explicit rules for "by X" questions. Fixed by adding a CRITICAL aggregation section with wrong/correct examples for 5 common patterns. Also fixed "top 10 products" which was returning a COUNT(*) KPI.

**Bug B (W1-15)**: No inline optimization tips on cost analysis. Fixed by adding data-driven tips computed from bucket data: high avg bytes/job (>1GB suggests missing partition filter), single user domination (>80% of cost), and single-day cost spike (>3x daily avg). Each tip has an "Investigate" chip.

**Bug C (maps)**: USA_MAP rendered an empty placeholder ("Google Maps API key not configured") when no API key is set. Fixed by falling back to BarChartRenderer when `error.includes('not configured')`. Applied to all three map renderers (USAMap, WorldMap, GeoPointMap).

**Bug D (charts)**: DATE_TRUNC results returned from BigQuery serialize as Unix epoch SECONDS (e.g., 1577836800), which rendered as raw numbers on the x-axis. Fixed by adding `xTickFmt()` to `useChartSetup()` that detects epoch seconds (1e8–2e10) and epoch milliseconds (1e11–2e13) and formats them as "Jan '20" style labels. Applied to LineChart, ColumnChart, AreaChart.

**Rules derived**:
1. "By X" in user queries ALWAYS means GROUP BY X -- add explicit few-shot examples to skill prompts to prevent raw-row responses.
2. Map charts need a graceful data-showing fallback when the API key is absent -- never show empty on good data.
3. BigQuery TIMESTAMP and DATE_TRUNC results serialize as epoch SECONDS (not milliseconds) when returned through the jobs API. Always check the magnitude range to distinguish seconds vs milliseconds.
4. Test promptly after each batch deploy; visual test suite caught issues that code review would not.

### 2026-07-12: Visualization Intelligence Overhaul (Five-Layer Decision System)

**What changed**: Replaced the 6-case `inferVisualizationType` heuristic with a full 13-step expert decision tree. Added LLM semantic hint via `visualizationHint` parameter on the `run_query` tool. Added explicit user intent extraction via `extractVisualizationIntent()` in `viz-intent.ts`. Threaded `columnTypes` (authoritative BigQuery field types) from `parseQueryResponse` all the way to the decision tree.

**What worked**: Using authoritative BQ column types (DATE, TIMESTAMP, INTEGER, etc.) as the primary type signal instead of re-deriving from sample values eliminated false positives on numeric-looking date strings. The 13-step tree now correctly identifies HEATMAP (2 categoricals + 1 numeric), FUNNEL (monotonically decreasing stages), DONUT_CHART (parts-of-whole by semantic signal), COMPOSED_CHART (dual-scale series), AREA_CHART (cumulative columns), COLUMN_CHART vs BAR_CHART by actual label length, HISTOGRAM (single numeric with many rows), and geographic maps.

**What broke**: Nothing -- clean build, no TypeScript errors.

**Rules derived**:
1. ALWAYS use authoritative schema types (from the database) rather than re-deriving types from sample values. Sample values can mislead (numeric strings, sparse columns).
2. Explicit user intent must be the highest-priority layer -- never let a heuristic override a user's explicit request.
3. Self-review must NOT override a visualization that is already correct. Add explicit rules to the review prompt to prevent it.
4. The LLM's `visualizationHint` (from tool call args) is a semantic signal, not authority. Use it as a tiebreaker when the data shape is ambiguous, not as the primary signal.

### 2026-07-12: Chart Renderer Bug Fixes

**What changed**: Fixed three renderer bugs: (1) ScatterChart X-axis was categorical (type not set), so points plotted at equal intervals instead of by value. Fixed by setting `type="number"` on both axes. (2) Treemap had no Tooltip, making it non-interactive visually. Added `<Tooltip>` inside `<Treemap>`. (3) DensityPlot had no `onClick` handler despite the UI showing a "Click to drill down" tip. Added an SVG onClick that sends a drillDownMessage for the closest data point.

**What broke**: Gauge had a bug where `drillDownMessage` was passed `currentValue` (a number) instead of `label` (the category identifier). Fixed.

**Rule**: After adding a new chart type to the rendering system, verify all interactive contracts: hover tooltip, click drill-down, and axis types. Missing any one of these makes the chart feel broken even if it renders correctly.

### 2026-07-12: Map Drill-Down Clicks

**What changed**: Added `marker.addListener('click', ...)` to all three Google Maps renderers (GeoPointMap, USAMap, WorldMap). Clicking a map marker now sends a `drillDownMessage` to the chat, consistent with clicking bars, pie slices, and treemap cells in other chart types.

**Rule**: All chart types must support the same click-to-drill-down contract. When adding marker-based maps, the Google Maps AdvancedMarkerElement click uses `addListener('click', cb)` not an `onClick` prop.

### 2026-07-12: Query Skill Doc -- visualizationHint Guidance

**What changed**: Added a new section to `public/skills/query.md` instructing the LLM to always set the `visualizationHint` parameter on the `run_query` tool call. This is the LLM's semantic contribution to the five-layer decision system.

**Rule**: Whenever a new tool parameter is added that the LLM needs to use, the skill doc MUST be updated to explain when and how to fill it in. Tool schema declarations alone are insufficient.

### 2026-07-12: viz-intent.ts -- Explicit User Intent Extraction

**What changed**: Created `src/lib/viz-intent.ts` with `extractVisualizationIntent()` and `isVizMutationOnly()`. These functions are used in `chat-orchestrator.ts` to detect when the user has explicitly requested a chart type and when a message is a pure chart-type-change (no new query needed).

**Rule**: Explicit user visualization requests must be extracted BEFORE routing, not after. The intent needs to flow through the entire pipeline: orchestrator -> enrichedContext -> handleQuery -> compose -> inferVisualizationType.

### 2026-07-11: Follow-up queries redundantly called get_table_schema

**What broke**: After a schema-view turn ("Show me ecomm.order_items"), the next query turn ("show totals for order status") still called `get_table_schema` in its thinking steps, even though the schema was already fetched and visible on screen.

**Root cause**: The schema columns were never threaded through the context object between turns. `handleQuery` could pre-fetch and inject schema into the system prompt via the existing `context.lastTable` path (which triggered a cached `fetchSchema` call), but the LLM still called `get_table_schema` anyway because the prompt instruction wasn't forceful enough ("do not call get_table_schema first" is soft). Additionally, `context.lastTableSchema` didn't exist, so the pre-fetched columns weren't distinguishable from a fresh fetch.

**Fix**:
- Added `lastTableSchema` to `ChatContext` and `ProcessMessageArgs`.
- `extractContextFromEnvelope()` now populates `lastTableSchema` from `SCHEMA_VIEW` artifact columns (table scope only).
- `handleQuery` checks `context.lastTableSchema` first; if present and non-empty, uses it directly (no fetch, not even a cache lookup).
- Strengthened the system prompt instruction: when schema is pre-injected, the LLM now reads "it is complete and authoritative. Do NOT call get_table_schema under any circumstances."
- `deriveContextFromItems()` carries `lastTableSchema` forward automatically via `...context` spread.

**Rule**: Schema columns fetched in any prior turn should be stored in context and passed to subsequent turns. Any instruction telling an LLM "you don't need to call this tool" must be absolute and name the tool explicitly -- hedged language like "you don't need to do this first" leaves room for the model to rationalize a call anyway.

### 2026-07-11: Query handler wasted iterations on list_tables/list_datasets

**What broke**: Simple questions like "which drivers had the most points" burned through all 10 tool-call iterations without answering the question. The LLM spent iterations on list_datasets, list_tables, and exploratory queries before reaching the real query.

**Root cause**: The system prompt included the dataset name and available datasets, but NOT the table list for the active dataset. The LLM had to call list_tables to discover what tables existed, then get_table_schema, then run_query -- burning 3-4 iterations before any SQL ran. With schema exploration and retries, it hit the 10-iteration cap.

**Fix**: Pre-fetch the table list via `fetchSchema(dataset)` (already cached) and include it in the system prompt. Updated efficiency rules to say "Do NOT call list_tables or list_datasets" and "Do NOT run exploratory or summary queries." Also filtered system plumbing strings ("Reached maximum tool-call iterations", "No results to display") from the clean-summary check so they never appear as headlines.

**Rule**: When an LLM agent has tools that the system could pre-populate context for, prefer pre-populating. Every eliminated tool call saves an iteration and reduces the chance of the LLM going off-track.

### 2026-07-11: Query briefing showed generic "I ran your query and got N rows"

**What broke**: When asking "which countries have had the most races?", the chat briefing text above the artifact card said "I ran your query against malloy and got 10 rows" instead of a meaningful summary like "Countries with the most races".

**Root cause**: The heuristic briefing in `composeQuery()` (composer.ts lines 390-398) used a generic template that ignored the headline text and LLM summary. Self-review would normally replace this with an LLM-generated briefing, but self-review is skipped for high-confidence keyword matches with <100 rows -- the most common case.

**Fix**: Changed the heuristic briefing to use `headlineText` as the narrative. The headline already contains a meaningful data description (either the LLM `resultSummary` or `buildQueryHeadline()`'s column-aware summary). Zero-row results keep the diagnostic message.

**Rule**: When self-review is skipped (the common path for simple queries), the heuristic briefing IS the final user-facing text. It must be as good as possible on its own, not a placeholder waiting for self-review to fix it.

### 2026-07-11: "show me a map" rendered as schema table, not GEO_POINT_MAP

**What broke**: Prompting "show me a map with pins on each racetrack location" returned a SCHEMA_VIEW table listing instead of an interactive Google Maps view with pins.

**Root cause (routing)**: The query manifest had signals for "chart", "visualize", "histogram", etc. but no signal for "map". The word "map" didn't score for query, so the router matched schema's "show me" signals.

**Root cause (inference)**: `inferVisualizationType` in composer.ts had no lat/lng column detection. Even if query ran, results with `lat`/`lng` columns defaulted to TABLE. The `GeoPointMapRenderer` existed and worked but was never auto-selected.

**Fix**: Added `map`, `map with pins`, `on a map` signals (weight 3-4) to query manifest. Added early lat/lng column name detection in `inferVisualizationType` to return `GEO_POINT_MAP` when both lat and lng columns are present.

**Rule**: When adding a new visualization renderer, also add: (1) routing signals in the query manifest, (2) auto-detection logic in `inferVisualizationType`. Without both, the renderer exists but is unreachable.

### 2026-07-11: splitView not synced on layout switch

**What broke**: Clicking a chat in unified mode, then switching to split layout (Chat left/Chat right) showed the chat list instead of the loaded chat thread.

**Root cause**: `splitView` state in page.tsx was initialized to `'list'` and only changed to `'thread'` by the `onSelectChat` callback. Since the chat was selected in unified mode (which doesn't use `splitView`), the state was never updated.

**Fix**: Added an effect: `if (isSplit && hasChat) setSplitView('thread')`. This ensures that entering split mode with an active conversation immediately shows the thread.

**Rule**: Any state that governs split-layout behavior must be synced when the layout mode changes, not just when the triggering action happens within split mode.

### 2026-07-11: Conversational briefings on every response

**What changed**: Added a `briefing` field to `CompositionEnvelope` containing a narrative string and optional key findings. Self-review generates LLM briefings; composer generates heuristic briefings as fallback. New `BriefingBlock.tsx` renders above artifact cards in both layouts.

**What worked**: Piggybacking on the existing self-review Gemini call for LLM-quality briefings -- no extra latency or cost for complex responses. Heuristic briefings for simple responses (schema, KPI, small queries) are instant.

**What to watch for**: The self-review prompt is now larger (added ~200 chars for BRIEFING dimension + rules). If self-review starts timing out, this would be one factor. Monitor response times.

**Derived rule**: When adding a new field to the response envelope, always populate it in both the heuristic path (composer) and the LLM path (self-review). Relying on only one path leaves gaps depending on self-review gating.

### 2026-07-11: Polymorphic response rendering

**What changed**: Added `presentation: 'custom'` mode to `CompositionEnvelope`. ArtifactCard now has two paths: default (existing chrome) and custom (thin container, view owns layout). Created `CardParts.tsx` with composable building blocks (`CardHeader`, `CardChips`, `SqlPanel`, `CardMeta`). Migrated GovernanceView as the first custom-mode view.

**What worked**: Governance views now render context-appropriate layouts. Zero-result access audit is 3 lines instead of a full card with stat boxes showing zeroes. With-data cases still show tables and badges but skip the redundant SCOPE stat box.

**What broke**: React rules of hooks -- the initial implementation called `useState`/`useEffect` after a conditional early return in ArtifactCard. Fixed by moving all hooks above the conditional.

**Rule**: When adding an early-return rendering path to a React component, all hooks MUST be called before the conditional. Move hooks above the branch, even if only one path uses them.

**Rule**: To migrate a view to custom mode: (1) set `presentation: 'custom'` in the compose function, (2) update the view to accept `CustomViewProps`, (3) add a case in `CustomArtifact` dispatcher, (4) update the old `Artifact` case to a fallback.

### 2026-07-11: UX evaluation -- systemic fixes

**What changed**: 8 fixes based on a 25-scenario UX evaluation with screenshot analysis.

**What worked**: Data-driven headlines now surface actual values instead of generic "X rows from table". Chart routing signals prevent visualization queries from being misrouted to schema. Chronological time-series sorting fixes reversed line charts.

**What broke previously**: `inferVisualizationType()` was charting `SELECT * FROM table LIMIT 20` sample queries because it saw numeric columns and assumed aggregation data. Fixed with an `isSampleQuery` pattern check.

**Root cause (generic headlines)**: `buildQueryHeadline()` only had access to `rowCount` and `sql`. Added `columns` and `rows` parameters so it can inspect actual data values.

**Rule**: Sample/preview queries (SELECT * ... LIMIT N) should always render as TABLE, never charts. Chart inference is for aggregated/analytical results only.

**Rule**: Time-series charts must sort x-axis data chronologically. The SQL ORDER BY may produce newest-first but charts should always read left-to-right oldest-to-newest.

**Rule**: Help/capability intents ("what can you do?") need a static handler with example prompts, not a Gemini round-trip that produces irrelevant query results.

### 2026-07-10 (late): Double sign-in popup race condition

**What changed**: Added a `signingIn` ref to `auth-context.tsx` that guards the `onAuthStateChanged` callback from triggering auto-refresh while `signIn()` is still in progress.

**What broke**: Users were seeing two Google sign-in popups when logging in.

**Root cause**: `signIn()` calls `signInWithPopup()` which causes Firebase to fire `onAuthStateChanged` mid-flow -- before `signIn()` stores the OAuth access token. The `onAuthStateChanged` callback sees the user is logged in but finds no stored token, so it enters the auto-refresh branch and opens a second popup via `signInWithPopup(auth, refreshProvider)`.

**Derived rule**: Any async Firebase Auth state change handler must check whether a manual sign-in flow is already in progress before attempting token refresh or re-authentication.

### 2026-07-10 (late): Tailwind 4 -body class name collision

**What changed**: Renamed `.gc-project-dropdown-body` to `.gc-project-dropdown-list` and `.chat-sidebar-thinking-body` to `.chat-sidebar-thinking-content` in globals.css, TopBar.tsx, and ResultsSidebar.tsx.

**What broke**: The entire app was capped at 320px tall and could not scale with window resize.

**Root cause**: Tailwind 4's CSS processor (`@import "tailwindcss"`) was extracting `body` from class names ending in `-body` and generating bare `body{}` rules in the compiled CSS. `.gc-project-dropdown-body { max-height: 320px }` compiled to `body { max-height: 320px }`, limiting the page height. `.chat-sidebar-thinking-body { border-left: 2px; flex-direction: column }` compiled to another spurious `body{}` rule.

**Rule**: Never use CSS class names that end with `-body` when Tailwind 4 (`@import "tailwindcss"`) is active. The Tailwind CSS processor treats the suffix as the `body` element selector. Use alternatives like `-list`, `-content`, `-wrap`, `-container`, `-inner`.

**Verification**: After build, check `grep -o 'body{[^}]*}' .next/static/chunks/*.css` -- should return only one rule with the expected properties (height, background, overflow, font-family, margin).

### 2026-07-10 (late): browser-testing skill correction

**What changed**: Rewrote `.agents/skills/browser-testing/SKILL.md` to document that the `browser_subagent` tool works on macOS. The old skill file stated `browser_subagent` / `open_browser_url` "do not work on macOS -- they require Linux" and had a "Do NOT Use" section explicitly blocking those tools. This caused every new conversation to refuse browser-based visual testing.

**What broke before**: New conversations would read the skill file and tell the user that browser testing is not possible on Mac, despite the `browser_subagent` tool being fully functional and having been used successfully in prior sessions.

**Root cause**: The original skill file was written with an incorrect assumption about macOS compatibility. The "Do NOT Use" section at the bottom was authoritative enough that every new conversation treated it as a hard constraint.

**Derived rule**: The `browser_subagent` tool works on macOS. Use it for ad-hoc visual checks (screenshots, verifying UI elements, interactive testing). Use the Puppeteer script (`scripts/visual-test.mjs`) for the full automated 20-test suite. The Puppeteer approach is still valuable for auth-protected pages since it uses a persistent Chrome profile.

---

### 2026-07-10 (night): Zero-row query experience improvement

**What changed**: When a query returns 0 rows, the app now (1) blocks the LLM-generated summary headline, using a SQL-aware diagnostic headline instead, (2) generates recovery next-action chips (sample table, view schema), (3) forces TABLE artifact type to prevent empty charts, (4) shows "No rows returned" in DataTable, (5) shows "--" in KpiCard for undefined values, (6) produces SQL-aware quality flag messages, and (7) instructs self-review not to generate optimistic headlines for empty results.

**What broke before**: The LLM summary was written assuming data would be returned, producing misleading headlines like "Discover and optimize your malloy-data storage footprint" for a 0-row INFORMATION_SCHEMA.TABLE_STORAGE query. No recovery chips were generated. DataTable rendered an empty tbody. KpiCard showed undefined.

**Root cause**: The composer's headline logic checked `isCleanSummary` before checking `rowCount === 0`, so the LLM summary always won. Next-action chip generation was gated on `rowCount > 0` with no zero-row alternative. No UI components had empty-state handling.

**Derived rule**: For zero-row results, always use the diagnostic headline builder, never the LLM summary. The LLM summary is written at query-generation time before results are known, so it cannot account for empty results.

### 2026-07-10 (late): Composer now infers chart type from data shape

**What changed**: Replaced `vizTypeToArtifactType()` (a passthrough of the LLM hint) with `inferVisualizationType()` that classifies columns as numeric/date/categorical and picks the right chart. Also improved `buildQueryHeadline()` to generate descriptive summaries from column names.

**What worked**: The existing `ChartWithToggle` component immediately started rendering charts with the toggle pill once the composer returned non-TABLE types. Zero UI changes needed.

**Root cause**: The query handler hardcodes `suggestedVisualization: 'TABLE'`. The self-review pass could override it, but self-review is skipped for high-confidence keyword-matched queries with <100 rows (the most common case). So the composer invariant "chart type by data shape" was documented but never actually implemented.

**Rule**: When an invariant says behavior X should happen, verify it in code. Documented-but-not-implemented invariants are bugs.

---



**What changed**: Renamed "Saved" to "Spaces" in sidebar. Created SpacesPage with folder-like spaces, drag-and-drop, card/list view switcher, inline rename, context menus, and breadcrumb navigation. Created dedicated FavoritesPage showing favorited chats and pinned artifacts. Rewrote OverviewDashboard to remove broken KPI StatCards and replace with Recent Charts and Recently Saved sections. Added Space type, spaceId to SavedArtifact, and space CRUD operations to saved-work.ts.

**What worked**: Using subagents in parallel to write the three large page components (Overview, Favorites, Spaces) while the main agent handled types, data layer, routing, and sidebar changes. All three compiled cleanly.

**What to watch**: The `onLoadConversation` callback in FavoritesPage receives a favorite item ID, not a conversation ID. FavoriteItem doesn't store the originating conversation ID, so loading the actual conversation may not work as expected.

**Derived rule**: When a saved concept (like FavoriteItem) is created to reference another entity (like a conversation), always store the source entity's ID at creation time.

---

### 2026-07-10: Fix "Suggest next steps" error after table schema view
**Scope**: composer.ts, handle-governance.ts, handle-query.ts, ArtifactCard.tsx
**What broke**: Clicking "Suggest next steps" after viewing a table schema produced `Not found: Dataset malloy-data:ecomm.INFORMATION_SCHEMA was not found in location US`.
**Root cause (3 compounding bugs)**:
1. `composeSchema()` returned empty `nextActions` for TABLE scope, triggering a generic fallback chip that sent the vague message "What can I do next with these results?" -- no keyword signals, fell to LLM classifier, which routed unpredictably.
2. `handle-governance.ts` had 7 INFORMATION_SCHEMA references with INFORMATION_SCHEMA *inside* the backtick-quoted identifier (`` `project.dataset.INFORMATION_SCHEMA.VIEW` `` instead of `` `project.dataset`.INFORMATION_SCHEMA.VIEW ``). BigQuery interprets the former as a dataset name.
3. The query handler's LLM prompt didn't warn about INFORMATION_SCHEMA being an exception to the backtick rule, so Gemini extended the "wrap everything in backticks" instruction to INFORMATION_SCHEMA paths.
**Fix**:
- Added 3 contextual next-action chips for TABLE scope schemas (Query, Profile, Check freshness)
- Fixed all 7 governance INFORMATION_SCHEMA backtick references
- Added INFORMATION_SCHEMA exception to the query handler's LLM prompt
- Made the fallback chip message context-aware (references actual table name)
**Rule**: INFORMATION_SCHEMA views must always be OUTSIDE backtick-quoted identifiers. The correct pattern is `` `project.dataset`.INFORMATION_SCHEMA.VIEW_NAME ``. Added to invariants.

---

### 2026-07-10: Backtick-quote region identifier in overview JOBS_BY_PROJECT query
**Scope**: OverviewDashboard.tsx
**What broke**: Overview page showed "Could not load recent activity: Syntax error: Expected end of input but got '-' at [11:34]".
**Root cause**: The SQL for fetching recent jobs used `region-${region}` unquoted. The hyphen in `region-us` was parsed as a minus operator. This violates the existing invariant about backtick-wrapping identifiers containing hyphens.
**Fix**: Changed to `` \`region-${region}\` `` (backtick-quoted).
**Rule**: Already documented in invariants -- all identifiers containing hyphens must be backtick-quoted. This was a missed instance.

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

## 2026-07-12 — Profile tab: lazy-load behind Generate button

**What changed:** `SchemaView.tsx` + `preview-client.ts`

**Problem:** `fetchTablePreview` was called eagerly on mount, firing a full-table-scan profile query (COUNT DISTINCT, MIN, MAX, NULL rates for every column + top-values GROUP BY per string column) against the table/view immediately. On large views like `formula_1_all_data_view` this hung the UI for 30–60 seconds.

**Fix:**
- Added `sampleOnly = false` flag to `fetchTablePreview`. When true, only `SELECT * LIMIT 20` runs and profile is returned as an empty array.
- Split `TableSchemaView` state: `sampleData` (fetched eagerly with `sampleOnly=true`) and `profileData` (fetched on demand).
- `ProfileTab` now shows an analytics icon + "Generate Profile" button when no profile data exists. Clicking triggers `generateProfile()`, shows skeleton while running, then renders cards in-place.
- Pulse dot in Profile tab header only shows while profile is actively generating.

**Derived rule:** Never fire expensive full-table-scan queries eagerly on schema view load. Always gate them behind user intent.

---

## 2026-07-18: Fix "Unexpected token '<'" error on Gemini proxy calls

**Symptom**: After a successful first query (e.g., "Show me population.population_data"), the follow-up query ("show the top countries by population with a year filter") returned: `Unexpected token '<', "<html><hea"... is not valid JSON`.

**Root cause**: The Cloud Function `geminiProxy` in `functions/src/index.ts` was deployed with `invoker: "private"`. For Cloud Functions v2 (which run on Cloud Run), `invoker: "private"` means Google Cloud requires IAM-level OIDC authentication before the function code even executes. Firebase Hosting rewrites do not inject IAM credentials -- they just forward the HTTP request. So Google Cloud returned an HTML 403 page, which the client tried to parse as JSON.

The first query may have worked because the function was already warm or had residual public IAM bindings from a prior deployment. Subsequent deploys with `invoker: "private"` removed those bindings.

**Fix**:
1. Changed `invoker: "private"` to `invoker: "public"` in `functions/src/index.ts`. The function's own code already validates Firebase Auth ID tokens (lines 35-47), so unauthenticated users still cannot access Gemini.
2. Added defensive JSON parsing in `gemini-client.ts` -- both `callGemini()` and `callGeminiWithTools()` now use `res.text()` + `JSON.parse()` with a try/catch, producing a clear error message instead of "Unexpected token" if the proxy ever returns non-JSON.

**Derived rule**: Cloud Functions v2 behind Firebase Hosting rewrites must use `invoker: "public"`. Firebase Hosting cannot pass IAM credentials. Application-level auth (Firebase ID token verification) is the correct security layer for these functions.

---

## 2026-07-24: Agent Core v2 -- Phase -1 and Phase 0 implementation

**What**: Implemented the new agent-loop architecture (Phase -1 and Phase 0 from the Agent Core Design v2 spec). Created the `src/agent/` directory with ModelAdapter, FirebaseAiLogicAdapter, StepEvent protocol, trace recorder, agent loop, Phase 0 tool belt (run_query, get_schema, list_resources), action-class taxonomy, IndexedDB result cache, and feature flag integration. Also created golden set infrastructure in `eval/` (20 cases, fixture setup, runner).

**What worked**: Build passes, all 96 existing tests green, adapter wired into handle-conversation.ts without disrupting existing code. Feature flag cleanly gates between old pipeline and new loop.

**Build issues fixed during implementation**:
- `guardSql` import in run-query.ts -- function doesn't exist in sql-guard.ts. Removed; destructive SQL gating happens in the loop via action-classes.ts.
- `StepInfo.label` -- property is `text` not `label`.
- `SchemaResult.tableName` -- property is `table` not `tableName`; `numRows`/`numBytes` -> `rowCount`/`sizeBytes`.
- `QueryExecuteResult.totalBytesProcessed` -- doesn't exist on this type.
- `FunctionCall.args` type `object` not assignable to `Record<string, unknown>` -- required cast through `unknown`.

**Derived rules**:
- When wrapping existing APIs in new abstractions, always check the actual type definitions before assuming property names.
- The `callGeminiWithTools` adapter parameter is optional and backward-compatible; when absent, the original direct-SDK path runs unchanged.

---

## 2026-07-26 -- Phase 0: Expanded v2 tool belt

**What**: Added `execute_dml`, `manage_pipeline`, `export_data` tools to the v2 agent loop. Deleted `viz-intent.ts` (dead code). Kept `bq-tools.ts` (legacy handlers still import it). Extended confirmation gate in loop.ts to also intercept `execute_dml` calls. Added tool selection guidance to flash.ts system prompt. Added envelope-building branches in index.ts for DML, pipeline, and export results.

**Deviation from plan**: `bq-tools.ts` could not be deleted because `handle-query.ts` and `handle-conversation.ts` (legacy skill handlers) still import `BQ_TOOLS` and `BQ_TOOL_MAP` from it. These legacy handlers run when the v2 feature flag is off.

**Derived rule**: Before deleting any file, grep ALL of `src/` (not just `src/agent/`) to confirm zero imports. Legacy skill handlers in `src/lib/skills/` share types with the agent layer.

---

## 2026-07-26 -- Phase 1: Enriched tool contract with intent metadata

**What**: Added `TaskIntent` type to `types.ts`. Added `task_intent`, `visualization_hint`, `result_title`, and `suggested_follow_ups` parameters to `run_query` and `execute_dml` tool declarations. Updated `flash.ts` system prompt with INTENT METADATA guidance including visualization selection rules. Updated `index.ts` to extract intent metadata from tool call events and propagate into envelope headlines, visualization types, and follow-up chips.

**Derived rule**: Intent metadata flows through tool ARGUMENTS (set by the LLM), not tool RESULTS. The loop already stores `call.args` in `event.tool_args`, so new tool params are automatically available downstream.

## 2026-07-26 -- Phases 2+3: Multi-layered output and intent-aware storytelling

**What**: Added `secondaryArtifacts` array to `CompositionEnvelope` in `types.ts`. Created `CollapsibleSection.tsx` component (chevron toggle, vanilla CSS). Added rendering of secondaryArtifacts in `ArtifactCard.tsx` between companion artifact and next-action chips. Updated `composeQuery()` in `composer.ts` to generate a collapsed TABLE secondary artifact whenever the primary artifact is a chart type.

**Key design**: Intent-driven headlines and next-action chips are handled by the agent (via `result_title` and `suggested_follow_ups` tool params) rather than by hardcoded strategies in the composer. This follows the project's AI-first architecture invariant.

## 2026-07-26 -- Schema exploration priority fix

**What**: Fixed two bugs where exploring a dataset produced wrong output. (1) Dataset click in SchemaView sent "Tell me more about X" which the agent misinterpreted as an analytics question, running queries and producing KPI cards. Changed to "List the tables in X". (2) Envelope builder prioritized query events over schema events, so even when the agent used get_schema, any supplementary queries it also ran would cause the schema view to be skipped in favor of a query result or text wall. Reordered the if/else chain so schema events take priority over query events.

**Root cause**: The message phrasing was ambiguous to the LLM, AND the envelope builder's priority chain was wrong. Both had to be fixed.

**Derived rule**: Schema events must always produce a SCHEMA_VIEW envelope, even when the agent also ran supplementary queries. The envelope builder priority should be: DML > pipeline > export > **schema** > query > text. Also, click messages in SchemaView must use explicit action language ("List the tables in X") not vague exploratory language ("Tell me more about X").

---

## 2026-07-26 -- present_result tool and envelope priority fixes

**What**: Added `present_result` tool that lets the agent structure any text response as entity_list, key_values, summary, steps, or info. Created `PresentationView.tsx` component. Also fixed the envelope builder priority chain three times:

1. Schema events were ranked below query events, so dataset exploration produced text walls when the agent also ran supplementary queries. Moved schema above query.
2. present_result was initially ranked above schema, so it blocked SCHEMA_VIEW rendering when the agent called both. Moved present_result to the bottom (just above text fallback).
3. The agent was skipping tools entirely for schema requests (answering from context), producing raw text. Added system prompt rule forcing tool use for all resource browsing.

**Final priority chain**: DML > pipeline > export > schema > query > present_result > text.

**Derived rules**:
- Schema tools (get_schema, list_resources) must always produce SCHEMA_VIEW, regardless of what other tools were called.
- present_result should only trigger when no other structured tool (schema, query, DML, etc.) produced results.
- The agent must use schema/resource tools for listing and browsing even when it already knows the answer from context, because tools produce interactive visual output.
- Click messages in UI components must use natural language with entity-type context (e.g., "the X dataset") -- never hardcoded commands.

---

## 2026-07-26 -- Execution trace, clarification cards, planning phase, and alert simulation (CA Skills system patterns)

**What changed**: Added 4 features based on patterns from Google's internal CA skills system:
1. **Execution Trace (Pattern 3)**: Added `ExecutionTraceEntry` interface to `types.ts`. Agent loop step events (`tool_result`) are collected and attached to `CompositionEnvelope.provenance.executionTrace`. `ProvenancePanel.tsx` renders them as a collapsible step-by-step timeline.
2. **Clarification Cards (Pattern 2)**: Added `CLARIFICATION_CARD` artifact type, `ClarificationResult` and `ClarificationOption` interfaces in `types.ts`. Created `ClarificationCard.tsx` rendering inline options + text input. Added `composeClarification()` in `composer.ts`.
3. **Planning Phase (Pattern 1)**: Added `plan-tool.ts` (`plan_analysis` tool) to agent tool belt. Updated `flash.ts` prompt with planning instructions. `index.ts` intercepts plan ambiguity results and produces clarification card envelopes.
4. **Alert Simulation (Pattern 4)**: Added `AlertSimulation` interface in `types.ts`. Added `simulateAlert()` helper in `handle-monitoring.ts` running alert conditions against current data. `AlertView.tsx` renders simulation results with dual-interpretation framing for zero-fire results.

**What worked**: The execution trace gives full visibility into agent loop steps. Clarification cards allow the agent to resolve ambiguities interactively before executing expensive queries. Planning phase structures complex analytical tasks. Alert simulation tests alert rules against current data with clear zero-fire framing.

**Derived rules**:
- `plan_analysis` tool must be first in `PHASE_0_TOOLS` array so the model sees it before `run_query`.
- `CLARIFICATION_CARD` envelopes must have `presentation: 'inline'` and `skipSelfReview: true`.
- `executionTrace` only includes `tool_result` events (not `tool_start`) to avoid duplication.
- `simulateAlert` is best-effort and must never block alert creation on failure.



