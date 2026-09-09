"use client";

import * as React from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";

import { Button } from "./button";
import { DateTimePicker } from "./date-time-picker";
import { ArrowDropDown } from "./material-symbols";
import { ToggleGroup, ToggleGroupItem } from "./toggle-group";
import { cn } from "./utils";

/**
 * IntervalPicker — "the last 6 hours", with an escape hatch.
 *
 *     <IntervalPicker
 *       hasCustom
 *       onIntervalChange={({ startTime, endTime }) => reload(startTime, endTime)}
 *     />
 *
 * The row of durations above a chart or a log view. Almost every reader wants
 * one of eight relative windows, so those are buttons rather than a select —
 * one click, no menu — and the tenth reader who wants a specific Tuesday gets
 * `Custom`, which is a popover with two `DateTimePicker`s in it.
 *
 * ### Relative in, absolute out
 *
 * A preset is a duration; the reader means "ending now". So `onIntervalChange`
 * fires with a concrete `{ startTime, endTime }` pair of ISO instants,
 * resolved at the moment of the click. Handing the caller `6h` and letting them
 * work out when "now" was is how a chart's axis ends up disagreeing with its
 * own query.
 *
 * Nothing re-fires on its own afterwards. A "last 6 hours" window that quietly
 * slid forward while a reader was reading it would be a chart that changes
 * under the pointer; refreshing is the page's decision, and this component's
 * job is to say what was asked for and when.
 *
 * ### `Custom` is a peer of the presets, not a mode
 *
 * It sits in the same toggle group and shows selected the same way, because
 * from the reader's side it is the ninth option. What is behind it happens to
 * be a form.
 */

export interface IntervalPreset {
  label: string;
  /** Milliseconds back from now. */
  duration: number;
}

export interface Interval {
  /** ISO instants — `2026-08-21T08:30:00.000Z`. */
  startTime: string;
  endTime: string;
}

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

export const DEFAULT_INTERVAL_PRESETS: IntervalPreset[] = [
  { label: "1 hour", duration: HOUR },
  { label: "3 hours", duration: 3 * HOUR },
  { label: "6 hours", duration: 6 * HOUR },
  { label: "12 hours", duration: 12 * HOUR },
  { label: "1 day", duration: DAY },
  { label: "3 days", duration: 3 * DAY },
  { label: "7 days", duration: 7 * DAY },
  { label: "14 days", duration: 14 * DAY },
];

const CUSTOM = "Custom";

/** `"2026-08-21 14:30"` in the reader's own zone → an ISO instant. */
function toInstant(local: string) {
  const [date, time = "00:00"] = local.trim().split(/\s+/);
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  if ([year, month, day, hour, minute].some((part) => Number.isNaN(part))) return null;
  return new Date(year, month - 1, day, hour, minute).toISOString();
}

function toLocalValue(instant: Date) {
  const pad = (value: number) => value.toString().padStart(2, "0");
  return `${instant.getFullYear()}-${pad(instant.getMonth() + 1)}-${pad(instant.getDate())} ${pad(instant.getHours())}:${pad(instant.getMinutes())}`;
}

export interface IntervalPickerProps
  extends Omit<React.ComponentProps<"div">, "onChange" | "defaultValue"> {
  presets?: IntervalPreset[];
  /** Adds the `Custom` button and its popover. */
  hasCustom?: boolean;
  /** The selected preset's label, or `"Custom"`. Uncontrolled if omitted. */
  value?: string;
  defaultValue?: string;
  onValueChange?: (label: string) => void;
  /** The resolved window. Fires on every change, preset or custom. */
  onIntervalChange?: (interval: Interval) => void;
  disabled?: boolean;
}

