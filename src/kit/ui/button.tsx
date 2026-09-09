import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "./utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-cm-label-medium transition-all disabled:pointer-events-none disabled:shadow-none disabled:text-cm-on-surface/38 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-cm-outline-focus focus-visible:ring-cm-outline-focus/50 focus-visible:ring-[3px]",
  {
    variants: {
      variant: {
        default:
          "bg-cm-primary text-cm-on-primary hover:bg-cm-outline-focus focus-visible:ring-cm-primary/40 disabled:bg-cm-on-surface/12 disabled:text-cm-on-surface/38",
        // Transparent, not white. An outlined button is an outline: it takes
        // the colour of whatever it is standing on, and on `surface` — where
        // almost all of them stand — that is the same white it used to paint
        // itself. The difference shows on anything else. A white pill on the
        // `container-high` of a selection bar reads as a card punched into the
        // bar rather than a button on it, which is the same mistake
        // `stroked-inverse` below exists to avoid.
        //
        // Hover is a translucent wash for the same reason. `container-high`
        // was an opaque fill, so on a `container-high` bar hovering repainted
        // the button in the bar's own colour and the fill appeared to vanish.
        // 8% of `on-surface` darkens whatever is behind it instead.
        stroked:
          "border border-cm-hairline bg-transparent text-cm-primary-on-container hover:bg-cm-on-surface/8 disabled:bg-transparent disabled:border-cm-hairline/38 disabled:text-cm-on-surface/38",
        outline:
          "border border-cm-hairline bg-transparent text-cm-primary-on-container hover:bg-cm-on-surface/8 disabled:bg-transparent disabled:border-cm-hairline/38 disabled:text-cm-on-surface/38",
        // `stroked` sitting on an inverse surface — the snackbar bar, and any
        // future dark-on-light panel. Same shape as `stroked`, but the fill and
        // the label flip to the inverse pair so the button reads as an outline
        // on `surface-inverse` instead of a white card punched into it.
        "stroked-inverse":
          "border border-cm-hairline bg-transparent text-cm-on-surface-inverse hover:bg-cm-on-surface-inverse/8 disabled:bg-transparent disabled:border-cm-hairline/38 disabled:text-cm-on-surface-inverse/38",
        text:
          "text-cm-primary-on-container hover:bg-cm-backdrop disabled:bg-transparent disabled:text-cm-on-surface/38",
        ghost:
          "text-cm-primary-on-container hover:bg-cm-backdrop disabled:bg-transparent disabled:text-cm-on-surface/38",
        menu:
          "text-cm-primary-on-container hover:bg-cm-backdrop gap-1.5 focus-visible:ring-cm-primary/40 disabled:bg-transparent disabled:text-cm-on-surface/38",
        link:
          "text-cm-primary underline-offset-4 hover:underline disabled:text-cm-on-surface/38 disabled:no-underline",
      },
      // 32px is the console's button, measured off a live page: a
      // "Create instance" with a leading icon comes out 148px wide, which is
      // this padding to the pixel. There used to be a 36px `default` and a
      // 32px `sm`, and every component in the kit that needed to look like the
      // console — the empty state, the snackbar action, the column menu's
      // footer — passed `sm`. When the whole codebase overrides a default, the
      // default is wrong; `sm` is gone rather than left as a second name for
      // the same 32px.
      //
      // There is no `lg` either. A 40px button is not a size the console has:
      // a page's primary action is the same 32px as everything else and is
      // told apart by variant and position, not by being taller. The only
      // other entry is `icon`, which is the same 32px made square.
      size: {
        default: "h-8 gap-1.5 px-3 has-[>svg]:px-2.5",
        icon: "size-8 rounded-md",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ComponentProps<"button">,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  icon?: React.ReactNode;
  leftIcon?: React.ReactNode;
}

/**
 * `forwardRef` is load-bearing, not boilerplate. Every Radix overlay trigger —
 * Menu, Callout, RichTooltip, Dialog, Subtask — is used
 * here as `<Trigger asChild><Button …/></Trigger>`, which clones the Button and
 * hands it a ref. On React 18 a plain function component drops that ref, so
 * Popper never learns where its anchor is and positions the panel at the
 * viewport origin — the callout opened, it just opened off-screen.
 *
 * There is deliberately no inline `style` here. There used to be one pinning
 * 14px/20px/500 and the brand family, which is exactly `label-medium` — but an
 * inline style outranks every class, so `<Button className="text-cm-title-small">`
 * silently did nothing and the button was the one component in the kit you could
 * not restyle. The token is in the cva base now, where a caller can override it.
 */
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    className,
    variant,
    size,
    asChild = false,
    icon,
    leftIcon,
    children,
    ...props
  },
  ref,
) {
  const renderIcon = icon || leftIcon;
  const isMenu = variant === "menu";

  const iconSlot = renderIcon ? (
    <span
      key="icon"
      className="shrink-0 text-current flex items-center justify-center [&_svg]:text-current"
    >
      {renderIcon}
    </span>
  ) : null;

  const caret = isMenu ? (
    <svg
      key="caret"
      width="8"
      height="4"
      viewBox="0 0 8 4"
      fill="currentColor"
      style={{ width: "8px", height: "4px" }}
      className="ml-0.5 shrink-0 opacity-80 pointer-events-none size-menu-caret"
    >
      <path d="M0 0L4 4L8 0H0Z" />
    </svg>
  ) : null;

  const shared = {
    ref,
    "data-slot": "button",
    className: cn(buttonVariants({ variant, size, className })),
    ...props,
  };

  // Slot wants exactly one child, and "exactly one" counts the slots in the
  // JSX rather than the elements that survive them: three expressions make an
  // array of three even when two of them evaluate to `null`. Rendering the
  // icon and the caret as siblings of `children` therefore blew up every
  // `asChild` call with "React.Children.only expected to receive a single
  // React element child" — which is why the only working way to put a button
  // on an `<a>` used to be not to use this component.
  //
  // So under `asChild` the furniture goes *inside* the caller's element
  // instead of beside it. The link keeps its leading icon and its caret, and
  // Slot still sees one child.
  if (asChild) {
    const child = React.Children.only(children) as React.ReactElement<{
      children?: React.ReactNode;
    }>;
    return (
      <Slot {...shared}>
        {React.cloneElement(child, undefined, iconSlot, child.props.children, caret)}
      </Slot>
    );
  }

  return (
    <button {...shared}>
      {iconSlot}
      {children}
      {caret}
    </button>
  );
});

export { Button, buttonVariants };
