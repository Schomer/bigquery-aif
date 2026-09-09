"use client";

import * as React from "react";

import { Button } from "./button";
import { Link } from "./link";
import { ChevronLeft, ChevronRight } from "./material-symbols";
import { cn } from "./utils";

/**
 * ComparisonTable — products across the top, features down the side, ticks in
 * the middle.
 *
 * The "which database should I use" page, the tier picker on a billing screen,
 * the three plans on a marketing surface. It is not a data table and does not
 * behave like one: no sorting, no selection, no pagination, and the *columns*
 * are the records rather than the rows. Putting that in `Table` would mean
 * every affordance `Table` offers pointing at the wrong axis.
 *
 * ### Three appearances
 *
 *   card     bordered, lifted, a full product header with copy and a button.
 *            The standalone "choose one" page.
 *   flat     the same table without the lift. For inside a `Card` or a `Panel`,
 *            where a second shadow would read as a floating box in a box.
 *   inline   compact. Just the product name in the header, tighter rows, no
 *            actions — a reference table inside documentation.
 *
 * ### It scrolls sideways, and says so
 *
 * Four products at a readable width is wider than a console content column, so
 * the table has a `min-width` and its container scrolls. Buttons fade in at
 * whichever edge has more table behind it — a scrollbar alone is easy to miss
 * on a trackpad, and a reader who cannot see that a fifth column exists will
 * not go looking for it.
 *
 * ### The highlighted column
 *
 * `highlighted` marks the recommended product with `container-primary` and a
 * rule in `primary`. One per table. Two highlighted columns is a table that
 * recommends nothing, and the tint stops meaning anything the moment it is on
 * half the columns.
 */

export interface ComparisonProduct {
  name: string;
  description?: React.ReactNode;
  /** Renders a "Learn more" link under the description. */
  learnMoreHref?: string;
  /** Keyed by row `key`. Anything renderable — a tick, a `Tag`, a `Link`. */
  attributes: Record<string, React.ReactNode>;
  /** The recommended column. Tinted, and rule-marked. One per table. */
  highlighted?: boolean;
  /**
   * The commit for this column — usually a `Button`. A node rather than CDS's
   * `{type: 'button' | 'text'}` union, because the caller already has `Button`,
   * `Tag` and `Message` and knows better than the table which one this is.
   */
  action?: React.ReactNode;
}

export interface ComparisonRow {
  key: string;
  label: React.ReactNode;
}

export interface ComparisonTableProps extends React.ComponentProps<"div"> {
  products: ComparisonProduct[];
  rows: ComparisonRow[];
  appearance?: "card" | "flat" | "inline";
  /** Names the table for a screen reader. */
  label?: string;
}

