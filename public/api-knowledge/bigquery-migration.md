# BigQuery Migration API -- SQL Translation

Service endpoint: `bigquerymigration.googleapis.com`
API version: `v2`
Required IAM permission: `bigquerymigration.translateQuery` on the project
Required API: `BigQuery Migration API` must be enabled on the project

---

## translateQuery -- Single Query Translation

Translates a single SQL statement from a source dialect to GoogleSQL (BigQuery SQL).

### Endpoint

```
POST https://bigquerymigration.googleapis.com/v2/projects/{project}/locations/{location}:translateQuery
```

**Path parameters:**
- `project` (required): Google Cloud project ID or number
- `location` (required): Processing location. Use `us` or `eu` for multi-region, or a specific region like `us-central1`

### Request Body

```json
{
  "sourceDialect": {
    "<dialect_key>": {}
  },
  "query": "SELECT TOP 10 * FROM my_table WHERE col1 IS NOT NULL",
  "targetDialect": {
    "bigquery": {}
  }
}
```

**Fields:**

| Field | Type | Required | Description |
|---|---|---|---|
| `sourceDialect` | object | Yes | Source SQL dialect. Exactly one dialect key must be set. |
| `query` | string | Yes | The SQL query string to translate. |
| `targetDialect` | object | No | Target dialect. Defaults to `bigquery` if omitted. Currently only `bigquery` is supported as target. |

### Supported Source Dialect Keys

Each key is set to an empty object `{}` unless noted otherwise:

| Dialect Key | Database System |
|---|---|
| `teradata` | Teradata SQL |
| `snowflake` | Snowflake SQL |
| `redshift` | Amazon Redshift |
| `hiveql` | Apache Hive HQL |
| `sparksql` | Apache Spark SQL |
| `oracle` | Oracle SQL / PL/SQL |
| `sqlserver` | Microsoft SQL Server / T-SQL |
| `presto` | Presto / Trino SQL |
| `mysql` | MySQL |
| `postgresql` | PostgreSQL |
| `netezza` | IBM Netezza |
| `vertica` | Vertica SQL |
| `azureSynapse` | Azure Synapse Analytics |

The `teradata` dialect object supports an optional mode field:

```json
{
  "sourceDialect": {
    "teradata": {
      "mode": "SQL"
    }
  }
}
```

Teradata mode values: `SQL` (default), `BTEQ`, `STORED_PROCEDURE`

### Response Body

```json
{
  "translatedQuery": "SELECT * FROM my_table WHERE col1 IS NOT NULL LIMIT 10",
  "errors": [],
  "warnings": []
}
```

**Fields:**

| Field | Type | Description |
|---|---|---|
| `translatedQuery` | string | The translated GoogleSQL query. May be empty if translation fails entirely. |
| `errors` | array of `TranslationError` | Fatal translation errors. If present, `translatedQuery` may be partial or empty. |
| `warnings` | array of `TranslationWarning` | Non-fatal warnings about the translation (e.g., approximate conversions). |

**TranslationError / TranslationWarning structure:**

```json
{
  "message": "Unsupported function: TD_NORMALIZE_UNICODE",
  "category": "UNSUPPORTED_FUNCTION",
  "row": 3,
  "col": 15
}
```

### Example: Translate Teradata SQL

**Request:**

```
POST https://bigquerymigration.googleapis.com/v2/projects/my-project/locations/us:translateQuery
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "sourceDialect": {
    "teradata": {
      "mode": "SQL"
    }
  },
  "query": "SELECT TOP 100 customer_id, customer_name FROM customers WHERE region = 'US' ORDER BY customer_name;"
}
```

**Response:**

```json
{
  "translatedQuery": "SELECT customer_id, customer_name FROM customers WHERE region = 'US' ORDER BY customer_name LIMIT 100;",
  "errors": [],
  "warnings": []
}
```

### Example: Translate Snowflake SQL

**Request:**

```json
{
  "sourceDialect": {
    "snowflake": {}
  },
  "query": "SELECT customer_id, DATEDIFF('day', created_at, CURRENT_TIMESTAMP()) AS days_since_creation, NVL(email, 'unknown') AS email FROM customers QUALIFY ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY updated_at DESC) = 1"
}
```

**Response:**

```json
{
  "translatedQuery": "SELECT customer_id, DATE_DIFF(CURRENT_TIMESTAMP(), created_at, DAY) AS days_since_creation, IFNULL(email, 'unknown') AS email FROM customers QUALIFY ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY updated_at DESC) = 1",
  "errors": [],
  "warnings": []
}
```

---

## Migration Workflows -- Batch Translation via GCS

