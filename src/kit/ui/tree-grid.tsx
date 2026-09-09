"use client";

import * as React from "react";

import { Checkbox } from "./checkbox";
import { ChevronRight } from "./material-symbols";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableSelectCell,
  TableSelectHead,
} from "./table";
import { cn } from "./utils";

/**
 * TreeGrid — a table whose rows nest.
 *
 * IAM roles under a principal, resources under a folder, spend under a service:
 * data that is tabular *and* hierarchical, where flattening it into a plain
 * table would lose the containment and putting it in a `Tree` would lose the
 * columns.
 *
 * ### It is the kit's `Table`, not a second one
 *
 * Every part of the frame — the title bar, the toolbar, the column menu, the
 * caption — comes from `table.tsx`, and this component adds exactly one thing:
 * a chevron and an indent in the first column. So a tree grid that needs a
 * filter or a pager wraps this in `TableFrame` with `TableToolbar` and
 * `Pagination`, the same way a flat table does. CDS builds its own filter,
 * column chooser and pagination into the component; here those already exist
 * and having two of each that drift apart is the worse outcome.
 *
 *     <TableFrame>
 *       <TableTitleBar><TableTitle>Roles</TableTitle></TableTitleBar>
 *       <TreeGrid columns={columns} rows={rows} selectable />
 *     </TableFrame>
 *
 * ### The chevron is a button
 *
 * Its own button inside the cell, with its own accessible name, rather than a
 * click handler on the row. A row in a tree grid holds links and menus, so
 * making the whole row a toggle means every click that misses a link collapses
 * the thing the reader was aiming at.
 *
 * ### Selection covers descendants
 *
 * Checking a parent checks everything under it, including rows that are
 * collapsed and therefore not on screen. That is the honest reading of "select
 * this folder", and it is why the parent shows an indeterminate box when only
 * some of its children are checked rather than an empty one.
 */

export interface TreeGridColumn {
  key: string;
  header: React.ReactNode;
  /** Right-aligns and switches on tabular figures, like `TableCell numeric`. */
  numeric?: boolean;
}

export interface TreeGridRow {
  id: string;
  /** Keyed by column `key`. Anything renderable — a `Tag`, a `TableLink`. */
  cells: Record<string, React.ReactNode>;
  children?: TreeGridRow[];
}

export interface TreeGridProps extends React.ComponentProps<"table"> {
  columns: TreeGridColumn[];
  rows: TreeGridRow[];
  /** Adds the checkbox gutter. */
  selectable?: boolean;
  expandedIds?: string[];
  defaultExpandedIds?: string[];
  onExpandedChange?: (ids: string[]) => void;
  selectedIds?: string[];
  defaultSelectedIds?: string[];
  onSelectedChange?: (ids: string[]) => void;
}

/** 24px a level, applied to the first cell's content so the chevron steps too. */
const INDENT_PX = 24;

function descendantIds(row: TreeGridRow): string[] {
  return [row.id, ...(row.children ?? []).flatMap(descendantIds)];
}

function TreeGrid({
  className,
  columns,
  rows,
  selectable = false,
  expandedIds,
  defaultExpandedIds = [],
  onExpandedChange,
  selectedIds,
  defaultSelectedIds = [],
  onSelectedChange,
  ...props
}: TreeGridProps) {
  const [openUncontrolled, setOpenUncontrolled] = React.useState(defaultExpandedIds);
  const [pickedUncontrolled, setPickedUncontrolled] = React.useState(defaultSelectedIds);

  const open = expandedIds ?? openUncontrolled;
  const picked = selectedIds ?? pickedUncontrolled;

  const setOpen = (next: string[]) => {
    if (expandedIds === undefined) setOpenUncontrolled(next);
    onExpandedChange?.(next);
  };

  const setPicked = (next: string[]) => {
    if (selectedIds === undefined) setPickedUncontrolled(next);
    onSelectedChange?.(next);
  };

  const allIds = React.useMemo(() => rows.flatMap(descendantIds), [rows]);
  const allChecked = allIds.length > 0 && allIds.every((id) => picked.includes(id));
  const someChecked = !allChecked && allIds.some((id) => picked.includes(id));

  const toggleRow = (row: TreeGridRow, checked: boolean) => {
    const affected = descendantIds(row);
    setPicked(
      checked
        ? [...picked, ...affected.filter((id) => !picked.includes(id))]
        : picked.filter((id) => !affected.includes(id)),
    );
  };

  const renderRows = (list: TreeGridRow[], level: number): React.ReactNode[] =>
    list.flatMap((row) => {
      const hasChildren = Boolean(row.children?.length);
      const isOpen = open.includes(row.id);
      const isPicked = picked.includes(row.id);

      const rowNode = (
        <TableRow
          key={row.id}
          aria-level={level + 1}
          aria-expanded={hasChildren ? isOpen : undefined}
          aria-selected={selectable ? isPicked : undefined}
          className={cn(isPicked && "bg-cm-selection-container")}
        >
          {selectable && (
            <TableSelectCell>
              <Checkbox
                checked={isPicked}
                onCheckedChange={(checked) => toggleRow(row, checked === true)}
                aria-label="Select row"
              />
            </TableSelectCell>
          )}
          {columns.map((column, index) => (
            <TableCell key={column.key} numeric={column.numeric}>
              {index === 0 ? (
                <div
                  className="flex items-center gap-1"
                  style={level > 0 ? { paddingInlineStart: level * INDENT_PX } : undefined}
                >
                  {/*
                    A leaf keeps the chevron's footprint. Collapsing it would
                    shift every leaf label 24px left of its siblings, which
                    reads as another level of nesting rather than as no children.
                  */}
                  {hasChildren ? (
                    <button
                      type="button"
                      aria-label={isOpen ? "Collapse row" : "Expand row"}
                      onClick={() =>
                        setOpen(
                          isOpen ? open.filter((id) => id !== row.id) : [...open, row.id],
                        )
                      }
                      className="text-cm-on-surface-variant hover:bg-cm-on-surface/8 focus-visible:ring-cm-outline-focus/50 -ms-1 flex size-5 shrink-0 cursor-pointer items-center justify-center rounded-sm outline-none focus-visible:ring-[3px]"
                    >
                      <ChevronRight
                        aria-hidden
                        className={cn("size-[18px] transition-transform", isOpen && "rotate-90")}
                      />
                    </button>
                  ) : (
                    <span aria-hidden className="-ms-1 size-5 shrink-0" />
                  )}
                  {row.cells[column.key]}
                </div>
              ) : (
                row.cells[column.key]
              )}
            </TableCell>
          ))}
        </TableRow>
      );

      return hasChildren && isOpen
        ? [rowNode, ...renderRows(row.children!, level + 1)]
        : [rowNode];
    });

  return (
    <Table
      data-slot="tree-grid"
      // `treegrid` and not `grid`: it is the role that tells a screen reader the
      // `aria-level` and `aria-expanded` on each row mean something.
      role="treegrid"
      className={className}
      {...props}
    >
      <TableHeader>
        <TableRow>
          {selectable && (
            <TableSelectHead>
              <Checkbox
                checked={allChecked ? true : someChecked ? "indeterminate" : false}
                onCheckedChange={(checked) =>
                  setPicked(checked === true ? allIds : [])
                }
                aria-label="Select all rows"
              />
            </TableSelectHead>
          )}
          {columns.map((column) => (
            <TableHead key={column.key} numeric={column.numeric}>
              {column.header}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>{renderRows(rows, 0)}</TableBody>
    </Table>
  );
}

export { TreeGrid };
