# BigQuery Data Transfer Service API

Service endpoint: `bigquerydatatransfer.googleapis.com`
API version: `v1`
Required IAM role: `roles/bigquery.admin` or `roles/bigquerydatatransfer.admin`
Required API: `BigQuery Data Transfer API` must be enabled on the project

---

## Core Concepts

- **TransferConfig**: A persistent configuration that defines what data to move, where, and on what schedule.
- **TransferRun**: A single execution of a TransferConfig. Each scheduled or manual trigger creates a run.
- **DataSource**: The type of data source (scheduled_query, amazon_s3, google_ads, etc.).

---

## TransferConfig -- CRUD Operations

### Create TransferConfig

```
POST https://bigquerydatatransfer.googleapis.com/v1/projects/{project}/locations/{location}/transferConfigs
```

**Query parameters:**
- `authorizationCode` (string, optional): OAuth authorization code for SaaS data sources
- `serviceAccountName` (string, optional): Service account to use for the transfer

**Request body (TransferConfig resource):**

```json
{
  "displayName": "Daily sales rollup",
  "dataSourceId": "scheduled_query",
  "destinationDatasetId": "analytics",
  "params": {
    "query": "INSERT INTO analytics.daily_sales SELECT DATE(order_time) AS day, SUM(amount) AS total FROM raw.orders WHERE DATE(order_time) = @run_date GROUP BY 1",
    "destination_table_name_template": "",
    "write_disposition": "WRITE_APPEND",
    "partitioning_field": ""
  },
  "schedule": "every 24 hours",
  "scheduleOptions": {
    "startTime": "2025-01-01T06:00:00Z",
    "endTime": "2026-01-01T06:00:00Z",
    "disableAutoScheduling": false
  },
  "notificationPubsubTopic": "projects/my-project/topics/transfer-notifications",
  "emailPreferences": {
    "enableFailureEmail": true
  }
}
```

### Update TransferConfig

```
PATCH https://bigquerydatatransfer.googleapis.com/v1/projects/{project}/locations/{location}/transferConfigs/{config_id}
```

**Query parameters:**
- `updateMask` (string, required): Comma-separated list of fields to update. Example: `displayName,schedule,params`

**Request body:** Partial TransferConfig with only the fields to update.

### Get TransferConfig

```
GET https://bigquerydatatransfer.googleapis.com/v1/projects/{project}/locations/{location}/transferConfigs/{config_id}
```

### List TransferConfigs

```
GET https://bigquerydatatransfer.googleapis.com/v1/projects/{project}/locations/{location}/transferConfigs
```

**Query parameters:**
- `dataSourceIds` (string, repeated): Filter by data source type. Example: `dataSourceIds=scheduled_query`
- `pageSize` (int): Max results (default 100, max 1000)
- `pageToken` (string): Pagination token

### Delete TransferConfig

```
DELETE https://bigquerydatatransfer.googleapis.com/v1/projects/{project}/locations/{location}/transferConfigs/{config_id}
```

---

## Data Source Types and Params

### Scheduled Query (`scheduled_query`)

Executes a SQL query on a schedule and writes results to a destination table.

```json
{
  "dataSourceId": "scheduled_query",
  "destinationDatasetId": "my_dataset",
  "params": {
    "query": "SELECT * FROM source_table WHERE date = @run_date",
    "destination_table_name_template": "daily_snapshot_{run_date}",
    "write_disposition": "WRITE_TRUNCATE",
    "partitioning_field": ""
  },
  "schedule": "every 24 hours"
}
```

**Params fields:**

| Param | Type | Description |
|---|---|---|
| `query` | string | SQL query to execute. Supports `@run_date` and `@run_time` parameters. |
| `destination_table_name_template` | string | Template for destination table name. Supports `{run_date}`, `{run_time}`. Leave empty for DML/DDL queries with no destination table. |
| `write_disposition` | string | `WRITE_TRUNCATE` (overwrite), `WRITE_APPEND` (append), or `WRITE_EMPTY` (fail if exists). |
| `partitioning_field` | string | Field to partition destination table by (optional). |

