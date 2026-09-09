import * as React from "react";

import { Button } from "./button";
import { KeyboardArrowDown } from "./material-symbols";
import { cn } from "./utils";

/**
 * ExpandButton — "Show more" / "Show less" over a block of content.
 *
 * The lightest disclosure the kit has, and the difference from its neighbours
 * is what the closed state looks like:
 *
 *   ExpandButton   a text button under content that is *already* partly shown
 *   Collapsible    a lone section that is entirely hidden until opened
 *   Unfold         a set of headed sections, with a preview line each
 *
 * So this is the one for the tail of a long list or the rest of a description —
 * cases where the reader can see what they are expanding before they press it.
 *
 * The chevron rotates rather than swapping to `keyboard_arrow_up`. One glyph
 * turning is read as the same control changing state; two glyphs alternating
 * is read as two controls, and the rotation carries the direction anyway.
 */

export interface ExpandButtonProps
  extends Omit<React.ComponentProps<"div">, "onToggle"> {
  /** Controlled state. Leave unset for uncontrolled. */
  expanded?: boolean;
  defaultExpanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
  labelCollapsed?: string;
  labelExpanded?: string;
  /** What the button reveals. */
  children?: React.ReactNode;
}

function ExpandButton({
  className,
  expanded,
  defaultExpanded = false,
  onExpandedChange,
  labelCollapsed = "Show more",
  labelExpanded = "Show less",
  children,
  ...props
}: ExpandButtonProps) {
  const [uncontrolled, setUncontrolled] = React.useState(defaultExpanded);
  const isOpen = expanded ?? uncontrolled;
  const contentId = React.useId();

  const toggle = () => {
    if (expanded === undefined) setUncontrolled((open) => !open);
    onExpandedChange?.(!isOpen);
  };

  return (
    <div data-slot="expand-button" className={cn("flex flex-col", className)} {...props}>
      {/*
        The content is before the button in the DOM because that is where it is
        on screen — the button sits under what it expands. Reversing them with
        `flex-col-reverse` would put the button first for a screen reader and
        for the tab order, which is the one thing this arrangement must not do.
      */}
      <div
        id={contentId}
        hidden={!isOpen}
        className={cn(isOpen && "flex flex-col")}
      >
        {children}
      </div>
      <Button
        variant="text"
        aria-expanded={isOpen}
        aria-controls={contentId}
        onClick={toggle}
        className="self-start"
      >
        {isOpen ? labelExpanded : labelCollapsed}
        <KeyboardArrowDown
          aria-hidden
          className={cn("size-[18px] transition-transform", isOpen && "rotate-180")}
        />
      </Button>
    </div>
  );
}

export { ExpandButton };
