import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import {
  CheckCircle,
  ErrorIcon,
  Info,
  OpenInNew,
  Warning,
  type MaterialSymbol,
} from "./material-symbols";

import { cn } from "./utils";

/**
 * Message — a filled status bar that states one thing about the surface it sits
 * on, optionally with actions.
 *
 * It is deliberately layout-agnostic: full width, no margin, no positioning, no
 * max width. Drop it at the top of a page, inside a Card, above a form field,
 * in a Subtask column or between table rows — the container decides where it
 * goes and how wide it is, the Message only decides how it reads.
 *
 * Not to be confused with the neighbours:
 *   Message  persistent, inline, part of the page — the state of what you are
 *            looking at.
 *   Snackbar transient, floating — something that just happened elsewhere.
 *   Callout  pointed at a specific element — teaching, not reporting.
 *   Dialog   blocks the page until answered.
 *
 * Five severities, every colour an exact cm token pair: a `status-*` accent for
 * the icon and its `status-*-container` for the bar. `destructive` inverts —
 * the loud colour becomes the bar — because it is the one severity that must
 * survive being skimmed past.
 */

type Severity = "info" | "success" | "warning" | "error" | "destructive";

const messageVariants = cva(
  // 52px single-line height = 10px here + 6px on the content column + a 20px
  // line, doubled. Splitting the padding across the two is what lets a 32px
  // action button land in the same 52px bar without a negative margin: the
  // content column and the action row are both 32px tall, so they align on
  // their own and the bar only ever grows when the text actually wraps.
  "text-cm-body-medium flex w-full items-start gap-6 rounded-[12px] px-6 py-2.5",
  {
    variants: {
      severity: {
        info: "bg-cm-status-neutral-container text-cm-on-surface",
        success: "bg-cm-status-success-container text-cm-on-surface",
        warning: "bg-cm-status-warning-container text-cm-on-surface",
        error: "bg-cm-status-error-container text-cm-on-surface",
        destructive: "bg-cm-status-destructive-container text-cm-on-primary dark:text-cm-on-surface",
      },
    },
    defaultVariants: {
      severity: "info",
    },
  },
);

/**
 * The filled variant of each severity glyph. In Material Symbols the fill axis
 * does not paint the counter in a second colour — it winds the inner mark
 * against the outer shape, so the `i`, the tick, the `!` are holes. One path,
 * one colour, and the bar itself shows through the glyph.
 */
const InfoFilled: MaterialSymbol = (props) => <Info filled {...props} />;
const CheckCircleFilled: MaterialSymbol = (props) => (
  <CheckCircle filled {...props} />
);
const WarningFilled: MaterialSymbol = (props) => <Warning filled {...props} />;
const ErrorFilled: MaterialSymbol = (props) => <ErrorIcon filled {...props} />;

/**
 * Per severity: which glyph, and the accent it is drawn in.
 *
 * The rule is the same for all five — the shape is filled with the accent and
 * the mark inside it is a hole, so it takes whatever colour the bar is with no
 * second class needed. That is why `destructive` reads as an inversion rather
 * than a sixth palette: its bar is the loud colour, so the knockout is too.
 *
 * `destructive` is the one severity that needs two tokens rather than one.
 * `status-destructive-container` is saturated in both themes — #d9257f light,
 * #b6213c dark — so the knockout has to stay light in both, but the canon has
 * no `on-destructive` role to say that. `on-primary` is white in light and
 * `on-surface` is near-white in dark, so the pair covers it without inventing
 * a forty-third token.
 */
const SEVERITY: Record<Severity, { icon: MaterialSymbol; iconClassName: string }> =
  {
    info: { icon: InfoFilled, iconClassName: "text-cm-status-neutral" },
    success: {
      icon: CheckCircleFilled,
      iconClassName: "text-cm-status-success",
    },
    warning: { icon: WarningFilled, iconClassName: "text-cm-status-warning" },
    error: { icon: ErrorFilled, iconClassName: "text-cm-status-error" },
    destructive: { icon: ErrorFilled, iconClassName: "text-cm-on-primary dark:text-cm-on-surface" },
  };

