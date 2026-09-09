"use client";

import * as React from "react";
import * as TogglePrimitive from "@radix-ui/react-toggle";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "./utils";

/**
 * Toggle — a button that stays pressed. Unlike SlideToggle it reads as a tool
 * ("this view is on"), not a setting.
 *
 * The measurements come from the Cloud toggle spec and are exact: a 34px outer
 * height (32px of content inside a 1px border), a 10px radius, and 12px of
 * horizontal padding. Off is an outlined shape with no fill; on is
 * `selection-container` behind `primary-on-container` text — the same pair the
 * rest of the system uses to mean "chosen".
 *
 * Note the off-state text is `on-surface-variant`, not `on-surface`. In a group
 * of four, that contrast step is what lets the selected one read as selected
 * from across the room, before you have parsed a single label.
 */
const toggleVariants = cva(
  cn(
    "inline-flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer select-none",
    "border text-cm-label-medium",
    "[&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 [&_svg]:shrink-0",
    "outline-none transition-colors",
    // Off: an outline and nothing else, so the shape belongs to whatever
    // surface it is sitting on.
    "border-cm-hairline bg-transparent text-cm-on-surface-variant",
    "hover:bg-cm-container",
    // On: the selection pair. The border stays hairline for a lone toggle — it
    // has no neighbours to separate itself from, so the fill is already doing
    // all the work. (A grouped item does darken its border; see toggle-group.)
    "data-[state=on]:bg-cm-selection-container data-[state=on]:text-cm-primary-on-container",
    "data-[state=on]:hover:bg-cm-selection-container",
    "focus-visible:ring-4 focus-visible:ring-cm-primary/20 focus-visible:border-cm-primary",
    // The pressed colours need the two-modifier form to beat data-[state=on],
    // which otherwise ties on specificity and leaves a disabled toggle looking
    // active.
    "disabled:pointer-events-none disabled:text-cm-on-surface/38 disabled:border-cm-on-surface/12",
    "disabled:data-[state=on]:bg-cm-on-surface/12 disabled:data-[state=on]:text-cm-on-surface/38",
    "aria-invalid:border-cm-status-error aria-invalid:ring-cm-status-error/20",
  ),
  {
    variants: {
      variant: {
        default: "",
        /**
         * No border — for a toggle inside a toolbar, where the surrounding
         * chrome already draws the boundaries. The spec's icon toggle is this
         * variant at `size="icon"`.
         */
        ghost: "border-transparent disabled:border-transparent",
      },
      size: {
        sm: "h-8 rounded-lg px-2.5",
        default: "h-[34px] rounded-lg px-3",
        lg: "h-10 rounded-lg px-4",
        /**
         * A 40px circle. The glyph goes up to 20px because it has no label to
         * share the room with.
         */
        icon: "size-10 rounded-full p-0 [&_svg:not([class*='size-'])]:size-5",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Toggle({
  className,
  variant,
  size,
  ...props
}: React.ComponentProps<typeof TogglePrimitive.Root> &
  VariantProps<typeof toggleVariants>) {
  return (
    <TogglePrimitive.Root
      data-slot="toggle"
      className={cn(toggleVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Toggle, toggleVariants };
