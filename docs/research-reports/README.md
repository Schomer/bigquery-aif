# Research Reports

Design and strategy research from the visualization intelligence overhaul session.
Each report is a standalone reference document produced by a research agent.

---

## Reports

### [01-output-enrichment.md](./01-output-enrichment.md)
**Output Enrichment & Statistical Intelligence**
How to make every query result richer: statistical overlays, reference lines, insight cards, KPI delta cards, companion charts, and next-action chips. Includes a 12-item implementation roadmap.

### [02-schema-discovery.md](./02-schema-discovery.md)
**Schema Discovery & Data Catalog Design**
Expert-grade schema exploration UX: table summary cards, dataset overview design, lineage visualization, semantic search, documentation/annotation patterns, and a full reference of BigQuery INFORMATION_SCHEMA sources. 15-item roadmap.

### [03-data-quality-monitoring.md](./03-data-quality-monitoring.md)
**Data Quality & Monitoring Design**
Completeness profiles, freshness tracking, anomaly detection, duplicate detection, distribution shift alerts, and a data health dashboard. Covers Great Expectations, Monte Carlo, Soda, and dbt test patterns. Includes card specs and conversational output formats.

### [04-artifact-creation-persistence.md](./04-artifact-creation-persistence.md)
**Artifact Creation & Persistence**
Data model and UX design for saved queries, dashboards, pipelines, and lineage. Covers versioning, parameterization, sharing, and a 15-item implementation roadmap in three phases.

### [05-data-ops-center.md](./05-data-ops-center.md)
**Data Operations Center Design**
Scheduled query management, job history/run log design, cost monitoring, pipeline health dashboards, and query audit logs. Includes card specs, run record formats, failure escalation patterns, and a 14-item roadmap.

---

## How to use these

These reports inform the next phase of implementation work. Each has:
- A **Current State Audit** of what the app does now
- **Gap Analysis** of what's missing
- **Design Specs** for what it should look like (with ASCII layouts)
- A **Prioritized Implementation Roadmap**

Cross-reference with `.agents/knowledge/invariants.md` before implementing anything new.
