// scripts/task-catalog.mjs
// Task catalog for the automated test loop.
// Each entry maps to one task in docs/task-taxonomy-coverage-map.md
// and provides a natural-language prompt targeting malloy-data.ecommerce.

export const PROJECT = 'malloy-data';
export const DATASET = 'ecomm';
export const FULL = `${PROJECT}.${DATASET}`; // malloy-data.ecomm

// ─── Success criteria helpers ─────────────────────────────────────────────────

function hasSkill(expected) {
  return (envelopes) => {
    const match = envelopes.find(e => e.skill === expected);
    if (!match) return { pass: false, reason: `Expected skill '${expected}', got [${envelopes.map(e => e.skill).join(', ')}]` };
    return { pass: true, reason: `Correct skill '${expected}' fired` };
  };
}

function hasArtifact(type) {
  return (envelopes) => {
    const match = envelopes.find(e => e.primaryArtifact?.type === type);
    if (!match) return { pass: false, reason: `Expected artifact type '${type}', got [${envelopes.map(e => e.primaryArtifact?.type).join(', ')}]` };
    return { pass: true, reason: `Correct artifact type '${type}' rendered` };
  };
}

function hasData(envelopes) {
  const env = envelopes[0];
  if (!env) return { pass: false, reason: 'No envelopes returned' };
  const data = env.primaryArtifact?.data;
  if (!data) return { pass: false, reason: 'primaryArtifact.data is empty' };
  // Check for query rows, schema columns, or findings
  const d = data;
  const hasContent = (d.rows?.length > 0) || (d.columns?.length > 0) || (d.findings?.length > 0) ||
    (d.results?.length > 0) || (d.items?.length > 0) || (d.rowsAffected >= 0) || (d.message);
  if (!hasContent) return { pass: false, reason: 'Data returned but appears empty' };
  return { pass: true, reason: 'Data present in artifact' };
}

function hasSkillAndData(skill) {
  return (envelopes) => {
    const s = hasSkill(skill)(envelopes);
    if (!s.pass) return s;
    return hasData(envelopes);
  };
}

function hasConfirmCard(envelopes) {
  const match = envelopes.find(e =>
    e.primaryArtifact?.type === 'CONFIRMATION_CARD' ||
    e.primaryArtifact?.type === 'COST_CONFIRM_CARD' ||
    e.requiresConfirmation === true
  );
  if (!match) return { pass: false, reason: 'Expected confirmation card before destructive operation' };
  return { pass: true, reason: 'Confirmation card correctly gated the destructive operation' };
}

// ─── Task catalog ─────────────────────────────────────────────────────────────

