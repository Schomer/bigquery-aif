export type ChipType = "table" | "gcs" | "chart" | "notebook" | "file" | "graph";

export interface Chip {
  id: string;
  label: string;
  type: ChipType;
}

export interface AtMenuItem {
  name: string;
  subtitle: string;
  type: "table" | "chart" | "notebook" | "gcs" | "graph";
}

export interface BqTreeItem {
  id: string;
  label: string;
  type: "project" | "dataset" | "folder" | "table" | "model" | "graph";
  children?: BqTreeItem[];
}

export type ModelId = "flash" | "pro" | "pro25" | "flash-lite";

export const GREETING_NAMES = [
  "Lena",
  "Chenyu",
  "Timo",
  "James",
  "Isaac",
] as const;

export type GreetingName = (typeof GREETING_NAMES)[number];

export function getRandomGreetingName(exclude?: string): GreetingName {
  const pool = exclude ? GREETING_NAMES.filter((n) => n !== exclude) : GREETING_NAMES;
  const randomIndex = Math.floor(Math.random() * pool.length);
  return pool[randomIndex];
}

export interface ModelOption {
  id: ModelId;
  label: string;
  short: string;
}

export const MODEL_OPTIONS: ModelOption[] = [
  { id: "flash", label: "Gemini 3.5 Flash", short: "Gemini 3.5 Flash" },
];

export const AT_MENU_ITEMS: AtMenuItem[] = [
  {
    name: "account",
    subtitle: "bq-gca-autopush.chatsession_data.account",
    type: "table",
  },
  {
    name: "fraud_transactions",
    subtitle: "daui-storage.test.fraud_transactions",
    type: "table",
  },
  {
    name: "user_behavior_table",
    subtitle: "daui-storage.jamesdavidson.user_behavior_table",
    type: "table",
  },
  {
    name: "Queryname1",
    subtitle: "daui-storage / us-west1 / folder 1",
    type: "chart",
  },
  {
    name: "Analysisquery",
    subtitle: "daui-storage / shared with me",
    type: "chart",
  },
  {
    name: "forecasting",
    subtitle: "daui-storage / us-west1 / testing notebooks",
    type: "notebook",
  },
  {
    name: "active_subscriptions",
    subtitle: "bq-billing-prod.revenue.active_subscriptions",
    type: "table",
  },
  {
    name: "annual_budget_forecast",
    subtitle: "daui-storage / finance_reports / 2026",
    type: "chart",
  },
  {
    name: "customer_feedback_logs",
    subtitle: "daui-storage.test.customer_feedback_logs",
    type: "table",
  },
  {
    name: "churn_prediction_model",
    subtitle: "daui-storage / ml_models / retention_v2",
    type: "notebook",
  },
  {
    name: "daily_active_users",
    subtitle: "bq-analytics-prod.user_metrics.daily_active_users",
    type: "table",
  },
  {
    name: "inventory_snapshot",
    subtitle: "bq-supplychain.warehouse.inventory_snapshot",
    type: "table",
  },
  {
    name: "marketing_attribution_query",
    subtitle: "daui-storage / us-central1 / marketing_queries",
    type: "chart",
  },
  {
    name: "orders_summary",
    subtitle: "daui-storage.ecommerce.orders_summary",
    type: "table",
  },
  {
    name: "payment_gateway_logs",
    subtitle: "bq-transactions.security.payment_gateway_logs",
    type: "table",
  },
  {
    name: "q3_sales_performance",
    subtitle: "daui-storage / shared with me / Q3_reports",
    type: "chart",
  },
  {
    name: "realtime_clickstream",
    subtitle: "bq-stream-prod.events.realtime_clickstream",
    type: "table",
  },
  {
    name: "sentiment_analysis_pipeline",
    subtitle: "daui-storage / notebooks / nlp_experiments",
    type: "notebook",
  },
  {
    name: "user_retention_cohorts",
    subtitle: "bq-analytics-prod.cohorts.user_retention_cohorts",
    type: "table",
  },
  {
    name: "weekly_revenue_trends",
    subtitle: "daui-storage / us-east1 / executive_dashboards",
    type: "chart",
  },
];

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  chips?: Chip[];
  thinking?: string[];
  timestamp?: string;
}
