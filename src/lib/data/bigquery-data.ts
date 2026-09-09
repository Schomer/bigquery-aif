import type { BqTreeItem } from "@/types/chat";

// --- BigQuery Browser data ---
export const BQ_TREE_DATA: BqTreeItem = {
  id: "daui_storage",
  label: "daui_storage",
  type: "project",
  children: [
    {
      id: "dataset_name_1",
      label: "dataset_name_1",
      type: "dataset",
      children: [
        { id: "table_a", label: "table_a", type: "table" },
        { id: "table_b", label: "table_b", type: "table" }
      ]
    },
    {
      id: "service_firebase_test",
      label: "service_firebase_test",
      type: "dataset",
      children: [
        { id: "extensions_spanner_logs_test", label: "extensions_spanner_logs", type: "table" }
      ]
    },
    {
      id: "service_firebase",
      label: "service_firebase",
      type: "dataset",
      children: [
        { id: "extensions_spanner_logs_sf", label: "extensions_spanner_logs", type: "table" },
        { id: "app_distribution_sawmill_daily_events_sf", label: "app_distribution_sawmill_daily_events", type: "table" }
      ]
    },
    {
      id: "analysis_firebase_usage",
      label: "analysis_firebase_usage",
      type: "dataset",
      children: [
        { id: "extensions_spanner_logs_afu", label: "extensions_spanner_logs", type: "table" },
        { id: "app_distribution_sawmill_daily_events_afu", label: "app_distribution_sawmill_daily_events", type: "table" }
      ]
    },
    {
      id: "analysis_firebase_usage_test",
      label: "analysis_firebase_usage_test",
      type: "dataset",
      children: [
        { id: "extensions_spanner_logs_afut", label: "extensions_spanner_logs", type: "table" },
        { id: "app_distribution_sawmill_daily_events_afut", label: "app_distribution_sawmill_daily_events", type: "table" }
      ]
    },
    {
      id: "service_developerknowledge",
      label: "service_developerknowledge",
      type: "dataset",
      children: [
        { id: "raw_dk_api_logs", label: "raw_dk_api_logs", type: "table" }
      ]
    },
    {
      id: "dataset",
      label: "dataset",
      type: "dataset",
      children: [
        { id: "orders", label: "orders", type: "table" },
        { id: "customers", label: "customers", type: "table" }
      ]
    },
    {
      id: "dataset_name_here",
      label: "dataset name here",
      type: "dataset",
      children: [
        { id: "logs", label: "logs", type: "table" },
        { id: "events", label: "events", type: "table" }
      ]
    },
    {
      id: "ecommerce",
      label: "ecommerce",
      type: "dataset",
      children: [
        {
          id: "models",
          label: "Models (1)",
          type: "folder",
          children: [{ id: "user_churn_model", label: "user_churn_model", type: "model" }]
        },
        {
          id: "graph",
          label: "Graph (2)",
          type: "folder",
          children: [
            { id: "customer_lineage", label: "customer_lineage", type: "graph" },
            { id: "order_flow_lineage", label: "order_flow_lineage", type: "graph" }
          ]
        },
        { id: "all_sessions", label: "all_sessions", type: "table" },
        { id: "all_sessions_raw", label: "all_sessions_raw", type: "table" },
        { id: "categories", label: "categories", type: "table" },
        { id: "checkout_nedge", label: "checkout_nedge", type: "table" },
        { id: "details", label: "details", type: "table" },
        { id: "days_with_rain", label: "days_with_rain", type: "table" },
        { id: "inventories", label: "inventories", type: "table" }
      ]
    }
  ]
};

