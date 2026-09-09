"use client";

import * as React from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";

import { ArrowDropDown, Check, Search } from "./material-symbols";
import { cn } from "./utils";

/**
 * TimezonePicker — pick a zone from a list of several hundred, by typing.
 *
 *     <TimezonePicker value={zone} onValueChange={setZone} />
 *
 * A `SelectField` would be the obvious component and is the wrong one: it has
 * no search, and a select with 400 options is a scroll bar. This is a combobox
 * — a button that opens a filter box over a listbox — which is the pattern for
 * a list too long to read and short enough to name.
 *
 * ### The list comes from the platform
 *
 * CDS ships a hand-written table of about 180 zone abbreviations. This asks
 * `Intl.supportedValuesOf("timeZone")` instead and computes each offset with
 * `Intl.DateTimeFormat`, which means:
 *
 *   - the names are IANA ids (`America/Los_Angeles`), which is what an API
 *     wants stored, rather than `PST`, which is ambiguous between two zones;
 *   - the offsets are right today, including whichever half of the year the
 *     reader is in, instead of frozen at whenever the table was typed;
 *   - a zone added by a government next year appears without a release here.
 *
 * Pass `zones` to override the list — a product that supports six regions
 * should offer six, not four hundred.
 *
 * ### Searching matches the id and the offset
 *
 * "tokyo", "japan" and "+9" all find `Asia/Tokyo`, because a reader looking for
 * a zone knows one of those three and rarely the one you chose to sort by.
 * Underscores are matched as spaces: nobody types `Los_Angeles`.
 */

export interface TimezoneOption {
  /** The value stored. An IANA id, by default. */
  value: string;
  /** What the reader reads. Defaults to the id with its underscores removed. */
  label?: string;
  /** `UTC+9`, `UTC-3:30`. Computed for the default list. */
  offset?: string;
}

/** Minutes east of UTC for `zone`, right now. */
function offsetOf(zone: string) {
  try {
    const formatted = new Intl.DateTimeFormat("en-US", {
      timeZone: zone,
      timeZoneName: "shortOffset",
    })
      .formatToParts(new Date())
      .find((part) => part.type === "timeZoneName")?.value;
    // `shortOffset` gives "GMT+9", "GMT-3:30", or a bare "GMT" at zero.
    return formatted ? formatted.replace(/^GMT/, "UTC") || "UTC" : "UTC";
  } catch {
    return "UTC";
  }
}

/**
 * Built once per module, not per render: four hundred `Intl.DateTimeFormat`
 * constructions is not something to do on a keystroke. The offsets are a
 * snapshot — a page left open across a DST change shows the old one, which is
 * an hour of wrongness in a label twice a year and worth it.
 */
let defaultZones: TimezoneOption[] | null = null;

export function getDefaultTimezones(): TimezoneOption[] {
  if (defaultZones) return defaultZones;

  const supported =
    typeof Intl.supportedValuesOf === "function"
      ? Intl.supportedValuesOf("timeZone")
      : ["UTC"];

  defaultZones = supported.map((zone) => ({
    value: zone,
    label: zone.replace(/_/g, " "),
    offset: offsetOf(zone),
  }));
  return defaultZones;
}

export interface TimezonePickerProps
  extends Omit<React.ComponentProps<"div">, "onChange" | "defaultValue"> {
  label?: string;
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  /** Replaces the platform list. */
  zones?: TimezoneOption[];
  placeholder?: string;
  disabled?: boolean;
  /** Row limit for the open list. The rest are reachable by typing. */
  maxVisible?: number;
}

