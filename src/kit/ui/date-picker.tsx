"use client";

import * as React from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";

import { Button } from "./button";
import { Input } from "./input";
import { CalendarMonth, ChevronLeft, ChevronRight } from "./material-symbols";
import { cn } from "./utils";

/**
 * DatePicker — a text field, a calendar button, and a month grid under it.
 *
 *     <DatePicker label="Expiry" value={date} onValueChange={setDate} min={todayIso()} />
 *
 * `Calendar` is the grid on its own, for a page that wants it inline — a
 * booking panel, a filter drawer — and `DatePicker` is the grid behind a field,
 * which is what a form wants. Both speak the same value.
 *
 * ### The value is a calendar date, not an instant
 *
 * `"2026-08-21"`, always, in and out. Not a `Date`, and never a UTC timestamp:
 * "the 21st" is not a moment, it is a square on a wall calendar, and the moment
 * it becomes a `Date` it acquires a timezone that will eventually turn it into
 * the 20th for somebody. Every function in here does its arithmetic on the
 * three numbers and formats for display at the last moment.
 *
 * A `Date` is still constructed for the two things only a calendar knows —
 * which weekday a month starts on, and how long February is — and always at
 * noon, so a DST jump cannot push it into the day before.
 *
 * ### Typing is allowed
 *
 * The field is a real text input. `2026-08-21`, `2026/8/21` and anything
 * `Date.parse` recognises all work, and the field reformats on blur; nonsense
 * is left alone for the reader to fix rather than silently discarded. Readers
 * who know the date they want type it far faster than they can click to it,
 * and a read-only field with a calendar button forces them to click.
 */

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];
/** Six rows of seven. Fixed, so the popup does not resize between months. */
const GRID_CELLS = 42;

function pad(value: number) {
  return value.toString().padStart(2, "0");
}

export function toIsoDate(year: number, month: number, day: number) {
  return `${year}-${pad(month)}-${pad(day)}`;
}

export function parseIsoDate(value: string | null | undefined) {
  if (!value) return null;
  const match = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(value.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > daysInMonth(year, month)) return null;
  return { year, month, day };
}

