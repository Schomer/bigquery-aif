# BigQuery Core Extended Operations

Service endpoint: `bigquery.googleapis.com`
API version: `v2`
These are advanced operations on the standard BigQuery API beyond basic query execution.

---

## Table Copy Jobs

Copy tables within or across projects, datasets, and regions using the Jobs API.

### Create Copy Job

```
POST https://bigquery.googleapis.com/bigquery/v2/projects/{project}/jobs
```

**Request body:**

```json
{
  "configuration": {
    "copy": {
      "sourceTable": {
        "projectId": "source-project",
        "datasetId": "source_dataset",
        "tableId": "source_table"
      },
      "destinationTable": {
        "projectId": "dest-project",
        "datasetId": "dest_dataset",
        "tableId": "dest_table"
      },
      "createDisposition": "CREATE_IF_NEEDED",
      "writeDisposition": "WRITE_TRUNCATE",
      "operationType": "COPY"
    }
  },
  "jobReference": {
    "projectId": "billing-project",
    "jobId": "copy_job_20250615_001",
    "location": "US"
  }
}
```

**Copy configuration fields:**

| Field | Type | Required | Description |
|---|---|---|---|
| `sourceTable` | TableReference | Yes (or `sourceTables`) | Source table to copy. |
| `sourceTables` | array of TableReference | No | Multiple source tables to copy into one destination (append). |
| `destinationTable` | TableReference | Yes | Destination table. |
| `createDisposition` | string | No | `CREATE_IF_NEEDED` (default) or `CREATE_NEVER`. |
| `writeDisposition` | string | No | `WRITE_TRUNCATE` (overwrite), `WRITE_APPEND`, or `WRITE_EMPTY` (fail if exists). |
| `operationType` | string | No | `COPY` (default), `SNAPSHOT`, or `CLONE`. |
| `destinationEncryptionConfiguration` | object | No | KMS key for destination. `{ "kmsKeyName": "projects/.../cryptoKeys/key1" }` |
| `destinationExpirationTime` | string | No | Expiration time for the destination table (RFC3339 timestamp). |

**TableReference structure:**

```json
{
  "projectId": "my-project",
  "datasetId": "my_dataset",
  "tableId": "my_table"
}
```

**Cross-region copy**: Supported. The job runs in the destination region. Set `jobReference.location` to the destination region. Cross-region copies incur egress charges.

**Table clone vs snapshot:**
- `operationType: "CLONE"`: Creates a lightweight clone that shares storage with the source until modified. Near-zero cost and near-instant.
- `operationType: "SNAPSHOT"`: Creates a read-only point-in-time snapshot. Cannot be modified.
- `operationType: "COPY"`: Full independent copy (default).

### Get Job Status

```
GET https://bigquery.googleapis.com/bigquery/v2/projects/{project}/jobs/{jobId}?location={location}
```

**Response (relevant fields):**

```json
{
  "status": {
    "state": "DONE",
    "errors": [],
    "errorResult": null
  },
  "statistics": {
    "creationTime": "1718438400000",
    "startTime": "1718438401000",
    "endTime": "1718438410000",
    "copy": {
      "copiedRows": "150000",
      "copiedLogicalBytes": "52428800"
    }
  }
}
```

Job states: `PENDING`, `RUNNING`, `DONE`

---

## Dataset Operations

### Copy Dataset (Cross-Region)

BigQuery does not have a single REST call for dataset copy. Use the BigQuery Data Transfer Service with `dataSourceId: "cross_region_copy"`:

```
POST https://bigquerydatatransfer.googleapis.com/v1/projects/{project}/locations/{destination_location}/transferConfigs
```

```json
{
  "displayName": "Copy analytics dataset to EU",
  "dataSourceId": "cross_region_copy",
  "destinationDatasetId": "analytics_eu",
  "params": {
    "source_project_id": "my-project",
    "source_dataset_id": "analytics",
    "overwrite_destination_table": "true"
  },
  "schedule": ""
}
```

Setting `schedule` to empty string means one-time copy. Trigger with `startManualRuns`.

### Create Dataset

```
POST https://bigquery.googleapis.com/bigquery/v2/projects/{project}/datasets
```

```json
{
  "datasetReference": {
    "projectId": "my-project",
    "datasetId": "new_dataset"
  },
  "location": "US",
  "description": "Analytics staging dataset",
  "defaultTableExpirationMs": "7776000000",
  "labels": {
    "team": "analytics",
    "env": "production"
  }
}
```

### Update Dataset

```
PATCH https://bigquery.googleapis.com/bigquery/v2/projects/{project}/datasets/{datasetId}
```

Partial update. Include only fields to change.

### Delete Dataset

```
DELETE https://bigquery.googleapis.com/bigquery/v2/projects/{project}/datasets/{datasetId}?deleteContents={true|false}
```

