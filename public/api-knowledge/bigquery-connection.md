# BigQuery Connection API

Service endpoint: `bigqueryconnection.googleapis.com`
API version: `v1`
Required IAM role: `roles/bigquery.connectionAdmin`
Required API: `BigQuery Connection API` must be enabled on the project

---

## Core Concepts

A **Connection** is a resource that stores credentials and configuration for accessing an external data source from BigQuery. Once created, connections can be used in:
- `CREATE EXTERNAL TABLE` statements (for federated queries)
- `CREATE TABLE FUNCTION` with remote functions
- BigLake tables
- BQML remote model connections

Each connection has a service account identity that must be granted access to the external resource.

---

## Connection CRUD

### Create Connection

```
POST https://bigqueryconnection.googleapis.com/v1/projects/{project}/locations/{location}/connections?connectionId={connection_id}
```

**Path/Query parameters:**

| Param | Type | Required | Description |
|---|---|---|---|
| `project` | string | Yes | Project ID or number. |
| `location` | string | Yes | Location for the connection (must match where queries will run). Example: `us`, `eu`, `us-central1`. |
| `connectionId` | string | No | User-assigned connection ID. Auto-generated if omitted. Must be 1-1024 characters, alphanumeric/underscore/hyphen. |

**Request body:** A Connection resource with exactly one of the type-specific properties set.

### Get Connection

```
GET https://bigqueryconnection.googleapis.com/v1/projects/{project}/locations/{location}/connections/{connection_id}
```

### List Connections

```
GET https://bigqueryconnection.googleapis.com/v1/projects/{project}/locations/{location}/connections
```

**Query parameters:**
- `pageSize` (int): Max results per page (default 100, max 1000)
- `pageToken` (string): Pagination token

**Response:**

```json
{
  "connections": [
    {
      "name": "projects/my-project/locations/us/connections/my-connection",
      "friendlyName": "Production Cloud SQL",
      "description": "Connection to production MySQL instance",
      "cloudSql": { ... },
      "creationTime": "1718438400000",
      "lastModifiedTime": "1718438400000",
      "hasCredential": true
    }
  ],
  "nextPageToken": ""
}
```

### Update Connection

```
PATCH https://bigqueryconnection.googleapis.com/v1/projects/{project}/locations/{location}/connections/{connection_id}?updateMask={fields}
```

**Query parameters:**
- `updateMask` (string, required): Comma-separated field paths to update. Example: `friendlyName,description,cloudSql.credential`

### Delete Connection

```
DELETE https://bigqueryconnection.googleapis.com/v1/projects/{project}/locations/{location}/connections/{connection_id}
```

---

## Connection Types

### Cloud SQL Connection

Connect to Cloud SQL instances (MySQL, PostgreSQL, SQL Server) for federated queries.

```json
{
  "friendlyName": "Production MySQL",
  "description": "Cloud SQL MySQL production instance",
  "cloudSql": {
    "instanceId": "my-project:us-central1:my-instance",
    "database": "production_db",
    "type": "MYSQL",
    "credential": {
      "username": "bq_reader",
      "password": "secure_password_here"
    }
  }
}
```

**cloudSql fields:**

| Field | Type | Required | Description |
|---|---|---|---|
| `instanceId` | string | Yes | Cloud SQL instance connection name. Format: `project:region:instance`. |
| `database` | string | Yes | Database name to connect to. |
| `type` | string | Yes | Database type: `MYSQL`, `POSTGRES`, or `SQL_SERVER`. |
| `credential` | object | Yes | Database credentials. |
| `credential.username` | string | Yes | Database username. |
| `credential.password` | string | Yes | Database password. Write-only (never returned in GET). |

**Using in a federated query:**

```sql
SELECT * FROM EXTERNAL_QUERY(
  'my-project.us.my-cloudsql-connection',
  'SELECT customer_id, name, email FROM customers WHERE active = 1'
);
```

### Spanner Connection

```json
{
  "friendlyName": "Analytics Spanner DB",
  "description": "Spanner connection for analytics queries",
  "cloudSpanner": {
    "database": "projects/my-project/instances/my-instance/databases/analytics",
    "useParallelism": true,
    "useDataBoost": true,
    "maxParallelism": 100,
    "databaseRole": "reader"
  }
}
```

**cloudSpanner fields:**

| Field | Type | Required | Description |
|---|---|---|---|
| `database` | string | Yes | Full resource name of the Spanner database. |
| `useParallelism` | boolean | No | Enable parallel reads (default false). Recommended for large tables. |
| `useDataBoost` | boolean | No | Use Spanner Data Boost for zero-impact analytics queries (default false). |
| `maxParallelism` | int | No | Max parallelism for reads when `useParallelism` is true. |
| `databaseRole` | string | No | Spanner database role for fine-grained access control. |
| `useServerlessAnalytics` | boolean | No | Deprecated. Use `useDataBoost` instead. |

**Using in a federated query:**

```sql
SELECT * FROM EXTERNAL_QUERY(
  'my-project.us.my-spanner-connection',
  'SELECT CustomerId, OrderId, Amount FROM Orders WHERE OrderDate > "2025-01-01"'
);
```

### Cloud Resource Connection (for Cloud Storage / BigLake / Remote Functions)

A generic connection that provides a service account identity for accessing Cloud resources. Used for BigLake tables, object tables, and remote functions.

```json
{
  "friendlyName": "BigLake GCS Connection",
  "description": "Connection for BigLake tables on GCS",
  "cloudResource": {}
}
```

The `cloudResource` field is set to an empty object. The connection creates a Google-managed service account whose email is returned in the response.

**Response (note the service account):**

