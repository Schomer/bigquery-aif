import * as React from "react";

import { cn } from "../ui/utils";
import { ConsoleBreadcrumb, type ConsoleBreadcrumbItem } from "./console-breadcrumb";
import { ConsoleSideNav, type ConsoleSideNavItem } from "./console-side-nav";
import { ConsoleTopNav, type ConsoleTopNavProps } from "./console-top-nav";

/**
 * The whole console frame: blue bar across the top, product rail down the
 * left, and your prototype in the hole they leave.
 *
 * This is the component to reach for first. Put your screen inside it and you
 * inherit the console's chrome and its 12px content gutter without writing any
 * of it. The rail opens and closes itself, from the button in its own header —
 * the top bar's hamburger is left unwired, because in the console it opens the
 * product picker rather than the rail. Pass `onToggleNav` if you want it.
 *
 *     <ConsoleShell productName="My Product" nav={NAV_ITEMS}>
 *       <MyPrototype />
 *     </ConsoleShell>
 *
 * The content well is a white `surface` panel with a 16px radius, inset 12px
 * from the backdrop on the left and right — that inset is what makes the
 * backdrop read as a frame rather than a page background. The top inset is 4px,
 * not 12: the bar is already backdrop-coloured, so a full gutter there reads as
 * a gap rather than a frame.
 *
 * There is no bottom inset at all, and the bottom two corners are square. The
 * console runs its well off the bottom edge of the window, and it is right to:
 * a gutter along the bottom is the one edge a frame does not need, because
 * there is nothing below it to be framed against. Left unclosed it reads as the
 * page continuing past the fold, which is usually true — the well is the
 * scroller. Closed off with a rounded corner and a strip of backdrop, the page
 * looks like it has ended even when it has not, and a table that fills the
 * viewport appears to be sitting on a shelf.
 *
 * Pass `bare` if your screen wants to draw its own container (a full-bleed map,
 * a split pane) and you get the raw box.
 *
 * ### The global breadcrumb is optional
 *
 *     <ConsoleShell breadcrumb={[{ label: "Demo2", href: "/" }, …]}>
 *
 * Pass `breadcrumb` and a 32px trail appears across the full width, under the
 * bar and above the rail. Leave it off and nothing renders — no empty band, no
 * shifted content — because plenty of console pages are the top of their own
 * hierarchy and have nothing to say there. It is deliberately a prop on the
 * shell rather than something a screen draws for itself: it spans the rail as
 * well as the well, so it cannot be drawn from inside the well.
 *
 * It is chrome, and it says where the *page* sits. A trail that says where a
 * *record* sits — dataset, table, partition — is `Breadcrumb` inside your
 * screen, above the `ActionBar`. Both on one page is fine.
 *
 * Everything scrolls inside the well, never the page: the shell is
 * `h-screen overflow-hidden` on purpose, so the top bar and rail stay put.
 *
 * The `relative` on the two boxes below is load-bearing, not decoration. An
 * `overflow: hidden` box only clips an absolutely positioned descendant if it
 * is in that descendant's containing-block chain, so while those boxes were
 * static, one `position: absolute` anywhere in a screen — a floating label, a
 * `sr-only` span — resolved all the way up to the shell root and gave it a
 * scroll height of its own. A root with `overflow: hidden` still scrolls
 * programmatically, so the next `scrollIntoView` or `focus()` on something
 * below the fold slid the blue bar and the rail off the top of the window.
 * Positioning the clipping boxes ends the chain where the clip is.
 */

export interface ConsoleShellProps extends Omit<ConsoleTopNavProps, "className"> {
  children: React.ReactNode;
  /**
   * The product's name, shown at the top of the rail. Distinct from
   * `projectName`, which is the Cloud project in the top bar's pill — the
   * console shows both, and they are rarely the same word.
   */
  productName?: string;
  /** Rail items. Omit for a shell with no product rail. */
  nav?: ConsoleSideNavItem[];
  /**
   * The global trail, last item being this page. Omit for no breadcrumb strip
   * at all — see the note above.
   */
  breadcrumb?: ConsoleBreadcrumbItem[];
  navIcon?: React.ReactNode;
  activeNavId?: string;
  defaultActiveNavId?: string;
  onNavSelect?: (id: string) => void;
  /** Start with the rail open. It is closed in the console by default. */
  defaultNavExpanded?: boolean;
  onProductClick?: (e: React.MouseEvent) => void;
  /** Skip the white content well and hand `children` the bare box. */
  bare?: boolean;
  className?: string;
  sideNavClassName?: string;
  contentClassName?: string;
}

export function ConsoleShell({
  children,
  nav,
  breadcrumb,
  navIcon,
  activeNavId,
  defaultActiveNavId,
  onNavSelect,
  defaultNavExpanded = false,
  onProductClick,
  bare = false,
  className,
  sideNavClassName,
  contentClassName,
  productName,
  ...topNavProps
}: ConsoleShellProps) {
  const [navExpanded, setNavExpanded] = React.useState(defaultNavExpanded);

  return (
    <div className={cn("bg-cm-backdrop relative flex h-screen w-full flex-col overflow-hidden", className)}>
      <ConsoleTopNav {...topNavProps} />
      {breadcrumb && breadcrumb.length > 0 && <ConsoleBreadcrumb items={breadcrumb} />}
      <div className="relative flex flex-1 overflow-hidden">
        {nav && nav.length > 0 && (
          <ConsoleSideNav
            items={nav}
            productName={productName}
            productIcon={navIcon}
            isExpanded={navExpanded}
            onExpandedChange={setNavExpanded}
            onProductClick={onProductClick}
            activeId={activeNavId}
            defaultActiveId={defaultActiveNavId}
            onSelect={onNavSelect}
            className={sideNavClassName}
          />
        )}
        <main className="flex flex-1 flex-col overflow-hidden">
          <div
            className={cn(
              "relative mt-1 mb-0 flex flex-1 flex-col overflow-hidden",
              nav && nav.length > 0 ? "ml-1 mr-3" : "mx-3",
              !bare && "bg-cm-surface rounded-t-2xl",
              contentClassName,
            )}
          >
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
