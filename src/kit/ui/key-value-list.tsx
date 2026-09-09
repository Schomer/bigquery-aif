import * as React from "react";

import { Chip, type ChipProps } from "./chip";
import { OpenInNew } from "./material-symbols";
import { cn } from "./utils";

/**
 * KeyValueList — the label/value table used for metadata panels.
 *
 * It is a table in the way a schedule is a table: two columns, a rule between
 * every pair, and nothing else. Everything below is measured off the two
 * reference screenshots.
 *
 * The rhythm is a **27px row pitch** — a 26px band plus a 1px hairline — which
 * is a 20px line of 14px type with 3px of air above and below. That is tighter
 * than `table.tsx`'s 29px, and deliberately so: a key/value list is read one
 * line at a time, not scanned across, so it does not need a table's horizontal
 * breathing room.
 *
 * The key column is a **fixed 216px**, exposed as `--kv-key-width` so a caller
 * with longer labels can widen it once on the list rather than on every row.
 * The value column takes the rest.
 *
 * Two type tokens and one colour: keys are `label-medium` (14px/500), values
 * `body-medium` (14px/400), both `on-surface`. Unlike a data table, the value
 * here is the thing you came to read — it does not get demoted to
 * `on-surface-variant`. Every rule is `hairline` at 1px.
 *
 * Three kinds of rule, and the difference carries meaning:
 *
 *   full width       between two different keys
 *   value column     between two values of the *same* key
 *   none             after the last row in the list
 *
 * The second one is why `KeyValueRow` takes more than one `<dd>`: two values
 * under one term is exactly what a `<dl>` is for, and putting them in one row
 * gets both the semantics and the inset rule for free.
 */

/**
 * Nesting depth. Groups are rendered flat — the group's children are DOM
 * siblings of the rows above them, not descendants — so a row's indent has to
 * travel by context rather than by a wrapper's padding. Flat is what makes
 * `last:border-b-0` mean "the last row in the whole list" instead of "the last
 * row in this nesting level", which is the rule the reference draws.
 */
const KeyValueDepthContext = React.createContext(0);

/** 24px per level, applied to the row as a whole so both columns step right. */
const INDENT_PX = 24;

function useIndent() {
  const depth = React.useContext(KeyValueDepthContext);
  return depth > 0 ? { paddingLeft: depth * INDENT_PX } : undefined;
}

function KeyValueList({
  className,
  keyWidth,
  style,
  ...props
}: React.ComponentProps<"dl"> & {
  /** Width of the key column. Defaults to the reference's 216px. */
  keyWidth?: number | string;
}) {
  return (
    <dl
      data-slot="key-value-list"
      style={
        keyWidth === undefined
          ? style
          : ({
              ...style,
              "--kv-key-width":
                typeof keyWidth === "number" ? `${keyWidth}px` : keyWidth,
            } as React.CSSProperties)
      }
      className={cn("w-full", className)}
      {...props}
    />
  );
}

/**
 * One key and its value — or its values, plural. Extra `<dd>`s stack in the
 * value column and each grows its own row, separated by a rule that starts at
 * the value column rather than at the list's edge.
 *
 * `items-start` because a key sits at the *top* of a value that wraps to four
 * lines, not in the middle of it.
 */
function KeyValueRow({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="key-value-row"
      style={useIndent()}
      className={cn(
        "border-cm-hairline grid grid-cols-[var(--kv-key-width,216px)_1fr] items-start border-b last:border-b-0",
        // Every value lands in column two, including the second and third, so
        // a multi-value row stacks downward instead of spilling back under the
        // key. The rule between them is on the `<dd>`, which is why it starts
        // where the value column starts.
        "[&>dd]:col-start-2",
        "[&>dd:not(:last-child)]:border-cm-hairline [&>dd:not(:last-child)]:border-b",
        className,
      )}
      {...props}
    />
  );
}

/**
 * The label. `flex` rather than plain text so a trailing help icon lines up on
 * the text's centre without inflating the row — an inline icon in a 20px line
 * box pushes the line taller, and one taller row breaks the rhythm of every
 * row under it.
 */
