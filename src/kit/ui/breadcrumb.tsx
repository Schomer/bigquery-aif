import * as React from "react";
import { Slot } from "@radix-ui/react-slot";

import { ChevronRight, MoreHoriz } from "./material-symbols";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "./menu";
import { cn } from "./utils";

/**
 * The trail of where you are: a row of ancestors, then the page you are on.
 *
 *   <Breadcrumb>
 *     <BreadcrumbList>
 *       <BreadcrumbItem>
 *         <BreadcrumbLink href="/bq"><Database /> BigQuery</BreadcrumbLink>
 *       </BreadcrumbItem>
 *       <BreadcrumbItem>
 *         <BreadcrumbLink href="/bq/prod">analytics_prod</BreadcrumbLink>
 *       </BreadcrumbItem>
 *       <BreadcrumbItem>
 *         <BreadcrumbPage>events_2026_08</BreadcrumbPage>
 *       </BreadcrumbItem>
 *     </BreadcrumbList>
 *   </Breadcrumb>
 *
 * ### You do not write the separators
 *
 * `BreadcrumbList` puts one between every pair of items. A trail with a
 * separator missing, doubled, or pointing the wrong way is the whole failure
 * mode of hand-written breadcrumbs, and there is nothing a caller can usefully
 * decide there except the style — which is a prop on the root:
 *
 *   <Breadcrumb separator="slash">
 *
 * `chevron` is the default and reads as "down into"; `slash` is for paths that
 * really are paths — buckets, folders, table names. Pick one per page.
 *
 * ### Icons and eyebrows
 *
 * An icon is just the first child of the link, sized by the component to 20px:
 * `<BreadcrumbLink><Folder /> assets</BreadcrumbLink>`. It is optional, and it
 * is all-or-nothing — one item with an icon in a row of six without looks like
 * a bug rather than an emphasis.
 *
 * An eyebrow is a 12px line above the label saying what kind of thing the item
 * is, for trails where the names alone are not self-describing. Items with and
 * without one sit in the same row; the short ones centre against the tall ones.
 *
 * ### A trail too long to show
 *
 * Drop the middle levels into a `BreadcrumbEllipsis` and it becomes a "…"
 * button that opens a menu of them. The first and last levels are the two that
 * carry the meaning; the ones between are the ones a reader occasionally wants
 * to jump to, and a menu is where those go.
 *
 * ### Colour carries the "you are here"
 *
 * Everything is `on-surface-variant` except the item holding the
 * `BreadcrumbPage`, which goes `on-surface` — eyebrow included, which is why
 * the colour is set on the item rather than on the page itself.
 */

type BreadcrumbSeparatorStyle = "chevron" | "slash";

const SeparatorStyleContext =
  React.createContext<BreadcrumbSeparatorStyle>("chevron");

function Breadcrumb({
  separator = "chevron",
  ...props
}: React.ComponentProps<"nav"> & { separator?: BreadcrumbSeparatorStyle }) {
  return (
    <SeparatorStyleContext.Provider value={separator}>
      <nav aria-label="breadcrumb" data-slot="breadcrumb" {...props} />
    </SeparatorStyleContext.Provider>
  );
}

function BreadcrumbList({
  className,
  children,
  ...props
}: React.ComponentProps<"ol">) {
  const items = React.Children.toArray(children);

  return (
    <ol
      data-slot="breadcrumb-list"
      className={cn(
        "text-cm-body-medium text-cm-on-surface-variant flex flex-wrap items-center gap-2 break-words",
        className,
      )}
      {...props}
    >
      {items.map((child, i) => (
        // `toArray` has already given every child a stable key, so the fragment
        // can borrow it rather than fall back to the index.
        <React.Fragment key={(child as React.ReactElement).key ?? i}>
          {i > 0 && <BreadcrumbSeparator />}
          {child}
        </React.Fragment>
      ))}
    </ol>
  );
}

function BreadcrumbItem({ className, ...props }: React.ComponentProps<"li">) {
  return (
    <li
      data-slot="breadcrumb-item"
      // A column, because an item may be an eyebrow stacked on a label. With
      // one child it is indistinguishable from a row, so there is no second
      // variant to choose between.
      className={cn(
        "has-[[data-slot=breadcrumb-page]]:text-cm-on-surface flex flex-col justify-center",
        className,
      )}
      {...props}
    />
  );
}

/** The kind of thing this item is, above its name. Optional. */
function BreadcrumbEyebrow({
  className,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="breadcrumb-eyebrow"
      // No colour of its own: it takes the item's, so it darkens along with
      // the label on the item you are actually on.
      className={cn("text-cm-body-small", className)}
      {...props}
    />
  );
}

function BreadcrumbLink({
  asChild,
  className,
  ...props
}: React.ComponentProps<"a"> & {
  asChild?: boolean;
}) {
  const Comp = asChild ? Slot : "a";

  return (
    <Comp
      data-slot="breadcrumb-link"
      className={cn(
        "hover:text-cm-on-surface inline-flex items-center gap-1 transition-colors [&>svg]:size-5 [&>svg]:shrink-0",
        className,
      )}
      {...props}
    />
  );
}

