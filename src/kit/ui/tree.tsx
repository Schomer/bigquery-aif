"use client";

import * as React from "react";

import { ChevronRight, Folder } from "./material-symbols";
import { cn } from "./utils";

/**
 * Tree — the explorer pane. Nested nodes, one selected, the rest folded away.
 *
 * This is the left column of BigQuery Studio: projects holding datasets holding
 * tables, where the hierarchy *is* the navigation. Reach for it when the shape
 * of the data is a tree and the reader needs to see where they are in it. For a
 * flat set of destinations use `ConsoleSideNav`; for tabular rows that expand,
 * `ExpandingRow` or `TreeGrid`.
 *
 * ### Expansion is uncontrolled by default
 *
 * Pass `nodes` and it works: expanding and collapsing is the tree's own state.
 * Pass `expandedIds` and you own it, which is what lazy loading needs — you
 * cannot expand a node whose children have not arrived yet, so the host has to
 * be the one deciding when the node counts as open.
 *
 * ### `load-more` is a node, not a footer
 *
 * A directory with 4,000 tables ships the first 50 and a "Load more" row at the
 * bottom of that level. It is a node in `children` with `type: "load-more"`, so
 * it indents with its siblings and arrives through the same array the rest of
 * the level came in on. It fires `onLoadMore` instead of selecting.
 *
 * ### Keyboard
 *
 * Arrow keys walk the visible rows, right and left open and close, Enter and
 * Space select — the standard tree pattern, because a tree that only responds
 * to clicks is a tree that a keyboard reader has to tab through one node at a
 * time. Only one row is in the tab order at a time (the selected one, or the
 * first); that is what keeps a 400-node tree from being 400 tab stops.
 *
 * ### One glyph carries the state
 *
 * The chevron rotates and the folder does not change. CDS swaps `folder` for
 * `folder_open` as well, which says the same thing twice — and when the two
 * disagree, as they do mid-transition, the reader believes the one that moved.
 */

export interface TreeNode {
  id: string;
  label: React.ReactNode;
  /** A `MaterialSymbols` glyph. Defaults to `folder`. */
  icon?: React.ReactNode;
  children?: TreeNode[];
  /** `load-more` renders as a link-coloured row that fires `onLoadMore`. */
  type?: "node" | "load-more";
  /** How many more there are. Only read for `load-more`. */
  count?: number;
  /** Buttons revealed on hover — a menu, a pin. */
  actions?: React.ReactNode;
  /** Keep `actions` visible even when the row is not hovered. */
  alwaysShowActions?: boolean;
}

export interface TreeProps extends Omit<React.ComponentProps<"ul">, "onSelect"> {
  nodes?: TreeNode[];
  /** Which node is highlighted. Uncontrolled if omitted. */
  selectedId?: string;
  defaultSelectedId?: string;
  onSelect?: (node: TreeNode) => void;
  /** Controlled expansion. Omit to let the tree remember it. */
  expandedIds?: string[];
  defaultExpandedIds?: string[];
  onExpandedChange?: (ids: string[]) => void;
  onLoadMore?: (node: TreeNode) => void;
}

/** 28px — one 20px glyph plus the 8px gap, so children line up under the label. */
const GROUP_INDENT = "ps-7";

