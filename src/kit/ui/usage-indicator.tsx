import * as React from "react";

import { cn } from "./utils";

/**
 * UsageIndicator — "you have used 84 of your 100 GB", drawn.
 *
 *     <UsageIndicator
 *       label="84 GB"
 *       subLabel="of 100 GB"
 *       note="Resets on the 1st"
 *       value={84}
 *       max={100}
 *       warningThreshold={75}
 *       dangerThreshold={90}
 *     />
 *
 * A quota, a budget, a disk. Not a `Progress` bar: that one measures a task
 * that is going to finish, so it fills with one colour and then disappears.
 * This measures a ceiling that is not going to move, so it stays on the page,
 * carries its own numbers, and changes colour as the reader gets close to it.
 *
 *   Progress         a copy, an upload, an import. Ends.
 *   UsageIndicator   a quota against a limit. Persists.
 *   Slider           the reader sets the number, rather than reads it.
 *
 * ### Two shapes, one component
 *
 *   `donut`  the figure is the point of the panel — a quota card, a billing
 *            summary. The number sits beside the ring at `title-large`.
 *   `pill`   the figure is one row of a table or a list. A 154px segmented
 *            bar, and the label drops to `body-medium`.
 *
 * They are one component because the thresholds, the reserved band and the
 * colour rule are the same in both, and a product that starts with a card and
 * later wants the same quota in a table should change one prop.
 *
 * ### Thresholds are percentages, and the direction is a prop
 *
 * `warningThreshold={75}` means 75% of `max`, not 75 units — so a threshold set
 * once survives a quota being raised. `isMinimumThreshold` flips the
 * comparison for the metrics where *low* is the bad news: remaining credit,
 * free space, headroom. Below the danger line rather than above it.
 *
 * ### Colours
 *
 * CDS hard-codes a datavis teal, amber and orange here. Those are three raw
 * hexes that no theme can restyle, so this uses `primary`, `status-warning`
 * and `status-error` — the same three the rest of the kit uses to mean fine,
 * watch this, and act now. `resourceValue` (the band of the quota already
 * committed to something you cannot release) is `status-neutral`: it is not
 * good news or bad news, it is simply not yours to spend.
 */

export type UsageIndicatorChartType = "donut" | "pill";
export type UsageIndicatorDonutSize = "small" | "medium" | "large";
export type UsageIndicatorTextPlacement = "right" | "left" | "bottom";
export type UsageIndicatorTextAlignment = "start" | "center" | "end";

type Tone = "default" | "warning" | "danger";

/**
 * Radius and stroke, from CDS. The rendered box is `2 * (radius + stroke / 2)`
 * — 52, 96 and 156px — which is also the viewBox, so the ring is drawn at 1:1
 * and the stroke is exactly as many device pixels as it says.
 */
const DONUT_DIMENSIONS: Record<UsageIndicatorDonutSize, { radius: number; stroke: number }> = {
  small: { radius: 24, stroke: 4 },
  medium: { radius: 44, stroke: 8 },
  large: { radius: 74, stroke: 8 },
};

/** Length of the gap drawn between the reserved band and the used band. */
const SEPARATOR_LENGTH = 2;

const TRACK_CLASS = "stroke-cm-hairline";

const TONE_STROKE: Record<Tone, string> = {
  default: "stroke-cm-primary",
  warning: "stroke-cm-status-warning",
  danger: "stroke-cm-status-error",
};

const TONE_FILL: Record<Tone, string> = {
  default: "bg-cm-primary",
  warning: "bg-cm-status-warning",
  danger: "bg-cm-status-error",
};

function clampPercent(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(Math.max(value, 0), 100);
}