/** The page you are on: the last item, and the only one that is not a link. */
function BreadcrumbPage({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="breadcrumb-page"
      role="link"
      aria-disabled="true"
      aria-current="page"
      // `label-medium` is `body-medium` at weight 500 — same size, so the row
      // does not change height, but the end of the trail reads as the end.
      // The colour comes from the item.
      className={cn(
        "text-cm-label-medium inline-flex items-center gap-1 [&>svg]:size-5 [&>svg]:shrink-0",
        className,
      )}
      {...props}
    />
  );
}

/**
 * Internal: `BreadcrumbList` puts these in. See the note at the top of the
 * file for why a caller does not.
 */
function BreadcrumbSeparator() {
  const style = React.useContext(SeparatorStyleContext);

  return (
    <li data-slot="breadcrumb-separator" role="presentation" aria-hidden="true">
      {style === "slash" ? (
        // A literal slash rather than an icon, so it sits on the text baseline
        // and scales with the row instead of floating beside it.
        <span className="select-none">/</span>
      ) : (
        <ChevronRight className="size-5" />
      )}
    </li>
  );
}

/**
 * Stands in for the middle of a trail too long to show — and, given the items
 * it stood in for, hands them back:
 *
 *   <BreadcrumbItem>
 *     <BreadcrumbEllipsis>
 *       <BreadcrumbMenuItem href="/bq/prod">analytics_prod</BreadcrumbMenuItem>
 *       <BreadcrumbMenuItem href="/bq/prod/exports">exports</BreadcrumbMenuItem>
 *     </BreadcrumbEllipsis>
 *   </BreadcrumbItem>
 *
 * With children it is a real button that opens a `Menu` of them; with none it
 * is the flat glyph it used to be. Pass the children whenever you have them —
 * a "…" that cannot be clicked tells the reader that levels were dropped and
 * then refuses to say which, which is worse than not truncating.
 */
function BreadcrumbEllipsis({
  className,
  children,
  label = "Show hidden levels",
  ...props
}: Omit<React.ComponentProps<"button">, "children"> & {
  children?: React.ReactNode;
  /** The button's accessible name. It has no visible text. */
  label?: string;
}) {
  if (!children) {
    return (
      <span
        data-slot="breadcrumb-ellipsis"
        role="presentation"
        aria-hidden="true"
        className={cn("relative inline-flex items-center", className)}
      >
        <MoreHoriz className="size-5" />
        {/* `relative` above, because `sr-only` is `position: absolute` with no
            offsets. Without a positioned parent it resolves against whatever
            ancestor happens to be positioned — in a full-page layout, the frame
            itself — and a 1px box parked thousands of pixels down gives that
            ancestor a scroll height it should not have. */}
        <span className="sr-only">More</span>
      </span>
    );
  }

  return (
    <Menu>
      <MenuTrigger asChild>
        <button
          type="button"
          data-slot="breadcrumb-ellipsis"
          aria-label={label}
          // `-m-1 p-1` grows the hit area from the glyph's 20px to 28px
          // without moving anything: the padding pushes the border box out and
          // the negative margin pulls the layout box back, so the 8px gaps
          // either side stay 8px. Open, it holds the hover colour, because the
          // panel below it is the thing being pointed at.
          className={cn(
            "hover:text-cm-on-surface focus-visible:ring-cm-outline-focus/50 data-[state=open]:text-cm-on-surface -m-1 inline-flex cursor-pointer items-center rounded-md p-1 outline-none transition-colors focus-visible:ring-[3px]",
            className,
          )}
          {...props}
        >
          <MoreHoriz className="size-5" />
        </button>
      </MenuTrigger>
      {/* `start`, so the panel's left edge lines up with the glyph and the
          names read as a continuation of the trail rather than a popover
          floating over the middle of it. */}
      <MenuContent align="start">{children}</MenuContent>
    </Menu>
  );
}

/**
 * One collapsed level, inside a `BreadcrumbEllipsis`. A plain menu row: it
 * follows the menu's rules, not the trail's, so an icon here is the menu's
 * 16px rather than the 20px it would be in a `BreadcrumbLink`.
 *
 * Give it an `href` and it is a link; leave it off and handle `onSelect`.
 */
function BreadcrumbMenuItem({
  href,
  children,
  ...props
}: React.ComponentProps<typeof MenuItem> & { href?: string }) {
  if (href === undefined) {
    return (
      <MenuItem data-slot="breadcrumb-menu-item" {...props}>
        {children}
      </MenuItem>
    );
  }

  return (
    <MenuItem data-slot="breadcrumb-menu-item" asChild {...props}>
      {/* The row is the anchor rather than containing one, so the whole 32px
          is the click target and a middle-click opens the level in a tab. */}
      <a href={href}>{children}</a>
    </MenuItem>
  );
}

export {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbEyebrow,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbEllipsis,
  BreadcrumbMenuItem,
};
