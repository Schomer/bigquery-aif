"use client";

import * as React from "react";
import * as AccordionPrimitive from "@radix-ui/react-accordion";

import { KeyboardArrowDown } from "./material-symbols";
import { cn } from "./utils";

/**
 * The console's unfold: a heading with a chevron, a line or two that is always
 * on show, and the rest of it folded away underneath.
 *
 *     <Unfold type="single" collapsible defaultValue="a">
 *       <UnfoldItem value="a">
 *         <UnfoldTrigger>Header text</UnfoldTrigger>
 *         <UnfoldPreview>Preview content (optional). This is always displayed.</UnfoldPreview>
 *         <UnfoldContent>Hidden content. Visibility is toggled via the header.</UnfoldContent>
 *       </UnfoldItem>
 *     </Unfold>
 *
 * ### The preview is the whole idea
 *
 * A plain disclosure makes the reader open a section to find out whether it was
 * the section they wanted. `UnfoldPreview` is the answer to that: a line that
 * stays visible in both states, saying what is inside. It is optional, and a
 * section whose heading already says everything does not need one — but when
 * four of these are stacked on a settings page it is the difference between
 * scanning and opening each in turn.
 *
 * Open, the preview and the hidden content run together with no gap, which is
 * deliberate. They are one passage of prose cut in half by the fold rather than
 * two blocks, so the preview drops its bottom padding as the content arrives
 * and the next line lands exactly one line-height below it. Anything else makes
 * the fold look like a seam.
 *
 * ### One or many
 *
 * `type="single"` folds the others as one opens; `type="multiple"` lets them
 * all be open at once. Add `collapsible` to `single` if the reader is allowed
 * to close the last open one. For a lone disclosure with no heading row of its
 * own, `Collapsible` is the smaller thing.
 *
 * ### Heading level
 *
 * `level` is 1–6 and does two jobs at once: it picks the tag (`<h1>`…`<h6>`)
 * and it picks the type token, walking down the same ladder the rest of the kit
 * uses — `headline-small`, `title-large`, `title-medium`, `title-small`,
 * `label-large`, `body-large`. Level 5 is 16px at weight 500 and level 6 is
 * 16px at weight 400: the same size, distinguished by weight, which is where
 * the ladder runs out of sizes and starts using emphasis instead.
 *
 * It defaults to 3. An unfold nested inside a section that already has an
 * `<h2>` should say `level={3}` and mean it; one that is the page's own
 * top-level structure can go higher. The size follows the level rather than
 * being set separately, because a heading that is visually large and
 * semantically deep is the bug this is meant to prevent.
 *
 * The `accordion-*` animation names below come from `tw-animate-css` and are
 * tied to Radix's `--radix-accordion-content-height`. They are the library's
 * name for the primitive, not a leftover from this component's own.
 */

type UnfoldLevel = 1 | 2 | 3 | 4 | 5 | 6;

const LEVEL_TEXT: Record<UnfoldLevel, string> = {
  1: "text-cm-headline-small",
  2: "text-cm-title-large",
  3: "text-cm-title-medium",
  4: "text-cm-title-small",
  5: "text-cm-label-large",
  6: "text-cm-body-large",
};

const LevelContext = React.createContext<UnfoldLevel>(3);

function Unfold({
  level = 3,
  ...props
}: React.ComponentProps<typeof AccordionPrimitive.Root> & {
  level?: UnfoldLevel;
}) {
  return (
    <LevelContext.Provider value={level}>
      <AccordionPrimitive.Root data-slot="unfold" {...props} />
    </LevelContext.Provider>
  );
}

function UnfoldItem({
  className,
  ...props
}: React.ComponentProps<typeof AccordionPrimitive.Item>) {
  return (
    <AccordionPrimitive.Item
      data-slot="unfold-item"
      // `group/unfold` so the preview can see whether its own item is open —
      // Radix puts `data-state` on the item, not on every child of it.
      className={cn("group/unfold border-cm-hairline border-b last:border-b-0", className)}
      {...props}
    />
  );
}

function UnfoldTrigger({
  className,
  children,
  level,
  ...props
}: React.ComponentProps<typeof AccordionPrimitive.Trigger> & {
  level?: UnfoldLevel;
}) {
  const inherited = React.useContext(LevelContext);
  const n = level ?? inherited;
  const Heading = `h${n}` as const;

  return (
    // `asChild` so the heading tag matches the level. Radix's own default is a
    // fixed `<h3>`, which is right exactly one time in six.
    <AccordionPrimitive.Header asChild>
      <Heading className="flex">
        <AccordionPrimitive.Trigger
          data-slot="unfold-trigger"
          // 12px under the heading rather than 16: that is the measured gap to
          // the preview, and it is what keeps a header and its line of preview
          // reading as one unit rather than two stacked rows.
          className={cn(
            LEVEL_TEXT[n],
            "text-cm-on-surface focus-visible:ring-cm-outline-focus/50 flex flex-1 cursor-pointer items-center justify-between gap-4 rounded-md pt-4 pb-3 text-left outline-none focus-visible:ring-[3px] disabled:pointer-events-none disabled:opacity-50 [&[data-state=open]>svg]:rotate-180",
            className,
          )}
          {...props}
        >
          {children}
          {/* 24px at every level. The chevron is a control, not part of the
              heading, so it stays the size a control has to be. */}
          <KeyboardArrowDown
            className="text-cm-on-surface pointer-events-none size-6 shrink-0 transition-transform duration-200"
            aria-hidden
          />
        </AccordionPrimitive.Trigger>
      </Heading>
    </AccordionPrimitive.Header>
  );
}

/**
 * The line that is on show whether or not the section is open. Optional, and it
 * goes between the trigger and the content.
 */
function UnfoldPreview({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="unfold-preview"
      className={cn(
        "text-cm-body-medium text-cm-on-surface pb-4 group-data-[state=open]/unfold:pb-0",
        className,
      )}
      {...props}
    />
  );
}

function UnfoldContent({
  className,
  children,
  ...props
}: React.ComponentProps<typeof AccordionPrimitive.Content>) {
  return (
    <AccordionPrimitive.Content
      data-slot="unfold-content"
      className="text-cm-body-medium text-cm-on-surface data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down overflow-hidden"
      {...props}
    >
      <div className={cn("pb-4", className)}>{children}</div>
    </AccordionPrimitive.Content>
  );
}

export { Unfold, UnfoldItem, UnfoldTrigger, UnfoldPreview, UnfoldContent };
