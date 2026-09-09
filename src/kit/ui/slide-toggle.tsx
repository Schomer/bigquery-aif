"use client";

import * as React from "react";
import * as SwitchPrimitive from "@radix-ui/react-switch";
import { Check, Remove } from "./material-symbols";

import { cn } from "./utils";

/**
 * Slide toggle — a binary control for settings that apply immediately, as
 * opposed to Toggle, which is a pressable button that holds a chosen state.
 *
 * Geometry and colour are taken from the Cloud slide toggle spec: a 36x14
 * track with a 20px thumb that overhangs it, carrying a dash when off and a
 * check when on. Every value below resolves to a cm token — the off track is
 * `container` over an `outline` edge, the on track is `primary-inverse` under
 * a `primary` thumb.
 *
 * Built on Radix's Switch primitive, so the props are Radix's (`checked`,
 * `onCheckedChange`, `disabled`); only the name we expose is ours.
 */
function SlideToggle({
  className,
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      data-slot="slide-toggle"
      className={cn(
        // The thumb is 20px on a 14px track, so it hangs 3px past each edge.
        // The margin reserves that space, which keeps the control inside a
        // 20px line box and level with the first line of a label that wraps.
        "group peer relative inline-flex h-3.5 w-9 my-[3px] shrink-0 items-center",
        "rounded-full border transition-colors outline-none cursor-pointer",
        "data-[state=unchecked]:bg-cm-container data-[state=unchecked]:border-cm-outline",
        "data-[state=checked]:bg-cm-primary-inverse data-[state=checked]:border-cm-primary",
        // Disabled has to name the state as well. A single `disabled:` ties
        // with `data-[state=…]:` on specificity, and a tie leaves a disabled
        // control painted in its live colours.
        "disabled:cursor-not-allowed",
        "disabled:data-[state=unchecked]:bg-cm-on-surface/12 disabled:data-[state=unchecked]:border-cm-on-surface/30",
        "disabled:data-[state=checked]:bg-cm-on-surface/12 disabled:data-[state=checked]:border-cm-on-surface/30",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="slide-toggle-thumb"
        className={cn(
          "pointer-events-none flex size-5 items-center justify-center rounded-full transition-transform",
          // The track's 1px border insets its content box, which would leave the
          // thumb a pixel short of the left end and a pixel past the right one.
          // Pulling it back by that pixel makes 16px of travel land flush with
          // both ends of the 36px track.
          "-ml-px",
          "data-[state=unchecked]:translate-x-0 data-[state=checked]:translate-x-4",
          // The dash sits at reduced emphasis so off reads as quieter than on,
          // where the check is full-strength white.
          "data-[state=unchecked]:bg-cm-on-surface data-[state=unchecked]:text-cm-on-primary/70",
          "data-[state=checked]:bg-cm-primary data-[state=checked]:text-cm-on-primary",
          // Disabled is on-surface at 38%, but flattened against the surface
          // rather than left translucent: the thumb sits on top of the track, so
          // a see-through circle shows the track and its border straight through
          // itself. color-mix keeps the value derived from the tokens instead of
          // hard-coding the blend.
          "data-[disabled]:data-[state=unchecked]:bg-[color-mix(in_srgb,var(--cm-sys-color-on-surface)_38%,var(--cm-sys-color-surface))] data-[disabled]:data-[state=unchecked]:text-cm-on-primary/30",
          "data-[disabled]:data-[state=checked]:bg-[color-mix(in_srgb,var(--cm-sys-color-on-surface)_38%,var(--cm-sys-color-surface))] data-[disabled]:data-[state=checked]:text-cm-on-primary/30",
          // The ring belongs on the thumb, not the track: the thumb is the part
          // that moves and the part that overhangs, so a ring on the 14px track
          // would sit behind it.
          "group-focus-visible:ring-4 group-focus-visible:ring-cm-primary/20",
        )}
      >
        <Check
          weight={700}
          className="size-[18px] [[data-state=unchecked]>&]:hidden"
          aria-hidden
        />
        <Remove
          weight={700}
          className="size-5 [[data-state=checked]>&]:hidden"
          aria-hidden
        />
      </SwitchPrimitive.Thumb>
    </SwitchPrimitive.Root>
  );
}

/** Row label, sitting to the right of the control. */
function SlideToggleLabel({ className, ...props }: React.ComponentProps<"label">) {
  return (
    <label
      data-slot="slide-toggle-label"
      className={cn(
        // The label keeps full-strength on-surface even when the control is
        // disabled, per the reference: the control shows it is locked, and
        // dimming the text as well only makes the row harder to read.
        "text-cm-body-medium text-cm-on-surface cursor-pointer select-none",
        "peer-disabled:cursor-not-allowed",
        className,
      )}
      {...props}
    />
  );
}

/**
 * Optional supportive text under the label, sharing its left edge — the two go
 * in one `flex-col` beside the control, and neither indents itself. Same rule
 * as `CheckboxHint`, and for the same reason: the hint continues the label, so
 * a step between them puts a kink in the left margin of a settings page.
 */
function SlideToggleHint({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="slide-toggle-hint"
      className={cn(
        "text-cm-body-small text-cm-on-surface-variant",
        className,
      )}
      {...props}
    />
  );
}

export { SlideToggle, SlideToggleLabel, SlideToggleHint };
