import * as React from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { ArrowDownward, ArrowUpward, ViewColumn } from "./material-symbols";

import { Button } from "./button";
import { Checkbox } from "./checkbox";
import { MENU_PANEL, MENU_SEPARATOR } from "./menu";
import { cn } from "./utils";

/**
 * Table — the dense data grid from the Cloud reference.
 *
 * Every number here is measured off the reference screenshots rather than
 * guessed, and they all reduce to one figure: a **29px row pitch**, which is a
 * 28px band plus the 1px hairline under it. A 14px body line is 20px tall, so
 * 28px is that line with 4px of air above and below — the table is as tight as
 * the type allows and no tighter. Header rows are the same 28px, so a header
 * and a body row are interchangeable slices of the same rhythm.
 *
 * Cells are therefore `h-[29px]` and not `h-7`: the row's hairline is laid out
 * *inside* the row box, so 28px of cell buys you a 27px band and a rule, and
 * the pitch comes out a pixel short over every row in the table.
 *
 * Horizontally there is a single number too: **16px of padding on every cell**,
 * header and body alike. That is what puts a column heading and the values
 * under it on one text edge, which is the thing that makes a table scannable.
 *
 * Colour is three tokens and no more:
 *   container            the header band
 *   surface              the body
 *   hairline             every rule, at 1px
 * and two for text: `on-surface` for headings (label-medium, so 14px/500) and
 * `on-surface-variant` for values (body-medium, 14px/400). Headings are the
 * darker of the two even though they are the smaller amount of text, because
 * the band behind them is already lighter than the body's white.
 *
 * The parts split along the lines the reference splits along:
 *
 *   TableFrame       the rounded, clipping shell — rounds whatever is on top
 *   TableTitleBar    a title and its page actions
 *   TableToolbar     the filter strip, and the help / column-picker cluster
 *   Table            the grid itself
 *   Pagination       (pagination.tsx) the bar underneath
 *
 * All four of the outer ones are layout only. A table with none of them is
 * still a table — that is the "basic table" reference — so nothing above is
 * required to render one.
 */

/**
 * The rounded shell. Only the top corners are rounded because in every
 * reference the bottom of the stack is either a pagination bar that runs to the
 * page edge or the last row's own hairline; the 12px is an opening flourish,
 * not a border.
 *
 * It rounds whatever happens to be first, which is why the inner table's
 * container is forced square here: a standalone `<Table>` rounds its own header
 * band, and the moment a toolbar sits above it that rounding has to move up to
 * the toolbar instead. One selector does that, so composing the stack never
 * needs a `rounded-none` at the call site.
 *
 * `shrink-0` is not optional, and it is the least obvious line in this file.
 * The `overflow-hidden` that clips those corners also zeroes the frame's
 * `min-height: auto` — that is what the spec says an overflow other than
 * `visible` does — so inside a `flex-col` screen the frame will happily squash
 * to less than its own rows and clip the rest away. Nothing scrolls, because
 * nothing thinks it overflowed. `shrink-0` makes the frame as tall as its
 * content and lets the screen's own `overflow-auto` do the scrolling, which is
 * the arrangement `InstancesScreen` and every list page after it depends on.
 */
function TableFrame({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="table-frame"
      className={cn(
        "bg-cm-surface w-full shrink-0 overflow-hidden rounded-t-[12px]",
        "[&_[data-slot=table-container]]:rounded-none",
        className,
      )}
      {...props}
    />
  );
}

/**
 * Title and page actions. 48px because that is a 32px button with 8px of air,
 * and the actions are the tallest thing it ever holds — a title on its own
 * would not justify the height, but a bar that changes height when you add a
 * button would be worse.
 */
function TableTitleBar({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="table-title-bar"
      className={cn(
        "border-cm-hairline flex min-h-12 flex-wrap items-center gap-3 border-b px-4 py-2",
        className,
      )}
      {...props}
    />
  );
}

function TableTitle({ className, ...props }: React.ComponentProps<"h2">) {
  return (
    <h2
      data-slot="table-title"
      className={cn("text-cm-title-medium text-cm-on-surface mr-1", className)}
      {...props}
    />
  );
}

/**
 * The filter strip. 40px — shorter than the title bar above it and taller than
 * a row below it, so the stack reads as heading, controls, data without any of
 * the three needing a rule to explain itself.
 */
function TableToolbar({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="table-toolbar"
      className={cn(
        "border-cm-hairline flex h-10 items-center gap-2 border-b px-4",
        className,
      )}
      {...props}
    />
  );
}

