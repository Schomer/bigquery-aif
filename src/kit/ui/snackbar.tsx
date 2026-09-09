"use client";

import * as React from "react";
import { Toaster as SonnerToaster, toast as sonnerToast } from "sonner";

import { Button } from "./button";
import { Close } from "./material-symbols";
import { cn } from "./utils";

/**
 * A snackbar is a brief, low-priority confirmation that something happened —
 * "Query saved", "Copied to clipboard". It is drawn in `on-surface`, the page's
 * own text colour, so it reads as a system voice rather than as another card in
 * the page.
 *
 * It is deliberately not colour-coded by severity. Anything that needs a red
 * or a yellow needs to stay on screen and be read, which is `Message` (inline)
 * or `Callout` (anchored), not a bar that vanishes in four seconds.
 *
 * Two ways in:
 *   - `snackbar("Query saved")` — the usual case, queued and auto-dismissed.
 *     Needs `<SnackbarHost />` mounted once at the app root.
 *   - `<Snackbar>` — the bar itself, for a docked/inline placement or a demo.
 */

/** Height of the bar when it holds only a line of text. */
const BAR_MIN_HEIGHT = "min-h-12"; // 48px
/**
 * 14px top and bottom. Set by the two heights the design has to hit at once:
 * 20px of `body-medium` lands the bar on 48px, and a 32px `Button` action
 * lands it on 60px. Padding is the only value that satisfies both.
 */
const BAR_PADDING_Y = "py-[14px]";

export interface SnackbarProps extends React.ComponentProps<"div"> {
  /** One or two `SnackbarAction`s. More than two belongs in a dialog. */
  action?: React.ReactNode;
  /** Renders the dismiss glyph. Omit for a bar the user cannot close. */
  onClose?: () => void;
  closeLabel?: string;
}

function Snackbar({
  className,
  children,
  action,
  onClose,
  closeLabel = "Dismiss",
  ...props
}: SnackbarProps) {
  return (
    <div
      data-slot="snackbar"
      role="status"
      aria-live="polite"
      className={cn(
        "flex w-full items-center gap-4 rounded pl-4",
        BAR_MIN_HEIGHT,
        BAR_PADDING_Y,
        // The close target already carries 20px of its own breathing room, so
        // the bar only owes it 20px on the outside; text-only bars owe 16px.
        onClose ? "pr-5" : "pr-4",
        // `on-surface` as a background is deliberate: it and `on-surface-inverse`
        // are exact complements in both themes, so the bar is the page's text
        // colour and its text is the page's background — dark on light, light on
        // dark, with no per-mode rules.
        "bg-cm-on-surface text-cm-on-surface-inverse shadow-cm-elevation",
        // `font-sans` is not redundant: the bar renders inside sonner's portal,
        // whose container hard-codes a system font stack of its own.
        "font-sans text-cm-body-medium",
        className,
      )}
      {...props}
    >
      <div data-slot="snackbar-message" className="min-w-0 flex-1">
        {children}
      </div>
      {action && (
        <div
          data-slot="snackbar-actions"
          className="flex shrink-0 items-center gap-2"
        >
          {action}
        </div>
      )}
      {onClose && (
        <button
          type="button"
          data-slot="snackbar-close"
          aria-label={closeLabel}
          onClick={onClose}
          /**
           * A 48px round target holding a 24px glyph. `-my-[14px]` lets it
           * overlap the bar's vertical padding instead of stretching the bar
           * to 76px — it contributes 20px of height, same as a line of text.
           */
          className={cn(
            "-my-[14px] ml-1 flex size-12 shrink-0 items-center justify-center rounded-full",
            "text-cm-on-surface-inverse transition-colors",
            "hover:bg-cm-on-surface-inverse/8 active:bg-cm-on-surface-inverse/12",
            "outline-none focus-visible:ring-[3px] focus-visible:ring-cm-on-surface-inverse/40",
          )}
        >
          <Close className="size-6" aria-hidden />
        </button>
      )}
    </div>
  );
}

