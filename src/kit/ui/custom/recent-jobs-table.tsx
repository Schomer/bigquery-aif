import * as React from "react";
import * as MaterialSymbols from "../material-symbols";
import { cn } from "../utils";

export interface JobItem {
  id: string;
  status: "success" | "failed" | "running";
  time: string;
  onSelect?: () => void;
}

export interface RecentJobsTableProps extends React.ComponentProps<"div"> {
  jobs: JobItem[];
  onJobClick?: (job: JobItem) => void;
}

export function RecentJobsTable({
  className,
  jobs,
  onJobClick,
  ...props
}: RecentJobsTableProps) {
  return (
    <div
      data-slot="recent-jobs-table"
      className={cn(
        "bg-cm-container-primary flex flex-col rounded-2xl p-4 sm:p-5 transition-shadow",
        className,
      )}
      {...props}
    >
      {/* Table Column Headers */}
      <div className="border-cm-hairline/50 grid grid-cols-12 border-b pb-3 text-cm-label-medium text-cm-on-surface-variant">
        <div className="col-span-7 flex items-center gap-1.5">
          <MaterialSymbols.TrendingUp
            aria-hidden
            className="text-cm-primary size-4 shrink-0"
          />
          <span>Job ID</span>
        </div>
        <div className="col-span-2 flex items-center justify-center gap-1">
          <MaterialSymbols.Refresh
            aria-hidden
            className="text-cm-on-surface-variant size-4 shrink-0"
          />
          <span>Status</span>
        </div>
        <div className="col-span-3 flex items-center justify-end gap-1">
          <MaterialSymbols.Schedule
            aria-hidden
            className="text-cm-on-surface-variant size-4 shrink-0"
          />
          <span>Time</span>
        </div>
      </div>

      {/* Rows */}
      <div className="divide-cm-hairline/30 flex flex-1 flex-col justify-between divide-y">
        {jobs.map((job) => (
          <div
            key={job.id}
            className="grid flex-1 grid-cols-12 items-center py-3 transition-colors"
          >
            {/* Job ID Link */}
            <div className="col-span-7 min-w-0 pr-2">
              <button
                type="button"
                onClick={() => (job.onSelect ? job.onSelect() : onJobClick?.(job))}
                className="text-cm-link-default text-cm-code block max-w-full truncate text-left underline-offset-2 hover:underline"
              >
                {job.id}
              </button>
            </div>

            {/* Status Icon */}
            <div className="col-span-2 flex justify-center">
              {job.status === "success" ? (
                <MaterialSymbols.CheckCircle
                  aria-label="Job succeeded"
                  className="text-cm-status-success size-5"
                />
              ) : job.status === "failed" ? (
                <MaterialSymbols.ErrorIcon
                  aria-label="Job failed"
                  className="text-cm-status-error size-5"
                />
              ) : (
                <MaterialSymbols.Refresh
                  aria-label="Job running"
                  className="text-cm-primary size-5 animate-spin"
                />
              )}
            </div>

            {/* Time + Caret */}
            <div className="col-span-3 flex items-center justify-end gap-0.5 text-cm-body-small text-cm-on-surface-variant">
              <span>{job.time}</span>
              <MaterialSymbols.KeyboardArrowDown
                aria-hidden
                className="size-4 shrink-0 text-cm-on-surface-variant"
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