Set `deleteContents=true` to delete all tables within the dataset. If `false` (default), the delete fails if the dataset is not empty.

---

## Routine Management (UDFs and Stored Procedures)

### Create Routine

```
POST https://bigquery.googleapis.com/bigquery/v2/projects/{project}/datasets/{datasetId}/routines
```

**UDF example (SQL):**

```json
{
  "routineReference": {
    "projectId": "my-project",
    "datasetId": "my_dataset",
    "routineId": "parse_domain"
  },
  "routineType": "SCALAR_FUNCTION",
  "language": "SQL",
  "definitionBody": "REGEXP_EXTRACT(url, r'https?://([^/]+)')",
  "arguments": [
    {
      "name": "url",
      "dataType": {
        "typeKind": "STRING"
      },
      "mode": "IN"
    }
  ],
  "returnType": {
    "typeKind": "STRING"
  }
}
```

**Stored procedure example:**

```json
{
  "routineReference": {
    "projectId": "my-project",
    "datasetId": "my_dataset",
    "routineId": "refresh_materialized_view"
  },
  "routineType": "PROCEDURE",
  "language": "SQL",
  "definitionBody": "BEGIN\n  CREATE OR REPLACE TABLE my_dataset.daily_summary AS\n  SELECT date, SUM(amount) AS total\n  FROM my_dataset.transactions\n  GROUP BY date;\nEND;"
}
```

**UDF example (JavaScript):**

```json
{
  "routineReference": {
    "projectId": "my-project",
    "datasetId": "my_dataset",
    "routineId": "sanitize_html"
  },
  "routineType": "SCALAR_FUNCTION",
  "language": "JAVASCRIPT",
  "definitionBody": "return input.replace(/<[^>]*>/g, '');",
  "arguments": [
    {
      "name": "input",
      "dataType": { "typeKind": "STRING" }
    }
  ],
  "returnType": { "typeKind": "STRING" }
}
```

**Table-valued function (TVF):**

```json
{
  "routineType": "TABLE_VALUED_FUNCTION",
  "language": "SQL",
  "definitionBody": "SELECT * FROM my_dataset.orders WHERE customer_id = cust_id",
  "arguments": [
    {
      "name": "cust_id",
      "dataType": { "typeKind": "INT64" }
    }
  ],
  "returnTableType": {
    "columns": [
      { "name": "order_id", "type": { "typeKind": "INT64" } },
      { "name": "amount", "type": { "typeKind": "FLOAT64" } }
    ]
  }
}
```

**Routine type values:** `SCALAR_FUNCTION`, `PROCEDURE`, `TABLE_VALUED_FUNCTION`, `AGGREGATE_FUNCTION`
**Language values:** `SQL`, `JAVASCRIPT`, `PYTHON` (preview), `SCALA` (preview)

**Type kind values for arguments/return types:** `INT64`, `FLOAT64`, `NUMERIC`, `BIGNUMERIC`, `BOOL`, `STRING`, `BYTES`, `DATE`, `DATETIME`, `TIME`, `TIMESTAMP`, `GEOGRAPHY`, `JSON`, `ARRAY`, `STRUCT`, `INTERVAL`

### Get Routine

```
GET https://bigquery.googleapis.com/bigquery/v2/projects/{project}/datasets/{datasetId}/routines/{routineId}
```

### List Routines

```
GET https://bigquery.googleapis.com/bigquery/v2/projects/{project}/datasets/{datasetId}/routines
```

Query parameters:
- `pageToken` (string)
- `maxResults` (int)
- `filter` (string): Filter by routine type, e.g., `routineType:SCALAR_FUNCTION`

### Update Routine

```
PUT https://bigquery.googleapis.com/bigquery/v2/projects/{project}/datasets/{datasetId}/routines/{routineId}
```

Full replacement -- send the complete routine resource.

### Delete Routine

```
DELETE https://bigquery.googleapis.com/bigquery/v2/projects/{project}/datasets/{datasetId}/routines/{routineId}
```

---

## Materialized Views

Materialized views are managed via the Tables API (a materialized view is a table resource with `materializedView` set).

### Create Materialized View

```
POST https://bigquery.googleapis.com/bigquery/v2/projects/{project}/datasets/{datasetId}/tables
```

```json
{
  "tableReference": {
    "projectId": "my-project",
    "datasetId": "my_dataset",
    "tableId": "mv_daily_revenue"
  },
  "materializedView": {
    "query": "SELECT DATE(order_time) AS day, SUM(amount) AS revenue, COUNT(*) AS order_count FROM my_dataset.orders GROUP BY 1",
    "enableRefresh": true,
    "refreshIntervalMs": "1800000"
  }
}
```

**Fields:**