function Tree({
  className,
  nodes = [],
  selectedId,
  defaultSelectedId,
  onSelect,
  expandedIds,
  defaultExpandedIds = [],
  onExpandedChange,
  onLoadMore,
  ...props
}: TreeProps) {
  const rootRef = React.useRef<HTMLUListElement>(null);
  const [openUncontrolled, setOpenUncontrolled] = React.useState(defaultExpandedIds);
  const [selectedUncontrolled, setSelectedUncontrolled] = React.useState(defaultSelectedId);

  const open = expandedIds ?? openUncontrolled;
  const selected = selectedId ?? selectedUncontrolled;

  const setOpen = (next: string[]) => {
    if (expandedIds === undefined) setOpenUncontrolled(next);
    onExpandedChange?.(next);
  };

  const toggle = (id: string) =>
    setOpen(open.includes(id) ? open.filter((n) => n !== id) : [...open, id]);

  const activate = (node: TreeNode) => {
    if (node.type === "load-more") {
      onLoadMore?.(node);
      return;
    }
    if (node.children?.length) toggle(node.id);
    if (selectedId === undefined) setSelectedUncontrolled(node.id);
    onSelect?.(node);
  };

  /**
   * Focus moves by walking the rendered rows rather than the data, because the
   * rendered rows are already the visible ones — a collapsed node's children
   * are not in the DOM at all, so there is nothing to skip over.
   */
  const moveFocus = (from: HTMLElement, delta: 1 | -1) => {
    const rows = Array.from(
      rootRef.current?.querySelectorAll<HTMLElement>('[role="treeitem"]') ?? [],
    );
    const next = rows[rows.indexOf(from) + delta];
    next?.focus();
  };

  const onKeyDown = (event: React.KeyboardEvent, node: TreeNode) => {
    const row = event.currentTarget as HTMLElement;
    const isOpen = open.includes(node.id);
    const hasChildren = Boolean(node.children?.length);

    switch (event.key) {
      case "ArrowDown":
        moveFocus(row, 1);
        break;
      case "ArrowUp":
        moveFocus(row, -1);
        break;
      case "ArrowRight":
        if (hasChildren && !isOpen) toggle(node.id);
        else if (hasChildren) moveFocus(row, 1);
        break;
      case "ArrowLeft":
        if (hasChildren && isOpen) toggle(node.id);
        else moveFocus(row, -1);
        break;
      case "Enter":
      case " ":
        activate(node);
        break;
      default:
        return;
    }
    // Only reached when the key was one of ours — Space scrolls the page and
    // the arrows scroll the pane otherwise.
    event.preventDefault();
  };

  // The one row in the tab order. The selected node if there is one, otherwise
  // the first, so tabbing into a fresh tree lands somewhere sensible.
  const tabbableId = selected ?? nodes[0]?.id;

  const renderNodes = (list: TreeNode[]) =>
    list.map((node) => {
      const isOpen = open.includes(node.id);
      const hasChildren = Boolean(node.children?.length);

      if (node.type === "load-more") {
        return (
          <li key={node.id} role="none">
            <div
              role="treeitem"
              aria-selected={false}
              tabIndex={-1}
              onClick={() => onLoadMore?.(node)}
              onKeyDown={(event) => onKeyDown(event, node)}
              className={cn(
                "text-cm-link-default text-cm-body-medium hover:bg-cm-on-surface/8 flex h-8 cursor-pointer items-center rounded-lg pe-2 underline underline-offset-2 outline-none",
                "focus-visible:ring-cm-outline-focus/50 focus-visible:ring-[3px]",
                GROUP_INDENT,
              )}
            >
              {node.label}
              {node.count !== undefined && ` (${node.count})`}
            </div>
          </li>
        );
      }

      return (
        <li key={node.id} role="none">
          <div
            role="treeitem"
            aria-expanded={hasChildren ? isOpen : undefined}
            aria-selected={selected === node.id}
            tabIndex={tabbableId === node.id ? 0 : -1}
            onClick={(event) => {
              // A click on a row's action buttons is a click on the button, not
              // on the row — without this, opening a node's menu also selects
              // and collapses it.
              event.stopPropagation();
              activate(node);
            }}
            onKeyDown={(event) => onKeyDown(event, node)}
            className={cn(
              "group/tree-row text-cm-body-medium text-cm-on-surface flex h-8 cursor-pointer items-center gap-2 rounded-lg pe-2 outline-none",
              "focus-visible:ring-cm-outline-focus/50 focus-visible:ring-[3px]",
              selected === node.id ? "bg-cm-selection-container" : "hover:bg-cm-on-surface/8",
            )}
          >
            <ChevronRight
              aria-hidden
              className={cn(
                "text-cm-on-surface-variant size-5 shrink-0 transition-transform",
                isOpen && "rotate-90",
                // A leaf keeps the chevron's space rather than closing it up:
                // otherwise every label in a level sits at a different x
                // depending on whether that particular node has children.
                !hasChildren && "invisible",
              )}
            />
            <span aria-hidden className="text-cm-on-surface-variant [&>svg]:size-5 shrink-0">
              {node.icon ?? <Folder className="size-5" />}
            </span>
            <span className="flex-1 truncate">{node.label}</span>
            {node.actions && (
              <span
                className={cn(
                  "flex shrink-0 items-center",
                  !node.alwaysShowActions &&
                    "opacity-0 group-hover/tree-row:opacity-100 focus-within:opacity-100",
                )}
              >
                {node.actions}
              </span>
            )}
          </div>
          {hasChildren && isOpen && (
            <ul role="group" className={GROUP_INDENT}>
              {renderNodes(node.children!)}
            </ul>
          )}
        </li>
      );
    });

  return (
    <ul
      ref={rootRef}
      data-slot="tree"
      role="tree"
      className={cn("list-none", className)}
      {...props}
    >
      {renderNodes(nodes)}
    </ul>
  );
}

export { Tree };
