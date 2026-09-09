import * as React from "react";

import { cn } from "./utils";

/**
 * ItemList — a stack of rows, each a glyph, a title, a line of description and
 * somewhere to go.
 *
 * CDS calls this one `cm-list`, which in a kit where everything is already CM3
 * says nothing. It is the *rich* list: the "Recent datasets" panel, the
 * "Choose a data source" step, the list of docs under a help topic. Every row
 * is one target, and the description is part of the target, not a caption
 * beside it.
 *
 * ### How it differs from its neighbours
 *
 *   List        prose. Bullets, numbers, no interaction.
 *   Menu        a transient overlay of commands. Dismisses when you pick one.
 *   ItemList    permanent page content. Rows persist, and you can tab to them.
 *
 * ### Rows are links when they have an `href`
 *
 * A row with `href` renders an `<a>` and a row without one renders a
 * `<button>`, per row rather than per list — the same trade `RichCard` makes,
 * and for the same reason: middle-click and right-click-copy cannot be added
 * back to a `<div onClick>`. A list that has no `href` anywhere is a list of
 * actions and gets no navigation semantics it cannot honour.
 *
 * A `disabled` row is still a `<li>`, still announced, and not focusable. It
 * renders as a `<span>` even when it has an `href`, because a disabled `<a>` is
 * not a thing the platform has.
 */

export interface ItemListEntry {
  title: React.ReactNode;
  /** A second line under the title. Part of the row's hit target. */
  description?: React.ReactNode;
  /** Makes the row a link. Without it the row is a button. */
  href?: string;
  /** Only meaningful with `href`. */
  target?: React.HTMLAttributeAnchorTarget;
  /** A `MaterialSymbols` glyph on the leading edge. */
  prefixIcon?: React.ReactNode;
  /** A glyph on the trailing edge — a chevron, an `open_in_new`. */
  suffixIcon?: React.ReactNode;
  disabled?: boolean;
}

export interface ItemListProps extends Omit<React.ComponentProps<"ul">, "onSelect"> {
  items?: ItemListEntry[];
  /** Fired for rows without an `href`. Links navigate instead. */
  onSelect?: (item: ItemListEntry, index: number) => void;
  /** Hairlines between rows. Off by default — the hover tint already groups them. */
  divided?: boolean;
}

const ROW_CLASS = cn(
  "group/item-row flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left",
  "focus-visible:ring-cm-outline-focus/50 outline-none focus-visible:ring-[3px]",
);

const ENABLED_CLASS = "hover:bg-cm-on-surface/8 cursor-pointer transition-colors";

function ItemList({
  className,
  items = [],
  onSelect,
  divided = false,
  ...props
}: ItemListProps) {
  return (
    <ul
      data-slot="item-list"
      className={cn(
        "flex w-full list-none flex-col",
        divided && "[&>li]:border-cm-hairline [&>li]:border-b [&>li:last-child]:border-b-0",
        className,
      )}
      {...props}
    >
      {items.map((item, index) => {
        const body = (
          <>
            {item.prefixIcon && (
              <span
                aria-hidden
                className="text-cm-on-surface-variant [&>svg]:size-5 shrink-0"
              >
                {item.prefixIcon}
              </span>
            )}
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="text-cm-body-medium text-cm-on-surface truncate">
                {item.title}
              </span>
              {item.description && (
                <span className="text-cm-body-small text-cm-on-surface-variant truncate">
                  {item.description}
                </span>
              )}
            </span>
            {item.suffixIcon && (
              <span
                aria-hidden
                className="text-cm-on-surface-variant [&>svg]:size-5 shrink-0"
              >
                {item.suffixIcon}
              </span>
            )}
          </>
        );

        return (
          <li key={index} className="py-px">
            {item.disabled ? (
              // Not a `<button disabled>`: the row may carry an `href`, and the
              // one shape that is inert either way is a span. `aria-disabled`
              // is what actually announces it.
              <span aria-disabled className={cn(ROW_CLASS, "opacity-50")}>
                {body}
              </span>
            ) : item.href ? (
              <a
                href={item.href}
                target={item.target}
                rel={item.target === "_blank" ? "noreferrer" : undefined}
                className={cn(ROW_CLASS, ENABLED_CLASS)}
              >
                {body}
              </a>
            ) : (
              <button
                type="button"
                onClick={() => onSelect?.(item, index)}
                className={cn(ROW_CLASS, ENABLED_CLASS)}
              >
                {body}
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export { ItemList };
