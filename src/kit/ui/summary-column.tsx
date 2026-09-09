import * as React from "react";

import { cn } from "./utils";

/**
 * SummaryColumn — the narrow right-hand column that summarises what is on the
 * left.
 *
 * The console's create flows are two columns: a long form, and beside it a
 * running account of what you have chosen so far and what it will cost. This is
 * that second column. It is not a `Panel` — it has no border, no scroll of its
 * own and no header bar — and it is not a `Card`, because it holds several
 * cards rather than being one.
 *
 * ### `floating` is what makes it useful
 *
 * The form is ten screens long and the summary is half a screen, so without
 * stickiness the reader loses the total the moment they start filling anything
 * in. `floating` pins it 24px below the top of the scroll container.
 *
 * It is off by default because sticky positioning only works if an ancestor
 * scrolls and none of them clip overflow — a `Panel` two levels up with
 * `overflow-hidden` silently turns it back into a static block. Opting in makes
 * that a decision the page author took rather than a default that quietly fails.
 */

export interface SummaryColumnProps extends Omit<React.ComponentProps<"aside">, "title"> {
  title?: React.ReactNode;
  /** A `Tag` or `ProductBadge` beside the heading. */
  badge?: React.ReactNode;
  /** Pin the column while the page beside it scrolls. */
  floating?: boolean;
}

function SummaryColumn({
  className,
  title,
  badge,
  floating = false,
  children,
  ...props
}: SummaryColumnProps) {
  return (
    <aside
      data-slot="summary-column"
      className={cn(
        // The 24px inset on the leading edge is the gutter between the form and
        // the summary. It lives on the column rather than on the grid so the
        // column keeps its own spacing wherever it is dropped.
        "flex flex-col ps-6",
        floating && "sticky top-6",
        className,
      )}
      {...props}
    >
      {(title || badge) && (
        <div className="mb-4 flex items-center gap-2.5">
          {title && (
            // `title-large` (20px) — this heads a region of the page, one rung
            // above `PanelTitle`'s 18px and level with the page title it sits
            // beside.
            <h2 className="text-cm-title-large text-cm-on-surface">{title}</h2>
          )}
          {badge}
        </div>
      )}
      <div className="flex flex-col gap-4">{children}</div>
    </aside>
  );
}

export { SummaryColumn };
