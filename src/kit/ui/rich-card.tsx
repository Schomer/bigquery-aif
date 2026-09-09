import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "./utils";

/**
 * RichCard — an icon, a title, a subtitle and a body, in a box you can click.
 *
 * The console's landing pages are built out of these: "Create a dataset", "Run
 * a query", "Connect a data source", each a card with a mark and two lines of
 * copy. It is the *whole card* that is the target, not a button inside it.
 *
 * ### How it differs from `Card`
 *
 *   Card       a tinted grouping. `surface-variant`, no border, not clickable.
 *   RichCard   a destination. Outlined by default, and usually an `<a>`.
 *
 * That is why this one is allowed the hairline `Card` is explicitly denied: the
 * border here is not decoration restating the tint, it is the edge of a hit
 * target, and a reader has to be able to see where it stops.
 *
 * ### Pass `href` and it becomes a link
 *
 * A card that navigates renders as an `<a>` wrapping the whole thing, which is
 * the same argument `Button`'s `asChild` makes: middle-click, right-click-copy
 * and the status bar all come free, and none of them can be added back to a
 * `<div onClick>`. Pass `onClick` without `href` and it becomes a `<button>`
 * instead. With neither it is a plain box.
 */

const richCardVariants = cva(
  cn(
    "group/rich-card flex w-full flex-col gap-3 rounded-[12px] p-4 text-left",
    "focus-visible:ring-cm-outline-focus/50 outline-none focus-visible:ring-[3px]",
  ),
  {
    variants: {
      appearance: {
        outlined: "border-cm-hairline bg-cm-surface border",
        filled: "bg-cm-surface-variant",
        /** Higher-emphasis — the one card on a page that is the recommendation. */
        elevated: "bg-cm-surface shadow-cm-elevation",
      },
      interactive: {
        true: "hover:bg-cm-on-surface/8 cursor-pointer transition-colors",
        false: "",
      },
    },
    defaultVariants: {
      appearance: "outlined",
      interactive: false,
    },
  },
);

export interface RichCardProps
  extends Omit<React.ComponentProps<"div">, "title" | "onClick">,
    Omit<VariantProps<typeof richCardVariants>, "interactive"> {
  /**
   * Widened to `HTMLElement` because the card renders as a `<div>`, a
   * `<button>` or an `<a>` depending on its props, and a handler typed to the
   * div would not fit the button it turns into.
   */
  onClick?: React.MouseEventHandler<HTMLElement>;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  /** A `MaterialSymbols` glyph. Sized and tinted by the card. */
  icon?: React.ReactNode;
  /** Makes the whole card a link. */
  href?: string;
  /** Opens in a new tab. Only meaningful with `href`. */
  newTab?: boolean;
  /** A button or menu in the top-right, beside the title. */
  action?: React.ReactNode;
  /** A footer row — buttons, a link, a `Tag`. */
  footer?: React.ReactNode;
}

function RichCard({
  className,
  appearance,
  title,
  subtitle,
  icon,
  href,
  newTab = false,
  action,
  footer,
  children,
  onClick,
  ...props
}: RichCardProps) {
  const interactive = Boolean(href || onClick);

  const body = (
    <>
      {(title || subtitle || icon || action) && (
        <header className="flex items-start gap-3">
          {icon && (
            // 36px tinted square. The container is `container-primary` rather
            // than a status colour: the mark says what the card is about, not
            // whether anything is wrong.
            <span className="bg-cm-container-primary text-cm-primary-on-container [&>svg]:size-5 flex size-9 shrink-0 items-center justify-center rounded-lg">
              {icon}
            </span>
          )}
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            {title && (
              <h3 className="text-cm-title-small text-cm-on-surface">{title}</h3>
            )}
            {subtitle && (
              <p className="text-cm-body-small text-cm-on-surface-variant">{subtitle}</p>
            )}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </header>
      )}
      {children && (
        <div className="text-cm-body-medium text-cm-on-surface-variant">{children}</div>
      )}
      {footer && <div className="flex flex-wrap items-center gap-2">{footer}</div>}
    </>
  );

  const classes = cn(richCardVariants({ appearance, interactive }), className);

  if (href) {
    return (
      <a
        data-slot="rich-card"
        href={href}
        target={newTab ? "_blank" : undefined}
        rel={newTab ? "noreferrer" : undefined}
        className={classes}
      >
        {body}
      </a>
    );
  }

  if (onClick) {
    return (
      <button data-slot="rich-card" type="button" onClick={onClick} className={classes}>
        {body}
      </button>
    );
  }

  return (
    <div data-slot="rich-card" className={classes} {...props}>
      {body}
    </div>
  );
}

export { RichCard, richCardVariants };
