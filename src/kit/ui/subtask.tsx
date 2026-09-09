"use client";

import * as React from "react";
import * as SubtaskPrimitive from "@radix-ui/react-dialog";
import { Close, KeyboardArrowDown, KeyboardArrowUp } from "./material-symbols";

import { cn } from "./utils";

/**
 * Subtask — a full-height panel that slides in from the right to host one
 * self-contained job (create a resource, configure a connection) without
 * navigating away from the page underneath.
 *
 * Two variants, both assembled from these parts rather than selected with a
 * prop, because the difference is which regions are present:
 *
 *   1. Form subtask     Header + Main (+ Summary). Actions flow inline at the
 *                       end of the form.
 *   2. Steplist subtask Header + Steps (+ Summary). `SubtaskSteps` draws both
 *                       the rail and the column beside it — see its note.
 *
 * `SubtaskSummary` is optional in both — drop it and the main column simply
 * sits alone.
 *
 * Built on Radix's Dialog, so it is modal and focus-trapped, and the props are
 * Radix's (`open`, `onOpenChange`, `defaultOpen`).
 *
 * Column widths come from the Cloud subtask spec: a 512px main column and a
 * 320px summary column inside 24px gutters. The panel is sized by the columns
 * that are actually there rather than by the window, so dropping the summary
 * narrows the panel by exactly its width instead of leaving a hole. Every
 * colour resolves to a cm token.
 *
 * ### The narrow layout
 *
 * Below `lg` (1024px) three columns will not fit beside each other, so the
 * panel becomes one column: the steplist turns into a stack of expanding rows
 * (see `SubtaskSteps`) and the summary drops underneath the form instead of
 * beside it. `lg` is the whole responsive story — there is one breakpoint in
 * this file and every part below reads from it.
 */
function Subtask({ ...props }: React.ComponentProps<typeof SubtaskPrimitive.Root>) {
  return <SubtaskPrimitive.Root data-slot="subtask" {...props} />;
}

function SubtaskTrigger({
  ...props
}: React.ComponentProps<typeof SubtaskPrimitive.Trigger>) {
  return <SubtaskPrimitive.Trigger data-slot="subtask-trigger" {...props} />;
}

function SubtaskClose({
  ...props
}: React.ComponentProps<typeof SubtaskPrimitive.Close>) {
  return <SubtaskPrimitive.Close data-slot="subtask-close" {...props} />;
}

function SubtaskPortal({
  ...props
}: React.ComponentProps<typeof SubtaskPrimitive.Portal>) {
  return <SubtaskPrimitive.Portal data-slot="subtask-portal" {...props} />;
}

/**
 * forwardRef is required here: Radix's Portal wraps each child in a `Presence`
 * that needs the element to run the exit animation, and a plain function
 * component would swallow that ref on React 18.
 */
const SubtaskOverlay = React.forwardRef<
  React.ComponentRef<typeof SubtaskPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof SubtaskPrimitive.Overlay>
>(function SubtaskOverlay({ className, ...props }, ref) {
  return (
    <SubtaskPrimitive.Overlay
      ref={ref}
      data-slot="subtask-overlay"
      className={cn(
        // The scrim is the kit's one deliberate non-token colour — see the note
        // on DialogOverlay in dialog.tsx. Same value in all three overlays.
        "fixed inset-0 z-50 bg-black/20 backdrop-blur-[1px]",
        "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
        className,
      )}
      {...props}
    />
  );
});

/**
 * The panel itself. `side` exists only for the off-canvas mobile nav in
 * `sidebar.tsx`; a subtask is a right-side panel, and the layout parts below
 * assume that.
 */
