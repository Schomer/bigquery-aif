import * as React from "react";
import {
  ActionBar,
  ActionBarTitle,
  ActionBarEnd,
  Button,
  Card,
  Tag,
  SuggestionChip,
  MaterialSymbols,
  HelpButton,
  snackbar,
} from "@/kit";

export interface AiInboxScreenProps {
  activeProject?: string;
  onJump?: (prompt: string) => void;
}

interface InboxItem {
  id: string;
  category: "Optimization" | "Failure" | "Security" | "Cost";
  badgeTheme: "primary" | "danger-soft" | "warning" | "default";
  title: string;
  description: string;
  impact: string;
  suggestedPrompt: string;
  primaryAction: string;
}

export function AiInboxScreen({ activeProject = "streamify-prod", onJump }: AiInboxScreenProps) {
  const [items, setItems] = React.useState<InboxItem[]>([
    {
      id: "inbox-1",
      category: "Optimization",
      badgeTheme: "primary",
      title: "Partitioning & clustering opportunity detected",
      description: 'Clustering "cymbal-marketing.crm.clickstream_clean_daily" on user_id will reduce scan costs by 68%.',
      impact: "Saves ~1.2 TB per daily ETL run",
      suggestedPrompt: "Recommend partitioning and clustering DDL for cymbal-marketing.crm.clickstream_clean_daily",
      primaryAction: "Apply Clustering",
    },
    {
      id: "inbox-2",
      category: "Cost",
      badgeTheme: "warning",
      title: "Query cost spike on scheduled dashboard query",
      description: 'Unpartitioned table scan on "streamify-prod.prd_gold.churn_features" is scanning 4.8 TB per execution in scheduled report.',
      impact: "$24.00 per execution",
      suggestedPrompt: "Optimize query on streamify-prod.prd_gold.churn_features to inject partition filters",
      primaryAction: "Optimize SQL",
    },
    {
      id: "inbox-3",
      category: "Failure",
      badgeTheme: "danger-soft",
      title: "Dataform pipeline task failed: clean_silver_transform",
      description: 'Airflow / Dataform task failed due to unexpected NULL values in required field "customer_id".',
      impact: "Silver layer data stale by 2 hours",
      suggestedPrompt: "Troubleshoot and fix pipeline failure in task clean_silver_transform",
      primaryAction: "Fix Pipeline",
    },
    {
      id: "inbox-4",
      category: "Security",
      badgeTheme: "warning",
      title: "Sensitive column lacks masking policy tag",
      description: 'Column "client_ip" in raw_logs.dk_api_logs contains identifiable IP addresses without an anonymization mask.',
      impact: "Compliance governance risk",
      suggestedPrompt: "Create a data masking policy tag for client_ip in raw_logs.dk_api_logs",
      primaryAction: "Add Masking",
    },
  ]);

  const handleDismiss = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
    snackbar("Insight dismissed");
  };

  const handleTriggerPrompt = (prompt: string) => {
    if (onJump) {
      onJump(prompt);
    }
  };

  return (
    <div className="flex flex-1 flex-col overflow-auto bg-cm-surface">
      {/* Top Action Bar */}
      <ActionBar>
        <ActionBarTitle
          status={<Tag theme="primary">{items.length} Active Insights</Tag>}
        >
          AI Inbox & Proactive Insights
        </ActionBarTitle>
        <Button
          variant="stroked"
          onClick={() => {
            setItems([]);
            snackbar("All insights marked as resolved");
          }}
        >
          Mark all resolved
        </Button>
        <ActionBarEnd>
          <HelpButton title="AI Inbox Guidance">
            Autonomous data intelligence that continuously monitors query costs, schema drift, pipeline failures, and governance risks.
          </HelpButton>
        </ActionBarEnd>
      </ActionBar>

      {/* Main Content */}
      <div className="flex flex-1 flex-col gap-6 p-6 overflow-y-auto max-w-[1200px]">
        {/* Suggestion Chips */}
        <div className="flex flex-col gap-2">
          <div className="text-cm-label-small text-cm-on-surface-variant uppercase tracking-wider">
            Quick Actions
          </div>
          <div className="flex flex-wrap gap-2">
            <SuggestionChip
              icon={<MaterialSymbols.Monitoring className="size-4" />}
              onClick={() =>
                handleTriggerPrompt("Analyze all active AI insights and produce an executive data health summary")
              }
            >
              Generate data health summary
            </SuggestionChip>
            <SuggestionChip
              icon={<MaterialSymbols.TrendingUp className="size-4" />}
              onClick={() =>
                handleTriggerPrompt("Find top 5 highest cost queries in the last 7 days and generate optimization recommendations")
              }
            >
              Find top 5 expensive queries
            </SuggestionChip>
            <SuggestionChip
              icon={<MaterialSymbols.Delete className="size-4" />}
              onClick={() =>
                handleTriggerPrompt("Identify unused or abandoned BigQuery tables that can be archived")
              }
            >
              Archive unused tables
            </SuggestionChip>
          </div>
        </div>

        {/* Insight Notification Cards */}
        {items.length === 0 ? (
          <Card className="p-12 text-center bg-cm-surface-variant flex flex-col items-center justify-center">
            <MaterialSymbols.CheckCircle className="size-12 text-cm-status-success mb-3" />
            <h3 className="text-cm-title-medium text-cm-on-surface mb-1">All Clear!</h3>
            <p className="text-cm-body-medium text-cm-on-surface-variant max-w-md">
              No anomalies, cost spikes, or pipeline failures detected across your data assets.
            </p>
          </Card>
        ) : (
          <div className="flex flex-col gap-4">
            {items.map((item) => (
              <Card key={item.id} className="p-6 bg-cm-surface-variant">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Tag theme={item.badgeTheme}>{item.category}</Tag>
                      <span className="text-cm-body-small text-cm-on-surface-variant">
                        {item.impact}
                      </span>
                    </div>

                    <h3 className="text-cm-title-small text-cm-on-surface font-medium mb-1">
                      {item.title}
                    </h3>
                    <p className="text-cm-body-medium text-cm-on-surface-variant">
                      {item.description}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      variant="stroked"
                      onClick={() => handleDismiss(item.id)}
                    >
                      Dismiss
                    </Button>
                    <Button
                      leftIcon={<MaterialSymbols.AutoAwesome className="size-4" />}
                      onClick={() => handleTriggerPrompt(item.suggestedPrompt)}
                    >
                      {item.primaryAction}
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
