import type { IconProps } from "./material-symbols";
import { cn } from "./utils";

/**
 * The marks Material Symbols does not have.
 *
 * `material-symbols.tsx` is the catalogue at fonts.google.com/icons, and the
 * rule there is strict: if you cannot find the name on that site, it does not
 * belong in that file. This is the other file — the console's own resource and
 * product marks, which are drawn on their own grids and are not in the
 * catalogue at all.
 *
 *     import { Icons } from "@/kit";
 *     <Icons.VmInstance aria-hidden className="size-[18px]" />
 *
 * Keep it small. Everything here is a thing the catalogue genuinely lacks, and
 * a mark that has a Material Symbols equivalent should use the equivalent —
 * two icon sets in one screen is exactly the drift the kit exists to stop.
 *
 * These behave like the symbols: `currentColor` fill, so a `text-cm-*` class
 * colours them, and a 18x18 default so a caller who forgets a `size-*` gets an
 * icon rather than an SVG's 300x150 fallback. `ConsoleHome` is the one
 * exception, and says why in its own note.
 */

/**
 * The console's home mark — the product logo at the head of the rail.
 *
 * The only icon in the kit that does not take `currentColor`. It is a logo, not
 * a glyph: three grey tones shade the roof, the wall and the edge, and a mark
 * that repainted itself every time it sat on a differently-coloured surface
 * would stop being a logo. The tones come from `--cm-sys-color-logo-grey-*`,
 * which live in theme.css beside the palette but deliberately outside it — they
 * are this drawing's colours and nothing else's, so a `text-cm-*` on the parent
 * has no effect here and there is no `fill-cm-logo-grey-*` anywhere but below.
 *
 * A 24-unit grid; the rail renders it at 24.
 */
export function ConsoleHome(props: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      fillRule="evenodd"
      {...props}
    >
      <path
        className="fill-cm-logo-grey-medium-tone"
        d="M13.19 5.703h-2.38L5 11.428V21h5v-6.998h4V21h5v-9.5z"
      />
      <path className="fill-cm-logo-grey-soft-tone" d="m12 4.703-1.19 1L5 11.457V21h5v-7h2z" />
      <path
        className="fill-cm-logo-grey-deep-tone"
        d="m12.793 6.123-7.136 8.4v-2.52l6.74-6.72z"
      />
      <path
        className="fill-cm-logo-grey-soft-tone"
        d="m12 3.15-9 9.472 1.352 1.433L12 6.007l7.648 8.048L21 12.622z"
      />
    </svg>
  );
}
ConsoleHome.displayName = "ConsoleHome";

/**
 * The Cloud Console's VM instance mark — the icon on a Compute Engine row and
 * on the product rail. An 18-unit grid, not the symbols' 960, which is why it
 * cannot go in `material-symbols.tsx` even though it sits beside those glyphs.
 */
export function VmInstance(props: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 18 18"
      width="18"
      height="18"
      fill="currentColor"
      {...props}
    >
      <path
        fillRule="evenodd"
        d="M13.998 16A1.01 1.01 0 0015 14.993V4.007C15 3 13.998 2 12.998 2H5.002C4.002 2 3 3 3 4.007v10.986C3 15.55 3.45 16 4.002 16H5.5l.5-1h6l.5 1zM6 9.5a.5.5 0 01.49-.5h5.02a.5.5 0 010 1H6.49A.5.5 0 016 9.5m0 2a.5.5 0 01.49-.5h5.02a.5.5 0 010 1H6.49a.5.5 0 01-.49-.5M8 6c0-.552.444-1 1-1 .552 0 1 .444 1 1 0 .552-.444 1-1 1-.552 0-1-.444-1-1"
      />
    </svg>
  );
}
VmInstance.displayName = "VmInstance";

/**
 * The console's web mark — a browser window with a sidebar, for a rail item
 * that opens a list of things rather than one resource. Same 18-unit grid as
 * `VmInstance`, so the two sit at the same weight in a rail.
 */
export function Web(props: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 18 18"
      width="18"
      height="18"
      fill="currentColor"
      {...props}
    >
      <path
        fillRule="evenodd"
        d="M14.6 4H3.4c-.77 0-1.393.62-1.393 1.375L2 13.625C2 14.38 2.63 15 3.4 15h11.2c.77 0 1.4-.62 1.4-1.375v-8.25C16 4.62 15.37 4 14.6 4M8 13H4V7h4zM4 5h1v1H4zm2 0h1v1H6zm3 6h5v2H9zm0-4h5v3H9z"
      />
    </svg>
  );
}
Web.displayName = "Web";

