"use client";

import * as React from "react";

import { Button } from "./button";
import {
  Add,
  ArrowDownward,
  ArrowUpward,
  Delete,
  KeyboardArrowDown,
} from "./material-symbols";
import { cn } from "./utils";

/**
 * FormList — a stack of collapsed cards, each holding a form, one open at a
 * time.
 *
 * `FormStack`'s bigger sibling. The split is how much there is to fill in:
 *
 *   FormStack   two or three fields per entry. All rows open, laid out inline.
 *   FormList    a form per entry. Rows collapse to a title and a summary line.
 *
 * So a list of labels is a stack; a list of firewall rules, each with six
 * fields, is a list. Ten rules as inline rows is a page nobody can navigate,
 * and ten labels as ten collapsed cards is ceremony around two text fields.
 *
 * ### The title comes from the data
 *
 * A collapsed card shows `getTitle(item)` and `getMetadata(item)`, so the
 * reader can tell the six rules apart without opening them. A card whose
 * fields are still blank falls back to `emptyTitle` — "New rule" reads better
 * than an empty header, and an empty header is what a freshly added item has.
 *
 * ### One open at a time
 *
 * Adding an item opens it and closes whatever was open, because the reason you
 * added it is to fill it in. Everything else is a click on the header.
 */

export interface FormListProps<T> extends Omit<React.ComponentProps<"div">, "title"> {
  title?: React.ReactNode;
  items: T[];
  onItemsChange: (items: T[]) => void;
  newItem: () => T;
  /** Stable identity for one item. Reordering moves objects, so index will not do. */
  getId: (item: T, index: number) => string;
  /** The collapsed card's heading. */
  getTitle: (item: T, index: number) => React.ReactNode;
  /** A second line under it — a summary of what is inside. */
  getMetadata?: (item: T, index: number) => React.ReactNode;
  /** The form. Rendered only while the card is open. */
  renderForm: (item: T, index: number, update: (patch: Partial<T>) => void) => React.ReactNode;
  /** Heading for an item with nothing filled in yet. */
  emptyTitle?: string;
  addLabel?: string;
  /** Adds up/down buttons to each card's header. */
  enableReorder?: boolean;
  /** The card that is open. Uncontrolled if omitted. */
  openId?: string | null;
  onOpenChange?: (id: string | null) => void;
}

function FormList<T>({
  className,
  title,
  items,
  onItemsChange,
  newItem,
  getId,
  getTitle,
  getMetadata,
  renderForm,
  emptyTitle = "New item",
  addLabel = "Add item",
  enableReorder = false,
  openId,
  onOpenChange,
  ...props
}: FormListProps<T>) {
  const [openUncontrolled, setOpenUncontrolled] = React.useState<string | null>(null);
  const open = openId !== undefined ? openId : openUncontrolled;

  const setOpen = (id: string | null) => {
    if (openId === undefined) setOpenUncontrolled(id);
    onOpenChange?.(id);
  };

  const update = (index: number, patch: Partial<T>) =>
    onItemsChange(items.map((item, i) => (i === index ? { ...item, ...patch } : item)));

  const add = () => {
    const item = newItem();
    const next = [...items, item];
    onItemsChange(next);
    setOpen(getId(item, next.length - 1));
  };

  const remove = (index: number) => {
    const id = getId(items[index], index);
    onItemsChange(items.filter((_, i) => i !== index));
    // A card that is no longer there cannot stay open, and leaving the id set
    // would silently open whichever item inherits it later.
    if (open === id) setOpen(null);
  };

  const move = (index: number, delta: -1 | 1) => {
    const target = index + delta;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    [next[index], next[target]] = [next[target], next[index]];
    onItemsChange(next);
  };

  return (
    <div
      data-slot="form-list"
      className={cn("flex w-full flex-col gap-3", className)}
      {...props}
    >
      {title && <h3 className="text-cm-title-medium text-cm-on-surface">{title}</h3>}

      <ul className="flex list-none flex-col">
        {items.map((item, index) => {
          const id = getId(item, index);
          const isOpen = open === id;
          const heading = getTitle(item, index) || emptyTitle;
          const panelId = `${id}-panel`;

          return (
            <li
              key={id}
              className={cn(
                "border-cm-hairline border-b last:border-b-0",
                // Open, the card lifts out of the stack the same way an
                // `ExpandingRow` does — same tint, same radius, same reason.
                isOpen
                  ? "bg-cm-container-high my-2 rounded-[12px] border-transparent"
                  : "bg-cm-surface-variant first:rounded-t-[12px] last:rounded-b-[12px]",
              )}
            >
              <div className="flex items-center gap-1 px-2">
                <button
                  type="button"
                  aria-expanded={isOpen}
                  aria-controls={panelId}
                  onClick={() => setOpen(isOpen ? null : id)}
                  className="focus-visible:ring-cm-outline-focus/50 flex min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-lg px-2 py-2.5 text-left outline-none focus-visible:ring-[3px]"
                >
                  <KeyboardArrowDown
                    aria-hidden
                    className={cn(
                      "text-cm-on-surface-variant size-5 shrink-0 transition-transform",
                      isOpen && "rotate-180",
                    )}
                  />
                  <span className="flex min-w-0 flex-col">
                    <span className="text-cm-label-large text-cm-on-surface truncate">
                      {heading}
                    </span>
                    {getMetadata && (
                      <span className="text-cm-body-small text-cm-on-surface-variant truncate">
                        {getMetadata(item, index)}
                      </span>
                    )}
                  </span>
                </button>
                {enableReorder && (
                  <>
                    <Button
                      variant="text"
                      size="icon"
                      aria-label={`Move ${heading} up`}
                      disabled={index === 0}
                      onClick={() => move(index, -1)}
                    >
                      <ArrowUpward aria-hidden className="size-[18px]" />
                    </Button>
                    <Button
                      variant="text"
                      size="icon"
                      aria-label={`Move ${heading} down`}
                      disabled={index === items.length - 1}
                      onClick={() => move(index, 1)}
                    >
                      <ArrowDownward aria-hidden className="size-[18px]" />
                    </Button>
                  </>
                )}
                <Button
                  variant="text"
                  size="icon"
                  aria-label={`Delete ${heading}`}
                  onClick={() => remove(index)}
                >
                  <Delete aria-hidden className="size-[18px]" />
                </Button>
              </div>
              {/*
                Unmounted rather than hidden while closed. The form inside can
                be twenty fields deep, and ten closed cards' worth of them is a
                page the browser lays out and a screen reader has to be told to
                ignore, for content nobody asked to see.
              */}
              {isOpen && (
                <div id={panelId} className="flex flex-col gap-4 px-4 pt-1 pb-4">
                  {renderForm(item, index, (patch) => update(index, patch))}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <Button variant="text" onClick={add} className="self-start">
        <Add aria-hidden className="size-[18px]" />
        {addLabel}
      </Button>
    </div>
  );
}

export { FormList };
