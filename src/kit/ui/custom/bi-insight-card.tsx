import * as React from "react";
import { Button } from "../button";
import * as MaterialSymbols from "../material-symbols";
import { cn } from "../utils";

export interface BarDataPoint {
  month: string;
  value: number; // 0 to 100 percentage
}

export interface BiInsightCardProps extends React.ComponentProps<"div"> {
  title: string;
  subtitle: string;
  timestamp: string;
  data: BarDataPoint[];
  colorTheme?: "blue" | "purple";
  trendIcon?: React.ReactNode;
  trendText: string;
  trendColor?: "error" | "success" | "neutral";
  onNavigate?: () => void;
}

export function BiInsightCard({
  className,
  title,
  subtitle,
  timestamp,
  data,
  colorTheme = "blue",
  trendIcon,
  trendText,
  trendColor = "neutral",
  onNavigate,
  ...props
}: BiInsightCardProps) {
  const isPurple = colorTheme === "purple";

  const trendColorClass =
    trendColor === "error"
      ? "text-cm-status-error"
      : trendColor === "success"
        ? "text-cm-status-success"
        : "text-cm-on-surface-variant";

  return (
    <div
      data-slot="bi-insight-card"
      className={cn(
        "bg-cm-container-primary flex flex-col justify-between rounded-2xl p-4 sm:p-5 transition-shadow",
        className,
      )}
      {...props}
    >
      <div>
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <MaterialSymbols.TrendingUp
              aria-hidden
              className="text-cm-primary size-5 shrink-0"
            />
            <h4 className="text-cm-label-large text-cm-on-surface">
              {title}
            </h4>
          </div>
          <span className="text-cm-body-small text-cm-on-surface-variant-low shrink-0 pt-0.5">
            {timestamp}
          </span>
        </div>
        <p className="text-cm-body-medium text-cm-on-surface-variant pt-1">
          {subtitle}
        </p>

        {/* Bar Chart */}
        <div className="grid grid-cols-6 gap-2 pt-5 pb-2">
          {data.map((item, idx) => (
            <div key={idx} className="flex flex-col items-center">
              {/* Outer track pill */}
              <div className="bg-cm-container/40 flex h-20 w-full flex-col justify-end overflow-hidden rounded-t-xl p-0.5">
                {/* Filled bar */}
                <div
                  className={cn(
                    "w-full rounded-t-lg transition-all",
                    isPurple
                      ? "bg-cm-primary-inverse/85"
                      : "bg-cm-status-activeassist/80",
                  )}
                  style={{ height: `${Math.max(12, Math.min(100, item.value))}%` }}
                />
              </div>
              <span className="text-cm-body-small text-cm-on-surface-variant pt-2 text-center">
                {item.month}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Footer Trend Row */}
      <div className="border-cm-hairline/40 mt-3 flex items-center justify-between border-t pt-3">
        <div className="flex items-center gap-1.5">
          {trendIcon ? (
            <span className={trendColorClass}>{trendIcon}</span>
          ) : trendColor === "error" ? (
            <MaterialSymbols.TrendingDown
              aria-hidden
              className="text-cm-status-error size-4"
            />
          ) : (
            <MaterialSymbols.TrendingUp
              aria-hidden
              className="text-cm-status-success size-4"
            />
          )}
          <span className={cn("text-cm-body-small", trendColorClass)}>
            {trendText}
          </span>
        </div>

        <Button
          variant="text"
          size="icon"
          aria-label={`View insights for ${title}`}
          onClick={onNavigate}
        >
          <MaterialSymbols.ChevronRight aria-hidden className="size-5" />
        </Button>
      </div>
    </div>
  );
}
