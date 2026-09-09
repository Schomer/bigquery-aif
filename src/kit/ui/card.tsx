import * as React from "react";

import { cn } from "./utils";

/**
 * A tinted panel that groups a few related things and, usually, offers an
 * action on them.
 *
 *     <Card className="w-[422px]">
 *       <CardHeader>
 *         <CardTitle>Try BQUI Card</CardTitle>
 *       </CardHeader>
 *       <CardDescription>
 *         This simple query demonstrates how to use the card component.
 *       </CardDescription>
 *       <CardFooter>
 *         <Button variant="stroked">Primary action</Button>
 *         <Button variant="stroked">Secondary action</Button>
 *       </CardFooter>
 *     </Card>
 *
 * ### It is a tint, not a box
 *
 * `surface-variant` fill, 16px radius, no border and no shadow. Every reference
 * this was measured from does the same thing, and the reason is that the
 * console's page background is already `surface` — a card that both tinted
 * *and* outlined itself would be saying the same thing twice, and four of them
 * in a row turns a page into a grid of boxes. The tint is the whole boundary.
 *
 * A card that needs a hairline is usually not a card: a table has `TableFrame`,
 * a warning has `Callout`, and a thing the user picks out of a list is a row.
 *
 * ### The parts, and the gaps between them
 *
 * 16px of padding, and 12px between every top-level part — header, media,
 * content, footer — because they are separate blocks rather than one passage of
 * text. Inside `CardHeader` the gap closes to nothing: a title and the subtitle
 * under it are one label on two lines, and 12px between them reads as two
 * labels.
 *
 * That gives `CardDescription` two jobs from one component, decided by where it
 * sits. Inside the header it is a subtitle, tight under the title. Directly
 * inside the card it is the card's body copy, a normal 12px down. Both are in
 * the references; both are the same 14px `on-surface-variant`.
 *
 * ### The footer hangs 8px out
 *
 * `CardFooter` carries `-mx-2 -mb-2`, so its buttons sit 8px from the card's
 * edge while everything above them sits at the full 16. This is measured rather
 * than invented — all three console references do it, and it is the usual
 * treatment for an action area: a button already carries its own padding, so
 * indenting it the full 16 as well leaves the row looking adrift from the text
 * it belongs to.
 *
 * Buttons in here are plain `Button`s, normally `stroked`. Do not resize them
 * and do not restyle their corners.
 */

function Card({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card"
      className={cn(
        "bg-cm-surface-variant text-cm-body-medium text-cm-on-surface flex flex-col gap-3 rounded-[16px] p-4",
        // `overflow-hidden`, so `CardMedia` can run out to the edges and still
        // be cut by the card's corners without having to know about them.
        "overflow-hidden",
        className,
      )}
      {...props}
    />
  );
}

/**
 * A picture that runs the full width of the card, ignoring its padding.
 *
 * At the top of a card it takes the card's top corners; in the middle it is a
 * plain band with square edges. Both fall out of the `first:`/`last:` here plus
 * the `overflow-hidden` above, so the same element works in either place.
 *
 *     <CardMedia>
 *       <img src={cover} alt="" className="h-[226px]" />
 *     </CardMedia>
 *
 * The height is the picture's, not the card's — set it on the image.
 */
function CardMedia({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-media"
      className={cn(
        "-mx-4 first:-mt-4 last:-mb-4",
        "[&>img]:block [&>img]:w-full [&>img]:object-cover",
        className,
      )}
      {...props}
    />
  );
}

export interface CardHeaderProps extends React.ComponentProps<"div"> {
  /**
   * An avatar or a product glyph at the left of the header, vertically centred
   * on the title stack. A 40px `<img className="rounded-full">`, or an icon —
   * a bare `<svg>` is sized to 28px, which is the reference.
   */
  media?: React.ReactNode;
}

/**
 * The title row: an optional leading avatar or icon, the title, and an optional
 * subtitle under it.
 *
 *     <CardHeader media={<img src={avatar} alt="" className="size-10 rounded-full" />}>
 *       <CardTitle level={2}>Card</CardTitle>
 *       <CardDescription>Extra large</CardDescription>
 *     </CardHeader>
 *
 * Only what identifies the card goes in here. A card whose description is a
 * sentence rather than a subtitle should put that `CardDescription` outside the
 * header, so it starts at the card's edge instead of being indented under the
 * title by the width of the avatar.
 */
