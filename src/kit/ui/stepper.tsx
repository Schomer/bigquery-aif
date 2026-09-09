"use client";

import * as React from "react";

import { Button } from "./button";
import { Check } from "./material-symbols";
import { cn } from "./utils";

/**
 * Stepper — a create flow, one step at a time, down the page.
 *
 *     <Stepper activeStep={step} onActiveStepChange={setStep} onSubmit={save}>
 *       <StepperStep title="Name your dataset">…fields…</StepperStep>
 *       <StepperStep title="Choose a location" description="Cannot be changed later">…</StepperStep>
 *       <StepperStep title="Set an expiry" optional>…</StepperStep>
 *     </Stepper>
 *
 * The console's long create forms use this instead of one tall page: numbered
 * circles down the left, a rule joining them, and only the current step's
 * fields on screen. It is the honest shape for a form where step three's
 * options depend on step two's answer.
 *
 * ### Sequential by default
 *
 * Steps after the current one are disabled and cannot be jumped to — that is
 * what "sequential" means, and it is the default because most create flows have
 * that dependency. Completed steps stay clickable so the reader can go back and
 * change an answer. `nonSequential` unlocks the lot, for a form whose sections
 * are genuinely independent; `fixed` locks it the other way, for a wizard the
 * reader may not reverse out of.
 *
 * ### The circle carries three states and no more
 *
 *   upcoming   `container` fill, the step's number, dimmed
 *   active     `primary` fill, the step's number
 *   complete   `status-success` fill, a check
 *
 * There is no "error" circle. A step whose fields failed validation should say
 * so in the fields; a red circle in the margin tells the reader something is
 * wrong without telling them what, and they have to open the step to find out
 * anyway.
 *
 * ### Buttons
 *
 * The stepper renders its own Next/Back pair under the open step, because their
 * position and their labels are part of the pattern. The last step's primary
 * button says `submitLabel` and fires `onSubmit`. Pass `noStepperButtons` and
 * put your own commit somewhere else — a `Subtask` footer, say.
 */

interface StepperContextValue {
  activeIndex: number;
  register: (index: number) => void;
  onStepClick: (index: number) => void;
  nonSequential: boolean;
  fixed: boolean;
  count: number;
}

const StepperContext = React.createContext<StepperContextValue | null>(null);
const StepIndexContext = React.createContext(0);

export interface StepperProps extends Omit<React.ComponentProps<"div">, "onSubmit"> {
  /** Controlled step, zero-based. Uncontrolled if omitted. */
  activeStep?: number;
  defaultActiveStep?: number;
  onActiveStepChange?: (index: number) => void;
  /** Let the reader open any step, in any order. */
  nonSequential?: boolean;
  /** Forbid going back to a completed step. */
  fixed?: boolean;
  /** Hide the built-in Next/Back row. */
  noStepperButtons?: boolean;
  submitLabel?: string;
  nextLabel?: string;
  backLabel?: string;
  /** Fired by the primary button on the last step. */
  onSubmit?: () => void;
  children?: React.ReactNode;
}

function Stepper({
  className,
  activeStep,
  defaultActiveStep = 0,
  onActiveStepChange,
  nonSequential = false,
  fixed = false,
  noStepperButtons = false,
  submitLabel = "Done",
  nextLabel = "Next",
  backLabel = "Back",
  onSubmit,
  children,
  ...props
}: StepperProps) {
  const [uncontrolled, setUncontrolled] = React.useState(defaultActiveStep);
  const active = activeStep ?? uncontrolled;

  // Counted from the children rather than tracked in state: the steps are
  // always direct children, so the count is known at render time and a
  // registration effect would only make it correct one frame later.
  const count = React.Children.toArray(children).filter(React.isValidElement).length;

  const goTo = (index: number) => {
    if (index < 0 || index >= count) return;
    if (activeStep === undefined) setUncontrolled(index);
    onActiveStepChange?.(index);
  };

  const onStepClick = (index: number) => {
    if (nonSequential) return goTo(index);
    if (index > active) return; // future steps are not reachable by clicking
    if (fixed && index !== active) return;
    goTo(index);
  };

  const context: StepperContextValue = {
    activeIndex: active,
    register: () => {},
    onStepClick,
    nonSequential,
    fixed,
    count,
  };

  const isLast = active === count - 1;

  return (
    <StepperContext.Provider value={context}>
      <div data-slot="stepper" className={cn("flex w-full flex-col", className)} {...props}>
        {React.Children.map(children, (child, index) =>
          React.isValidElement(child) ? (
            <StepIndexContext.Provider value={index}>{child}</StepIndexContext.Provider>
          ) : (
            child
          ),
        )}
        {!noStepperButtons && (
          // Indented to the step content's edge — 24px circle plus the 8px gap
          // — so the buttons line up under the fields they submit rather than
          // under the numbers in the margin.
          <div className="flex items-center gap-2 ps-8 pt-2">
            <Button onClick={() => (isLast ? onSubmit?.() : goTo(active + 1))}>
              {isLast ? submitLabel : nextLabel}
            </Button>
            {active > 0 && !fixed && (
              <Button variant="text" onClick={() => goTo(active - 1)}>
                {backLabel}
              </Button>
            )}
          </div>
        )}
      </div>
    </StepperContext.Provider>
  );
}

