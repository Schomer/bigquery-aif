import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
} from "../ui/breadcrumb";
import { cn } from "../ui/utils";

/**
 * The global breadcrumb: the strip between the blue bar and everything below
 * it, spanning the full width of the window.
 *
 *     <ConsoleShell breadcrumb={[{ label: "Demo2", href: "/" }, …]}>
 *
 * It is optional, and genuinely so — pass nothing and the shell is laid out
 * exactly as it was, with no empty band and no shifted content. The console
 * shows it on pages that sit inside a hierarchy and omits it on the ones that
 * do not, which is the same rule to follow here.
 *
 * ### Global, not in-page
 *
 * This is chrome. It lives above the rail and the content well, on the backdrop,
 * and it says where the *page* is in the console — "Demo2 / Home / Other Demos".
 * A `Breadcrumb` dropped inside your screen says where a *record* is inside your
 * product — a table inside a dataset inside a project — and that one belongs
 * above your `ActionBar`, not up here. A page with both is fine; a page that
 * uses this one for record-level navigation is a page whose chrome moves when
 * the user clicks a row.
 *
 * ### Slashes, and no icons
 *
 * `separator="slash"` because this trail really is a path, and because a row of
 * chevrons directly under the blue bar reads as a second toolbar. Icons are
 * deliberately not offered: a 20px glyph would not fit the 32px band without
 * growing it, and the rail immediately below is already the place where a
 * product wears its mark.
 *
 * ### It sits on the backdrop
 *
 * No background of its own. The shell root is `bg-cm-backdrop` and this strip
 * shows it through, so the band cannot drift out of step with the bar above it
 * the way a second copy of the token would.
 */

export interface ConsoleBreadcrumbItem {
  label: string;
  /** Omit on the last item — it is where you already are. */
  href?: string;
  onClick?: () => void;
}

export interface ConsoleBreadcrumbProps {
  items: ConsoleBreadcrumbItem[];
  className?: string;
}

export function ConsoleBreadcrumb({ items, className }: ConsoleBreadcrumbProps) {
  if (items.length === 0) return null;

  return (
    <Breadcrumb
      separator="slash"
      data-slot="console-breadcrumb"
      // 32px: a 20px line box with 6px either side. This is chrome, and chrome
      // is charged against the page — every row here is a row the screen below
      // does not get, so it is sized to the text and nothing more.
      //
      // `shrink-0` because the shell is `h-screen overflow-hidden`: a band that
      // could be squeezed would give its pixels to the content well and clip
      // its own text before anything else on the page noticed.
      className={cn("flex h-8 shrink-0 items-center px-6", className)}
    >
      <BreadcrumbList>
        {items.map((item, index) => {
          // The last one is the page, whatever it was given. An `href` on the
          // level you are already on is a link back to the current URL, which
          // is a control that does nothing.
          const isCurrent = index === items.length - 1;

          return (
            <BreadcrumbItem key={`${item.label}-${index}`}>
              {isCurrent ? (
                <BreadcrumbPage>{item.label}</BreadcrumbPage>
              ) : (
                <BreadcrumbLink
                  // A prototype routing in state has no URL to give, and an
                  // `<a>` with no `href` is not in the tab order — so an
                  // `onClick`-only crumb gets a placeholder one and swallows
                  // the navigation. Real `href`s are left exactly as passed,
                  // middle-click and all.
                  href={item.href ?? (item.onClick ? "#" : undefined)}
                  onClick={(event) => {
                    if (!item.href) event.preventDefault();
                    item.onClick?.();
                  }}
                >
                  {item.label}
                </BreadcrumbLink>
              )}
            </BreadcrumbItem>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
