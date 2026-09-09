import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "./utils";

/**
 * The filled pill that follows a product's name to say what launch stage it is
 * in. It takes its own label from the variant, so there is one spelling of
 * "Preview" in the console rather than six:
 *
 *   <h1 className="text-cm-headline-small flex items-center gap-2.5">
 *     Dataform
 *     <ProductBadge variant="preview" />
 *   </h1>
 *
 * In an action bar it goes in the slot that already exists for it:
 *
 *   <ActionBarTitle status={<ProductBadge variant="new" />}>Dataform</ActionBarTitle>
 *
 * ### Not a `Tag`, and not a `Chip`
 *
 * A `Tag` describes the row or record it sits on and there may be a hundred of
 * them on a page; a `Chip` is something to press. This is neither. It labels
 * the *product*, it never varies with the data, and there is at most one per
 * page — which is why it can afford to be filled and they cannot. Two of these
 * on one screen is a bug, not a denser page.
 *
 * ### The size does not follow the heading
 *
 * 20px tall with 12px text, next to a 24px page title and next to a 20px
 * action bar title alike — both measured off the same reference, both the same
 * badge. A badge that grew with its heading would compete with it; this one
 * stays a footnote. 5px of side padding and a 4px radius, which is the one
 * place in the kit a pill is not `rounded-full`: at 20px tall a full round on
 * a three-letter word turns it into a lozenge.
 *
 * ### Where the colours come from
 *
 * `new` is `primary` — the reference's fill is `#496cc3` to the bit. `preview`
 * is `on-surface-variant`: the reference paints it a teal that is not one of
 * the 42 tokens, and `on-surface-variant` is the palette's mid-tone neutral,
 * which is the same job — present, calmer than `primary`, and it inverts
 * correctly in dark mode where a hard-coded teal would not.
 */

const productBadgeVariants = cva(
  cn(
    "inline-flex h-5 w-fit shrink-0 items-center justify-center rounded-[4px] px-[5px]",
    "text-cm-body-small whitespace-nowrap",
  ),
  {
    variants: {
      variant: {
        preview: "bg-cm-on-surface-variant text-cm-surface",
        new: "bg-cm-primary text-cm-on-primary",
      },
    },
    defaultVariants: {
      variant: "preview",
    },
  },
);

type ProductBadgeVariant = NonNullable<
  VariantProps<typeof productBadgeVariants>["variant"]
>;

/**
 * The word each variant says when nothing else is passed. Override it with
 * children for the stages that are not in the pair — `Pre-GA`, `Experimental`
 * — but keep the colour that matches: an experimental thing is a `preview`.
 */
const PRODUCT_BADGE_LABEL: Record<ProductBadgeVariant, string> = {
  preview: "Preview",
  new: "New",
};

export interface ProductBadgeProps
  extends React.ComponentProps<"span">,
    VariantProps<typeof productBadgeVariants> {}

function ProductBadge({
  className,
  variant,
  children,
  ...props
}: ProductBadgeProps) {
  return (
    <span
      data-slot="product-badge"
      data-variant={variant ?? "preview"}
      className={cn(productBadgeVariants({ variant }), className)}
      {...props}
    >
      {children ?? PRODUCT_BADGE_LABEL[variant ?? "preview"]}
    </span>
  );
}

export { ProductBadge, productBadgeVariants };