export type SnackbarActionProps = Omit<
  React.ComponentProps<typeof Button>,
  "variant" | "size"
>;

/**
 * The outlined button inside a snackbar. Fixed to `stroked-inverse` / `sm`
 * because a snackbar action has exactly one shape — pass `className` for
 * layout if you must, but not for colour or radius.
 */
function SnackbarAction({ className, ...props }: SnackbarActionProps) {
  return (
    <Button
      data-slot="snackbar-action"
      variant="stroked-inverse"
      className={className}
      {...props}
    />
  );
}

/**
 * Mount once, at the app root. Owns queueing, stacking and auto-dismiss;
 * `unstyled` hands the bar's appearance entirely to `Snackbar` above.
 *
 * Bottom centre. Centring takes two steps, because sonner only centres the
 * 560px container and then pins each bar to its left edge with `left: 0`. A
 * `w-fit` bar therefore lands 188px left of centre. `inset-x-0` + `mx-auto`
 * gives the absolutely positioned bar two offsets to sit between, which is
 * what makes `margin: auto` centre it. Scoped to `data-x-position=center`, so
 * overriding `position` to a corner still pins to that corner.
 */
function SnackbarHost({
  position = "bottom-center",
  ...props
}: React.ComponentProps<typeof SonnerToaster>) {
  return (
    <SonnerToaster
      position={position}
      offset={24}
      gap={12}
      /**
       * sonner sizes every toast to the container's `--width` (356px by
       * default). Widening the container and letting the bar shrink-to-fit
       * inside it is what gives a one-line snackbar a one-line width and a
       * two-action one room to stay on a single row.
       */
      style={{ "--width": "min(560px, calc(100vw - 48px))" } as React.CSSProperties}
      toastOptions={{
        unstyled: true,
        classNames: {
          toast: "w-fit data-[x-position=center]:inset-x-0 data-[x-position=center]:mx-auto",
        },
      }}
      {...props}
    />
  );
}

export interface SnackbarOptions {
  /** Primary action, e.g. `{ label: "Undo", onClick: revert }`. */
  action?: { label: string; onClick?: () => void };
  /** Secondary action, drawn to the left of `action`. */
  secondaryAction?: { label: string; onClick?: () => void };
  /** Milliseconds on screen. `Infinity` pins it until dismissed. */
  duration?: number;
  /** Set false for a bar with no dismiss glyph. */
  dismissible?: boolean;
  id?: string | number;
}

function show(message: React.ReactNode, options: SnackbarOptions = {}) {
  const {
    action,
    secondaryAction,
    dismissible = true,
    ...rest
  } = options;

  return sonnerToast.custom(
    (id) => {
      const dismiss = () => sonnerToast.dismiss(id);
      const run = (handler?: () => void) => () => {
        handler?.();
        dismiss();
      };
      return (
        <Snackbar
          onClose={dismissible ? dismiss : undefined}
          action={
            action || secondaryAction ? (
              <>
                {secondaryAction && (
                  <SnackbarAction onClick={run(secondaryAction.onClick)}>
                    {secondaryAction.label}
                  </SnackbarAction>
                )}
                {action && (
                  <SnackbarAction onClick={run(action.onClick)}>
                    {action.label}
                  </SnackbarAction>
                )}
              </>
            ) : undefined
          }
        >
          {message}
        </Snackbar>
      );
    },
    rest,
  );
}

/**
 * `snackbar("Saved")` — plus `.success` / `.error` / `.info` / `.warning`,
 * which exist so the ~20 call sites that already speak that dialect keep
 * working. They are aliases, not variants: every snackbar looks the same. Reach
 * for `Message` or `Callout` when the severity needs to be visible.
 */
const snackbar = Object.assign(show, {
  success: show,
  error: show,
  info: show,
  warning: show,
  message: show,
  custom: sonnerToast.custom,
  promise: sonnerToast.promise,
  loading: sonnerToast.loading,
  dismiss: sonnerToast.dismiss,
});

export { Snackbar, SnackbarAction, SnackbarHost, snackbar };
