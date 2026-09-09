"use client";

import * as React from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";

import {
  Callout,
  CalloutActions,
  CalloutButton,
  CalloutContent,
  CalloutDescription,
  CalloutFooter,
  CalloutSteps,
  CalloutTitle,
} from "./callout";
import { cn } from "./utils";

/**
 * CalloutTour — a sequence of callouts that walks the reader around a page.
 *
 *     <CalloutTour
 *       open={tourOpen}
 *       onOpenChange={setTourOpen}
 *       steps={[
 *         { target: "project-picker", title: "Pick a project", description: "…" },
 *         { target: "search-box", title: "Search anything", description: "…", side: "bottom" },
 *         { target: "help-menu", title: "Get help", description: "…", side: "left" },
 *       ]}
 *     />
 *
 * One `Callout` is a single "here is the new thing" pointer, attached to the
 * element that triggered it. A tour is the other shape: several of them in
 * order, none of them attached to a trigger, each pointing at whatever part of
 * the page the current step is about. So the two are the same surface with a
 * different driver, and this component is that driver — it owns the step
 * index, the Back/Next pair and the counter, and hands the rest to `Callout`.
 *
 *   Callout      one message, anchored to its own trigger. The reader opened it.
 *   CalloutTour  n messages, anchored anywhere by id. The product opened it.
 *   RichTooltip  hover, no dismissal, no state. Not an announcement.
 *   HelpButton   the reader asks. A tour tells.
 *
 * ### Steps point at ids, not at children
 *
 * A tour's targets are scattered across a page — the top nav, a table toolbar,
 * a button three components deep — and nothing sensible can wrap all of them.
 * Each step therefore names a `target` id and the tour finds it with
 * `getElementById` at the moment that step opens. A step whose target is not on
 * the page still shows: the callout centres itself and the highlight goes away,
 * because a tour that silently skips the step about the thing you cannot find
 * is worse than one that explains it in the middle of the screen.
 *
 * ### The highlight is the anchor
 *
 * The dimmed page is one element: a box laid over the target with a 9999px
 * spread shadow, which paints everything outside itself and nothing inside.
 * That same box is the callout's Radix anchor, so the pointer lands on the
 * highlight rather than near it, and both follow the target through a scroll
 * with one measurement instead of two.
 *
 * The scrim is `black/20` — the kit's one deliberate non-token colour, shared
 * with `Dialog` and `Subtask`. See the note on `DialogOverlay`. It is a shadow
 * and not an element, so it does not swallow clicks: the page underneath stays
 * live, which is the difference between a tour and a modal.
 */

export interface CalloutTourStep {
  /** `id` of the element this step is about. Looked up when the step opens. */
  target: string;
  title?: React.ReactNode;
  description?: React.ReactNode;
  /** Which side of the target the callout sits on. */
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
}

export interface CalloutTourProps {
  steps: CalloutTourStep[];
  /** Whether the tour is running. Uncontrolled if omitted. */
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** The step on screen, zero-based. Uncontrolled if omitted. */
  step?: number;
  defaultStep?: number;
  onStepChange?: (index: number, previousIndex: number) => void;
  /** Fired once, when the reader reaches the end or dismisses the tour. */
  onFinish?: () => void;
  /** Dim the rest of the page. */
  showScrim?: boolean;
  /** Scroll each step's target into view as it opens. */
  scrollTargetIntoView?: boolean;
  backLabel?: string;
  nextLabel?: string;
  finishLabel?: string;
  /** Extra classes for the callout surface. */
  className?: string;
}

/** Breathing room between the target's edge and the highlight's. */
const HIGHLIGHT_PADDING = 4;

interface Box {
  top: number;
  left: number;
  width: number;
  height: number;
}

function sameBox(a: Box | null, b: Box | null) {
  if (!a || !b) return a === b;
  return a.top === b.top && a.left === b.left && a.width === b.width && a.height === b.height;
}

