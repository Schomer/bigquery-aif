import * as React from "react";

import { OpenInNew } from "./material-symbols";
import { cn } from "./utils";

/**
 * Link — a hyperlink in the console's one link colour.
 *
 * `text-cm-link-default`, underlined, offset by 2px. AGENTS.md §3 gives that
 * pairing in prose and the kit had nowhere to put it: `KeyValueLink` and
 * `TableLink` each hold their own copy for their own context, and everything
 * else was an `<a>` with the classes typed out again. This is that `<a>`.
 *
 * It is a real anchor, always. There is no `onClick` variant and there should
 * not be — a `<span>` painted link-coloured loses middle-click, right-click-copy,
 * the status bar and the browser's own handling, which is the same argument
 * `Button`'s `asChild` makes from the other side.
 *
 * CDS's `cdsw-link` takes its label as a `text` property; here it is children,
 * because that is how JSX passes text and a `text` prop would fight it.
 */

export interface LinkProps extends React.ComponentProps<"a"> {
  /** A glyph beside the label, sized to 1em so it tracks the text. */
  icon?: React.ReactNode;
  /** Which side the icon sits on. CDS's `icon-position`. */
  iconPosition?: "before" | "after";
  /**
   * Open in a new tab, and say so with an `open_in_new` mark. The mark is the
   * point: a link that changes context without warning is the accessibility
   * complaint this component exists to not generate. It sits outside the
   * underline, because the underline belongs to the words.
   */
  newTab?: boolean;
  /**
   * Drop the underline until hover. For a link inside a dense run of them — a
   * nav list, a footer — where fifteen underlines are noise. Never for a link
   * inside a sentence: there, the underline is the only thing marking it.
   */
  subtle?: boolean;
}

function Link({
  className,
  children,
  icon,
  iconPosition = "before",
  newTab = false,
  subtle = false,
  target,
  rel,
  ...props
}: LinkProps) {
  const glyph = icon ? (
    <span aria-hidden className="[&>svg]:size-[1em] inline-flex shrink-0 items-center">
      {icon}
    </span>
  ) : null;

  return (
    <a
      data-slot="link"
      target={target ?? (newTab ? "_blank" : undefined)}
      rel={rel ?? (newTab ? "noreferrer" : undefined)}
      className={cn(
        "text-cm-link-default focus-visible:ring-cm-outline-focus/50 inline-flex items-center gap-1 rounded-sm outline-none focus-visible:ring-[3px]",
        className,
      )}
      {...props}
    >
      {iconPosition === "before" ? glyph : null}
      <span className={cn(subtle ? "hover:underline" : "underline", "underline-offset-2")}>
        {children}
      </span>
      {iconPosition === "after" ? glyph : null}
      {newTab ? <OpenInNew aria-hidden className="size-[1em] shrink-0" /> : null}
    </a>
  );
}

export { Link };
