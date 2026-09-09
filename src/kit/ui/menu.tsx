"use client";

import * as React from "react";
import * as MenuPrimitive from "@radix-ui/react-dropdown-menu";
import { ArrowRight, Check, Circle } from "./material-symbols";

import { cn } from "./utils";

/**
 * Menu — a list of actions hung off a trigger.
 *
 * Every measurement here comes from the Cloud menu spec and adds up exactly:
 * 8px of panel padding, a 28px section title, 32px rows, and a full-bleed
 * hairline with 8px on each side. Two groups of two items with a title each is
 * therefore a 217px panel, which is what the reference renders.
 *
 * The rows are full-bleed rather than inset pills — the panel has no horizontal
 * padding, so a hover covers the whole width and the 16px is padding on the row
 * itself. That is what keeps a section title and an item on the same left edge.
 *
 * Colours are tokens throughout: `surface-elevation` for the panel (the token
 * whose whole job is "a surface floating above the page"), `on-surface` for
 * items, `on-surface-variant` for section titles, `hairline` for the rule and
 * `container-high` for the hover.
 */

/**
 * Submenu affordance — Material `arrow_right`, the solid triangle the spec
 * draws, not the stroked `chevron_right`, which at this size reads as a
 * different mark rather than a smaller one.
 *
 * Two adjustments turn a 24px icon box into the spec's 5×10 mark. `size-6`
 * because the ink is 200×400 of the 960 grid, so a 24px box draws it at exactly
 * 5×10. `-mr-[9px]` because the box then carries 9px of empty grid to the right
 * of the ink, and it is the triangle, not its bounding box, that should sit on
 * the row's 16px padding edge.
 */
function MenuCaretRight({ className }: { className?: string }) {
  return (
    <ArrowRight
      aria-hidden
      className={cn("-mr-[9px] size-6 shrink-0", className)}
    />
  );
}

/**
 * Shared by the root panel and every submenu panel — they are the same object.
 * Exported because Menubar and ContextMenu open the same panel too, and Radix
 * gives each of those its own primitive package: they cannot reuse
 * `MenuContent` itself (it reads dropdown-menu context), so they reuse the
 * surface. Deliberately free of any --radix-* custom property, which is the
 * one thing that differs between the three.
 */
/*
 * The Radix package keeps its upstream name — the primitive is
 * @radix-ui/react-dropdown-menu regardless of what we call the component — and
 * so do the CSS custom properties it sets (--radix-dropdown-menu-*).
 */
const MENU_PANEL =
  "bg-cm-surface-elevation text-cm-on-surface shadow-cm-elevation z-50 min-w-[8rem] overflow-hidden rounded-[12px] py-2 " +
  "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 " +
  "data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2";

/**
 * One 32px row. `h-8` rather than padding so a row with an icon, a checkmark or
 * nothing at all is the same height, and a menu's height stays predictable.
 */
const MENU_ROW =
  "relative flex h-8 cursor-pointer items-center gap-3 px-4 text-cm-body-medium text-cm-on-surface outline-hidden transition-colors select-none " +
  "focus:bg-cm-container-high hover:bg-cm-container-high " +
  "data-[disabled]:pointer-events-none data-[disabled]:opacity-38 " +
  "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 [&_svg:not([class*='text-'])]:text-cm-on-surface-variant";

/**
 * Section title. 28px tall — the 16px line of `label-small` inside 6px — and
 * `on-surface-variant`, so it groups the rows below it without competing with
 * them for the eye.
 */
const MENU_LABEL =
  "text-cm-label-small text-cm-on-surface-variant flex h-7 items-center px-4 data-[inset]:pl-10";

/**
 * Full-bleed rule with 8px above and below. Edge-to-edge rather than inset:
 * it is separating two sections of the panel, not two rows of a list.
 */
const MENU_SEPARATOR = "bg-cm-hairline my-2 h-px";

/**
 * `tracking-widest` is not part of the `body-small` token and is not an override
 * of it either — the 16 type tokens set size, line-height and weight, and say
 * nothing about letterspacing. It is here because `⌘⇧K` is a row of glyphs to be
 * picked apart, not a word to be read, and set solid it reads as one symbol.
 * Letterspacing is only sanctioned on runs like this; never on prose.
 */
const MENU_SHORTCUT =
  "text-cm-body-small text-cm-on-surface-variant ml-auto tracking-widest";

function Menu({
  ...props
}: React.ComponentProps<typeof MenuPrimitive.Root>) {
  return <MenuPrimitive.Root data-slot="menu" {...props} />;
}

function MenuPortal({
  ...props
}: React.ComponentProps<typeof MenuPrimitive.Portal>) {
  return (
    <MenuPrimitive.Portal data-slot="menu-portal" {...props} />
  );
}

function MenuTrigger({
  ...props
}: React.ComponentProps<typeof MenuPrimitive.Trigger>) {
  return (
    <MenuPrimitive.Trigger
      data-slot="menu-trigger"
      {...props}
    />
  );
}

function MenuContent({
  className,
  sideOffset = 4,
  ...props
}: React.ComponentProps<typeof MenuPrimitive.Content>) {
  return (
    <MenuPrimitive.Portal>
      <MenuPrimitive.Content
        data-slot="menu-content"
        sideOffset={sideOffset}
        className={cn(
          MENU_PANEL,
          "max-h-(--radix-dropdown-menu-content-available-height) origin-(--radix-dropdown-menu-content-transform-origin) overflow-y-auto",
          className,
        )}
        {...props}
      />
    </MenuPrimitive.Portal>
  );
}

