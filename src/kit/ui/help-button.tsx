"use client";

import * as React from "react";

import { Help } from "./material-symbols";
import {
  RichTooltip,
  RichTooltipActions,
  RichTooltipContent,
  RichTooltipDescription,
  RichTooltipTitle,
  RichTooltipTrigger,
} from "./rich-tooltip";
import { cn } from "./utils";

/**
 * HelpButton — the `?` mark that explains the thing next to it.
 *
 * It is the outlined `help` symbol at 18px in `on-surface-variant`, which is
 * what the reference draws: a ring and a question mark, not the filled disc.
 * Filled is the louder of the two and this is an aside, not a warning.
 *
 * The interesting measurement is the one you cannot see. A help mark turns up
 * beside a table's filter strip (40px), a key in a `KeyValueList` (a 26px band
 * on a 27px pitch) and inside an input's suffix cluster, and it has to leave
 * all three exactly as tall as it found them. So the button's *layout* box is
 * the glyph's own 18px, and the 32px round hover target is drawn by a
 * pseudo-element that sits outside the box without occupying space. Clicks on
 * the pseudo-element still hit the button, so the target is a comfortable 32px
 * while the footprint stays 18px.
 *
 * Hovering shows the explanation, because a `?` that does nothing on hover is
 * a `?` you have to click to find out whether it was worth clicking. It is
 * `RichTooltip` and not a native `title`: the panel can hold a heading, a
 * paragraph and a link, and — per the rich tooltip's own rules — clicking the
 * mark pins the panel open so you can reach into it.
 *
 *     <HelpButton label="About partitioning" title="Partitioned table">
 *       Queries that filter on the partition column scan less data.
 *     </HelpButton>
 */

// `title` is re-used for the panel heading rather than the native tooltip —
// two tooltips on one control is one too many.
export interface HelpButtonProps
  extends Omit<React.ComponentProps<"button">, "children" | "title"> {
  /**
   * The explanation, always rendered as the panel's prose — so a `<code>` or a
   * `RichTooltipLink` mid-sentence is fine, but the paragraph's type is not
   * yours to pick. A help panel that sets its own body type is a help panel
   * that disagrees with the other five on the page.
   */
  children: React.ReactNode;
  /** Panel heading. Optional — a panel of pure prose is a legitimate one. */
  title?: React.ReactNode;
  /** Buttons for the panel's bottom row. Wrap dismissers in `RichTooltipClose`. */
  actions?: React.ReactNode;
  /**
   * The button's accessible name. Say what it explains — "Help" on its own
   * tells a screen reader nothing, and a page can hold six of these.
   */
  label?: string;
  side?: React.ComponentProps<typeof RichTooltipContent>["side"];
  align?: React.ComponentProps<typeof RichTooltipContent>["align"];
  sideOffset?: number;
}

function HelpButton({
  children,
  title,
  actions,
  label = "Help",
  side,
  align,
  sideOffset,
  className,
  type = "button",
  ...props
}: HelpButtonProps) {
  return (
    <RichTooltip>
      <RichTooltipTrigger asChild>
        <button
          data-slot="help-button"
          type={type}
          aria-label={label}
          className={cn(
            "text-cm-on-surface-variant relative inline-flex size-[18px] shrink-0 cursor-pointer items-center justify-center rounded-full align-middle outline-none",
            // The state layer: 18px + 7px on every side = the 32px target,
            // drawn outside the layout box so no row grows to hold it.
            "before:absolute before:-inset-[7px] before:rounded-full before:transition-colors",
            "hover:before:bg-cm-container",
            "focus-visible:ring-cm-outline-focus/50 focus-visible:ring-[3px]",
            "disabled:pointer-events-none disabled:opacity-38",
            className,
          )}
          {...props}
        >
          <Help aria-hidden className="relative size-[18px]" />
        </button>
      </RichTooltipTrigger>
      <RichTooltipContent side={side} align={align} sideOffset={sideOffset}>
        {title ? <RichTooltipTitle>{title}</RichTooltipTitle> : null}
        <RichTooltipDescription>{children}</RichTooltipDescription>
        {actions ? <RichTooltipActions>{actions}</RichTooltipActions> : null}
      </RichTooltipContent>
    </RichTooltip>
  );
}

export { HelpButton };