function KeyValueKey({ className, ...props }: React.ComponentProps<"dt">) {
  return (
    <dt
      data-slot="key-value-key"
      className={cn(
        "text-cm-label-medium text-cm-on-surface flex min-h-[26px] items-center gap-1 py-[3px] pr-4",
        className,
      )}
      {...props}
    />
  );
}

function KeyValueValue({ className, ...props }: React.ComponentProps<"dd">) {
  return (
    <dd
      data-slot="key-value-value"
      className={cn(
        "text-cm-body-medium text-cm-on-surface min-h-[26px] py-[3px]",
        className,
      )}
      {...props}
    />
  );
}

/**
 * A labelled section. The label runs the full width of the list — it is not a
 * key, it has no value — and everything after it steps in by 24px until the
 * group closes.
 *
 * It renders no wrapper of its own: the label and the children come out as
 * siblings of the rows around them. That is what keeps the last row in the
 * list the last child of the list, so it can drop its rule.
 */
function KeyValueGroup({
  className,
  label,
  children,
  ...props
}: Omit<React.ComponentProps<"dt">, "children"> & {
  label: React.ReactNode;
  children?: React.ReactNode;
}) {
  const depth = React.useContext(KeyValueDepthContext);

  return (
    <>
      <dt
        data-slot="key-value-group-label"
        style={depth > 0 ? { paddingLeft: depth * INDENT_PX } : undefined}
        className={cn(
          "text-cm-label-medium text-cm-on-surface border-cm-hairline min-h-[26px] border-b py-[3px] last:border-b-0",
          className,
        )}
        {...props}
      >
        {label}
      </dt>
      <KeyValueDepthContext.Provider value={depth + 1}>
        {children}
      </KeyValueDepthContext.Provider>
    </>
  );
}

/**
 * A wrapping row of chips. The extra 3px on top of the value's own 3px is what
 * the reference draws — a 24px pill in a 26px band would touch the rules above
 * and below it, so a chip row is allowed to be the one row that is taller than
 * the rhythm.
 */
function KeyValueChips({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="key-value-chips"
      className={cn("flex flex-wrap items-center gap-2 py-[3px]", className)}
      {...props}
    />
  );
}

/**
 * The pill. Outlined and not filled because a value row can hold five of them
 * and five filled blocks would out-shout the rest of the list.
 *
 * It is `Chip`, so it follows the chip reference rather than this one: the two
 * disagreed on side padding, 12px here against 16px there, and one chip shape
 * across the product beats two that differ by 4px.
 */
function KeyValueChip(props: ChipProps) {
  return <Chip data-slot="key-value-chip" {...props} />;
}

/**
 * A value that is a link out. The `open_in_new` mark is `1em`, so it tracks the
 * text rather than the icon scale, and it sits outside the underline — the
 * underline belongs to the words.
 *
 * `external` is on by default because that is the only kind of link the
 * reference shows; pass `external={false}` for an in-app destination and the
 * mark disappears along with the `target`.
 */
function KeyValueLink({
  className,
  children,
  external = true,
  ...props
}: React.ComponentProps<"a"> & { external?: boolean }) {
  return (
    <a
      data-slot="key-value-link"
      target={external ? "_blank" : undefined}
      rel={external ? "noreferrer" : undefined}
      className={cn(
        "text-cm-link-default focus-visible:ring-cm-outline-focus/50 inline-flex items-center gap-1 rounded-sm outline-none focus-visible:ring-[3px]",
        className,
      )}
      {...props}
    >
      <span className="underline underline-offset-2">{children}</span>
      {external ? (
        <OpenInNew aria-hidden className="size-[1em] shrink-0" />
      ) : null}
    </a>
  );
}

export {
  KeyValueList,
  KeyValueRow,
  KeyValueKey,
  KeyValueValue,
  KeyValueGroup,
  KeyValueChips,
  KeyValueChip,
  KeyValueLink,
};
