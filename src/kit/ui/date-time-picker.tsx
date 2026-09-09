"use client";

import * as React from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";

import { Button } from "./button";
import { Calendar, formatIsoDate, todayIsoDate } from "./date-picker";
import { Input } from "./input";
import { CalendarMonth } from "./material-symbols";
import { TimezonePicker } from "./timezone-picker";
import { cn } from "./utils";

/**
 * DateTimePicker — a date, a time, and the zone they are in.
 *
 *     <DateTimePicker
 *       label="Starts at"
 *       value={start}                 // "2026-08-21 14:30"
 *       onValueChange={setStart}
 *       timezone={zone}               // "America/Los_Angeles"
 *       onTimezoneChange={setZone}
 *     />
 *
 * `DatePicker` closes the moment you click a day, because a day is the whole
 * answer. This one cannot: the reader has two more fields to fill in, and a
 * popup that vanished under the first click would be unusable. So the calendar
 * here is one control in a small form, and the reader closes it themselves.
 *
 *   DatePicker      an expiry, a birthday, a report date. No time of day.
 *   DateTimePicker  a maintenance window, a scheduled export. An instant.
 *   IntervalPicker  a span, usually relative — "the last 6 hours".
 *
 * ### Value and timezone are separate props
 *
 * `"2026-08-21 14:30"` plus `"America/Los_Angeles"`, not one ISO instant. A
 * scheduled job at 09:00 Los Angeles time is *nine in the morning there*, in
 * June and in December, and folding it into a UTC timestamp loses exactly the
 * fact the reader was expressing. Combine them at the point you need an
 * instant, where you also know whether you meant the wall clock or the moment.
 *
 * ### The zone is offered, not assumed
 *
 * It defaults to the reader's own, resolved from the browser, and shows in the
 * field — because a time with no zone on a console page is read as "server
 * time" by half the readers and "my time" by the other half.
 */

const DEFAULT_TIME = "12:00";

function splitValue(value: string | null | undefined) {
  const [date = "", time = ""] = (value ?? "").trim().split(/\s+/);
  return { date, time: /^\d{1,2}:\d{2}$/.test(time) ? time : "" };
}

function joinValue(date: string, time: string) {
  if (!date) return "";
  return `${date} ${time || DEFAULT_TIME}`;
}

/** The browser's own zone, or UTC where the runtime will not say. */
function localTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

export interface DateTimePickerProps
  extends Omit<React.ComponentProps<"div">, "defaultValue" | "onChange"> {
  label?: string;
  /** `YYYY-MM-DD HH:mm`. Uncontrolled if omitted. */
  value?: string | null;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  /** An IANA id. Uncontrolled if omitted; defaults to the browser's. */
  timezone?: string;
  defaultTimezone?: string;
  onTimezoneChange?: (timezone: string) => void;
  /** Drop the zone row for a surface where everything is already one zone. */
  showTimezone?: boolean;
  min?: string;
  max?: string;
  disabled?: boolean;
  helpText?: string;
  locale?: string;
}

function DateTimePicker({
  className,
  label = "Date and time",
  value,
  defaultValue,
  onValueChange,
  timezone,
  defaultTimezone,
  onTimezoneChange,
  showTimezone = true,
  min,
  max,
  disabled = false,
  helpText,
  locale,
  ...props
}: DateTimePickerProps) {
  const [valueUncontrolled, setValueUncontrolled] = React.useState(defaultValue ?? "");
  const current = value !== undefined ? (value ?? "") : valueUncontrolled;
  const { date, time } = splitValue(current);

  const [zoneUncontrolled, setZoneUncontrolled] = React.useState(
    () => defaultTimezone ?? localTimezone(),
  );
  const zone = timezone ?? zoneUncontrolled;

  const [open, setOpen] = React.useState(false);

  const commit = (nextDate: string, nextTime: string) => {
    const next = joinValue(nextDate, nextTime);
    if (value === undefined) setValueUncontrolled(next);
    onValueChange?.(next);
  };

  const setZone = (next: string) => {
    if (timezone === undefined) setZoneUncontrolled(next);
    onTimezoneChange?.(next);
  };

  const display = date
    ? [formatIsoDate(date, locale), time || DEFAULT_TIME, showTimezone ? zone : ""]
        .filter(Boolean)
        .join(" ")
    : "";

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
      <div data-slot="date-time-picker" className={cn("w-full", className)} {...props}>
        <PopoverPrimitive.Anchor asChild>
          <div className="w-full">
            {/*
              Read-only, unlike `DatePicker`'s field. There is no one string a
              reader could type that sets a date, a time and a zone without the
              field guessing at which half of "3/4/26 10:00 CST" is which.
            */}
            <Input
              label={label}
              value={display}
              readOnly
              disabled={disabled}
              helpText={helpText}
              suffix={
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
              }
            />
          </div>
        </PopoverPrimitive.Anchor>
      </div>

      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="start"
          sideOffset={4}
          className="bg-cm-surface-elevation text-cm-on-surface shadow-cm-elevation data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 z-50 flex w-[340px] max-w-[calc(100vw-32px)] flex-col gap-3 rounded-[12px] p-3 outline-none"
        >
          <div className="flex items-start gap-2">
            <Input
              label="Date"
              type="date"
              value={date}
              min={min}
              max={max}
              onChange={(event) => commit(event.target.value, time)}
              wrapperClassName="flex-1"
            />
            <Input
              label="Time"
              type="time"
              value={time || DEFAULT_TIME}
              onChange={(event) => commit(date || todayIsoDate(), event.target.value)}
              wrapperClassName="w-[120px]"
            />
          </div>

          <Calendar
            value={date}
            // A time with no date is not a value, so picking a day is what
            // brings the default noon along with it.
            onValueChange={(next) => commit(next, time)}
            min={min}
            max={max}
            locale={locale}
            className="w-full p-0"
          />

          {showTimezone && (
            <TimezonePicker label="Timezone" value={zone} onValueChange={setZone} />
          )}

          <div className="flex justify-end">
            <Button variant="text" onClick={() => setOpen(false)}>
              Done
            </Button>
          </div>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}

export { DateTimePicker };