// --- Table details data ---
export function getTableDetailsData(tableName: string) {
  const lower = tableName.toLowerCase();

  if (lower.includes("user_behavior") || lower.includes("behavior")) {
    return {
      schemaRows: [
        { name: "user_id", type: "STRING", mode: "REQUIRED", description: "Unique identifier for each user profile" },
        { name: "signup_date", type: "DATE", mode: "NULLABLE", description: "Date when user registered" },
        { name: "signup_region", type: "STRING", mode: "NULLABLE", description: "Geographic region of registration" },
        { name: "last_active_date", type: "DATE", mode: "NULLABLE", description: "Most recent activity timestamp" },
        { name: "session_count", type: "INTEGER", mode: "NULLABLE", description: "Total sessions logged in Q2" },
        { name: "total_spend", type: "FLOAT", mode: "NULLABLE", description: "Cumulative spend amount in USD" },
      ],
      previewRows: [
        { user_id: "USR001", signup_date: "2026-01-12", signup_region: "North America", last_active_date: "2026-06-28", session_count: "42", total_spend: "1250.00" },
        { user_id: "USR002", signup_date: "2026-02-05", signup_region: "Europe", last_active_date: "2026-06-25", session_count: "38", total_spend: "980.50" },
        { user_id: "USR003", signup_date: "2026-02-18", signup_region: "Asia", last_active_date: "2026-06-29", session_count: "64", total_spend: "2100.75" },
        { user_id: "USR004", signup_date: "2026-03-01", signup_region: "LATAM", last_active_date: "2026-06-14", session_count: "15", total_spend: "340.20" },
        { user_id: "USR005", signup_date: "2026-03-22", signup_region: "North America", last_active_date: "2026-06-30", session_count: "89", total_spend: "3450.00" },
      ],
      tableId: `daui-storage.jamesdavidson.${tableName}`,
      rowCount: "342,800",
      totalBytes: "14.2 MB",
    };
  }

  if (lower.includes("order_history") || lower.includes("orders_master") || lower.includes("order")) {
    return {
      schemaRows: [
        { name: "order_id", type: "STRING", mode: "REQUIRED", description: "Unique order transaction identifier" },
        { name: "customer_id", type: "STRING", mode: "REQUIRED", description: "Foreign key linking to user profiles" },
        { name: "order_date", type: "TIMESTAMP", mode: "NULLABLE", description: "Timestamp of purchase completion" },
        { name: "amount", type: "FLOAT", mode: "NULLABLE", description: "Net monetary value of order" },
        { name: "category", type: "STRING", mode: "NULLABLE", description: "Primary merchandise category" },
        { name: "status", type: "STRING", mode: "NULLABLE", description: "Fulfillment status (COMPLETED, PENDING)" },
      ],
      previewRows: [
        { order_id: "ORD-2026-901", customer_id: "USR001", order_date: "2026-06-01 10:14:22", amount: "128.85", category: "Apparel & Footwear", status: "COMPLETED" },
        { order_id: "ORD-2026-902", customer_id: "USR003", order_date: "2026-06-01 11:32:05", amount: "245.00", category: "Electronics", status: "COMPLETED" },
        { order_id: "ORD-2026-903", customer_id: "USR005", order_date: "2026-06-02 09:45:10", amount: "89.99", category: "Home & Garden", status: "COMPLETED" },
        { order_id: "ORD-2026-904", customer_id: "USR002", order_date: "2026-06-03 14:20:18", amount: "412.50", category: "Apparel & Footwear", status: "COMPLETED" },
        { order_id: "ORD-2026-905", customer_id: "USR004", order_date: "2026-06-04 16:05:40", amount: "64.20", category: "Apparel & Footwear", status: "COMPLETED" },
      ],
      tableId: `daui-storage.orders.${tableName}`,
      rowCount: "14,280",
      totalBytes: "4.8 MB",
    };
  }

  if (lower.includes("feedback") || lower.includes("logs") || lower.includes(".txt") || lower.includes("gs://")) {
    return {
      schemaRows: [
        { name: "timestamp", type: "TIMESTAMP", mode: "REQUIRED", description: "Log emission event timestamp" },
        { name: "log_level", type: "STRING", mode: "NULLABLE", description: "Severity (INFO, WARN, ERROR)" },
        { name: "user_id", type: "STRING", mode: "NULLABLE", description: "User ID linked to event" },
        { name: "region", type: "STRING", mode: "NULLABLE", description: "Client origin region" },
        { name: "message", type: "STRING", mode: "NULLABLE", description: "Raw event log text payload" },
      ],
      previewRows: [
        { timestamp: "2026-04-01 09:14:13", log_level: "INFO", user_id: "USR0982", region: "Asia", message: "Requesting more payment options..." },
        { timestamp: "2026-04-01 13:02:02", log_level: "WARN", user_id: "USR0505", region: "Europe", message: "Frustrated with the slow page transitions" },
        { timestamp: "2026-04-02 11:45:10", log_level: "ERROR", user_id: "USR1104", region: "North America", message: "Checkout API gateway timeout 504" },
        { timestamp: "2026-04-02 15:20:44", log_level: "WARN", user_id: "USR0312", region: "Europe", message: "SMS verification code delivery delayed" },
        { timestamp: "2026-04-03 08:30:19", log_level: "INFO", user_id: "USR0877", region: "LATAM", message: "Session initiated successfully" },
      ],
      tableId: `gcs-storage.logs.${tableName.replace(/^gs:\/\//, '')}`,
      rowCount: "1,200,000",
      totalBytes: "52.4 MB",
    };
  }

  if (lower.includes("revenue") || lower.includes("sales") || lower.includes("campaign") || lower.includes("spend")) {
    return {
      schemaRows: [
        { name: "campaign_id", type: "STRING", mode: "REQUIRED", description: "Marketing campaign unique code" },
        { name: "campaign_name", type: "STRING", mode: "NULLABLE", description: "Human readable campaign title" },
        { name: "region", type: "STRING", mode: "NULLABLE", description: "Target geography" },
        { name: "spend", type: "FLOAT", mode: "NULLABLE", description: "Total ad spend incurred ($)" },
        { name: "clicks", type: "INTEGER", mode: "NULLABLE", description: "Total user click-throughs" },
        { name: "date", type: "DATE", mode: "NULLABLE", description: "Reporting record date" },
      ],
      previewRows: [
        { campaign_id: "CMP01", campaign_name: "Spring Savings", region: "North America", spend: "2959.77", clicks: "653", date: "2026-04-01" },
        { campaign_id: "CMP01", campaign_name: "Spring Savings", region: "North America", spend: "3992.66", clicks: "1169", date: "2026-04-08" },
        { campaign_id: "CMP02", campaign_name: "Summer Kickoff", region: "Europe", spend: "3077.05", clicks: "528", date: "2026-04-01" },
        { campaign_id: "CMP02", campaign_name: "Summer Kickoff", region: "Asia", spend: "4028.14", clicks: "658", date: "2026-04-08" },
        { campaign_id: "CMP03", campaign_name: "Brand Awareness", region: "LATAM", spend: "3295.09", clicks: "961", date: "2026-04-01" },
      ],
      tableId: `daui-storage.chat_data.${tableName}`,
      rowCount: "48,920",
      totalBytes: "3.2 MB",
    };
  }

  if (lower.includes("latency") || lower.includes("monitoring") || lower.includes("anomaly")) {
    return {
      schemaRows: [
        { name: "timestamp", type: "TIMESTAMP", mode: "REQUIRED", description: "Metric sample timestamp" },
        { name: "endpoint", type: "STRING", mode: "NULLABLE", description: "Monitored API URI route" },
        { name: "p95_latency_ms", type: "FLOAT", mode: "NULLABLE", description: "95th percentile latency in ms" },
        { name: "p99_latency_ms", type: "FLOAT", mode: "NULLABLE", description: "99th percentile latency in ms" },
        { name: "error_rate", type: "FLOAT", mode: "NULLABLE", description: "Percentage of non-2xx HTTP responses" },
        { name: "server_cluster", type: "STRING", mode: "NULLABLE", description: "Infrastructure node cluster ID" },
      ],
      previewRows: [
        { timestamp: "2026-06-28 14:32:00", endpoint: "/api/v1/checkout", p95_latency_ms: "382.5", p99_latency_ms: "1420.0", error_rate: "4.20%", server_cluster: "cluster-01" },
        { timestamp: "2026-06-28 14:35:00", endpoint: "/api/v1/checkout", p95_latency_ms: "410.0", p99_latency_ms: "1650.0", error_rate: "5.80%", server_cluster: "cluster-01" },
        { timestamp: "2026-07-01 09:15:00", endpoint: "/api/v1/users/login", p95_latency_ms: "45.0", p99_latency_ms: "120.0", error_rate: "0.01%", server_cluster: "cluster-04" },
        { timestamp: "2026-07-01 09:30:00", endpoint: "/api/v1/products/search", p95_latency_ms: "38.2", p99_latency_ms: "95.4", error_rate: "0.00%", server_cluster: "cluster-02" },
      ],
      tableId: `monitoring.system_metrics.${tableName}`,
      rowCount: "86,400",
      totalBytes: "6.1 MB",
    };
  }

  if (lower.includes("corporate") || lower.includes("account")) {
    return {
      schemaRows: [
        { name: "account_id", type: "STRING", mode: "REQUIRED", description: "Enterprise account unique ID" },
        { name: "company_name", type: "STRING", mode: "NULLABLE", description: "Corporate organization legal name" },
        { name: "arr", type: "FLOAT", mode: "NULLABLE", description: "Annual Recurring Revenue in USD" },
        { name: "contract_date", type: "DATE", mode: "NULLABLE", description: "Date contract was executed" },
        { name: "account_tier", type: "STRING", mode: "NULLABLE", description: "Service level agreement tier" },
      ],
      previewRows: [
        { account_id: "ACC-01", company_name: "Acme Enterprise Corp", arr: "145000.00", contract_date: "2026-06-04", account_tier: "Enterprise Gold" },
        { account_id: "ACC-02", company_name: "Globex Global Logistics", arr: "112000.00", contract_date: "2026-06-12", account_tier: "Enterprise Standard" },
        { account_id: "ACC-03", company_name: "Initech Systems", arr: "98000.00", contract_date: "2026-06-19", account_tier: "Enterprise Standard" },
        { account_id: "ACC-04", company_name: "Umbrella Health Ltd", arr: "84000.00", contract_date: "2026-06-22", account_tier: "Enterprise Select" },
        { account_id: "ACC-05", company_name: "Stark Tech Solutions", arr: "79000.00", contract_date: "2026-06-28", account_tier: "Enterprise Select" },
      ],
      tableId: `sales.corporate.${tableName}`,
      rowCount: "5",
      totalBytes: "1.2 KB",
    };
  }

  return {
    schemaRows: [
      { name: "record_id", type: "STRING", mode: "REQUIRED", description: `Unique identifier for ${tableName}` },
      { name: "entity_name", type: "STRING", mode: "NULLABLE", description: "Associated entity or metric name" },
      { name: "category", type: "STRING", mode: "NULLABLE", description: "Classification group" },
      { name: "metric_value", type: "FLOAT", mode: "NULLABLE", description: "Calculated metric value" },
      { name: "status", type: "STRING", mode: "NULLABLE", description: "Current record status" },
      { name: "updated_at", type: "TIMESTAMP", mode: "NULLABLE", description: "Last modified timestamp" },
    ],
    previewRows: [
      { record_id: "REC-101", entity_name: `${tableName}_Item_A`, category: "Primary", metric_value: "1452.80", status: "ACTIVE", updated_at: "2026-07-01 10:00:00" },
      { record_id: "REC-102", entity_name: `${tableName}_Item_B`, category: "Secondary", metric_value: "982.40", status: "ACTIVE", updated_at: "2026-07-01 11:15:30" },
      { record_id: "REC-103", entity_name: `${tableName}_Item_C`, category: "Primary", metric_value: "2150.00", status: "VERIFIED", updated_at: "2026-07-02 08:45:12" },
      { record_id: "REC-104", entity_name: `${tableName}_Item_D`, category: "Tertiary", metric_value: "670.15", status: "PENDING", updated_at: "2026-07-02 14:22:05" },
      { record_id: "REC-105", entity_name: `${tableName}_Item_E`, category: "Secondary", metric_value: "1890.50", status: "ACTIVE", updated_at: "2026-07-03 09:10:00" },
    ],
    tableId: `daui-storage.dataset.${tableName.replace(/[^a-zA-Z0-9_]/g, '_')}`,
    rowCount: "52,400",
    totalBytes: "2.6 MB",
  };
}