function IntervalPicker({
  className,
  presets = DEFAULT_INTERVAL_PRESETS,
  hasCustom = false,
  value,
  defaultValue,
  onValueChange,
  onIntervalChange,
  disabled = false,
  ...props
}: IntervalPickerProps) {
  const [valueUncontrolled, setValueUncontrolled] = React.useState(
    defaultValue ?? presets[0]?.label ?? "",
  );
  const selected = value ?? valueUncontrolled;

  const [open, setOpen] = React.useState(false);
  // The popover's own drafts. They are not the interval until Apply: a reader
  // half way through picking an end date has not asked for anything yet.
  const [draftStart, setDraftStart] = React.useState("");
  const [draftEnd, setDraftEnd] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  const setSelected = (label: string) => {
    if (value === undefined) setValueUncontrolled(label);
    onValueChange?.(label);
  };

  const choosePreset = (label: string) => {
    const preset = presets.find((item) => item.label === label);
    if (!preset) return;
    setSelected(label);
    const end = new Date();
    onIntervalChange?.({
      startTime: new Date(end.getTime() - preset.duration).toISOString(),
      endTime: end.toISOString(),
    });
  };

  const openCustom = () => {
    if (!draftStart || !draftEnd) {
      // Seed from the currently selected preset, so the form opens on the
      // window the reader is already looking at rather than on nothing.
      const preset = presets.find((item) => item.label === selected) ?? presets[0];
      const end = new Date();
      const start = new Date(end.getTime() - (preset?.duration ?? HOUR));
      setDraftStart(toLocalValue(start));
      setDraftEnd(toLocalValue(end));
    }
    setError(null);
    setOpen(true);
  };

  const apply = () => {
    const startTime = toInstant(draftStart);
    const endTime = toInstant(draftEnd);
    if (!startTime || !endTime) {
      setError("Enter a start and an end.");
      return;
    }
    if (startTime >= endTime) {
      setError("The start must come before the end.");
      return;
    }
    setSelected(CUSTOM);
    onIntervalChange?.({ startTime, endTime });
    setOpen(false);
  };

  return (
    <div
      data-slot="interval-picker"
      className={cn("flex flex-wrap items-center gap-1", className)}
      {...props}
    >
      <ToggleGroup
        type="single"
        value={selected}
        // Radix hands back `""` when the pressed item is pressed again. A time
        // window has no "off" — the chart is showing something — so the second
        // click is ignored rather than clearing the row.
        onValueChange={(next) => next && next !== CUSTOM && choosePreset(next)}
        disabled={disabled}
      >
        {presets.map((preset) => (
          <ToggleGroupItem key={preset.label} value={preset.label} aria-label={`Last ${preset.label}`}>
            {preset.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>

      {hasCustom && (
        <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
          <PopoverPrimitive.Trigger asChild>
            <Button
              variant={selected === CUSTOM ? "stroked" : "text"}
              disabled={disabled}
              onClick={openCustom}
            >
              {CUSTOM}
              <ArrowDropDown aria-hidden className="size-5" />
            </Button>
          </PopoverPrimitive.Trigger>

          <PopoverPrimitive.Portal>
            <PopoverPrimitive.Content
              align="end"
              sideOffset={4}
              className="bg-cm-surface-elevation text-cm-on-surface shadow-cm-elevation data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 z-50 flex w-[360px] max-w-[calc(100vw-32px)] flex-col gap-4 rounded-[12px] p-4 outline-none"
            >
              <DateTimePicker
                label="Start"
                value={draftStart}
                onValueChange={setDraftStart}
                showTimezone={false}
              />
              <DateTimePicker
                label="End"
                value={draftEnd}
                onValueChange={setDraftEnd}
                showTimezone={false}
              />
              {error && <p className="text-cm-body-small text-cm-status-error">{error}</p>}
              <div className="flex justify-end gap-2">
                <Button variant="text" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={apply}>Apply</Button>
              </div>
            </PopoverPrimitive.Content>
          </PopoverPrimitive.Portal>
        </PopoverPrimitive.Root>
      )}
    </div>
  );
}

export { IntervalPicker };