function ComparisonTable({
  className,
  products,
  rows,
  appearance = "card",
  label = "Comparison table",
  ...props
}: ComparisonTableProps) {
  const scroller = React.useRef<HTMLDivElement>(null);
  const [atStart, setAtStart] = React.useState(true);
  const [atEnd, setAtEnd] = React.useState(true);
  const inline = appearance === "inline";

  const measure = React.useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setAtStart(scrollLeft <= 1);
    // A pixel of tolerance: fractional layout widths mean `scrollLeft` often
    // stops a hair short of the true end and the button never goes away.
    setAtEnd(scrollLeft >= scrollWidth - clientWidth - 1);
  }, []);

  React.useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    measure();
    // The container can become scrollable without anyone scrolling — the window
    // narrows, or a side panel opens — so width changes have to be watched too.
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [measure]);

  const scrollBy = (direction: -1 | 1) => {
    const el = scroller.current;
    if (!el) return;
    // 80% of a screenful, so the column at the edge stays partly visible and
    // the reader keeps their place.
    el.scrollBy({ left: direction * el.clientWidth * 0.8, behavior: "smooth" });
  };

  const cellPad = inline ? "px-4 py-2" : "px-4 py-3";

  return (
    <div data-slot="comparison-table" className={cn("relative", className)} {...props}>
      <div ref={scroller} onScroll={measure} className="overflow-x-auto p-2 pb-3">
        <table
          aria-label={label}
          // `table-fixed` with a `min-w`: without it, one product with a long
          // description takes half the table and the other three squeeze into
          // the rest, which makes the comparison harder than reading four pages.
          className="text-cm-body-medium text-cm-on-surface bg-cm-surface w-full min-w-[800px] table-fixed border-collapse"
        >
          <thead>
            <tr>
              {/* The corner. Empty, and `scope`-less, because it labels nothing. */}
              <th className={cn("w-[200px] text-left", cellPad)} />
              {products.map((product) => (
                <th
                  key={product.name}
                  scope="col"
                  className={cn(
                    "w-1/4 h-px text-left align-top",
                    inline ? "px-4 py-2" : "p-4",
                    !inline && "border-cm-hairline border-b",
                    appearance !== "inline" && "border-cm-hairline border-l first:border-l-0",
                    product.highlighted && "bg-cm-container-primary",
                    // Card and flat get a thick rule above the recommended
                    // column; inline has no room for one and gets it below.
                    product.highlighted &&
                      (inline
                        ? "border-b-cm-primary border-b-[3px]"
                        : "border-t-cm-primary border-t-[8px]"),
                  )}
                >
                  {inline ? (
                    <span className="text-cm-label-large text-cm-on-surface">
                      {product.name}
                    </span>
                  ) : (
                    // `h-full` off the `h-px` on the `<th>` — the old trick for
                    // making a cell's child fill the row's height, so every
                    // column's action button lands on the same baseline however
                    // long the descriptions above them are.
                    <div className="flex h-full flex-col justify-between gap-4">
                      <div>
                        <h3 className="text-cm-title-large text-cm-on-surface mb-2">
                          {product.name}
                        </h3>
                        {product.description && (
                          <p className="text-cm-body-medium text-cm-on-surface-variant">
                            {product.description}
                          </p>
                        )}
                        {product.learnMoreHref && (
                          <Link href={product.learnMoreHref} className="mt-2 inline-block">
                            Learn more
                          </Link>
                        )}
                      </div>
                      <div className="flex flex-col items-start gap-4">
                        {product.action}
                      </div>
                    </div>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key} className="border-cm-hairline border-b last:border-b-0">
                {/*
                  A row header, not a cell: the label down the left names the
                  row the same way the product names the column, and `scope`
                  is what lets a screen reader read "Storage, Spanner, 4 TB"
                  instead of just "4 TB".
                */}
                <th
                  scope="row"
                  className={cn(
                    "text-cm-label-medium text-cm-on-surface text-left align-top",
                    cellPad,
                  )}
                >
                  {row.label}
                </th>
                {products.map((product) => (
                  <td
                    key={product.name}
                    className={cn(
                      "text-cm-body-medium text-cm-on-surface-variant align-top",
                      cellPad,
                      !inline && "border-cm-hairline border-l",
                      product.highlighted && "bg-cm-container-primary",
                    )}
                  >
                    {product.attributes[row.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/*
        The buttons sit over the table rather than beside it. Giving them their
        own gutters would cost 96px of the width the table is already short of,
        and they are an aid to a scrollbar that is still there underneath.
      */}
      <ScrollButton side="left" hidden={atStart} onClick={() => scrollBy(-1)} />
      <ScrollButton side="right" hidden={atEnd} onClick={() => scrollBy(1)} />
    </div>
  );
}

function ScrollButton({
  side,
  hidden,
  onClick,
}: {
  side: "left" | "right";
  hidden: boolean;
  onClick: () => void;
}) {
  const Glyph = side === "left" ? ChevronLeft : ChevronRight;

  return (
    <div
      // `invisible` rather than unmounted: the button keeps its place in the
      // tab order's geometry and can fade instead of popping. `pointer-events`
      // goes with it so a hidden button cannot be clicked through.
      className={cn(
        "absolute top-1/2 z-10 -translate-y-1/2 transition-opacity",
        side === "left" ? "left-4" : "right-4",
        hidden && "pointer-events-none invisible opacity-0",
      )}
      aria-hidden={hidden}
    >
      <Button
        variant="text"
        size="icon"
        tabIndex={hidden ? -1 : undefined}
        aria-label={side === "left" ? "Scroll left" : "Scroll right"}
        onClick={onClick}
        className="bg-cm-surface shadow-cm-elevation rounded-full"
      >
        <Glyph aria-hidden className="size-[18px]" />
      </Button>
    </div>
  );
}

export { ComparisonTable };
