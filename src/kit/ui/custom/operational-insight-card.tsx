import * as React from "react";
import { Button } from "../button";
import { cn } from "../utils";

export interface OperationalInsightCardProps extends React.ComponentProps<"div"> {
  badgeLabel?: string;
  badgeVariant?: "default" | "error" | "warning" | string;
  title: string;
  description: string;
  primaryActionLabel?: string;
  onPrimaryAction?: () => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
}

export function OperationalInsightCard({
  className,
  badgeLabel = "Insights",
  badgeVariant,
  title,
  description,
  primaryActionLabel = "Apply clustering",
  onPrimaryAction,
  secondaryActionLabel = "View plan",
  onSecondaryAction,
  ...props
}: OperationalInsightCardProps) {
  const isError = badgeVariant === "error" || badgeLabel.toLowerCase().includes("fail");
  const isWarning =
    badgeVariant === "warning" ||
    badgeLabel.toLowerCase().includes("attention") ||
    badgeLabel.toLowerCase().includes("require");

  const badgeColorClass = isError
    ? "bg-cm-status-error-container text-cm-on-surface"
    : isWarning
      ? "bg-cm-status-warning-container text-cm-on-surface"
      : "bg-cm-selection-container text-cm-on-container";

  return (
    <div
      data-slot="operational-insight-card"
      className={cn(
        "bg-cm-container-primary flex flex-col justify-between rounded-2xl p-4 sm:p-5 transition-shadow",
        className,
      )}
      {...props}
    >
      <div className="flex flex-col items-start">
        <span
          className={cn(
            "text-cm-label-small inline-flex h-5 items-center rounded-full px-2.5",
            badgeColorClass,
          )}
        >
          {badgeLabel}
        </span>
        <h4 className="text-cm-label-large text-cm-on-surface pt-2">
          {title}
        </h4>
        <p className="text-cm-body-medium text-cm-on-surface-variant pt-1.5">
          {description}
        </p>
      </div>

      <div className="flex items-center justify-between pt-5">
        <Button variant="default" onClick={onPrimaryAction}>
          {primaryActionLabel}
        </Button>
        <Button variant="link" onClick={onSecondaryAction}>
          {secondaryActionLabel}
        </Button>
      </div>
    </div>
  );
}