```json
{
  "name": "projects/my-project/locations/us/connections/biglake-conn",
  "friendlyName": "BigLake GCS Connection",
  "cloudResource": {
    "serviceAccountId": "bqcx-123456789-abcd@gcp-sa-bigquery-condel.iam.gserviceaccount.com"
  },
  "creationTime": "1718438400000",
  "lastModifiedTime": "1718438400000",
  "hasCredential": true
}
```

After creation, grant the service account access to the GCS bucket:

```
gsutil iam ch serviceAccount:bqcx-123456789-abcd@gcp-sa-bigquery-condel.iam.gserviceaccount.com:objectViewer gs://my-data-bucket
```

**Using for a BigLake table:**

```sql
CREATE EXTERNAL TABLE my_dataset.biglake_sales
WITH CONNECTION `my-project.us.biglake-conn`
OPTIONS (
  format = 'PARQUET',
  uris = ['gs://my-data-bucket/sales/*.parquet'],
  metadata_cache_mode = 'AUTOMATIC',
  max_staleness = INTERVAL 1 HOUR
);
```

**Using for a remote function:**

```sql
CREATE FUNCTION my_dataset.translate_text(text STRING, target_lang STRING)
RETURNS STRING
REMOTE WITH CONNECTION `my-project.us.cloud-fn-conn`
OPTIONS (
  endpoint = 'https://us-central1-my-project.cloudfunctions.net/translate'
);
```

### Bigtable Connection

```json
{
  "friendlyName": "Bigtable Analytics",
  "description": "Connection to production Bigtable instance",
  "cloudResource": {}
}
```

Bigtable connections also use the `cloudResource` type. After creation, grant the connection's service account the `roles/bigtable.reader` role on the Bigtable instance.

**Using for an external table:**

```sql
CREATE EXTERNAL TABLE my_dataset.bigtable_users
WITH CONNECTION `my-project.us.bigtable-conn`
OPTIONS (
  format = 'CLOUD_BIGTABLE',
  uris = ['https://googleapis.com/bigtable/projects/my-project/instances/my-instance/tables/users'],
  bigtable_options = '{"readRowkeyAsString": true, "columnFamilies": [{"familyId": "cf1", "columns": [{"qualifierString": "name", "type": "STRING"}, {"qualifierString": "age", "type": "INTEGER"}]}]}'
);
```

### AWS Connection

For querying data in Amazon S3 via BigQuery Omni.

```json
{
  "friendlyName": "AWS S3 Connection",
  "description": "Cross-cloud connection to AWS S3 data",
  "aws": {
    "accessRole": {
      "iamRoleId": "arn:aws:iam::123456789012:role/BigQueryOmniRole"
    }
  }
}
```

**aws fields:**

| Field | Type | Required | Description |
|---|---|---|---|
| `aws.accessRole.iamRoleId` | string | Yes | ARN of the AWS IAM role that BigQuery can assume. |
| `aws.accessRole.identity` | string | Read-only | Google identity to trust in the AWS IAM role's trust policy. |

After creation, update the AWS IAM role's trust policy to allow the Google identity returned in `aws.accessRole.identity`.

### Azure Connection

For querying data in Azure Blob Storage via BigQuery Omni.

```json
{
  "friendlyName": "Azure Blob Connection",
  "description": "Cross-cloud connection to Azure data",
  "azure": {
    "customerTenantId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
    "federatedApplicationClientId": "yyyyyyyy-yyyy-yyyy-yyyy-yyyyyyyyyyyy"
  }
}
```

---

## Connection IAM Policy

Manage who can use a connection.

### Get IAM Policy

```
POST https://bigqueryconnection.googleapis.com/v1/projects/{project}/locations/{location}/connections/{connection_id}:getIamPolicy
```

```json
{
  "options": {
    "requestedPolicyVersion": 1
  }
}
```

### Set IAM Policy

```
POST https://bigqueryconnection.googleapis.com/v1/projects/{project}/locations/{location}/connections/{connection_id}:setIamPolicy
```

```json
{
  "policy": {
    "bindings": [
      {
        "role": "roles/bigquery.connectionUser",
        "members": [
          "user:analyst@example.com",
          "group:data-team@example.com"
        ]
      }
    ]
  }
}
```

### Test IAM Permissions

```
POST https://bigqueryconnection.googleapis.com/v1/projects/{project}/locations/{location}/connections/{connection_id}:testIamPermissions
```

```json
{
  "permissions": [
    "bigquery.connections.use",
    "bigquery.connections.get"
  ]
}
```

---

## Common Errors

| Error | Cause | Fix |
|---|---|---|
| `403 PERMISSION_DENIED` | Connection API not enabled or missing IAM role | Enable `bigqueryconnection.googleapis.com`. Grant `roles/bigquery.connectionAdmin`. |
| `400 INVALID_ARGUMENT: instanceId format` | Wrong Cloud SQL instance ID format | Use format `project:region:instance` (colons, not slashes). |
| `400 INVALID_ARGUMENT: database is required` | Missing database name in cloudSql config | Provide the `database` field. |
| Federated query returns `ACCESS_DENIED` on external source | Connection's service account lacks access | For Cloud SQL: grant the DB user access. For GCS: grant `objectViewer` to the service account. For Spanner: grant `roles/spanner.databaseReader`. |
| `404 NOT_FOUND: Connection not found` | Wrong connection name in EXTERNAL_QUERY | Use format `project.location.connection_id` in SQL (dots, not slashes). |
| BigLake table returns empty results | Service account cannot read GCS objects | Grant `roles/storage.objectViewer` to the connection's service account on the bucket. |