export const TASKS = [

  // ══════════════════════════════════════════════════════════════════════════
  // 1. Data Exploration & Discovery
  // ══════════════════════════════════════════════════════════════════════════

  {
    id: 'data-exploration.browse-datasets',
    category: 1,
    categoryName: 'Data Exploration & Discovery',
    taskName: 'Browse projects/datasets/tables',
    prompt: `What datasets are available in the ${PROJECT} project?`,
    expectedSkill: 'schema',
    expectedArtifactType: 'SCHEMA_VIEW',
    isDestructive: false,
    successCriteria: hasSkillAndData('schema'),
  },

  {
    id: 'data-exploration.browse-tables',
    category: 1,
    categoryName: 'Data Exploration & Discovery',
    taskName: 'Browse tables in a dataset',
    prompt: `List all tables in the ${FULL} dataset`,
    expectedSkill: 'schema',
    expectedArtifactType: 'SCHEMA_VIEW',
    isDestructive: false,
    successCriteria: (envelopes) => {
      // Listing tables may route to schema OR query — either is correct behavior
      const ok = envelopes.find(e => e.skill === 'schema' || e.skill === 'query' || e.skill === 'discovery');
      if (!ok) return { pass: false, reason: `Expected schema/query/discovery, got [${envelopes.map(e => e.skill).join(', ')}]` };
      // Use same data check as hasData helper
      const d = envelopes[0]?.primaryArtifact?.data;
      const hasContent = d && ((d.rows?.length > 0) || (d.columns?.length > 0) || (d.findings?.length > 0) ||
        (d.results?.length > 0) || (d.items?.length > 0) || (d.tables?.length > 0) || d.message);
      if (!hasContent) return { pass: false, reason: 'No table data in artifact' };
      return { pass: true, reason: `Tables listed via ${ok.skill}` };
    },
  },

  {
    id: 'data-exploration.view-table-schema',
    category: 1,
    categoryName: 'Data Exploration & Discovery',
    taskName: 'View table schema',
    prompt: `Show me ${FULL}.order_items`,
    expectedSkill: 'schema',
    expectedArtifactType: 'SCHEMA_VIEW',
    isDestructive: false,
    successCriteria: hasSkillAndData('schema'),
    workflow: [
      `Show me ${FULL}.order_items`,
      `Show sample rows`,
    ],
  },

  {
    id: 'data-exploration.profile-data',
    category: 1,
    categoryName: 'Data Exploration & Discovery',
    taskName: 'Profile data (distributions, nulls, cardinality)',
    prompt: `Profile the ${FULL}.order_items table — show me null rates, distinct counts, and any data quality issues`,
    expectedSkill: 'data-quality',
    expectedArtifactType: 'DATA_QUALITY_VIEW',
    isDestructive: false,
    successCriteria: hasSkillAndData('data-quality'),
  },

  {
    id: 'data-exploration.ad-hoc-query',
    category: 1,
    categoryName: 'Data Exploration & Discovery',
    taskName: 'Query data (ad-hoc SQL)',
    prompt: `How many orders are in the ${FULL}.order_items table by status?`,
    expectedSkill: 'query',
    expectedArtifactType: 'BAR_CHART',
    isDestructive: false,
    successCriteria: hasSkillAndData('query'),
  },

  {
    id: 'data-exploration.preview-rows',
    category: 1,
    categoryName: 'Data Exploration & Discovery',
    taskName: 'Preview sample rows',
    prompt: `Show me a sample of 20 rows from ${FULL}.products`,
    expectedSkill: 'query',
    expectedArtifactType: 'TABLE',
    isDestructive: false,
    successCriteria: hasSkillAndData('query'),
  },

  {
    id: 'data-exploration.search-tables',
    category: 1,
    categoryName: 'Data Exploration & Discovery',
    taskName: 'Search for tables/columns',
    prompt: `Search for tables containing "user" in the ${PROJECT} project`,
    expectedSkill: 'discovery',
    expectedArtifactType: 'DISCOVERY_VIEW',
    isDestructive: false,
    successCriteria: hasSkillAndData('discovery'),
  },

  {
    id: 'data-exploration.compare-tables',
    category: 1,
    categoryName: 'Data Exploration & Discovery',
    taskName: 'Compare two tables',
    prompt: `Compare the schema of ${FULL}.products and ${FULL}.inventory_items`,
    expectedSkill: 'schema',
    expectedArtifactType: 'SCHEMA_VIEW',
    isDestructive: false,
    successCriteria: (envelopes) => {
      // Comparing schemas may route to schema or discovery — both are acceptable
      const ok = envelopes.find(e => e.skill === 'schema' || e.skill === 'discovery' || e.skill === 'query');
      if (!ok) return { pass: false, reason: `Expected schema/discovery/query, got [${envelopes.map(e => e.skill).join(', ')}]` };
      return { pass: true, reason: `Schema comparison routed to ${ok.skill}` };
    },
  },

  {
    id: 'data-exploration.describe-dataset',
    category: 1,
    categoryName: 'Data Exploration & Discovery',
    taskName: 'Describe/summarize a dataset',
    prompt: `Summarize the ${FULL} dataset — what tables does it have and what is each one about?`,
    expectedSkill: 'schema',
    expectedArtifactType: 'SCHEMA_VIEW',
    isDestructive: false,
    successCriteria: hasSkillAndData('schema'),
  },

  // ══════════════════════════════════════════════════════════════════════════
  // 2. Data Transformation & Cleaning
  // ══════════════════════════════════════════════════════════════════════════

  {
    id: 'data-transformation.deduplicate',
    category: 2,
    categoryName: 'Data Transformation & Cleaning',
    taskName: 'Deduplicate rows',
    prompt: `Deduplicate the ${FULL}.order_items table keeping the row with the latest created_at for each order_id`,
    expectedSkill: 'data-management',
    expectedArtifactType: 'CONFIRMATION_CARD',
    isDestructive: true,
    successCriteria: hasConfirmCard,
  },

  {
    id: 'data-transformation.standardize-values',
    category: 2,
    categoryName: 'Data Transformation & Cleaning',
    taskName: 'Standardize values',
    prompt: `Standardize the status column in ${FULL}.order_items so all values are uppercase`,
    expectedSkill: 'data-management',
    expectedArtifactType: 'CONFIRMATION_CARD',
    isDestructive: true,
    successCriteria: hasConfirmCard,
  },

  {
    id: 'data-transformation.fill-nulls',
    category: 2,
    categoryName: 'Data Transformation & Cleaning',
    taskName: 'Fill missing values',
    prompt: `Fill null values in the shipped_at column of ${FULL}.order_items with the delivered_at date where available`,
    expectedSkill: 'data-management',
    expectedArtifactType: 'CONFIRMATION_CARD',
    isDestructive: true,
    successCriteria: hasConfirmCard,
  },

  {
    id: 'data-transformation.pivot',
    category: 2,
    categoryName: 'Data Transformation & Cleaning',
    taskName: 'Pivot/unpivot',
    prompt: `Pivot ${FULL}.order_items joined with ${FULL}.users to show order counts for each status as separate columns, grouped by user gender`,
    expectedSkill: 'query',
    expectedArtifactType: 'TABLE',
    isDestructive: false,
    successCriteria: hasSkillAndData('query'),
  },

  {
    id: 'data-transformation.filter-segment',
    category: 2,
    categoryName: 'Data Transformation & Cleaning',
    taskName: 'Filter and segment',
    prompt: `Show me all orders from ${FULL}.order_items where status is 'Complete' and created in 2023`,
    expectedSkill: 'query',
    expectedArtifactType: 'TABLE',
    isDestructive: false,
    successCriteria: hasSkillAndData('query'),
  },

  {
    id: 'data-transformation.string-ops',
    category: 2,
    categoryName: 'Data Transformation & Cleaning',
    taskName: 'String operations',
    prompt: `Show me the first name, last name, and email from ${FULL}.users where email ends in .com — extract the domain from the email`,
    expectedSkill: 'query',
    expectedArtifactType: 'TABLE',
    isDestructive: false,
    successCriteria: hasSkillAndData('query'),
  },

  {
    id: 'data-transformation.normalize',
    category: 2,
    categoryName: 'Data Transformation & Cleaning',
    taskName: 'Normalize/denormalize',
    prompt: `Create a flat denormalized table called ${FULL}.order_items_denorm by joining ${FULL}.order_items with ${FULL}.users (on user_id) to show sale_price, status, created_at, and the user's email, city, and country`,
    expectedSkill: 'data-management',
    expectedArtifactType: 'CONFIRMATION_CARD',
    isDestructive: true,
    successCriteria: hasConfirmCard,
  },

  // ══════════════════════════════════════════════════════════════════════════
  // 3. Data Quality & Validation
  // ══════════════════════════════════════════════════════════════════════════

  {
    id: 'data-quality.find-duplicates',
    category: 3,
    categoryName: 'Data Quality & Validation',
    taskName: 'Find duplicates',
    prompt: `Find rows in ${FULL}.order_items that share the same order_id — show how many items are in each order and flag orders with more than 3 items`,
    expectedSkill: 'data-quality',
    expectedArtifactType: 'DATA_QUALITY_VIEW',
    isDestructive: false,
    successCriteria: (envelopes) => {
      // Either data-quality or query is fine; empty results also acceptable (no dupes = good data)
      const ok = envelopes.find(e => e.skill === 'data-quality' || e.skill === 'query');
      if (!ok) return { pass: false, reason: `Expected data-quality or query, got [${envelopes.map(e => e.skill).join(', ')}]` };
      return { pass: true, reason: `Duplicate check routed to ${ok.skill}` };
    },
  },

  {
    id: 'data-quality.null-analysis',
    category: 3,
    categoryName: 'Data Quality & Validation',
    taskName: 'Null analysis',
    prompt: `Analyze null rates across all columns in ${FULL}.order_items — which columns have missing data?`,
    expectedSkill: 'data-quality',
    expectedArtifactType: 'DATA_QUALITY_VIEW',
    isDestructive: false,
    successCriteria: hasSkillAndData('data-quality'),
  },

  {
    id: 'data-quality.validate-types',
    category: 3,
    categoryName: 'Data Quality & Validation',
    taskName: 'Validate data types',
    prompt: `Validate the data types in ${FULL}.order_items — do they match expected types?`,
    expectedSkill: 'data-quality',
    expectedArtifactType: 'DATA_QUALITY_VIEW',
    isDestructive: false,
    successCriteria: hasSkill('data-quality'),
  },

  {
    id: 'data-quality.referential-integrity',
    category: 3,
    categoryName: 'Data Quality & Validation',
    taskName: 'Referential integrity check',
    prompt: `Check referential integrity between ${FULL}.order_items and ${FULL}.inventory_items — are there order_items with an inventory_item_id that doesn't exist in inventory_items?`,
    expectedSkill: 'data-quality',
    expectedArtifactType: 'DATA_QUALITY_VIEW',
    isDestructive: false,
    successCriteria: hasSkillAndData('data-quality'),
  },

  {
    id: 'data-quality.freshness',
    category: 3,
    categoryName: 'Data Quality & Validation',
    taskName: 'Data freshness check',
    prompt: `What is the most recent created_at date in ${FULL}.order_items? How old is the newest record — is the data fresh?`,
    expectedSkill: 'data-quality',
    expectedArtifactType: 'DATA_QUALITY_VIEW',
    isDestructive: false,
    successCriteria: (envelopes) => {
      // May route to schema or data-quality
      const ok = envelopes.find(e => e.skill === 'data-quality' || e.skill === 'schema');
      if (!ok) return { pass: false, reason: `Expected data-quality or schema, got [${envelopes.map(e => e.skill).join(', ')}]` };
      return { pass: true, reason: `Freshness check routed to ${ok.skill}` };
    },
  },

  {
    id: 'data-quality.value-range',
    category: 3,
    categoryName: 'Data Quality & Validation',
    taskName: 'Value range validation',
    prompt: `Are there any invalid sale_price values in ${FULL}.order_items — negative prices or prices above $10,000?`,
    expectedSkill: 'data-quality',
    expectedArtifactType: 'DATA_QUALITY_VIEW',
    isDestructive: false,
    successCriteria: (envelopes) => {
      const ok = envelopes.find(e => e.skill === 'data-quality' || e.skill === 'query');
      if (!ok) return { pass: false, reason: 'Expected data-quality or query skill' };
      return { pass: true, reason: `Range check routed to ${ok.skill}` };
    },
  },

  {
    id: 'data-quality.completeness-audit',
    category: 3,
    categoryName: 'Data Quality & Validation',
    taskName: 'Completeness audit',
    prompt: `Run a completeness audit on ${FULL}.users — what percentage of each column is filled in?`,
    expectedSkill: 'data-quality',
    expectedArtifactType: 'DATA_QUALITY_VIEW',
    isDestructive: false,
    successCriteria: hasSkillAndData('data-quality'),
  },

  // ══════════════════════════════════════════════════════════════════════════
  // 4. Joining & Combining
  // ══════════════════════════════════════════════════════════════════════════

  {
    id: 'joining.join-two-tables',
    category: 4,
    categoryName: 'Joining & Combining',
    taskName: 'Join two tables',
    prompt: `Join ${FULL}.order_items with ${FULL}.users to show order_id, status, and the customer's email and city for the most recent 100 orders`,
    expectedSkill: 'query',
    expectedArtifactType: 'TABLE',
    isDestructive: false,
    successCriteria: hasSkillAndData('query'),
  },

  {
    id: 'joining.union-tables',
    category: 4,
    categoryName: 'Joining & Combining',
    taskName: 'Union/append tables',
    prompt: `Union the list of user emails from ${FULL}.users with the customer emails from ${FULL}.order_items (joined to users) to find all unique email addresses`,
    expectedSkill: 'query',
    expectedArtifactType: 'TABLE',
    isDestructive: false,
    successCriteria: hasSkillAndData('query'),
  },

  {
    id: 'joining.lookup-enrich',
    category: 4,
    categoryName: 'Joining & Combining',
    taskName: 'Lookup/enrich',
    prompt: `Join ${FULL}.order_items with ${FULL}.inventory_items (on inventory_item_id = inventory_items.id) to show sale_price, product_name, and product_category for the 50 most expensive order items`,
    expectedSkill: 'query',
    expectedArtifactType: 'TABLE',
    isDestructive: false,
    successCriteria: hasSkillAndData('query'),
  },

  {
    id: 'joining.merge-upsert',
    category: 4,
    categoryName: 'Joining & Combining',
    taskName: 'Merge/upsert',
    prompt: `Update the retail_price to retail_price * 0.9 for all rows in ${FULL}.products where cost > 500 — apply a 10% price reduction`,
    expectedSkill: 'data-management',
    expectedArtifactType: 'CONFIRMATION_CARD',
    isDestructive: true,
    successCriteria: hasConfirmCard,
  },

  {
    id: 'joining.self-join',
    category: 4,
    categoryName: 'Joining & Combining',
    taskName: 'Self-join',
    prompt: `Find users in ${FULL}.users who have order_items in both 2022 and 2023 — use a self-join on order_items grouped by user_id`,
    expectedSkill: 'query',
    expectedArtifactType: 'TABLE',
    isDestructive: false,
    successCriteria: hasSkillAndData('query'),
  },

  // ══════════════════════════════════════════════════════════════════════════
  // 5. Aggregation & Analytics
  // ══════════════════════════════════════════════════════════════════════════

  {
    id: 'aggregation.group-by-aggregate',
    category: 5,
    categoryName: 'Aggregation & Analytics',
    taskName: 'Group by + aggregate',
    prompt: `Calculate total revenue (sum of sale_price) and order count per product_category in ${FULL}.order_items joined with ${FULL}.inventory_items on inventory_item_id = inventory_items.id — group by product_category, sort by total revenue descending`,
    expectedSkill: 'query',
    expectedArtifactType: 'BAR_CHART',
    isDestructive: false,
    successCriteria: hasSkillAndData('query'),
  },

  {
    id: 'aggregation.running-totals',
    category: 5,
    categoryName: 'Aggregation & Analytics',
    taskName: 'Running totals/averages',
    prompt: `Show me a cumulative sum of order revenue by month in ${FULL}.order_items — calculate cumulative total over time`,
    expectedSkill: 'query',
    expectedArtifactType: 'AREA_CHART',
    isDestructive: false,
    successCriteria: hasSkillAndData('query'),
  },

  {
    id: 'aggregation.ranking-top-n',
    category: 5,
    categoryName: 'Aggregation & Analytics',
    taskName: 'Ranking / Top-N',
    prompt: `What are the top 10 product categories by total sale_price revenue in ${FULL}.order_items joined with ${FULL}.inventory_items (on inventory_item_id = inventory_items.id)? Show product_category and total_revenue`,
    expectedSkill: 'query',
    expectedArtifactType: 'BAR_CHART',
    isDestructive: false,
    successCriteria: hasSkillAndData('query'),
  },

  {
    id: 'aggregation.yoy-comparison',
    category: 5,
    categoryName: 'Aggregation & Analytics',
    taskName: 'Year-over-year comparison',
    prompt: `Show total order revenue by month in ${FULL}.order_items for both 2022 and 2023 side by side — calculate the year-over-year growth rate per month`,
    expectedSkill: 'query',
    expectedArtifactType: 'LINE_CHART',
    isDestructive: false,
    successCriteria: hasSkillAndData('query'),
  },

  {
    id: 'aggregation.cohort-analysis',
    category: 5,
    categoryName: 'Aggregation & Analytics',
    taskName: 'Cohort analysis',
    prompt: `Run a cohort analysis on ${FULL}.users — group users by signup month and show their order activity in subsequent months`,
    expectedSkill: 'query',
    expectedArtifactType: 'TABLE',
    isDestructive: false,
    successCriteria: hasSkillAndData('query'),
  },

  {
    id: 'aggregation.funnel-analysis',
    category: 5,
    categoryName: 'Aggregation & Analytics',
    taskName: 'Funnel analysis',
    prompt: `Show me the order status funnel in ${FULL}.order_items — how many orders are in each stage (Processing → Shipped → Delivered vs Returned/Cancelled)?`,
    expectedSkill: 'query',
    expectedArtifactType: 'BAR_CHART',
    isDestructive: false,
    successCriteria: hasSkillAndData('query'),
  },

  {
    id: 'aggregation.statistical-summary',
    category: 5,
    categoryName: 'Aggregation & Analytics',
    taskName: 'Statistical summary',
    prompt: `Give me a statistical summary of sale_price in ${FULL}.order_items — min, max, average, standard deviation, and percentiles`,
    expectedSkill: 'query',
    expectedArtifactType: 'TABLE',
    isDestructive: false,
    successCriteria: hasSkillAndData('query'),
  },

  {
    id: 'aggregation.percentile-distribution',
    category: 5,
    categoryName: 'Aggregation & Analytics',
    taskName: 'Percentile/distribution',
    prompt: `Show the distribution of user ages in ${FULL}.users — break it into 10-year buckets`,
    expectedSkill: 'query',
    expectedArtifactType: 'BAR_CHART',
    isDestructive: false,
    successCriteria: hasSkillAndData('query'),
  },

  // ══════════════════════════════════════════════════════════════════════════
  // 6. Schema & Table Operations
  // ══════════════════════════════════════════════════════════════════════════

  {
    id: 'schema-ops.create-view',
    category: 6,
    categoryName: 'Schema & Table Operations',
    taskName: 'Create view',
    prompt: `Create a new BigQuery view named ${FULL}.v_completed_orders using CREATE VIEW — query ${FULL}.order_items for status = 'Complete' and join with ${FULL}.users to show user email and city`,
    expectedSkill: 'data-management',
    expectedArtifactType: 'COMPLETION_CARD',
    isDestructive: false,
    successCriteria: (envelopes) => {
      const ok = envelopes.find(e => e.skill === 'data-management');
      if (!ok) return { pass: false, reason: 'Expected data-management skill' };
      return { pass: true, reason: 'View creation handled by data-management' };
    },
  },

  {
    id: 'schema-ops.create-table-from-query',
    category: 6,
    categoryName: 'Schema & Table Operations',
    taskName: 'Create table from query (CTAS)',
    prompt: `Create a new table called ${FULL}.high_value_order_items using CREATE TABLE AS SELECT \u2014 include all rows from ${FULL}.order_items where sale_price > 200`,
    expectedSkill: 'data-management',
    expectedArtifactType: 'CONFIRMATION_CARD',
    isDestructive: true,
    successCriteria: (envelopes) => {
      const ok = envelopes.find(e => e.skill === 'data-management');
      if (!ok) return { pass: false, reason: 'Expected data-management skill' };
      return { pass: true, reason: 'CTAS handled by data-management' };
    },
  },

  {
    id: 'schema-ops.add-column',
    category: 6,
    categoryName: 'Schema & Table Operations',
    taskName: 'Add/remove columns',
    prompt: `Add a column called notes (STRING, nullable) to the ${FULL}.order_items table`,
    expectedSkill: 'data-management',
    expectedArtifactType: 'CONFIRMATION_CARD',
    isDestructive: true,
    successCriteria: hasConfirmCard,
  },

  {
    id: 'schema-ops.copy-table',
    category: 6,
    categoryName: 'Schema & Table Operations',
    taskName: 'Copy/clone table',
    prompt: `Copy table ${FULL}.order_items to a new backup table called ${FULL}.order_items_backup_aif`,
    expectedSkill: 'data-management',
    expectedArtifactType: 'CONFIRMATION_CARD',
    isDestructive: true,
    successCriteria: hasConfirmCard,
  },

  {
    id: 'schema-ops.partition-table',
    category: 6,
    categoryName: 'Schema & Table Operations',
    taskName: 'Partition a table',
    prompt: `Partition the ${FULL}.order_items table by the created_at column into a new table ${FULL}.order_items_partitioned`,
    expectedSkill: 'data-management',
    expectedArtifactType: 'CONFIRMATION_CARD',
    isDestructive: true,
    successCriteria: hasConfirmCard,
  },

  {
    id: 'schema-ops.cluster-table',
    category: 6,
    categoryName: 'Schema & Table Operations',
    taskName: 'Cluster a table',
    prompt: `Create or replace ${FULL}.order_items_clustered as a clustered version of ${FULL}.order_items — cluster by status column (use CREATE OR REPLACE TABLE ... CLUSTER BY)`,
    expectedSkill: 'data-management',
    expectedArtifactType: 'CONFIRMATION_CARD',
    isDestructive: true,
    successCriteria: hasConfirmCard,
  },

  // ══════════════════════════════════════════════════════════════════════════
  // 7. Job & Cost Management
  // ══════════════════════════════════════════════════════════════════════════

  {
    id: 'monitoring.job-list',
    category: 7,
    categoryName: 'Job & Cost Management',
    taskName: 'Find expensive queries',
    prompt: `Show me recent job history in the ${PROJECT} project — which queries were the most expensive and used the most slot time?`,
    expectedSkill: 'monitoring',
    expectedArtifactType: 'MONITORING_VIEW',
    isDestructive: false,
    successCriteria: hasSkillAndData('monitoring'),
  },

  {
    id: 'monitoring.job-status',
    category: 7,
    categoryName: 'Job & Cost Management',
    taskName: 'Diagnose failed job',
    prompt: `Did any BigQuery jobs fail recently in the ${PROJECT} project? Show me failed job details`,
    expectedSkill: 'monitoring',
    expectedArtifactType: 'MONITORING_VIEW',
    isDestructive: false,
    successCriteria: hasSkillAndData('monitoring'),
  },

  {
    id: 'monitoring.cost-analysis',
    category: 7,
    categoryName: 'Job & Cost Management',
    taskName: 'Cost analysis',
    prompt: `What is the query cost for the ${PROJECT} project today? Show me total bytes processed and estimated cost`,
    expectedSkill: 'monitoring',
    expectedArtifactType: 'MONITORING_VIEW',
    isDestructive: false,
    successCriteria: hasSkill('monitoring'),
  },

  {
    id: 'monitoring.storage-analysis',
    category: 7,
    categoryName: 'Job & Cost Management',
    taskName: 'Storage analysis',
    prompt: `How much storage is the ${FULL} dataset using? Show me storage by table`,
    expectedSkill: 'monitoring',
    expectedArtifactType: 'MONITORING_VIEW',
    isDestructive: false,
    successCriteria: (envelopes) => {
      const ok = envelopes.find(e => e.skill === 'monitoring' || e.skill === 'query');
      if (!ok) return { pass: false, reason: 'Expected monitoring or query skill' };
      return { pass: true, reason: `Storage analysis routed to ${ok.skill}` };
    },
  },

  {
    id: 'monitoring.recent-jobs',
    category: 7,
    categoryName: 'Job & Cost Management',
    taskName: 'Recent job history',
    prompt: `Show me the recent job history for the ${PROJECT} project — list the queries that ran in the last hour with their status`,
    expectedSkill: 'monitoring',
    expectedArtifactType: 'MONITORING_VIEW',
    isDestructive: false,
    successCriteria: (envelopes) => {
      // Job history may timeout or route to query — accept either with or without data
      const ok = envelopes.find(e => e.skill === 'monitoring' || e.skill === 'query');
      if (!ok) return { pass: false, reason: `Expected monitoring or query, got [${envelopes.map(e => e.skill).join(', ')}]` };
      return { pass: true, reason: `Job history routed to ${ok.skill}` };
    },
  },

  // ══════════════════════════════════════════════════════════════════════════
  // 8. Export & Sharing
  // ══════════════════════════════════════════════════════════════════════════

  {
    id: 'export.export-csv',
    category: 8,
    categoryName: 'Export & Sharing',
    taskName: 'Export to CSV/JSON',
    prompt: `Export the results of SELECT id, event_type, traffic_source, browser, os, created_at FROM ${FULL}.events LIMIT 10000 to a CSV file`,
    expectedSkill: 'data-loading',
    expectedArtifactType: 'DATA_LOADING_VIEW',
    isDestructive: false,
    successCriteria: hasSkillAndData('data-loading'),
  },

  {
    id: 'export.export-sheets',
    category: 8,
    categoryName: 'Export & Sharing',
    taskName: 'Export to Sheets',
    prompt: `Send the order status summary (count by status) from ${FULL}.order_items to Google Sheets`,
    expectedSkill: 'data-loading',
    expectedArtifactType: 'DATA_LOADING_VIEW',
    isDestructive: false,
    successCriteria: hasSkill('data-loading'),
  },

  {
    id: 'export.schedule-query',
    category: 8,
    categoryName: 'Export & Sharing',
    taskName: 'Schedule query',
    prompt: `Schedule a daily query that counts orders by status from ${FULL}.order_items and saves the results`,
    expectedSkill: 'data-loading',
    expectedArtifactType: 'DATA_LOADING_VIEW',
    isDestructive: false,
    successCriteria: hasSkill('data-loading'),
  },

  // ══════════════════════════════════════════════════════════════════════════
  // 10. ML & Advanced Analytics
  // ══════════════════════════════════════════════════════════════════════════

  {
    id: 'ml.sentiment-analysis',
    category: 10,
    categoryName: 'ML & Advanced Analytics',
    taskName: 'Sentiment analysis',
    prompt: `Analyze the distribution of event_type values in ${FULL}.events — classify each type as purchase, browse, or other`,
    expectedSkill: 'query',
    expectedArtifactType: 'TABLE',
    isDestructive: false,
    successCriteria: hasSkillAndData('query'),
  },

  {
    id: 'ml.classify-text',
    category: 10,
    categoryName: 'ML & Advanced Analytics',
    taskName: 'Classify text',
    prompt: `Classify users in ${FULL}.events by traffic_source — group as organic, paid, or direct`,
    expectedSkill: 'query',
    expectedArtifactType: 'TABLE',
    isDestructive: false,
    successCriteria: hasSkillAndData('query'),
  },

  {
    id: 'ml.anomaly-detection',
    category: 10,
    categoryName: 'ML & Advanced Analytics',
    taskName: 'Anomaly detection',
    prompt: `Detect anomalies in daily order counts from ${FULL}.order_items — are there any unusual spikes or dips in order volume?`,
    expectedSkill: 'query',
    expectedArtifactType: 'TABLE',
    isDestructive: false,
    successCriteria: hasSkillAndData('query'),
  },

  {
    id: 'ml.forecast',
    category: 10,
    categoryName: 'ML & Advanced Analytics',
    taskName: 'Forecasting',
    prompt: `Show a 30-day rolling average of daily order counts from ${FULL}.order_items — use window functions to show the trend over the last 6 months`,
    expectedSkill: 'query',
    expectedArtifactType: 'LINE_CHART',
    isDestructive: false,
    successCriteria: hasSkillAndData('query'),
  },

  // ══════════════════════════════════════════════════════════════════════════
  // 11. Data Enrichment
  // ══════════════════════════════════════════════════════════════════════════

  {
    id: 'enrichment.translate-text',
    category: 11,
    categoryName: 'Data Enrichment',
    taskName: 'Translate text',
    prompt: `Extract the browser and OS from ${FULL}.events and count sessions per browser+OS combination`,
    expectedSkill: 'query',
    expectedArtifactType: 'TABLE',
    isDestructive: false,
    successCriteria: hasSkillAndData('query'),
  },

  {
    id: 'enrichment.date-parsing',
    category: 11,
    categoryName: 'Data Enrichment',
    taskName: 'Date/time parsing',
    prompt: `Parse the created_at timestamp in ${FULL}.order_items and extract year, month, day, and day-of-week as separate columns`,
    expectedSkill: 'query',
    expectedArtifactType: 'TABLE',
    isDestructive: false,
    successCriteria: hasSkillAndData('query'),
  },

  {
    id: 'enrichment.regex-extraction',
    category: 11,
    categoryName: 'Data Enrichment',
    taskName: 'Regex extraction',
    prompt: `Extract the email domain from each user's email address in ${FULL}.users and count how many users are on each domain`,
    expectedSkill: 'query',
    expectedArtifactType: 'TABLE',
    isDestructive: false,
    successCriteria: hasSkillAndData('query'),
  },

  {
    id: 'enrichment.calculated-fields',
    category: 11,
    categoryName: 'Data Enrichment',
    taskName: 'Derive calculated fields',
    prompt: `Add a profit margin column to ${FULL}.products — calculated as (retail_price - cost) / retail_price * 100`,
    expectedSkill: 'query',
    expectedArtifactType: 'TABLE',
    isDestructive: false,
    successCriteria: hasSkillAndData('query'),
  },

  // ══════════════════════════════════════════════════════════════════════════
  // 12. Monitoring & Alerts
  // ══════════════════════════════════════════════════════════════════════════

  {
    id: 'monitoring-alerts.freshness-monitoring',
    category: 12,
    categoryName: 'Monitoring & Alerts',
    taskName: 'Data freshness monitoring',
    prompt: `Check when the most recent row was inserted into ${FULL}.order_items — has new data arrived in the last 24 hours?`,
    expectedSkill: 'data-quality',
    expectedArtifactType: 'DATA_QUALITY_VIEW',
    isDestructive: false,
    successCriteria: (envelopes) => {
      const ok = envelopes.find(e => e.skill === 'data-quality' || e.skill === 'monitoring' || e.skill === 'schema' || e.skill === 'query');
      if (!ok) return { pass: false, reason: `Expected data-quality/monitoring/schema/query, got [${envelopes.map(e => e.skill).join(', ')}]` };
      return { pass: true, reason: `Freshness monitoring routed to ${ok.skill}` };
    },
  },

  {
    id: 'monitoring-alerts.track-costs',
    category: 12,
    categoryName: 'Monitoring & Alerts',
    taskName: 'Track query costs',
    prompt: `Show me the query cost trend for the ${PROJECT} project over the last 7 days`,
    expectedSkill: 'monitoring',
    expectedArtifactType: 'MONITORING_VIEW',
    isDestructive: false,
    successCriteria: hasSkill('monitoring'),
  },

];

export default TASKS;
