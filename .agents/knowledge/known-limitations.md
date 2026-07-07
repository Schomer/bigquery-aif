# Known Limitations

Last updated: 2026-07-07

This document lists capabilities the app explicitly does NOT support. If a user asks for one of these, the app should explain the limitation clearly rather than failing silently.

## Not Supported (Current)

1. **Long-running job polling**: Jobs exceeding ~30 seconds timeout. The app does not poll for async job completion.
2. **Materialized view management**: Cannot create, refresh, or manage materialized views.
3. **Routines and stored procedures**: Read-only listing via schema; cannot create or execute UDFs or stored procedures.
4. **Multi-region operations**: Cannot move data between regions or query across regions.
5. **BigQuery ML model training**: Cannot execute CREATE MODEL (long-running). Can query existing models with ML.PREDICT/ML.EVALUATE.
6. **Column-level security**: Cannot set or manage column-level access controls or data masking policies.
7. **Analytics Hub**: Cannot publish, subscribe to, or manage data exchange listings.
8. **Capacity reservations**: Cannot create, modify, or manage slot reservations or assignments.
9. **Cloud Composer / Airflow**: Cannot create or manage Airflow DAGs.
10. **Dataflow pipelines**: Cannot create or manage Apache Beam pipelines.
11. **Data Fusion**: Cannot create or manage visual ETL pipelines.
12. **Real-time streaming ingestion**: Cannot set up Pub/Sub-to-BigQuery streaming.

## Partially Supported

1. **Scheduled queries**: Can create and list via Data Transfer API, but cannot modify complex schedules or manage transfer runs.
2. **External connections**: Can list connections, but full CRUD for Cloud SQL/Spanner connections is limited.
3. **Data lineage**: Uses INFORMATION_SCHEMA.JOBS analysis as a proxy. Does not use the dedicated Data Lineage API.
4. **Schema drift detection**: Requires app-maintained snapshots (Firestore). No automatic baseline.
5. **Export formats**: Supports CSV, Sheets, and GCS. Parquet/Avro/ORC export is via GCS extract jobs only.

## By Design

1. **No direct database writes without confirmation**: All DML operations require user confirmation.
2. **Client-side orchestration**: All processing runs in the browser; no server-side job queue.
3. **Single-project scope**: The app operates within one GCP project at a time (switchable via project picker).
4. **Session-scoped caches**: Schema cache and plan cache reset on page refresh.
