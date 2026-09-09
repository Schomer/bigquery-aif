import * as React from "react";

import { cn } from "./utils";

/**
 * Scorecard — the strip of headline numbers above a chart.
 *
 *     <Scorecard>
 *       <ScorecardCell label="Requests" value="1,204,882" footnote="Last 24 hours" />
 *       <ScorecardCell label="Error rate" value="0.04%" footnote="p50 across 3 regions" />
 *       <ScorecardCell label="Median latency" value="184 ms" />
 *     </Scorecard>
 *
 * Three or four figures, side by side, hairlines between them. It is the row a
 * reader looks at before they look at anything else on a monitoring page, and
 * the reason it is a component rather than a `<div className="flex">` is that
 * the type ramp is the whole design: a 12px label above a 16px number reads as
 * a caption and a fact; the same two lines at the same size read as a list.
 *
 *   Scorecard        a handful of numbers, equal weight, read across.
 *   KeyValueList     many pairs, read down, one line each.
 *   DefinitionList   prose descriptions of terms, not measurements.
 *   Card             one subject with a heading, body and actions.
 *
 * ### The hairlines are gaps, not borders
 *
 * The root is a sheet of `hairline` and the cells are `surface-variant` tiles
 * laid on it with a 1px gap. Drawing the rule as a border on every cell but the
 * first is the obvious approach and is wrong the moment the row wraps: the
 * first cell of the second row keeps a leading rule that divides it from
 * nothing. A gap is correct at every width, and gives the wrapped rows a
 * horizontal rule for free — which is what a grid of figures should look like.
 */

function Scorecard({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="scorecard"
      className={cn(
        // `overflow-hidden` is what makes the radius cut the corner tiles; the
        // cells are square and the sheet does the rounding.
        "bg-cm-hairline flex flex-wrap gap-px overflow-hidden rounded-[12px]",
        className,
      )}
      {...props}
    />
  );
}

export interface ScorecardCellProps extends Omit<React.ComponentProps<"div">, "prefix"> {
  /** What the number is. `label-medium`, above it. */
  label?: React.ReactNode;
  /** The number. `body-large` — the one line the reader came for. */
  value?: React.ReactNode;
  /** The caveat: a period, a region, a sample size. */
  footnote?: React.ReactNode;
}

/**
 * One figure. `flex-1` with a 150px floor, so four cells split a wide row
 * evenly and drop to two-up rather than squeezing a number onto two lines.
 *
 * `children` render below the footnote — a `Tag` with a delta in it, a
 * sparkline, a `Link` to the query behind the figure.
 */
function ScorecardCell({
  className,
  label,
  value,
  footnote,
  children,
  ...props
}: ScorecardCellProps) {
  return (
    <div
      data-slot="scorecard-cell"
      className={cn(
        "bg-cm-surface-variant flex min-w-[150px] flex-1 flex-col gap-1 p-4",
        className,
      )}
      {...props}
    >
      {label !== undefined && (
        <span className="text-cm-label-medium text-cm-on-surface">{label}</span>
      )}
      {value !== undefined && (
        <span className="text-cm-body-large text-cm-on-surface">{value}</span>
      )}
      {footnote !== undefined && (
        <span className="text-cm-body-small text-cm-on-surface-variant">{footnote}</span>
      )}
      {children}
    </div>
  );
}

export { Scorecard, ScorecardCell };
