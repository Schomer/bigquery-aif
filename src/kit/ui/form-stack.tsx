"use client";

import * as React from "react";

import { Button } from "./button";
import { HelpButton } from "./help-button";
import { Add, ArrowDownward, ArrowUpward, Delete } from "./material-symbols";
import { Message, MessageContent, MessageIcon } from "./message";
import { cn } from "./utils";

/**
 * FormStack — a repeating row of fields, with add, remove and reorder.
 *
 * Labels on a resource, environment variables on a service, rules in a policy:
 * anywhere a form asks for "as many of these as you like". Each entry is one
 * row of controls with its own buttons at the trailing edge.
 *
 *     <FormStack
 *       title="Labels"
 *       rowLabel="Label"
 *       items={labels}
 *       onItemsChange={setLabels}
 *       newItem={() => ({ key: "", value: "" })}
 *       renderRow={(label, index, update) => (
 *         <>
 *           <Input label="Key" value={label.key} onChange={(e) => update({ key: e.target.value })} />
 *           <Input label="Value" value={label.value} onChange={(e) => update({ value: e.target.value })} />
 *         </>
 *       )}
 *     />
 *
 * ### Why a render prop and not a field schema
 *
 * CDS describes the row with a `fields` array of `{type: 'text' | 'select' |
 * 'checkbox'}` and builds the controls itself. That is the right call for a
 * component that has to be driven from JSON, and the wrong one here: the kit
 * already has `Input`, `SelectField`, `Checkbox` and `Slider`, and a schema
 * would be a second, worse way to reach them that supports four of the twenty
 * things they can do. `renderRow` gets the real components.
 *
 * ### The state lives with the caller
 *
 * `items` and `onItemsChange` — no internal copy, no defaults. A repeating
 * field is part of a form's value, and a component that quietly kept its own
 * array would be the second source of truth in every submit handler.
 *
 * ### `minSize` disables removal rather than hiding it
 *
 * At the floor, the delete buttons go disabled and stay visible. Removing them
 * makes the row look different for a reason the reader cannot see; a disabled
 * button with the message underneath says what the rule is.
 */

export interface FormStackProps<T> extends Omit<React.ComponentProps<"div">, "title"> {
  title?: React.ReactNode;
  description?: React.ReactNode;
  /** Explains the whole group — renders a `HelpButton` beside the title. */
  help?: React.ReactNode;
  /** The singular noun for one row: "Label", "Rule". Used in button names. */
  rowLabel?: string;
  items: T[];
  onItemsChange: (items: T[]) => void;
  /** Builds a blank row. A function, so each row gets its own object. */
  newItem: () => T;
  /**
   * The controls for one row. `update` merges a patch into that row, so a
   * caller writes `update({ key: next })` rather than rebuilding the array.
   */
  renderRow: (item: T, index: number, update: (patch: Partial<T>) => void) => React.ReactNode;
  minSize?: number;
  maxSize?: number;
  /** Shown when `items.length` is below `minSize`. */
  minSizeMessage?: React.ReactNode;
  addLabel?: string;
  /** Adds up/down buttons to every row. */
  enableReorder?: boolean;
}

function FormStack<T>({
  className,
  title,
  description,
  help,
  rowLabel = "item",
  items,
  onItemsChange,
  newItem,
  renderRow,
  minSize = 0,
  maxSize = Infinity,
  minSizeMessage,
  addLabel,
  enableReorder = false,
  ...props
}: FormStackProps<T>) {
  const atFloor = items.length <= minSize;
  const atCeiling = items.length >= maxSize;

  const update = (index: number, patch: Partial<T>) =>
    onItemsChange(items.map((item, i) => (i === index ? { ...item, ...patch } : item)));

  const remove = (index: number) => onItemsChange(items.filter((_, i) => i !== index));

  const move = (index: number, delta: -1 | 1) => {
    const target = index + delta;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    [next[index], next[target]] = [next[target], next[index]];
    onItemsChange(next);
  };

  return (
    <div
      data-slot="form-stack"
      className={cn("flex w-full flex-col gap-4", className)}
      {...props}
    >
      {(title || description) && (
        <div className="flex flex-col gap-1">
          {title && (
            <div className="flex items-center gap-1.5">
              <h3 className="text-cm-title-medium text-cm-on-surface">{title}</h3>
              {help && <HelpButton label={`About ${rowLabel}s`}>{help}</HelpButton>}
            </div>
          )}
          {description && (
            <p className="text-cm-body-medium text-cm-on-surface-variant">{description}</p>
          )}
        </div>
      )}

      <div className="flex flex-col gap-4">
        {items.map((item, index) => (
          // Index keys: a row has no id of its own — the caller's shape is
          // whatever it is — and reordering swaps the *contents*, so the row at
          // position two is genuinely the same row before and after.
          <div key={index} className="flex w-full items-start gap-2">
            <div className="flex flex-1 flex-wrap items-start gap-2">
              {renderRow(item, index, (patch) => update(index, patch))}
            </div>
            <div className="flex shrink-0 items-center gap-1 pt-1">
              {enableReorder && (
                <>
                  <Button
                    variant="text"
                    size="icon"
                    aria-label={`Move ${rowLabel} ${index + 1} up`}
                    disabled={index === 0}
                    onClick={() => move(index, -1)}
                  >
                    <ArrowUpward aria-hidden className="size-[18px]" />
                  </Button>
                  <Button
                    variant="text"
                    size="icon"
                    aria-label={`Move ${rowLabel} ${index + 1} down`}
                    disabled={index === items.length - 1}
                    onClick={() => move(index, 1)}
                  >
                    <ArrowDownward aria-hidden className="size-[18px]" />
                  </Button>
                </>
              )}
              <Button
                variant="text"
                size="icon"
                aria-label={`Remove ${rowLabel} ${index + 1}`}
                disabled={atFloor}
                onClick={() => remove(index)}
              >
                <Delete aria-hidden className="size-[18px]" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      {minSizeMessage && items.length < minSize && (
        <Message severity="error">
          <MessageIcon />
          <MessageContent>{minSizeMessage}</MessageContent>
        </Message>
      )}

      <Button
        variant="text"
        disabled={atCeiling}
        onClick={() => onItemsChange([...items, newItem()])}
        className="self-start"
      >
        <Add aria-hidden className="size-[18px]" />
        {addLabel ?? `Add ${rowLabel}`}
      </Button>
    </div>
  );
}

export { FormStack };