export interface UsageIndicatorProps extends Omit<React.ComponentProps<"div">, "value"> {
  /** The headline figure. `title-large` on a donut, `body-medium` on a pill. */
  label?: React.ReactNode;
  /** The denominator, usually — "of 100 GB". */
  subLabel?: React.ReactNode;
  /** A line under a rule: when it resets, where to raise it. */
  note?: React.ReactNode;
  chartType?: UsageIndicatorChartType;
  donutSize?: UsageIndicatorDonutSize;
  /** Used. In the same units as `max`. */
  value?: number;
  max?: number;
  /** Reserved or committed, drawn first and in neutral. Counts towards `value`. */
  resourceValue?: number;
  /** Percent of `max`, not units. */
  warningThreshold?: number;
  dangerThreshold?: number;
  /** Flip the comparison: the thresholds are floors, and low is bad. */
  isMinimumThreshold?: boolean;
  textPlacement?: UsageIndicatorTextPlacement;
  textAlignment?: UsageIndicatorTextAlignment;
  /** Segments in the pill. Clamped to 2–10; below two it is not a gauge. */
  pillSegments?: number;
}

function UsageIndicator({
  className,
  label,
  subLabel,
  note,
  chartType = "donut",
  donutSize = "medium",
  value = 0,
  max = 100,
  resourceValue = 0,
  warningThreshold,
  dangerThreshold,
  isMinimumThreshold = false,
  textPlacement = "right",
  textAlignment,
  pillSegments = 5,
  ...props
}: UsageIndicatorProps) {
  const isDonut = chartType === "donut";
  const scale = max > 0 ? max : 100;
  const percent = clampPercent((value / scale) * 100);
  const reservedPercent = clampPercent((resourceValue / scale) * 100);

  const tone: Tone = (() => {
    // The comparison, not the numbers, is what `isMinimumThreshold` changes:
    // danger is checked first either way, so a value past both lines reads as
    // the worse of the two.
    if (isMinimumThreshold) {
      if (dangerThreshold !== undefined && percent <= dangerThreshold) return "danger";
      if (warningThreshold !== undefined && percent <= warningThreshold) return "warning";
    } else {
      if (dangerThreshold !== undefined && percent >= dangerThreshold) return "danger";
      if (warningThreshold !== undefined && percent >= warningThreshold) return "warning";
    }
    return "default";
  })();

  // The two arcs never overlap: the reserved band is drawn from zero and the
  // used band starts where it ends, so a quota that is 30% reserved and 50%
  // used shows 30 neutral and 20 coloured rather than 30 under 50.
  const usedPercent = Math.max(0, percent - reservedPercent);

  const textAlign =
    textAlignment === "center"
      ? "text-center"
      : textAlignment === "end"
        ? "text-end"
        : textAlignment === "start"
          ? "text-start"
          : "";

  return (
    <div
      data-slot="usage-indicator"
      role="meter"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={scale}
      aria-label={typeof label === "string" ? label : undefined}
      className={cn(
        "text-cm-on-surface flex gap-3",
        // `bottom` stacks; `left` puts the text first without moving it in the
        // DOM, so the reading order stays label-then-chart for a screen reader
        // whichever way the row is drawn.
        textPlacement === "bottom" ? "flex-col" : textPlacement === "left" ? "flex-row-reverse" : "flex-row",
        isDonut && textPlacement !== "bottom" && "items-center",
        className,
      )}
      {...props}
    >
      <div data-slot="usage-indicator-chart" className="shrink-0">
        {isDonut ? (
          <Donut
            size={donutSize}
            reservedPercent={reservedPercent}
            usedPercent={usedPercent}
            tone={tone}
          />
        ) : (
          <Pill
            segments={pillSegments}
            reservedPercent={reservedPercent}
            usedPercent={usedPercent}
            tone={tone}
          />
        )}
      </div>

      <div
        data-slot="usage-indicator-text"
        className={cn(
          "flex flex-col",
          // A donut carries the figure at 22px and can afford 8px of air under
          // it. A pill's text is one 14px line over one 12px line, and 8px
          // between them would read as two separate facts.
          isDonut && donutSize !== "small" ? "gap-2" : "gap-0",
          textAlign,
        )}
      >
        {label !== undefined && (
          <span
            className={cn(
              isDonut
                ? donutSize === "small"
                  ? "text-cm-label-medium text-cm-on-surface"
                  : "text-cm-title-large text-cm-on-surface"
                : "text-cm-body-medium text-cm-on-surface-variant",
            )}
          >
            {label}
          </span>
        )}
        {subLabel !== undefined && (
          <span
            className={cn(
              "text-cm-body-small",
              isDonut && donutSize === "small" ? "text-cm-on-surface-variant" : "text-cm-on-surface",
            )}
          >
            {subLabel}
          </span>
        )}
        {/* A small donut is a table cell. It has no room for a third line, and
            a note that is invisible at one size and present at another is worse
            than one that is consistently absent — so it is dropped, not
            shrunk. */}
        {note !== undefined && !(isDonut && donutSize === "small") && (
          <span
            className={cn(
              "text-cm-body-small text-cm-on-surface-variant",
              isDonut && "border-cm-hairline mt-2 border-t pt-2",
            )}
          >
            {note}
          </span>
        )}
      </div>
    </div>
  );
}

