"use client";

import * as React from "react";
import * as AccordionPrimitive from "@radix-ui/react-accordion";

import { KeyboardArrowDown } from "./material-symbols";
import { cn } from "./utils";

/**
 * ExpandingRow — a list of rows, one of which can be opened in place.
 *
 *     <ExpandingRows defaultValue="job-1">
 *       <ExpandingRow value="job-1" header={<>…summary cells…</>}>
 *         …detail…
 *       </ExpandingRow>
 *     </ExpandingRows>
 *
 * This is the console's log viewer and job list: rows of tabular summary where
 * opening one shows the whole record underneath, without leaving the page. The
 * closed row is a *line of a table*, which is what separates it from the kit's
 * other disclosures:
 *
 *   ExpandingRow   many rows of like-shaped data. The row is a record.
 *   Unfold         a few headed sections of unlike content, each with a preview.
 *   Collapsible    one section, hidden until asked for.
 *
 * ### One at a time
 *
 * Opening a row closes the one that was open. That is CDS's behaviour and it is
 * right for this shape: an open row is tall, and two of them push the third off
 * screen, which is the failure the reader was trying to avoid by staying on the
 * list. `Unfold type="multiple"` is the component for content you compare side
 * by side.
 *
 * ### The open row detaches from the list
 *
 * Closed, rows are flush `surface-variant` bands separated by hairlines. Open,
 * the row gains 8px of margin, a 12px radius and the `container-high` tint, so
 * it reads as lifted out of the list rather than as a taller row in it. The
 * header goes solid `primary` in that state — the strongest colour statement in
 * the kit, and it is here because the open row's header is also the control
 * that closes it, and it has to stay findable past a screen of detail.
 */

// Radix's root props are a union discriminated on `type`, and `Omit` over a
// union keeps only the keys every member shares — which would throw away
// `value` and `onValueChange`. Narrowing to the single-select member first is
// what keeps them, and this component only ever renders that member anyway.
type AccordionSingleProps = Extract<
  React.ComponentProps<typeof AccordionPrimitive.Root>,
  { type: "single" }
>;

export type ExpandingRowsProps = Omit<AccordionSingleProps, "type" | "collapsible">;

function ExpandingRows({ className, ...props }: ExpandingRowsProps) {
  return (
    <AccordionPrimitive.Root
      data-slot="expanding-rows"
      // `collapsible` is not optional here the way it is on `Unfold`: a list
      // where the reader cannot get back to all-closed is a list that is
      // permanently showing one record's detail whether they want it or not.
      type="single"
      collapsible
      className={cn("flex w-full flex-col", className)}
      {...props}
    />
  );
}

export interface ExpandingRowProps
  extends React.ComponentProps<typeof AccordionPrimitive.Item> {
  /** The always-visible summary. Lay the cells out yourself — a flex row of spans. */
  header: React.ReactNode;
}

function ExpandingRow({ className, header, children, ...props }: ExpandingRowProps) {
  return (
    <AccordionPrimitive.Item
      data-slot="expanding-row"
      className={cn(
        "bg-cm-surface-variant border-cm-hairline border-b transition-[margin,border-radius] last:border-b-0",
        // Open: lifted out of the stack. The hairline goes with it — a row that
        // is no longer flush with its neighbours has nothing to be divided from.
        "data-[state=open]:bg-cm-container-high data-[state=open]:my-2 data-[state=open]:rounded-[12px] data-[state=open]:border-transparent data-[state=open]:pb-2",
        className,
      )}
      {...props}
    >
      <AccordionPrimitive.Header className="flex">
        <AccordionPrimitive.Trigger
          className={cn(
            "text-cm-body-medium text-cm-on-surface flex flex-1 cursor-pointer items-center gap-2 px-4 py-1 text-left outline-none",
            "focus-visible:ring-cm-outline-focus/50 focus-visible:ring-[3px]",
            // The open header is the close control, so it is the loudest thing
            // in the row. `rounded-t-[12px]` follows the item's own radius —
            // without it the fill squares off the corners the item just gained.
            "data-[state=open]:bg-cm-primary data-[state=open]:text-cm-on-primary data-[state=open]:text-cm-body-large data-[state=open]:rounded-t-[12px] data-[state=open]:py-2",
            "[&[data-state=open]>svg]:rotate-180",
          )}
        >
          {header}
          <KeyboardArrowDown
            aria-hidden
            className="ml-auto size-5 shrink-0 transition-transform duration-200"
          />
        </AccordionPrimitive.Trigger>
      </AccordionPrimitive.Header>
      <AccordionPrimitive.Content
        className="data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down overflow-hidden"
      >
        <div className="text-cm-body-medium text-cm-on-surface px-4 py-3">{children}</div>
      </AccordionPrimitive.Content>
    </AccordionPrimitive.Item>
  );
}

export { ExpandingRows, ExpandingRow };
