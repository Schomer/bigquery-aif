import * as React from "react";
import {
  ActionBar,
  ActionBarTitle,
  Button,
  Card,
  MaterialSymbols,
  Progress,
  cn,
  snackbar,
} from "@/kit";

interface OngoingTask {
  id: string;
  avatarLetter: string;
  avatarTheme: "activeassist" | "neutral";
  title: string;
  description: string;
  progress: number;
  agent: string;
  startedTime: string;
}

interface RequireInputTask {
  id: string;
  avatarLetter: string;
  avatarTheme: "warning" | "success" | "neutral";
  title: string;
  description: string;
  requester: string;
  timeAgo: string;
}

interface CompletedTask {
  id: string;
  avatarLetter: string;
  avatarTheme: "success" | "error";
  title: string;
  description: string;
  agent: string;
  completedTime: string;
}

const INITIAL_ONGOING_TASKS: OngoingTask[] = [
  {
    id: "ongoing-1",
    avatarLetter: "S",
    avatarTheme: "activeassist",
    title: "Managed Spark serverless retraining",
    description: "Retraining churn model on 45M customer rows in BigQuery.",
    progress: 68,
    agent: "Autopilot Agent",
    startedTime: "Started 14m ago",
  },
  {
    id: "ongoing-2",
    avatarLetter: "M",
    avatarTheme: "neutral",
    title: "Sales Prediction Model",
    description: "Training revenue forecasting model on Q3 dataset in Vertex AI.",
    progress: 42,
    agent: "Vertex AI Pipeline",
    startedTime: "Started 32m ago",
  },
];

const INITIAL_REQUIRE_INPUT_TASKS: RequireInputTask[] = [
  {
    id: "input-1",
    avatarLetter: "P",
    avatarTheme: "warning",
    title: "BigQuery customer_pii_v2 Read Access...",
    description: "Required for training Q3 Customer Churn Prediction Model in Vertex AI.",
    requester: "sarah.l***@company.com",
    timeAgo: "10 mins ago",
  },
  {
    id: "input-2",
    avatarLetter: "A",
    avatarTheme: "success",
    title: "Spark Serverless Executor Auto-Scale...",
    description: "Recommend increasing max executor instances from 10 to 25 during peak hours.",
    requester: "Autopilot Agent",
    timeAgo: "25 mins ago",
  },
  {
    id: "input-3",
    avatarLetter: "G",
    avatarTheme: "neutral",
    title: "Schema Drift Auto-Patch in Clickstream...",
    description: "Detected string to int64 field change in Pub/Sub schema payload.",
    requester: "Schema Guard Agent",
    timeAgo: "1 hour ago",
  },
];

const INITIAL_COMPLETED_TASKS: CompletedTask[] = [
  {
    id: "completed-1",
    avatarLetter: "Q",
    avatarTheme: "success",
    title: "BigQuery Partitioning & Clustering Opt...",
    description: "Re-clustered order_events table by customer_id...",
    agent: "Query Optimizer",
    completedTime: "Completed 2h ago",
  },
  {
    id: "completed-2",
    avatarLetter: "C",
    avatarTheme: "error",
    title: "Automated Catalog Metadata Synchro...",
    description: "Cataloged 1,420 BigQuery tables and Knowledge...",
    agent: "Catalog Scanner",
    completedTime: "Completed 5h ago",
  },
];

function getAvatarColors(theme: "activeassist" | "neutral" | "warning" | "success" | "error") {
  switch (theme) {
    case "activeassist":
      return "bg-cm-status-activeassist-container text-cm-status-activeassist";
    case "warning":
      return "bg-cm-status-warning-container text-cm-status-warning";
    case "success":
      return "bg-cm-status-success-container text-cm-status-success";
    case "error":
      return "bg-cm-status-error-container text-cm-status-error";
    case "neutral":
    default:
      return "bg-cm-container-high text-cm-primary-on-container";
  }
}

