import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "./utils";

/**
 * A tag is a read-only label attached to a thing — a facet on a dataset, a
 * severity on a row, a category on a saved query. It has no state and nothing
 * to press.
 *
 * That is what separates it from its neighbours:
 *   Tag    static; describes the thing it sits on
 *   Chip   interactive; the user selects, dismisses or invokes it
 *   Button an action
 *
 * The five themes are containers from the palette, all sharing one text
 * colour. They carry meaning, not decoration — `warning` on something that is
 * merely uncommon reads as a defect. When nothing is being signalled, the
 * `default` theme is the right answer.
 */
const tagVariants = cva(
  cn(
    "inline-flex h-5 w-fit shrink-0 items-center justify-center gap-1 rounded-full px-2.5",
    "text-cm-body-small whitespace-nowrap text-cm-on-surface",
    "[&>svg]:size-3 [&>svg]:shrink-0 [&>svg]:pointer-events-none",
  ),
  {
    variants: {
      theme: {
        default: "bg-cm-container-high",
        primary: "bg-cm-container-primary",
        success: "bg-cm-status-success-container",
        warning: "bg-cm-status-warning-container",
        "danger-soft": "bg-cm-status-error-container",
      },
    },
    defaultVariants: {
      theme: "default",
    },
  },
);

export interface TagProps
  extends React.ComponentProps<"span">,
    VariantProps<typeof tagVariants> {
  asChild?: boolean;
}

function Tag({ className, theme, asChild = false, ...props }: TagProps) {
  const Comp = asChild ? Slot : "span";

  return (
    <Comp
      data-slot="tag"
      data-theme={theme ?? "default"}
      className={cn(tagVariants({ theme }), className)}
      {...props}
    />
  );
}

export { Tag, tagVariants };