function TimezonePicker({
  className,
  label,
  value,
  defaultValue,
  onValueChange,
  zones,
  placeholder = "Select timezone",
  disabled = false,
  maxVisible = 100,
  ...props
}: TimezonePickerProps) {
  const [valueUncontrolled, setValueUncontrolled] = React.useState(defaultValue ?? "");
  const selected = value ?? valueUncontrolled;
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");

  const all = React.useMemo(() => zones ?? getDefaultTimezones(), [zones]);
  const current = all.find((zone) => zone.value === selected);

  const matches = React.useMemo(() => {
    const needle = query.trim().toLowerCase().replace(/\s+/g, " ");
    if (!needle) return all.slice(0, maxVisible);
    return all
      .filter((zone) => {
        const haystack = `${zone.label ?? zone.value} ${zone.value} ${zone.offset ?? ""}`
          .toLowerCase()
          .replace(/_/g, " ");
        return haystack.includes(needle);
      })
      .slice(0, maxVisible);
  }, [all, query, maxVisible]);

  const select = (zone: TimezoneOption) => {
    if (value === undefined) setValueUncontrolled(zone.value);
    onValueChange?.(zone.value);
    setOpen(false);
    // The filter is cleared on close so the next open shows the whole list.
    // A search box that remembers last week's query is a list that looks empty.
    setQuery("");
  };

  return (
    <div
      data-slot="timezone-picker"
      className={cn("flex w-full flex-col gap-1", className)}
      {...props}
    >
      {label && <span className="text-cm-body-small text-cm-on-surface-variant">{label}</span>}

      <PopoverPrimitive.Root
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setQuery("");
        }}
      >
        <PopoverPrimitive.Trigger asChild>
          <button
            type="button"
            disabled={disabled}
            role="combobox"
            aria-expanded={open}
            className="border-cm-outline text-cm-body-medium text-cm-on-surface hover:bg-cm-on-surface/8 focus-visible:ring-cm-outline-focus/50 flex h-8 w-full cursor-pointer items-center justify-between gap-2 rounded-[4px] border px-3 outline-none focus-visible:ring-[3px] disabled:cursor-default disabled:opacity-50"
          >
            <span className={cn("truncate", !current && "text-cm-on-surface-variant")}>
              {current ? `${current.label ?? current.value} (${current.offset})` : placeholder}
            </span>
            <ArrowDropDown
              aria-hidden
              className={cn(
                "text-cm-on-surface-variant size-5 shrink-0 transition-transform",
                open && "rotate-180",
              )}
            />
          </button>
        </PopoverPrimitive.Trigger>

        <PopoverPrimitive.Portal>
          <PopoverPrimitive.Content
            align="start"
            sideOffset={4}
            className="bg-cm-surface-elevation text-cm-on-surface shadow-cm-elevation data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 z-50 w-(--radix-popover-trigger-width) min-w-[280px] overflow-hidden rounded-[12px] outline-none"
          >
            <div className="border-cm-hairline flex items-center gap-2 border-b px-3 py-2">
              <Search aria-hidden className="text-cm-on-surface-variant size-[18px] shrink-0" />
              <input
                // eslint-disable-next-line jsx-a11y/no-autofocus -- the popup
                // exists to be typed into; anything else is a wasted keystroke.
                autoFocus
                type="text"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search by city, region or offset"
                aria-label="Search timezones"
                className="text-cm-body-medium text-cm-on-surface placeholder:text-cm-on-surface-variant h-7 min-w-0 flex-1 border-none bg-transparent outline-none"
              />
            </div>

            <div role="listbox" aria-label="Timezones" className="max-h-[320px] overflow-y-auto py-1">
              {matches.length === 0 ? (
                <p className="text-cm-body-medium text-cm-on-surface-variant px-4 py-3">
                  No timezone matches “{query}”.
                </p>
              ) : (
                matches.map((zone) => {
                  const isSelected = zone.value === selected;
                  return (
                    <button
                      key={zone.value}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => select(zone)}
                      className={cn(
                        "text-cm-body-medium hover:bg-cm-container-high focus-visible:bg-cm-container-high flex w-full cursor-pointer items-center gap-3 px-4 py-1.5 text-start outline-none",
                        isSelected ? "text-cm-on-surface" : "text-cm-on-surface-variant",
                      )}
                    >
                      <span className="flex size-[18px] shrink-0 items-center justify-center">
                        {isSelected && <Check aria-hidden className="text-cm-primary size-[18px]" />}
                      </span>
                      <span className="flex-1 truncate">{zone.label ?? zone.value}</span>
                      <span className="text-cm-label-small text-cm-on-surface-variant shrink-0">
                        {zone.offset}
                      </span>
                    </button>
                  );
                })
              )}
            </div>

            {matches.length === maxVisible && (
              // Say so rather than truncate silently: a reader who cannot find
              // Kiritimati needs to know the list is cut, not conclude it is
              // missing.
              <p className="text-cm-label-small text-cm-on-surface-variant border-cm-hairline border-t px-4 py-2">
                Showing the first {maxVisible}. Keep typing to narrow it.
              </p>
            )}
          </PopoverPrimitive.Content>
        </PopoverPrimitive.Portal>
      </PopoverPrimitive.Root>
    </div>
  );
}

export { TimezonePicker };
