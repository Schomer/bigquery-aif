"use client";

import * as React from "react";
import * as ToggleGroupPrimitive from "@radix-ui/react-toggle-group";
import { type VariantProps } from "class-variance-authority";

import { cn } from "./utils";
import { toggleVariants } from "./toggle";

/**
 * ToggleGroup — toggles welded into one segmented control, single- or
 * multi-select.
 *
 * Two details carry the whole look. First, items overlap by a pixel
 * (`-ml-px`), so the seam between two neighbours is one hairline rather than
 * two stacked ones — that is what keeps a four-item group looking like one
 * object instead of four buttons pushed together.
 *
 * Second, a selected item darkens its border to `primary-on-container` and
 * lifts itself with `z-10`, so the accent wins the overlap on both sides and
 * the selection is drawn as a closed shape. This is where a grouped item
 * departs from a lone `Toggle`, whose on-state border stays hairline: inside a
 * group, the border has neighbours to separate itself from, and the spec asks
 * it to do that work.
 *
 * A segmented control is naturally as wide as its labels, which means it will
 * happily grow past whatever is holding it. `max-w-full` and truncating labels
 * cap that: past the container's width the items give up room evenly and
 * ellipsize rather than spilling out of the card.
 */
const ToggleGroupContext = React.createContext<
  VariantProps<typeof toggleVariants>
>({
  size: "default",
  variant: "default",
});

function ToggleGroup({
  className,
  variant,
  size,
  children,
  ...props
}: React.ComponentProps<typeof ToggleGroupPrimitive.Root> &
  VariantProps<typeof toggleVariants>) {
  return (
    <ToggleGroupPrimitive.Root
      data-slot="toggle-group"
      data-variant={variant}
      data-size={size}
      className={cn(
        "group/toggle-group inline-flex w-fit max-w-full items-center rounded-lg",
        className,
      )}
      {...props}
    >
      <ToggleGroupContext.Provider value={{ variant, size }}>
        {children}
      </ToggleGroupContext.Provider>
    </ToggleGroupPrimitive.Root>
  );
}

function ToggleGroupItem({
  className,
  children,
  variant,
  size,
  ...props
}: React.ComponentProps<typeof ToggleGroupPrimitive.Item> &
  VariantProps<typeof toggleVariants>) {
  const context = React.useContext(ToggleGroupContext);

  return (
    <ToggleGroupPrimitive.Item
      data-slot="toggle-group-item"
      data-variant={context.variant || variant}
      data-size={context.size || size}
      className={cn(
        toggleVariants({
          variant: context.variant || variant,
          size: context.size || size,
        }),
        // Only the two ends are round; the seams are square.
        "relative rounded-none first:rounded-l-lg last:rounded-r-lg",
        // Collapse each seam to a single hairline.
        "-ml-px first:ml-0",
        // `min-w-0` overrides the flex default of `min-width: auto`, which
        // would otherwise pin every item at its label's width and force the
        // group to overflow its container instead of shrinking.
        "min-w-0",
        // Whatever the eye should be reading — the selection, the focused
        // item — owns the overlap.
        "data-[state=on]:z-10 data-[state=on]:border-cm-primary-on-container",
        "focus-visible:z-10",
        className,
      )}
      {...props}
    >
      {/* Ellipsis needs a block-ish box of its own — `text-overflow` does
          nothing on the flex container the item itself is. */}
      <span className="min-w-0 truncate">{children}</span>
    </ToggleGroupPrimitive.Item>
  );
}

export { ToggleGroup, ToggleGroupItem };
