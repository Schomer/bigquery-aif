import * as React from "react";
import {
  AssistantPromptBox,
  BiInsightCard,
  Button,
  MaterialSymbols,
  OperationalInsightCard,
  RecentJobsTable,
  SuggestionChip,
  TaskCard,
  cn,
  snackbar,
} from "@/kit";
import { type Chip as ChatChip, type ModelId } from "../types/chat";

export interface HomeScreenProps {
  workspaces?: { id: string; label: string }[];
  activeWorkspaceId?: string;
  onSelectWorkspace?: (id: string) => void;
  onSubmitPrompt?: (prompt: string, chips: ChatChip[], model: ModelId) => void;
  memberName?: string;
  isStartScreen?: boolean;
}

export function HomeScreen({
  workspaces = [
    { id: "workspace-churn", label: "Customer churn analysis" },
    { id: "workspace-01", label: "Myworkspace01" },
  ],
  activeWorkspaceId = "workspace-churn",
  onSelectWorkspace,
  onSubmitPrompt,
  memberName = "James",
}: HomeScreenProps = {}) {
  const [promptText, setPromptText] = React.useState("");
  const [isFocused, setIsFocused] = React.useState(false);
  const isChatActive = isFocused || Boolean(promptText.trim());

  const currentWorkspaceName =
    workspaces.find((w) => w.id === activeWorkspaceId)?.label ||
    workspaces[0]?.label ||
    "Customer churn analysis";

  const TARGET_TOP10_PROMPT =
    "Can you write a SQL query to find our top 10 customers based on their total purchase spend this month? I'm not sure which dataset is the right one.";

  const handlePromptSubmit = (query: string) => {
    if (onSubmitPrompt) {
      onSubmitPrompt(query, [], "flash");
    } else {
      snackbar(`Submitted prompt: "${query}"`);
    }
    setPromptText("");
  };

  const SAMPLE_INSIGHTS = [
    {
      id: "insight-top-customers",
      badge: "Spend Analysis",
      icon: <MaterialSymbols.TrendingUp aria-hidden />,
      title: "Top 10 customers by spend",
      description:
        "Acme Corp ($184K) leads spend this month across completed orders in orders_summary.",
      prompt: TARGET_TOP10_PROMPT,
    },
    {
      id: "insight-churn-spike",
      badge: "Churn ML",
      icon: <MaterialSymbols.AutoAwesome aria-hidden />,
      title: "Enterprise churn risk spike",
      description:
        "Users with >14 days inactivity correlate with an 82% cancellation probability.",
      prompt:
        "Analyze churn predictors and retention drivers for Q3 enterprise accounts in user_behavior_table.",
    },
    {
      id: "insight-query-opt",
      badge: "Optimization",
      icon: <MaterialSymbols.Schedule aria-hidden />,
      title: "Query cost optimization",
      description:
        "Unpartitioned table scan on churn_features scans 4.8 TB. Adding date partitioning saves 68%.",
      prompt:
        "Recommend partitioning and clustering optimization for streamify-prod.prd_gold.churn_features.",
    },
  ];

  const handleInspectTask = (taskName: string) => {
    snackbar(`Inspecting ${taskName}`);
  };

  const handleApproveTask = (taskName: string) => {
    snackbar(`Approved: ${taskName}`);
  };

  return (
    <div className="flex flex-1 flex-col overflow-auto bg-cm-surface rounded-2xl">
      <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-12 p-6 lg:p-8">
        {/* Section 1: Hero & Prompt Area */}
        <section className="relative flex flex-col items-center">
          <style>{`
            @property --border-angle {
              syntax: "<angle>";
              inherits: false;
              initial-value: 0deg;
            }
            /* Linear constant-speed border rotation (perimeter-mapped keyframes for 760px box) */
            @keyframes rotate-border {
              0.00% { --border-angle: 0.00deg; }
              3.12% { --border-angle: 35.71deg; }
              6.25% { --border-angle: 55.18deg; }
              9.38% { --border-angle: 65.12deg; }
              12.50% { --border-angle: 70.82deg; }
              15.62% { --border-angle: 74.45deg; }
              18.75% { --border-angle: 76.94deg; }
              21.88% { --border-angle: 81.40deg; }
              25.00% { --border-angle: 90.00deg; }
              28.12% { --border-angle: 98.60deg; }
              31.25% { --border-angle: 103.06deg; }
              34.38% { --border-angle: 105.55deg; }
              37.50% { --border-angle: 109.18deg; }
              40.62% { --border-angle: 114.88deg; }
              43.75% { --border-angle: 124.82deg; }
              46.88% { --border-angle: 144.29deg; }
              50.00% { --border-angle: 180.00deg; }
              53.12% { --border-angle: 215.71deg; }
              56.25% { --border-angle: 235.18deg; }
              59.38% { --border-angle: 245.12deg; }
              62.50% { --border-angle: 250.82deg; }
              65.62% { --border-angle: 254.45deg; }
              68.75% { --border-angle: 256.94deg; }
              71.88% { --border-angle: 261.40deg; }
              75.00% { --border-angle: 270.00deg; }
              78.12% { --border-angle: 278.60deg; }
              81.25% { --border-angle: 283.06deg; }
              84.38% { --border-angle: 285.55deg; }
              87.50% { --border-angle: 289.18deg; }
              90.62% { --border-angle: 294.88deg; }
              93.75% { --border-angle: 304.82deg; }
              96.88% { --border-angle: 324.29deg; }
              100.00% { --border-angle: 360.00deg; }
            }
            /* Circling border light beam (crisp neon edge, no further blur) */
            .chatbox-wrapper .relative.isolate.w-full::after {
              content: "";
              position: absolute;
              inset: -1.5px;
              border-radius: 23.5px;
              padding: 2px;
              background: conic-gradient(
                from var(--border-angle) at 50% 50%,
                transparent 0%,
                transparent 72%,
                rgba(67, 35, 201, 0.2) 80%,
                rgba(106, 47, 230, 0.45) 87%,
                rgba(143, 63, 240, 0.65) 92%,
                rgba(66, 133, 244, 0.75) 96%,
                rgba(0, 229, 255, 0.8) 100%
              );
              -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
              -webkit-mask-composite: xor;
              mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
              mask-composite: exclude;
              pointer-events: none;
              opacity: 0;
              transition: opacity 0.35s ease;
              animation: rotate-border 4.5s linear infinite;
              z-index: 20;
            }
            /* Activated / Focused: show sharp, translucent circling light beam */
            .chatbox-wrapper:focus-within .relative.isolate.w-full::after,
            .chatbox-wrapper.chatbox-active .relative.isolate.w-full::after {
              opacity: 0.8;
            }

            @keyframes chat-gradient-flow {
              0% { background-position: 0% 50%; }
              50% { background-position: 100% 50%; }
              100% { background-position: 0% 50%; }
            }
            @keyframes chat-orb-float-1 {
              0%, 100% { transform: translate(0px, 0px) scale(1); }
              33% { transform: translate(35px, -18px) scale(1.12); }
              66% { transform: translate(-25px, 14px) scale(0.92); }
            }
            @keyframes chat-orb-float-2 {
              0%, 100% { transform: translate(0px, 0px) scale(1); }
              33% { transform: translate(-30px, 20px) scale(1.08); }
              66% { transform: translate(25px, -16px) scale(0.95); }
            }
            @keyframes chat-orb-float-3 {
              0%, 100% { transform: translate(0px, 0px) scale(1); }
              50% { transform: translate(15px, 25px) scale(1.15); }
            }
            .animate-chat-gradient-flow {
              background-size: 250% 250%;
              animation: chat-gradient-flow 10s ease infinite;
            }
            .animate-chat-orb-1 {
              animation: chat-orb-float-1 8s ease-in-out infinite;
            }
            .animate-chat-orb-2 {
              animation: chat-orb-float-2 10s ease-in-out infinite;
            }
            .animate-chat-orb-3 {
              animation: chat-orb-float-3 7s ease-in-out infinite;
            }
          `}</style>

          <h1 className="text-cm-headline-medium text-cm-on-surface mb-6 text-center">
            How can I help, {memberName || "James"}?
          </h1>

          {/* Centered Chatbox Container (max-width 760px) */}
          <div className="relative w-full max-w-[760px] mx-auto">
            {/* Animated background gradient layer under/behind the chatbox */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -inset-x-8 -top-8 -bottom-10 sm:-inset-x-14 sm:-top-10 sm:-bottom-14 -z-10 select-none overflow-visible"
            >
              {/* Fluid moving gradient backdrop */}
              <div
                className={cn(
                  "animate-chat-gradient-flow absolute inset-0 rounded-[36px] blur-3xl transition-opacity duration-500",
                  isChatActive ? "opacity-60" : "opacity-40",
                )}
                style={{
                  background:
                    "linear-gradient(135deg, rgba(67, 35, 201, 0.18) 0%, rgba(106, 47, 230, 0.20) 25%, rgba(66, 133, 244, 0.18) 50%, rgba(236, 72, 153, 0.14) 75%, rgba(6, 182, 212, 0.16) 100%)",
                }}
              />

              {/* Floating orb 1: Electric Indigo / Purple */}
              <div
                className="animate-chat-orb-1 absolute -top-4 left-1/4 h-36 w-56 rounded-full opacity-35 blur-2xl"
                style={{
                  background:
                    "radial-gradient(circle, rgba(106, 47, 230, 0.35) 0%, rgba(67, 35, 201, 0.08) 70%, transparent 100%)",
                }}
              />

              {/* Floating orb 2: Google Blue / Cyan */}
              <div
                className="animate-chat-orb-2 absolute -bottom-6 right-1/4 h-36 w-60 rounded-full opacity-35 blur-2xl"
                style={{
                  background:
                    "radial-gradient(circle, rgba(66, 133, 244, 0.35) 0%, rgba(6, 182, 212, 0.12) 70%, transparent 100%)",
                }}
              />

              {/* Floating orb 3: Vibrant Coral / Rose Accent */}
              <div
                className="animate-chat-orb-3 absolute top-1/3 right-8 h-28 w-44 rounded-full opacity-25 blur-2xl"
                style={{
                  background:
                    "radial-gradient(circle, rgba(236, 72, 153, 0.28) 0%, rgba(147, 51, 234, 0.08) 70%, transparent 100%)",
                }}
              />
            </div>

            <AssistantPromptBox
              className={cn(
                "chatbox-wrapper transition-all duration-300",
                isChatActive && "chatbox-active",
              )}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              workspaceName={currentWorkspaceName}
              workspaceOptions={workspaces.map((w) => w.label)}
              value={promptText}
              onChange={(e) => setPromptText(e.target.value)}
              onSubmit={handlePromptSubmit}
              onSelectWorkspace={(wsLabel) => {
                const found = workspaces.find((w) => w.label === wsLabel);
                if (found && onSelectWorkspace) {
                  onSelectWorkspace(found.id);
                }
                snackbar(`Selected workspace: ${wsLabel}`);
              }}
              onSelectModel={(m) => snackbar(`Switched model to ${m}`)}
            />

            {/* 3 Sample Insights placed below chat as SuggestionChip components from kit */}
            <div className="mt-3 flex w-full flex-wrap items-center gap-2">
              {SAMPLE_INSIGHTS.map((insight) => (
                <SuggestionChip
                  key={insight.id}
                  icon={insight.icon}
                  onClick={() => {
                    if (promptText === insight.prompt) {
                      handlePromptSubmit(insight.prompt);
                    } else {
                      setPromptText(insight.prompt);
                      snackbar(`Loaded insight: "${insight.title}"`);
                    }
                  }}
                >
                  {insight.title}
                </SuggestionChip>
              ))}
            </div>
          </div>
        </section>

        {/* Section 2: Tasks & Business Intelligence */}
        <section className="flex flex-col gap-12 lg:flex-row">
          {/* Left Column: Tasks */}
          <div className="flex flex-1 flex-col min-w-0">
            <div className="mb-3 flex h-8 items-center justify-between">
              <h2 className="text-cm-title-small text-cm-on-surface">
                Tasks
              </h2>
              <Button
                variant="link"
                onClick={() => snackbar("Opening all tasks...")}
              >
                Show all
              </Button>
            </div>

            <div className="flex flex-1 flex-col gap-3">
              <TaskCard
                className="flex-1 bg-cm-surface-variant"
                status="ongoing"
                title="Sales Prediction Model"
                subtitle="Managed Spark • Training model v3.2"
                actionLabel="Inspect"
                onAction={() => handleInspectTask("Sales Prediction Model (Training v3.2)")}
              />
              <TaskCard
                className="flex-1 bg-cm-surface-variant"
                status="ongoing"
                title="Sales Prediction Model"
                subtitle="Managed Spark • Training model v3.2"
                actionLabel="Inspect"
                onAction={() => handleInspectTask("Sales Prediction Model (Training v3.2)")}
              />
              <TaskCard
                className="flex-1 bg-cm-surface-variant"
                status="require-input"
                title="Approve PII Data Access Request for Finance Team"
                subtitle="Requested by Sarah Lin • High priority"
                actionLabel="Approve"
                onAction={() =>
                  handleApproveTask("PII Data Access Request for Finance Team")
                }
              />
              <TaskCard
                className="flex-1 bg-cm-surface-variant"
                status="require-input"
                title="Approve PII Data Access Request for Finance Team"
                subtitle="Requested by Sarah Lin • High priority"
                actionLabel="Approve"
                onAction={() =>
                  handleApproveTask("PII Data Access Request for Finance Team")
                }
              />
            </div>
          </div>

          {/* Right Column: Business Intelligence */}
          <div className="flex flex-1 flex-col min-w-0">
            <div className="mb-3 flex h-8 items-center justify-between">
              <h2 className="text-cm-title-small text-cm-on-surface">
                Business Intelligence
              </h2>
              <Button
                variant="link"
                onClick={() => snackbar("Opening Business Intelligence dashboard...")}
              >
                Show all
              </Button>
            </div>

            <div className="flex flex-1 flex-col gap-3">
              <BiInsightCard
                className="flex-1 bg-cm-surface-variant"
                title="Historical Churn Rate"
                subtitle="Monthly churn rate over time."
                timestamp="1 min ago"
                colorTheme="blue"
                data={[
                  { month: "Mar", value: 65 },
                  { month: "Apr", value: 75 },
                  { month: "May", value: 88 },
                  { month: "Jun", value: 45 },
                  { month: "Jul", value: 82 },
                  { month: "Aug", value: 30 },
                ]}
                trendText="-0.6 reduction over 6 months"
                trendColor="error"
                onNavigate={() => snackbar("Viewing Historical Churn Rate report")}
              />

              <BiInsightCard
                className="flex-1 bg-cm-surface-variant"
                title="User engagement spiked"
                subtitle="Daily active users increased by 22% following the new feature rollout yesterday."
                timestamp="3 hrs ago"
                colorTheme="purple"
                data={[
                  { month: "Mar", value: 40 },
                  { month: "Apr", value: 70 },
                  { month: "May", value: 85 },
                  { month: "Jun", value: 48 },
                  { month: "Jul", value: 90 },
                  { month: "Aug", value: 35 },
                ]}
                trendText="+ 4.0K additional daily active sessions"
                trendColor="success"
                onNavigate={() => snackbar("Viewing User Engagement metrics")}
              />
            </div>
          </div>
        </section>

        {/* Section 3: Operational Insights & Recent Jobs */}
        <section className="flex flex-col gap-12 lg:flex-row">
          {/* Left Column: Operational Insights */}
          <div className="flex flex-1 flex-col min-w-0">
            <div className="mb-3 flex h-8 items-center justify-between">
              <h2 className="text-cm-title-small text-cm-on-surface">
                Operational Insights
              </h2>
              <Button
                variant="link"
                onClick={() => snackbar("Opening all operational insights...")}
              >
                Show all
              </Button>
            </div>

            <div className="flex flex-1 flex-col justify-between gap-3">
              <OperationalInsightCard
                className="flex-1 bg-cm-surface-variant"
                badgeLabel="Insights"
                title="Partitioning clustering recommendation"
                description='Clustering "cymbal-marketing.crm.clickstream_clean_daily" on user_id will reduce scan costs by 68%.'
                primaryActionLabel="Apply clustering"
                onPrimaryAction={() =>
                  snackbar('Applied clustering to "cymbal-marketing.crm.clickstream_clean_daily"')
                }
                secondaryActionLabel="View plan"
                onSecondaryAction={() => snackbar("Opening clustering execution plan")}
              />
              <OperationalInsightCard
                className="flex-1 bg-cm-surface-variant"
                badgeLabel="Failure"
                badgeVariant="error"
                title="Pipeline failure"
                description='Airflow DAG "monthly_taxi_retrain_dag" failed at task "clean_silver_transform" due to schema mismatch in raw GCS logs.'
                primaryActionLabel="Fix pipeline"
                onPrimaryAction={() =>
                  snackbar('Fixing pipeline: monthly_taxi_retrain_dag')
                }
                secondaryActionLabel="View plan"
                onSecondaryAction={() => snackbar("Opening pipeline failure recovery plan")}
              />
              <OperationalInsightCard
                className="flex-1 bg-cm-surface-variant"
                badgeLabel="Require attention"
                badgeVariant="warning"
                title="Query optimization"
                description='Unpartitioned table scan on "streamify-prod.prd_gold.churn_features" is scanning 4.8 TB per execution in scheduled report.'
                primaryActionLabel="Optimize query"
                onPrimaryAction={() =>
                  snackbar('Optimizing query on streamify-prod.prd_gold.churn_features')
                }
                secondaryActionLabel="View plan"
                onSecondaryAction={() => snackbar("Opening query optimization plan")}
              />
            </div>
          </div>

          {/* Right Column: Recent Jobs */}
          <div className="flex flex-1 flex-col min-w-0">
            <div className="mb-3 flex h-8 items-center justify-between">
              <h2 className="text-cm-title-small text-cm-on-surface">
                Recent Jobs
              </h2>
              <Button
                variant="link"
                onClick={() => snackbar("Opening all recent jobs...")}
              >
                Show all
              </Button>
            </div>

            <RecentJobsTable
              className="flex-1 bg-cm-surface-variant"
              jobs={[
                {
                  id: "job_EGp0cRqTIJQ7nd2lf9raVVyZjrqw",
                  status: "success",
                  time: "5:05 PM",
                },
                {
                  id: "job_qplvshj-A8L23qMdDzHOBoStEGFO",
                  status: "failed",
                  time: "5:05 PM",
                },
                {
                  id: "job_y0MucdtoRH6OXGkOpKuGGhgK2Vjr",
                  status: "success",
                  time: "5:05 PM",
                },
                {
                  id: "job_K9d8xLmnPq23RsTuVwXyZ104AbCd",
                  status: "running",
                  time: "4:48 PM",
                },
                {
                  id: "job_B7vC4xZ9mK2pL0nQ8wE1rT3yU5iO",
                  status: "success",
                  time: "4:32 PM",
                },
                {
                  id: "job_w5Xy9zLp2M1qA3sD7fG8hJ0kL2vC",
                  status: "success",
                  time: "4:15 PM",
                },
                {
                  id: "job_m8N2bV4cX7zL1kP9qW3eR5tY0uI",
                  status: "failed",
                  time: "3:58 PM",
                },
                {
                  id: "job_p3L5kM8jH2gF6dC9sA1qZ0xW4eR",
                  status: "success",
                  time: "3:42 PM",
                },
                {
                  id: "job_t7Y9uI1oP3eR5wQ8sA0dF2gH4jK",
                  status: "running",
                  time: "3:20 PM",
                },
                {
                  id: "job_v2C4xZ7bN9mK1lP3qW5eR8tY0uI",
                  status: "success",
                  time: "3:05 PM",
                },
              ]}
              onJobClick={(job) => snackbar(`Selected ${job.id}`)}
            />
          </div>
        </section>
      </div>
    </div>
  );
}