function SubtaskContent({
  className,
  children,
  side = "right",
  ...props
}: React.ComponentProps<typeof SubtaskPrimitive.Content> & {
  side?: "top" | "right" | "bottom" | "left";
}) {
  return (
    <SubtaskPortal>
      <SubtaskOverlay />
      <SubtaskPrimitive.Content
        data-slot="subtask-content"
        className={cn(
          "bg-cm-surface fixed z-50 flex flex-col shadow-2xl transition ease-in-out",
          "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:duration-300 data-[state=open]:duration-500",
          side === "right" &&
            // Shrink-to-fit, so the panel is only as wide as the columns it
            // actually contains: 904px with a summary, 560px without, plus
            // 256px again when the steplist rail is present. The cap keeps at
            // least 64px of the page visible behind the scrim — a subtask is a
            // detour, not a destination — and below it the main column shrinks.
            //
            // Below `lg` the columns have stacked, so there is nothing left to
            // shrink to: the panel takes the window instead, less that same
            // 64px. Fixing the width here rather than letting it stay
            // shrink-to-fit is also what makes `w-full` mean anything on the
            // columns inside — a percentage resolved against a shrink-to-fit
            // parent is circular, and the browser breaks the loop by treating
            // it as `auto`.
            "data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right inset-y-0 right-0 h-full w-[calc(100%-64px)] max-w-[min(1280px,calc(100%-64px))] lg:w-fit",
          side === "left" &&
            "data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left inset-y-0 left-0 h-full w-3/4 border-r sm:max-w-sm",
          side === "top" &&
            "data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top inset-x-0 top-0 h-auto border-b",
          side === "bottom" &&
            "data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom inset-x-0 bottom-0 h-auto border-t",
          className,
        )}
        {...props}
      >
        {children}
      </SubtaskPrimitive.Content>
    </SubtaskPortal>
  );
}

/**
 * Title row. The close control is part of the header, not floated over it.
 *
 * `w-0 min-w-full` keeps the header out of the panel's shrink-to-fit width
 * calculation — the columns decide how wide a subtask is, and a long title
 * should hit `truncate` rather than stretch the panel to fit itself.
 */
function SubtaskHeader({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="subtask-header"
      className={cn(
        "flex h-12 w-0 min-w-full shrink-0 items-center justify-between gap-4 px-6",
        className,
      )}
      {...props}
    >
      {children}
      <SubtaskPrimitive.Close
        data-slot="subtask-header-close"
        className="text-cm-primary-on-container hover:bg-cm-backdrop focus-visible:ring-cm-outline-focus/40 -mr-1.5 flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full transition-colors outline-none focus-visible:ring-2"
        aria-label="Close"
      >
        <Close weight={700} className="size-[18px]" />
      </SubtaskPrimitive.Close>
    </div>
  );
}

function SubtaskTitle({
  className,
  ...props
}: React.ComponentProps<typeof SubtaskPrimitive.Title>) {
  return (
    <SubtaskPrimitive.Title
      data-slot="subtask-title"
      className={cn("text-cm-title-large text-cm-on-surface truncate", className)}
      {...props}
    />
  );
}

/** Lead paragraph at the top of a region — also the Radix a11y description. */
function SubtaskDescription({
  className,
  ...props
}: React.ComponentProps<typeof SubtaskPrimitive.Description>) {
  return (
    <SubtaskPrimitive.Description
      data-slot="subtask-description"
      className={cn("text-cm-body-medium text-cm-on-surface", className)}
      {...props}
    />
  );
}

/**
 * The region below the header: a row of columns that fills the rest of the
 * panel. Each column scrolls on its own, so a long form never pushes the
 * steplist or the summary out of reach.
 *
 * Below `lg` the columns stack and the body becomes the single scroller. Two
 * columns that each scroll are a nuisance side by side and unusable one above
 * the other — the lower one can only be reached by scrolling past the upper
 * one's own scrollbar.
 */
function SubtaskBody({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="subtask-body"
      className={cn(
        "flex min-h-0 flex-1 flex-col overflow-y-auto lg:flex-row lg:overflow-y-hidden",
        className,
      )}
      {...props}
    />
  );
}