/**
 * The 32px round icon button used by the toolbar's help and column-picker
 * controls — and, deliberately, by the pager buttons, which import this rather
 * than restate it. They are the same control in two bars of the same stack, and
 * a table whose top-right and bottom-right buttons hover differently is a table
 * with a bug in it.
 *
 * `Button variant="ghost"` is the wrong neighbour here: it is a rounded
 * rectangle in `primary-on-container`, and these are round and
 * `on-surface-variant` in every reference — chrome, not actions.
 */
const TABLE_ICON_BUTTON =
  "text-cm-on-surface-variant hover:bg-cm-container focus-visible:ring-cm-outline-focus/50 inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full outline-none transition-colors focus-visible:ring-[3px] disabled:pointer-events-none disabled:opacity-38";

/**
 * `forwardRef` because this is what the column picker hangs off: on React 18 a
 * plain function component swallows the ref, and a Radix popover with no
 * measurable anchor renders its panel off-screen rather than under the button.
 */
const TableToolbarButton = React.forwardRef<
  HTMLButtonElement,
  React.ComponentProps<"button">
>(function TableToolbarButton({ className, type = "button", ...props }, ref) {
  return (
    <button
      ref={ref}
      data-slot="table-toolbar-button"
      type={type}
      className={cn(TABLE_ICON_BUTTON, className)}
      {...props}
    />
  );
});

/** The short vertical rule between the toolbar's help and column-picker. */
function TableToolbarSeparator({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="table-toolbar-separator"
      role="separator"
      aria-orientation="vertical"
      className={cn("bg-cm-hairline mx-2 h-5 w-px shrink-0", className)}
      {...props}
    />
  );
}

export interface TableColumnOption {
  /** Matches the key the caller uses to decide whether to render the column. */
  id: string;
  label: React.ReactNode;
  /** A column the user may not hide — drawn checked and disabled. */
  locked?: boolean;
}

export interface TableColumnMenuProps {
  columns: TableColumnOption[];
  /** Ids of the currently shown columns. */
  value: string[];
  /** Fired once, on OK — not on every tick. */
  onChange: (value: string[]) => void;
  title?: string;
  /** Replaces the default toolbar button. Must accept a ref and a click. */
  children?: React.ReactNode;
  triggerLabel?: string;
  align?: React.ComponentProps<typeof PopoverPrimitive.Content>["align"];
  sideOffset?: number;
  className?: string;
}

/**
 * The toolbar's column picker: which columns the grid draws.
 *
 * Built on Popover rather than Menu even though it looks like one. A menu
 * commits on every click and hands focus around with the arrow keys; this
 * reference has Cancel and OK, which makes it a small form — edits are staged
 * in a draft and only reach the caller when OK is pressed. Radix's menu content
 * also calls `preventDefault()` on Tab, so a real `Checkbox` or `Button` inside
 * one is reachable by mouse and by nothing else. A popover traps focus and lets
 * Tab through, so the controls here are the house `Checkbox` and `Button`.
 *
 * It still wears the menu's surface — `MENU_PANEL` and `MENU_SEPARATOR` are
 * imported rather than restated, so the panel that opens off a table is the
 * same object as the panel that opens off a menu button. Rows are the menu's
 * 32px on the menu's 16px padding for the same reason.
 */
function TableColumnMenu({
  columns,
  value,
  onChange,
  title = "Displayed columns",
  children,
  triggerLabel = "Choose columns",
  align = "end",
  sideOffset = 4,
  className,
}: TableColumnMenuProps) {
  const [open, setOpen] = React.useState(false);
  const [draft, setDraft] = React.useState<string[]>(value);

  // Opening is what seeds the draft, so a cancelled edit leaves nothing behind
  // and the next open starts from what the table is actually showing.
  const handleOpenChange = (next: boolean) => {
    if (next) setDraft(value);
    setOpen(next);
  };

  const shown = new Set(draft);
  const toggleable = columns.filter((column) => !column.locked);
  const shownCount = columns.filter((column) => shown.has(column.id)).length;
  const allShown = shownCount === columns.length;

  const setColumn = (id: string, on: boolean) =>
    setDraft((prev) =>
      on
        ? columns.filter((c) => c.id === id || prev.includes(c.id)).map((c) => c.id)
        : prev.filter((existing) => existing !== id),
    );

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={handleOpenChange}>
      <PopoverPrimitive.Trigger asChild>
        {children ?? (
          <TableToolbarButton
            title={triggerLabel}
            aria-label={triggerLabel}
            data-slot="table-column-menu-trigger"
          >
            <ViewColumn filled aria-hidden className="size-[18px]" />
          </TableToolbarButton>
        )}
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          data-slot="table-column-menu"
          aria-label={title}
          align={align}
          sideOffset={sideOffset}
          className={cn(
            MENU_PANEL,
            "min-w-[192px] origin-(--radix-popover-content-transform-origin)",
            className,
          )}
        >
          <div className="text-cm-label-medium text-cm-on-surface flex h-8 items-center px-4">
            {title}
          </div>

          <TableColumnMenuRow
            label={
              allShown
                ? `All ${columns.length} selected`
                : `${shownCount} of ${columns.length} selected`
            }
            checked={allShown ? true : shownCount > 0 ? "indeterminate" : false}
            onCheckedChange={(checked) =>
              setDraft(
                checked
                  ? columns.map((column) => column.id)
                  : columns.filter((column) => column.locked).map((column) => column.id),
              )
            }
            disabled={toggleable.length === 0}
          />

          <div role="separator" className={MENU_SEPARATOR} />

          {columns.map((column) => (
            <TableColumnMenuRow
              key={column.id}
              label={column.label}
              checked={shown.has(column.id)}
              disabled={column.locked}
              onCheckedChange={(checked) => setColumn(column.id, checked === true)}
            />
          ))}

          {/* 8px above the buttons and 16px below, so the panel's own `py-2`
              tops the footer up to the 16px the sides already have. */}
          <div className="flex items-center justify-end gap-2 px-4 pt-2 pb-2">
            <Button
              variant="stroked"
              onClick={() => handleOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                onChange(draft);
                setOpen(false);
              }}
            >
              OK
            </Button>
          </div>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}