export interface StepperStepProps extends Omit<React.ComponentProps<"div">, "title"> {
  title: React.ReactNode;
  /** A line under the title, visible in every state. Say what the step is for. */
  description?: React.ReactNode;
  /** Appends "(optional)" — the reader may pass straight through. */
  optional?: boolean;
}

function StepperStep({
  className,
  title,
  description,
  optional = false,
  children,
  ...props
}: StepperStepProps) {
  const stepper = React.useContext(StepperContext);
  const index = React.useContext(StepIndexContext);
  const panelId = React.useId();

  if (!stepper) {
    throw new Error("StepperStep must be rendered inside a Stepper.");
  }

  const { activeIndex, onStepClick, nonSequential, count } = stepper;
  const isActive = index === activeIndex;
  const isComplete = !nonSequential && index < activeIndex;
  const isDisabled = !nonSequential && index > activeIndex;
  const isLast = index === count - 1;

  return (
    <div
      data-slot="stepper-step"
      data-state={isActive ? "active" : isComplete ? "complete" : "upcoming"}
      className={cn("relative flex flex-col pb-4", className)}
      {...props}
    >
      {/*
        The connector is drawn by the step above rather than between steps,
        which is what lets it start under the circle and run the full height of
        an open step's content without anyone measuring anything. The last step
        has nothing below it to join, so it draws none.
      */}
      {!isLast && (
        <span
          aria-hidden
          className="bg-cm-hairline absolute top-8 bottom-0 left-3 w-px -translate-x-1/2"
        />
      )}

      <button
        type="button"
        disabled={isDisabled}
        aria-expanded={isActive}
        aria-controls={panelId}
        onClick={() => onStepClick(index)}
        className={cn(
          "z-10 flex cursor-pointer items-center gap-2 self-start rounded-lg py-2 pe-2 text-left outline-none",
          "focus-visible:ring-cm-outline-focus/50 focus-visible:ring-[3px]",
          "disabled:cursor-default disabled:opacity-50",
        )}
      >
        <span
          className={cn(
            "text-cm-label-small flex size-6 shrink-0 items-center justify-center rounded-full",
            isComplete
              ? "bg-cm-status-success text-cm-on-primary"
              : isActive
                ? "bg-cm-primary text-cm-on-primary"
                : "bg-cm-container text-cm-on-surface-variant",
          )}
        >
          {isComplete ? <Check aria-hidden className="size-4" /> : index + 1}
        </span>
        <span className="flex flex-col">
          <span className="text-cm-label-large text-cm-on-surface">
            {title}
            {optional && (
              <span className="text-cm-body-small text-cm-on-surface-variant ms-1 italic">
                (optional)
              </span>
            )}
          </span>
          {description && (
            <span className="text-cm-body-small text-cm-on-surface-variant">
              {description}
            </span>
          )}
        </span>
      </button>

      {isActive && (
        <div id={panelId} className="ms-8 mt-2 flex flex-col gap-4">
          {children}
        </div>
      )}
    </div>
  );
}

export { Stepper, StepperStep };
