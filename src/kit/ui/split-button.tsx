import * as React from "react";

import { Button, type ButtonProps } from "./button";
import { ArrowDropDown } from "./material-symbols";
import { Menu, MenuContent, MenuTrigger } from "./menu";
import { cn } from "./utils";

/**
 * SplitButton — one default action, plus its neighbours behind a caret.
 *
 * "Create instance" with "Create from template" and "Import VM" tucked beside
 * it. The point is that the common case stays one click: a plain `Menu` makes
 * every option cost two, and a row of three buttons says all three are equally
 * likely, which they are not.
 *
 * ### It is two buttons, not one
 *
 * The action and the caret are separate `<button>`s with a hairline between
 * them, because they do separate things and a screen reader has to be able to
 * say so. That is also why the caret gets its own `aria-label` — "More create
 * options" and not the action's name, which is what a single button with a
 * `menu` variant would have announced.
 *
 * The seam is drawn by squaring the inner corners: the action loses its right
 * radius, the caret loses its left, and a 1px rule sits between. Nothing here
 * overrides `Button`'s height, fill or type — the corners are layout, which
 * AGENTS.md §5 puts on the right side of the line.
 *
 * ### Use it sparingly
 *
 * At most one per page, in the `ActionBar`, and only when there is a genuine
 * default. Two split buttons side by side is four actions dressed as two, and
 * a split button whose menu holds the thing everyone actually wants is a
 * default chosen wrong.
 */

export interface SplitButtonProps extends Omit<ButtonProps, "asChild" | "children"> {
  /** The default action's label. */
  label: React.ReactNode;
  /** Fires when the label half is pressed. */
  onAction?: React.MouseEventHandler<HTMLButtonElement>;
  /** `MenuItem`s for the caret half. */
  children?: React.ReactNode;
  /** Names the caret for a screen reader. */
  menuLabel?: string;
  /** Width of the menu panel. Defaults to Radix's content-sized default. */
  menuClassName?: string;
}

function SplitButton({
  className,
  label,
  onAction,
  children,
  menuLabel = "More options",
  menuClassName,
  variant = "default",
  size,
  disabled,
  leftIcon,
  icon,
  ...props
}: SplitButtonProps) {
  return (
    <div
      data-slot="split-button"
      className={cn("inline-flex items-stretch", className)}
    >
      <Button
        variant={variant}
        size={size}
        disabled={disabled}
        leftIcon={leftIcon ?? icon}
        onClick={onAction}
        className="rounded-r-none"
        {...props}
      >
        {label}
      </Button>
      {/*
        The rule is its own element rather than a border on either button.
        A border would sit inside the focus ring of whichever button owned it
        and shift by a pixel when that button was focused; a sibling does not
        move. `bg-cm-hairline` on a filled button is the same hairline the
        stroked variant outlines itself with, which is what CDS draws.
      */}
      <span
        aria-hidden
        className={cn("bg-cm-hairline w-px shrink-0", disabled && "opacity-38")}
      />
      <Menu>
        <MenuTrigger asChild>
          <Button
            variant={variant}
            size={size}
            disabled={disabled}
            aria-label={menuLabel}
            className="rounded-l-none px-1"
          >
            <ArrowDropDown aria-hidden className="size-[18px]" />
          </Button>
        </MenuTrigger>
        <MenuContent align="end" className={menuClassName}>
          {children}
        </MenuContent>
      </Menu>
    </div>
  );
}

export { SplitButton };
