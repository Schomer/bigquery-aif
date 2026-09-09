import * as React from "react";

import { Menu, MenuContent, MenuTrigger } from "./menu";
import { ArrowBack, Close, MoreVert } from "./material-symbols";
import { cn } from "./utils";

/**
 * The bar across the top of a feature page: the page title, and the actions
 * that act on the whole page.
 *
 * Every console feature page has one, directly under the blue platform bar, and
 * it is the thing that orients someone before they read a single row — so a
 * screen without one reads as a fragment rather than a page. It is not the
 * platform bar (`ConsoleTopNav`), which belongs to the console rather than to
 * your product, and it is not a table's title bar (`TableTitleBar`), which
 * belongs to one table on the page.
 *
 *     <ActionBar>
 *       <ActionBarTitle>VM instances</ActionBarTitle>
 *       <Button leftIcon={<MaterialSymbols.Add />}>Create instance</Button>
 *       <Button variant="stroked" leftIcon={<MaterialSymbols.Refresh />}>Refresh</Button>
 *       <ActionBarEnd>
 *         <Button variant="stroked" leftIcon={<MaterialSymbols.School />}>Learn</Button>
 *       </ActionBarEnd>
 *     </ActionBar>
 *
 * Two regions, which is the whole layout: everything before `ActionBarEnd` is
 * the main region and packs against the title; `ActionBarEnd` is the right
 * region and packs against the far edge. Anything that is *about* this page —
 * documentation, a feedback link, a print button — goes on the right. Anything
 * that *does* something to it goes on the left.
 *
 * The numbers are the console's, measured off a Compute Engine list page: the
 * bar is 48px tall with a 24px gutter, the title is 20px, actions are 16px
 * apart, and the first action is 48px from the title so the two read as
 * separate regions rather than as one run of text.
 *
 * A plain `Button` is already the 32px this bar wants, so pass no size. Give
 * every one a text label and an icon; an icon-only button in an action bar is a
 * guessing game.
 *
 * On a page with a selectable table the bar has a second state — see
 * `ActionBarSelection` below.
 */

export interface ActionBarProps extends React.ComponentProps<"div"> {
  /**
   * What the bar shows while rows are selected — an `ActionBarSelection`. Pass
   * it conditionally; anything falsy and the bar shows `children` as usual.
   */
  selection?: React.ReactNode;
}

/** 48px tall, 24px gutter, 16px between actions — see the note above. */
export function ActionBar({ className, children, selection, ...props }: ActionBarProps) {
  const selecting = Boolean(selection);
  return (
    <div
      data-slot="action-bar"
      data-selecting={selecting || undefined}
      className={cn(
        "flex h-12 w-full shrink-0 items-center gap-4 px-6",
        selecting && "bg-cm-container-high",
        className,
      )}
      {...props}
    >
      {selecting ? selection : children}
    </div>
  );
}

export interface ActionBarTitleProps extends React.ComponentProps<"h1"> {
  /**
   * Sits beside the title rather than out with the actions — a `Tag` saying
   * what state this resource is in, or a `ProductBadge` saying what launch
   * stage the product is in. Nothing that can be clicked.
   */
  status?: React.ReactNode;
}

/**
 * The page title. `title-medium` — 20px — which is the size the console uses
 * here and one step down from the `headline-small` of a section heading.
 *
 * The 32px right margin is deliberate and adds to the bar's own 16px gap: 48px
 * of air is what stops "VM instances" and "Create instance" reading as one
 * phrase. `status` renders inside that margin, at the title's own 12px, because
 * a resource's state is part of its name here and not one of the actions.
 */
export function ActionBarTitle({ className, children, status, ...props }: ActionBarTitleProps) {
  return (
    <div className="mr-8 flex min-w-0 items-center gap-3">
      <h1
        data-slot="action-bar-title"
        className={cn("text-cm-title-medium text-cm-on-surface truncate", className)}
        {...props}
      >
        {children}
      </h1>
      {status}
    </div>
  );
}

/**
 * The right-hand region. Everything after it in the bar is pushed to the far
 * edge; everything before it stays with the title.
 */
export function ActionBarEnd({ className, children, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="action-bar-end"
      className={cn("ml-auto flex shrink-0 items-center gap-4", className)}
      {...props}
    >
      {children}
    </div>
  );
}

/**
 * 32px round target, on the bar's own rhythm. The `text` Button variant is the
 * wrong neighbour — it is a rounded rectangle in `primary-on-container`, and
 * these are chrome.
 */
const ACTION_BAR_ICON_BUTTON =
  "text-cm-on-surface-variant hover:bg-cm-container focus-visible:ring-cm-outline-focus/50 inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full outline-none transition-colors";

