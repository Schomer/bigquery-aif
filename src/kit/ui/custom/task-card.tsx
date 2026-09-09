import * as React from "react";
import { Button } from "../button";
import { ArrowDropDown } from "../material-symbols";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "../menu";
import { cn } from "../utils";

export type TaskStatusType = "ongoing" | "require-input" | string;

export interface TaskCardProps extends React.ComponentProps<"div"> {
  status: TaskStatusType;
  statusLabel?: string;
  title: string;
  subtitle: string;
  actionLabel?: string;
  onAction?: () => void;
  menuOptions?: Array<{ label: string; onClick?: () => void }>;
}

export function TaskCard({
  className,
  status,
  statusLabel,
  title,
  subtitle,
  actionLabel = "Inspect",
  onAction,
  menuOptions,
  ...props
}: TaskCardProps) {
  const isRequireInput = status === "require-input" || status.toLowerCase().includes("require");
  const displayStatus = statusLabel ?? (isRequireInput ? "Require input" : "Ongoing");

  const defaultMenuOptions = menuOptions ?? [
    { label: actionLabel, onClick: onAction },
    { label: "View details", onClick: onAction },
    { label: "View execution logs" },
    { label: "Share task" },
  ];

  return (
    <div
      data-slot="task-card"
      className={cn(
        "bg-cm-container-primary flex flex-col justify-between gap-3 rounded-2xl p-4 sm:p-5 transition-shadow",
        className,
      )}
      {...props}
    >
      <div>
        <span
          className={cn(
            "text-cm-label-small inline-flex h-5 items-center rounded-full px-2.5",
            isRequireInput
              ? "bg-cm-status-warning-container text-cm-on-surface-variant"
              : "bg-cm-selection-container text-cm-on-container",
          )}
        >
          {displayStatus}
        </span>
      </div>

      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 flex-1 flex-col items-start gap-0.5">
          <h4 className="text-cm-label-large text-cm-on-surface truncate">
            {title}
          </h4>
          <p className="text-cm-body-medium text-cm-on-surface-variant truncate">
            {subtitle}
          </p>
        </div>

        <div className="shrink-0">
          <Menu>
            <MenuTrigger asChild>
              <Button>
                <span>{actionLabel}</span>
                <ArrowDropDown className="size-4" />
              </Button>
            </MenuTrigger>
            <MenuContent align="end">
              {defaultMenuOptions.map((opt, idx) => (
                <MenuItem key={idx} onClick={opt.onClick}>
                  {opt.label}
                </MenuItem>
              ))}
            </MenuContent>
          </Menu>
        </div>
      </div>
    </div>
  );
}

