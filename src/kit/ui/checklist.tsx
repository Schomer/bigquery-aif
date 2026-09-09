import * as React from "react";

import { CheckCircle, ErrorIcon } from "./material-symbols";
import { cn } from "./utils";

/**
 * Checklist — what has to happen, and how much of it has.
 *
 * The "before you begin" panel, the setup progress on an empty state, the
 * post-deploy verification list. It reports state; it does not collect it. Do
 * not confuse it with the two things it sits between:
 *
 *   Checkbox    the reader ticks it. It is an input.
 *   Checklist   the *system* ticks it. Read-only status.
 *   Stepper     one step at a time, with the form for the current step inside.
 *
 * So this is for "enable the API (complete), grant the role (failed), create a bucket (pending)" — a
 * list the page updates as things complete.
 *
 * ### Sequential or not
 *
 *   sequential      numbered. Order matters; item three cannot start first.
 *   non-sequential  a hollow ring. A set of prerequisites in any order.
 *
 * Completed and failed items look the same in both, because "done" and "broken"
 * do not become less true when the order stops mattering.
 *
 * ### `activeIndex` is a highlight, not a state
 *
 * It tints the row the reader should be looking at. An item can be active and
 * pending, or active and failed; the two axes are independent, which is why
 * `state` does not have an `active` member.
 */

export type ChecklistItemState = "pending" | "completed" | "error";

export interface ChecklistItem {
  title: React.ReactNode;
  /** What to do, or — for `error` — what went wrong. */
  description?: React.ReactNode;
  state?: ChecklistItemState;
}

export interface ChecklistProps extends React.ComponentProps<"ul"> {
  items: ChecklistItem[];
  type?: "sequential" | "non-sequential";
  /** Highlights one row. `-1` for none. */
  activeIndex?: number;
  /**
   * Renders each title as a real heading at this level. Leave unset for a
   * checklist that is a list rather than a set of sections — the common case,
   * and six `<h3>`s in a side panel is not free.
   */
  headingLevel?: 1 | 2 | 3 | 4 | 5 | 6;
}

function Checklist({
  className,
  items,
  type = "non-sequential",
  activeIndex = -1,
  headingLevel,
  ...props
}: ChecklistProps) {
  const Heading = headingLevel ? (`h${headingLevel}` as const) : "div";

  return (
    <ul data-slot="checklist" className={cn("flex list-none flex-col", className)} {...props}>
      {items.map((item, index) => {
        const state = item.state ?? "pending";
        const isError = state === "error";

        return (
          <li
            key={index}
            className={cn(
              "flex items-start gap-3 rounded-lg px-2 py-2",
              index === activeIndex && "bg-cm-container-high",
            )}
          >
            <span className="flex size-5 shrink-0 items-center justify-center pt-0.5">
              {state === "completed" ? (
                <CheckCircle aria-hidden className="text-cm-status-success size-5" />
              ) : isError ? (
                <ErrorIcon aria-hidden className="text-cm-status-error size-5" />
              ) : type === "sequential" ? (
                <span className="bg-cm-container text-cm-on-surface-variant text-cm-label-small flex size-5 items-center justify-center rounded-full">
                  {index + 1}
                </span>
              ) : (
                // A hollow ring, not an empty circle glyph: it has to read as
                // "not yet" rather than as a third status, and an outline of
                // the same size as the check keeps the column aligned.
                <span
                  aria-hidden
                  className="border-cm-outline size-[14px] rounded-full border-2"
                />
              )}
            </span>
            {/*
              The state is spelled out for a screen reader. The glyph carries it
              visually and `aria-hidden` takes it out of the tree, so without
              this line a checklist reads as an undifferentiated list of tasks.
            */}
            <span className="sr-only">
              {state === "completed" ? "Completed: " : isError ? "Failed: " : "Pending: "}
            </span>
            <div className="flex min-w-0 flex-col gap-0.5">
              <Heading className="text-cm-label-large text-cm-on-surface">
                {item.title}
              </Heading>
              {item.description && (
                <div
                  className={cn(
                    "text-cm-body-small",
                    isError ? "text-cm-status-error" : "text-cm-on-surface-variant",
                  )}
                >
                  {item.description}
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export { Checklist };