**Runtime parameters available in scheduled queries:**
- `@run_date`: DATE value of the scheduled run time
- `@run_time`: TIMESTAMP value of the scheduled run time

**Schedule format examples:**
- `every 24 hours` -- daily
- `every 6 hours` -- every 6 hours
- `every monday 09:00` -- weekly on Monday at 9am UTC
- `1,15 of month 08:00` -- 1st and 15th of each month at 8am UTC
- `every day 03:00` -- daily at 3am UTC

### Amazon S3 Transfer (`amazon_s3`)

```json
{
  "dataSourceId": "amazon_s3",
  "destinationDatasetId": "imported_data",
  "params": {
    "destination_table_name_template": "s3_import",
    "data_path": "s3://my-s3-bucket/data/*.csv",
    "access_key_id": "AKIA...",
    "secret_access_key": "wJalr...",
    "file_format": "CSV",
    "field_delimiter": ",",
    "skip_leading_rows": "1",
    "max_bad_records": "0",
    "write_disposition": "WRITE_APPEND"
  },
  "schedule": "every 24 hours"
}
```

**S3-specific params:**

| Param | Type | Description |
|---|---|---|
| `data_path` | string | S3 URI with optional wildcards. `s3://bucket/path/*.csv` |
| `access_key_id` | string | AWS IAM access key ID |
| `secret_access_key` | string | AWS IAM secret access key |
| `file_format` | string | `CSV`, `JSON`, `AVRO`, `PARQUET`, `ORC` |
| `field_delimiter` | string | Field delimiter for CSV (default `,`) |
| `skip_leading_rows` | string | Number of header rows to skip (as string) |
| `max_bad_records` | string | Max rows that can fail parsing (as string) |
| `write_disposition` | string | `WRITE_TRUNCATE`, `WRITE_APPEND`, or `WRITE_EMPTY` |

### Azure Blob Storage Transfer (`azure_blob_storage`)

```json
{
  "dataSourceId": "azure_blob_storage",
  "destinationDatasetId": "imported_data",
  "params": {
    "destination_table_name_template": "azure_import",
    "data_path": "https://myaccount.blob.core.windows.net/mycontainer/data/*.parquet",
    "storage_account": "myaccount",
    "container": "mycontainer",
    "sas_token": "sv=2021-06-08&ss=b&srt=sco...",
    "file_format": "PARQUET",
    "write_disposition": "WRITE_TRUNCATE"
  },
  "schedule": "every 24 hours"
}
```

### Google Ads (`google_ads`)

```json
{
  "dataSourceId": "google_ads",
  "destinationDatasetId": "google_ads_data",
  "params": {
    "customer_id": "123-456-7890"
  },
  "schedule": "every 24 hours"
}
```

Requires OAuth authorization code via the `authorizationCode` query parameter during creation.

### Other Supported Data Sources

| `dataSourceId` | Source |
|---|---|
| `google_ads` | Google Ads |
| `campaign_manager` | Campaign Manager 360 |
| `google_analytics` | Google Analytics (UA) |
| `dfp_datatransfer` | Google Ad Manager |
| `play` | Google Play |
| `youtube_channel` | YouTube Channel Reports |
| `youtube_content_owner` | YouTube Content Owner Reports |

---

## Transfer Runs -- Management

### Start Manual Run

Triggers a transfer run immediately, outside the normal schedule.

```
POST https://bigquerydatatransfer.googleapis.com/v1/projects/{project}/locations/{location}/transferConfigs/{config_id}:startManualRuns
```

**Request body:**

```json
{
  "requestedRunTime": "2025-06-15T00:00:00Z"
}
```

The `requestedRunTime` sets the `@run_date` and `@run_time` parameter values for the run.