function MenuGroup({
  ...props
}: React.ComponentProps<typeof MenuPrimitive.Group>) {
  return (
    <MenuPrimitive.Group data-slot="menu-group" {...props} />
  );
}

/**
 * Every row looks the same. There is no red one.
 *
 * A menu item used to take `variant="destructive"` and paint itself in
 * `status-error`, which is not what the console does: a delete in an overflow
 * menu is the same colour as everything above it, and the warning is the
 * confirmation `Dialog` it opens, not the colour of the word. Red in a menu
 * spends the strongest signal the palette has on a row that has not done
 * anything yet, and it puts an error colour on something that is not an error.
 */
function MenuItem({
  className,
  inset,
  ...props
}: React.ComponentProps<typeof MenuPrimitive.Item> & {
  inset?: boolean;
}) {
  return (
    <MenuPrimitive.Item
      data-slot="menu-item"
      data-inset={inset}
      className={cn(
        MENU_ROW,
        // `inset` aligns a label-only row with rows that carry a 16px leading
        // icon, so a group of items keeps one text edge.
        "data-[inset]:pl-10",
        className,
      )}
      {...props}
    />
  );
}

/**
 * Checkbox and radio rows keep the same 32px height and the same text edge as
 * an `inset` item, with the indicator sitting in the 16px gutter that edge
 * leaves behind.
 */
function MenuCheckboxItem({
  className,
  children,
  checked,
  ...props
}: React.ComponentProps<typeof MenuPrimitive.CheckboxItem>) {
  return (
    <MenuPrimitive.CheckboxItem
      data-slot="menu-checkbox-item"
      className={cn(MENU_ROW, "pl-10", className)}
      checked={checked}
      {...props}
    >
      <span className="pointer-events-none absolute left-4 flex size-4 items-center justify-center">
        <MenuPrimitive.ItemIndicator>
          <Check className="size-4 text-cm-on-surface" />
        </MenuPrimitive.ItemIndicator>
      </span>
      {children}
    </MenuPrimitive.CheckboxItem>
  );
}

function MenuRadioGroup({
  ...props
}: React.ComponentProps<typeof MenuPrimitive.RadioGroup>) {
  return (
    <MenuPrimitive.RadioGroup
      data-slot="menu-radio-group"
      {...props}
    />
  );
}

function MenuRadioItem({
  className,
  children,
  ...props
}: React.ComponentProps<typeof MenuPrimitive.RadioItem>) {
  return (
    <MenuPrimitive.RadioItem
      data-slot="menu-radio-item"
      className={cn(MENU_ROW, "pl-10", className)}
      {...props}
    >
      <span className="pointer-events-none absolute left-4 flex size-4 items-center justify-center">
        <MenuPrimitive.ItemIndicator>
          <Circle className="size-2 fill-cm-primary text-cm-primary" />
        </MenuPrimitive.ItemIndicator>
      </span>
      {children}
    </MenuPrimitive.RadioItem>
  );
}

function MenuLabel({
  className,
  inset,
  ...props
}: React.ComponentProps<typeof MenuPrimitive.Label> & {
  inset?: boolean;
}) {
  return (
    <MenuPrimitive.Label
      data-slot="menu-label"
      data-inset={inset}
      className={cn(MENU_LABEL, className)}
      {...props}
    />
  );
}

function MenuSeparator({
  className,
  ...props
}: React.ComponentProps<typeof MenuPrimitive.Separator>) {
  return (
    <MenuPrimitive.Separator
      data-slot="menu-separator"
      className={cn(MENU_SEPARATOR, className)}
      {...props}
    />
  );
}

function MenuShortcut({
  className,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="menu-shortcut"
      className={cn(MENU_SHORTCUT, className)}
      {...props}
    />
  );
}

function MenuSub({
  ...props
}: React.ComponentProps<typeof MenuPrimitive.Sub>) {
  return <MenuPrimitive.Sub data-slot="menu-sub" {...props} />;
}

/**
 * A row that happens to open another panel. It keeps the open state lit, so
 * while a submenu is showing you can still see which row it belongs to.
 */
function MenuSubTrigger({
  className,
  inset,
  children,
  ...props
}: React.ComponentProps<typeof MenuPrimitive.SubTrigger> & {
  inset?: boolean;
}) {
  return (
    <MenuPrimitive.SubTrigger
      data-slot="menu-sub-trigger"
      data-inset={inset}
      className={cn(
        MENU_ROW,
        "data-[inset]:pl-10 data-[state=open]:bg-cm-container-high",
        className,
      )}
      {...props}
    >
      {children}
      <MenuCaretRight className="text-cm-on-surface ml-auto" />
    </MenuPrimitive.SubTrigger>
  );
}

function MenuSubContent({
  className,
  ...props
}: React.ComponentProps<typeof MenuPrimitive.SubContent>) {
  return (
    <MenuPrimitive.SubContent
      data-slot="menu-sub-content"
      className={cn(
        MENU_PANEL,
        "origin-(--radix-dropdown-menu-content-transform-origin)",
        className,
      )}
      {...props}
    />
  );
}

export {
  MENU_PANEL,
  MENU_ROW,
  MENU_LABEL,
  MENU_SEPARATOR,
  MENU_SHORTCUT,
  MenuCaretRight,
  Menu,
  MenuPortal,
  MenuTrigger,
  MenuContent,
  MenuGroup,
  MenuLabel,
  MenuItem,
  MenuCheckboxItem,
  MenuRadioGroup,
  MenuRadioItem,
  MenuSeparator,
  MenuShortcut,
  MenuSub,
  MenuSubTrigger,
  MenuSubContent,
};
