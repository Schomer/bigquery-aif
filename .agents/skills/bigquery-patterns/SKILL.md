---
name: bigquery-patterns
description: BigQuery SQL patterns, INFORMATION_SCHEMA usage, and API integration patterns for this application. Use when generating SQL, working with BigQuery APIs, or debugging query issues.
---

# BigQuery Patterns

SQL generation patterns, INFORMATION_SCHEMA reference, cost management, and API integration for the BigQuery AIF application.

---

## SQL generation patterns

### Date filtering (partition-pruning compatible)

```sql
-- Use DATE() -- it is partition-pruning compatible
WHERE DATE(created_at) >= '2024-01-01'

-- Do NOT use CAST -- it may prevent partition pruning
WHERE CAST(created_at AS DATE) >= '2024-01-01'

-- For ingestion-time partitioned tables:
WHERE _PARTITIONTIME >= TIMESTAMP('2024-01-01')
```

The schema skill returns partitioning info (`{ field: 'order_date', type: 'DAY' }`). Always inject a partition filter when the table is partitioned.

### Time series aggregation

```sql
SELECT
  DATE_TRUNC(order_date, MONTH) AS month,
  COUNT(*) AS order_count,
  SUM(revenue) AS total_revenue
FROM `project.dataset.orders`
GROUP BY month
ORDER BY month
```

- Always `ORDER BY` the time column ascending
- Always alias the truncated column
- Suggested visualization: `LINE_CHART`

### Top-N queries

```sql
SELECT category, COUNT(*) AS order_count
FROM `project.dataset.orders`
GROUP BY category
ORDER BY order_count DESC
LIMIT 20
```

- Default LIMIT is 20 unless the user specifies otherwise
- Suggested visualization: `COLUMN_CHART` for 5-15 categories, `BAR_CHART` for horizontal layout or long labels

### Deduplication

```sql
-- Find duplicate groups (read-only)
SELECT col1, col2, COUNT(*) AS dup_count
FROM `project.dataset.table`
GROUP BY col1, col2
HAVING COUNT(*) > 1
ORDER BY dup_count DESC

-- Remove duplicates (DML -- requires confirmation)
CREATE OR REPLACE TABLE `project.dataset.table` AS
SELECT * EXCEPT(row_num) FROM (
  SELECT *, ROW_NUMBER() OVER (
    PARTITION BY col1, col2
    ORDER BY updated_at DESC
  ) AS row_num
  FROM `project.dataset.table`
)
WHERE row_num = 1
```

- PARTITION BY columns = the dedup key
- ORDER BY in the window function = which row to keep (usually most recent)
- The data-management handler generates both preview SQL and execution SQL

### Single aggregate (KPI)

```sql
SELECT COUNT(*) AS total_orders
FROM `project.dataset.orders`
```

- Single-row, single-column results use `KPI_CARD` visualization
- The composer detects this shape automatically

### String entity filtering

```sql
-- Use LIKE for entity names -- exact match almost never works on real data
WHERE UPPER(store_name) LIKE UPPER('%HY-VEE FOOD STORE%')

-- Use prefix match for brand/chain names:
WHERE UPPER(store_name) LIKE UPPER('HY-VEE%')

-- Reserve = for short enumerated values: status codes, state abbreviations, boolean flags
WHERE status = 'active'
```

### Null analysis

```sql
SELECT
  COUNTIF(column_name IS NULL) AS null_count,
  COUNT(*) AS total_count,
  ROUND(COUNTIF(column_name IS NULL) / COUNT(*) * 100, 2) AS null_pct
FROM `project.dataset.table`
```

---

## INFORMATION_SCHEMA quick reference

| View | Use case | Scope |
|------|----------|-------|
| `INFORMATION_SCHEMA.TABLES` | List tables in a dataset, get table type and creation time | Dataset |
| `INFORMATION_SCHEMA.COLUMNS` | Column names, data types, nullability, ordinal position | Dataset |
| `INFORMATION_SCHEMA.JOBS_BY_PROJECT` | Job history: bytes processed, duration, errors, referenced tables | Project (requires region) |
| `INFORMATION_SCHEMA.TABLE_STORAGE` | Row counts, logical/active bytes per table | Dataset or project |
| `INFORMATION_SCHEMA.PARTITIONS` | Partition-level last modified times, row counts | Dataset |
| `INFORMATION_SCHEMA.OBJECT_PRIVILEGES` | Granted permissions on datasets/tables | Dataset |
| `INFORMATION_SCHEMA.TABLE_CONSTRAINTS` | Declared primary/foreign keys (rarely populated) | Dataset |
| `INFORMATION_SCHEMA.KEY_COLUMN_USAGE` | Columns involved in declared constraints | Dataset |

