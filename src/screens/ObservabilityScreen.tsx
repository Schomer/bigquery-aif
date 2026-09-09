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
  Pagination,
  PaginationRange,
  PaginationControls,
  PaginationPrevious,
  PaginationNext,
} from "@/kit";

export interface ObservabilityScreenProps {
  activeProject?: string;
  onJump?: (prompt: string) => void;
}

interface QueryJob {
  id: string;
  user: string;
  query: string;
  bytes: string;
  duration: string;
  status: "success" | "failed" | "running";
  created: string;
}

export function ObservabilityScreen({ activeProject = "streamify-prod", onJump }: ObservabilityScreenProps) {
  const [page, setPage] = React.useState(1);

  const sampleJobs: QueryJob[] = [
    {
      id: "job_b7vC4xZ9mK2pL0nQ8wE1rT3yU5iO",
      user: "data-pipeline@streamify-prod.iam",
      query: "SELECT user_id, COUNT(*) as sessions FROM `streamify-prod.prd_gold.user_behavior` WHERE date = CURRENT_DATE() GROUP BY 1",
      bytes: "18.4 GB",
      duration: "4.2s",
      status: "success",
      created: "2 mins ago",
    },
    {
      id: "job_qplvshj-A8L23qMdDzHOBoStEGFO",
      user: "analytics-team@streamify.com",
      query: "SELECT c.*, o.* FROM `streamify-prod.prd_gold.customers` c JOIN `orders_raw` o ON c.id = o.user_id",
      bytes: "142.8 GB",
      duration: "18.6s",
      status: "failed",
      created: "8 mins ago",
    },
    {
      id: "job_EGp0cRqTIJQ7nd2lf9raVVyZjrqw",
      user: "cron-scheduler@streamify.internal",
      query: "MERGE INTO `streamify-prod.prd_gold.churn_features` T USING `streamify-prod.prd_silver.stg_events` S ON T.id = S.id ...",
      bytes: "84.2 GB",
      duration: "12.1s",
      status: "success",
      created: "15 mins ago",
    },
    {
      id: "job_w5Xy9zLp2M1qA3sD7fG8hJ0kL2vC",
      user: "james@streamify.com",
      query: "SELECT country_code, SUM(amount_usd) FROM `streamify-prod.prd_gold.orders_summary` GROUP BY 1 ORDER BY 2 DESC LIMIT 10",
      bytes: "2.4 GB",
      duration: "1.1s",
      status: "success",
      created: "24 mins ago",
    },
    {
      id: "job_m8N2bV4cX7zL1kP9qW3eR5tY0uI",
      user: "data-science-batch@streamify.com",
      query: "SELECT * FROM ML.PREDICT(MODEL `streamify-prod.ml_models.user_churn`, TABLE `user_features_eval`)",
      bytes: "310.5 GB",
      duration: "45.8s",
      status: "success",
      created: "42 mins ago",
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
          status={<Tag theme="success">Healthy</Tag>}
        >
          Observability & Query Health
        </ActionBarTitle>
        <Button
          variant="stroked"
          leftIcon={<MaterialSymbols.Refresh className="size-4" />}
          onClick={() => {}}
        >
          Refresh
        </Button>
        <ActionBarEnd>
          <HelpButton title="Observability Guidance">
            Monitor BigQuery execution telemetry, slot utilization, query performance bottlenecks, and pipeline reliability metrics.
          </HelpButton>
        </ActionBarEnd>
      </ActionBar>

      {/* Observability Dashboard Container */}
      <div className="flex flex-1 flex-col gap-6 p-6 overflow-y-auto">
        {/* KPI Scorecards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <Card className="p-4 bg-cm-surface-variant flex flex-col justify-between">
            <span className="text-cm-label-small text-cm-on-surface-variant uppercase tracking-wider">
              Total Queries (24h)
            </span>
            <div className="mt-2">
              <span className="text-cm-headline-medium text-cm-on-surface font-normal font-sans">
                14,892
              </span>
              <p className="text-cm-body-small text-cm-status-success mt-0.5">
                +8.4% vs yesterday
              </p>
            </div>
          </Card>

          <Card className="p-4 bg-cm-surface-variant flex flex-col justify-between">
            <span className="text-cm-label-small text-cm-on-surface-variant uppercase tracking-wider">
              Data Scanned
            </span>
            <div className="mt-2">
              <span className="text-cm-headline-medium text-cm-on-surface font-normal font-sans">
                4.2 TB
              </span>
              <p className="text-cm-body-small text-cm-on-surface-variant mt-0.5">
                Est. cost: $26.40
              </p>
            </div>
          </Card>

          <Card className="p-4 bg-cm-surface-variant flex flex-col justify-between">
            <span className="text-cm-label-small text-cm-on-surface-variant uppercase tracking-wider">
              Avg Slot Usage
            </span>
            <div className="mt-2">
              <span className="text-cm-headline-medium text-cm-on-surface font-normal font-sans">
                182 <span className="text-cm-title-small text-cm-on-surface-variant">/ 250</span>
              </span>
              <p className="text-cm-body-small text-cm-status-success mt-0.5">
                72.8% reservation utilization
              </p>
            </div>
          </Card>

          <Card className="p-4 bg-cm-surface-variant flex flex-col justify-between">
            <span className="text-cm-label-small text-cm-on-surface-variant uppercase tracking-wider">
              Error Rate
            </span>
            <div className="mt-2">
              <span className="text-cm-headline-medium text-cm-on-surface font-normal font-sans">
                0.4%
              </span>
              <p className="text-cm-body-small text-cm-status-success mt-0.5">
                2 failed of 512 scheduled
              </p>
            </div>
          </Card>

          <Card className="p-4 bg-cm-surface-variant flex flex-col justify-between">
            <span className="text-cm-label-small text-cm-on-surface-variant uppercase tracking-wider">
              Avg Latency
            </span>
            <div className="mt-2">
              <span className="text-cm-headline-medium text-cm-on-surface font-normal font-sans">
                2.8s
              </span>
              <p className="text-cm-body-small text-cm-on-surface-variant mt-0.5">
                P95: 14.2s
              </p>
            </div>
          </Card>
        </div>

        {/* Action Suggestion Chips Strip */}
        <div className="flex flex-col gap-2">
          <div className="text-cm-label-small text-cm-on-surface-variant uppercase tracking-wider">
            AI Observability Prompts
          </div>
          <div className="flex flex-wrap gap-2">
            <SuggestionChip
              icon={<MaterialSymbols.Monitoring className="size-4" />}
              onClick={() =>
                handleTriggerPrompt("Show me the slowest BigQuery queries in the last 24 hours and explain why they are slow")
              }
            >
              Analyze slowest queries (24h)
            </SuggestionChip>
            <SuggestionChip
              icon={<MaterialSymbols.Warning className="size-4" />}
              onClick={() =>
                handleTriggerPrompt("Find recent failed BigQuery jobs and analyze the root cause errors")
              }
            >
              Investigate failed queries
            </SuggestionChip>
            <SuggestionChip
              icon={<MaterialSymbols.TrendingUp className="size-4" />}
              onClick={() =>
                handleTriggerPrompt("Analyze BigQuery slot contention, queue times, and spill-to-disk metrics")
              }
            >
              Check slot contention & spill-to-disk
            </SuggestionChip>
            <SuggestionChip
              icon={<MaterialSymbols.QueryStats className="size-4" />}
              onClick={() =>
                handleTriggerPrompt("Break down BigQuery query spend and scanned bytes by user and dataset")
              }
            >
              Cost breakdown by user
            </SuggestionChip>
          </div>
        </div>

        {/* Recent Query Jobs Table */}
        <TableFrame>
          <TableTitleBar>
            <TableTitle>Recent BigQuery Execution Jobs</TableTitle>
          </TableTitleBar>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Job ID</TableHead>
                <TableHead>User / Account</TableHead>
                <TableHead className="w-1/3">Query</TableHead>
                <TableHead>Data Scanned</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sampleJobs.map((job) => (
                <TableRow key={job.id}>
                  <TableCell className="font-mono text-cm-code text-cm-on-surface">
                    {job.id.slice(0, 14)}...
                  </TableCell>
                  <TableCell className="text-cm-body-small text-cm-on-surface-variant">
                    {job.user}
                  </TableCell>
                  <TableCell className="font-mono text-cm-code text-cm-on-surface truncate max-w-[320px]">
                    {job.query}
                  </TableCell>
                  <TableCell className="text-cm-body-small text-cm-on-surface font-medium">
                    {job.bytes}
                  </TableCell>
                  <TableCell className="text-cm-body-small text-cm-on-surface-variant">
                    {job.duration}
                  </TableCell>
                  <TableCell>
                    {job.status === "success" && (
                      <Tag theme="success">Success</Tag>
                    )}
                    {job.status === "failed" && (
                      <Tag theme="danger-soft">Failed</Tag>
                    )}
                    {job.status === "running" && (
                      <Tag theme="warning">Running</Tag>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="text"
                        onClick={() =>
                          handleTriggerPrompt(`Explain this query execution and optimize it: ${job.query}`)
                        }
                      >
                        Explain
                      </Button>
                      <Button
                        variant="stroked"
                        onClick={() =>
                          handleTriggerPrompt(`Recommend partitioning and clustering optimization for: ${job.query}`)
                        }
                      >
                        Optimize
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Pagination className="border-t border-cm-hairline">
            <PaginationRange page={page} pageSize={10} total={sampleJobs.length} />
            <PaginationControls>
              <PaginationPrevious disabled={page === 1} onClick={() => setPage((p) => Math.max(1, p - 1))} />
              <PaginationNext disabled onClick={() => {}} />
            </PaginationControls>
          </Pagination>
        </TableFrame>
      </div>
    </div>
  );
}
