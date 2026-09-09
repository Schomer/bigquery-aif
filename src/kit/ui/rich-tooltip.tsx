"use client";

import * as React from "react";
import * as RichTooltipPrimitive from "@radix-ui/react-hover-card";
import { Slot } from "@radix-ui/react-slot";
import { Close } from "./material-symbols";

import { cn } from "./utils";

/**
 * RichTooltip — a hover-triggered panel that can hold a title, prose, a link
 * and actions, where a plain tooltip can only hold a string.
 *
 * Measured off the Cloud rich-tooltip spec (a 2x screenshot, so every number
 * below is half what the pixels say): a 384px panel with a 12px radius, 16px
 * of padding all round, and the elevation shadow. The fill is
 * `surface-elevation` — the token for a surface floating above the page, the
 * same one the Menu panel uses.
 *
 * Type is two tokens and no more: `label-medium` for the title,
 * `body-medium` for the prose, both in `on-surface`. The dismiss glyph is
 * `on-surface-variant`, so it stays available without competing with the
 * title for attention.
 *
 * Two behaviours make this a rich tooltip rather than a hover card:
 *
 * The dismiss glyph is not optional. `RichTooltipContent` draws it itself,
 * absolutely positioned in the top-right, so no caller can compose a panel
 * that cannot be got rid of. The first block of content gets right padding to
 * clear it, which is why a title and a bare paragraph both stay out from
 * under the glyph.
 *
 * And hovering shows the panel while clicking pins it. A pinned panel ignores
 * every close the pointer asks for and only goes away on the dismiss glyph —
 * because a panel you clicked is a panel you meant to read, and reading it
 * means moving the pointer off the trigger and onto a link inside it.
 *
 * The Radix package keeps its upstream name — the primitive is
 * @radix-ui/react-hover-card regardless of what we call the component — and so
 * do the CSS custom properties it sets (--radix-hover-card-*).
 */

const RichTooltipContext = React.createContext<{
  close: () => void;
  pin: () => void;
}>({ close: () => {}, pin: () => {} });

function RichTooltip({
  open,
  defaultOpen,
  onOpenChange,
  /**
   * Longer than Radix's 700ms default on the way out: an unpinned panel with a
   * link in it still has to survive the diagonal trip from trigger to link.
   */
  openDelay = 300,
  closeDelay = 300,
  ...props
}: React.ComponentProps<typeof RichTooltipPrimitive.Root>) {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(
    defaultOpen ?? false,
  );
  const [pinned, setPinned] = React.useState(false);

  const isControlled = open !== undefined;
  const isOpen = isControlled ? open : uncontrolledOpen;

  const setOpen = React.useCallback(
    (next: boolean) => {
      if (!isControlled) setUncontrolledOpen(next);
      onOpenChange?.(next);
    },
    [isControlled, onOpenChange],
  );

  /**
   * Radix asks to close whenever the pointer leaves the trigger or the panel.
   * A pinned panel refuses; only `close` gets it back down.
   */
  const handleOpenChange = React.useCallback(
    (next: boolean) => {
      if (!next && pinned) return;
      setOpen(next);
    },
    [pinned, setOpen],
  );

  const context = React.useMemo(
    () => ({
      close: () => {
        setPinned(false);
        setOpen(false);
      },
      pin: () => {
        setPinned(true);
        setOpen(true);
      },
    }),
    [setOpen],
  );

  return (
    <RichTooltipContext.Provider value={context}>
      <RichTooltipPrimitive.Root
        data-slot="rich-tooltip"
        open={isOpen}
        onOpenChange={handleOpenChange}
        openDelay={openDelay}
        closeDelay={closeDelay}
        {...props}
      />
    </RichTooltipContext.Provider>
  );
}

/**
 * Hovering opens the panel; clicking pins it. The click is additive — whatever
 * the trigger already did on click still happens.
 */
function RichTooltipTrigger({
  onClick,
  ...props
}: React.ComponentProps<typeof RichTooltipPrimitive.Trigger>) {
  const { pin } = React.useContext(RichTooltipContext);

  return (
    <RichTooltipPrimitive.Trigger
      data-slot="rich-tooltip-trigger"
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) pin();
      }}
      {...props}
    />
  );
}

