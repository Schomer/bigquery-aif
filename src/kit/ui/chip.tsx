import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { Check, Close } from "./material-symbols";
import { cn } from "./utils";

/**
 * Chip — the 24px pill, in the four kinds the reference draws.
 *
 *   Chip            a static fact, or a token in a field. Outlined.
 *   FilterChip      a toggle. Outlined when off, filled with a check when on.
 *   SuggestionChip  a prompt the user can tap. Always filled.
 *
 * All of them are the same pill: **24px tall, fully rounded, `body-medium`**.
 * The corner is a true half-height radius — measured off the reference by
 * fitting a circle to the corner's antialiasing, which came out at 12px on the
 * nose. It is `rounded-full` rather than a fixed radius so a chip that has to
 * grow (two lines, a bigger type token) stays a pill instead of turning into a
 * stadium with flat ends.
 *
 * Padding follows one rule: **16px on a side that ends in text, 8px on a side
 * that ends in an icon.** An icon is already mostly whitespace, so giving it
 * the full 16 makes the chip look lopsided. Everything inside is 8px apart.
 *
 * Two colour treatments and no more:
 *
 *   outlined   1px `hairline`, no fill, `on-surface` text
 *   filled     `selection-container`, no border, `on-container` text
 *
 * The fill is `selection-container` because that is what it means — this chip
 * is chosen. It is the same fill for a selected FilterChip and for a
 * SuggestionChip, which is deliberate: a suggestion is a thing the product has
 * picked out for you.
 *
 * Hover is a `on-surface` state layer at 8% rather than a second background
 * token, because there is no token one step darker than `selection-container`
 * and inventing one to serve a hover would be the tail wagging the dog. The
 * layer sits behind the text (`-z-10` inside an `isolate`d stacking context,
 * which paints above the element's own background and below its content), so
 * it darkens the fill without dimming the label.
 */
const chipVariants = cva(
  [
    "isolate relative inline-flex h-6 shrink-0 items-center gap-2 rounded-full",
    "text-cm-body-medium whitespace-nowrap",
    "outline-none focus-visible:ring-cm-outline-focus/50 focus-visible:ring-[3px]",
    "[&>svg]:size-[18px] [&>svg]:shrink-0",
  ],
  {
    variants: {
      variant: {
        outlined: "border-cm-hairline text-cm-on-surface border",
        filled: "bg-cm-selection-container text-cm-on-container",
      },
      /** Adds the hover/press state layer. Off for chips that only display. */
      interactive: {
        true: [
          "cursor-pointer transition-[color,box-shadow]",
          "before:bg-cm-on-surface before:pointer-events-none before:absolute before:inset-0 before:-z-10 before:rounded-full before:opacity-0 before:transition-opacity",
          "hover:before:opacity-[0.08] active:before:opacity-[0.12]",
          "disabled:pointer-events-none disabled:opacity-38",
        ],
        false: "",
      },
    },
    defaultVariants: { variant: "outlined", interactive: false },
  },
);

/** 16px where the edge is text, 8px where it is an icon. */
function chipPadding(leading: boolean, trailing: boolean) {
  return cn(leading ? "pl-2" : "pl-4", trailing ? "pr-2" : "pr-4");
}

/**
 * The remove affordance on an input chip. 18px like every other chip icon, on
 * its own hit target so clicking the × does not also fire the chip's onClick.
 */
function ChipRemove({
  label,
  onRemove,
}: {
  label: string;
  onRemove: React.MouseEventHandler<HTMLButtonElement>;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      data-slot="chip-remove"
      // `mousedown` as well as `click`: these live inside text fields, and
      // letting the field blur before the click lands loses the click.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onRemove}
      className="text-cm-on-surface-variant hover:text-cm-on-surface hover:bg-cm-on-surface/8 -mr-0.5 flex size-[18px] shrink-0 items-center justify-center rounded-full outline-none transition-colors focus-visible:ring-[2px] focus-visible:ring-cm-outline-focus/50"
    >
      <Close aria-hidden className="size-[14px]" />
    </button>
  );
}

interface ChipProps
  extends Omit<React.ComponentProps<"span">, "onClick">,
    Pick<VariantProps<typeof chipVariants>, "variant"> {
  /** A leading 18px mark. Sized and coloured by the chip, so pass it bare. */
  icon?: React.ReactNode;
  /** Renders a trailing × and makes this an input chip. */
  onRemove?: React.MouseEventHandler<HTMLButtonElement>;
  /** Screen-reader name for that ×. Defaults to `Remove <label>`. */
  removeLabel?: string;
  /** Renders a `<button>` instead of a `<span>`, with the state layer. */
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
}

function Chip({
  className,
  variant,
  icon,
  onRemove,
  removeLabel,
  onClick,
  children,
  ...props
}: ChipProps) {
  const body = (
    <>
      {icon}
      <span className="min-w-0 truncate">{children}</span>
      {onRemove ? (
        <ChipRemove
          label={removeLabel ?? `Remove ${typeof children === "string" ? children : "chip"}`}
          onRemove={onRemove}
        />
      ) : null}
    </>
  );

  const classes = cn(
    chipVariants({ variant, interactive: Boolean(onClick) }),
    chipPadding(Boolean(icon), Boolean(onRemove)),
    className,
  );

  // A chip you can press is a button; a chip that only states something is
  // not. Deciding from `onClick` keeps the caller from having to say it twice.
  if (onClick) {
    return (
      <button
        type="button"
        data-slot="chip"
        onClick={onClick}
        className={classes}
        {...(props as React.ComponentProps<"button">)}
      >
        {body}
      </button>
    );
  }

  return (
    <span data-slot="chip" className={classes} {...props}>
      {body}
    </span>
  );
}

/**
 * A toggle. Off it is an outline; on it fills and grows a leading check.
 *
 * The check is what makes multi-select readable — with four chips in a row and
 * two of them filled, the fill alone tells you *that* something is selected
 * and the check tells you *these are*. `aria-pressed` says the same thing to a
 * screen reader.
 */
function FilterChip({
  className,
  selected = false,
  icon,
  children,
  ...props
}: Omit<React.ComponentProps<"button">, "type"> & {
  selected?: boolean;
  /** Shown when unselected; the check replaces it when selected. */
  icon?: React.ReactNode;
}) {
  const leading = selected ? <Check aria-hidden /> : icon;

  return (
    <button
      type="button"
      data-slot="filter-chip"
      aria-pressed={selected}
      className={cn(
        chipVariants({
          variant: selected ? "filled" : "outlined",
          interactive: true,
        }),
        chipPadding(Boolean(leading), false),
        className,
      )}
      {...props}
    >
      {leading}
      <span className="min-w-0 truncate">{children}</span>
    </button>
  );
}

/**
 * A prompt the product is offering. Filled, because it is being suggested
 * rather than merely listed, and always a button — there is no such thing as a
 * suggestion you cannot take.
 */
function SuggestionChip({
  className,
  icon,
  children,
  ...props
}: Omit<React.ComponentProps<"button">, "type"> & { icon?: React.ReactNode }) {
  return (
    <button
      type="button"
      data-slot="suggestion-chip"
      className={cn(
        chipVariants({ variant: "filled", interactive: true }),
        chipPadding(Boolean(icon), false),
        className,
      )}
      {...props}
    >
      {icon}
      <span className="min-w-0 truncate">{children}</span>
    </button>
  );
}

export { Chip, FilterChip, SuggestionChip, chipVariants };
export type { ChipProps };
