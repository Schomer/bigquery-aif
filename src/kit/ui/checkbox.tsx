"use client";

import * as React from "react";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { Check, Remove } from "./material-symbols";
import { cn } from "./utils";

/**
 * A box the user ticks, with its label — and, if it needs one, a line of
 * supporting text under that label.
 *
 *     <div className="flex items-start gap-3">
 *       <Checkbox id="expiry" />
 *       <div className="flex flex-col">
 *         <CheckboxLabel htmlFor="expiry">Enable table expiration</CheckboxLabel>
 *         <CheckboxHint>Tables are deleted after the default expiry.</CheckboxHint>
 *       </div>
 *     </div>
 *
 * `CheckboxHint` is optional and most checkboxes do not have one — a label that
 * says what ticking the box does needs no second sentence. Leave it out and the
 * row is just the box and its label:
 *
 *     <div className="flex items-center gap-3">
 *       <Checkbox id="cmek" />
 *       <CheckboxLabel htmlFor="cmek">Use a customer-managed key</CheckboxLabel>
 *     </div>
 *
 * Note `items-start` in the first and `items-center` in the second: with a hint
 * the box lines up with the first line of text, without one it centres on the
 * single line.
 *
 * ### The label and the hint share a left edge
 *
 * They go in one `flex-col` beside the box, and neither carries an indent of
 * its own. The hint is a continuation of the label, so it starts where the
 * label starts; anything else puts a step in the left margin of a settings
 * page, which is the one place a reader is scanning straight down.
 *
 * The box is the only thing outside that column, and the 12px gap is what
 * separates the control from the text.
 */

function Checkbox({
  className,
  ...props
}: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        "peer size-[18px] shrink-0 rounded-[2px] border-2 border-cm-outline bg-transparent transition-colors outline-none cursor-pointer",
        "hover:border-cm-primary focus-visible:ring-4 focus-visible:ring-cm-primary/20 focus-visible:border-cm-primary",
        "data-[state=checked]:bg-cm-primary data-[state=checked]:border-cm-primary data-[state=checked]:text-cm-on-primary",
        "data-[state=indeterminate]:bg-cm-primary data-[state=indeterminate]:border-cm-primary data-[state=indeterminate]:text-cm-on-primary",
        "disabled:cursor-not-allowed disabled:border-cm-on-surface/38 disabled:opacity-50 disabled:data-[state=checked]:bg-cm-on-surface/38 disabled:data-[state=checked]:border-transparent disabled:data-[state=indeterminate]:bg-cm-on-surface/38",
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className="flex items-center justify-center text-cm-on-primary size-full"
      >
        <Check weight={700} className="size-3.5 [[data-state=indeterminate]>&]:hidden" />
        <Remove weight={700} className="size-3.5 [[data-state=checked]>&]:hidden" />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}

function CheckboxLabel({
  className,
  ...props
}: React.ComponentProps<"label">) {
  return (
    <label
      data-slot="checkbox-label"
      className={cn(
        "text-cm-body-medium text-cm-on-surface cursor-pointer select-none peer-disabled:cursor-not-allowed peer-disabled:text-cm-on-surface/38",
        className
      )}
      {...props}
    />
  );
}

/**
 * Optional supporting text under the label. No indent of its own — see above.
 */
function CheckboxHint({
  className,
  ...props
}: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="checkbox-hint"
      className={cn(
        "text-cm-body-small text-cm-on-surface-variant-low",
        className
      )}
      {...props}
    />
  );
}

export { Checkbox, CheckboxLabel, CheckboxHint };