const MessageSeverityContext = React.createContext<Severity>("info");

export interface MessageProps
  extends React.ComponentProps<"div">,
    VariantProps<typeof messageVariants> {
  severity?: Severity;
}

/**
 * The bar. Screen readers are told about it the way its severity deserves:
 * `alert` interrupts, `status` waits for a pause — a failed save should not
 * have to queue behind whatever is being read out.
 */
function Message({ className, severity = "info", ...props }: MessageProps) {
  const urgent =
    severity === "warning" || severity === "error" || severity === "destructive";

  return (
    <MessageSeverityContext.Provider value={severity}>
      <div
        data-slot="message"
        data-severity={severity}
        role={urgent ? "alert" : "status"}
        aria-live={urgent ? "assertive" : "polite"}
        className={cn(messageVariants({ severity }), className)}
        {...props}
      />
    </MessageSeverityContext.Provider>
  );
}

export interface MessageIconProps extends React.ComponentProps<"svg"> {
  /** Swap the glyph but keep the severity's accent. */
  icon?: MaterialSymbol;
}

/**
 * Aligns to the first line of the text rather than to the centre of the bar, so
 * a message that wraps to three lines still reads as an icon followed by a
 * sentence instead of a mark floating beside a paragraph. `mt-2` clears the
 * content column's own 6px and then adds the 2px that centres a 16px glyph on a
 * 20px line.
 */
function MessageIcon({ className, icon, ...props }: MessageIconProps) {
  const severity = React.useContext(MessageSeverityContext);
  const { icon: DefaultIcon, iconClassName } = SEVERITY[severity];
  const Icon = icon ?? DefaultIcon;

  return (
    <Icon
      data-slot="message-icon"
      aria-hidden
      className={cn("mt-2 size-4 shrink-0", iconClassName, className)}
      {...props}
    />
  );
}

/**
 * The text column, and the only part that gives when space is tight — hence
 * `flex-1 min-w-0`, which is also what pushes a trailing `MessageActions` to
 * the right edge without an `ml-auto` that would misbehave once the same
 * component is nested here instead.
 *
 * Put `MessageActions` inside this column and the buttons stack under the
 * sentence; leave it a sibling of this column and they sit at the end of the
 * row. Both arrangements are in the reference and neither needs a prop.
 */
function MessageContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="message-content"
      className={cn(
        "flex min-w-0 flex-1 flex-col items-start gap-2 py-1.5",
        className,
      )}
      {...props}
    />
  );
}

/**
 * Action row. A 32px button is exactly as tall as the content column, so in the
 * trailing position the two align without any correction, and the bar stays
 * 52px whether or not it has buttons.
 */
function MessageActions({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="message-actions"
      className={cn("flex shrink-0 flex-wrap items-center gap-2", className)}
      {...props}
    />
  );
}

/**
 * Inline link inside the message text. Carries the external-link glyph by
 * default because in practice these point off the page; pass `external={false}`
 * for an in-app route.
 */
function MessageLink({
  className,
  children,
  external = true,
  ...props
}: React.ComponentProps<"a"> & { external?: boolean }) {
  const severity = React.useContext(MessageSeverityContext);

  return (
    <a
      data-slot="message-link"
      className={cn(
        "inline-flex items-baseline gap-1 underline underline-offset-2",
        // On the destructive bar the link tokens have nothing to sit on, so it
        // borrows the bar's own foreground and stays legible.
        severity === "destructive"
          ? "text-cm-on-primary dark:text-cm-on-surface"
          : "text-cm-link-default",
        className,
      )}
      {...props}
    >
      {children}
      {external && (
        <OpenInNew aria-hidden className="size-3.5 shrink-0 self-center" />
      )}
    </a>
  );
}

export { Message, MessageIcon, MessageContent, MessageActions, MessageLink, messageVariants };