### Region requirement

Project-level INFORMATION_SCHEMA queries require a region qualifier:

```sql
SELECT * FROM `project`.`region-US`.INFORMATION_SCHEMA.JOBS_BY_PROJECT
```

The app detects region via `detectBqRegion()` which checks the first dataset's location. Default is `US`.

---

## Cost tier thresholds

| Tier | Bytes scanned | Behavior |
|------|---------------|----------|
| 1 | < 100MB | Execute immediately |
| 2 | 100MB - 1GB | Execute immediately |
| 3 | 1GB - 10GB | Show cost warning, require user confirmation |
| 4 | 10GB+ | Show strong warning, require user confirmation |

- `dryRun()` must be called before `executeQuery()` for user-initiated queries
- Dry run returns `totalBytesProcessed` without executing
- Partition pruning dramatically reduces bytes scanned

---

## Type coercion rules

BigQuery REST API returns all cell values as strings. `coerceValue()` in `bigquery-client.ts` converts them:

| BigQuery type | JS type | Notes |
|---------------|---------|-------|
| INTEGER, INT64 | `number` | via `Number()` |
| FLOAT, FLOAT64, NUMERIC, BIGNUMERIC | `number` | via `Number()` |
| BOOLEAN, BOOL | `boolean` | string comparison |
| TIMESTAMP, DATE, DATETIME, TIME | `string` | kept as string, formatted for display |
| GEOGRAPHY | `string` | kept as WKT string |
| RECORD/STRUCT | `object` | nested structure |
| BYTES | `string` | base64-encoded |

---

## Common pitfalls

1. **Partitioned tables need date filters**: queries without a partition filter scan the entire table. Always check schema for partitioning info and inject a filter.

2. **GEOGRAPHY columns cannot use DISTINCT/MIN/MAX**: `GROUP BY` does not work on GEOGRAPHY columns. Cast to `ST_ASTEXT()` first.

3. **Nested RECORD fields need UNNEST**: `RECORD` (struct) and `REPEATED` (array) types cannot be displayed in a flat table without `UNNEST(array_column)` in a cross join, or `column.nested_field` for struct access.

4. **Project names with hyphens need backtick-wrapping**: all fully qualified table references must use backticks: `` `project-name.dataset.table` ``. This is a system invariant.

5. **DISTINCT does not work on STRUCT, ARRAY, or JSON columns**: the auto-retry handler knows to exclude these, but generated SQL should avoid them proactively.

6. **Pagination is mandatory for list operations**: both dataset and table listing loop on `nextPageToken`. Never assume a single page is complete.

7. **Table constraints are almost always empty**: BigQuery supports declaring PK/FK but does not enforce them. Fall back to heuristic column matching.

---

## Google Cloud data API reference

| API | When to use |
|-----|-------------|
| **BigQuery API** (`bigquery.googleapis.com`) | Core: queries, DML, DDL, schema listing, dry runs, job management |
| **Data Transfer API** (`bigquerydatatransfer.googleapis.com`) | Scheduled queries, recurring transfers from SaaS sources |
| **Sheets API** (`sheets.googleapis.com`) | Export query results to Google Sheets |
| **Cloud Storage API** (`storage.googleapis.com`) | Load jobs read from GCS, extract jobs write to GCS |
| **Dataplex / Knowledge Catalog** (`dataplex.googleapis.com`) | Cross-project table search, data quality scans, column-level security tags |
| **Data Lineage API** (part of Knowledge Catalog) | Table/column lineage: "where did this data come from", "what depends on this table" |
| **Cloud DLP API** (`dlp.googleapis.com`) | Sensitive data detection and masking |
| **Cloud Monitoring API** (`monitoring.googleapis.com`) | Slot utilization metrics, alert policies for system-level conditions |
| **Cloud Scheduler** | Cron-based job triggers (alternative to Data Transfer for custom scheduling) |
| **Cloud Logging API** (`logging.googleapis.com`) | Audit logs: "who did what, when" for BigQuery operations |

See `docs from claude/bigquery-capability-catalog.md` for the full inventory.
