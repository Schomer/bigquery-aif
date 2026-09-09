import * as React from "react";

import { cn } from "./utils";

/**
 * EmptyState — the illustration-and-a-sentence panel for "there is nothing
 * here yet".
 *
 * A centred column, and the spacing between its parts is the whole design:
 *
 *   illustration     248px square
 *      28px
 *   title            title-small, 18px/24px
 *      0
 *   body             body-medium, 14px/20px
 *      32px
 *   actions          32px pill buttons at an 8px gap
 *
 * The nothing between the title and the body is deliberate and measured: they
 * are one sentence broken across two lines, and a gap there would read as two
 * separate statements. The 32px before the actions is what separates *saying*
 * something from *offering* something.
 *
 * Both text tokens sit on `on-surface`. There is no `on-surface-variant` here
 * — an empty state is already quiet, and greying its only sentence makes the
 * screen look broken rather than empty.
 *
 * Everything except the title is optional. The reference does illustration +
 * title + body; illustration + title + body + link + two buttons; and
 * illustration + title + body + a full-width slot of arbitrary content.
 */

/** The illustrations shipped in `public/illustrations`, light and dark. */
const EMPTY_STATE_ILLUSTRATIONS = ["folder", "box", "easel"] as const;

type EmptyStateIllustrationName = (typeof EMPTY_STATE_ILLUSTRATIONS)[number];

function EmptyState({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="empty-state"
      className={cn(
        "flex w-full flex-col items-center text-center",
        className,
      )}
      {...props}
    />
  );
}

/**
 * The 248px square. The glass renders are square with the object floating in
 * the middle, so the box is square too — that is what lets a folder, a box and
 * an easel swap places without the text under them moving.
 *
 * Both themes ship as separate files rather than as one image with a filter,
 * because the dark version is not the light one darkened: the drop shadow
 * inverts into a pool of colour that a CSS filter cannot invent. Both are in
 * the DOM and CSS picks; at ~100KB each that is cheaper than a flash of the
 * wrong artwork on theme change.
 *
 * `aria-hidden`, always. The illustration restates the title in pictures, and
 * a screen reader that announces both has said the same thing twice.
 */
function EmptyStateIllustration({
  name,
  className,
  ...props
}: React.ComponentProps<"div"> & { name: EmptyStateIllustrationName }) {
  return (
    <div
      data-slot="empty-state-illustration"
      aria-hidden
      className={cn("mb-7 size-[248px] shrink-0", className)}
      {...props}
    >
      <img
        src={`illustrations/${name}-light.png`}
        alt=""
        width={248}
        height={248}
        className="size-full dark:hidden"
      />
      <img
        src={`illustrations/${name}-dark.png`}
        alt=""
        width={248}
        height={248}
        className="hidden size-full dark:block"
      />
    </div>
  );
}

function EmptyStateTitle({ className, ...props }: React.ComponentProps<"h2">) {
  return (
    <h2
      data-slot="empty-state-title"
      className={cn("text-cm-title-small text-cm-on-surface", className)}
      {...props}
    />
  );
}

function EmptyStateBody({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="empty-state-body"
      className={cn("text-cm-body-medium text-cm-on-surface", className)}
      {...props}
    />
  );
}

/**
 * The buttons. `flex-wrap` because "Create a dataset" and "Learn about
 * datasets" side by side will not fit an empty state inside a narrow panel,
 * and two stacked buttons beat two clipped ones.
 *
 * This slot lays buttons out and does not style them: put a plain `<Button>`
 * in it. A plain `Button` is the 32px the reference draws, and the corner it
 * comes with is the corner every other button in the product has. The reference
 * draws a pill, but a pill here and a 6px radius everywhere else is a
 * disagreement to settle in `button.tsx`, not to paper over from the outside —
 * a `rounded-full` here would make the empty state the one screen whose
 * buttons are shaped differently.
 */
function EmptyStateActions({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="empty-state-actions"
      className={cn(
        "mt-8 flex flex-wrap items-center justify-center gap-2",
        className,
      )}
      {...props}
    />
  );
}

/**
 * A slot for whatever the title and body cannot say. Unlike them it runs the
 * full width of the panel rather than sitting in the centred text column, so a
 * caller can put a list, a second paragraph or a small form in it.
 */
function EmptyStateContent({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="empty-state-content"
      className={cn(
        "text-cm-body-medium text-cm-on-surface mt-4 w-full",
        className,
      )}
      {...props}
    />
  );
}

/**
 * An inline link in the body. Same treatment as every other link in the
 * system: `link-default` and a 2px underline offset.
 */
function EmptyStateLink({ className, ...props }: React.ComponentProps<"a">) {
  return (
    <a
      data-slot="empty-state-link"
      className={cn(
        "text-cm-link-default focus-visible:ring-cm-outline-focus/50 rounded-sm underline underline-offset-2 outline-none focus-visible:ring-[3px]",
        className,
      )}
      {...props}
    />
  );
}

export {
  EMPTY_STATE_ILLUSTRATIONS,
  EmptyState,
  EmptyStateIllustration,
  EmptyStateTitle,
  EmptyStateBody,
  EmptyStateActions,
  EmptyStateContent,
  EmptyStateLink,
};
export type { EmptyStateIllustrationName };