export interface SubtaskStepProps extends React.ComponentProps<"div"> {
  /** The step's name. Appears in the rail and in the narrow layout's row. */
  label: React.ReactNode;
  /** One line under the label saying what the step is for. Optional. */
  description?: React.ReactNode;
  /** Adds a muted "(optional)" after the label. */
  optional?: boolean;
  /**
   * A heading rendered above this step, grouping it and everything after it —
   * "Additional information" over the steps that are not required. Set it on
   * the first step of the group.
   */
  group?: React.ReactNode;
  /** The step's own content: its fields, and its `SubtaskFooter`. */
  children?: React.ReactNode;
}

/**
 * One step. Declared once, with its label *and* its content, because those two
 * are drawn in different places depending on how wide the panel is and a step
 * written down twice is a step that goes out of sync.
 *
 * Never rendered directly — `SubtaskSteps` reads these props and draws the row
 * itself. It is a declaration, not an element.
 */
function SubtaskStep(_props: SubtaskStepProps): React.ReactNode {
  return null;
}
SubtaskStep.displayName = "SubtaskStep";

/**
 * Explanatory copy above the steps, inset to match the step labels. Internal:
 * it belongs at the top of the rail, which only `SubtaskSteps` can place, so it
 * arrives as the `intro` prop rather than as a child.
 */
function SubtaskStepsIntro({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="subtask-steps-intro"
      className={cn(
        "text-cm-body-medium text-cm-on-surface px-6 pt-5 pb-4",
        className,
      )}
      {...props}
    />
  );
}

/** The "Additional information" heading between two groups of steps. */
function SubtaskStepGroup({ className, ...props }: React.ComponentProps<"h3">) {
  return (
    <h3
      data-slot="subtask-step-group"
      className={cn(
        "text-cm-label-medium text-cm-on-surface px-6 pt-3 pb-1 lg:pt-5 lg:pb-2",
        className,
      )}
      {...props}
    />
  );
}

/** The number in the circle. Filled `primary` on the step you are on. */
function StepBadge({ step, current }: { step: number; current: boolean }) {
  return (
    <span
      data-slot="subtask-step-badge"
      className={cn(
        "text-cm-label-small text-cm-on-primary flex size-5 shrink-0 items-center justify-center rounded-full",
        current ? "bg-cm-primary" : "bg-cm-on-surface-variant",
      )}
      aria-hidden
    >
      {step}
    </span>
  );
}

function StepLabel({ label, optional }: { label: React.ReactNode; optional?: boolean }) {
  return (
    <span className="text-cm-body-large text-cm-on-surface">
      {label}
      {optional && <span className="text-cm-on-surface-variant"> (optional)</span>}
    </span>
  );
}

export interface SubtaskStepsProps extends Omit<React.ComponentProps<"div">, "onChange"> {
  /** Index of the step being worked on, 0-based. Controlled. */
  value?: number;
  /** Where to start when you are not controlling it. Defaults to the first. */
  defaultValue?: number;
  /** Fired when a step row is clicked. */
  onValueChange?: (value: number) => void;
  /** A line above the rail saying what the whole flow is. Wide layout only. */
  intro?: React.ReactNode;
  /** `SubtaskStep` declarations. Anything else here is ignored. */
  children?: React.ReactNode;
}

/**
 * The steplist. It draws two things — the rail and the column beside it — so it
 * replaces `SubtaskMain` in this variant:
 *
 *     <SubtaskBody>
 *       <SubtaskSteps value={step} onValueChange={setStep} intro="…">
 *         <SubtaskStep label="Choose a source">
 *           …fields…
 *           <SubtaskFooter pinned>…</SubtaskFooter>
 *         </SubtaskStep>
 *       </SubtaskSteps>
 *       <SubtaskSummary>…</SubtaskSummary>
 *     </SubtaskBody>
 *
 * ### Wide and narrow are one tree
 *
 * Below `lg` the rail has nowhere to go, so the steps stack instead: each one
 * becomes a row with its number, its name and a chevron, and the row you are on
 * opens to show its fields inline. It is the same list of steps, read top to
 * bottom rather than left to right.
 *
 * The two layouts are the same DOM with different CSS, which is the only reason
 * this is safe. A step's fields are mounted **once**: the rail is
 * `hidden lg:flex`, the stacked row header is `lg:hidden`, and the content is
 * shown when its step is current in either layout. Rendering both layouts and
 * hiding one would duplicate every input in the panel — two elements with the
 * same `id`, two copies of the typed value, and a form that submits whichever
 * one React reconciled last.
 *
 * It follows that expanding a row and selecting a rail step are not two states.
 * There is one `value`, and it means "the step being worked on" in both.
 */