function CardHeader({ className, media, children, ...props }: CardHeaderProps) {
  // `CardAction` reads better as a sibling of the title than as a prop holding
  // JSX, so it is lifted out of the title stack here rather than being placed
  // by CSS — the stack is a `flex-col` and the action has to leave it.
  const items = React.Children.toArray(children);
  const action = items.find(
    (child) => React.isValidElement(child) && child.type === CardAction,
  );
  const stack = items.filter((child) => child !== action);

  return (
    <div data-slot="card-header" className={cn("flex items-center gap-4", className)} {...props}>
      {media ? (
        <div data-slot="card-header-media" className="flex shrink-0 items-center [&>svg]:size-7">
          {media}
        </div>
      ) : null}
      <div className="flex min-w-0 flex-1 flex-col">{stack}</div>
      {action}
    </div>
  );
}

type CardTitleLevel = 2 | 3 | 4 | 5 | 6;

/** The tag `level` picks, and the type token that comes with it. */
const CARD_TITLE_TEXT: Record<CardTitleLevel, string> = {
  2: "text-cm-title-large",
  3: "text-cm-title-medium",
  4: "text-cm-title-small",
  5: "text-cm-label-large",
  6: "text-cm-body-large",
};

export interface CardTitleProps extends React.ComponentProps<"h4"> {
  /** 2–6. Picks the tag *and* the size, on the same ladder `Unfold` walks. */
  level?: CardTitleLevel;
}

/**
 * The card's name. `title-small` — 18px at weight 400 — by default.
 *
 * `level` works the way `Unfold`'s does: it picks the tag and the type token
 * together, walking one ladder, so a card cannot end up visually large and
 * semantically deep at the same time. The references sit on three of its rungs
 * — 18px for a card in a grid, 20px for a card that is most of a page, 22px for
 * one with a 40px avatar beside it — which are `level` 4, 3 and 2.
 *
 * Weight 400 throughout. A card title is not bold in any of them; it is set
 * apart by being larger than the copy under it, and that is enough.
 */
function CardTitle({ className, level = 4, ...props }: CardTitleProps) {
  const Tag = `h${level}` as "h4";
  return (
    <Tag
      data-slot="card-title"
      className={cn(CARD_TITLE_TEXT[level], "text-cm-on-surface", className)}
      {...props}
    />
  );
}

/**
 * Supporting text. A subtitle when it is inside `CardHeader`, the card's body
 * copy when it is a direct child of `Card` — see the note on `Card` itself.
 */
function CardDescription({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="card-description"
      className={cn("text-cm-body-medium text-cm-on-surface-variant", className)}
      {...props}
    />
  );
}

/**
 * The trailing control in a header — an overflow menu, a dismiss button. Write
 * it as the last child of `CardHeader`.
 *
 * One control, and only one that acts on the whole card. Anything the reader is
 * meant to notice belongs in `CardFooter`, where it gets a label.
 */
function CardAction({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="card-action" className={cn("shrink-0", className)} {...props} />;
}

/**
 * The card's body — whatever is not the header, a picture or the actions.
 * `on-surface`, because this is the card's own text rather than a note about
 * it; `CardDescription` is the quieter one.
 */
function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-content"
      className={cn("text-cm-body-medium text-cm-on-surface", className)}
      {...props}
    />
  );
}

/**
 * The action row. Buttons, 8px apart, hanging 8px out of the card's padding —
 * see the note on `Card`.
 *
 * Add `justify-end` to push them to the right edge. The default is left, under
 * the text they act on, which is what the console references do.
 */
function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-footer"
      className={cn("-mx-2 flex items-center gap-2 last:-mb-2", className)}
      {...props}
    />
  );
}

export {
  Card,
  CardMedia,
  CardHeader,
  CardFooter,
  CardTitle,
  CardAction,
  CardDescription,
  CardContent,
};
