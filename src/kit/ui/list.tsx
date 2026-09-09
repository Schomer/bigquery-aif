import * as React from "react";

import { cn } from "./utils";

/**
 * List — a bulleted, numbered or unmarked list, styled to the kit's type.
 *
 * A browser's default `<ul>` is 16px Times with a 40px indent and a bullet the
 * wrong size for a 20px line. Every page that writes one either lives with that
 * or re-solves it locally, so the kit solves it once: `body-medium`,
 * `on-surface`, a 20px indent, and 4px between items.
 *
 * ### Three variants, and they are not interchangeable
 *
 *   unordered   bullets. A set of things, in no particular order.
 *   ordered     numbers. Steps, where doing them out of order fails.
 *   plain       no marker. Lines that are a list semantically but read as prose.
 *
 * `plain` exists because a screen reader announcing "list, 3 items" is worth
 * keeping even when a bullet would be visual noise — a stack of links in a
 * footer, say. Reach for it instead of a `<div>` full of `<div>`s.
 *
 * ### `items` or children, not both
 *
 * Pass `items` for data — including nested `items`, which recurse and alternate
 * nothing: a nested list keeps its parent's variant, because a numbered list
 * whose sub-steps turn into bullets has lost the thread. Pass children when the
 * content is markup you are writing by hand, and use `ListItem` for each row.
 */

export interface ListItemData {
  text: React.ReactNode;
  /** A sub-list. Renders with the same variant and one more step of indent. */
  items?: ListItemData[];
}

// `ref` comes off with `type`: the root is a `<ul>` or an `<ol>` depending on
// the variant, and a ref typed to one of them will not fit the other.
export interface ListProps extends Omit<React.ComponentProps<"ul">, "type" | "ref"> {
  variant?: "unordered" | "ordered" | "plain";
  /** Data-driven content. Ignored when `children` is present. */
  items?: ListItemData[];
}

const MARKER_CLASS: Record<NonNullable<ListProps["variant"]>, string> = {
  unordered: "list-disc ps-5",
  ordered: "list-decimal ps-5",
  plain: "list-none ps-0",
};

function List({
  className,
  variant = "unordered",
  items,
  children,
  ...props
}: ListProps) {
  const content =
    children ??
    items?.map((item, index) => (
      // Index keys are fine here and only here: the list is rendered from a
      // prop in one pass with no reordering, no editing and no state per row,
      // so there is nothing for a stable key to preserve.
      <ListItem key={index}>
        {item.text}
        {item.items?.length ? <List variant={variant} items={item.items} /> : null}
      </ListItem>
    ));

  const listClasses = cn(
    "text-cm-body-medium text-cm-on-surface",
    MARKER_CLASS[variant],
    // A marked list stays `display: list-item` — flex on the list drops the
    // bullets in some engines — so its spacing comes from the gap between rows
    // rather than from `gap`. An unmarked one has no markers to lose.
    variant === "plain" ? "flex flex-col gap-1" : "space-y-1 [&_ol]:mt-1 [&_ul]:mt-1",
    className,
  );

  if (variant === "ordered") {
    return (
      <ol data-slot="list" className={listClasses} {...props}>
        {content}
      </ol>
    );
  }

  return (
    <ul data-slot="list" className={listClasses} {...props}>
      {content}
    </ul>
  );
}

/** One row. `marker:` tints the bullet so it does not out-weigh the text. */
function ListItem({ className, ...props }: React.ComponentProps<"li">) {
  return (
    <li
      data-slot="list-item"
      className={cn("marker:text-cm-on-surface-variant", className)}
      {...props}
    />
  );
}

export { List, ListItem };