function SubtaskSteps({
  className,
  value,
  defaultValue = 0,
  onValueChange,
  intro,
  children,
  ...props
}: SubtaskStepsProps) {
  const [uncontrolled, setUncontrolled] = React.useState(defaultValue);
  const current = value ?? uncontrolled;

  const select = (next: number) => {
    if (value === undefined) setUncontrolled(next);
    onValueChange?.(next);
  };

  const steps = React.Children.toArray(children).filter(
    (child): child is React.ReactElement<SubtaskStepProps> =>
      React.isValidElement(child) && child.type === SubtaskStep,
  );

  return (
    <>
      <nav
        data-slot="subtask-steps"
        className={cn(
          "border-cm-hairline hidden w-64 shrink-0 flex-col overflow-y-auto border-r pb-4 lg:flex",
          className,
        )}
        {...props}
      >
        {intro && <SubtaskStepsIntro>{intro}</SubtaskStepsIntro>}
        {steps.map((step, i) => (
          <React.Fragment key={i}>
            {step.props.group && <SubtaskStepGroup>{step.props.group}</SubtaskStepGroup>}
            {/* The 4px accent is a left border on every row — transparent when
                inactive — so making a step current cannot shift the labels
                sideways. */}
            <button
              type="button"
              data-slot="subtask-step"
              data-active={i === current || undefined}
              aria-current={i === current ? "step" : undefined}
              onClick={() => select(i)}
              className={cn(
                "flex w-full cursor-pointer flex-col items-start gap-0.5 border-l-4 py-2.5 pr-4 pl-5 text-left transition-colors",
                i === current
                  ? "border-cm-primary bg-cm-selection-container"
                  : "hover:bg-cm-surface-variant border-transparent",
              )}
            >
              <span className="flex items-center gap-3">
                <StepBadge step={i + 1} current={i === current} />
                <StepLabel label={step.props.label} optional={step.props.optional} />
              </span>
              {step.props.description && (
                <span className="text-cm-body-medium text-cm-on-surface-variant pl-8">
                  {step.props.description}
                </span>
              )}
            </button>
          </React.Fragment>
        ))}
      </nav>

      {/* No horizontal padding of its own below `lg`: the stacked rows and their
          hairlines run the full width of the panel, and the 24px gutter is put
          back inside each row so the rule can pass under it. */}
      <SubtaskMain
        data-slot="subtask-steps-main"
        className="px-0 py-0 lg:px-6 lg:py-5"
      >
        {steps.map((step, i) => {
          const open = i === current;
          return (
            <section
              key={i}
              data-slot="subtask-step-section"
              data-state={open ? "open" : "closed"}
              className="border-cm-hairline flex min-h-0 flex-col border-b lg:contents lg:border-b-0"
            >
              {/* No rule above the heading: the step before it already drew
                  one as its own bottom border. */}
              {step.props.group && (
                <SubtaskStepGroup className="lg:hidden">{step.props.group}</SubtaskStepGroup>
              )}
              {/* The row header exists only in the narrow layout — the rail is
                  the header when there is room for it. */}
              <button
                type="button"
                data-slot="subtask-step-header"
                aria-expanded={open}
                onClick={() => select(i)}
                className="hover:bg-cm-surface-variant flex w-full cursor-pointer items-center gap-4 px-6 py-3 text-left transition-colors lg:hidden"
              >
                <StepBadge step={i + 1} current={open} />
                <span className="flex min-w-0 flex-1 flex-col">
                  <StepLabel label={step.props.label} optional={step.props.optional} />
                  {step.props.description && (
                    <span className="text-cm-body-medium text-cm-on-surface-variant">
                      {step.props.description}
                    </span>
                  )}
                </span>
                {open ? (
                  <KeyboardArrowUp className="text-cm-on-surface size-[18px] shrink-0" aria-hidden />
                ) : (
                  <KeyboardArrowDown
                    className="text-cm-on-surface-variant-low size-[18px] shrink-0"
                    aria-hidden
                  />
                )}
              </button>
              {/* `hidden` rather than unmounting: a half-filled step keeps what
                  was typed into it when you look at another one.

                  Open, the wrapper goes `display: contents` at `lg` so the
                  step's own children become direct children of the column —
                  which is what lets a pinned `SubtaskFooter` stick to the
                  bottom of the panel rather than to the bottom of this div. */}
              <div
                data-slot="subtask-step-content"
                className={cn(
                  "flex min-h-0 flex-col px-6 pt-8 pb-6",
                  open ? "lg:contents" : "hidden",
                )}
              >
                {step.props.children}
              </div>
            </section>
          );
        })}
      </SubtaskMain>
    </>
  );
}