/**
 * One row of the picker. A `<label>` rather than a row with a checkbox in it,
 * so the whole 32px band is the target and the label is the checkbox's name
 * without an id to thread between them.
 */
function TableColumnMenuRow({
  label,
  ...props
}: React.ComponentProps<typeof Checkbox> & { label: React.ReactNode }) {
  return (
    <label
      data-slot="table-column-menu-row"
      className={cn(
        "flex h-8 cursor-pointer items-center gap-3 px-4 transition-colors select-none",
        "hover:bg-cm-container-high has-[:disabled]:cursor-not-allowed",
      )}
    >
      <Checkbox {...props} />
      <span className="text-cm-body-medium text-cm-on-surface truncate">
        {label}
      </span>
    </label>
  );
}

/**
 * `overflow-x-auto` rather than a fixed layout: the reference's widest table
 * scrolls sideways under its own scrollbar while the toolbar and the pager stay
 * put, which only works if the scroll container is the table and not the frame.
 */
function Table({
  className,
  containerClassName,
  ...props
}: React.ComponentProps<"table"> & { containerClassName?: string }) {
  return (
    <div
      data-slot="table-container"
      className={cn(
        "bg-cm-surface relative w-full overflow-x-auto rounded-t-[12px]",
        containerClassName,
      )}
    >
      <table
        data-slot="table"
        className={cn("text-cm-body-medium w-full caption-bottom", className)}
        {...props}
      />
    </div>
  );
}

/**
 * The band. Its rows keep their fill on hover — the header is not a row you can
 * act on, and letting it light up would be a lie about what a click does.
 */
function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return (
    <thead
      data-slot="table-header"
      className={cn(
        "bg-cm-container [&_tr]:hover:bg-transparent",
        "[&_tr]:border-cm-hairline [&_tr]:border-b",
        className,
      )}
      {...props}
    />
  );
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return <tbody data-slot="table-body" className={cn(className)} {...props} />;
}

/**
 * A totals or summary row. It takes the header's band so the eye reads the two
 * as the same kind of thing — frame, not data — and loses its bottom rule
 * because it is the last thing in the table.
 */
function TableFooter({ className, ...props }: React.ComponentProps<"tfoot">) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn(
        "bg-cm-container text-cm-on-surface border-cm-hairline border-t [&>tr]:hover:bg-transparent [&>tr:last-child]:border-b-0",
        className,
      )}
      {...props}
    />
  );
}

/**
 * The hairline belongs to the row above it, including the last one — that is
 * what the reference draws, and it is what lets a pagination bar sit flush
 * underneath without needing a rule of its own.
 *
 * Hover is `surface-variant` rather than the house's usual `container`, and
 * this is the one place that departure is correct: `container` *is* the header
 * band, so hovering a row would make it look like a second header. Selection
 * then takes `container-high`, the only one of the three that reads as blue
 * rather than as a tint of white.
 */
function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      data-slot="table-row"
      className={cn(
        "border-cm-hairline hover:bg-cm-surface-variant data-[state=selected]:bg-cm-container-high border-b transition-colors",
        className,
      )}
      {...props}
    />
  );
}

/**
 * Column heading. `sort` does three things at once so they cannot fall out of
 * step: it draws the arrow, it wraps the label in a real button, and it sets
 * `aria-sort`, which is the only one of the three a screen reader can see.
 *
 * `"none"` means sortable but not currently sorted. It still renders the
 * button, and the arrow only appears on hover or focus — the affordance is
 * there when you go looking for it and out of the way when you are reading.
 */
