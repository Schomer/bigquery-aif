import * as React from "react";
import {
  ActionBar,
  ActionBarTitle,
  ActionBarEnd,
  Button,
  Card,
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
  TableFrame,
  TableTitleBar,
  TableTitle,
  Tag,
  SuggestionChip,
  MaterialSymbols,
  HelpButton,
} from "@/kit";

export interface AutomationScreenProps {
  activeProject?: string;
  onJump?: (prompt: string) => void;
}

interface AutomationItem {
  id: string;
  name: string;
  type: "Scheduled Query" | "DTS Transfer" | "Dataform";
  schedule: string;
  destination: string;
  lastRun: string;
  status: "active" | "error" | "paused";
}

export function AutomationScreen({ activeProject = "streamify-prod", onJump }: AutomationScreenProps) {
  const automationItems: AutomationItem[] = [
    {
      id: "auto-1",
      name: "Daily Customer Churn Aggregation",
      type: "Scheduled Query",
      schedule: "Every 24 hours at 02:00 UTC",
      destination: "streamify-prod.prd_gold.churn_features",
      lastRun: "6 hours ago (Success)",
      status: "active",
    },
    {
      id: "auto-2",
      name: "Hourly Clickstream Silver Ingestion",
      type: "Dataform",
      schedule: "Every 1 hour",
      destination: "streamify-prod.prd_silver.stg_events",
      lastRun: "12 mins ago (Success)",
      status: "active",
    },
    {
      id: "auto-3",
      name: "Cloud Storage Raw Log Sync",
      type: "DTS Transfer",
      schedule: "Every 15 minutes",
      destination: "streamify-prod.raw_logs.gcs_incoming",
      lastRun: "4 mins ago (Success)",
      status: "active",
    },
    {
      id: "auto-4",
      name: "Weekly Marketing Attribution Rollup",
      type: "Scheduled Query",
      schedule: "Every Monday at 00:00 UTC",
      destination: "streamify-prod.prd_gold.campaign_roi",
      lastRun: "2 days ago (Error - Timeout)",
      status: "error",
    },
  ];

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
          status={<Tag theme="success">4 Pipelines</Tag>}
        >
          Automation & Scheduled Queries
        </ActionBarTitle>
        <Button
          leftIcon={<MaterialSymbols.Add className="size-4" />}
          onClick={() =>
            handleTriggerPrompt("Help me create a new scheduled query in BigQuery")
          }
        >
          Create Scheduled Query
        </Button>
        <Button
          variant="stroked"
          leftIcon={<MaterialSymbols.Refresh className="size-4" />}
          onClick={() => {}}
        >
          Refresh
        </Button>
        <ActionBarEnd>
          <HelpButton title="Automation & Pipeline Guidance">
            Manage scheduled queries, BigQuery Data Transfer Service (DTS) ingestion configs, and Dataform ELT workflows.
          </HelpButton>
        </ActionBarEnd>
      </ActionBar>

      {/* Main Content */}
      <div className="flex flex-1 flex-col gap-6 p-6 overflow-y-auto">
        {/* Summary Scorecards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="p-4 bg-cm-surface-variant flex flex-col justify-between">
            <span className="text-cm-label-small text-cm-on-surface-variant uppercase tracking-wider">
              Scheduled Queries
            </span>
            <div className="mt-2">
              <span className="text-cm-headline-medium text-cm-on-surface font-normal font-sans">
                12
              </span>
              <p className="text-cm-body-small text-cm-status-success mt-0.5">
                11 active • 1 requires attention
              </p>
            </div>
          </Card>

          <Card className="p-4 bg-cm-surface-variant flex flex-col justify-between">
            <span className="text-cm-label-small text-cm-on-surface-variant uppercase tracking-wider">
              DTS Transfers
            </span>
            <div className="mt-2">
              <span className="text-cm-headline-medium text-cm-on-surface font-normal font-sans">
                4
              </span>
              <p className="text-cm-body-small text-cm-status-success mt-0.5">
                Cloud Storage, Google Ads
              </p>
            </div>
          </Card>

          <Card className="p-4 bg-cm-surface-variant flex flex-col justify-between">
            <span className="text-cm-label-small text-cm-on-surface-variant uppercase tracking-wider">
              Dataform Workflows
            </span>
            <div className="mt-2">
              <span className="text-cm-headline-medium text-cm-on-surface font-normal font-sans">
                6
              </span>
              <p className="text-cm-body-small text-cm-status-success mt-0.5">
                Compiled & verified
              </p>
            </div>
          </Card>

          <Card className="p-4 bg-cm-surface-variant flex flex-col justify-between">
            <span className="text-cm-label-small text-cm-on-surface-variant uppercase tracking-wider">
              Success Rate (30d)
            </span>
            <div className="mt-2">
              <span className="text-cm-headline-medium text-cm-status-success font-normal font-sans">
                99.2%
              </span>
              <p className="text-cm-body-small text-cm-on-surface-variant mt-0.5">
                2,480 automated executions
              </p>
            </div>
          </Card>
        </div>

        {/* Suggestion Chips */}
        <div className="flex flex-col gap-2">
          <div className="text-cm-label-small text-cm-on-surface-variant uppercase tracking-wider">
            Automation Actions
          </div>
          <div className="flex flex-wrap gap-2">
            <SuggestionChip
              icon={<MaterialSymbols.Schedule className="size-4" />}
              onClick={() =>
                handleTriggerPrompt("List all scheduled queries, execution frequency, and target tables in this project")
              }
            >
              List all scheduled queries
            </SuggestionChip>
            <SuggestionChip
              icon={<MaterialSymbols.AutoAwesome className="size-4" />}
              onClick={() =>
                handleTriggerPrompt("Create a daily scheduled query to compute rolling 7-day revenue by product category")
              }
            >
              Create daily revenue schedule
            </SuggestionChip>
            <SuggestionChip
              icon={<MaterialSymbols.CheckCircle className="size-4" />}
              onClick={() =>
                handleTriggerPrompt("Check Dataform repository compilation status and recent release configuration runs")
              }
            >
              Check Dataform compilation
            </SuggestionChip>
            <SuggestionChip
              icon={<MaterialSymbols.Schedule className="size-4" />}
              onClick={() =>
                handleTriggerPrompt("Set up a data freshness alert if table `streamify-prod.prd_gold.churn_features` has not updated in 24 hours")
              }
            >
              Set up freshness alert
            </SuggestionChip>
          </div>
        </div>

        {/* Automation Pipelines Table */}
        <TableFrame>
          <TableTitleBar>
            <TableTitle>Configured Pipelines & Scheduled Automations</TableTitle>
          </TableTitleBar>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Automation Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Schedule</TableHead>
                <TableHead>Destination Table</TableHead>
                <TableHead>Last Run</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {automationItems.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium text-cm-on-surface">
                    {item.name}
                  </TableCell>
                  <TableCell>
                    <Tag theme="default">{item.type}</Tag>
                  </TableCell>
                  <TableCell className="text-cm-body-small text-cm-on-surface-variant">
                    {item.schedule}
                  </TableCell>
                  <TableCell className="font-mono text-cm-code text-cm-on-surface">
                    {item.destination}
                  </TableCell>
                  <TableCell className="text-cm-body-small text-cm-on-surface-variant">
                    {item.lastRun}
                  </TableCell>
                  <TableCell>
                    {item.status === "active" && (
                      <Tag theme="success">Active</Tag>
                    )}
                    {item.status === "error" && (
                      <Tag theme="danger-soft">Error</Tag>
                    )}
                    {item.status === "paused" && (
                      <Tag theme="warning">Paused</Tag>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="stroked"
                        onClick={() =>
                          handleTriggerPrompt(`Trigger manual execution for pipeline "${item.name}"`)
                        }
                      >
                        Run Now
                      </Button>
                      <Button
                        variant="text"
                        onClick={() =>
                          handleTriggerPrompt(`Review and optimize scheduled query "${item.name}"`)
                        }
                      >
                        Edit
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableFrame>
      </div>
    </div>
  );
}
