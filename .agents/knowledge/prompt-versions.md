# Prompt Version Tracking

The app's behavior is heavily driven by the prompts sent to Gemini. This file tracks the key prompts, where they live, and when/why they changed. Prompt changes are high-impact and should be tested against the canonical test cases before deploying.

Last updated: 2026-07-16

---

## Critical Prompts

### 1. Data Assistant System Instruction
- **Location**: `src/lib/chat-orchestrator.ts`, line 59 (`DATA_ASSISTANT_INSTRUCTIONS`)
- **Prepended to**: Every Gemini call via `callGemini()`
- **Purpose**: Sets the assistant's persona and behavioral rules
- **Key rules in this prompt**:
  - Act, don't explain how to act
  - Make best interpretation and execute
  - Pause only for permanent data changes
  - Lead with results, not descriptions
  - Always backtick-wrap fully qualified table references
- **Risk**: Changes here affect ALL skill outputs. Test thoroughly.

### 2. Intent Classifier Prompt
- **Location**: `src/lib/chat-orchestrator.ts`, lines 453-472 (inline in `processMessage()`)
- **Called when**: Router returns medium/low confidence
- **Purpose**: LLM-based skill classification and multistep detection
- **Key rules in this prompt**:
  - Single verb + single object = never multistep
  - Analytical phrases are read-only query operations, never data-management
  - Explicit multi-action language required for multistep
- **References**: `public/skills/intent-routing.md` (loaded at runtime)
- **Risk**: Changes here affect how ambiguous messages get routed. Always test R5, R6, R7 from test-cases.md.

### 3. Query Skill Prompt
- **Location**: `src/lib/chat-orchestrator.ts`, lines 1233-1271 (inline in `handleQuery()`)
- **Purpose**: SQL generation + visualization selection
- **Key rules**:
  - Must generate `resultSummary` for headline
  - Visualization enum must match `QueryResponseSchema`
  - Column chart != bar chart (explicit distinction)
  - Today's date is injected for temporal queries
- **Also loads**: `public/skills/query.md` via `loadSkillDoc('query')`

### 4. SQL Repair Prompt
- **Location**: `src/lib/chat-orchestrator.ts`, lines 1318-1326 (inline in `handleQuery()` catch block)
- **Purpose**: Fix BigQuery syntax errors on auto-retry
- **Key rules**:
  - GEOGRAPHY columns: use ST_ASTEXT() or exclude
  - STRUCT/ARRAY/JSON: exclude from DISTINCT
  - Backtick-wrap hyphenated identifiers
- **Risk**: Low -- only fires on query failure. But changes could cause infinite retry loops if not careful.

### 5. Self-Review Prompt
- **Location**: `src/lib/chat-orchestrator.ts`, lines 1066-1130 (inline in `selfReviewEnvelope()`)
- **Purpose**: Post-composition quality check
- **Reviews**: Comprehension, completeness, presentation, visual design
- **Can override**: Headline text, visualization type, x/y axis, column emphasis
- **Risk**: Changes affect the polish of all responses. Non-fatal (errors return original envelope).

### 6. Schema Enrichment Prompt
- **Location**: `src/lib/chat-orchestrator.ts`, lines 932-949 (inline in `handleSchema()`)
- **Purpose**: Generate INFORMATION_SCHEMA SQL for complex listing requests
- **Key rules**:
  - First column must be the entity identifier (dataset_name or table_name)
  - Use descriptive column aliases
  - Backtick-wrap identifiers with hyphens

---

## Skill Definition Prompts (Runtime)

Loaded from `public/skills/*.md` by `loadSkillDoc()`. Cached in memory.

| File | Used By | Purpose |
|------|---------|--------|
| `intent-routing.md` | Intent classifier | Routing reference table |
| `schema.md` | Schema LLM fallback | Scope classification |
| `query.md` | Query handler | SQL generation rules |
| `data-management.md` | Data management handler | DML/DDL planning |
| `data-quality.md` | Data quality handler | Check type classification |
| `monitoring.md` | Monitoring handler | Sub-type classification |
| `discovery.md` | Discovery handler | Discovery type classification |
| `data-loading.md` | Data loading handler | Operation classification |

---

## Prompt Change Log

### 2026-06-30 (initial tracking)
- All prompts documented at current state
- No prior change history available

### 2026-07-07: Added string filtering guidance to query skill prompt
- **File**: `public/skills/query.md`
- **What changed**: Added new "String filtering (entity names, categories, labels)" section after "SQL rules"
- **Why**: LLM was using `=` for entity name filters (store name, vendor, etc.) causing zero-row results when actual values contain suffixes/qualifiers
- **Key rules added**: Default to `UPPER(column) LIKE UPPER('%value%')`, include filtered column in output when matches could be ambiguous, use sample values from schema context when available

### 2026-07-10: Zero-row diagnostic rules added to query skill prompt
- **File**: `src/lib/composer.ts` (via `buildQueryHeadline()` rules)
- **What changed**: Zero-row results now always use SQL-aware diagnostic headlines, never the LLM `resultSummary`
- **Why**: LLM summary is written at generation time before results are known; it cannot produce an accurate zero-row message
- **Key rules**: INFORMATION_SCHEMA queries get "No metadata returned -- check region and permissions"; WHERE-filtered queries get "No rows matched your filter criteria"; generic queries get "Query returned no results"