function CalloutTour({
  steps,
  open,
  defaultOpen = false,
  onOpenChange,
  step,
  defaultStep = 0,
  onStepChange,
  onFinish,
  showScrim = true,
  scrollTargetIntoView = true,
  backLabel = "Back",
  nextLabel = "Next",
  finishLabel = "Finish",
  className,
}: CalloutTourProps) {
  const [openUncontrolled, setOpenUncontrolled] = React.useState(defaultOpen);
  const [stepUncontrolled, setStepUncontrolled] = React.useState(defaultStep);
  const [box, setBox] = React.useState<Box | null>(null);

  const isOpen = open ?? openUncontrolled;
  const index = step ?? stepUncontrolled;
  const current = steps[index];
  const isFirst = index === 0;
  const isLast = index === steps.length - 1;

  const goTo = (next: number) => {
    if (next < 0 || next >= steps.length || next === index) return;
    if (step === undefined) setStepUncontrolled(next);
    onStepChange?.(next, index);
  };

  const setOpen = (next: boolean) => {
    if (open === undefined) setOpenUncontrolled(next);
    onOpenChange?.(next);
  };

  const finish = () => {
    setOpen(false);
    // The index resets so a tour reopened from the same button starts at one.
    // A controlled `step` is the caller's to reset — silently writing to their
    // state on close is how a tour ends up fighting its own props.
    if (step === undefined) setStepUncontrolled(0);
    onFinish?.();
  };

  const target = current?.target;

  React.useEffect(() => {
    if (!isOpen || !target) {
      setBox(null);
      return;
    }

    const element = document.getElementById(target);
    if (!element) {
      setBox(null);
      return;
    }

    // The box is compared before it is set: `measure` runs on every scroll
    // event of every scrollable ancestor, and a fresh object each time would
    // re-render the whole tour sixty times a second while nothing moved.
    const measure = () => {
      const rect = element.getBoundingClientRect();
      const next = {
        top: rect.top - HIGHLIGHT_PADDING,
        left: rect.left - HIGHLIGHT_PADDING,
        width: rect.width + HIGHLIGHT_PADDING * 2,
        height: rect.height + HIGHLIGHT_PADDING * 2,
      };
      setBox((previous) => (sameBox(previous, next) ? previous : next));
    };

    measure();
    if (scrollTargetIntoView) {
      element.scrollIntoView({ block: "center", inline: "nearest", behavior: "smooth" });
    }

    const observer = new ResizeObserver(measure);
    observer.observe(element);
    // Capture phase, because the target may sit inside a scrolling panel that
    // does not bubble its scroll event to the window.
    window.addEventListener("scroll", measure, true);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", measure, true);
      window.removeEventListener("resize", measure);
    };
  }, [isOpen, target, scrollTargetIntoView]);

  if (steps.length === 0 || !current) return null;

  return (
    <Callout
      open={isOpen}
      onOpenChange={(next) => {
        // Radix reports the close — escape, outside click, the X — and every
        // one of them means the same thing here: the reader is done.
        if (!next) finish();
        else setOpen(true);
      }}
    >
      <PopoverPrimitive.Anchor asChild>
        <div
          data-slot="callout-tour-highlight"
          aria-hidden
          style={
            box
              ? { top: box.top, left: box.left, width: box.width, height: box.height }
              : // No target on the page: a zero-size anchor in the middle of the
                // viewport, which puts the callout where a dialog would be.
                { top: "50%", left: "50%", width: 0, height: 0 }
          }
          className={cn(
            "pointer-events-none fixed z-[998] rounded-[4px] transition-all duration-300",
            showScrim && box
              ? "shadow-[0_0_0_9999px] shadow-black/20 opacity-100"
              : "opacity-0",
          )}
        />
      </PopoverPrimitive.Anchor>

      <CalloutContent
        side={current.side ?? "bottom"}
        align={current.align ?? "center"}
        collisionPadding={16}
        className={className}
      >
        {current.title && <CalloutTitle>{current.title}</CalloutTitle>}
        {current.description && <CalloutDescription>{current.description}</CalloutDescription>}
        <CalloutFooter>
          <CalloutSteps className="text-cm-label-small text-cm-on-primary/80">
            {index + 1}/{steps.length}
          </CalloutSteps>
          <CalloutActions>
            {/*
              Back stays on screen and goes disabled on the first step rather
              than appearing at step two: the pair of buttons is where the
              reader's pointer already is, and moving Next sideways under it
              between steps one and two is how a tour gets clicked twice.
            */}
            <CalloutButton
              // Transparent rather than borderless: the border still occupies
              // its pixel, so Back and Next keep the same height and the same
              // baseline whether or not the outline is drawn.
              className="border-transparent"
              disabled={isFirst}
              onClick={() => goTo(index - 1)}
            >
              {backLabel}
            </CalloutButton>
            <CalloutButton onClick={() => (isLast ? finish() : goTo(index + 1))}>
              {isLast ? finishLabel : nextLabel}
            </CalloutButton>
          </CalloutActions>
        </CalloutFooter>
      </CalloutContent>
    </Callout>
  );
}

export { CalloutTour };