function Donut({
  size,
  reservedPercent,
  usedPercent,
  tone,
}: {
  size: UsageIndicatorDonutSize;
  reservedPercent: number;
  usedPercent: number;
  tone: Tone;
}) {
  const { radius, stroke } = DONUT_DIMENSIONS[size];
  const box = 2 * (radius + stroke / 2);
  const center = box / 2;
  const circumference = 2 * Math.PI * radius;

  const reservedLength = (reservedPercent / 100) * circumference;
  const usedLength = (usedPercent / 100) * circumference;
  // Only drawn where two bands actually meet. A separator against the empty
  // track is a nick in the ring, not a division between anything.
  const showSeparator = reservedLength > 0 && usedLength > 0;

  const ring = {
    cx: center,
    cy: center,
    r: radius,
    fill: "none",
    strokeWidth: stroke,
  };

  return (
    <svg
      data-slot="usage-indicator-donut"
      width={box}
      height={box}
      viewBox={`0 0 ${box} ${box}`}
      aria-hidden
      // Zero is the top of the ring rather than three o'clock, which is where
      // every reader starts counting a dial.
      className="-rotate-90"
    >
      <circle {...ring} className={TRACK_CLASS} />
      <circle
        {...ring}
        className="stroke-cm-status-neutral transition-[stroke-dasharray] duration-300"
        strokeDasharray={`${reservedLength} ${circumference}`}
      />
      <circle
        {...ring}
        className={cn(TONE_STROKE[tone], "transition-[stroke-dasharray] duration-300")}
        strokeDasharray={`${usedLength} ${circumference}`}
        strokeDashoffset={-reservedLength}
      />
      {showSeparator && (
        <circle
          {...ring}
          className="stroke-cm-surface"
          strokeDasharray={`${SEPARATOR_LENGTH} ${circumference}`}
          strokeDashoffset={-reservedLength}
        />
      )}
    </svg>
  );
}

function Pill({
  segments,
  reservedPercent,
  usedPercent,
  tone,
}: {
  segments: number;
  reservedPercent: number;
  usedPercent: number;
  tone: Tone;
}) {
  const count = Math.min(Math.max(Math.round(segments) || 0, 2), 10);
  const segmentSize = 100 / count;

  return (
    <div
      data-slot="usage-indicator-pill"
      aria-hidden
      className="flex h-[10px] w-[154px] gap-[2px]"
    >
      {Array.from({ length: count }, (_, index) => {
        const start = index * segmentSize;
        // Each segment is its own 0–100% box, so the slice of the total that
        // falls inside it is rescaled by the number of segments.
        const reservedFill =
          (Math.min(Math.max(reservedPercent - start, 0), segmentSize) / segmentSize) * 100;
        const usedFill =
          (Math.min(Math.max(reservedPercent + usedPercent - start, 0), segmentSize) /
            segmentSize) *
            100 -
          reservedFill;

        return (
          <div
            key={index}
            className="bg-cm-hairline flex flex-1 overflow-hidden rounded-[1px] first:rounded-s-[5px] last:rounded-e-[5px]"
          >
            {reservedFill > 0 && (
              <span
                className="bg-cm-status-neutral h-full"
                style={{ width: `${reservedFill}%` }}
              />
            )}
            {usedFill > 0 && (
              <span className={cn("h-full", TONE_FILL[tone])} style={{ width: `${usedFill}%` }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

export { UsageIndicator };
