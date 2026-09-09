import * as React from "react";

import { cn } from "./utils";

/**
 * Panel — a bounded region with a header, a body that scrolls, and a footer
 * that does not.
 *
 * This is the console's *layout* container, and the distinction from `Card` is
 * worth holding onto, because they look similar in a screenshot and behave
 * nothing alike:
 *
 *   Card    a tinted block that grows with its content. No scrolling.
 *   Panel   a box with a fixed outer height whose middle scrolls.
 *
 * So a panel is what you reach for when the content is taller than the space —
 * a details pane beside a list, a log viewer, the right half of a split view.
 * A card in that position pushes the page into scrolling instead, which is the
 * one thing AGENTS.md §1 says a console screen must not do.
 *
 * ### The scroll lives in `PanelBody`, and only there
 *
 * The root is `grid-rows-[auto_1fr_auto]` and the body is `min-h-0
 * overflow-auto`. `min-h-0` is the load-bearing half: a grid item's implicit
 * minimum is its content, so without it the body refuses to be shorter than
 * what is inside it, the whole panel grows past its container, and nothing
 * scrolls because nothing believes it overflowed. That is the same trap
 * AGENTS.md §1 flags for flex children, one layout mode over.
 *
 * ### Header
 *
 * `PanelHeader` is a slot, not an `ActionBar`. CDS builds its panel header out
 * of `cdsw-action-bar`, but in this kit `ActionBar` titles a *page* — one per
 * screen, holding the actions for the whole thing. Nesting one inside every
 * panel would put four of them on a split view and demote the real one. Put a
 * `PanelTitle` and some buttons in here instead; if the panel *is* the page,
 * an `ActionBar` above the panel is the right shape.
 */

export interface PanelProps extends React.ComponentProps<"section"> {
  /** Drop the hairline and the radius — for a panel flush inside another box. */
  noBorder?: boolean;
}

function Panel({ className, noBorder = false, ...props }: PanelProps) {
  return (
    <section
      data-slot="panel"
      className={cn(
        "bg-cm-surface grid h-full min-h-0 grid-rows-[auto_1fr_auto] overflow-hidden",
        !noBorder && "border-cm-hairline rounded-[12px] border",
        className,
      )}
      {...props}
    />
  );
}

/**
 * The top bar. 48px to match `ActionBar`'s rhythm, so a panel beside a page
 * that has one does not sit a few pixels off it.
 */
function PanelHeader({ className, ...props }: React.ComponentProps<"header">) {
  return (
    <header
      data-slot="panel-header"
      className={cn(
        "border-cm-hairline flex h-12 shrink-0 items-center gap-2 border-b px-4",
        className,
      )}
      {...props}
    />
  );
}

export interface PanelTitleProps extends React.ComponentProps<"h2"> {
  /** A `Tag` or `ProductBadge` beside the name, kept out of the action cluster. */
  status?: React.ReactNode;
}

/**
 * `title-small` (18px) and not the page title's 20px. A panel is a region
 * inside a screen, so its heading sits one rung below the screen's — the same
 * ladder `CardTitle` and `UnfoldTrigger` walk.
 */
function PanelTitle({ className, status, children, ...props }: PanelTitleProps) {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-2.5">
      <h2
        data-slot="panel-title"
        className={cn("text-cm-title-small text-cm-on-surface truncate", className)}
        {...props}
      >
        {children}
      </h2>
      {status}
    </div>
  );
}

/** Pushes what follows it to the far edge of the header. */
function PanelHeaderActions({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="panel-header-actions"
      className={cn("ml-auto flex shrink-0 items-center gap-1", className)}
      {...props}
    />
  );
}

/**
 * A strip under the header that does not scroll with the body — a filter row,
 * a set of tabs, a selection count.
 */
function PanelSubHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="panel-sub-header"
      className={cn(
        "border-cm-hairline row-start-1 flex shrink-0 items-center gap-2 border-b px-4 py-2",
        className,
      )}
      {...props}
    />
  );
}

export interface PanelBodyProps extends React.ComponentProps<"div"> {
  /** Content that wants the full width — a table, an editor. */
  noPadding?: boolean;
}

function PanelBody({ className, noPadding = false, ...props }: PanelBodyProps) {
  return (
    <div
      data-slot="panel-body"
      className={cn("min-h-0 overflow-auto", !noPadding && "p-4", className)}
      {...props}
    />
  );
}

/**
 * Buttons at the bottom, pinned. It is `justify-end` by default because a
 * panel footer holds a commit and a cancel, and those live at the trailing
 * edge in every console dialog and subtask.
 */
function PanelFooter({ className, ...props }: React.ComponentProps<"footer">) {
  return (
    <footer
      data-slot="panel-footer"
      className={cn(
        "border-cm-hairline flex shrink-0 items-center justify-end gap-2 border-t px-4 py-3",
        className,
      )}
      {...props}
    />
  );
}

export {
  Panel,
  PanelHeader,
  PanelTitle,
  PanelHeaderActions,
  PanelSubHeader,
  PanelBody,
  PanelFooter,
};
