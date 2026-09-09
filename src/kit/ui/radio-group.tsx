"use client";

import * as React from "react";
import * as RadioGroupPrimitive from "@radix-ui/react-radio-group";

import { cn } from "./utils";

/**
 * One of a short, visible list. More than about five options wants a `Select`.
 *
 *   <RadioGroup value={access} onValueChange={setAccess}>
 *     <RadioGroupLabel>Access level</RadioGroupLabel>
 *     <RadioGroupItem value="viewer">Viewer</RadioGroupItem>
 *     <RadioGroupItem value="editor" hint="Can change data, not permissions.">
 *       Editor
 *     </RadioGroupItem>
 *     <RadioGroupItem value="owner" disabled>Owner</RadioGroupItem>
 *   </RadioGroup>
 *
 * ### Why the label is a prop here and a component next door
 *
 * `Checkbox` hands you the box and lets you place `CheckboxLabel` yourself,
 * because a checkbox turns up alone — in a table header, a toolbar, a row of a
 * list — and the thing it is attached to is different every time. A radio only
 * ever exists as one of a stack of identical rows, so the row is part of the
 * component: `RadioGroupItem` renders the ring, the label and the hint, and
 * there is no way to assemble them wrongly.
 *
 * What that buys, specifically: the ring is 20px and the label's line-height is
 * 20px, so they align on the first line — and stay aligned with the *first*
 * line when a long label wraps, instead of drifting to the middle of the block
 * the way `items-center` would. A hint hangs off the label rather than off the
 * ring. Disabled dims the ring, the label and the hint together.
 *
 * ### The dimensions, from the reference
 *
 * 20px ring, 2px stroke, 10px dot. `on-surface-variant` unselected, `primary`
 * selected, `on-surface/38` disabled — the same 38% the rest of the kit uses
 * for a control you cannot touch. 8px from ring to label, 10px between rows.
 */

const RadioGroupLabelIdContext = React.createContext<string | undefined>(
  undefined,
);

function RadioGroup({
  className,
  ...props
}: React.ComponentProps<typeof RadioGroupPrimitive.Root>) {
  const labelId = React.useId();

  return (
    <RadioGroupLabelIdContext.Provider value={labelId}>
      <RadioGroupPrimitive.Root
        data-slot="radio-group"
        // Pointed at the group's label whether or not one is rendered. A
        // dangling idref names nothing, which is the state a group with no
        // label is in anyway.
        aria-labelledby={labelId}
        className={cn("flex flex-col gap-2.5", className)}
        {...props}
      />
    </RadioGroupLabelIdContext.Provider>
  );
}

/** The question the options answer. Goes first, inside the group. */
function RadioGroupLabel({ className, ...props }: React.ComponentProps<"div">) {
  const id = React.useContext(RadioGroupLabelIdContext);

  return (
    <div
      data-slot="radio-group-label"
      id={id}
      // `label-medium` is `body-medium` at weight 500: the question sits above
      // its answers at the same size, told apart by weight rather than by
      // being larger than the thing it introduces.
      className={cn("text-cm-label-medium text-cm-on-surface", className)}
      {...props}
    />
  );
}

function RadioGroupItem({
  className,
  children,
  hint,
  id,
  ...props
}: React.ComponentProps<typeof RadioGroupPrimitive.Item> & {
  /** A line under the label saying what the option means. */
  hint?: React.ReactNode;
}) {
  const generated = React.useId();
  const itemId = id ?? generated;

  return (
    // `group/radio` rather than `peer-disabled`, because the label sits inside
    // the text column and so is not a sibling of the ring. `has-[:disabled]`
    // on the row reaches it wherever it is.
    <div
      data-slot="radio-group-row"
      className={cn("group/radio flex items-start gap-2", className)}
    >
      <RadioGroupPrimitive.Item
        data-slot="radio-group-item"
        id={itemId}
        className="border-cm-on-surface-variant hover:border-cm-primary focus-visible:ring-cm-primary/20 focus-visible:border-cm-primary data-[state=checked]:border-cm-primary disabled:border-cm-on-surface/38 disabled:hover:border-cm-on-surface/38 size-5 shrink-0 cursor-pointer rounded-full border-2 bg-transparent outline-none transition-colors focus-visible:ring-4 disabled:cursor-not-allowed"
        {...props}
      >
        <RadioGroupPrimitive.Indicator
          data-slot="radio-group-indicator"
          className="flex size-full items-center justify-center"
        >
          {/* A filled 10px box rather than a `Circle` glyph: at this size most
              of the icon is the padding inside its own viewBox, and the number
              that has to be right is the diameter. */}
          <span className="bg-cm-primary group-has-[:disabled]/radio:bg-cm-on-surface/38 size-2.5 rounded-full" />
        </RadioGroupPrimitive.Indicator>
      </RadioGroupPrimitive.Item>

      {(children || hint) && (
        <div className="flex min-w-0 flex-col">
          <label
            data-slot="radio-group-item-label"
            htmlFor={itemId}
            className="text-cm-body-medium text-cm-on-surface group-has-[:disabled]/radio:text-cm-on-surface/38 cursor-pointer select-none group-has-[:disabled]/radio:cursor-not-allowed"
          >
            {children}
          </label>
          {hint && (
            <p
              data-slot="radio-group-item-hint"
              className="text-cm-body-small text-cm-on-surface-variant group-has-[:disabled]/radio:text-cm-on-surface/38"
            >
              {hint}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export { RadioGroup, RadioGroupLabel, RadioGroupItem };