/**
 * The console's "interests" mark — three shapes on one grid, used on the rail
 * for a page that is a collection of things rather than one resource.
 *
 * Drawn on a 20-unit grid and rendered at 18, which is the size the rail asks
 * for. That mismatch is the icon's own, not a mistake to correct here: scaling
 * the viewBox rather than the artwork is what keeps its strokes on the same
 * weight as `VmInstance` beside it.
 */
export function Interests(props: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      width="18"
      height="18"
      fill="currentColor"
      {...props}
    >
      <path d="M6 11c-1.65 0-3 1.35-3 3s1.35 3 3 3 3-1.35 3-3-1.35-3-3-3m0 4.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5m5 1.5h6v-6h-6zm1.5-4.5h3v3h-3zm-5.1-5H4.6L6 5.03zM2.01 9H10L6 2zm13.71-6.5c-.81 0-1.39.43-1.72.89-.33-.47-.91-.89-1.72-.89-1.19 0-2.1.98-2.1 2.1 0 1.53 1.85 2.61 3.82 4.4 1.98-1.78 3.82-2.87 3.82-4.4 0-1.12-.9-2.1-2.1-2.1M14 7c-1.12-.95-2.32-1.87-2.32-2.42 0-.33.27-.58.58-.58.24 0 .4.13.57.29L14 5.4l1.18-1.11c.16-.15.32-.29.56-.29.31 0 .58.25.58.58.01.55-1.2 1.47-2.32 2.42" />
    </svg>
  );
}
Interests.displayName = "Interests";

/**
 * The console's filled error mark, for the line under a field that failed
 * validation. `SelectField` and `MultiSelect` draw it themselves — you should
 * not need to place one by hand.
 *
 * It fills with `currentColor` rather than the `status-error` token the console
 * hard-codes into the mark, so it takes its red from the `text-cm-status-error`
 * on the message it sits in. One colour decision, in the place that already
 * owns it, and no second copy of the token to drift.
 */
export function StatusError(props: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 18 18"
      width="18"
      height="18"
      fill="currentColor"
      {...props}
    >
      <path d="M9 2a7 7 0 100 14A7 7 0 009 2m-1 8V5h2v5zm0 3v-2h2v2z" />
    </svg>
  );
}
StatusError.displayName = "StatusError";

/**
 * Renders an icon using a monochrome mask so it automatically inherits
 * `currentColor` (e.g. text-cm-on-backdrop or text-cm-on-surface-variant).
 */
export function MaskIcon({
  src,
  className,
  ...props
}: {
  src: string;
  className?: string;
} & React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      role="img"
      aria-hidden="true"
      className={cn("inline-block size-[18px] shrink-0 bg-current", className)}
      style={{
        maskImage: `url("${src}")`,
        maskSize: "contain",
        maskRepeat: "no-repeat",
        maskPosition: "center",
        WebkitMaskImage: `url("${src}")`,
        WebkitMaskSize: "contain",
        WebkitMaskRepeat: "no-repeat",
        WebkitMaskPosition: "center",
      }}
      {...props}
    />
  );
}

/** Automation flow mark */
export function Automation(props: { className?: string } & React.HTMLAttributes<HTMLSpanElement>) {
  return <MaskIcon src="/icons/icon-automation.png" {...props} />;
}
Automation.displayName = "Automation";

/** AI inbox / tasks mark */
export function AiInbox(props: { className?: string } & React.HTMLAttributes<HTMLSpanElement>) {
  return <MaskIcon src="/icons/icon-ai-inbox.png" {...props} />;
}
AiInbox.displayName = "AiInbox";

/** Catalog open book mark */
export function Catalog(props: { className?: string } & React.HTMLAttributes<HTMLSpanElement>) {
  return <MaskIcon src="/icons/icon-catalog.png" {...props} />;
}
Catalog.displayName = "Catalog";

/** Folder open mark */
export function FolderOpen(props: { className?: string } & React.HTMLAttributes<HTMLSpanElement>) {
  return <MaskIcon src="/icons/icon-folder-open.png" {...props} />;
}
FolderOpen.displayName = "FolderOpen";

export type { IconProps };