### 2026-07-12: Aggregation patterns ("by X" = GROUP BY) added to query.md
- **File**: `public/skills/query.md`
- **What changed**: Added CRITICAL aggregation section with wrong/correct examples for 5 common "by X" patterns
- **Why**: LLM was returning raw SELECT rows for questions like "orders by status" instead of GROUP BY aggregations
- **Key rules added**: "By X" always means GROUP BY X. "Top N [entity]" must GROUP BY entity and ORDER BY metric DESC LIMIT N. Never return scalar COUNT(*) for a top-N question.

### 2026-07-14: Filter column leak rule added to query.md
- **File**: `public/skills/query.md`
- **What changed**: Added SQL rule prohibiting SELECT of columns used only in WHERE filters
- **Why**: LLM was including filter columns (e.g. `year = 900`) in SELECT/GROUP BY, producing a constant-valued second categorical column that triggered HEATMAP instead of bar chart
- **Key rule**: Do NOT SELECT columns that are only used as WHERE filters. Correct: `WHERE year = 900 GROUP BY country`. Wrong: `SELECT country, year ... GROUP BY country, year`.

### 2026-07-14: Literal type matching rule added to query.md
- **File**: `public/skills/query.md`
- **What changed**: Added rule requiring matching literal types to column types in WHERE clauses
- **Why**: LLM was writing `WHERE Year = '2023'` against INT64 columns, causing type mismatch errors. Also added BOOL rule (`TRUE`/`FALSE` not `'TRUE'` or `1`).
- **Key rule**: INTEGER/INT64 columns require unquoted numeric literals. STRING columns require quoted strings. BOOL columns use unquoted `TRUE`/`FALSE`.

### 2026-07-15: Implicit year/date filter prohibition added to query.md
- **File**: `public/skills/query.md`
- **What changed**: Added CRITICAL rule prohibiting implicit year/date filters based on today's date
- **Why**: LLM was interpreting "Today's date: 2026-07-15" in the system prompt as a signal to add `WHERE Year = 2026`, returning 0 rows from historical datasets (e.g., population data, scientific records)
- **Key rule**: Today's date is for relative range computation only ("last 30 days"). Never add implicit recency filters. Use `WHERE year = (SELECT MAX(year) FROM ...)` when no year is specified.

### 2026-07-15: Multi-entity IN filter rule added to query.md
- **File**: `public/skills/query.md`
- **What changed**: Added rule requiring `IN (...)` with case-insensitive matching when the user names multiple specific entities
- **Why**: LLM was omitting filters or using single-value filters for multi-entity questions (e.g., "China and USA"), returning all rows (alphabetically, Aruba first)
- **Key rule**: Multiple named entities always require `WHERE LOWER(col) IN ('a', 'b')` with common name variants. Never omit the filter.

### 2026-07-15: Interactive widget mode added to query.md
- **File**: `public/skills/query.md`
- **What changed**: Added "Interactive Widget Mode" section. Defines `{{start_date}}`/`{{end_date}}` placeholders, WIDGET_SPEC JSON format, and CRITICAL list of what must NOT trigger widget mode.
- **Why**: New feature for date-range-picker and multi-select filter widgets. Without the CRITICAL list, LLM was triggering widget mode for "top N" ranking queries, producing meaningless spike charts.
- **Key rule**: Interactive widgets are for user-driven exploration. Ranking queries ("top N", "biggest", "which X has the highest Y") have a fixed answer and must use direct SQL with BAR/COLUMN chart.

### 2026-07-15: INFORMATION_SCHEMA.JOBS template added to query.md
- **File**: `public/skills/query.md`
- **What changed**: Added INFORMATION_SCHEMA.JOBS section with correct region-level syntax and a ready-to-use SQL template for "most expensive queries in past N days"
- **Why**: Without a template, the LLM looped exhaustively calling `list_tables` and `get_table_schema` trying to find JOBS, exhausting the 10-iteration cap before ever writing SQL
- **Key rule**: Any INFORMATION_SCHEMA view not dataset-scoped (JOBS, RESERVATION_*, etc.) needs an explicit SQL template. Do NOT call `get_table_schema` or `list_tables` for these views.

### 2026-07-15: BOOL/MULTI_SELECT scope rules added to query.md
- **File**: `public/skills/query.md`
- **What changed**: Added rule that BOOL columns use unquoted `TRUE`/`FALSE` in WHERE clauses. Added note that MULTI_SELECT widget is for STRING/categorical columns only; use DROPDOWN for numeric dimensions.
- **Why**: LLM was generating `WHERE active = 'TRUE'` (string) against BOOL columns, and using MULTI_SELECT for numeric year columns producing quoted integer strings like `WHERE year IN ('2020', '2021')`.

---

## Rules for Changing Prompts

1. **Document the change**: Add an entry to the change log above with date, what changed, and why
2. **Test routing changes**: Run test cases R1-R10 from test-cases.md
3. **Test query changes**: Verify Q1-Q4 from test-cases.md
4. **Never change the model**: Prompt changes must not include model changes. Model is always `gemini-3.5-flash`.
5. **Keep behavioral instructions stable**: The DATA_ASSISTANT_INSTRUCTIONS prompt should rarely change. It defines the app's core personality.
