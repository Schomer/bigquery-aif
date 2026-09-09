import * as React from "react";
import {
  ChevronLeft,
  ChevronRight,
  FirstPage,
  LastPage,
} from "./material-symbols";

import { cn } from "./utils";
import { TABLE_ICON_BUTTON } from "./table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./select";

/**
 * Pagination — the bar that sits under a table.
 *
 * This is a pager for a known-length result set, not a list of page links: the
 * reference shows "Rows per page: 10 — 1 – 10 of 10000 — |< < > >|", and with
 * a thousand pages a row of numbered links was never going to be the shape.
 * Everything is right-aligned, because the eye that has just finished reading
 * a row of data is already at the right edge.
 *
 * Two colours carry the whole thing, and the split is the point:
 * `on-surface-variant` for the labels, which are prose, and `on-surface` for
 * the page size, which is the one value here you can change. Disabled pager
 * buttons drop to `opacity-38`, the house's disabled strength throughout.
 *
 * The buttons are `TABLE_ICON_BUTTON`, imported rather than restated, so they
 * are pixel-for-pixel the toolbar's help and column-picker buttons at the other
 * end of the same table. 32px at an 8px gap is the reference's 40px pitch
 * exactly.
 *
 * Which buttons appear is the caller's call — the reference does it both ways,
 * with first/last on a 10 000-row table and prev/next alone on a 55-row one.
 */

function Pagination({ className, ...props }: React.ComponentProps<"nav">) {
  return (
    <nav
      role="navigation"
      aria-label="pagination"
      data-slot="pagination"
      className={cn(
        // `whitespace-nowrap` on the bar rather than on each label: "Rows per
        // page:" and "1 – 10 of 10000" are single units of meaning, and a bar
        // narrow enough to wrap them has a layout problem the pager cannot fix
        // by folding itself into three lines.
        "text-cm-body-medium text-cm-on-surface-variant flex h-12 w-full items-center justify-end gap-8 px-4 whitespace-nowrap",
        className,
      )}
      {...props}
    />
  );
}

/**
 * "Rows per page: 10 ▾". The Select's `inline` variant is the right control
 * here — borderless until you hover it — but its default figure is the muted
 * one a form field wants, and this is a value the reader is meant to notice, so
 * both the number and its caret are pulled up to `on-surface`.
 */
function PaginationRowsPerPage({
  value,
  onValueChange,
  options = [10, 25, 50, 100],
  label = "Rows per page:",
  className,
  ...props
}: Omit<React.ComponentProps<"div">, "onChange"> & {
  value: number;
  onValueChange?: (value: number) => void;
  options?: number[];
  label?: React.ReactNode;
}) {
  return (
    <div
      data-slot="pagination-rows-per-page"
      className={cn("flex shrink-0 items-center gap-2", className)}
      {...props}
    >
      <span>{label}</span>
      <Select
        value={String(value)}
        onValueChange={(next) => onValueChange?.(Number(next))}
      >
        <SelectTrigger
          variant="inline"
          size="sm"
          aria-label={typeof label === "string" ? label : "Rows per page"}
          className="text-cm-body-medium text-cm-on-surface h-8 gap-1 px-2 [&_svg]:fill-cm-on-surface"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option} value={String(option)}>
              {option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/**
 * "1 – 10 of 10000". An en dash, not a hyphen — it is a range, and at 14px the
 * difference between the two is the difference between reading it as a span and
 * reading it as a minus sign.
 *
 * `page` is 1-based. The upper bound is clamped so the last page reads
 * "9991 – 10000 of 10000" and not "9991 – 10010".
 */
function PaginationRange({
  page,
  pageSize,
  total,
  className,
  ...props
}: React.ComponentProps<"span"> & {
  page: number;
  pageSize: number;
  total: number;
}) {
  const first = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);

  return (
    <span
      data-slot="pagination-range"
      className={cn("shrink-0 tabular-nums", className)}
      {...props}
    >
      {first} – {last} of {total}
    </span>
  );
}

/** The four pager buttons sit in one group at an 8px gap — the 40px pitch. */
function PaginationControls({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="pagination-controls"
      className={cn("flex shrink-0 items-center gap-2", className)}
      {...props}
    />
  );
}

function PaginationButton({
  className,
  type = "button",
  ...props
}: React.ComponentProps<"button">) {
  return (
    <button
      data-slot="pagination-button"
      type={type}
      className={cn(TABLE_ICON_BUTTON, className)}
      {...props}
    />
  );
}

function PaginationFirst({
  className,
  ...props
}: React.ComponentProps<"button">) {
  return (
    <PaginationButton aria-label="Go to first page" className={className} {...props}>
      <FirstPage aria-hidden className="size-5" />
    </PaginationButton>
  );
}

function PaginationPrevious({
  className,
  ...props
}: React.ComponentProps<"button">) {
  return (
    <PaginationButton aria-label="Go to previous page" className={className} {...props}>
      <ChevronLeft aria-hidden className="size-5" />
    </PaginationButton>
  );
}

function PaginationNext({ className, ...props }: React.ComponentProps<"button">) {
  return (
    <PaginationButton aria-label="Go to next page" className={className} {...props}>
      <ChevronRight aria-hidden className="size-5" />
    </PaginationButton>
  );
}

function PaginationLast({ className, ...props }: React.ComponentProps<"button">) {
  return (
    <PaginationButton aria-label="Go to last page" className={className} {...props}>
      <LastPage aria-hidden className="size-5" />
    </PaginationButton>
  );
}

export {
  Pagination,
  PaginationRowsPerPage,
  PaginationRange,
  PaginationControls,
  PaginationButton,
  PaginationFirst,
  PaginationPrevious,
  PaginationNext,
  PaginationLast,
};
