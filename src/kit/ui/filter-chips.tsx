"use client";

import * as React from "react";

import { FilterChip } from "./chip";
import { cn } from "./utils";

/**
 * FilterChips — a row of `FilterChip`s that know about each other.
 *
 * The kit already has the chip; what it did not have is the *group*, and the
 * group is where the two things a caller always ends up rewriting live: which
 * chips may be on at once, and how a row of nine of them behaves for a keyboard.
 *
 * ### Selection
 *
 *   single     picking one turns the others off. A view switch — the data is
 *              shown one way at a time.
 *   multiple   each toggles independently. Narrowing a list by several facets.
 *
 * `single` does not allow zero: clicking the chip that is already on leaves it
 * on, because "no view selected" is not a state the table behind it can be in.
 * Use `multiple` if empty is meaningful.
 *
 * ### Keyboard
 *
 * A labelled `role="group"`, and every chip is its own tab stop. The row used
 * to be a roving-tabindex group — one stop, arrows inside — and that component
 * is gone from the kit; a chip is a button, and Tab reaching each button in
 * turn is what a reader expects of one. Keep the set short and the extra stops
 * are not a cost worth a bespoke keyboard mode.
 */

export interface FilterChipOption {
  value: string;
  label: React.ReactNode;
  /** A leading glyph, sized by the chip. */
  icon?: React.ReactNode;
  disabled?: boolean;
}

export interface FilterChipsProps extends Omit<React.ComponentProps<"div">, "onChange"> {
  options: FilterChipOption[];
  selection?: "single" | "multiple";
  /** Controlled selection. Always an array, including in `single`. */
  value?: string[];
  defaultValue?: string[];
  onValueChange?: (value: string[]) => void;
  /** Names the group for a screen reader — "Filter by status". */
  label?: string;
}

function FilterChips({
  className,
  options,
  selection = "single",
  value,
  defaultValue = [],
  onValueChange,
  label,
  ...props
}: FilterChipsProps) {
  const [uncontrolled, setUncontrolled] = React.useState(defaultValue);
  const selected = value ?? uncontrolled;

  const toggle = (option: FilterChipOption) => {
    const isOn = selected.includes(option.value);
    const next =
      selection === "single"
        ? [option.value]
        : isOn
          ? selected.filter((v) => v !== option.value)
          : [...selected, option.value];

    if (value === undefined) setUncontrolled(next);
    onValueChange?.(next);
  };

  return (
    <div
      data-slot="filter-chips"
      role="group"
      aria-label={label}
      className={cn("flex flex-wrap items-center gap-2", className)}
      {...props}
    >
      {options.map((option) => (
        <FilterChip
          key={option.value}
          selected={selected.includes(option.value)}
          disabled={option.disabled}
          icon={option.icon}
          onClick={() => toggle(option)}
        >
          {option.label}
        </FilterChip>
      ))}
    </div>
  );
}

export { FilterChips };