For translating large volumes of SQL files, use migration workflows that read from and write to Cloud Storage.

### Create Migration Workflow

```
POST https://bigquerymigration.googleapis.com/v2/projects/{project}/locations/{location}/workflows
```

**Request body:**

```json
{
  "displayName": "teradata-migration-batch-1",
  "tasks": [
    {
      "type": "Translation",
      "translationConfigDetails": {
        "sourceDialect": {
          "teradata": {
            "mode": "SQL"
          }
        },
        "sourceEnv": {
          "defaultDatabase": "source_db",
          "schemaSearchPath": ["schema1", "schema2"]
        },
        "sourceTargetMapping": [
          {
            "sourceLocation": {
              "gcsLocation": {
                "path": "gs://my-bucket/input-sql/"
              }
            },
            "targetLocation": {
              "gcsLocation": {
                "path": "gs://my-bucket/output-sql/"
              }
            }
          }
        ],
        "nameMappingList": {
          "nameMappings": [
            {
              "source": {
                "database": "old_db",
                "schema": "old_schema"
              },
              "target": {
                "database": "new_project",
                "schema": "new_dataset"
              }
            }
          ]
        }
      }
    }
  ]
}
```

### Start Migration Workflow

```
POST https://bigquerymigration.googleapis.com/v2/projects/{project}/locations/{location}/workflows/{workflow_id}:start
```

No request body required. Returns a long-running operation.

### Get Migration Workflow Status

```
GET https://bigquerymigration.googleapis.com/v2/projects/{project}/locations/{location}/workflows/{workflow_id}
```

**Response includes:**

```json
{
  "name": "projects/my-project/locations/us/workflows/abc123",
  "displayName": "teradata-migration-batch-1",
  "state": "COMPLETED",
  "tasks": [
    {
      "type": "Translation",
      "state": "SUCCEEDED",
      "totalProcessedStatements": 450,
      "totalSuccessfulStatements": 442,
      "totalFailedStatements": 8
    }
  ],
  "createTime": "2025-01-15T10:00:00Z",
  "lastUpdateTime": "2025-01-15T10:15:32Z"
}
```

Workflow states: `DRAFT`, `RUNNING`, `PAUSED`, `COMPLETED`, `FAILED`
Task states: `PENDING`, `RUNNING`, `SUCCEEDED`, `FAILED`

### List Migration Workflows

```
GET https://bigquerymigration.googleapis.com/v2/projects/{project}/locations/{location}/workflows
```

Optional query parameters:
- `pageSize` (int): Max results per page (default 50, max 1000)
- `pageToken` (string): Pagination token from previous response

### Delete Migration Workflow

```
DELETE https://bigquerymigration.googleapis.com/v2/projects/{project}/locations/{location}/workflows/{workflow_id}
```

---

## Common Errors and Fixes

| Error | Cause | Fix |
|---|---|---|
| `403 PERMISSION_DENIED` | BigQuery Migration API not enabled or caller lacks permissions | Enable `bigquerymigration.googleapis.com` in the project. Grant `roles/bigquerymigration.editor` to the service account. |
| `400 INVALID_ARGUMENT: sourceDialect must have exactly one dialect set` | Multiple or zero dialect keys provided | Provide exactly one dialect key in `sourceDialect`. |
| `400 INVALID_ARGUMENT: query is empty` | Empty or whitespace-only query string | Provide a non-empty SQL string. |
| `translatedQuery` is empty with errors | Source SQL uses constructs with no GoogleSQL equivalent | Check `errors` array for specific unsupported constructs. May require manual rewrite. |
| `warnings` with `APPROXIMATE_CONVERSION` | Function was translated but behavior may differ slightly | Review the translated function. Common with date/time functions and string collation. |
| `404 NOT_FOUND` | Invalid project or location | Verify project ID and use a supported location (`us`, `eu`, or a valid region). |

## Unsupported Syntax Patterns (Common)

These source constructs commonly produce translation errors requiring manual intervention:

- **Teradata**: `NORMALIZE`, `TD_NORMALIZE_UNICODE`, `MLOAD/FLOAD` scripts, stored procedure cursors with dynamic SQL
- **Snowflake**: `FLATTEN` on nested variants (partially supported), JavaScript UDFs, `OBJECT_CONSTRUCT` with complex nesting
- **Oracle**: PL/SQL packages (translate individual procedures instead), `CONNECT BY` hierarchical queries (use `RECURSIVE` CTE instead), `ROWNUM` (translated to `ROW_NUMBER()` or `LIMIT`)
- **SQL Server**: `CROSS APPLY` / `OUTER APPLY` (partially supported), `OPENROWSET`, linked server references