export interface ActionBarNavProps extends Omit<React.ComponentProps<"button">, "children"> {
  /** `back` goes up a level; `close` shuts a panel that opened over the page. */
  variant?: "back" | "close";
}

/**
 * The optional button at the very far left, before the title.
 *
 * Only for a page that is not reachable from the rail — a wizard, a full-page
 * editor, something that opened over the top of what the user was doing. A page
 * with a nav item does not need one, and the console does not give it one:
 * there is already a way back, and a second one that goes somewhere slightly
 * different is worse than none.
 *
 * The negative margin puts the glyph, not the hover circle, on the 24px gutter
 * — so the arrow lines up with the content below it rather than sitting 8px
 * proud of it.
 */
export const ActionBarNav = React.forwardRef<HTMLButtonElement, ActionBarNavProps>(
  function ActionBarNav({ className, variant = "back", type = "button", ...props }, ref) {
    const Glyph = variant === "back" ? ArrowBack : Close;
    return (
      <button
        ref={ref}
        data-slot="action-bar-nav"
        type={type}
        aria-label={variant === "back" ? "Back" : "Close"}
        className={cn(ACTION_BAR_ICON_BUTTON, "-ml-2", className)}
        {...props}
      >
        <Glyph aria-hidden className="size-5" />
      </button>
    );
  },
);

export interface ActionBarSelectionProps {
  /** How many rows are selected. The bar is only rendered when this is > 0. */
  count: number;
  /** Singular noun for the thing being selected — "instance", "bucket". */
  noun: string;
  /** Plural, for the nouns that do not just take an `s`. */
  plural?: string;
  /** Clears the selection. Wired to the `✕` at the far left. */
  onClear?: () => void;
  /** The actions. `Button variant="stroked"`, each with a label and an icon. */
  children?: React.ReactNode;
}

/**
 * What the action bar becomes while rows are selected: a count, and the actions
 * that apply to those rows.
 *
 *     <ActionBar
 *       selection={
 *         selected.length > 0 && (
 *           <ActionBarSelection count={selected.length} noun="instance" onClear={() => setSelected([])}>
 *             <Button variant="stroked" leftIcon={<MaterialSymbols.Delete />}>Delete</Button>
 *           </ActionBarSelection>
 *         )
 *       }
 *     >
 *       <ActionBarTitle>VM instances</ActionBarTitle>
 *       …
 *     </ActionBar>
 *
 * This is where a bulk action belongs, and the reason is that it is the only
 * place the count can live: "Delete" in the page's own bar has to say what it
 * would delete, so it grows a number, and then it has to be disabled while
 * there is nothing to act on. A bar that appears with the selection answers
 * both — the actions are here because rows are selected, and they leave with
 * them.
 *
 * It takes the bar over rather than floating above it. Visually the two are the
 * same thing; the difference is that a covered bar's buttons are still in the
 * tab order, so someone on a keyboard would tab through a row of controls they
 * cannot see. The page's actions are gone while this is up, which is also what
 * the console does.
 *
 * The count is a `role="status"`, not the page's `<h1>` — the heading is still
 * the page's, and selecting three rows should announce itself rather than
 * silently rename the page.
 */
export function ActionBarSelection({
  count,
  noun,
  plural,
  onClear,
  children,
}: ActionBarSelectionProps) {
  return (
    <>
      <ActionBarNav variant="close" aria-label="Clear selection" onClick={onClear} />
      {/* Same 32px margin as `ActionBarTitle`, so the gap before the first
          action does not move when the bar changes over. */}
      <div
        data-slot="action-bar-selection"
        role="status"
        className="text-cm-title-medium text-cm-on-surface mr-8 truncate"
      >
        {count} {count === 1 ? noun : (plural ?? `${noun}s`)} selected
      </div>
      {children}
    </>
  );
}

export interface ActionBarMenuProps {
  /** `MenuItem`s, `MenuSeparator`s — the same children a `Menu` takes. */
  children: React.ReactNode;
  /** Screen-reader name for the trigger. */
  label?: string;
  align?: "start" | "center" | "end";
  className?: string;
}

/**
 * The `⋮` overflow. For actions that are real but secondary — the ones the
 * console keeps out of the bar so the two or three that matter stay legible.
 *
 * This is a deliberate placement, not a responsive one: the kit does not
 * measure the bar and move buttons into the menu when it gets narrow, the way
 * the console's own action bar does. Decide what belongs in here yourself.
 */
export function ActionBarMenu({
  children,
  label = "More actions",
  align = "end",
  className,
}: ActionBarMenuProps) {
  return (
    <Menu>
      <MenuTrigger
        aria-label={label}
        className={cn(ACTION_BAR_ICON_BUTTON, className)}
      >
        <MoreVert aria-hidden className="size-5" />
      </MenuTrigger>
      <MenuContent align={align}>{children}</MenuContent>
    </Menu>
  );
}