export function AiInboxScreen() {
  const [ongoingTasks] = React.useState<OngoingTask[]>(INITIAL_ONGOING_TASKS);
  const [requireInputTasks, setRequireInputTasks] = React.useState<RequireInputTask[]>(
    INITIAL_REQUIRE_INPUT_TASKS,
  );
  const [completedTasks, setCompletedTasks] = React.useState<CompletedTask[]>(
    INITIAL_COMPLETED_TASKS,
  );

  const handleApprove = (task: RequireInputTask) => {
    setRequireInputTasks((prev) => prev.filter((t) => t.id !== task.id));
    setCompletedTasks((prev) => [
      {
        id: `completed-${Date.now()}`,
        avatarLetter: task.avatarLetter,
        avatarTheme:
          task.avatarTheme === "warning"
            ? "success"
            : task.avatarTheme === "neutral"
            ? "error"
            : "success",
        title: task.title,
        description: task.description,
        agent: task.requester,
        completedTime: "Completed just now",
      },
      ...prev,
    ]);
    snackbar(`Approved: ${task.title}`);
  };

  const handleReject = (task: RequireInputTask) => {
    setRequireInputTasks((prev) => prev.filter((t) => t.id !== task.id));
    snackbar(`Rejected: ${task.title}`);
  };

  const handleShowDetails = (task: RequireInputTask) => {
    snackbar(`Viewing details for: ${task.title}`);
  };

  return (
    <div className="flex flex-1 flex-col overflow-auto bg-cm-surface rounded-2xl">
      <ActionBar className="px-8 border-none h-auto pt-6 pb-2">
        <ActionBarTitle className="text-cm-headline-small text-cm-on-surface font-normal">
          AI inbox/Tasks
        </ActionBarTitle>
      </ActionBar>

      <div className="p-8 pt-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
          {/* Column 1: Ongoing */}
          <section
            aria-label="Ongoing tasks"
            className="flex flex-col gap-4 min-w-0"
          >
            <div className="flex items-center gap-2 px-1">
              <MaterialSymbols.ProgressActivity className="size-[18px] text-cm-primary shrink-0" />
              <h2 className="text-cm-title-small text-cm-on-surface">
                Ongoing ({ongoingTasks.length})
              </h2>
            </div>

            <div className="flex flex-col gap-4">
              {ongoingTasks.map((task) => (
                <Card key={task.id}>
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        "size-8 rounded-lg flex items-center justify-center text-cm-label-medium font-medium shrink-0",
                        getAvatarColors(task.avatarTheme),
                      )}
                    >
                      {task.avatarLetter}
                    </div>
                    <h3 className="text-cm-label-large font-medium text-cm-on-surface truncate flex-1">
                      {task.title}
                    </h3>
                  </div>

                  <p className="text-cm-body-medium text-cm-on-surface-variant">
                    {task.description}
                  </p>

                  <div className="flex flex-col gap-1.5 mt-1">
                    <div className="flex items-center justify-between text-cm-body-small text-cm-on-surface-variant">
                      <span>Progress</span>
                      <span className="text-cm-label-small font-medium text-cm-primary">
                        {task.progress}%
                      </span>
                    </div>
                    <Progress value={task.progress} className="h-1.5 bg-cm-container-high" />
                  </div>

                  <div className="flex items-center justify-between text-cm-body-small text-cm-on-surface-variant-low mt-1">
                    <span>{task.agent}</span>
                    <span>{task.startedTime}</span>
                  </div>
                </Card>
              ))}
            </div>
          </section>

          {/* Column 2: Require input */}
          <section
            aria-label="Require input tasks"
            className="flex flex-col gap-4 min-w-0"
          >
            <div className="flex items-center gap-2 px-1">
              <MaterialSymbols.ErrorIcon className="size-[18px] text-cm-status-error shrink-0" />
              <h2 className="text-cm-title-small text-cm-on-surface">
                Require input ({requireInputTasks.length})
              </h2>
            </div>

            <div className="flex flex-col gap-4">
              {requireInputTasks.map((task) => (
                <Card key={task.id}>
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        "size-8 rounded-lg flex items-center justify-center text-cm-label-medium font-medium shrink-0",
                        getAvatarColors(task.avatarTheme),
                      )}
                    >
                      {task.avatarLetter}
                    </div>
                    <h3 className="text-cm-label-large font-medium text-cm-on-surface truncate flex-1">
                      {task.title}
                    </h3>
                  </div>

                  <p className="text-cm-body-medium text-cm-on-surface-variant">
                    {task.description}
                  </p>

                  <div className="flex items-center justify-between text-cm-body-small text-cm-on-surface-variant-low mt-0.5">
                    <span>{task.requester}</span>
                    <span>{task.timeAgo}</span>
                  </div>

                  <div className="flex items-center gap-2 pt-2">
                    <Button variant="stroked" onClick={() => handleReject(task)}>
                      Reject
                    </Button>
                    <Button
                      leftIcon={<MaterialSymbols.Check className="size-4" />}
                      onClick={() => handleApprove(task)}
                    >
                      Approve
                    </Button>
                    <Button
                      variant="text"
                      className="text-cm-primary ml-auto"
                      onClick={() => handleShowDetails(task)}
                    >
                      Show details
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          </section>

          {/* Column 3: Completed */}
          <section
            aria-label="Completed tasks"
            className="flex flex-col gap-4 min-w-0"
          >
            <div className="flex items-center gap-2 px-1">
              <MaterialSymbols.CheckCircle className="size-[18px] text-cm-status-success shrink-0" />
              <h2 className="text-cm-title-small text-cm-on-surface">
                Completed ({completedTasks.length})
              </h2>
            </div>

            <div className="flex flex-col gap-4">
              {completedTasks.map((task) => (
                <Card key={task.id}>
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        "size-8 rounded-lg flex items-center justify-center text-cm-label-medium font-medium shrink-0",
                        getAvatarColors(task.avatarTheme),
                      )}
                    >
                      {task.avatarLetter}
                    </div>
                    <h3 className="text-cm-label-large font-medium text-cm-on-surface truncate flex-1">
                      {task.title}
                    </h3>
                    <MaterialSymbols.CheckCircle
                      aria-label="Completed"
                      className="size-5 text-cm-status-success shrink-0"
                    />
                  </div>

                  <p className="text-cm-body-medium text-cm-on-surface-variant">
                    {task.description}
                  </p>

                  <div className="flex items-center justify-between text-cm-body-small text-cm-on-surface-variant-low mt-1">
                    <span>{task.agent}</span>
                    <span>{task.completedTime}</span>
                  </div>
                </Card>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