function TableHead({
  className,
  children,
  sort,
  numeric,
  onSort,
  ...props
}: React.ComponentProps<"th"> & {
  sort?: "asc" | "desc" | "none";
  numeric?: boolean;
  onSort?: () => void;
}) {
  const Arrow = sort === "desc" ? ArrowDownward : ArrowUpward;

  return (
    <th
      data-slot="table-head"
      aria-sort={
        sort === "asc"
          ? "ascending"
          : sort === "desc"
            ? "descending"
            : sort === "none"
              ? "none"
              : undefined
      }
      className={cn(
        "text-cm-label-medium text-cm-on-surface h-[29px] px-4 text-left align-middle whitespace-nowrap",
        numeric && "text-right tabular-nums",
        className,
      )}
      {...props}
    >
      {sort ? (
        <button
          type="button"
          onClick={onSort}
          className={cn(
            "group text-cm-label-medium -mx-1 inline-flex cursor-pointer items-center gap-1 rounded-sm px-1 align-middle outline-none",
            "focus-visible:ring-cm-outline-focus/50 focus-visible:ring-[3px]",
            numeric && "flex-row-reverse",
          )}
        >
          {children}
          <Arrow
            aria-hidden
            className={cn(
              "size-[18px] shrink-0 transition-opacity",
              sort === "none" &&
                "opacity-0 group-hover:opacity-60 group-focus-visible:opacity-60",
            )}
          />
        </button>
      ) : (
        children
      )}
    </th>
  );
}

/**
 * `numeric` right-aligns and switches on tabular figures, which is the pair of
 * things a column of numbers always wants together: aligning the column edge is
 * pointless if the digits inside it are still different widths.
 */
function TableCell({
  className,
  numeric,
  ...props
}: React.ComponentProps<"td"> & { numeric?: boolean }) {
  return (
    <td
      data-slot="table-cell"
      className={cn(
        "text-cm-body-medium text-cm-on-surface-variant h-[29px] px-4 align-middle whitespace-nowrap",
        numeric && "text-right tabular-nums",
        className,
      )}
      {...props}
    />
  );
}

/**
 * The resource name in the first column — the one cell in a console table that
 * is nearly always a link, because a list page exists to get you to a detail
 * page.
 *
 * An `<a>`, not a link-coloured `<td>`. Painting a cell `link-default` and
 * leaving it as text gives you the look of a link with none of it: no tab stop,
 * no Enter, no middle-click, no status bar, nothing under the cursor. And the
 * underline is not decoration — colour alone is the one distinction a
 * colour-blind reader cannot make, so it is the same `underline
 * underline-offset-2` every other link in the kit wears.
 *
 * `TableCell` stays `on-surface-variant` underneath: the link colours itself,
 * so a cell holding a name and a trailing chip does not turn the chip blue too.
 */
function TableLink({ className, ...props }: React.ComponentProps<"a">) {
  return (
    <a
      data-slot="table-link"
      className={cn(
        "text-cm-link-default focus-visible:ring-cm-outline-focus/50 rounded-sm underline underline-offset-2 outline-none focus-visible:ring-[3px]",
        className,
      )}
      {...props}
    />
  );
}

/**
 * The checkbox gutter, header and body halves. 48px = 16px of padding, the 16px
 * box, 16px again — so the next column's text lands on 64px, which is where the
 * reference puts it.
 */
function TableSelectHead({ className, ...props }: React.ComponentProps<"th">) {
  return (
    <th
      data-slot="table-select-head"
      className={cn("h-[29px] w-12 px-4 align-middle", className)}
      {...props}
    />
  );
}

function TableSelectCell({ className, ...props }: React.ComponentProps<"td">) {
  return (
    <td
      data-slot="table-select-cell"
      className={cn("h-[29px] w-12 px-4 align-middle", className)}
      {...props}
    />
  );
}

/**
 * Below the table, per the reference: "*Basic table:* All tables must have a
 * caption for a11y." It is `caption-bottom` on the table, so this renders where
 * it reads even though the markup requires it first.
 */
function TableCaption({
  className,
  ...props
}: React.ComponentProps<"caption">) {
  return (
    <caption
      data-slot="table-caption"
      className={cn(
        "text-cm-body-medium text-cm-on-surface-variant mt-4 text-left",
        className,
      )}
      {...props}
    />
  );
}

export {
  TABLE_ICON_BUTTON,
  Table,
  TableFrame,
  TableTitleBar,
  TableTitle,
  TableToolbar,
  TableToolbarButton,
  TableToolbarSeparator,
  TableColumnMenu,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableLink,
  TableSelectHead,
  TableSelectCell,
  TableCaption,
};