| Field | Type | Description |
|---|---|---|
| `materializedView.query` | string | The SQL query defining the view. Must be an aggregate query. |
| `materializedView.enableRefresh` | boolean | Whether automatic refresh is enabled (default true). |
| `materializedView.refreshIntervalMs` | string | Minimum refresh interval in milliseconds. Minimum is `1800000` (30 minutes). Default is `1800000`. |
| `materializedView.lastRefreshTime` | string | Read-only. Last refresh timestamp. |

### Update Materialized View Refresh Settings

```
PATCH https://bigquery.googleapis.com/bigquery/v2/projects/{project}/datasets/{datasetId}/tables/{tableId}
```

```json
{
  "materializedView": {
    "enableRefresh": true,
    "refreshIntervalMs": "3600000"
  }
}
```

### Manual Refresh (via DDL)

Materialized views do not have a REST API for manual refresh. Use a query job:

```sql
CALL BQ.REFRESH_MATERIALIZED_VIEW('my-project.my_dataset.mv_daily_revenue');
```

### Delete Materialized View

```
DELETE https://bigquery.googleapis.com/bigquery/v2/projects/{project}/datasets/{datasetId}/tables/{tableId}
```

Same as deleting a regular table.

---

## Row-Level Security (Row Access Policies)

Row access policies filter rows based on the querying user's identity. Managed via DDL (no direct REST endpoint for policy CRUD).

### Create Row Access Policy (via DDL query job)

```sql
CREATE ROW ACCESS POLICY region_filter
ON my_dataset.sales_data
GRANT TO ('user:analyst@example.com', 'group:us-team@example.com')
FILTER USING (region = 'US');
```

### Create Policy Granting Access to All Rows

```sql
CREATE ROW ACCESS POLICY admin_all_access
ON my_dataset.sales_data
GRANT TO ('user:admin@example.com')
FILTER USING (TRUE);
```

### Drop Row Access Policy

```sql
DROP ROW ACCESS POLICY region_filter ON my_dataset.sales_data;
```

### Drop All Row Access Policies on a Table

```sql
DROP ALL ROW ACCESS POLICIES ON my_dataset.sales_data;
```

### List Row Access Policies

```
GET https://bigquery.googleapis.com/bigquery/v2/projects/{project}/datasets/{datasetId}/tables/{tableId}/rowAccessPolicies
```

**Response:**

```json
{
  "rowAccessPolicies": [
    {
      "rowAccessPolicyReference": {
        "projectId": "my-project",
        "datasetId": "my_dataset",
        "tableId": "sales_data",
        "policyId": "region_filter"
      },
      "filterPredicate": "region = 'US'",
      "grantees": [
        "user:analyst@example.com",
        "group:us-team@example.com"
      ],
      "creationTime": "2025-01-15T10:00:00Z",
      "lastModifiedTime": "2025-01-15T10:00:00Z"
    }
  ]
}
```

---

## Authorized Views and Datasets

Authorized views allow a view in one dataset to query data in another dataset, even if the view's users do not have direct access to the source dataset.

### Grant a View Authorization on a Dataset

Use the dataset `access` list via the Datasets API:

```
PATCH https://bigquery.googleapis.com/bigquery/v2/projects/{project}/datasets/{datasetId}
```

```json
{
  "access": [
    {
      "view": {
        "projectId": "my-project",
        "datasetId": "reporting",
        "tableId": "customer_summary_view"
      }
    }
  ]
}
```

This adds the view `reporting.customer_summary_view` as an authorized view on the patched dataset. The view can now query tables in this dataset regardless of the end user's permissions on the source dataset.

IMPORTANT: When patching `access`, you must include ALL existing access entries plus the new one. A PATCH to `access` replaces the entire list. Fetch the current dataset first, append the new entry, then PATCH.

### Authorize an Entire Dataset

```json
{
  "access": [
    {
      "dataset": {
        "dataset": {
          "projectId": "my-project",
          "datasetId": "reporting"
        },
        "targetTypes": ["VIEWS"]
      }
    }
  ]
}
```

This authorizes ALL views in the `reporting` dataset to query tables in the patched dataset.

---

## Common Errors

| Error | Cause | Fix |
|---|---|---|
| `404 NOT_FOUND: Table not found` | Source or destination table/dataset does not exist | Verify table and dataset names. Check project ID. |
| `403 ACCESS_DENIED` | Caller lacks permissions on source or destination | Grant `roles/bigquery.dataViewer` on source, `roles/bigquery.dataEditor` on destination. |
| `409 ALREADY_EXISTS` | Destination table exists and `writeDisposition` is `WRITE_EMPTY` | Use `WRITE_TRUNCATE` or `WRITE_APPEND`, or delete the existing table first. |
| `400 INVALID_ARGUMENT: Materialized view query must be an aggregate` | MV query has no GROUP BY or aggregation | Rewrite query to include at least one aggregate function and a GROUP BY clause. |
| Cross-region copy fails with location error | Job location does not match destination | Set `jobReference.location` to the destination dataset's region. |