function RichTooltipContent({
  className,
  children,
  align = "center",
  sideOffset = 8,
  ...props
}: React.ComponentProps<typeof RichTooltipPrimitive.Content>) {
  return (
    <RichTooltipPrimitive.Portal data-slot="rich-tooltip-portal">
      <RichTooltipPrimitive.Content
        data-slot="rich-tooltip-content"
        align={align}
        sideOffset={sideOffset}
        className={cn(
          "bg-cm-surface-elevation text-cm-on-surface shadow-cm-elevation",
          // 384px is the spec width. The viewport clamp is for the narrow
          // case, where a fixed 384 would push the panel off-screen.
          "relative z-50 w-96 max-w-[calc(100vw-2rem)] rounded-[12px] p-4 outline-hidden",
          // Whatever comes first — a title, or a bare paragraph — keeps clear
          // of the dismiss glyph in the corner.
          "[&>*:first-child]:pr-8",
          "origin-(--radix-hover-card-content-transform-origin)",
          "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
          "data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
          className,
        )}
        {...props}
      >
        {children}
        <RichTooltipDismiss />
      </RichTooltipPrimitive.Content>
    </RichTooltipPrimitive.Portal>
  );
}

/** Title. Optional — a panel of pure prose is a legitimate rich tooltip. */
function RichTooltipTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="rich-tooltip-title"
      className={cn("text-cm-label-medium text-cm-on-surface", className)}
      {...props}
    />
  );
}

/**
 * Prose. `mt-4` rather than a gap on a wrapper so the title can be used alone
 * without leaving a stray gap behind it.
 */
function RichTooltipDescription({
  className,
  ...props
}: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="rich-tooltip-description"
      className={cn(
        "text-cm-body-medium text-cm-on-surface mt-4 first:mt-0",
        className,
      )}
      {...props}
    />
  );
}

/**
 * Optional action row. Left-aligned rather than right: these are offers to
 * read on, not a decision the panel is waiting for, and the reading eye is
 * already at the left edge. Same shape as `CalloutActions`, so a text button
 * sits the same way in both.
 */
function RichTooltipActions({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="rich-tooltip-actions"
      className={cn("mt-4 flex flex-wrap items-center gap-2", className)}
      {...props}
    />
  );
}

/** The dismiss glyph `RichTooltipContent` always draws. Not exported: a rich
 *  tooltip that cannot be dismissed should not be constructible. */
function RichTooltipDismiss() {
  const { close } = React.useContext(RichTooltipContext);

  return (
    <button
      type="button"
      data-slot="rich-tooltip-dismiss"
      aria-label="Close"
      onClick={close}
      className={cn(
        "text-cm-on-surface-variant hover:bg-cm-container absolute top-3 right-3 flex size-8 cursor-pointer items-center justify-center rounded-full p-1 outline-none transition-colors",
        "focus-visible:ring-4 focus-visible:ring-cm-primary/20",
      )}
    >
      <Close className="size-6" aria-hidden />
    </button>
  );
}

/**
 * Makes anything close the panel — a "Dismiss" button in the actions row, say.
 * The glyph in the corner is automatic; this is for the second, deliberate
 * way out.
 */
function RichTooltipClose({
  asChild,
  onClick,
  ...props
}: React.ComponentProps<"button"> & { asChild?: boolean }) {
  const { close } = React.useContext(RichTooltipContext);
  const Comp = asChild ? Slot : "button";

  return (
    <Comp
      data-slot="rich-tooltip-close"
      onClick={(event: React.MouseEvent<HTMLButtonElement>) => {
        onClick?.(event);
        if (!event.defaultPrevented) close();
      }}
      {...props}
    />
  );
}

/** A link inside the prose, in the token the system reserves for links. */
function RichTooltipLink({ className, ...props }: React.ComponentProps<"a">) {
  return (
    <a
      data-slot="rich-tooltip-link"
      className={cn(
        "text-cm-link-default underline underline-offset-2 outline-none",
        "focus-visible:ring-4 focus-visible:ring-cm-primary/20 rounded-xs",
        className,
      )}
      {...props}
    />
  );
}

export {
  RichTooltip,
  RichTooltipTrigger,
  RichTooltipContent,
  RichTooltipTitle,
  RichTooltipDescription,
  RichTooltipActions,
  RichTooltipClose,
  RichTooltipLink,
};