/**
 * Primary content column: 512px of content inside 24px gutters, the width the
 * inputs in the reference are drawn to. It is the one column that shrinks —
 * `min-w-0` with the default `flex-shrink` — so when the panel hits its cap the
 * form narrows instead of the summary being pushed off the edge. Deliberately
 * not `flex-1`: that would zero the flex basis and leave the panel's
 * shrink-to-fit width at the mercy of whatever content is inside.
 */
function SubtaskMain({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="subtask-main"
      className={cn(
        "flex w-full min-w-0 flex-col px-6 py-5 lg:w-[560px] lg:overflow-y-auto",
        className,
      )}
      {...props}
    />
  );
}

/**
 * Optional right-hand column for supplementary content — pricing, quotas, a
 * running total. Leave it out and the main column stands alone.
 *
 * Below `lg` it is no longer a right-hand column: it sits under the form, and
 * needs its own left gutter because the main column's is no longer beside it.
 */
function SubtaskSummary({ className, ...props }: React.ComponentProps<"aside">) {
  return (
    <aside
      data-slot="subtask-summary"
      className={cn(
        "flex w-full shrink-0 flex-col gap-2 px-6 pt-1 pb-5",
        "lg:w-[344px] lg:overflow-y-auto lg:py-5 lg:pr-6 lg:pl-0",
        className,
      )}
      {...props}
    />
  );
}

function SubtaskSummaryTitle({ className, ...props }: React.ComponentProps<"h2">) {
  return (
    <h2
      data-slot="subtask-summary-title"
      className={cn("text-cm-title-large text-cm-on-surface", className)}
      {...props}
    />
  );
}

export interface SubtaskFooterProps extends React.ComponentProps<"div"> {
  /**
   * Hold the actions at the bottom of the column and keep them there while the
   * content scrolls. The steplist variant pins; the plain form variant lets
   * them sit directly under the last field, which is where the eye already is.
   *
   * Only above `lg`. In the stacked layout the actions belong directly under
   * the fields of the step that is open — pinning them would park a Continue
   * button at the foot of the panel, a long way from the step it continues,
   * and over the top of the steps that come after it.
   */
  pinned?: boolean;
}

function SubtaskFooter({ className, pinned = false, ...props }: SubtaskFooterProps) {
  return (
    <div
      data-slot="subtask-footer"
      className={cn(
        "flex shrink-0 flex-wrap items-center gap-2 pt-6",
        pinned && "lg:bg-cm-surface lg:sticky lg:bottom-0 lg:mt-auto lg:pb-1",
        className,
      )}
      {...props}
    />
  );
}

export {
  Subtask,
  SubtaskTrigger,
  SubtaskClose,
  SubtaskContent,
  SubtaskHeader,
  SubtaskTitle,
  SubtaskDescription,
  SubtaskBody,
  SubtaskSteps,
  SubtaskStep,
  SubtaskStepGroup,
  SubtaskMain,
  SubtaskSummary,
  SubtaskSummaryTitle,
  SubtaskFooter,
};
