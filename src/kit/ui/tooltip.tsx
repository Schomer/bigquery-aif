import * as React from "react";

import { cn } from "./utils";

/**
 * Tooltip — the small dark label that names an unlabelled control.
 *
 * The kit already had `RichTooltip`, which is a hover *card*: a titled panel
 * with a paragraph and sometimes a link in it. This is the other one — one line,
 * no title, nothing to click, and the answer to "what does this icon button
 * do". Reaching for `RichTooltip` to say the word "Refresh" builds a popover
 * around three syllables.
 *
 * Inverse surface, `body-small`, 4px radius, 200px before it wraps — CDS's
 * `cdsw-tooltip` measured in tokens. It reads white-on-grey in light mode and
 * dark-on-light in dark mode, which is what `surface-inverse` is for.
 *
 * ### It is CSS, not a popper
 *
 * The panel is absolutely positioned against a wrapper and revealed by
 * `group-hover` / `group-focus-within`, so there is no JavaScript measuring
 * anything and no portal. CDS does the same — `position: fixed` set from a
 * `getBoundingClientRect` on hover, which is a popper's job description without
 * a popper. The trade is the trade CDS already made: a tooltip near the edge of
 * a scroll container can clip rather than flip. If the content is big enough
 * for that to matter, it is a `RichTooltip`, which *is* on Radix and does flip.
 *
 * ### Do not put it on a disabled button
 *
 * A disabled control fires no pointer events, so the tooltip explaining why it
 * is disabled never opens. Wrap it in an enabled element or say it inline.
 */

export type TooltipPosition = "top" | "bottom" | "left" | "right";

const POSITION_CLASS: Record<TooltipPosition, string> = {
  top: "bottom-full left-1/2 mb-2 -translate-x-1/2",
  bottom: "top-full left-1/2 mt-2 -translate-x-1/2",
  left: "right-full top-1/2 mr-2 -translate-y-1/2",
  right: "left-full top-1/2 ml-2 -translate-y-1/2",
};

export interface TooltipProps extends Omit<React.ComponentProps<"span">, "content"> {
  /** The line to show. Nothing renders when it is empty. */
  content: React.ReactNode;
  /** Which side of the trigger it opens on. CDS defaults to `bottom`. */
  position?: TooltipPosition;
  /** The thing being explained. */
  children: React.ReactNode;
}

function Tooltip({
  className,
  content,
  position = "bottom",
  children,
  ...props
}: TooltipProps) {
  // `useId` rather than a counter: two tooltips rendered by the same component
  // on a server and a client have to agree on the id, and a module-level
  // counter does not survive that.
  const id = React.useId();
  const empty = content === null || content === undefined || content === "";

  if (empty) return <>{children}</>;

  return (
    <span
      data-slot="tooltip"
      className={cn("group relative inline-flex align-middle", className)}
      {...props}
    >
      {/*
        `aria-describedby` and not `aria-label`: the tooltip describes the
        control, it does not rename it. On an icon button the accessible name
        comes from the button's own `aria-label`, and overwriting it here would
        leave the button unnamed the moment the tooltip is removed.
      */}
      <span aria-describedby={id} className="contents">
        {children}
      </span>
      <span
        id={id}
        role="tooltip"
        className={cn(
          "bg-cm-surface-inverse text-cm-on-surface-inverse text-cm-body-small pointer-events-none absolute z-50 w-max max-w-[200px] rounded-[4px] px-2 py-1.5",
          "invisible opacity-0 transition-opacity duration-150",
          "group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100",
          POSITION_CLASS[position],
        )}
      >
        {content}
      </span>
    </span>
  );
}

export { Tooltip };
