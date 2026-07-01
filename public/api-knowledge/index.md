# API Knowledge Base -- Capability Index

This index lists Google Cloud data API families available for programmatic use. Load the linked detail file for full endpoint documentation, request/response schemas, and error handling.

---

## BigQuery Migration API (SQL Translation)

- **Detail file**: `bigquery-migration.md`
- **Service endpoint**: `bigquerymigration.googleapis.com`
- **Description**: Translates SQL from source dialects (Teradata, Snowflake, Redshift, Hive, Spark, Oracle, SQL Server, Presto, MySQL, PostgreSQL, Netezza, Vertica, Azure Synapse) to GoogleSQL.
- **Key capabilities**: Single-query translation via `translateQuery`, batch migration workflows via GCS, translation metadata and error reporting.
- **When to use**: User wants to convert SQL from another database system to BigQuery-compatible GoogleSQL. Also for migration planning and batch SQL conversion projects.

## BigQuery Data Transfer Service

- **Detail file**: `bigquery-datatransfer.md`
- **Service endpoint**: `bigquerydatatransfer.googleapis.com`
- **Description**: Automates data movement into BigQuery via scheduled queries, cross-cloud transfers, and SaaS data imports.
- **Key capabilities**: Scheduled query execution, Amazon S3 transfers, Azure Blob Storage transfers, Google Ads/Campaign Manager/YouTube imports, transfer run management and monitoring.
- **When to use**: User wants to schedule recurring queries, import data from S3/Azure/SaaS platforms, or set up automated data pipelines into BigQuery.

## BigQuery Core Extended Operations

- **Detail file**: `bigquery-core-extended.md`
- **Service endpoint**: `bigquery.googleapis.com`
- **Description**: Advanced BigQuery management operations beyond standard query execution -- table/dataset copy, routine management, materialized views, row-level security, and authorized views.
- **Key capabilities**: Cross-region/cross-project table copy jobs, dataset copy, UDF/stored procedure CRUD, materialized view lifecycle, row access policies, authorized views and datasets.
- **When to use**: User needs to copy tables between projects/regions, manage UDFs or stored procedures, create materialized views, or configure fine-grained access controls.

## Cloud Storage API (GCS)

- **Detail file**: `cloud-storage.md`
- **Service endpoint**: `storage.googleapis.com`
- **Description**: Upload, download, and manage objects and buckets in Google Cloud Storage.
- **Key capabilities**: Simple/resumable/multipart uploads, object download, bucket CRUD, object listing with prefix filters, object composition, signed URL generation, metadata management.
- **When to use**: User needs to stage files for BigQuery loads, export query results to GCS, manage data lake storage, or generate shareable download links.

## BigQuery Connection API

- **Detail file**: `bigquery-connection.md`
- **Service endpoint**: `bigqueryconnection.googleapis.com`
- **Description**: Creates and manages external data source connections for federated queries and external tables.
- **Key capabilities**: Cloud SQL connections (MySQL, PostgreSQL, SQL Server), Spanner connections, Cloud Storage connections (for BigLake/external tables), Bigtable connections, AWS/Azure external connections.
- **When to use**: User wants to query external databases from BigQuery without moving data, set up BigLake tables, or create federated query connections.

## BigQuery Reservation API

- **Detail file**: (not yet created)
- **Service endpoint**: `bigqueryreservation.googleapis.com`
- **Description**: Manages slot reservations, capacity commitments, and assignment of projects/folders to reservations for predictable BigQuery pricing.
- **Key capabilities**: Create/resize reservations, purchase capacity commitments (flex/monthly/annual), assign projects to reservations, BI Engine reservations.
- **When to use**: User wants to switch from on-demand to slot-based pricing, manage compute capacity, or allocate slots across teams.

## Data Lineage API

- **Detail file**: (not yet created)
- **Service endpoint**: `datalineage.googleapis.com`
- **Description**: Tracks data lineage across BigQuery jobs, showing how data flows between tables, views, and queries.
- **Key capabilities**: Query lineage events, list processes and runs, search upstream/downstream links for a given table.
- **When to use**: User wants to understand data dependencies, trace where a table's data comes from, or audit data flow for compliance.

## Dataform API

- **Detail file**: (not yet created)
- **Service endpoint**: `dataform.googleapis.com`
- **Description**: Manages SQL workflow repositories, workspaces, and compilation/execution for ELT pipelines in BigQuery.
- **Key capabilities**: Repository and workspace management, SQLX compilation, workflow invocation, dependency graph resolution, incremental table management.
- **When to use**: User wants to manage SQL-based transformation pipelines, version-controlled SQL workflows, or scheduled ELT jobs in BigQuery.

## BigQuery Analytics Hub

- **Detail file**: (not yet created)
- **Service endpoint**: `analyticshub.googleapis.com`
- **Description**: Enables secure data sharing and exchange across organizations via listings and subscriptions.
- **Key capabilities**: Create/manage data exchanges, publish dataset listings, subscribe to shared datasets, manage listing permissions.
- **When to use**: User wants to share BigQuery datasets with external organizations, subscribe to third-party data products, or set up a data marketplace.