### List Transfer Runs

```
GET https://bigquerydatatransfer.googleapis.com/v1/projects/{project}/locations/{location}/transferConfigs/{config_id}/runs
```

**Query parameters:**
- `states` (string, repeated): Filter by state. Values: `PENDING`, `RUNNING`, `SUCCEEDED`, `FAILED`, `CANCELLED`
- `pageSize` (int): Max results per page
- `pageToken` (string): Pagination token

### Get Transfer Run

```
GET https://bigquerydatatransfer.googleapis.com/v1/projects/{project}/locations/{location}/transferConfigs/{config_id}/runs/{run_id}
```

**Response:**

```json
{
  "name": "projects/123/locations/us/transferConfigs/abc/runs/xyz",
  "destinationDatasetId": "analytics",
  "scheduleTime": "2025-06-15T06:00:00Z",
  "startTime": "2025-06-15T06:00:05Z",
  "endTime": "2025-06-15T06:02:30Z",
  "updateTime": "2025-06-15T06:02:30Z",
  "state": "SUCCEEDED",
  "params": {
    "query": "SELECT ..."
  },
  "runTime": "2025-06-15T06:00:00Z",
  "userId": "1234567890",
  "dataSourceId": "scheduled_query"
}
```

**Run states:** `PENDING`, `RUNNING`, `SUCCEEDED`, `FAILED`, `CANCELLED`

### Delete Transfer Run

```
DELETE https://bigquerydatatransfer.googleapis.com/v1/projects/{project}/locations/{location}/transferConfigs/{config_id}/runs/{run_id}
```

### List Transfer Run Logs

```
GET https://bigquerydatatransfer.googleapis.com/v1/projects/{project}/locations/{location}/transferConfigs/{config_id}/runs/{run_id}/transferLogs
```

**Query parameters:**
- `messageTypes` (string, repeated): Filter by log severity. Values: `INFO`, `WARNING`, `ERROR`
- `pageSize`, `pageToken`: Pagination

**Response:**

```json
{
  "transferMessages": [
    {
      "messageText": "Query executed successfully. 1500 rows written to analytics.daily_sales.",
      "messageTime": "2025-06-15T06:02:28Z",
      "severity": "INFO"
    }
  ]
}
```

---

## Check Valid Data Sources

List available data source types for a given location:

```
GET https://bigquerydatatransfer.googleapis.com/v1/projects/{project}/locations/{location}/dataSources
```

Check if a specific data source is available:

```
GET https://bigquerydatatransfer.googleapis.com/v1/projects/{project}/locations/{location}/dataSources/{data_source_id}
```

---

## Common Errors and Fixes

| Error | Cause | Fix |
|---|---|---|
| `403 PERMISSION_DENIED` | API not enabled or missing IAM permissions | Enable `bigquerydatatransfer.googleapis.com`. Grant `roles/bigquery.admin`. |
| `400 INVALID_ARGUMENT: Schedule is not valid` | Malformed schedule string | Use formats like `every 24 hours`, `every day 03:00`, `every monday 09:00`. |
| `400 INVALID_ARGUMENT: Query is empty` | Scheduled query config missing `query` param | Set `params.query` to a valid SQL string. |
| `404 NOT_FOUND: Dataset not found` | Destination dataset does not exist | Create the dataset before creating the transfer config. |
| Transfer run `FAILED` with `ACCESS_DENIED` | Service account lacks BigQuery permissions | Grant the transfer service account `roles/bigquery.dataEditor` on the destination dataset. |
| Transfer run `FAILED` with `NOT_FOUND` on S3 | Invalid S3 path or credentials | Verify `data_path`, `access_key_id`, and `secret_access_key`. |
| `400 INVALID_ARGUMENT: authorizationCode is required` | SaaS source requires OAuth flow | Generate an authorization code via the Data Transfer Service console and pass it as a query parameter. |
