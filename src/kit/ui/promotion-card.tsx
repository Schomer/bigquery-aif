import * as React from "react";

import { Button } from "./button";
import { Close } from "./material-symbols";
import { ProductBadge, type ProductBadgeProps } from "./product-badge";
import { cn } from "./utils";

/**
 * PromotionCard — the banner that tells you about a feature you are not using.
 *
 * "Try BigQuery Studio", "Gemini can write this query for you". It is an
 * advertisement inside the product, and the whole design problem is that it has
 * to be noticeable without being the loudest thing on a page the reader came to
 * for something else.
 *
 * The kit's answer is the same one the console uses: `container-primary` fill,
 * a hairline in the matching outline token, a glass illustration on the leading
 * edge, and — the important part — a dismiss button.
 *
 *     <PromotionCard
 *       illustration="rocket"
 *       title="Shiny new feature"
 *       actions={
 *         <>
 *           <Button>Take action</Button>
 *           <Button variant="stroked">Learn more</Button>
 *         </>
 *       }
 *     >
 *       Here is some lorem ipsum describing the shiny new feature.
 *     </PromotionCard>
 *
 * ### The outline is not decoration
 *
 * `container-primary` is `#f5fbff` — four points off white. On a `surface` page
 * the fill alone is very nearly invisible, and a promotion nobody can see is a
 * promotion that gets rebuilt louder by the next person. `container-primary-
 * outline` exists for exactly this pair and is the only border the kit draws in
 * it. It is a hairline, not a frame: enough to say "this region is separate",
 * not enough to read as a form field.
 *
 * ### Dismissible by default, and it means it
 *
 * `dismissible` defaults to **on** here where CDS defaults it off. A promotion
 * the reader cannot get rid of is the thing everyone hates about promotions,
 * and defaulting it off means the version that ships is the annoying one unless
 * somebody remembers. Dismissal is uncontrolled unless you pass `onDismiss` —
 * the card just goes away, which is what a prototype wants.
 *
 * ### One per screen
 *
 * Two of these stacked is not two offers, it is a sidebar of ads. If a page has
 * several things to promote, that is a "What's new" surface, not three cards.
 */

/**
 * The glass renders shipped in `public/illustrations`, light and dark.
 *
 * A separate list from `EMPTY_STATE_ILLUSTRATIONS` because the two say
 * different things. An empty state's artwork is about absence — a folder, a
 * box, an easel, all of them empty containers. A promotion's is about arrival:
 * a rocket for something launching, a sprouting plant for something to grow
 * into. Swapping one set for the other would be a picture arguing with its
 * caption.
 */
const PROMOTION_CARD_ILLUSTRATIONS = ["rocket", "sprouting-plant"] as const;

type PromotionCardIllustrationName = (typeof PROMOTION_CARD_ILLUSTRATIONS)[number];

/**
 * 104px, which is the reference measured off its own screenshot rather than
 * guessed: the scalloped blob reads at 88px and the render carries 7.4% of
 * transparent margin on every side, so the box has to be the larger number for
 * the picture to be the smaller one.
 *
 * Both themes ship as separate files rather than as one image with a filter,
 * for the reason `EmptyStateIllustration` gives: the dark version is not the
 * light one darkened — the blob behind the object changes hue, and no CSS
 * filter invents that.
 */
function PromotionCardIllustration({ name }: { name: PromotionCardIllustrationName }) {
  return (
    <>
      <img
        src={`illustrations/${name}-light.png`}
        alt=""
        width={104}
        height={104}
        className="size-full dark:hidden"
      />
      <img
        src={`illustrations/${name}-dark.png`}
        alt=""
        width={104}
        height={104}
        className="hidden size-full dark:block"
      />
    </>
  );
}

// `title` on a DOM element is the browser's tooltip attribute and only takes a
// string. Ours is a heading and takes nodes, so the native one is omitted
// rather than left to collide — the same trade `RichCard` makes.
export interface PromotionCardProps extends Omit<React.ComponentProps<"aside">, "title"> {
  title?: React.ReactNode;
  /** A launch-stage badge beside the title — the same `ProductBadge` variants. */
  badge?: ProductBadgeProps["variant"];
  /** One of the shipped glass renders. Takes precedence over `image`. */
  illustration?: PromotionCardIllustrationName;
  /** Artwork the kit does not ship, in the same 104px box. A node, not a name. */
  image?: React.ReactNode;
  /** Buttons under the copy. A filled one and a `stroked` one, in that order. */
  actions?: React.ReactNode;
  dismissible?: boolean;
  /** Called instead of self-dismissing, so the host can remember the choice. */
  onDismiss?: () => void;
}

function PromotionCard({
  className,
  title,
  badge,
  illustration,
  image,
  actions,
  dismissible = true,
  onDismiss,
  children,
  ...props
}: PromotionCardProps) {
  const [dismissed, setDismissed] = React.useState(false);
  if (dismissed) return null;

  const artwork = illustration ? <PromotionCardIllustration name={illustration} /> : image;

  return (
    <aside
      data-slot="promotion-card"
      className={cn(
        "bg-cm-container-primary border-cm-container-primary-outline flex items-start gap-4 rounded-[12px] border p-4",
        className,
      )}
      {...props}
    >
      {artwork && (
        // Centred against the copy rather than aligned to its first line: the
        // illustration is the tallest thing in the row, so on a one-line card
        // it sets the height and on a three-line one it sits in the middle of
        // what it illustrates. `EmptyState` stacks instead and has no such
        // problem.
        <div className="size-[104px] shrink-0 self-center [&>svg]:size-10" aria-hidden>
          {artwork}
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        {(title || badge) && (
          <div className="flex items-center gap-2.5">
            {/* One step below the `headline-small` the reference draws. A promo
                heading that outranks `ActionBarTitle` — the page's own 20px
                `<h1>` — is an advertisement shouting over the thing the reader
                came for, which is the one failure mode this component has. */}
            {title && <h3 className="text-cm-title-medium text-cm-on-container">{title}</h3>}
            {badge && <ProductBadge variant={badge} />}
          </div>
        )}
        {children && <div className="text-cm-body-medium text-cm-on-container">{children}</div>}
        {/* 20px off the copy, against the 8px inside it: the buttons are a
            separate offer, not the last line of the sentence. */}
        {actions && <div className="mt-3 flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {dismissible && (
        <Button
          variant="text"
          size="icon"
          aria-label="Dismiss"
          className="-mr-1 -mt-1 shrink-0"
          onClick={() => (onDismiss ? onDismiss() : setDismissed(true))}
        >
          <Close aria-hidden className="size-[18px]" />
        </Button>
      )}
    </aside>
  );
}

export { PROMOTION_CARD_ILLUSTRATIONS, PromotionCard };
export type { PromotionCardIllustrationName };