/** Today, as a calendar date in the reader's own zone. */
export function todayIsoDate() {
  const now = new Date();
  return toIsoDate(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

// Day 0 of the next month is the last day of this one.
function daysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

function firstWeekdayOf(year: number, month: number) {
  return new Date(year, month - 1, 1, 12).getDay();
}

function addDays(iso: string, delta: number) {
  const parts = parseIsoDate(iso);
  if (!parts) return iso;
  const date = new Date(parts.year, parts.month - 1, parts.day + delta, 12);
  return toIsoDate(date.getFullYear(), date.getMonth() + 1, date.getDate());
}

function addMonths(year: number, month: number, delta: number) {
  const date = new Date(year, month - 1 + delta, 1, 12);
  return { year: date.getFullYear(), month: date.getMonth() + 1 };
}

/** `"Aug 21, 2026"`. The format the console shows a date in. */
export function formatIsoDate(value: string | null | undefined, locale?: string) {
  const parts = parseIsoDate(value);
  if (!parts) return "";
  return new Date(parts.year, parts.month - 1, parts.day, 12).toLocaleDateString(locale, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * Reads what a reader typed. ISO first, because `Date.parse` reads `2026-08-21`
 * as UTC midnight and hands back the 20th to anyone west of Greenwich.
 */
export function parseTypedDate(text: string) {
  const trimmed = text.trim();
  if (!trimmed) return null;

  const loose = /^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/.exec(trimmed);
  if (loose) {
    const iso = toIsoDate(Number(loose[1]), Number(loose[2]), Number(loose[3]));
    return parseIsoDate(iso) ? iso : null;
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return null;
  return toIsoDate(parsed.getFullYear(), parsed.getMonth() + 1, parsed.getDate());
}

export interface CalendarProps extends Omit<React.ComponentProps<"div">, "defaultValue"> {
  /** The selected date, `YYYY-MM-DD`. Uncontrolled if omitted. */
  value?: string | null;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  /** The month on screen, `YYYY-MM`. Uncontrolled if omitted. */
  month?: string;
  defaultMonth?: string;
  onMonthChange?: (month: string) => void;
  /** Inclusive bounds, `YYYY-MM-DD`. */
  min?: string;
  max?: string;
  /** Rule out individual dates — weekends, blackout days. */
  isDateDisabled?: (date: string) => boolean;
  locale?: string;
}

function Calendar({
  className,
  value,
  defaultValue,
  onValueChange,
  month,
  defaultMonth,
  onMonthChange,
  min,
  max,
  isDateDisabled,
  locale,
  ...props
}: CalendarProps) {
  const [valueUncontrolled, setValueUncontrolled] = React.useState(defaultValue ?? "");
  const selected = value !== undefined ? (value ?? "") : valueUncontrolled;

  const initialMonth =
    defaultMonth ?? (parseIsoDate(selected) ? selected.slice(0, 7) : todayIsoDate().slice(0, 7));
  const [monthUncontrolled, setMonthUncontrolled] = React.useState(initialMonth);
  const shownMonth = month ?? monthUncontrolled;

  const [year, monthNumber] = shownMonth.split("-").map(Number);
  const today = todayIsoDate();

  // The square the arrow keys are on. It is not the selection — a reader may
  // walk the grid and change their mind — so it lives beside it, and starts on
  // the selection, or today, or the first of the month, in that order.
  const [focused, setFocused] = React.useState(
    () => selected || (today.startsWith(shownMonth) ? today : `${shownMonth}-01`),
  );
  const gridRef = React.useRef<HTMLDivElement>(null);
  const shouldFocus = React.useRef(false);

  React.useEffect(() => {
    if (!shouldFocus.current) return;
    shouldFocus.current = false;
    gridRef.current?.querySelector<HTMLElement>(`[data-date="${focused}"]`)?.focus();
  }, [focused]);

  const setMonth = (next: string) => {
    if (month === undefined) setMonthUncontrolled(next);
    onMonthChange?.(next);
  };

  const stepMonth = (delta: number) => {
    const next = addMonths(year, monthNumber, delta);
    setMonth(`${next.year}-${pad(next.month)}`);
  };

  const disabled = (iso: string) =>
    (min !== undefined && iso < min) ||
    (max !== undefined && iso > max) ||
    (isDateDisabled?.(iso) ?? false);

  const select = (iso: string) => {
    if (disabled(iso)) return;
    if (value === undefined) setValueUncontrolled(iso);
    onValueChange?.(iso);
  };

  const moveTo = (iso: string) => {
    setFocused(iso);
    shouldFocus.current = true;
    // Walking off the edge of the month brings the next one with it, which is
    // the only way a keyboard reader can reach December from November.
    const target = iso.slice(0, 7);
    if (target !== shownMonth) setMonth(target);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const key = event.key;
    const parts = parseIsoDate(focused);
    if (!parts) return;

    if (key === "ArrowLeft") moveTo(addDays(focused, -1));
    else if (key === "ArrowRight") moveTo(addDays(focused, 1));
    else if (key === "ArrowUp") moveTo(addDays(focused, -7));
    else if (key === "ArrowDown") moveTo(addDays(focused, 7));
    else if (key === "Home") moveTo(addDays(focused, -new Date(parts.year, parts.month - 1, parts.day, 12).getDay()));
    else if (key === "End")
      moveTo(addDays(focused, 6 - new Date(parts.year, parts.month - 1, parts.day, 12).getDay()));
    else if (key === "PageUp") {
      const next = addMonths(parts.year, parts.month, -1);
      moveTo(toIsoDate(next.year, next.month, Math.min(parts.day, daysInMonth(next.year, next.month))));
    } else if (key === "PageDown") {
      const next = addMonths(parts.year, parts.month, 1);
      moveTo(toIsoDate(next.year, next.month, Math.min(parts.day, daysInMonth(next.year, next.month))));
    } else return;

    event.preventDefault();
  };

  const leading = firstWeekdayOf(year, monthNumber);
  const length = daysInMonth(year, monthNumber);
  const cells: Array<{ iso: string; inMonth: boolean; day: number }> = [];

  for (let i = 0; i < GRID_CELLS; i += 1) {
    const dayNumber = i - leading + 1;
    if (dayNumber >= 1 && dayNumber <= length) {
      cells.push({ iso: toIsoDate(year, monthNumber, dayNumber), inMonth: true, day: dayNumber });
    } else {
      // Neighbouring months are shown and not selectable: the reader needs to
      // see that the 1st is a Thursday, not to click the 31st of last month by
      // accident on the way past.
      const iso = addDays(toIsoDate(year, monthNumber, 1), dayNumber - 1);
      cells.push({ iso, inMonth: false, day: Number(iso.slice(8)) });
    }
  }

  const heading = new Date(year, monthNumber - 1, 1, 12).toLocaleDateString(locale, {
    month: "long",
    year: "numeric",
  });

  return (
    <div
      data-slot="calendar"
      className={cn("flex w-[300px] max-w-full flex-col gap-2 p-2", className)}
      {...props}
    >
      <div className="flex items-center justify-between">
        <Button variant="text" size="icon" aria-label="Previous month" onClick={() => stepMonth(-1)}>
          <ChevronLeft aria-hidden className="size-5" />
        </Button>
        {/* `aria-live`, because the month is the only thing that changes when
            the arrows are pressed and a screen reader is otherwise told
            nothing at all. */}
        <span aria-live="polite" className="text-cm-label-large text-cm-on-surface">
          {heading}
        </span>
        <Button variant="text" size="icon" aria-label="Next month" onClick={() => stepMonth(1)}>
          <ChevronRight aria-hidden className="size-5" />
        </Button>
      </div>

      <div className="grid grid-cols-7">
        {WEEKDAYS.map((letter, index) => (
          <div
            key={index}
            aria-hidden
            className="text-cm-label-small text-cm-on-surface-variant flex h-8 items-center justify-center"
          >
            {letter}
          </div>
        ))}
      </div>

      {/* One tab stop for 42 buttons — the grid pattern. Tabbing through a
          month and out the other side is six weeks of keypresses. */}
      <div
        ref={gridRef}
        role="grid"
        aria-label={heading}
        onKeyDown={handleKeyDown}
        className="grid grid-cols-7 gap-y-1"
      >
        {cells.map((cell) => {
          const isSelected = cell.iso === selected;
          const isToday = cell.iso === today;
          const isDisabled = !cell.inMonth || disabled(cell.iso);

          return (
            <button
              key={cell.iso}
              type="button"
              role="gridcell"
              data-date={cell.iso}
              disabled={isDisabled}
              aria-selected={isSelected}
              aria-current={isToday ? "date" : undefined}
              aria-label={formatIsoDate(cell.iso, locale)}
              tabIndex={cell.iso === focused && !isDisabled ? 0 : -1}
              onClick={() => select(cell.iso)}
              onFocus={() => setFocused(cell.iso)}
              className={cn(
                "text-cm-body-medium focus-visible:ring-cm-outline-focus/50 mx-auto flex size-9 cursor-pointer items-center justify-center rounded-full outline-none focus-visible:ring-[3px]",
                isSelected
                  ? "bg-cm-primary text-cm-on-primary hover:bg-cm-primary/90"
                  : "text-cm-on-surface hover:bg-cm-on-surface/8",
                // Today is a ring rather than a fill, so it can sit under a
                // selection somewhere else in the month without competing.
                isToday && !isSelected && "border-cm-primary text-cm-primary border",
                isDisabled && "cursor-default opacity-50 hover:bg-transparent",
                !cell.inMonth && "text-cm-on-surface-variant",
              )}
            >
              {cell.day}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export interface DatePickerProps
  extends Omit<React.ComponentProps<"div">, "defaultValue" | "onChange"> {
  label?: string;
  /** `YYYY-MM-DD`. Uncontrolled if omitted. */
  value?: string | null;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  min?: string;
  max?: string;
  isDateDisabled?: (date: string) => boolean;
  disabled?: boolean;
  placeholder?: string;
  helpText?: string;
  locale?: string;
  /** Rendered before the calendar button — a timezone abbreviation, usually. */
  suffix?: React.ReactNode;
}

function DatePicker({
  className,
  label = "Date",
  value,
  defaultValue,
  onValueChange,
  min,
  max,
  isDateDisabled,
  disabled = false,
  placeholder,
  helpText,
  locale,
  suffix,
  ...props
}: DatePickerProps) {
  const [valueUncontrolled, setValueUncontrolled] = React.useState(defaultValue ?? "");
  const selected = value !== undefined ? (value ?? "") : valueUncontrolled;
  const [open, setOpen] = React.useState(false);

  // What is in the box while the reader is typing. It tracks the value until
  // they touch it, and takes over until they leave — a field that reformatted
  // on every keystroke would rewrite "2026-0" the moment it became a date.
  const [draft, setDraft] = React.useState<string | null>(null);
  const display = draft ?? formatIsoDate(selected, locale);

  const commit = (next: string) => {
    if (value === undefined) setValueUncontrolled(next);
    onValueChange?.(next);
  };

  const commitTyped = () => {
    if (draft === null) return;
    const parsed = parseTypedDate(draft);
    if (parsed !== null) {
      commit(parsed);
      setDraft(null);
    } else if (draft.trim() === "") {
      commit("");
      setDraft(null);
    }
    // Unparseable text is left in the field. Clearing it would delete what the
    // reader typed without telling them why.
  };

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
      <div data-slot="date-picker" className={cn("w-full", className)} {...props}>
        <PopoverPrimitive.Anchor asChild>
          <div className="w-full">
            <Input
              label={label}
              value={display}
              disabled={disabled}
              placeholder={placeholder}
              helpText={helpText}
              onChange={(event) => setDraft(event.target.value)}
              onBlur={commitTyped}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  commitTyped();
                }
              }}
              suffix={
                <>
                  {suffix}
                  <PopoverPrimitive.Trigger asChild>
                    <button
                      type="button"
                      disabled={disabled}
                      aria-label="Open calendar"
                      className="text-cm-on-surface-variant hover:bg-cm-on-surface/8 focus-visible:ring-cm-outline-focus/50 flex size-7 cursor-pointer items-center justify-center rounded-full outline-none focus-visible:ring-[3px] disabled:cursor-default disabled:opacity-50"
                    >
                      <CalendarMonth aria-hidden className="size-[18px]" />
                    </button>
                  </PopoverPrimitive.Trigger>
                </>
              }
            />
          </div>
        </PopoverPrimitive.Anchor>
      </div>

      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="start"
          sideOffset={4}
          className="bg-cm-surface-elevation text-cm-on-surface shadow-cm-elevation data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 z-50 rounded-[12px] outline-none"
        >
          <Calendar
            value={selected}
            onValueChange={(next) => {
              commit(next);
              setDraft(null);
              // A date picker closes on pick. There is nothing else in the
              // popup to do, unlike `DateTimePicker`, which has a time beside
              // the grid and must stay open.
              setOpen(false);
            }}
            min={min}
            max={max}
            isDateDisabled={isDateDisabled}
            locale={locale}
          />
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}

export { Calendar, DatePicker };
