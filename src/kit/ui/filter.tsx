"use client";

import * as React from "react";

import { Chip } from "./chip";
import { HelpButton } from "./help-button";
import { FilterList } from "./material-symbols";
import { cn } from "./utils";

/**
 * Filter — the console's filter bar. A `filter_list` mark, the word "Filter",
 * and a field that runs the width of the table.
 *
 * This is the strip that sits between a table's title and its header row on
 * every list page in the console. It is not `Input` with a placeholder: the
 * mark and the standing label are what make it recognisable as *the* filter
 * across a hundred different tables, and the field inside has no border of its
 * own because the bar's own rules already draw the box.
 *
 * ### The syntax is the feature
 *
 * Console filters take `property : value` and `OR`, which nobody guesses. Set
 * `showSyntaxHelp` and a help button appears at the trailing edge explaining
 * it with worked examples. It is off by default because a filter that only
 * ever matches plain text has no syntax to explain.
 *
 * ### It is a text input, not a combobox
 *
 * Chips for applied filters go *above* it, in `FilterChips`, rather than inside
 * the field. Chips inside an input make the caret jump around them and turn
 * Backspace into a delete-the-last-filter gesture that nothing announces.
 */

export interface FilterProps extends Omit<React.ComponentProps<"div">, "onChange"> {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  /** Drops the top and bottom rules — for a bar already inside a bordered frame. */
  noBorders?: boolean;
  /** Adds the help button that explains `property : value` and `OR`. */
  showSyntaxHelp?: boolean;
  /** Trailing content — a column chooser, a view switch. */
  actions?: React.ReactNode;
}

function Filter({
  className,
  value,
  defaultValue = "",
  onValueChange,
  placeholder = "Enter property name or value",
  noBorders = false,
  showSyntaxHelp = false,
  actions,
  ...props
}: FilterProps) {
  const [uncontrolled, setUncontrolled] = React.useState(defaultValue);
  const current = value ?? uncontrolled;
  const inputId = React.useId();

  return (
    <div
      data-slot="filter"
      className={cn(
        "bg-cm-surface flex h-[38px] w-full items-center gap-2 px-4 py-1",
        !noBorders && "border-cm-hairline border-t border-b",
        className,
      )}
      {...props}
    >
      <FilterList aria-hidden className="text-cm-on-surface-variant size-5 shrink-0" />
      {/*
        A real `<label>`, not a decorative span. "Filter" is the field's name —
        the only name it has — so wiring it up costs nothing and is the
        difference between "edit text" and "Filter, edit text".
      */}
      <label htmlFor={inputId} className="text-cm-label-medium text-cm-on-surface shrink-0">
        Filter
      </label>
      <input
        id={inputId}
        type="text"
        value={current}
        placeholder={placeholder}
        onChange={(event) => {
          if (value === undefined) setUncontrolled(event.target.value);
          onValueChange?.(event.target.value);
        }}
        // Borderless on purpose: the bar's own top and bottom rules are the
        // field's frame, and a second box inside them reads as a field that has
        // been dropped into a toolbar rather than as the toolbar's own field.
        className="text-cm-body-medium text-cm-on-surface placeholder:text-cm-on-surface-variant-low h-7 min-w-0 flex-1 border-none bg-transparent outline-none"
      />
      {showSyntaxHelp && (
        <HelpButton label="Help with filtering" title="Filtering" side="bottom" align="end">
          <p>
            Filter by a value on its own to match anything containing it. Example:{" "}
            <Chip variant="filled">United States</Chip>
          </p>
          <p>
            Narrow the match by naming a property first. Example:{" "}
            <Chip variant="filled">Country : United States</Chip>
          </p>
          <p>
            Join terms with <code>OR</code> to match either. Example:{" "}
            <Chip variant="filled">Country : United States</Chip>{" "}
            <Chip variant="filled">OR</Chip>{" "}
            <Chip variant="filled">Country : Canada</Chip>
          </p>
        </HelpButton>
      )}
      {actions}
    </div>
  );
}

export { Filter };
