import type { IconProps } from "./material-symbols";

/**
 * The Cloud Console's own icon set — all 414 marks from
 * `//depot/google3/cloud/console/web/common/icons/common/24px/`.
 *
 *     import { ConsoleIcons } from "@/kit";
 *     <ConsoleIcons.AndroidSatellite aria-hidden className="size-[18px]" />
 *
 * ### Generated. Do not hand-edit.
 *
 * `node scripts/gen-console-icons.mjs` rewrites this file from Piper. An edit
 * here is an edit that disappears the next time the console ships an icon —
 * fix the generator, or fix the source.
 *
 * ### Which set to reach for
 *
 * Three icon namespaces now, and the order to try them in is:
 *
 *   1. `MaterialSymbols` — the catalogue at fonts.google.com/icons. Anything
 *      generic: search, close, delete, an arrow.
 *   2. `ConsoleIcons` — this file. The console's product and resource marks,
 *      the things the catalogue has never heard of.
 *   3. `Icons` — the few hand-drawn one-offs, `ConsoleHome` among them.
 *
 * The overlap is real and deliberate: this set carries its own `Add`,
 * `Search`, `Refresh` and about thirty more that `MaterialSymbols` also has,
 * because it is the console's directory rather than a subset someone would
 * have to diff against it. **Prefer `MaterialSymbols` for those.** Two
 * drawings of a magnifying glass on one screen is the drift the kit exists to
 * stop, and the duplicates here are the easiest way in the whole kit to cause
 * it by accident.
 *
 * ### Colour
 *
 * Monotone icons are `currentColor`, so a `text-cm-*` in scope paints them
 * like any other glyph. The 25 below are drawings rather than glyphs — a
 * status disc with a mark knocked out of it, a logo, a gradient — so one colour
 * cannot express them and `text-cm-*` does nothing to them, by design:
 *
 * Disabled, DisabledYellow, FileError, FileValid, FileWarning, FolderError, FolderValid, FolderWarning, Github, Pending, SecuritySectionColored, SparkGradient, StatusCritical, StatusDestroyed, StatusError, StatusHigh, StatusLow, StatusMedium, StatusPaused, StatusRunning, StatusRunningWithErrors, StatusSuccess, StatusSuccessDisabled, StatusWarning, TipsAndUpdatesFilled
 *
 * They do not carry hexes. Every colour in them was resolved to a CM3 token by
 * `scripts/gen-console-icons.mjs` and is emitted as `var(--cm-sys-color-…)`,
 * so they follow the theme like everything else — which matters most in dark
 * mode, where the status colours invert to pale tints and a hardcoded white
 * knockout would have stopped being legible. The 15 substitutions, source
 * colour to token:
 *
 *   #80868b   → on-surface-variant-low   ΔE  5.7  (nearest)
 *   #3367d6   → primary                  ΔE  3.1  (nearest blue)
 *   #85a4e6   → primary-inverse          ΔE  3.8  (nearest blue)
 *   #a190ff   → primary-inverse          ΔE  8.4  (nearest blue)
 *   #bd99fe   → primary-inverse          ΔE 13.1  (nearest blue)
 *   #078efb   → status-activeassist      ΔE  4.2  (nearest blue)
 *   #217bfe   → status-activeassist      ΔE  4.5  (nearest blue)
 *   #5c85de   → status-activeassist      ΔE  6.5  (nearest blue)
 *   #a50e0e   → status-error             ΔE 25.5  (red family)
 *   #d50000   → status-error             ΔE 27.6  (red family)
 *   #188038   → status-success           ΔE 10.0  (green family)
 *   #dc6d00   → status-warning           ΔE 14.8  (amber family)
 *   #ea8600   → status-warning           ΔE 22.8  (amber family)
 *   #f3b300   → status-warning           ΔE 37.4  (amber family)
 *   #fbbc04   → status-warning           ΔE 39.6  (amber family)
 *
 * `red`/`amber`/`green` are hue rules; the palette has no red and no yellow,
 * so pure distance would put an error mark and a warning mark on the same
 * orange. Everything else is nearest-CIEDE2000. Regenerate rather than edit.
 *
 * ### Grids
 *
 * Nothing is rescaled. 328 icons are on the 24 grid, 83 came from
 * Material Symbols and are on the 960 grid, and 3 are odder still
 * (0 0 20 20, 0 0 180 180, 0 0 18 18). Rewriting path data to a common grid is how a
 * crisp icon becomes a blurry one, so each keeps its own `viewBox` and they
 * all render at whatever `size-*` you give them.
 *
 * The 24px default is only a backstop: an `<svg>` with no intrinsic size falls
 * back to 300x150, so a caller who forgets a size class gets an icon rather
 * than a billboard.
 */

/** The Material Symbols grid, for the 83 icons in here that came from there. */
const MS = "0 -960 960 960";

/**
 * The shape 282 of these 414 take: monotone, one path, nothing on it but
 * the outline. Written longhand that would be nine lines each and nobody would
 * read any of them — so the common case is a factory, and only the 132 that
 * are genuinely different are written out below.
 */
function icon(
  displayName: string,
  d: string,
  opts: { viewBox?: string; evenodd?: boolean } = {},
) {
  // `clipRule` alongside `fillRule` is free: it only means anything inside a
  // `<clipPath>`, and it saves distinguishing two source spellings of the same
  // intent.
  const rule = opts.evenodd ? ("evenodd" as const) : undefined;
  const Icon = (props: IconProps) => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={opts.viewBox ?? "0 0 24 24"}
      width="24"
      height="24"
      fill="currentColor"
      {...props}
    >
      <path d={d} fillRule={rule} clipRule={rule} />
    </svg>
  );
  Icon.displayName = displayName;
  return Icon;
}

/** `abc` */
export const Abc = icon("Abc", "M21 11h-1.5v-.5h-2v3h2V13H21v1c0 .55-.45 1-1 1h-3c-.55 0-1-.45-1-1v-4c0-.55.45-1 1-1h3c.55 0 1 .45 1 1v1zM8 10v5H6.5v-1.5h-2V15H3v-5c0-.55.45-1 1-1h3c.55 0 1 .45 1 1zm-1.5.5h-2V12h2v-1.5zm7 1.5c.55 0 1 .45 1 1v1c0 .55-.45 1-1 1h-4V9h4c.55 0 1 .45 1 1v1c0 .55-.45 1-1 1zM11 10.5v.75h2v-.75h-2zm2 2.25h-2v.75h2v-.75z");

/** `action_cached` */
export const ActionCached = icon("ActionCached", "M7.29 10.54l-1.28 1.28a5.94 5.94 0 0 1 1.75-4.07 6.01 6.01 0 0 1 8.49 0l1.41-1.41c-3.12-3.12-8.19-3.12-11.31 0a7.99 7.99 0 0 0-2.34 5.5l-1.3-1.3-1.41 1.41L5 15.66l3.71-3.71-1.42-1.41zm15.42 1.17L19 8l-3.71 3.71 1.41 1.41 1.28-1.28c0 .05.01.11.01.16 0 1.6-.62 3.11-1.76 4.24a6.01 6.01 0 0 1-8.49 0l-1.41 1.41c3.12 3.12 8.19 3.12 11.31 0A7.895 7.895 0 0 0 20 12c0-.06-.01-.12-.01-.18l1.3 1.3 1.42-1.41z");

/** `add` */
export const Add = icon("Add", "M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6z", { evenodd: true });

/** `add_alert` */
export const AddAlert = icon("AddAlert", "M10.01 21.01c0 1.1.89 1.99 1.99 1.99s1.99-.89 1.99-1.99h-3.98zm8.87-4.19V11c0-3.25-2.25-5.97-5.29-6.69v-.72C13.59 2.71 12.88 2 12 2s-1.59.71-1.59 1.59v.72A6.873 6.873 0 0 0 5.12 11v5.82L3 18.94V20h18v-1.06l-2.12-2.12zM16 13.01h-3v3h-2v-3H8V11h3V8h2v3h3v2.01z");

/** `add_circle_outline` */
export const AddCircleOutline = icon("AddCircleOutline", "M13 7h-2v4H7v2h4v4h2v-4h4v-2h-4V7zm-1-5C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z");

/** `add_comment` */
export const AddComment = icon("AddComment", "M440-400h80v-120h120v-80H520v-120h-80v120H320v80h120v120zM80-80v-720q0-33 23.5-56.5T160-880h640q33 0 56.5 23.5T880-800v480q0 33-23.5 56.5T800-240H240L80-80zm126-240h594v-480H160v525l46-45zm-46 0v-480 480z", { viewBox: MS });

/** `add_task` */
export const AddTask = icon("AddTask", "M22 5.18L10.59 16.6l-4.24-4.24 1.41-1.41 2.83 2.83 10-10L22 5.18zM12 20c-4.41 0-8-3.59-8-8s3.59-8 8-8c1.57 0 3.04.46 4.28 1.25l1.45-1.45A10.02 10.02 0 0012 2C6.48 2 2 6.48 2 12s4.48 10 10 10c1.73 0 3.36-.44 4.78-1.22l-1.5-1.5c-1 .46-2.11.72-3.28.72zm7-5h-3v2h3v3h2v-3h3v-2h-3v-3h-2v3z");

/** `admin_panel_settings` */
export function AdminPanelSettings(props: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="currentColor"
      {...props}
    >
      <path d="M18 11.09V6.27L10.5 3 3 6.27v4.91c0 4.54 3.2 8.79 7.5 9.82.55-.13 1.08-.32 1.6-.55A5.973 5.973 0 0017 23c3.31 0 6-2.69 6-6 0-2.97-2.16-5.43-5-5.91zM11 17c0 .56.08 1.11.23 1.62-.24.11-.48.22-.73.3-3.17-1-5.5-4.24-5.5-7.74v-3.6l5.5-2.4 5.5 2.4v3.51c-2.84.48-5 2.94-5 5.91zm6 4c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4z" /><circle cx="17" cy="15.5" r="1.12" /><path d="M17 17.5c-.73 0-2.19.36-2.24 1.08.5.71 1.32 1.17 2.24 1.17s1.74-.46 2.24-1.17c-.05-.72-1.51-1.08-2.24-1.08z" />
    </svg>
  );
}
AdminPanelSettings.displayName = "AdminPanelSettings";

/** `agent_mode` */
export const AgentMode = icon("AgentMode", "m147-290-57-57 132-131 57 56-132 132Zm29 170-56-56 250-250 57 56-251 250Zm384-80q-10-69-40.5-130T440-440q-49-49-110-79.5T200-560v-80l464-190q36-14 73.5-6.5T802-802q28 27 35 64.5t-7 73.5L640-200h-80ZM347-90l-57-57 132-131 57 56L347-90Zm259-237 150-367q5-14 3-27.5T746-746q-11-11-24.5-13.5T694-757L327-606q48 20 90.5 47t78.5 63q36 36 63 78.5t47 90.5ZM496-496Z", { viewBox: MS });

/** `all_products` */
export function AllProducts(props: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="currentColor"
      {...props}
    >
      <path clipRule="evenodd" d="M10 4H4v6h6V4zm10 0h-6v6h6V4zm-6 10h6v6h-6v-6zm-4 0H4v6h6v-6z" fillRule="evenodd" />
    </svg>
  );
}
AllProducts.displayName = "AllProducts";

/** `analytics` */
export const Analytics = icon("Analytics", "M280-280h80v-200h-80v200Zm320 0h80v-400h-80v400Zm-160 0h80v-120h-80v120Zm0-200h80v-80h-80v80ZM200-120q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h560q33 0 56.5 23.5T840-760v560q0 33-23.5 56.5T760-120H200Zm0-80h560v-560H200v560Zm0-560v560-560Z", { viewBox: MS });

/** `android_satellite` */
export const AndroidSatellite = icon("AndroidSatellite", "m487-360-95-95-46 46 30 29q23 23 23 57t-23 57l-43 43q-23 23-56.5 23T220-223L103-340q-23-23-23-56.5t23-56.5l43-43q23-23 57-23t57 23l29 30 46-46-175-175 113-113 175 175 45-45-29-30q-23-23-23-57t23-57l43-43q23-23 56.5-23t56.5 23l117 117q23 23 23 56.5T737-627l-43 43q-23 23-57 23t-57-23l-30-29-45 45 95 95-113 113Zm33 280v-80q117 0 198.5-81.5T800-440h80q0 75-28.5 140.5t-77 114q-48.5 48.5-114 77T520-80Zm0-160v-80q50 0 85-35t35-85h80q0 83-58.5 141.5T520-240Zm0-517 30 30 43-43-30-30-43 43ZM160-397l30 30 43-43-30-30-43 43Zm477-243 43-43-30-30-43 43 30 30ZM277-280l43-43-30-30-43 43 30 30Z", { viewBox: MS });

/** `annotation` */
export function Annotation(props: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="currentColor"
      {...props}
    >
      <path fillRule="evenodd" clipRule="evenodd" d="M12 20.363l-2.196-2.155h-5.53a1.115 1.115 0 01-1.119-1.111V4.073c0-.614.501-1.112 1.12-1.112h15.45c.619 0 1.12.498 1.12 1.112v13.024c0 .614-.501 1.111-1.12 1.111h-5.53l-2.196 2.155zm-2.886-.487L12 22.707l2.885-2.831h4.842a2.788 2.788 0 002.797-2.779V4.073a2.788 2.788 0 00-2.797-2.78H4.274a2.788 2.788 0 00-2.797 2.78v13.024a2.788 2.788 0 002.797 2.779h4.84zM5.521 8.363h12.96V6.229H5.521v2.134zm12.96 3.394H5.521V9.623h12.96v2.134zm-12.96 3.395h8.26v-2.133H5.52v2.133z" />
    </svg>
  );
}
Annotation.displayName = "Annotation";

/** `app_enabled_folder` */
export function AppEnabledFolder(props: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="currentColor"
      {...props}
    >
      <path d="M12.5 14.52c0-1.66 1.35-3.02 3.02-3.02H22V8c0-.55-.2-1.02-.59-1.41C21.02 6.2 20.55 6 20 6h-8l-2-2H4c-.55 0-1.02.2-1.41.59C2.2 4.98 2 5.45 2 6v12c0 .55.2 1.02.59 1.41S3.45 20 4 20h8.5v-5.48z" /><path d="M22.75 13h-7.5c-.69 0-1.25.56-1.25 1.25v7.5c0 .69.56 1.25 1.25 1.25h7.5c.69 0 1.25-.56 1.25-1.25v-7.5c0-.69-.56-1.25-1.25-1.25zm-5.89 8.57a1.43 1.43 0 110-2.86 1.43 1.43 0 010 2.86zm0-4.28a1.43 1.43 0 110-2.86 1.43 1.43 0 010 2.86zm4.28 4.28a1.43 1.43 0 110-2.86 1.43 1.43 0 010 2.86zm0-4.28a1.43 1.43 0 110-2.86 1.43 1.43 0 010 2.86z" />
    </svg>
  );
}
AppEnabledFolder.displayName = "AppEnabledFolder";

/** `archive` */
export const Archive = icon("Archive", "M20.54 5.23l-1.39-1.68C18.88 3.21 18.47 3 18 3H6c-.47 0-.88.21-1.16.55L3.46 5.23C3.17 5.57 3 6.02 3 6.5V19c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V6.5c0-.48-.17-.93-.46-1.27zM6.24 5h11.52l.83 1H5.42l.82-1zM5 19V8h14v11H5zm11-5.5l-4 4-4-4 1.41-1.41L11 13.67V10h2v3.67l1.59-1.59L16 13.5z");

/** `area_chart` */
export const AreaChart = icon("AreaChart", "M120-160v-520l160 120 200-280 200 160h160v520H120Zm200-120 160-220 280 218v-318H652L496-725 298-447l-98-73v144l120 96Z", { viewBox: MS });

/** `arrow_back` */
export const ArrowBack = icon("ArrowBack", "M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20z", { evenodd: true });

/** `arrow_circle_down` */
export const ArrowCircleDown = icon("ArrowCircleDown", "M12 4c4.41 0 8 3.59 8 8s-3.59 8-8 8-8-3.59-8-8 3.59-8 8-8m0-2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm2.59 8.59L13 12.17V8h-2v4.17l-1.59-1.59L8 12l4 4 4-4-1.41-1.41z");

/** `arrow_downward` */
export const ArrowDownward = icon("ArrowDownward", "M20 12l-1.41-1.41L13 16.17V4h-2v12.17l-5.58-5.59L4 12l8 8z", { evenodd: true });

/** `arrow_drop_down` */
export const ArrowDropDown = icon("ArrowDropDown", "M18 9H6l6 6 6-6z", { evenodd: true });

/** `arrow_forward` */
export const ArrowForward = icon("ArrowForward", "M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z", { evenodd: true });

/** `arrow_right` */
export const ArrowRight = icon("ArrowRight", "m 10 7 v 10 l 5 -5 z");

/** `arrow_upward` */
export const ArrowUpward = icon("ArrowUpward", "M4 12l1.41 1.41L11 7.83V20h2V7.83l5.58 5.59L20 12l-8-8z", { evenodd: true });

/** `article` */
export const Article = icon("Article", "M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z");

/** `article_outline` */
export const ArticleOutline = icon("ArticleOutline", "M7 17h7v-2H7v2zm0-4h10v-2H7v2zm0-4h10V7H7v2zM5 21c-.55 0-1.02-.196-1.413-.587A1.926 1.926 0 013 19V5c0-.55.196-1.02.587-1.413A1.926 1.926 0 015 3h14c.55 0 1.02.196 1.413.587.39.393.587.863.587 1.413v14c0 .55-.196 1.02-.587 1.413A1.926 1.926 0 0119 21H5zm0-2h14V5H5v14z");

/** `article_person` */
export const ArticlePerson = icon("ArticlePerson", "M200-200v-560 179-19 400zm80-240h221q2-22 10-42t20-38H280v80zm0 160h157q17-20 39-32.5t46-20.5q-4-6-7-13t-5-14H280v80zm0-320h400v-80H280v80zm-80 480q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h560q33 0 56.5 23.5T840-760v258q-14-26-34-46t-46-33v-179H200v560h202q-1 6-1.5 12t-.5 12v56H200zm480-200q-42 0-71-29t-29-71q0-42 29-71t71-29q42 0 71 29t29 71q0 42-29 71t-71 29zM480-120v-56q0-24 12.5-44.5T528-250q36-15 74.5-22.5T680-280q39 0 77.5 7.5T832-250q23 9 35.5 29.5T880-176v56H480z", { viewBox: MS });

/** `article_person_fill` */
export const ArticlePersonFill = icon("ArticlePersonFill", "M280-600h400v-80H280v80zm-80 480q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h560q33 0 56.5 23.5T840-760v258q-23-45-66-71.5T680-600q-45 0-84 21t-65 59H280v80h221q-2 20 0 40t9 40H280v80h157q-19 22-28 48.5t-9 55.5v56H200zm280 0v-56q0-24 12.5-44.5T528-250q36-15 74.5-22.5T680-280q39 0 77.5 7.5T832-250q23 9 35.5 29.5T880-176v56H480zm200-200q-42 0-71-29t-29-71q0-42 29-71t71-29q42 0 71 29t29 71q0 42-29 71t-71 29z", { viewBox: MS });

/** `article_shortcut` */
export const ArticleShortcut = icon("ArticleShortcut", "M400-280h160v-80H400v80zm0-160h280v-80H400v80zM280-600h400v-80H280v80zm200 120zM265-80q-79 0-134.5-55.5T75-270q0-57 29.5-102t77.5-68H80v-80h240v240h-80v-97q-37 8-61 38t-24 69q0 46 32.5 78t77.5 32v80zm135-40v-80h360v-560H200v160h-80v-160q0-33 23.5-56.5T200-840h560q33 0 56.5 23.5T840-760v560q0 33-23.5 56.5T760-120H400z", { viewBox: MS });

/** `article_spark` */
export const ArticleSpark = icon("ArticleSpark", "M280-440h400v-80H280v80Zm0-160h280v-80H280v80Zm-80 400v-560 560Zm80-80h280v-80H280v80Zm-80 160q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h281v80H200v560h560v-281h80v281q0 33-23.5 56.5T760-120H200Zm540-440q-1 0-8-6-16-61-60.5-105.5T566-732q-2-1-6-8 0-2 6-8 61-16 105.5-60.5T732-914q1-2 8-6 2 0 8 6 17 61 61 105.5T914-748q2 0 6 8 0 1-6 8-61 16-105.5 60.5T748-566q0 2-8 6Z", { viewBox: MS });

/** `aspect_ratio` */
export function AspectRatio(props: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="currentColor"
      {...props}
    >
      <path d="M0 0h24v24H0V0z" fill="none" /><path d="M19 12h-2v3h-3v2h5v-5zM7 9h3V7H5v5h2V9zm14-6H3c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16.01H3V4.99h18v14.02z" />
    </svg>
  );
}
AspectRatio.displayName = "AspectRatio";

/** `assignment_turned_in` */
export function AssignmentTurnedIn(props: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="currentColor"
      {...props}
    >
      <path d="M0 0h24v24H0V0z" fill="none" /><path d="M18 9l-1.41-1.42L10 14.17l-2.59-2.58L6 13l4 4zm1-6h-4.18C14.4 1.84 13.3 1 12 1c-1.3 0-2.4.84-2.82 2H5c-.14 0-.27.01-.4.04-.39.08-.74.28-1.01.55-.18.18-.33.4-.43.64-.1.23-.16.49-.16.77v14c0 .27.06.54.16.78s.25.45.43.64c.27.27.62.47 1.01.55.13.02.26.03.4.03h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7-.25c.41 0 .75.34.75.75s-.34.75-.75.75-.75-.34-.75-.75.34-.75.75-.75zM19 19H5V5h14v14z" />
    </svg>
  );
}
AssignmentTurnedIn.displayName = "AssignmentTurnedIn";

/** `assistant` */
export const Assistant = icon("Assistant", "M19 2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h4l3 3 3-3h4c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 16H5V4h14v14zm-7-2l1.57-3.43L17 11l-3.43-1.57L12 6l-1.57 3.43L7 11l3.43 1.57z");

/** `astrophotography_mode` */
export const AstrophotographyMode = icon("AstrophotographyMode", "M19 9L17.75 6.25L15 5L17.75 3.75L19 0.999999L20.25 3.75L23 5L20.25 6.25L19 9ZM19 23L17.75 20.25L15 19L17.75 17.75L19 15L20.25 17.75L23 19L20.25 20.25L19 23ZM10 20L7.5 14.5L2 12L7.5 9.5L10 4L12.5 9.5L18 12L12.5 14.5L10 20ZM10 15.15L11 13L13.15 12L11 11L10 8.85L9 11L6.85 12L9 13L10 15.15Z");

/** `attach_file` */
export function AttachFile(props: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="currentColor"
      {...props}
    >
      <path d="M0 0h24v24H0V0z" fill="none" /><path d="M15.5 6v10.5c0 2.21-1.79 4-4 4s-4-1.79-4-4V6c0-1.38 1.12-2.5 2.5-2.5s2.5 1.12 2.5 2.5v9.5c0 .55-.45 1-1 1s-1-.45-1-1V6H9v9.5c0 1.38 1.12 2.5 2.5 2.5s2.5-1.12 2.5-2.5V6c0-2.21-1.79-4-4-4S6 3.79 6 6v10.5c0 3.04 2.46 5.5 5.5 5.5s5.5-2.46 5.5-5.5V6h-1.5z" />
    </svg>
  );
}
AttachFile.displayName = "AttachFile";

/** `attach_money` */
export function AttachMoney(props: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="currentColor"
      {...props}
    >
      <g clipPath="url(#attach_money-clip0_1_90)"><path d="M11.025 21V18.85C10.1417 18.65 9.375 18.2667 8.725 17.7C8.09167 17.1333 7.625 16.3333 7.325 15.3L9.175 14.55C9.425 15.35 9.79167 15.9583 10.275 16.375C10.775 16.7917 11.425 17 12.225 17C12.9083 17 13.4833 16.85 13.95 16.55C14.4333 16.2333 14.675 15.75 14.675 15.1C14.675 14.5167 14.4917 14.0583 14.125 13.725C13.7583 13.375 12.9083 12.9833 11.575 12.55C10.1417 12.1 9.15833 11.5667 8.625 10.95C8.09167 10.3167 7.825 9.55 7.825 8.65C7.825 7.56667 8.175 6.725 8.875 6.125C9.575 5.525 10.2917 5.18333 11.025 5.1V3H13.025V5.1C13.8583 5.23333 14.5417 5.54167 15.075 6.025C15.625 6.49167 16.025 7.06667 16.275 7.75L14.425 8.55C14.225 8.01667 13.9417 7.61667 13.575 7.35C13.2083 7.08333 12.7083 6.95 12.075 6.95C11.3417 6.95 10.7833 7.11667 10.4 7.45C10.0167 7.76667 9.825 8.16667 9.825 8.65C9.825 9.2 10.075 9.63333 10.575 9.95C11.075 10.2667 11.9417 10.6 13.175 10.95C14.325 11.2833 15.1917 11.8167 15.775 12.55C16.375 13.2667 16.675 14.1 16.675 15.05C16.675 16.2333 16.325 17.1333 15.625 17.75C14.925 18.3667 14.0583 18.75 13.025 18.9V21H11.025Z" /></g><defs><clipPath id="attach_money-clip0_1_90"><rect width="24" height="24" fill="white" /></clipPath></defs>
    </svg>
  );
}
AttachMoney.displayName = "AttachMoney";

/** `auto_awesome` */
export const AutoAwesome = icon("AutoAwesome", "M19 9l1.25-2.75L23 5l-2.75-1.25L19 1l-1.25 2.75L15 5l2.75 1.25L19 9zm-7.5.5L9 4 6.5 9.5 1 12l5.5 2.5L9 20l2.5-5.5L17 12l-5.5-2.5zM19 15l-1.25 2.75L15 19l2.75 1.25L19 23l1.25-2.75L23 19l-2.75-1.25L19 15z");

/** `auto_delete` */
export function AutoDelete(props: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="currentColor"
      {...props}
    >
      <path d="M13 11.26V8h2v2.29c.63-.19 1.3-.29 2-.29.32 0 .63.03.93.07l.19.03c.3.05.59.11.88.2V6h1V4h-5V3H9v1H4v2h1v13c0 1.1.9 2 2 2h4.26A6.963 6.963 0 0110 17H9V8h2v5.41a7.08 7.08 0 012-2.15z" /><path d="M17 12c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zm1.29 7.71L16 17.41V14h1v3l2 2-.71.71z" />
    </svg>
  );
}
AutoDelete.displayName = "AutoDelete";

/** `auto_fix` */
export const AutoFix = icon("AutoFix", "M7.5 5.6L10 7 8.6 4.5 10 2 7.5 3.4 5 2l1.4 2.5L5 7zm12 9.8L17 14l1.4 2.5L17 19l2.5-1.4L22 19l-1.4-2.5L22 14zM22 2l-2.5 1.4L17 2l1.4 2.5L17 7l2.5-1.4L22 7l-1.4-2.5zm-7.63 5.29a.996.996 0 00-1.41 0L1.29 18.96a.996.996 0 000 1.41l2.34 2.34c.39.39 1.02.39 1.41 0L16.7 11.05a.996.996 0 000-1.41l-2.33-2.35zm-1.03 5.49l-2.12-2.12 2.44-2.44 2.12 2.12-2.44 2.44z");

/** `automation` */
export const Automation = icon("Automation", "M296-270q-42 35-87.5 32T129-269q-34-28-46.5-73.5T99-436l75-124q-25-22-39.5-53T120-680q0-66 47-113t113-47q66 0 113 47t47 113q0 66-47 113t-113 47q-9 0-18-1t-17-3l-77 130q-11 18-7 35.5t17 28.5q13 11 31 12.5t35-12.5l420-361q42-35 88-31.5t80 31.5q34 28 46 73.5T861-524l-75 124q25 22 39.5 53t14.5 67q0 66-47 113t-113 47q-66 0-113-47t-47-113q0-66 47-113t113-47q9 0 17.5 1t16.5 3l78-130q11-18 7-35.5T782-630q-13-11-31-12.5T716-630L296-270Zm40.5-353.5Q360-647 360-680t-23.5-56.5Q313-760 280-760t-56.5 23.5Q200-713 200-680t23.5 56.5Q247-600 280-600t56.5-23.5Zm400 400Q760-247 760-280t-23.5-56.5Q713-360 680-360t-56.5 23.5Q600-313 600-280t23.5 56.5Q647-200 680-200t56.5-23.5ZM280-680Zm400 400Z", { viewBox: MS });

/** `autorenew` */
export const Autorenew = icon("Autorenew", "M12 6h.17l-1.09 1.09L12.5 8.5 16 5l-3.5-3.5-1.41 1.41L12.17 4H12c-2.05 0-4.09.78-5.66 2.34-3.12 3.12-3.12 8.19 0 11.31l1.41-1.41a6.011 6.011 0 010-8.49A6 6 0 0112 6zm5.66 11.66c3.12-3.12 3.12-8.19 0-11.31l-1.41 1.41a6.011 6.011 0 010 8.49A6 6 0 0112 18h-.17l1.09-1.09-1.42-1.41L8 19l3.5 3.5 1.41-1.41L11.83 20H12c2.05 0 4.09-.78 5.66-2.34z");

/** `aws_logo` */
export const AwsLogo = icon("AwsLogo", "M56-370q82 70 190.5 112.5T480-215q91 0 177-24t153-69q23-16 27.5-22.5T840-342q-2-4-11.5-4T787-334q-59 23-139 39t-166 16q-114 0-220-30T68-387q-12-7-15-8t-5-1q-1 0-6 3l-2 5 16 18Zm724-98q35 0 69-19.5t34-59.5q0-23-11-40.5T834-616q-18-7-37-12.5T760-642q-8-4-13-11t-5-15q0-18 16.5-26.5T795-703q17 0 33 4t31 10l10-7v-18q0-2-5-11-14-11-32-14t-36-3q-45 0-73.5 19.5T694-668q0 26 13 44t37 26q17 6 35 11t35 13q9 4 14.5 12.5T834-543q0 19-17.5 27.5T777-507q-19 0-37.5-5T703-524q-5-2-8.5 0t-3.5 7v17q0 19 38.5 25.5T780-468Zm-230-7h32q4 0 14-13l71-231q2-6 1-11t-6-5h-31q-5 0-13 15l-44 169q-2 6-3 12.5t-3 11.5q-2-5-3-12t-3-12l-40-167q-2-7-6-12t-10-5h-29q-5 0-13 15l-40 169q-2 5-3 11.5t-3 12.5q-2-6-3-12.5t-3-11.5l-44-169-4-10q-2-5-7-5h-32q-5 0-7 5t0 10l70 232q2 5 4.5 8.5t7.5 3.5h34q2 0 12-12l43-179q1-2 1.5-5t1.5-5q1 2 1.5 5t1.5 5l42 179q2 5 5 9t8 4Zm-390 7q23 0 45.5-11.5T243-510q3 7 11 21.5t17 14.5q-1 0 7-2l18-12q2-2 6-9 0 1-2-7-7-12-10-25.5t-3-27.5v-91q0-52-27.5-73T184-742q-19 0-43.5 5T99-721q-1 1-5 9v23q0 2 8 5 20-6 37.5-11.5T177-701q27 0 44.5 9.5T239-651v30q-9-2-18-3t-19-3q-11-2-22.5-2t-23.5 1q-35 5-57.5 26T76-546q0 38 24 58t60 20Zm8-38q-17 0-28.5-10T128-546q0-27 15.5-37.5T185-594q14 0 26.5 1.5T238-588l2 2q0 37-16.5 59T168-506Zm686 254q3 0 11-6 11-10 22-27.5t19-37.5q5-14 10-30t4-29q-1-7-13-25-9-6-20.5-7.5T869-416q-30 0-55.5 5.5T766-392q-2 1-7 4.5t-5 7.5q0 2 5 4 4 1 19-1 13-2 28.5-3t39.5-1q15 0 23.5 7t8.5 19q0 16-9.5 43T853-269q-2 5-4 12 0 1 5 5Z", { viewBox: MS });

/** `azure_logo` */
export const AzureLogo = icon("AzureLogo", "M114-120q-9 0-14-7t-2-15l231-686q2-5 6.5-8.5t9.5-3.5h3q5 0 9.5 3.5t6.5 8.5l93 277-55 163h-89q-14 0-23 6.5T277-364q-4 11-2 22.5t12 20.5l71 66-42 123q-2 5-6.5 8.5T300-120H114Zm457 0q-1 0-11-4L321-346h206l68 204q3 8-2 15t-14 7h-8Zm65 0q2-9 2.5-18t-2.5-18L405-840h210q5 0 9.5 3.5t6.5 8.5l231 686q3 8-2 15t-14 7H636Z", { viewBox: MS });

/** `bar_chart` */
export const BarChart = icon("BarChart", "M4 9h4v11H4zm12 4h4v7h-4zm-6-9h4v16h-4z");

/** `barcode` */
export function Barcode(props: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="currentColor"
      {...props}
    >
      <g clipPath="url(#barcode-clip0_1_110)"><path d="M1 19V5H3V19H1ZM4 19V5H6V19H4ZM7 19V5H8V19H7ZM10 19V5H12V19H10ZM13 19V5H16V19H13ZM17 19V5H18V19H17ZM20 19V5H23V19H20Z" /></g><defs><clipPath id="barcode-clip0_1_110"><rect width="24" height="24" fill="white" /></clipPath></defs>
    </svg>
  );
}
Barcode.displayName = "Barcode";

/** `branch` */
export function Branch(props: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="currentColor"
      {...props}
    >
      <path fillRule="evenodd" d="M12 7L7.5 2L3 7H6V22H9V19.1169L17.7936 14.0611L17.7548 13.9449L18 13.94V11H21L16.5 6L12 11H15V12.2099L9 15.6741V7H12Z" />
    </svg>
  );
}
Branch.displayName = "Branch";

/** `bubble_chart` */
export const BubbleChart = icon("BubbleChart", "M7 10c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm8.01 5c-1.65 0-3 1.35-3 3s1.35 3 3 3 3-1.35 3-3-1.35-3-3-3zm0 4c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zM16.5 3C13.47 3 11 5.47 11 8.5s2.47 5.5 5.5 5.5S22 11.53 22 8.5 19.53 3 16.5 3zm0 9c-1.93 0-3.5-1.57-3.5-3.5S14.57 5 16.5 5 20 6.57 20 8.5 18.43 12 16.5 12z");

/** `bug_report` */
export const BugReport = icon("BugReport", "M12 19C13.1 19 14.0417 18.6083 14.825 17.825C15.6083 17.0417 16 16.1 16 15V11C16 9.9 15.6083 8.95833 14.825 8.175C14.0417 7.39167 13.1 7 12 7C10.9 7 9.95833 7.39167 9.175 8.175C8.39167 8.95833 8 9.9 8 11V15C8 16.1 8.39167 17.0417 9.175 17.825C9.95833 18.6083 10.9 19 12 19ZM10 16H14V14H10V16ZM10 12H14V10H10V12ZM12 21C10.9167 21 9.90833 20.7333 8.975 20.2C8.05833 19.6667 7.33333 18.9333 6.8 18H4V16H6.1C6.05 15.6667 6.01667 15.3333 6 15C6 14.6667 6 14.3333 6 14H4V12H6C6 11.6667 6 11.3333 6 11C6.01667 10.6667 6.05 10.3333 6.1 10H4V8H6.8C7.03333 7.61667 7.29167 7.25833 7.575 6.925C7.875 6.59167 8.21667 6.3 8.6 6.05L7 4.4L8.4 3L10.55 5.15C11.0167 5 11.4917 4.925 11.975 4.925C12.4583 4.925 12.9333 5 13.4 5.15L15.6 3L17 4.4L15.35 6.05C15.7333 6.3 16.075 6.59167 16.375 6.925C16.6917 7.24167 16.9667 7.6 17.2 8H20V10H17.9C17.95 10.3333 17.975 10.6667 17.975 11C17.9917 11.3333 18 11.6667 18 12H20V14H18C18 14.3333 17.9917 14.6667 17.975 15C17.975 15.3333 17.95 15.6667 17.9 16H20V18H17.2C16.6667 18.9333 15.9333 19.6667 15 20.2C14.0833 20.7333 13.0833 21 12 21Z");

/** `build` */
export function Build(props: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="currentColor"
      {...props}
    >
      <path d="M0 0h24v24H0V0z" fill="none" /><path d="M21.35 17.82l-6.87-6.87.05-.05c.93-2.34.45-5.1-1.44-7-2.3-2.3-5.88-2.51-8.43-.65L6.11 4.7l.72.72L8.5 7.08 7.08 8.5 5.41 6.83l-.71-.72-1.45-1.44c-1.86 2.54-1.65 6.12.65 8.42 1.86 1.86 4.57 2.35 6.89 1.48l.13-.12 6.9 6.9c.78.78 2.05.78 2.83 0l.71-.71c.77-.77.77-2.04-.01-2.82zM5.32 11.68c-.94-.94-1.36-2.19-1.3-3.42l3.06 3.06 4.24-4.24-3.05-3.06c1.23-.06 2.48.36 3.42 1.3 1.76 1.76 1.76 4.61 0 6.36-1.77 1.76-4.61 1.76-6.37 0z" />
    </svg>
  );
}
Build.displayName = "Build";

/** `calculate` */
export function Calculate(props: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="currentColor"
      {...props}
    >
      <g><rect fill="none" height="24" width="24" /></g><g><g><path d="M19,3H5C3.9,3,3,3.9,3,5v14c0,1.1,0.9,2,2,2h14c1.1,0,2-0.9,2-2V5C21,3.9,20.1,3,19,3z M19,19H5V5h14V19z" /><rect height="1.5" width="5" x="6.25" y="7.72" /><rect height="1.5" width="5" x="13" y="15.75" /><rect height="1.5" width="5" x="13" y="13.25" /><polygon points="8,18 9.5,18 9.5,16 11.5,16 11.5,14.5 9.5,14.5 9.5,12.5 8,12.5 8,14.5 6,14.5 6,16 8,16" /><polygon points="14.09,10.95 15.5,9.54 16.91,10.95 17.97,9.89 16.56,8.47 17.97,7.06 16.91,6 15.5,7.41 14.09,6 13.03,7.06 14.44,8.47 13.03,9.89" /></g></g>
    </svg>
  );
}
Calculate.displayName = "Calculate";

/** `calendar` */
export const Calendar = icon("Calendar", "M18 4V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 19a2 2 0 0 0 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2h-1zM5 19V9h14v10H5zm12-8h-2v2h2v-2zm0 4h-2v2h2v-2zm-4-4h-2v2h2v-2zm0 4h-2v2h2v-2zm-4-4H7v2h2v-2zm0 4H7v2h2v-2z", { evenodd: true });

/** `calendar_month` */
export function CalendarMonth(props: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="currentColor"
      {...props}
    >
      <g clipPath="url(#calendar_month-clip0_1_30)"><path d="M5 22C4.45 22 3.975 21.8083 3.575 21.425C3.19167 21.025 3 20.55 3 20V6C3 5.45 3.19167 4.98333 3.575 4.6C3.975 4.2 4.45 4 5 4H6V2H8V4H16V2H18V4H19C19.55 4 20.0167 4.2 20.4 4.6C20.8 4.98333 21 5.45 21 6V20C21 20.55 20.8 21.025 20.4 21.425C20.0167 21.8083 19.55 22 19 22H5ZM5 20H19V10H5V20ZM5 8H19V6H5V8ZM5 8V6V8ZM12 14C11.7167 14 11.475 13.9083 11.275 13.725C11.0917 13.525 11 13.2833 11 13C11 12.7167 11.0917 12.4833 11.275 12.3C11.475 12.1 11.7167 12 12 12C12.2833 12 12.5167 12.1 12.7 12.3C12.9 12.4833 13 12.7167 13 13C13 13.2833 12.9 13.525 12.7 13.725C12.5167 13.9083 12.2833 14 12 14ZM8 14C7.71667 14 7.475 13.9083 7.275 13.725C7.09167 13.525 7 13.2833 7 13C7 12.7167 7.09167 12.4833 7.275 12.3C7.475 12.1 7.71667 12 8 12C8.28333 12 8.51667 12.1 8.7 12.3C8.9 12.4833 9 12.7167 9 13C9 13.2833 8.9 13.525 8.7 13.725C8.51667 13.9083 8.28333 14 8 14ZM16 14C15.7167 14 15.475 13.9083 15.275 13.725C15.0917 13.525 15 13.2833 15 13C15 12.7167 15.0917 12.4833 15.275 12.3C15.475 12.1 15.7167 12 16 12C16.2833 12 16.5167 12.1 16.7 12.3C16.9 12.4833 17 12.7167 17 13C17 13.2833 16.9 13.525 16.7 13.725C16.5167 13.9083 16.2833 14 16 14ZM12 18C11.7167 18 11.475 17.9083 11.275 17.725C11.0917 17.525 11 17.2833 11 17C11 16.7167 11.0917 16.4833 11.275 16.3C11.475 16.1 11.7167 16 12 16C12.2833 16 12.5167 16.1 12.7 16.3C12.9 16.4833 13 16.7167 13 17C13 17.2833 12.9 17.525 12.7 17.725C12.5167 17.9083 12.2833 18 12 18ZM8 18C7.71667 18 7.475 17.9083 7.275 17.725C7.09167 17.525 7 17.2833 7 17C7 16.7167 7.09167 16.4833 7.275 16.3C7.475 16.1 7.71667 16 8 16C8.28333 16 8.51667 16.1 8.7 16.3C8.9 16.4833 9 16.7167 9 17C9 17.2833 8.9 17.525 8.7 17.725C8.51667 17.9083 8.28333 18 8 18ZM16 18C15.7167 18 15.475 17.9083 15.275 17.725C15.0917 17.525 15 17.2833 15 17C15 16.7167 15.0917 16.4833 15.275 16.3C15.475 16.1 15.7167 16 16 16C16.2833 16 16.5167 16.1 16.7 16.3C16.9 16.4833 17 16.7167 17 17C17 17.2833 16.9 17.525 16.7 17.725C16.5167 17.9083 16.2833 18 16 18Z" /></g><defs><clipPath id="calendar_month-clip0_1_30"><rect width="24" height="24" fill="white" /></clipPath></defs>
    </svg>
  );
}
CalendarMonth.displayName = "CalendarMonth";

/** `campaign` */
export const Campaign = icon("Campaign", "M720-440v-80h160v80H720Zm48 280-128-96 48-64 128 96-48 64Zm-80-480-48-64 128-96 48 64-128 96ZM200-200v-160h-40q-33 0-56.5-23.5T80-440v-80q0-33 23.5-56.5T160-600h160l200-120v480L320-360h-40v160h-80Zm240-182v-196l-98 58H160v80h182l98 58Zm120 36v-268q27 24 43.5 58.5T620-480q0 41-16.5 75.5T560-346ZM300-480Z", { viewBox: MS });

/** `cancel` */
export const Cancel = icon("Cancel", "M12 2C6.47 2 2 6.47 2 12s4.47 10 10 10 10-4.47 10-10S17.53 2 12 2zm5 13.59L15.59 17 12 13.41 8.41 17 7 15.59 10.59 12 7 8.41 8.41 7 12 10.59 15.59 7 17 8.41 13.41 12 17 15.59z", { evenodd: true });

/** `center_focus_weak` */
export const CenterFocusWeak = icon("CenterFocusWeak", "M480-336q-60 0-102-42t-42-102q0-60 42-102t102-42q60 0 102 42t42 102q0 60-42 102t-102 42Zm.21-72Q510-408 531-429.21t21-51Q552-510 530.79-531t-51-21Q450-552 429-530.79t-21 51Q408-450 429.21-429t51 21Zm-.21-72ZM216-144q-29.7 0-50.85-21.15Q144-186.3 144-216v-168h72v168h168v72H216Zm360 0v-72h168v-168h72v168q0 29.7-21.15 50.85Q773.7-144 744-144H576ZM144-576v-168q0-29.7 21.15-50.85Q186.3-816 216-816h168v72H216v168h-72Zm600 0v-168H576v-72h168q29.7 0 50.85 21.15Q816-773.7 816-744v168h-72Z", { viewBox: MS });

/** `chat` */
export const Chat = icon("Chat", "M240-400h320v-80H240v80Zm0-120h480v-80H240v80Zm0-120h480v-80H240v80ZM80-80v-720q0-33 23.5-56.5T160-880h640q33 0 56.5 23.5T880-800v480q0 33-23.5 56.5T800-240H240L80-80Zm126-240h594v-480H160v525l46-45Zm-46 0v-480 480Z", { viewBox: MS });

/** `chat_add_on` */
export const ChatAddOn = icon("ChatAddOn", "M120-160v-600q0-33 23.5-56.5T200-840h480q33 0 56.5 23.5T760-760v203q-10-2-20-2.5t-20-.5q-10 0-20 .5t-20 2.5v-203H200v400h283q-2 10-2.5 20t-.5 20q0 10 .5 20t2.5 20H240L120-160Zm160-440h320v-80H280v80Zm0 160h200v-80H280v80Zm400 280v-120H560v-80h120v-120h80v120h120v80H760v120h-80ZM200-360v-400 400Z", { viewBox: MS });

/** `chat_bubble_outline` */
export function ChatBubbleOutline(props: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="currentColor"
      {...props}
    >
      <path d="M0 0h24v24H0V0z" fill="none" /><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H4V4h16v12z" />
    </svg>
  );
}
ChatBubbleOutline.displayName = "ChatBubbleOutline";

/** `check_circle_outline` */
export function CheckCircleOutline(props: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="currentColor"
      {...props}
    >
      <defs><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-2-5.8l-2.6-2.6L6 13l4 4 8-8-1.4-1.4-6.6 6.6z" id="check_circle_outline-icons-24-check-circle-outline-a" /></defs><use href="#check_circle_outline-icons-24-check-circle-outline-a" />
    </svg>
  );
}
CheckCircleOutline.displayName = "CheckCircleOutline";

/** `check_small` */
export function CheckSmall(props: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="currentColor"
      {...props}
    >
      <g><rect fill="none" height="24" width="24" /></g><g><path d="M18,9l-1.4-1.4L10,14.2l-2.6-2.6L6,13l4,4L18,9z" /></g>
    </svg>
  );
}
CheckSmall.displayName = "CheckSmall";

/** `check_status_filled` */
export const CheckStatusFilled = icon("CheckStatusFilled", "m424-296 282-282-56-56-226 226-114-114-56 56 170 170Zm56 216q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Z", { viewBox: MS });

/** `checklist` */
export function Checklist(props: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="currentColor"
      {...props}
    >
      <rect fill="none" height="24" width="24" /><path d="M22,7h-9v2h9V7z M22,15h-9v2h9V15z M5.54,11L2,7.46l1.41-1.41l2.12,2.12l4.24-4.24l1.41,1.41L5.54,11z M5.54,19L2,15.46 l1.41-1.41l2.12,2.12l4.24-4.24l1.41,1.41L5.54,19z" />
    </svg>
  );
}
Checklist.displayName = "Checklist";

/** `chevron_right` */
export const ChevronRight = icon("ChevronRight", "M7.59 18.59L9 20l8-8-8-8-1.41 1.41L14.17 12");

/** `circle` */
export function Circle(props: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="currentColor"
      {...props}
    >
      <g clipPath="url(#circle-clip0_1_74)"><path d="M12 22C10.6167 22 9.31667 21.7417 8.1 21.225C6.88333 20.6917 5.825 19.975 4.925 19.075C4.025 18.175 3.30833 17.1167 2.775 15.9C2.25833 14.6833 2 13.3833 2 12C2 10.6167 2.25833 9.31667 2.775 8.1C3.30833 6.88333 4.025 5.825 4.925 4.925C5.825 4.025 6.88333 3.31667 8.1 2.8C9.31667 2.26667 10.6167 2 12 2C13.3833 2 14.6833 2.26667 15.9 2.8C17.1167 3.31667 18.175 4.025 19.075 4.925C19.975 5.825 20.6833 6.88333 21.2 8.1C21.7333 9.31667 22 10.6167 22 12C22 13.3833 21.7333 14.6833 21.2 15.9C20.6833 17.1167 19.975 18.175 19.075 19.075C18.175 19.975 17.1167 20.6917 15.9 21.225C14.6833 21.7417 13.3833 22 12 22ZM12 20C14.2333 20 16.125 19.225 17.675 17.675C19.225 16.125 20 14.2333 20 12C20 9.76667 19.225 7.875 17.675 6.325C16.125 4.775 14.2333 4 12 4C9.76667 4 7.875 4.775 6.325 6.325C4.775 7.875 4 9.76667 4 12C4 14.2333 4.775 16.125 6.325 17.675C7.875 19.225 9.76667 20 12 20Z" /></g><defs><clipPath id="circle-clip0_1_74"><rect width="24" height="24" fill="white" /></clipPath></defs>
    </svg>
  );
}
Circle.displayName = "Circle";

/** `circles` */
export const Circles = icon("Circles", "M16.65 15c.55.033 1.092.008 1.625-.075.55-.1 1.075-.258 1.575-.475-.35 2.183-1.358 3.992-3.025 5.425C15.158 21.292 13.217 22 11 22a8.93 8.93 0 01-3.525-.7 9.653 9.653 0 01-2.85-1.925 9.654 9.654 0 01-1.925-2.85A8.931 8.931 0 012 13c0-2.217.708-4.158 2.125-5.825C5.558 5.508 7.367 4.5 9.55 4.15a7.175 7.175 0 00-.475 1.575A7.541 7.541 0 009 7.35a5.81 5.81 0 00-2.9 2.175A5.862 5.862 0 005 13c0 1.667.583 3.083 1.75 4.25C7.917 18.417 9.333 19 11 19a5.863 5.863 0 003.475-1.1A5.81 5.81 0 0016.65 15zM17 1c1.667 0 3.083.583 4.25 1.75C22.417 3.917 23 5.333 23 7c0 1.667-.583 3.083-1.75 4.25C20.083 12.417 18.667 13 17 13c-1.667 0-3.083-.583-4.25-1.75C11.583 10.083 11 8.667 11 7c0-1.667.583-3.083 1.75-4.25C13.917 1.583 15.333 1 17 1zm0 9c.833 0 1.542-.292 2.125-.875A2.893 2.893 0 0020 7c0-.833-.292-1.542-.875-2.125A2.893 2.893 0 0017 4c-.833 0-1.542.292-2.125.875A2.893 2.893 0 0014 7c0 .833.292 1.542.875 2.125A2.893 2.893 0 0017 10z");

/** `clear_all` */
export function ClearAll(props: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="currentColor"
      {...props}
    >
      <path d="M0 0h24v24H0V0z" fill="none" /><path d="M5 13h14v-2H5v2zm-2 4h14v-2H3v2zM7 7v2h14V7H7z" />
    </svg>
  );
}
ClearAll.displayName = "ClearAll";

/** `close` */
export const Close = icon("Close", "M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z", { evenodd: true });

/** `cloud_done` */
export const CloudDone = icon("CloudDone", "M10.35 17L16 11.35 14.55 9.9l-4.225 4.225-2.1-2.1L6.8 13.45 10.35 17zM6.5 20c-1.517 0-2.813-.525-3.888-1.575C1.537 17.375 1 16.092 1 14.575c0-1.3.392-2.458 1.175-3.475S3.983 9.433 5.25 9.15c.417-1.533 1.25-2.775 2.5-3.725C9 4.475 10.417 4 12 4c1.95 0 3.604.68 4.962 2.037C18.322 7.396 19 9.05 19 11c1.15.133 2.104.63 2.863 1.488A4.407 4.407 0 0123 15.5c0 1.25-.438 2.313-1.313 3.188S19.75 20 18.5 20h-12zm0-2h12c.7 0 1.292-.242 1.775-.725.483-.483.725-1.075.725-1.775s-.242-1.292-.725-1.775C19.792 13.242 19.2 13 18.5 13H17v-2c0-1.383-.488-2.563-1.463-3.537C14.563 6.487 13.383 6 12 6s-2.563.487-3.537 1.463C7.488 8.437 7 9.617 7 11h-.5c-.967 0-1.792.342-2.475 1.025A3.372 3.372 0 003 14.5c0 .967.342 1.792 1.025 2.475A3.372 3.372 0 006.5 18z");

/** `cloud_project` */
export const CloudProject = icon("CloudProject", "M155-40 40-238l115-202h229l116 202L385-40H155Zm0-480L40-718l115-202h229l116 202-116 198H155Zm46 400h137l69-118-69-122H201l-69 122 69 118Zm0-480h137l69-118-69-122H201l-69 122 69 118Zm374 320L459-478l115-202h230l116 202-115 198H575Zm45-80h138l69-118-69-122H621l-69 122 68 118ZM270-240Zm0-480Zm420 240Z", { viewBox: MS });

/** `code_black` */
export const CodeBlack = icon("CodeBlack", "M9.4 16.6L4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0l4.6-4.6-4.6-4.6L16 6l6 6-6 6-1.4-1.4z");

/** `collapse` */
export const Collapse = icon("Collapse", "M7.615 11.795l4.59-4.59-1.41-1.41-6 6 6 6 1.41-1.41-4.59-4.59zm9.59 6v-12h-2v12h2z", { evenodd: true });

/** `collapse_all` */
export function CollapseAll(props: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="currentColor"
      {...props}
    >
      <path d="M7.41 2L6 3.41l6 6 6-6L16.59 2 12 6.58 7.41 2zM12 17.42L16.59 22 18 20.59l-6-6-6 6L7.41 22 12 17.42z" /><path d="M24 0v24H0V0h24z" fill="none" />
    </svg>
  );
}
CollapseAll.displayName = "CollapseAll";

/** `collapse_content` */
export const CollapseContent = icon("CollapseContent", "M440-440v240h-80v-160H200v-80h240Zm160-320v160h160v80H520v-240h80Z", { viewBox: MS });

/** `columns` */
export const Columns = icon("Columns", "M16 4h4v16h-4V4zm-6 0h4v16h-4V4zM4.06 4H8v16H4.06V4z", { evenodd: true });

/** `commit` */
export function Commit(props: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="currentColor"
      {...props}
    >
      <g><rect fill="none" height="24" width="24" /></g><g><path d="M16.9,11L16.9,11c-0.46-2.28-2.48-4-4.9-4s-4.44,1.72-4.9,4h0H2v2h5.1h0c0.46,2.28,2.48,4,4.9,4s4.44-1.72,4.9-4h0H22v-2 H16.9z M12,15c-1.66,0-3-1.34-3-3s1.34-3,3-3s3,1.34,3,3S13.66,15,12,15z" /></g>
    </svg>
  );
}
Commit.displayName = "Commit";

/** `compare_arrows` */
export function CompareArrows(props: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="currentColor"
      {...props}
    >
      <path d="M0 0h24v24H0V0z" fill="none" /><path d="M8 10l-1.41 1.41L9.17 14H2v2h7.17l-2.58 2.59L8 20l5-5zm8 5l1.41-1.41L14.83 11H22V9h-7.17l2.58-2.59L16 5l-5 5z" />
    </svg>
  );
}
CompareArrows.displayName = "CompareArrows";

/** `compress` */
export const Compress = icon("Compress", "M8 19h3v3h2v-3h3l-4-4-4 4zm8-15h-3V1h-2v3H8l4 4 4-4zM4 9v2h16V9H4zm0 3h16v2H4z");

/** `content_paste` */
export const ContentPaste = icon("ContentPaste", "M19 2h-4.18C14.4.84 13.3 0 12 0S9.6.84 9.18 2H5c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-7 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm7 18H5V4h2v3h10V4h2v16z");

/** `copy` */
export const Copy = icon("Copy", "M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zM8 5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2H8zm11 16H8V7h11v14z", { evenodd: true });

/** `counter_0` */
export const Counter0 = icon("Counter0", "M12 22C10.6167 22 9.31667 21.7417 8.1 21.225C6.88333 20.6917 5.825 19.975 4.925 19.075C4.025 18.175 3.30833 17.1167 2.775 15.9C2.25833 14.6833 2 13.3833 2 12C2 10.6167 2.25833 9.31667 2.775 8.1C3.30833 6.88333 4.025 5.825 4.925 4.925C5.825 4.025 6.88333 3.31667 8.1 2.8C9.31667 2.26667 10.6167 2 12 2C13.3833 2 14.6833 2.26667 15.9 2.8C17.1167 3.31667 18.175 4.025 19.075 4.925C19.975 5.825 20.6833 6.88333 21.2 8.1C21.7333 9.31667 22 10.6167 22 12C22 13.3833 21.7333 14.6833 21.2 15.9C20.6833 17.1167 19.975 18.175 19.075 19.075C18.175 19.975 17.1167 20.6917 15.9 21.225C14.6833 21.7417 13.3833 22 12 22ZM12 20C14.2333 20 16.125 19.225 17.675 17.675C19.225 16.125 20 14.2333 20 12C20 9.76667 19.225 7.875 17.675 6.325C16.125 4.775 14.2333 4 12 4C9.76667 4 7.875 4.775 6.325 6.325C4.775 7.875 4 9.76667 4 12C4 14.2333 4.775 16.125 6.325 17.675C7.875 19.225 9.76667 20 12 20ZM11 17H13C13.55 17 14.0167 16.8083 14.4 16.425C14.8 16.025 15 15.55 15 15V9C15 8.45 14.8 7.98333 14.4 7.6C14.0167 7.2 13.55 7 13 7H11C10.45 7 9.975 7.2 9.575 7.6C9.19167 7.98333 9 8.45 9 9V15C9 15.55 9.19167 16.025 9.575 16.425C9.975 16.8083 10.45 17 11 17ZM11 9H13V15H11V9Z");

/** `counter_1` */
export const Counter1 = icon("Counter1", "M12 22C10.6167 22 9.31667 21.7417 8.1 21.225C6.88333 20.6917 5.825 19.975 4.925 19.075C4.025 18.175 3.30833 17.1167 2.775 15.9C2.25833 14.6833 2 13.3833 2 12C2 10.6167 2.25833 9.31667 2.775 8.1C3.30833 6.88333 4.025 5.825 4.925 4.925C5.825 4.025 6.88333 3.31667 8.1 2.8C9.31667 2.26667 10.6167 2 12 2C13.3833 2 14.6833 2.26667 15.9 2.8C17.1167 3.31667 18.175 4.025 19.075 4.925C19.975 5.825 20.6833 6.88333 21.2 8.1C21.7333 9.31667 22 10.6167 22 12C22 13.3833 21.7333 14.6833 21.2 15.9C20.6833 17.1167 19.975 18.175 19.075 19.075C18.175 19.975 17.1167 20.6917 15.9 21.225C14.6833 21.7417 13.3833 22 12 22ZM12 20C14.2333 20 16.125 19.225 17.675 17.675C19.225 16.125 20 14.2333 20 12C20 9.76667 19.225 7.875 17.675 6.325C16.125 4.775 14.2333 4 12 4C9.76667 4 7.875 4.775 6.325 6.325C4.775 7.875 4 9.76667 4 12C4 14.2333 4.775 16.125 6.325 17.675C7.875 19.225 9.76667 20 12 20ZM11.5 17H13.5V7H9.5V9H11.5V17Z");

/** `counter_2` */
export const Counter2 = icon("Counter2", "M12 22C10.6167 22 9.31667 21.7417 8.1 21.225C6.88333 20.6917 5.825 19.975 4.925 19.075C4.025 18.175 3.30833 17.1167 2.775 15.9C2.25833 14.6833 2 13.3833 2 12C2 10.6167 2.25833 9.31667 2.775 8.1C3.30833 6.88333 4.025 5.825 4.925 4.925C5.825 4.025 6.88333 3.31667 8.1 2.8C9.31667 2.26667 10.6167 2 12 2C13.3833 2 14.6833 2.26667 15.9 2.8C17.1167 3.31667 18.175 4.025 19.075 4.925C19.975 5.825 20.6833 6.88333 21.2 8.1C21.7333 9.31667 22 10.6167 22 12C22 13.3833 21.7333 14.6833 21.2 15.9C20.6833 17.1167 19.975 18.175 19.075 19.075C18.175 19.975 17.1167 20.6917 15.9 21.225C14.6833 21.7417 13.3833 22 12 22ZM12 20C14.2333 20 16.125 19.225 17.675 17.675C19.225 16.125 20 14.2333 20 12C20 9.76667 19.225 7.875 17.675 6.325C16.125 4.775 14.2333 4 12 4C9.76667 4 7.875 4.775 6.325 6.325C4.775 7.875 4 9.76667 4 12C4 14.2333 4.775 16.125 6.325 17.675C7.875 19.225 9.76667 20 12 20ZM9 17H15V15H11V13H13C13.55 13 14.0167 12.8083 14.4 12.425C14.8 12.025 15 11.55 15 11V9C15 8.45 14.8 7.98333 14.4 7.6C14.0167 7.2 13.55 7 13 7H9V9H13V11H11C10.45 11 9.975 11.2 9.575 11.6C9.19167 11.9833 9 12.45 9 13V17Z");

/** `counter_3` */
export const Counter3 = icon("Counter3", "M12 22C10.6167 22 9.31667 21.7417 8.1 21.225C6.88333 20.6917 5.825 19.975 4.925 19.075C4.025 18.175 3.30833 17.1167 2.775 15.9C2.25833 14.6833 2 13.3833 2 12C2 10.6167 2.25833 9.31667 2.775 8.1C3.30833 6.88333 4.025 5.825 4.925 4.925C5.825 4.025 6.88333 3.31667 8.1 2.8C9.31667 2.26667 10.6167 2 12 2C13.3833 2 14.6833 2.26667 15.9 2.8C17.1167 3.31667 18.175 4.025 19.075 4.925C19.975 5.825 20.6833 6.88333 21.2 8.1C21.7333 9.31667 22 10.6167 22 12C22 13.3833 21.7333 14.6833 21.2 15.9C20.6833 17.1167 19.975 18.175 19.075 19.075C18.175 19.975 17.1167 20.6917 15.9 21.225C14.6833 21.7417 13.3833 22 12 22ZM12 20C14.2333 20 16.125 19.225 17.675 17.675C19.225 16.125 20 14.2333 20 12C20 9.76667 19.225 7.875 17.675 6.325C16.125 4.775 14.2333 4 12 4C9.76667 4 7.875 4.775 6.325 6.325C4.775 7.875 4 9.76667 4 12C4 14.2333 4.775 16.125 6.325 17.675C7.875 19.225 9.76667 20 12 20ZM9 17H13C13.55 17 14.0167 16.8083 14.4 16.425C14.8 16.025 15 15.55 15 15V13.5C15 13.0667 14.8583 12.7083 14.575 12.425C14.2917 12.1417 13.9333 12 13.5 12C13.9333 12 14.2917 11.8583 14.575 11.575C14.8583 11.2917 15 10.9333 15 10.5V9C15 8.45 14.8 7.98333 14.4 7.6C14.0167 7.2 13.55 7 13 7H9V9H13V11H11V13H13V15H9V17Z");

/** `counter_4` */
export const Counter4 = icon("Counter4", "M12 22C10.6167 22 9.31667 21.7417 8.1 21.225C6.88333 20.6917 5.825 19.975 4.925 19.075C4.025 18.175 3.30833 17.1167 2.775 15.9C2.25833 14.6833 2 13.3833 2 12C2 10.6167 2.25833 9.31667 2.775 8.1C3.30833 6.88333 4.025 5.825 4.925 4.925C5.825 4.025 6.88333 3.31667 8.1 2.8C9.31667 2.26667 10.6167 2 12 2C13.3833 2 14.6833 2.26667 15.9 2.8C17.1167 3.31667 18.175 4.025 19.075 4.925C19.975 5.825 20.6833 6.88333 21.2 8.1C21.7333 9.31667 22 10.6167 22 12C22 13.3833 21.7333 14.6833 21.2 15.9C20.6833 17.1167 19.975 18.175 19.075 19.075C18.175 19.975 17.1167 20.6917 15.9 21.225C14.6833 21.7417 13.3833 22 12 22ZM12 20C14.2333 20 16.125 19.225 17.675 17.675C19.225 16.125 20 14.2333 20 12C20 9.76667 19.225 7.875 17.675 6.325C16.125 4.775 14.2333 4 12 4C9.76667 4 7.875 4.775 6.325 6.325C4.775 7.875 4 9.76667 4 12C4 14.2333 4.775 16.125 6.325 17.675C7.875 19.225 9.76667 20 12 20ZM13 17H15V7H13V11H11V7H9V13H13V17Z");

/** `counter_5` */
export const Counter5 = icon("Counter5", "M12 22C10.6167 22 9.31667 21.7417 8.1 21.225C6.88333 20.6917 5.825 19.975 4.925 19.075C4.025 18.175 3.30833 17.1167 2.775 15.9C2.25833 14.6833 2 13.3833 2 12C2 10.6167 2.25833 9.31667 2.775 8.1C3.30833 6.88333 4.025 5.825 4.925 4.925C5.825 4.025 6.88333 3.31667 8.1 2.8C9.31667 2.26667 10.6167 2 12 2C13.3833 2 14.6833 2.26667 15.9 2.8C17.1167 3.31667 18.175 4.025 19.075 4.925C19.975 5.825 20.6833 6.88333 21.2 8.1C21.7333 9.31667 22 10.6167 22 12C22 13.3833 21.7333 14.6833 21.2 15.9C20.6833 17.1167 19.975 18.175 19.075 19.075C18.175 19.975 17.1167 20.6917 15.9 21.225C14.6833 21.7417 13.3833 22 12 22ZM12 20C14.2333 20 16.125 19.225 17.675 17.675C19.225 16.125 20 14.2333 20 12C20 9.76667 19.225 7.875 17.675 6.325C16.125 4.775 14.2333 4 12 4C9.76667 4 7.875 4.775 6.325 6.325C4.775 7.875 4 9.76667 4 12C4 14.2333 4.775 16.125 6.325 17.675C7.875 19.225 9.76667 20 12 20ZM9 17H13C13.55 17 14.0167 16.8083 14.4 16.425C14.8 16.025 15 15.55 15 15V13C15 12.45 14.8 11.9833 14.4 11.6C14.0167 11.2 13.55 11 13 11H11V9H15V7H9V13H13V15H9V17Z");

/** `counter_6` */
export const Counter6 = icon("Counter6", "M12 22C10.6167 22 9.31667 21.7417 8.1 21.225C6.88333 20.6917 5.825 19.975 4.925 19.075C4.025 18.175 3.30833 17.1167 2.775 15.9C2.25833 14.6833 2 13.3833 2 12C2 10.6167 2.25833 9.31667 2.775 8.1C3.30833 6.88333 4.025 5.825 4.925 4.925C5.825 4.025 6.88333 3.31667 8.1 2.8C9.31667 2.26667 10.6167 2 12 2C13.3833 2 14.6833 2.26667 15.9 2.8C17.1167 3.31667 18.175 4.025 19.075 4.925C19.975 5.825 20.6833 6.88333 21.2 8.1C21.7333 9.31667 22 10.6167 22 12C22 13.3833 21.7333 14.6833 21.2 15.9C20.6833 17.1167 19.975 18.175 19.075 19.075C18.175 19.975 17.1167 20.6917 15.9 21.225C14.6833 21.7417 13.3833 22 12 22ZM12 20C14.2333 20 16.125 19.225 17.675 17.675C19.225 16.125 20 14.2333 20 12C20 9.76667 19.225 7.875 17.675 6.325C16.125 4.775 14.2333 4 12 4C9.76667 4 7.875 4.775 6.325 6.325C4.775 7.875 4 9.76667 4 12C4 14.2333 4.775 16.125 6.325 17.675C7.875 19.225 9.76667 20 12 20ZM11 17H13C13.55 17 14.0167 16.8083 14.4 16.425C14.8 16.025 15 15.55 15 15V13C15 12.45 14.8 11.9833 14.4 11.6C14.0167 11.2 13.55 11 13 11H11V9H14V7H11C10.45 7 9.975 7.2 9.575 7.6C9.19167 7.98333 9 8.45 9 9V15C9 15.55 9.19167 16.025 9.575 16.425C9.975 16.8083 10.45 17 11 17ZM11 13H13V15H11V13Z");

/** `counter_7` */
export const Counter7 = icon("Counter7", "M11 17H13L14.95 9.25C14.9833 9.16667 15 9.09167 15 9.025C15 8.95833 15 8.88333 15 8.8C15 8.31667 14.825 7.9 14.475 7.55C14.1417 7.18333 13.7333 7 13.25 7H9V9H13L11 17ZM12 22C10.6167 22 9.31667 21.7417 8.1 21.225C6.88333 20.6917 5.825 19.975 4.925 19.075C4.025 18.175 3.30833 17.1167 2.775 15.9C2.25833 14.6833 2 13.3833 2 12C2 10.6167 2.25833 9.31667 2.775 8.1C3.30833 6.88333 4.025 5.825 4.925 4.925C5.825 4.025 6.88333 3.31667 8.1 2.8C9.31667 2.26667 10.6167 2 12 2C13.3833 2 14.6833 2.26667 15.9 2.8C17.1167 3.31667 18.175 4.025 19.075 4.925C19.975 5.825 20.6833 6.88333 21.2 8.1C21.7333 9.31667 22 10.6167 22 12C22 13.3833 21.7333 14.6833 21.2 15.9C20.6833 17.1167 19.975 18.175 19.075 19.075C18.175 19.975 17.1167 20.6917 15.9 21.225C14.6833 21.7417 13.3833 22 12 22ZM12 20C14.2333 20 16.125 19.225 17.675 17.675C19.225 16.125 20 14.2333 20 12C20 9.76667 19.225 7.875 17.675 6.325C16.125 4.775 14.2333 4 12 4C9.76667 4 7.875 4.775 6.325 6.325C4.775 7.875 4 9.76667 4 12C4 14.2333 4.775 16.125 6.325 17.675C7.875 19.225 9.76667 20 12 20Z");

/** `counter_8` */
export const Counter8 = icon("Counter8", "M12 22C10.6167 22 9.31667 21.7417 8.1 21.225C6.88333 20.6917 5.825 19.975 4.925 19.075C4.025 18.175 3.30833 17.1167 2.775 15.9C2.25833 14.6833 2 13.3833 2 12C2 10.6167 2.25833 9.31667 2.775 8.1C3.30833 6.88333 4.025 5.825 4.925 4.925C5.825 4.025 6.88333 3.31667 8.1 2.8C9.31667 2.26667 10.6167 2 12 2C13.3833 2 14.6833 2.26667 15.9 2.8C17.1167 3.31667 18.175 4.025 19.075 4.925C19.975 5.825 20.6833 6.88333 21.2 8.1C21.7333 9.31667 22 10.6167 22 12C22 13.3833 21.7333 14.6833 21.2 15.9C20.6833 17.1167 19.975 18.175 19.075 19.075C18.175 19.975 17.1167 20.6917 15.9 21.225C14.6833 21.7417 13.3833 22 12 22ZM12 20C14.2333 20 16.125 19.225 17.675 17.675C19.225 16.125 20 14.2333 20 12C20 9.76667 19.225 7.875 17.675 6.325C16.125 4.775 14.2333 4 12 4C9.76667 4 7.875 4.775 6.325 6.325C4.775 7.875 4 9.76667 4 12C4 14.2333 4.775 16.125 6.325 17.675C7.875 19.225 9.76667 20 12 20ZM11 17H13C13.55 17 14.0167 16.8083 14.4 16.425C14.8 16.025 15 15.55 15 15V13.5C15 13.0833 14.85 12.7333 14.55 12.45C14.2667 12.15 13.9167 12 13.5 12C13.9167 12 14.2667 11.8583 14.55 11.575C14.85 11.275 15 10.9167 15 10.5V9C15 8.45 14.8 7.98333 14.4 7.6C14.0167 7.2 13.55 7 13 7H11C10.45 7 9.975 7.2 9.575 7.6C9.19167 7.98333 9 8.45 9 9V10.5C9 10.9167 9.14167 11.275 9.425 11.575C9.725 11.8583 10.0833 12 10.5 12C10.0833 12 9.725 12.15 9.425 12.45C9.14167 12.7333 9 13.0833 9 13.5V15C9 15.55 9.19167 16.025 9.575 16.425C9.975 16.8083 10.45 17 11 17ZM11 9H13V11H11V9ZM11 15V13H13V15H11Z");

/** `counter_9` */
export const Counter9 = icon("Counter9", "M12 22C10.6167 22 9.31667 21.7417 8.1 21.225C6.88333 20.6917 5.825 19.975 4.925 19.075C4.025 18.175 3.30833 17.1167 2.775 15.9C2.25833 14.6833 2 13.3833 2 12C2 10.6167 2.25833 9.31667 2.775 8.1C3.30833 6.88333 4.025 5.825 4.925 4.925C5.825 4.025 6.88333 3.31667 8.1 2.8C9.31667 2.26667 10.6167 2 12 2C13.3833 2 14.6833 2.26667 15.9 2.8C17.1167 3.31667 18.175 4.025 19.075 4.925C19.975 5.825 20.6833 6.88333 21.2 8.1C21.7333 9.31667 22 10.6167 22 12C22 13.3833 21.7333 14.6833 21.2 15.9C20.6833 17.1167 19.975 18.175 19.075 19.075C18.175 19.975 17.1167 20.6917 15.9 21.225C14.6833 21.7417 13.3833 22 12 22ZM12 20C14.2333 20 16.125 19.225 17.675 17.675C19.225 16.125 20 14.2333 20 12C20 9.76667 19.225 7.875 17.675 6.325C16.125 4.775 14.2333 4 12 4C9.76667 4 7.875 4.775 6.325 6.325C4.775 7.875 4 9.76667 4 12C4 14.2333 4.775 16.125 6.325 17.675C7.875 19.225 9.76667 20 12 20ZM10 17H13C13.55 17 14.0167 16.8083 14.4 16.425C14.8 16.025 15 15.55 15 15V9C15 8.45 14.8 7.98333 14.4 7.6C14.0167 7.2 13.55 7 13 7H11C10.45 7 9.975 7.2 9.575 7.6C9.19167 7.98333 9 8.45 9 9V11C9 11.55 9.19167 12.025 9.575 12.425C9.975 12.8083 10.45 13 11 13H13V15H10V17ZM13 11H11V9H13V11Z");

/** `create` */
export const Create = icon("Create", "M19 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-2 10h-4v4h-2v-4H7v-2h4V7h2v4h4v2z", { evenodd: true });

/** `credentials` */
export const Credentials = icon("Credentials", "M12.65 10A5.99 5.99 0 007 6c-3.31 0-6 2.69-6 6s2.69 6 6 6a5.99 5.99 0 005.65-4H17v4h4v-4h2v-4H12.65zM7 14c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z", { evenodd: true });

/** `cut_over` */
export function CutOver(props: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="currentColor"
      {...props}
    >
      <rect fill="none" height="24" width="24" /><g><path d="M0,13h2v2H0V13z M12.2,18l-0.5,1H5v-2h4v-2H4v-2h5v-1.17L8.17,11H2V9c0,0,4.17,0,4.17,0l-2-2C4.17,7,3,7,3,7V5.83 L1.39,4.22l1.41-1.41l18.38,18.38l-1.41,1.41L15.17,18H12.2z M11,13.83V16h2.17L11,13.83z M7.83,5L18,5c1.66,0,3,1.34,3,3v9.5 c0,0.2-0.04,0.39-0.11,0.56L19,16.17V7h-8l0,1.17L7.83,5z" /></g>
    </svg>
  );
}
CutOver.displayName = "CutOver";

/** `dark_mode` */
export const DarkMode = icon("DarkMode", "M9.37,5.51C9.19,6.15,9.1,6.82,9.1,7.5c0,4.08,3.32,7.4,7.4,7.4c0.68,0,1.35-0.09,1.99-0.27C17.45,17.19,14.93,19,12,19 c-3.86,0-7-3.14-7-7C5,9.07,6.81,6.55,9.37,5.51z M12,3c-4.97,0-9,4.03-9,9s4.03,9,9,9s9-4.03,9-9c0-0.46-0.04-0.92-0.1-1.36 c-0.98,1.37-2.58,2.26-4.4,2.26c-2.98,0-5.4-2.42-5.4-5.4c0-1.81,0.89-3.42,2.26-4.4C12.92,3.04,12.46,3,12,3L12,3z");

/** `dashboard` */
export const Dashboard = icon("Dashboard", "M9 5v6H5V5h4m10 8v6h-4v-6h4m2-10h-8v6h8V3zM11 3H3v10h8V3zm10 8h-8v10h8V11zm-10 4H3v6h8v-6z");

/** `data_array` */
export function DataArray(props: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="currentColor"
      {...props}
    >
      <g clipPath="url(#data_array-clip0_1_14)"><path d="M15 20V18H18V6H15V4H20V20H15ZM4 20V4H9V6H6V18H9V20H4Z" /></g><defs><clipPath id="data_array-clip0_1_14"><rect width="24" height="24" fill="white" /></clipPath></defs>
    </svg>
  );
}
DataArray.displayName = "DataArray";

/** `data_object` */
export function DataObject(props: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="currentColor"
      {...props}
    >
      <g clipPath="url(#data_object-clip0_1_34)"><path d="M14 20V18H17C17.2833 18 17.5167 17.9083 17.7 17.725C17.9 17.525 18 17.2833 18 17V15C18 14.3667 18.1833 13.7917 18.55 13.275C18.9167 12.7583 19.4 12.3917 20 12.175V11.825C19.4 11.6083 18.9167 11.2417 18.55 10.725C18.1833 10.2083 18 9.63333 18 9V7C18 6.71667 17.9 6.48333 17.7 6.3C17.5167 6.1 17.2833 6 17 6H14V4H17C17.8333 4 18.5417 4.29167 19.125 4.875C19.7083 5.45833 20 6.16667 20 7V9C20 9.28333 20.0917 9.525 20.275 9.725C20.475 9.90833 20.7167 10 21 10H22V14H21C20.7167 14 20.475 14.1 20.275 14.3C20.0917 14.4833 20 14.7167 20 15V17C20 17.8333 19.7083 18.5417 19.125 19.125C18.5417 19.7083 17.8333 20 17 20H14ZM7 20C6.16667 20 5.45833 19.7083 4.875 19.125C4.29167 18.5417 4 17.8333 4 17V15C4 14.7167 3.9 14.4833 3.7 14.3C3.51667 14.1 3.28333 14 3 14H2V10H3C3.28333 10 3.51667 9.90833 3.7 9.725C3.9 9.525 4 9.28333 4 9V7C4 6.16667 4.29167 5.45833 4.875 4.875C5.45833 4.29167 6.16667 4 7 4H10V6H7C6.71667 6 6.475 6.1 6.275 6.3C6.09167 6.48333 6 6.71667 6 7V9C6 9.63333 5.81667 10.2083 5.45 10.725C5.08333 11.2417 4.6 11.6083 4 11.825V12.175C4.6 12.3917 5.08333 12.7583 5.45 13.275C5.81667 13.7917 6 14.3667 6 15V17C6 17.2833 6.09167 17.525 6.275 17.725C6.475 17.9083 6.71667 18 7 18H10V20H7Z" /></g><defs><clipPath id="data_object-clip0_1_34"><rect width="24" height="24" fill="white" /></clipPath></defs>
    </svg>
  );
}
DataObject.displayName = "DataObject";

/** `data_table` */
export function DataTable(props: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="currentColor"
      {...props}
    >
      <g clipPath="url(#data_table-clip0_1_6)"><path d="M5 21C4.45 21 3.975 20.8083 3.575 20.425C3.19167 20.025 3 19.55 3 19V5C3 4.45 3.19167 3.98333 3.575 3.6C3.975 3.2 4.45 3 5 3H19C19.55 3 20.0167 3.2 20.4 3.6C20.8 3.98333 21 4.45 21 5V19C21 19.55 20.8 20.025 20.4 20.425C20.0167 20.8083 19.55 21 19 21H5ZM5 8.325H19V5H5V8.325ZM5 13.675H19V10.325H5V13.675ZM5 19H19V15.675H5V19ZM6 7.65V5.65H8V7.65H6ZM6 13V11H8V13H6ZM6 18.35V16.35H8V18.35H6Z" /></g><defs><clipPath id="data_table-clip0_1_6"><rect width="24" height="24" fill="white" /></clipPath></defs>
    </svg>
  );
}
DataTable.displayName = "DataTable";

/** `database` */
export function Database(props: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="currentColor"
      {...props}
    >
      <g clipPath="url(#database-clip0_120_68)"><path d="M12 21C9.48333 21 7.35 20.6167 5.6 19.85C3.86667 19.0667 3 18.1167 3 17V7C3 5.9 3.875 4.95833 5.625 4.175C7.39167 3.39167 9.51667 3 12 3C14.4833 3 16.6 3.39167 18.35 4.175C20.1167 4.95833 21 5.9 21 7V17C21 18.1167 20.125 19.0667 18.375 19.85C16.6417 20.6167 14.5167 21 12 21ZM12 9.025C13.4833 9.025 14.975 8.81667 16.475 8.4C17.975 7.96667 18.8167 7.50833 19 7.025C18.8167 6.54167 17.975 6.08333 16.475 5.65C14.9917 5.21667 13.5 5 12 5C10.4833 5 8.99167 5.21667 7.525 5.65C6.075 6.06667 5.23333 6.525 5 7.025C5.23333 7.525 6.075 7.98333 7.525 8.4C8.99167 8.81667 10.4833 9.025 12 9.025ZM12 14C12.7 14 13.375 13.9667 14.025 13.9C14.675 13.8333 15.2917 13.7417 15.875 13.625C16.475 13.4917 17.0333 13.3333 17.55 13.15C18.0833 12.9667 18.5667 12.7583 19 12.525V9.525C18.5667 9.75833 18.0833 9.96667 17.55 10.15C17.0333 10.3333 16.475 10.4917 15.875 10.625C15.2917 10.7417 14.675 10.8333 14.025 10.9C13.375 10.9667 12.7 11 12 11C11.3 11 10.6167 10.9667 9.95 10.9C9.28333 10.8333 8.65 10.7417 8.05 10.625C7.46667 10.4917 6.91667 10.3333 6.4 10.15C5.88333 9.96667 5.41667 9.75833 5 9.525V12.525C5.41667 12.7583 5.88333 12.9667 6.4 13.15C6.91667 13.3333 7.46667 13.4917 8.05 13.625C8.65 13.7417 9.28333 13.8333 9.95 13.9C10.6167 13.9667 11.3 14 12 14ZM12 19C12.7667 19 13.5417 18.9417 14.325 18.825C15.125 18.7083 15.8583 18.5583 16.525 18.375C17.1917 18.175 17.75 17.9583 18.2 17.725C18.65 17.475 18.9167 17.225 19 16.975V14.525C18.5667 14.7583 18.0833 14.9667 17.55 15.15C17.0333 15.3333 16.475 15.4917 15.875 15.625C15.2917 15.7417 14.675 15.8333 14.025 15.9C13.375 15.9667 12.7 16 12 16C11.3 16 10.6167 15.9667 9.95 15.9C9.28333 15.8333 8.65 15.7417 8.05 15.625C7.46667 15.4917 6.91667 15.3333 6.4 15.15C5.88333 14.9667 5.41667 14.7583 5 14.525V17C5.08333 17.25 5.34167 17.4917 5.775 17.725C6.225 17.9583 6.78333 18.175 7.45 18.375C8.11667 18.5583 8.85 18.7083 9.65 18.825C10.45 18.9417 11.2333 19 12 19Z" /></g><defs><clipPath id="database-clip0_120_68"><rect width="24" height="24" fill="white" /></clipPath></defs>
    </svg>
  );
}
Database.displayName = "Database";

/** `database_search` */
export const DatabaseSearch = icon("DatabaseSearch", "M480-144q-70 0-131.62-11.4-61.62-11.39-107-31Q196-206 170-232.13q-26-26.13-26-55.87 0 29.8 26.22 55.99 26.21 26.18 71.5 45.6Q287-167 348.5-155.5T480-144Zm-43-193q-33-2-64.5-6T313-354q-28-7-52.5-16.5T216-391q20 11 45 20.5t53 16.5q28 7 58.93 10.85 30.93 3.84 64.07 6.15Zm43-263q86 0 166-22t98-50q-18-28-98.5-50t-165.53-22Q394-744 313.5-722T216-672q17 29 96.5 50.5T480-600Zm-37 382q5 17 14 35.5t23 38.5q-70 0-131.62-11.4-61.62-11.39-107-31Q196-206 170-232.13q-26-26.13-26-55.87v-384q0-29.58 26.48-55.57 26.47-25.99 72-45.71Q288-793 349.27-804.5q61.28-11.5 130.5-11.5Q549-816 610-804.5q61 11.5 106.84 31.13 45.84 19.62 72.5 45.5Q816-702 816-672.19q0 29.8-26.5 56Q763-590 717-570.5q-46 19.5-107.03 31Q548.95-528 480-528q-80 0-148.5-14.5T216-583v109q42 31 106 47t144 18q-9 17-17 35t-12 37q-66-3-123-17t-98-37v102.99Q235-262 300-242q65 20 143 24ZM862-48l-99-99q-21 12-43.39 19.5-22.4 7.5-46.66 7.5-69.98 0-118.96-49.23Q505-218.45 505-288q0-70 49-119t119-49q70 0 119 48.99 49 48.98 49 118.96 0 24.26-7.5 46.66Q826-219 814-198l99 99-51 51ZM672.77-192Q713-192 741-219.77q28-27.78 28-68Q769-328 741.23-356q-27.78-28-68-28Q633-384 605-356.23q-28 27.78-28 68Q577-248 604.77-220q27.78 28 68 28Z", { viewBox: MS });

/** `dataset` */
export function Dataset(props: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="currentColor"
      {...props}
    >
      <path d="M7 13h4v4H7zm6 0h4v4h-4z" /><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14z" /><path d="M7 7h4v4H7zm6 0h4v4h-4z" />
    </svg>
  );
}
Dataset.displayName = "Dataset";

/** `date_range` */
export const DateRange = icon("DateRange", "M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20a2 2 0 002 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V9h14v11zM8 11c-.55 0-1 .45-1 1s.45 1 1 1 1-.45 1-1-.45-1-1-1zm4 0c-.55 0-1 .45-1 1s.45 1 1 1 1-.45 1-1-.45-1-1-1zm4 0c-.55 0-1 .45-1 1s.45 1 1 1 1-.45 1-1-.45-1-1-1z");

/** `delete` */
export const Delete = icon("Delete", "M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z", { evenodd: true });

/** `delete_disable` */
export const DeleteDisable = icon("DeleteDisable", "M10 2.667A1.33 1.33 0 0 0 8.667 4H6.25l2.667 2.667H20V4h-4.667A1.33 1.33 0 0 0 14 2.667h-4zM3.333 3.75L2 5.083l3.333 3.334v10.25A2.66 2.66 0 0 0 8 21.333h8c.638 0 1.168-.256 1.625-.625l1.708 1.71 1.334-1.335-2.042-2.04L7.583 8 6.25 6.667 4 4.417l-.667-.667zM10.25 8l8.417 8.417V8H10.25z", { evenodd: true });

/** `delete_history` */
export const DeleteHistory = icon("DeleteHistory", "M16.4 21L15 19.6L17.1 17.5L15 15.4L16.4 14L18.5 16.1L20.6 14L22 15.4L19.925 17.5L22 19.6L20.6 21L18.5 18.925L16.4 21ZM12 21C9.7 21 7.69583 20.2375 5.9875 18.7125C4.27917 17.1875 3.3 15.2833 3.05 13H5.1C5.33333 14.7333 6.10417 16.1667 7.4125 17.3C8.72083 18.4333 10.25 19 12 19C12.1833 19 12.3542 18.9958 12.5125 18.9875C12.6708 18.9792 12.8333 18.9583 13 18.925V20.95C12.8333 20.9667 12.6708 20.9792 12.5125 20.9875C12.3542 20.9958 12.1833 21 12 21ZM3 10V4H5V6.35C5.85 5.28333 6.8875 4.45833 8.1125 3.875C9.3375 3.29167 10.6333 3 12 3C14.5 3 16.625 3.875 18.375 5.625C20.125 7.375 21 9.5 21 12H19C19 10.05 18.3208 8.39583 16.9625 7.0375C15.6042 5.67917 13.95 5 12 5C10.85 5 9.775 5.26667 8.775 5.8C7.775 6.33333 6.93333 7.06667 6.25 8H9V10H3ZM13.35 14.75L11 12.4V7H13V11.6L14.4 13L13.35 14.75Z");

/** `design_services` */
export const DesignServices = icon("DesignServices", "m352-522 86-87-56-57-44 44-56-56 43-44-45-45-87 87 159 158Zm328 329 87-87-45-45-44 43-56-56 43-44-57-56-86 86 158 159Zm24-567 57 57-57-57ZM290-120H120v-170l175-175L80-680l200-200 216 216 151-152q12-12 27-18t31-6q16 0 31 6t27 18l53 54q12 12 18 27t6 31q0 16-6 30.5T816-647L665-495l215 215L680-80 465-295 290-120Zm-90-80h56l392-391-57-57-391 392v56Zm420-419-29-29 57 57-28-28Z", { viewBox: MS });

/** `device_reset` */
export function DeviceReset(props: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="currentColor"
      {...props}
    >
      <g><rect fill="none" height="24" width="24" /></g><g><g><path d="M18,4C13.58,0.69,7.31,1.58,4,6V4H2v6h6V8H5.09c1.44-2.47,4.09-3.98,6.94-3.97c4.42,0.02,7.99,3.61,7.97,8.03 s-3.61,7.99-8.03,7.97C7.55,20.01,3.98,16.42,4,12H2c0,3.15,1.48,6.11,4,8c4.42,3.31,10.69,2.42,14-2C23.31,13.58,22.42,7.31,18,4 z" /><polygon points="11,6 11,13 15.96,16.5 17.23,14.94 13,12 13,6" /></g></g>
    </svg>
  );
}
DeviceReset.displayName = "DeviceReset";

/** `diagonal_line` */
export const DiagonalLine = icon("DiagonalLine", "M19 22a2.893 2.893 0 01-2.125-.875A2.893 2.893 0 0116 19c0-.233.025-.458.075-.675a2.8 2.8 0 01.225-.625l-10-10c-.2.1-.408.175-.625.225C5.458 7.975 5.233 8 5 8a2.893 2.893 0 01-2.125-.875A2.893 2.893 0 012 5c0-.833.292-1.542.875-2.125A2.893 2.893 0 015 2c.833 0 1.542.292 2.125.875S8 4.167 8 5c0 .233-.025.458-.075.675-.05.217-.125.425-.225.625l10 10c.2-.1.408-.175.625-.225.217-.05.442-.075.675-.075.833 0 1.542.292 2.125.875S22 18.167 22 19s-.292 1.542-.875 2.125A2.893 2.893 0 0119 22z");

/** `disabled` */
export function Disabled(props: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      {...props}
    >
      <path d="M2 12C2 6.48 6.48 2 12 2s10 4.48 10 10-4.48 10-10 10S2 17.52 2 12zm4-1v3h12v-3H6z" fill="var(--cm-sys-color-on-surface-variant-low)" fillRule="evenodd" />
    </svg>
  );
}
Disabled.displayName = "Disabled";

/** `disabled_by_default` */
export function DisabledByDefault(props: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="currentColor"
      {...props}
    >
      <rect fill="none" height="24" width="24" /><path d="M19,19H5V5h14V19z M3,3v18h18V3H3z M17,15.59L15.59,17L12,13.41L8.41,17L7,15.59L10.59,12L7,8.41L8.41,7L12,10.59L15.59,7 L17,8.41L13.41,12L17,15.59z" />
    </svg>
  );
}
DisabledByDefault.displayName = "DisabledByDefault";

/** `disabled_yellow` */
export function DisabledYellow(props: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      {...props}
    >
      <path d="M2 12C2 6.48 6.48 2 12 2s10 4.48 10 10-4.48 10-10 10S2 17.52 2 12zm4-1v3h12v-3H6z" fill="var(--cm-sys-color-status-warning)" fillRule="evenodd" />
    </svg>
  );
}
DisabledYellow.displayName = "DisabledYellow";

/** `do_not_disturb_on_total_silence` */
export const DoNotDisturbOnTotalSilence = icon("DoNotDisturbOnTotalSilence", "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm0-14c-3.3 0-6 2.7-6 6s2.7 6 6 6 6-2.7 6-6-2.6-6-6-6zm3 7H9v-2h6v2z");

/** `docker` */
export const Docker = icon("Docker", "M0 0v24h24V0H0zm13.3 9.6h2.1v1.9h-2.1V9.6zm-2.4-4.5H13V7h-2.1V5.1zm0 2.2H13v1.9h-2.1V7.3zm0 2.3H13v1.9h-2.1V9.6zM8.4 7.3h2.1v1.9H8.4V7.3zm0 2.3h2.1v1.9H8.4V9.6zM6 7.3h2.1v1.9H6V7.3zm0 2.3h2.1v1.9H6V9.6zm-2.5 0h2.1v1.9H3.5V9.6zm18.4 1.2c-.1.3-.2.4-.2.4-.7 1.4-2.2 1.4-2.9 1.4-1.7 4.1-5.3 6.4-10.3 6.4-2.3 0-4-.7-5.2-2.1-1.5-1.8-1.5-4.2-1.4-4.9v-.2h13.6c.7 0 1.2-.2 1.5-.3-.3-.4-.4-.9-.4-1.1-.1-.7.1-1.5.5-2.1l.3-.4.6.2c.8.6 1.2 1.2 1.3 2 .8-.2 1.8 0 2.3.3l.4.3-.1.1z");

/** `docker_alt` */
export const DockerAlt = icon("DockerAlt", "m13.3 9.6h2.1v1.9h-2.1V9.6zm-2.4-4.5H13V7h-2.1V5.1zm0 2.2H13v1.9h-2.1V7.3zm0 2.3H13v1.9h-2.1V9.6zM8.4 7.3h2.1v1.9H8.4V7.3zm0 2.3h2.1v1.9H8.4V9.6zM6 7.3h2.1v1.9H6V7.3zm0 2.3h2.1v1.9H6V9.6zm-2.5 0h2.1v1.9H3.5V9.6zm18.4 1.2c-.1.3-.2.4-.2.4-.7 1.4-2.2 1.4-2.9 1.4-1.7 4.1-5.3 6.4-10.3 6.4-2.3 0-4-.7-5.2-2.1-1.5-1.8-1.5-4.2-1.4-4.9v-.2h13.6c.7 0 1.2-.2 1.5-.3-.3-.4-.4-.9-.4-1.1-.1-.7.1-1.5.5-2.1l.3-.4.6.2c.8.6 1.2 1.2 1.3 2 .8-.2 1.8 0 2.3.3l.4.3-.1.1z");

/** `docker_image` */
export const DockerImage = icon("DockerImage", "M7 3v2H5v14h2v2H3V3h4zm10 0h4v18h-4v-2h2V5h-2V3zM7 6h2v5H7V6zm8 7h2v5h-2v-5zm-4-7h6v5h-6V6zm2 1v3h2V7h-2zm-6 6h6v5H7v-5zm2 1v3h2v-3H9z", { evenodd: true });

/** `documentation` */
export const Documentation = icon("Documentation", "M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z");

/** `domain` */
export const Domain = icon("Domain", "M12 7V3H2v18h20V7H12zM6 19H4v-2h2v2zm0-4H4v-2h2v2zm0-4H4V9h2v2zm0-4H4V5h2v2zm4 12H8v-2h2v2zm0-4H8v-2h2v2zm0-4H8V9h2v2zm0-4H8V5h2v2zm10 12h-8v-2h2v-2h-2v-2h2v-2h-2V9h8v10zm-2-8h-2v2h2v-2zm0 4h-2v2h2v-2z", { evenodd: true });

/** `domain_regulated` */
export function DomainRegulated(props: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="currentColor"
      {...props}
    >
      <path d="M12 19v-2h2v-2h-2v-2h2v-2h-2V9h8v2.03l2 1V7H12V3H2v18h13.21c-.41-.63-.72-1.3-.92-2H12zm-6 0H4v-2h2v2zm0-4H4v-2h2v2zm0-4H4V9h2v2zm0-4H4V5h2v2zm4 12H8v-2h2v2zm0-4H8v-2h2v2zm0-4H8V9h2v2zm0-4H8V5h2v2z" /><path d="M18 11.53V11h-2v1.53l2-1zm1.5.93l-4 2v2.55c0 1.27.38 2.42 1.14 3.46.76 1.04 1.71 1.7 2.86 1.99 1.15-.28 2.1-.95 2.86-1.99.76-1.04 1.14-2.2 1.14-3.46v-2.55l-4-2zm-.72 7l-2.02-2.02 1.05-1.07.97.97 2.43-2.38 1.05 1.05-3.48 3.45z" />
    </svg>
  );
}
DomainRegulated.displayName = "DomainRegulated";

/** `done` */
export const Done = icon("Done", "M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z", { evenodd: true });

/** `done_all` */
export function DoneAll(props: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="currentColor"
      {...props}
    >
      <path d="M0 0h24v24H0V0z" fill="none" /><path d="M18 7l-1.41-1.41-6.34 6.34 1.41 1.41L18 7zm4.24-1.41L11.66 16.17 7.48 12l-1.41 1.41L11.66 19l12-12-1.42-1.41zM.41 13.41L6 19l1.41-1.41L1.83 12 .41 13.41z" />
    </svg>
  );
}
DoneAll.displayName = "DoneAll";

/** `down` */
export const Down = icon("Down", "M16.59 8.295L18 9.705l-6 6-6-6 1.41-1.41 4.59 4.58z", { evenodd: true });

/** `download` */
export const Download = icon("Download", "M12 16L7 11L8.4 9.55L11 12.15V4H13V12.15L15.6 9.55L17 11L12 16ZM6 20C5.45 20 4.97917 19.8042 4.5875 19.4125C4.19583 19.0208 4 18.55 4 18V15H6V18H18V15H20V18C20 18.55 19.8042 19.0208 19.4125 19.4125C19.0208 19.8042 18.55 20 18 20H6Z");

/** `draft` */
export const Draft = icon("Draft", "M6 22c-.55 0-1.02-.196-1.412-.587A1.926 1.926 0 014 20V4c0-.55.196-1.02.588-1.413A1.926 1.926 0 016 2h8l6 6v12c0 .55-.196 1.02-.587 1.413A1.926 1.926 0 0118 22H6zm7-13V4H6v16h12V9h-5z");

/** `drive_document` */
export function DriveDocument(props: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="currentColor"
      {...props}
    >
      <path d="M0 0h24v24H0z" fill="none" /><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-1.99 6H7V7h10.01v2zm0 4H7v-2h10.01v2zm-3 4H7v-2h7.01v2z" />
    </svg>
  );
}
DriveDocument.displayName = "DriveDocument";

/** `drive_presentation` */
export function DrivePresentation(props: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="currentColor"
      {...props}
    >
      <path d="M0 0h24v24H0z" fill="none" /><path d="M19 3H5c-1.1 0-1.99.9-1.99 2v14c0 1.1.89 2 1.99 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 13H5V8h14v8z" />
    </svg>
  );
}
DrivePresentation.displayName = "DrivePresentation";

/** `drive_spreadsheet` */
export function DriveSpreadsheet(props: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="currentColor"
      {...props}
    >
      <path d="M0 0h24v24H0z" fill="none" /><path d="M19 3H5c-1.1 0-1.99.9-1.99 2L3 8v11c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 8h-8v8H9v-8H5V9h4V5h2v4h8v2z" />
    </svg>
  );
}
DriveSpreadsheet.displayName = "DriveSpreadsheet";

/** `drive_spreadsheet_outline` */
export const DriveSpreadsheetOutline = icon("DriveSpreadsheetOutline", "M19 3H5c-1.1 0-1.99.9-1.99 2L3 19c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 19H5v-8h4v8zM9 9H5V5h4v4zm10 10h-8v-8h8v8zm0-10h-8V5h8v4z");

/** `drive_zip` */
export function DriveZip(props: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="currentColor"
      {...props}
    >
      <g clipPath="url(#drive_zip-clip0_1_26)"><path d="M5 21C4.45 21 3.975 20.8083 3.575 20.425C3.19167 20.025 3 19.55 3 19V5C3 4.45 3.19167 3.98333 3.575 3.6C3.975 3.2 4.45 3 5 3H19C19.55 3 20.0167 3.2 20.4 3.6C20.8 3.98333 21 4.45 21 5V19C21 19.55 20.8 20.025 20.4 20.425C20.0167 20.8083 19.55 21 19 21H5ZM5 19H19V5H10V7H12V5H5V19ZM12 11V13H14V11H12ZM12 7V9H14V7H12ZM10 9V11H12V9H10ZM10 13V15H12V13H10ZM12 15V17H14V15H12Z" /></g><defs><clipPath id="drive_zip-clip0_1_26"><rect width="24" height="24" fill="white" /></clipPath></defs>
    </svg>
  );
}
DriveZip.displayName = "DriveZip";

/** `edit` */
export const Edit = icon("Edit", "M3 17.253v3.75h3.75l11.06-11.06-3.75-3.75L3 17.253zm17.71-10.21a.996.996 0 0 0 0-1.41l-2.34-2.34a.996.996 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z", { evenodd: true });

/** `edit_fix_auto` */
export const EditFixAuto = icon("EditFixAuto", "m340-720-80-80 80-80 80 80-80 80Zm460 460-80-80 80-80 80 80-80 80ZM205-92 92-205q-12-12-12-28t12-28l363-364q35-35 85-35t85 35q35 35 35 85t-35 85L261-92q-12 12-28 12t-28-12Zm279-335-14.5-14-14.5-14-14-14-14-14 28 28 29 28ZM233-176l251-251-57-56-250 250 56 57Zm507-384q-1 0-8-6-16-61-60.5-105.5T566-732q-2-1-6-8 0-2 6-8 61-16 105.5-60.5T732-914q1-2 8-6 2 0 8 6 17 61 61 105.5T914-748q2 0 6 8 0 1-6 8-61 16-105.5 60.5T748-566q0 2-8 6Z", { viewBox: MS });

/** `email` */
export const Email = icon("Email", "M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z");

/** `event` */
export function Event(props: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="currentColor"
      {...props}
    >
      <g clipPath="url(#event-clip0_1_50)"><path d="M14.5 18C13.8 18 13.2083 17.7583 12.725 17.275C12.2417 16.7917 12 16.2 12 15.5C12 14.8 12.2417 14.2083 12.725 13.725C13.2083 13.2417 13.8 13 14.5 13C15.2 13 15.7917 13.2417 16.275 13.725C16.7583 14.2083 17 14.8 17 15.5C17 16.2 16.7583 16.7917 16.275 17.275C15.7917 17.7583 15.2 18 14.5 18ZM5 22C4.45 22 3.975 21.8083 3.575 21.425C3.19167 21.025 3 20.55 3 20V6C3 5.45 3.19167 4.98333 3.575 4.6C3.975 4.2 4.45 4 5 4H6V2H8V4H16V2H18V4H19C19.55 4 20.0167 4.2 20.4 4.6C20.8 4.98333 21 5.45 21 6V20C21 20.55 20.8 21.025 20.4 21.425C20.0167 21.8083 19.55 22 19 22H5ZM5 20H19V10H5V20ZM5 8H19V6H5V8ZM5 8V6V8Z" /></g><defs><clipPath id="event-clip0_1_50"><rect width="24" height="24" fill="white" /></clipPath></defs>
    </svg>
  );
}
Event.displayName = "Event";

/** `event_available` */
export const EventAvailable = icon("EventAvailable", "M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20a2 2 0 0 0 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V9h14v11zm-3.4-9.4L17 12l-5.99 6-4-4 1.4-1.4 2.6 2.6 4.59-4.6z");

/** `event_busy` */
export const EventBusy = icon("EventBusy", "M10.59 14.26l-2.83-2.83 1.41-1.41L12 12.84l2.83-2.83 1.41 1.41-2.83 2.83 2.83 2.83-1.41 1.41L12 15.67 9.17 18.5l-1.41-1.41 2.83-2.83zM21 6v14c0 1.1-.9 2-2 2H5a2 2 0 0 1-2-2l.01-14c0-1.1.88-2 1.99-2h1V2h2v2h8V2h2v2h1c1.1 0 2 .9 2 2zm-2 3H5v11h14V9z");

/** `event_upcoming` */
export const EventUpcoming = icon("EventUpcoming", "M21 6v14c0 1.1-.9 2-2 2h-4v-2h4V10H5v4H3l.01-8c0-1.1.88-2 1.99-2h1V2h2v2h8V2h2v2h1c1.1 0 2 .9 2 2zM6.59 22.59L8 24l5-5-5-5-1.41 1.41L9.17 18H1v2h8.17l-2.58 2.59z");

/** `expand_all` */
export function ExpandAll(props: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="currentColor"
      {...props}
    >
      <path d="M16.59 9.41L18 8l-6-6-6 6 1.41 1.41L12 4.83l4.59 4.58zM12 19.17l-4.59-4.58L6 16l6 6 6-6-1.41-1.41L12 19.17z" /><path d="M24 0v24H0V0h24z" fill="none" />
    </svg>
  );
}
ExpandAll.displayName = "ExpandAll";

/** `expand_content` */
export const ExpandContent = icon("ExpandContent", "M240-240v-240h72v168h168v72H240Zm408-240v-168H480v-72h240v240h-72Z", { viewBox: MS });

/** `expand_more` */
export function ExpandMore(props: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="currentColor"
      {...props}
    >
      <path d="M5.41 7.59L4 9l8 8 8-8-1.41-1.41L12 14.17" /><path d="M24 24H0V0h24v24z" fill="none" opacity=".87" />
    </svg>
  );
}
ExpandMore.displayName = "ExpandMore";

/** `export` */
export const Export = icon("Export", "M5 18h14v-3h2v5H3v-5h2v3zm14-8h-4v6H9v-6H5l7-7 7 7z", { evenodd: true });

/** `extension` */
export const Extension = icon("Extension", "M4.5 21C4.08333 21 3.72917 20.8542 3.4375 20.5625C3.14583 20.2708 3 19.9167 3 19.5V15.1C3.73333 15.0167 4.3625 14.7292 4.8875 14.2375C5.4125 13.7458 5.675 13.1417 5.675 12.425C5.675 11.7083 5.4125 11.1042 4.8875 10.6125C4.3625 10.1208 3.73333 9.83333 3 9.75V5.35C3 4.93333 3.14583 4.57917 3.4375 4.2875C3.72917 3.99583 4.08333 3.85 4.5 3.85H8.925C9.10833 3.2 9.4375 2.64583 9.9125 2.1875C10.3875 1.72917 10.9583 1.5 11.625 1.5C12.2917 1.5 12.8625 1.72917 13.3375 2.1875C13.8125 2.64583 14.1417 3.2 14.325 3.85H18.65C19.0667 3.85 19.4208 3.99583 19.7125 4.2875C20.0042 4.57917 20.15 4.93333 20.15 5.35V9.675C20.8 9.85833 21.3417 10.2042 21.775 10.7125C22.2083 11.2208 22.425 11.8083 22.425 12.475C22.425 13.1083 22.2042 13.6625 21.7625 14.1375C21.3208 14.6125 20.7833 14.9333 20.15 15.1V19.5C20.15 19.9167 20.0042 20.2708 19.7125 20.5625C19.4208 20.8542 19.0667 21 18.65 21H14.25C14.1667 20.2667 13.8792 19.6375 13.3875 19.1125C12.8958 18.5875 12.2917 18.325 11.575 18.325C10.8583 18.325 10.2542 18.5875 9.7625 19.1125C9.27083 19.6375 8.98333 20.2667 8.9 21H4.5ZM18.65 19.5V5.35H4.5V8.6C5.3 8.9 5.94583 9.4 6.4375 10.1C6.92917 10.8 7.175 11.575 7.175 12.425C7.175 13.275 6.92917 14.05 6.4375 14.75C5.94583 15.45 5.3 15.95 4.5 16.25V19.5H7.75C8.05 18.7 8.55 18.0542 9.25 17.5625C9.95 17.0708 10.725 16.825 11.575 16.825C12.425 16.825 13.2 17.0708 13.9 17.5625C14.6 18.0542 15.1 18.7 15.4 19.5H18.65Z", { evenodd: true });

/** `external_link` */
export const ExternalLink = icon("ExternalLink", "M19 19H5V5h7V3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z", { evenodd: true });

/** `feature_search` */
export const FeatureSearch = icon("FeatureSearch", "M20 20c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2h5.5c-.3.8-.5 1.6-.5 2.5 0 3.6 2.9 6.5 6.5 6.5.8 0 1.5-.1 2.1-.4L20 15v5zm-.7-11.1c.4-.7.7-1.5.7-2.4C20 4 18 2 15.5 2S11 4 11 6.5s2 4.5 4.5 4.5c.9 0 1.7-.3 2.4-.7l3.1 3.1 1.4-1.4-3.1-3.1zm-3.8.1C14.1 9 13 7.9 13 6.5S14.1 4 15.5 4 18 5.1 18 6.5 16.9 9 15.5 9z");

/** `featured_seasonal_and_gifts` */
export const FeaturedSeasonalAndGifts = icon("FeaturedSeasonalAndGifts", "M160-80v-440H80v-240h208q-5-9-6.5-19t-1.5-21q0-50 35-85t85-35q23 0 43 8.5t37 23.5q17-16 37-24t43-8q50 0 85 35t35 85q0 11-2 20.5t-6 19.5h208v240h-80v440H160Zm371.5-748.5Q520-817 520-800t11.5 28.5Q543-760 560-760t28.5-11.5Q600-783 600-800t-11.5-28.5Q577-840 560-840t-28.5 11.5ZM360-800q0 17 11.5 28.5T400-760q17 0 28.5-11.5T440-800q0-17-11.5-28.5T400-840q-17 0-28.5 11.5T360-800ZM160-680v80h280v-80H160Zm280 520v-360H240v360h200Zm80 0h200v-360H520v360Zm280-440v-80H520v80h280Z", { viewBox: MS });

/** `feedback_square` */
export const FeedbackSquare = icon("FeedbackSquare", "M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H5.17l-.59.59-.58.58V4h16v12zm-9-4h2v2h-2zm0-6h2v4h-2z");

/** `file` */
export const File = icon("File", "M3 4.995C3 3.893 3.893 3 4.995 3h14.01C20.107 3 21 3.893 21 4.995v14.01A1.995 1.995 0 0 1 19.005 21H4.995A1.995 1.995 0 0 1 3 19.005V4.995zM6 9h12V7H6v2zm0 4h12v-2H6v2zm0 4h9v-2H6v2z", { evenodd: true });

/** `file_error` */
export function FileError(props: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      {...props}
    >
      <path d="M3 5c0-1.1.9-2 2-2h14c1.1 0 2 .9 2 2v14c0 1.1-.9 2-2 2H5c-1.1 0-2-.9-2-2V5zm8 8h2V7h-2v6zm0 4h2v-2h-2v2z" fill="var(--cm-sys-color-status-error)" />
    </svg>
  );
}
FileError.displayName = "FileError";

/** `file_upload` */
export const FileUpload = icon("FileUpload", "M4 15h2v3h12v-3h2v3c0 1.1-.9 2-2 2H6c-1.1 0-2-.9-2-2m4.41-7.59L11 7.83V16h2V7.83l2.59 2.59L17 9l-5-5-5 5 1.41 1.41z");

/** `file_valid` */
export function FileValid(props: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      {...props}
    >
      <path d="M10.5 12.9l-1.7-1.7-1.5 1.5 3.2 3.2.1-.1 6-6-1.5-1.5-4.6 4.6zM3 5c0-1.1.9-2 2-2h14c1.1 0 2 .9 2 2v14c0 1.1-.9 2-2 2H5c-1.1 0-2-.9-2-2V5z" fill="var(--cm-sys-color-status-success)" />
    </svg>
  );
}
FileValid.displayName = "FileValid";

/** `file_warning` */
export function FileWarning(props: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      {...props}
    >
      <path d="M3 5c0-1.1.9-2 2-2h14c1.1 0 2 .9 2 2v14c0 1.1-.9 2-2 2H5c-1.1 0-2-.9-2-2V5zm8 8h2V7h-2v6zm0 4h2v-2h-2v2z" fill="var(--cm-sys-color-status-warning)" />
    </svg>
  );
}
FileWarning.displayName = "FileWarning";

/** `filter` */
export const Filter = icon("Filter", "M10 18h4v-2h-4v2zM3 6v2h18V6H3zm3 7h12v-2H6v2z", { evenodd: true });

/** `filter_alt` */
export function FilterAlt(props: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="currentColor"
      {...props}
    >
      <path d="M0 0h24m0 24H0" fill="none" /><path d="M7 6h10l-5.01 6.3L7 6zm-2.75-.39C6.27 8.2 10 13 10 13v6c0 .55.45 1 1 1h2c.55 0 1-.45 1-1v-6s3.72-4.8 5.74-7.39A.998.998 0 0018.95 4H5.04c-.83 0-1.3.95-.79 1.61z" />
    </svg>
  );
}
FilterAlt.displayName = "FilterAlt";

/** `find_in_page` */
export const FindInPage = icon("FindInPage", "M14.75 20l2 2H6q-.825 0-1.412-.587Q4 20.825 4 20V4q0-.825.588-1.413Q5.175 2 6 2h9l5 6v12q0 .5-.212.913-.213.412-.588.687L14 16.45q-.425.275-.925.413Q12.575 17 12 17q-1.65 0-2.825-1.175Q8 14.65 8 13q0-1.65 1.175-2.825Q10.35 9 12 9q1.65 0 2.825 1.175Q16 11.35 16 13q0 .575-.137 1.075-.138.5-.413.925L18 17.6V8.7L14.05 4H6v16zM12 15q.825 0 1.413-.588Q14 13.825 14 13t-.587-1.413Q12.825 11 12 11q-.825 0-1.412.587Q10 12.175 10 13q0 .825.588 1.412Q11.175 15 12 15zm0-2zm0 0z");

/** `fireplace` */
export function Fireplace(props: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="currentColor"
      {...props}
    >
      <path d="M12.01 12.46c-.15.42-.15.82-.08 1.28.1.55.33 1.04.2 1.6-.13.59-.77 1.38-1.53 1.63 1.28 1.05 3.2.37 3.39-1.32.17-1.54-1.44-1.98-1.98-3.19z" /><path d="M2 2v20h20V2H2zm10 16c-1.58 0-2.97-1.88-3-3.06 0-.05-.01-.13-.01-.22-.13-1.73 1-3.2 2.47-4.37.47 1.01 1.27 2.03 2.57 2.92.58.42.97.86.97 1.73 0 1.65-1.35 3-3 3zm8 2h-2v-2h-2.02A4.98 4.98 0 0017 15c0-1.89-1.09-2.85-1.85-3.37C12.2 9.61 13 7 13 7c-6.73 3.57-6.02 7.47-6 8 .03.96.49 2.07 1.23 3H6v2H4V4h16v16z" />
    </svg>
  );
}
Fireplace.displayName = "Fireplace";

/** `first_page` */
export function FirstPage(props: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="currentColor"
      {...props}
    >
      <path d="M18 16.59L13.562 12 18 7.41 16.637 6l-5.802 6 5.802 6L18 16.59zM6 6h1.934v12H6V6z" fillRule="nonzero" /><path d="M24 24H0V0h24z" />
    </svg>
  );
}
FirstPage.displayName = "FirstPage";

/** `flag_filled` */
export const FlagFilled = icon("FlagFilled", "M13.5 3.5h-9v17h2v-7h5.6l.4 2h7v-10h-5.6l-.4-2z");

/** `flaky` */
export const Flaky = icon("Flaky", "M14.05 17.58l-.01.01-2.4-2.4 1.06-1.06 1.35 1.35L16.54 13l1.06 1.06-3.54 3.54-.01-.02zM12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zM7.34 6.28l1.41 1.41 1.41-1.41 1.06 1.06-1.41 1.41 1.41 1.41-1.06 1.06-1.41-1.41-1.41 1.41-1.06-1.06 1.41-1.41-1.41-1.41 1.06-1.06zM12 20c-2.2 0-4.2-.9-5.7-2.3L17.7 6.3C19.1 7.8 20 9.8 20 12c0 4.4-3.6 8-8 8z", { evenodd: true });

/** `flare` */
export const Flare = icon("Flare", "M7 11H2v2h5v-2zm2.17-3.24L7.05 5.64 5.64 7.05l2.12 2.12 1.41-1.41zM13 2h-2v5h2V2zm5.36 5.05l-1.41-1.41-2.12 2.12 1.41 1.41 2.12-2.12zM17 11v2h5v-2h-5zm-5-2c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3zm2.83 7.24l2.12 2.12 1.41-1.41-2.12-2.12-1.41 1.41zm-9.19.71l1.41 1.41 2.12-2.12-1.41-1.41-2.12 2.12zM11 22h2v-5h-2v5z");

/** `folder` */
export const Folder = icon("Folder", "M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z", { evenodd: true });

/** `folder_copy` */
export const FolderCopy = icon("FolderCopy", "M120-120q-33 0-56.5-23.5T40-200v-520h80v520h680v80H120zm160-160q-33 0-56.5-23.5T200-360v-440q0-33 23.5-56.5T280-880h200l80 80h280q33 0 56.5 23.5T920-720v360q0 33-23.5 56.5T840-280H280zm0-80h560v-360H527l-80-80H280v440zm0 0v-440 440z", { viewBox: MS });

/** `folder_data` */
export const FolderData = icon("FolderData", "M15 23c-.55 0-1.02-.196-1.412-.587A1.926 1.926 0 0113 21c0-.383.092-.725.275-1.025.183-.3.425-.542.725-.725v-5.525c-.3-.183-.542-.42-.725-.713A1.863 1.863 0 0113 12c0-.55.196-1.02.588-1.412A1.926 1.926 0 0115 10c.55 0 1.02.196 1.413.588.391.391.587.862.587 1.412 0 .383-.092.72-.275 1.012-.183.292-.425.53-.725.713V16.6l4-1.325v-1.55c-.3-.183-.542-.42-.725-.713A1.863 1.863 0 0119 12c0-.55.196-1.02.587-1.412A1.926 1.926 0 0121 10c.55 0 1.02.196 1.413.588.391.391.587.862.587 1.412 0 .383-.092.72-.275 1.012-.183.292-.425.53-.725.713V16.7l-6 2v.55c.3.183.542.425.725.725.183.3.275.642.275 1.025 0 .55-.196 1.02-.587 1.413A1.926 1.926 0 0115 23zM4 20c-.55 0-1.02-.196-1.413-.587A1.926 1.926 0 012 18V6c0-.55.196-1.02.587-1.412A1.926 1.926 0 014 4h6l2 2h8c.55 0 1.02.196 1.413.588.391.391.587.862.587 1.412H11.175l-2-2H4v12h7v2H4z");

/** `folder_error` */
export function FolderError(props: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      {...props}
    >
      <path d="M20 6c1.1 0 2 .9 2 2v10c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2h6l2 2h8zm-9 8h2V9h-2v5zm0 3h2v-2h-2v2z" fill="var(--cm-sys-color-status-error)" />
    </svg>
  );
}
FolderError.displayName = "FolderError";

/** `folder_regulated` */
export function FolderRegulated(props: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="currentColor"
      {...props}
    >
      <path d="M19.5 12.46l-4 2v2.55c0 1.27.38 2.42 1.14 3.46.76 1.04 1.71 1.7 2.86 1.99 1.15-.28 2.1-.95 2.86-1.99.76-1.04 1.14-2.2 1.14-3.46v-2.55l-4-2zm-.72 7l-2.02-2.02 1.05-1.07.97.97 2.43-2.38 1.05 1.05-3.48 3.45z" /><path d="M14 13.53l5.5-2.75 2.5 1.25V8c0-.55-.2-1.02-.59-1.41C21.02 6.2 20.55 6 20 6h-8l-2-2H4c-.55 0-1.02.2-1.41.59C2.2 4.98 2 5.45 2 6v12c0 .55.2 1.02.59 1.41.39.39.86.59 1.41.59h10.66c-.42-.94-.66-1.94-.66-2.99v-3.48z" />
    </svg>
  );
}
FolderRegulated.displayName = "FolderRegulated";

/** `folder_valid` */
export function FolderValid(props: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      {...props}
    >
      <path d="M10.5 13.9l-1.7-1.7-1.5 1.5 3.2 3.2.1-.1 6-6-1.5-1.5-4.6 4.6zM12 6h8c1.1 0 2 .9 2 2v10c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2h6l2 2z" fill="var(--cm-sys-color-status-success)" />
    </svg>
  );
}
FolderValid.displayName = "FolderValid";

/** `folder_warning` */
export function FolderWarning(props: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      {...props}
    >
      <path d="M20 6h-8l-2-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-7 11h-2v-2h2v2zm0-3h-2V9h2v5z" fill="var(--cm-sys-color-status-warning)" />
    </svg>
  );
}
FolderWarning.displayName = "FolderWarning";

/** `format_color_fill` */
export const FormatColorFill = icon("FormatColorFill", "m216-909 51-51 338 338q20 20 19.5 47T605-529L431-355q-20 20-47 20t-47-20L163-530q-19-19-20-46t20-47l170-169-117-117Zm168 168L219-576h1-1 330L384-741Zm348 453q-35 0-59.5-24.5T648-372q0-20 10.5-42.5T692-469q8-11 18.5-24t21.5-26q10 13 20.5 25.5T772-469q16 23 30 47t14 50q0 35-24.5 59.5T732-288ZM96 0v-192h768V0H96Z", { viewBox: MS });

/** `format_list_numbered` */
export function FormatListNumbered(props: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="currentColor"
      {...props}
    >
      <g clipPath="url(#format_list_numbered-clip0_1_58)"><path d="M3 22V20.5H5.5V19.75H4V18.25H5.5V17.5H3V16H6C6.28333 16 6.51667 16.1 6.7 16.3C6.9 16.4833 7 16.7167 7 17V18C7 18.2833 6.9 18.525 6.7 18.725C6.51667 18.9083 6.28333 19 6 19C6.28333 19 6.51667 19.1 6.7 19.3C6.9 19.4833 7 19.7167 7 20V21C7 21.2833 6.9 21.525 6.7 21.725C6.51667 21.9083 6.28333 22 6 22H3ZM3 15V12.25C3 11.9667 3.09167 11.7333 3.275 11.55C3.475 11.35 3.71667 11.25 4 11.25H5.5V10.5H3V9H6C6.28333 9 6.51667 9.1 6.7 9.3C6.9 9.48333 7 9.71667 7 10V11.75C7 12.0333 6.9 12.275 6.7 12.475C6.51667 12.6583 6.28333 12.75 6 12.75H4.5V13.5H7V15H3ZM4.5 8V3.5H3V2H6V8H4.5ZM9 19V17H21V19H9ZM9 13V11H21V13H9ZM9 7V5H21V7H9Z" /></g><defs><clipPath id="format_list_numbered-clip0_1_58"><rect width="24" height="24" fill="white" /></clipPath></defs>
    </svg>
  );
}
FormatListNumbered.displayName = "FormatListNumbered";

/** `full_screen` */
export const FullScreen = icon("FullScreen", "M6 5h4v2H7v3H5V5h1zm13 1v4h-2V7h-3V5h5v1zm-1 13h-4v-2h3v-3h2v5h-1zM7 17h3v2H5v-5h2v3z", { evenodd: true });

/** `fullscreen_exit` */
export const FullscreenExit = icon("FullscreenExit", "M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z");

/** `functions` */
export function Functions(props: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="currentColor"
      {...props}
    >
      <g clipPath="url(#functions-clip0_1_118)"><path d="M6 20V18L12.5 12L6 6V4H18V7H10.775L16.15 12L10.775 17H18V20H6Z" /></g><defs><clipPath id="functions-clip0_1_118"><rect width="24" height="24" fill="white" /></clipPath></defs>
    </svg>
  );
}
Functions.displayName = "Functions";

/** `get_app` */
export function GetApp(props: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="currentColor"
      {...props}
    >
      <path d="M0 0h24v24H0V0z" fill="none" /><path d="M18 15v3H6v-3H4v3c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2v-3h-2zm-1-3.5l-1.41-1.41L13 12.67V4h-2v8.67l-2.59-2.58L7 11.5l5 5z" />
    </svg>
  );
}
GetApp.displayName = "GetApp";

/** `github` */
export function Github(props: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      {...props}
    >
      <path clipRule="evenodd" d="M12 2C6.48 2 2 6.59 2 12.25c0 4.53 2.87 8.37 6.84 9.73.5.09.68-.22.68-.49 0-.24-.01-.89-.01-1.74-2.78.62-3.37-1.37-3.37-1.37-.45-1.18-1.11-1.5-1.11-1.5-.91-.64.07-.62.07-.62 1 .07 1.53 1.06 1.53 1.06.89 1.57 2.34 1.11 2.91.85.09-.66.35-1.11.63-1.37-2.22-.26-4.56-1.14-4.56-5.07 0-1.12.39-2.03 1.03-2.75-.1-.26-.45-1.3.1-2.71 0 0 .84-.28 2.75 1.05.8-.23 1.65-.34 2.5-.34.85 0 1.7.12 2.5.34 1.91-1.33 2.75-1.05 2.75-1.05.55 1.41.2 2.45.1 2.71.64.72 1.03 1.63 1.03 2.75 0 3.94-2.34 4.81-4.57 5.06.36.32.68.94.68 1.9 0 1.37-.01 2.48-.01 2.81 0 .27.18.59.69.49 3.97-1.36 6.83-5.2 6.83-9.73C22 6.59 17.52 2 12 2z" fill="var(--cm-sys-color-primary)" fillRule="evenodd" />
    </svg>
  );
}
Github.displayName = "Github";

/** `gleaf` */
export const Gleaf = icon("Gleaf", "M3.36 21.77c.43.35 1.06.29 1.41-.13l2.76-3.33c.79.46 1.62.69 2.47.69 4 0 10-4.84 10-14 0-1.25-.28-3-.28-3s-1.77.05-3 .29C7.72 4 4.09 10.81 4.84 14.73c.16.83.54 1.61 1.15 2.3l-2.76 3.33c-.35.43-.29 1.06.13 1.41zM17.09 4.25c.26-.05.56-.09.87-.12L7.98 16.19c-.65-.54-1.05-1.16-1.18-1.83-.53-2.82 2.44-8.61 10.29-10.11z");

/** `globe` */
export const Globe = icon("Globe", "M480-80q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-80q134 0 227-93t93-227q0-7-.5-14.5T799-507q-5 29-27 48t-52 19h-80q-33 0-56.5-23.5T560-520v-40H400v-80q0-33 23.5-56.5T480-720h40q0-23 12.5-40.5T563-789q-20-5-40.5-8t-42.5-3q-134 0-227 93t-93 227h200q66 0 113 47t47 113v40H400v110q20 5 39.5 7.5T480-160Z", { viewBox: MS });

/** `grid_on` */
export const GridOn = icon("GridOn", "M216-144q-29.7 0-50.85-21.15Q144-186.3 144-216v-528q0-29.7 21.15-50.85Q186.3-816 216-816h528q29.7 0 50.85 21.15Q816-773.7 816-744v528q0 29.7-21.15 50.85Q773.7-144 744-144H216Zm0-72h128v-128H216v128Zm200 0h128v-128H416v128Zm200 0h128v-128H616v128ZM216-416h128v-128H216v128Zm200 0h128v-128H416v128Zm200 0h128v-128H616v128ZM216-616h128v-128H216v128Zm200 0h128v-128H416v128Zm200 0h128v-128H616v128Z", { viewBox: MS });

/** `height` */
export const Height = icon("Height", "M480-120 320-280l56-56 64 63v-414l-64 63-56-56 160-160 160 160-56 57-64-64v414l64-63 56 56-160 160Z", { viewBox: MS });

/** `help` */
export const Help = icon("Help", "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm2.07-7.75l-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H8a4 4 0 0 1 4-4 4 4 0 0 1 4 4c0 .88-.36 1.68-.93 2.25z", { evenodd: true });

/** `help_outline` */
export const HelpOutline = icon("HelpOutline", "M11 18h2v-2h-2v2zm1-16C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm0-14a4 4 0 0 0-4 4h2c0-1.1.9-2 2-2s2 .9 2 2c0 2-3 1.75-3 5h2c0-2.25 3-2.5 3-5a4 4 0 0 0-4-4z");

/** `historical_imagery` */
export function HistoricalImagery(props: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="currentColor"
      {...props}
    >
      <path d="M12 17C11.3083 17 10.6583 16.8708 10.05 16.6125C9.44167 16.3458 8.9125 15.9875 8.4625 15.5375C8.0125 15.0875 7.65417 14.5583 7.3875 13.95C7.12917 13.3417 7 12.6917 7 12C7 11.3083 7.12917 10.6583 7.3875 10.05C7.65417 9.44167 8.0125 8.9125 8.4625 8.4625C8.9125 8.0125 9.44167 7.65833 10.05 7.4C10.6583 7.13333 11.3083 7 12 7C12.6917 7 13.3417 7.13333 13.95 7.4C14.5583 7.65833 15.0875 8.0125 15.5375 8.4625C15.9875 8.9125 16.3417 9.44167 16.6 10.05C16.8667 10.6583 17 11.3083 17 12C17 12.6917 16.8667 13.3417 16.6 13.95C16.3417 14.5583 15.9875 15.0875 15.5375 15.5375C15.0875 15.9875 14.5583 16.3458 13.95 16.6125C13.3417 16.8708 12.6917 17 12 17ZM11.5 15.975V15C11.225 15 10.9875 14.9042 10.7875 14.7125C10.5958 14.5125 10.5 14.275 10.5 14V13.5L8.1 11.1C8.075 11.25 8.05 11.4 8.025 11.55C8.00833 11.7 8 11.85 8 12C8 13.0083 8.32917 13.8917 8.9875 14.65C9.65417 15.4083 10.4917 15.85 11.5 15.975ZM14.95 14.7C15.1167 14.5167 15.2667 14.3208 15.4 14.1125C15.5333 13.8958 15.6417 13.675 15.725 13.45C15.8167 13.2167 15.8833 12.9792 15.925 12.7375C15.975 12.4958 16 12.25 16 12C16 11.1833 15.7708 10.4375 15.3125 9.7625C14.8625 9.0875 14.2583 8.6 13.5 8.3V8.5C13.5 8.775 13.4 9.0125 13.2 9.2125C13.0083 9.40417 12.775 9.5 12.5 9.5H11.5V10.5C11.5 10.6417 11.45 10.7625 11.35 10.8625C11.2583 10.9542 11.1417 11 11 11H10V12H13C13.1417 12 13.2583 12.05 13.35 12.15C13.45 12.2417 13.5 12.3583 13.5 12.5V14H14C14.2167 14 14.4125 14.0667 14.5875 14.2C14.7625 14.325 14.8833 14.4917 14.95 14.7Z" /><path d="M12.0104 1.99976C17.5301 1.99998 21.9995 6.48004 21.9996 11.9998C21.9996 17.5196 17.5302 21.9995 12.0104 21.9998C6.48038 21.9998 1.99963 17.5198 1.99963 11.9998H3.99963C3.99963 16.4196 7.57978 19.9996 11.9996 19.9998C16.4196 19.9998 19.9996 16.4198 19.9996 11.9998C19.9995 7.57991 16.4195 3.99976 11.9996 3.99976C9.03979 3.99987 6.46943 5.60986 5.08948 7.99976H7.52893C7.01223 8.57686 6.60593 9.25443 6.34241 9.99976H1.99963V3.99976H3.99963V6.0105C5.82963 3.5805 8.73038 1.99976 12.0104 1.99976Z" />
    </svg>
  );
}
HistoricalImagery.displayName = "HistoricalImagery";

/** `history` */
export const History = icon("History", "M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67V7z", { evenodd: true });

/** `home` */
export function Home(props: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="currentColor"
      {...props}
    >
      <g><path d="M0,0h24v24H0V0z" fill="none" /></g><g><polygon points="12,3 4,9 4,21 10,21 10,14 14,14 14,21 20,21 20,9" /></g>
    </svg>
  );
}
Home.displayName = "Home";

/** `home_storage` */
export const HomeStorage = icon("HomeStorage", "M200-120l-80-480h720l-80 480H200zm67-80h426l51-320H216l51 320zm133-160h160q17 0 28.5-11.5T600-400q0-17-11.5-28.5T560-440H400q-17 0-28.5 11.5T360-400q0 17 11.5 28.5T400-360zM240-640q-17 0-28.5-11.5T200-680q0-17 11.5-28.5T240-720h480q17 0 28.5 11.5T760-680q0 17-11.5 28.5T720-640H240zm80-120q-17 0-28.5-11.5T280-800q0-17 11.5-28.5T320-840h320q17 0 28.5 11.5T680-800q0 17-11.5 28.5T640-760H320zm-53 560h426-426z", { viewBox: MS });

/** `host` */
export const Host = icon("Host", "M160-120q-33 0-56.5-23.5T80-200v-560q0-33 23.5-56.5T160-840h200q33 0 56.5 23.5T440-760v560q0 33-23.5 56.5T360-120H160Zm440 0q-33 0-56.5-23.5T520-200v-560q0-33 23.5-56.5T600-840h200q33 0 56.5 23.5T880-760v560q0 33-23.5 56.5T800-120H600Zm-440-80h200v-560H160v560Zm440 0h200v-560H600v560ZM200-360h120v-80H200v80Zm440 0h120v-80H640v80ZM200-480h120v-80H200v80Zm440 0h120v-80H640v80ZM200-600h120v-80H200v80Zm440 0h120v-80H640v80ZM160-200h200-200Zm440 0h200-200Z", { viewBox: MS });

/** `hourglass_bottom` */
export const HourglassBottom = icon("HourglassBottom", "M480-520q66 0 113-47t47-113v-120H320v120q0 66 47 113t113 47zM160-80v-80h80v-120q0-61 28.5-114.5T348-480q-51-32-79.5-85.5T240-680v-120h-80v-80h640v80h-80v120q0 61-28.5 114.5T612-480q51 32 79.5 85.5T720-280v120h80v80H160z", { viewBox: MS });

/** `hub` */
export const Hub = icon("Hub", "M6 23q-1.25 0-2.125-.875T3 20q0-1.25.875-2.125T6 17q.35 0 .65.075.3.075.575.2L8.65 15.5q-.7-.775-.975-1.75T7.55 11.8l-2.025-.675q-.425.625-1.075 1Q3.8 12.5 3 12.5q-1.25 0-2.125-.875T0 9.5q0-1.25.875-2.125T3 6.5q1.25 0 2.125.875T6 9.5v.2l2.025.7q.5-.9 1.338-1.525.837-.625 1.887-.8V5.9q-.975-.275-1.613-1.063Q9 4.05 9 3q0-1.25.875-2.125T12 0q1.25 0 2.125.875T15 3q0 1.05-.65 1.837-.65.788-1.6 1.063v2.175q1.05.175 1.888.8.837.625 1.337 1.525L18 9.7v-.2q0-1.25.875-2.125T21 6.5q1.25 0 2.125.875T24 9.5q0 1.25-.875 2.125T21 12.5q-.8 0-1.462-.375-.663-.375-1.063-1l-2.025.675q.15.975-.125 1.937-.275.963-.975 1.763l1.425 1.75q.275-.125.575-.188.3-.062.65-.062 1.25 0 2.125.875T21 20q0 1.25-.875 2.125T18 23q-1.25 0-2.125-.875T15 20q0-.5.163-.962.162-.463.437-.838l-1.425-1.775Q13.15 17 11.988 17q-1.163 0-2.188-.575L8.4 18.2q.275.375.438.838Q9 19.5 9 20q0 1.25-.875 2.125T6 23zM3 10.5q.425 0 .713-.288Q4 9.925 4 9.5t-.287-.713Q3.425 8.5 3 8.5t-.712.287Q2 9.075 2 9.5t.288.712q.287.288.712.288zM6 21q.425 0 .713-.288Q7 20.425 7 20t-.287-.712Q6.425 19 6 19t-.713.288Q5 19.575 5 20t.287.712Q5.575 21 6 21zm6-17q.425 0 .713-.288Q13 3.425 13 3t-.287-.713Q12.425 2 12 2t-.712.287Q11 2.575 11 3t.288.712Q11.575 4 12 4zm0 11q1.05 0 1.775-.725.725-.725.725-1.775 0-1.05-.725-1.775Q13.05 10 12 10q-1.05 0-1.775.725Q9.5 11.45 9.5 12.5q0 1.05.725 1.775Q10.95 15 12 15zm6 6q.425 0 .712-.288Q19 20.425 19 20t-.288-.712Q18.425 19 18 19t-.712.288Q17 19.575 17 20t.288.712Q17.575 21 18 21zm3-10.5q.425 0 .712-.288Q22 9.925 22 9.5t-.288-.713Q21.425 8.5 21 8.5t-.712.287Q20 9.075 20 9.5t.288.712q.287.288.712.288zM12 3zM3 9.5zm9 3zm9-3zM6 20zm12 0z");

/** `image` */
export const Image = icon("Image", "M216-144q-29.7 0-50.85-21.5Q144-187 144-216v-528q0-29 21.15-50.5T216-816h528q29.7 0 50.85 21.5Q816-773 816-744v528q0 29-21.15 50.5T744-144H216Zm0-72h528v-528H216v528Zm48-72h432L552-480 444-336l-72-96-108 144Zm-48 72v-528 528Z", { viewBox: MS });

/** `image_edit_auto` */
export const ImageEditAuto = icon("ImageEditAuto", "M480-480ZM240-280h244l135-135-49-65-120 160-90-120-120 160Zm320 160v-123l221-220q9-9 20-13t22-4q12 0 23 4.5t20 13.5l37 37q8 9 12.5 20t4.5 22q0 11-4 22.5T903-340L683-120H560Zm300-263-37-37 37 37ZM620-180h38l121-122-37-37-122 121v38Zm140-380v-200H480v-80h280q33 0 56.5 23.5T840-760v200h-80ZM200-120q-33 0-56.5-23.5T120-200v-280h80v280h280v80H200Zm20-440q-6 0-8-6-16-61-60.5-105.5T46-732q-6-2-6-8 0-7 6-8 61-16 105.5-60.5T212-914q2-6 8-6 7 0 8 6 17 61 61 105.5T394-748q6 1 6 8 0 6-6 8-61 16-105.5 60.5T228-566q-1 6-8 6Zm541 239-19-18 37 37-18-19Z", { viewBox: MS });

/** `incognito` */
export function Incognito(props: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="currentColor"
      {...props}
    >
      <g><rect fill="none" height="24" width="24" /><g><rect height="1" width="18" x="3" y="11" /><path d="M17.62,10l-2.29-6.1c-0.19-0.5-0.74-0.77-1.25-0.6L12,4L9.91,3.3C9.4,3.13,8.85,3.4,8.66,3.9L6.38,10 H17.62z" /><path d="M16.5,13c-1.66,0-3.04,1.16-3.4,2.71c-0.84-0.36-1.62-0.26-2.2-0.01C10.53,14.15,9.15,13,7.5,13 C5.57,13,4,14.57,4,16.5C4,18.43,5.57,20,7.5,20c1.84,0,3.33-1.42,3.47-3.22c0.3-0.21,1.09-0.6,2.06,0.02 C13.19,18.59,14.67,20,16.5,20c1.93,0,3.5-1.57,3.5-3.5C20,14.57,18.43,13,16.5,13z M7.5,19C6.12,19,5,17.88,5,16.5 C5,15.12,6.12,14,7.5,14s2.5,1.12,2.5,2.5C10,17.88,8.88,19,7.5,19z M16.5,19c-1.38,0-2.5-1.12-2.5-2.5c0-1.38,1.12-2.5,2.5-2.5 s2.5,1.12,2.5,2.5C19,17.88,17.88,19,16.5,19z" /></g></g>
    </svg>
  );
}
Incognito.displayName = "Incognito";

/** `indicator_dot` */
export function IndicatorDot(props: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="currentColor"
      {...props}
    >
      <circle cx="12" cy="12" r="5" />
    </svg>
  );
}
IndicatorDot.displayName = "IndicatorDot";

/** `info` */
export const Info = icon("Info", "M11 17h2v-6h-2v6zm-9-5c0 5.52 4.48 10 10 10s10-4.48 10-10S17.52 2 12 2 2 6.48 2 12zm10 8c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zM11 9h2V7h-2v2z", { evenodd: true });

/** `info_spark` */
export function InfoSpark(props: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="currentColor"
      {...props}
    >
      <path d="M17.5 12c0-3.04 2.46-5.5 5.5-5.5-3.04 0-5.5-2.46-5.5-5.5 0 3.04-2.46 5.5-5.5 5.5 3.04 0 5.5 2.46 5.5 5.5z" /><path d="M19.85 10.5c.1.48.15.99.15 1.5 0 4.41-3.59 8-8 8s-8-3.59-8-8 3.59-8 8-8c.51 0 1.02.05 1.5.15l1.63-1.63C14.15 2.18 13.1 2 12 2 6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10c0-1.1-.18-2.15-.51-3.14l-1.64 1.64z" /><path d="M11 11h2v6h-2z" /><circle cx="12" cy="9" r="1" />
    </svg>
  );
}
InfoSpark.displayName = "InfoSpark";

/** `insert_text` */
export const InsertText = icon("InsertText", "M444-336v-216H336v-72h288v72H516v216h-72ZM48-48v-240h84v-384H48v-240h240v84h384v-84h240v240h-84v384h84v240H672v-84H288v84H48Zm240-156h384v-84h84v-384h-84v-84H288v84h-84v384h84v84ZM120-744h96v-96h-96v96Zm624 0h96v-96h-96v96Zm0 624h96v-96h-96v96Zm-624 0h96v-96h-96v96Zm96-624Zm528 0Zm0 528Zm-528 0Z", { viewBox: MS });

/** `insight_spark` */
export const InsightSpark = icon("InsightSpark", "M17.5 1c0 3.04-2.46 5.5-5.5 5.5 3.04 0 5.5 2.46 5.5 5.5 0-3.04 2.46-5.5 5.5-5.5-3.04 0-5.5-2.46-5.5-5.5zm-5.04 15.7l-3.54-3.54-7.07 7.07 1.42 1.42 5.65-5.66 3.54 3.54 5.18-5.18-1.42-1.42z");

/** `inspect` */
export const Inspect = icon("Inspect", "M12 5C7 5 2.73 8.11 1 12.5 2.73 16.89 7 20 12 20s9.27-3.11 11-7.5C21.27 8.11 17 5 12 5zm0 12.5c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z", { evenodd: true });

/** `join` */
export function Join(props: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="currentColor"
      {...props}
    >
      <g><rect fill="none" height="24" width="24" /></g><g><path d="M16 5c-1.49 0-2.87.47-4 1.26C10.87 5.47 9.49 5 8 5c-3.87 0-7 3.13-7 7s3.13 7 7 7c1.49 0 2.87-.47 4-1.26 1.13.79 2.51 1.26 4 1.26 3.87 0 7-3.13 7-7s-3.13-7-7-7zm-4 9.97c-.62-.83-1-1.85-1-2.97s.38-2.14 1-2.97c.62.83 1 1.85 1 2.97s-.38 2.14-1 2.97zM3 12c0-2.76 2.24-5 5-5 .91 0 1.75.26 2.49.69C9.56 8.88 9 10.37 9 12s.56 3.12 1.49 4.31c-.74.43-1.58.69-2.49.69-2.76 0-5-2.24-5-5zm13 5c-.91 0-1.75-.26-2.49-.69C14.44 15.12 15 13.63 15 12s-.56-3.12-1.49-4.31C14.25 7.26 15.09 7 16 7c2.76 0 5 2.24 5 5s-2.24 5-5 5z" /></g>
    </svg>
  );
}
Join.displayName = "Join";

/** `key` */
export function Key(props: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="currentColor"
      {...props}
    >
      <g clipPath="url(#key-clip0_1_54)"><path d="M7 14C6.45 14 5.975 13.8083 5.575 13.425C5.19167 13.025 5 12.55 5 12C5 11.45 5.19167 10.9833 5.575 10.6C5.975 10.2 6.45 10 7 10C7.55 10 8.01667 10.2 8.4 10.6C8.8 10.9833 9 11.45 9 12C9 12.55 8.8 13.025 8.4 13.425C8.01667 13.8083 7.55 14 7 14ZM7 18C5.33333 18 3.91667 17.4167 2.75 16.25C1.58333 15.0833 1 13.6667 1 12C1 10.3333 1.58333 8.91667 2.75 7.75C3.91667 6.58333 5.33333 6 7 6C8.11667 6 9.125 6.275 10.025 6.825C10.9417 7.375 11.6667 8.1 12.2 9H21L24 12L19.5 16.5L17.5 15L15.5 16.5L13.375 15H12.2C11.6667 15.9 10.9417 16.625 10.025 17.175C9.125 17.725 8.11667 18 7 18ZM7 16C7.93333 16 8.75 15.7167 9.45 15.15C10.1667 14.5833 10.6417 13.8667 10.875 13H14L15.45 14.025L17.5 12.5L19.275 13.875L21.15 12L20.15 11H10.875C10.6417 10.1333 10.1667 9.41667 9.45 8.85C8.75 8.28333 7.93333 8 7 8C5.9 8 4.95833 8.39167 4.175 9.175C3.39167 9.95833 3 10.9 3 12C3 13.1 3.39167 14.0417 4.175 14.825C4.95833 15.6083 5.9 16 7 16Z" /></g><defs><clipPath id="key-clip0_1_54"><rect width="24" height="24" fill="white" /></clipPath></defs>
    </svg>
  );
}
Key.displayName = "Key";

/** `key_vertical` */
export const KeyVertical = icon("KeyVertical", "M443.5-736.5Q467-760 500-760t56.5 23.5Q580-713 580-680t-23.5 56.5Q533-600 500-600t-56.5-23.5Q420-647 420-680t23.5-56.5ZM500 0 320-180l60-80-60-80 60-85v-47q-54-32-87-86.5T260-680q0-100 70-170t170-70q100 0 170 70t70 170q0 67-33 121.5T620-472v352L500 0ZM340-680q0 56 34 98.5t86 56.5v125l-41 58 61 82-55 71 75 75 40-40v-371q52-14 86-56.5t34-98.5q0-66-47-113t-113-47q-66 0-113 47t-47 113Z", { viewBox: MS });

/** `label` */
export const Label = icon("Label", "M4 20a1.99 1.99 0 01-1.425-.575A1.99 1.99 0 012 18V6c0-.55.192-1.017.575-1.4.4-.4.875-.6 1.425-.6h11c.317 0 .617.075.9.225.283.133.517.325.7.575L22 12l-5.4 7.2c-.183.25-.417.45-.7.6a2.09 2.09 0 01-.9.2H4zm0-2h11l4.5-6L15 6H4v12z");

/** `lan` */
export function Lan(props: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="currentColor"
      {...props}
    >
      <g clipPath="url(#lan-clip0_1_86)"><path d="M3 22V15H6V11H11V9H8V2H16V9H13V11H18V15H21V22H13V15H16V13H8V15H11V22H3ZM10 7H14V4H10V7ZM5 20H9V17H5V20ZM15 20H19V17H15V20Z" /></g><defs><clipPath id="lan-clip0_1_86"><rect width="24" height="24" fill="white" /></clipPath></defs>
    </svg>
  );
}
Lan.displayName = "Lan";

/** `last_page` */
export const LastPage = icon("LastPage", "M6 7.41L10.438 12 6 16.59 7.363 18l5.802-6-5.802-6L6 7.41zM16.066 6H18v12h-1.934V6z");

/** `layers` */
export const Layers = icon("Layers", "M480-118 120-398l66-50 294 228 294-228 66 50-360 280Zm0-202L120-600l360-280 360 280-360 280Zm0-280Zm0 178 230-178-230-178-230 178 230 178Z", { viewBox: MS });

/** `left` */
export const Left = icon("Left", "M15.705 16.59L14.295 18l-6-6 6-6 1.41 1.41-4.58 4.59z", { evenodd: true });

/** `library_add` */
export const LibraryAdd = icon("LibraryAdd", "M520-400h80v-120h120v-80H600v-120h-80v120H400v80h120v120zM320-240q-33 0-56.5-23.5T240-320v-480q0-33 23.5-56.5T320-880h480q33 0 56.5 23.5T880-800v480q0 33-23.5 56.5T800-240H320zm0-80h480v-480H320v480zM160-80q-33 0-56.5-23.5T80-160v-560h80v560h560v80H160zm160-720v480-480z", { viewBox: MS });

/** `library_books` */
export const LibraryBooks = icon("LibraryBooks", "M8 12h4v-2H8v2zm0-3h8V7H8v2zm0-3h8V4H8v2zM6 16c-.5 0-1-.2-1.4-.6-.4-.4-.6-.8-.6-1.4V2c0-.5.2-1 .6-1.4C5 .2 5.5 0 6 0h12c.6 0 1 .2 1.4.6.4.4.6.9.6 1.4v12c0 .6-.2 1-.6 1.4-.4.4-.8.6-1.4.6H6zm0-2h12V2H6v12zm-4 6c-.5 0-1-.2-1.4-.6C.2 19 0 18.6 0 18V4h2v14h14v2H2zM6 2v12V2z", { viewBox: "0 0 20 20" });

/** `license` */
export const License = icon("License", "M20 10c0-4.42-3.58-8-8-8s-8 3.58-8 8c0 2.03.76 3.87 2 5.28V23l6-2 6 2v-7.72c1.24-1.41 2-3.25 2-5.28zm-8-6c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6 2.69-6 6-6zm0 15-4 1.02v-3.1c1.18.68 2.54 1.08 4 1.08s2.82-.4 4-1.08v3.1L12 19zm-3-9c0-1.66 1.34-3 3-3s3 1.34 3 3-1.34 3-3 3-3-1.34-3-3z");

/** `light_mode` */
export const LightMode = icon("LightMode", "M12,9c1.65,0,3,1.35,3,3s-1.35,3-3,3s-3-1.35-3-3S10.35,9,12,9 M12,7c-2.76,0-5,2.24-5,5s2.24,5,5,5s5-2.24,5-5 S14.76,7,12,7L12,7z M2,13l2,0c0.55,0,1-0.45,1-1s-0.45-1-1-1l-2,0c-0.55,0-1,0.45-1,1S1.45,13,2,13z M20,13l2,0c0.55,0,1-0.45,1-1 s-0.45-1-1-1l-2,0c-0.55,0-1,0.45-1,1S19.45,13,20,13z M11,2v2c0,0.55,0.45,1,1,1s1-0.45,1-1V2c0-0.55-0.45-1-1-1S11,1.45,11,2z M11,20v2c0,0.55,0.45,1,1,1s1-0.45,1-1v-2c0-0.55-0.45-1-1-1C11.45,19,11,19.45,11,20z M5.99,4.58c-0.39-0.39-1.03-0.39-1.41,0 c-0.39,0.39-0.39,1.03,0,1.41l1.06,1.06c0.39,0.39,1.03,0.39,1.41,0s0.39-1.03,0-1.41L5.99,4.58z M18.36,16.95 c-0.39-0.39-1.03-0.39-1.41,0c-0.39,0.39-0.39,1.03,0,1.41l1.06,1.06c0.39,0.39,1.03,0.39,1.41,0c0.39-0.39,0.39-1.03,0-1.41 L18.36,16.95z M19.42,5.99c0.39-0.39,0.39-1.03,0-1.41c-0.39-0.39-1.03-0.39-1.41,0l-1.06,1.06c-0.39,0.39-0.39,1.03,0,1.41 s1.03,0.39,1.41,0L19.42,5.99z M7.05,18.36c0.39-0.39,0.39-1.03,0-1.41c-0.39-0.39-1.03-0.39-1.41,0l-1.06,1.06 c-0.39,0.39-0.39,1.03,0,1.41s1.03,0.39,1.41,0L7.05,18.36z");

/** `lightbulb` */
export const Lightbulb = icon("Lightbulb", "M9 21c0 .55.45 1 1 1h4c.55 0 1-.45 1-1v-1H9v1zm3-19C8.13 2 5 5.13 5 9c0 2.38 1.19 4.47 3 5.74V17c0 .55.45 1 1 1h6c.55 0 1-.45 1-1v-2.26c1.81-1.27 3-3.36 3-5.74 0-3.87-3.13-7-7-7z", { evenodd: true });

/** `lightbulb_outline` */
export const LightbulbOutline = icon("LightbulbOutline", "M423.5-103.5Q400-127 400-160h160q0 33-23.5 56.5T480-80q-33 0-56.5-23.5ZM320-200v-80h320v80H320Zm10-120q-69-41-109.5-110T180-580q0-125 87.5-212.5T480-880q125 0 212.5 87.5T780-580q0 81-40.5 150T630-320H330Zm24-80h252q45-32 69.5-79T700-580q0-92-64-156t-156-64q-92 0-156 64t-64 156q0 54 24.5 101t69.5 79Zm126 0Z", { viewBox: MS });

/** `lightbulb_tips` */
export const LightbulbTips = icon("LightbulbTips", "M479-360ZM340-160v-80h280v80H340Zm83.5 96.5Q400-87 400-120h160q0 33-23.5 56.5T480-40q-33 0-56.5-23.5ZM336-280q-62-37-99-100t-37-140q0-117 81.5-198.5T480-800v80q-83 0-141.5 58.5T280-520q0 48 21 89.5t59 70.5h240q30-23 49-53.5t27-66.5h81q-9 64-44 116t-89 84H336Zm404-280q-1 0-8-6-16-61-60.5-105.5T566-732q-2-1-6-8 0-2 6-8 61-16 105.5-60.5T732-914q1-2 8-6 2 0 8 6 17 61 61 105.5T914-748q2 0 6 8 0 1-6 8-61 16-105.5 60.5T748-566q0 2-8 6Z", { viewBox: MS });

/** `line_end_arrow` */
export const LineEndArrow = icon("LineEndArrow", "m480-240 122-204H96v-72h506L480-720l384 240-384 240Z", { viewBox: MS });

/** `line_end_circle` */
export const LineEndCircle = icon("LineEndCircle", "M16 16c1.1 0 2.042-.392 2.825-1.175C19.608 14.042 20 13.1 20 12s-.392-2.042-1.175-2.825C18.042 8.392 17.1 8 16 8s-2.042.392-2.825 1.175C12.392 9.958 12 10.9 12 12s.392 2.042 1.175 2.825C13.958 15.608 14.9 16 16 16zm0 2c-1.5 0-2.808-.475-3.925-1.425a5.823 5.823 0 01-2-3.575H2v-2h8.075a5.823 5.823 0 012-3.575C13.192 6.475 14.5 6 16 6c1.667 0 3.083.583 4.25 1.75C21.417 8.917 22 10.333 22 12c0 1.667-.583 3.083-1.75 4.25C19.083 17.417 17.667 18 16 18z");

/** `line_start_arrow` */
export const LineStartArrow = icon("LineStartArrow", "M480-240 96-480l384-240-122 204h506v72H358l122 204Z", { viewBox: MS });

/** `line_start_circle` */
export const LineStartCircle = icon("LineStartCircle", "M8 16c1.1 0 2.042-.392 2.825-1.175C11.608 14.042 12 13.1 12 12s-.392-2.042-1.175-2.825C10.042 8.392 9.1 8 8 8s-2.042.392-2.825 1.175C4.392 9.958 4 10.9 4 12s.392 2.042 1.175 2.825C5.958 15.608 6.9 16 8 16zm0 2c-1.667 0-3.083-.583-4.25-1.75C2.583 15.083 2 13.667 2 12c0-1.667.583-3.083 1.75-4.25C4.917 6.583 6.333 6 8 6c1.5 0 2.8.475 3.9 1.425 1.117.95 1.792 2.142 2.025 3.575H22v2h-8.075c-.233 1.433-.908 2.625-2.025 3.575C10.8 17.525 9.5 18 8 18z");

/** `link` */
export const Link = icon("Link", "M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1 0 1.71-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z", { evenodd: true });

/** `link_off` */
export const LinkOff = icon("LinkOff", "m770-302-60-62q40-11 65-42.5t25-73.5q0-50-35-85t-85-35H520v-80h160q83 0 141.5 58.5T880-480q0 57-29.5 105T770-302ZM634-440l-80-80h86v80h-6ZM792-56 56-792l56-56 736 736-56 56ZM440-280H280q-83 0-141.5-58.5T80-480q0-69 42-123t108-71l74 74h-24q-50 0-85 35t-35 85q0 50 35 85t85 35h160v80ZM320-440v-80h65l79 80H320Z", { viewBox: MS });

/** `list` */
export const List = icon("List", "M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z");

/** `lock` */
export const Lock = icon("Lock", "M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z", { evenodd: true });

/** `lock_filled` */
export const LockFilled = icon("LockFilled", "M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1s3.1 1.39 3.1 3.1v2z");

/** `lock_open` */
export function LockOpen(props: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="currentColor"
      {...props}
    >
      <g><path d="M0,0h24v24H0V0z" fill="none" /></g><g><path d="M18,8h-1V6c0-2.76-2.24-5-5-5S7,3.24,7,6h1.9c0-1.71,1.39-3.1,3.1-3.1s3.1,1.39,3.1,3.1v2H6c-1.1,0-2,0.9-2,2v10 c0,1.1,0.9,2,2,2h12c1.1,0,2-0.9,2-2V10C20,8.9,19.1,8,18,8z M12,17c-1.1,0-2-0.9-2-2s0.9-2,2-2s2,0.9,2,2S13.1,17,12,17z" /></g>
    </svg>
  );
}
LockOpen.displayName = "LockOpen";

/** `lock_open_outline` */
export function LockOpenOutline(props: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="currentColor"
      {...props}
    >
      <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6h2c0-1.66 1.34-3 3-3s3 1.34 3 3v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm0 12H6V10h12v10z" /><circle cx="12" cy="15" r="2" />
    </svg>
  );
}
LockOpenOutline.displayName = "LockOpenOutline";

/** `lock_open_right` */
export const LockOpenRight = icon("LockOpenRight", "M240-160h480v-400H240v400Zm296.5-143.5Q560-327 560-360t-23.5-56.5Q513-440 480-440t-56.5 23.5Q400-393 400-360t23.5 56.5Q447-280 480-280t56.5-23.5ZM240-160v-400 400Zm0 80q-33 0-56.5-23.5T160-160v-400q0-33 23.5-56.5T240-640h280v-80q0-83 58.5-141.5T720-920q83 0 141.5 58.5T920-720h-80q0-50-35-85t-85-35q-50 0-85 35t-35 85v80h120q33 0 56.5 23.5T800-560v400q0 33-23.5 56.5T720-80H240Z", { viewBox: MS });

/** `logout` */
export const Logout = icon("Logout", "M200-120q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h280v80H200v560h280v80H200Zm440-160-55-58 102-102H360v-80h327L585-622l55-58 200 200-200 200Z", { viewBox: MS });

/** `machine_image` */
export function MachineImage(props: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="currentColor"
      {...props}
    >
      <g><rect fill="none" height="24" width="24" /><path d="M10,10H8V7h2V10z M16,13h-2v3h2V13z M13,13H8v3h5V13z M16,7h-5v3h5V7z M18,5H6v13l12,0 M18,2c1.1,0,2,0.9,2,2v16 c0,1.1-0.9,2-2,2h-2l-1-1H9l-1,1H6c-1.1,0-2-0.9-2-2V4c0-1.1,0.9-2,2-2H18L18,2z" /></g>
    </svg>
  );
}
MachineImage.displayName = "MachineImage";

/** `manage_accounts` */
export const ManageAccounts = icon("ManageAccounts", "M10 12C8.9 12 7.95833 11.6083 7.175 10.825C6.39167 10.0417 6 9.1 6 8C6 6.9 6.39167 5.95833 7.175 5.175C7.95833 4.39167 8.9 4 10 4C11.1 4 12.0417 4.39167 12.825 5.175C13.6083 5.95833 14 6.9 14 8C14 9.1 13.6083 10.0417 12.825 10.825C12.0417 11.6083 11.1 12 10 12ZM2 20V17.2C2 16.65 2.14167 16.1333 2.425 15.65C2.70833 15.1667 3.1 14.8 3.6 14.55C4.45 14.1167 5.40833 13.75 6.475 13.45C7.54167 13.15 8.71667 13 10 13C10.1333 13 10.25 13 10.35 13C10.45 13 10.55 13.0167 10.65 13.05C10.5167 13.35 10.4 13.6667 10.3 14C10.2167 14.3167 10.15 14.65 10.1 15H10C8.81667 15 7.75 15.15 6.8 15.45C5.86667 15.75 5.1 16.05 4.5 16.35C4.35 16.4333 4.225 16.55 4.125 16.7C4.04167 16.85 4 17.0167 4 17.2V18H10.3C10.4 18.35 10.5333 18.7 10.7 19.05C10.8667 19.3833 11.05 19.7 11.25 20H2ZM16 21L15.7 19.5C15.5 19.4167 15.3083 19.3333 15.125 19.25C14.9583 19.15 14.7833 19.0333 14.6 18.9L13.15 19.35L12.15 17.65L13.3 16.65C13.2667 16.4167 13.25 16.2 13.25 16C13.25 15.8 13.2667 15.5833 13.3 15.35L12.15 14.35L13.15 12.65L14.6 13.1C14.7833 12.9667 14.9583 12.8583 15.125 12.775C15.3083 12.675 15.5 12.5833 15.7 12.5L16 11H18L18.3 12.5C18.5 12.5833 18.6833 12.675 18.85 12.775C19.0333 12.875 19.2167 13 19.4 13.15L20.85 12.65L21.85 14.4L20.7 15.4C20.7333 15.6 20.75 15.8083 20.75 16.025C20.75 16.2417 20.7333 16.45 20.7 16.65L21.85 17.65L20.85 19.35L19.4 18.9C19.2167 19.0333 19.0333 19.15 18.85 19.25C18.6833 19.3333 18.5 19.4167 18.3 19.5L18 21H16ZM17 18C17.55 18 18.0167 17.8083 18.4 17.425C18.8 17.025 19 16.55 19 16C19 15.45 18.8 14.9833 18.4 14.6C18.0167 14.2 17.55 14 17 14C16.45 14 15.975 14.2 15.575 14.6C15.1917 14.9833 15 15.45 15 16C15 16.55 15.1917 17.025 15.575 17.425C15.975 17.8083 16.45 18 17 18ZM10 10C10.55 10 11.0167 9.80833 11.4 9.425C11.8 9.025 12 8.55 12 8C12 7.45 11.8 6.98333 11.4 6.6C11.0167 6.2 10.55 6 10 6C9.45 6 8.975 6.2 8.575 6.6C8.19167 6.98333 8 7.45 8 8C8 8.55 8.19167 9.025 8.575 9.425C8.975 9.80833 9.45 10 10 10Z");

/** `manage_search` */
export function ManageSearch(props: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="currentColor"
      {...props}
    >
      <g clipPath="url(#manage_search-clip0_1_106)"><path d="M2 19V17H12V19H2ZM2 14V12H7V14H2ZM2 9V7H7V9H2ZM20.6 19L16.75 15.15C16.35 15.4333 15.9083 15.65 15.425 15.8C14.9583 15.9333 14.4833 16 14 16C12.6167 16 11.4333 15.5167 10.45 14.55C9.48333 13.5667 9 12.3833 9 11C9 9.61667 9.48333 8.44167 10.45 7.475C11.4333 6.49167 12.6167 6 14 6C15.3833 6 16.5583 6.49167 17.525 7.475C18.5083 8.44167 19 9.61667 19 11C19 11.4833 18.925 11.9667 18.775 12.45C18.6417 12.9167 18.4333 13.35 18.15 13.75L22 17.6L20.6 19ZM14 14C14.8333 14 15.5417 13.7083 16.125 13.125C16.7083 12.5417 17 11.8333 17 11C17 10.1667 16.7083 9.45833 16.125 8.875C15.5417 8.29167 14.8333 8 14 8C13.1667 8 12.4583 8.29167 11.875 8.875C11.2917 9.45833 11 10.1667 11 11C11 11.8333 11.2917 12.5417 11.875 13.125C12.4583 13.7083 13.1667 14 14 14Z" /></g><defs><clipPath id="manage_search-clip0_1_106"><rect width="24" height="24" fill="white" /></clipPath></defs>
    </svg>
  );
}
ManageSearch.displayName = "ManageSearch";

/** `management_project` */
export function ManagementProject(props: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="currentColor"
      {...props}
    >
      <path d="M12.58 13.85c.31-1.34 1.5-2.35 2.94-2.35h6.17l-2.32-4.05h-5.23l-2.61 4.59 1.06 1.8zm-7.97-.94L2 17.5 4.61 22h5.23l2.61-4.5-2.63-4.59H4.61zm5.21-1.82l2.63-4.5L9.82 2H4.61L2 6.59l2.61 4.5h5.21z" /><path d="M22.75 13h-7.5c-.69 0-1.25.56-1.25 1.25v7.5c0 .69.56 1.25 1.25 1.25h7.5c.69 0 1.25-.56 1.25-1.25v-7.5c0-.69-.56-1.25-1.25-1.25zm-5.89 8.57a1.43 1.43 0 110-2.86 1.43 1.43 0 010 2.86zm0-4.28a1.43 1.43 0 110-2.86 1.43 1.43 0 010 2.86zm4.28 4.28a1.43 1.43 0 110-2.86 1.43 1.43 0 010 2.86zm0-4.28a1.43 1.43 0 110-2.86 1.43 1.43 0 010 2.86z" />
    </svg>
  );
}
ManagementProject.displayName = "ManagementProject";

/** `match_case` */
export const MatchCase = icon("MatchCase", "M3.55078 17.2751L7.60828 6.4751H9.55078L13.6008 17.2751H11.7333L10.7748 14.5251H6.40078L5.41803 17.2751H3.55078ZM6.95078 12.9751H10.2008L8.62428 8.5001H8.52578L6.95078 12.9751ZM16.5758 17.5251C15.7258 17.5251 15.0633 17.3043 14.5883 16.8626C14.1133 16.4209 13.8758 15.8084 13.8758 15.0251C13.8758 14.2918 14.1508 13.7043 14.7008 13.2626C15.2508 12.8209 15.9758 12.6001 16.8758 12.6001C17.2091 12.6001 17.5508 12.6334 17.9008 12.7001C18.2508 12.7668 18.5841 12.8584 18.9008 12.9751V12.7501C18.9008 12.2519 18.7334 11.8482 18.3988 11.5388C18.0641 11.2297 17.6192 11.0751 17.064 11.0751C16.6885 11.0751 16.3508 11.1501 16.0508 11.3001C15.7508 11.4501 15.4758 11.6834 15.2258 12.0001L14.1008 11.1251C14.4341 10.6751 14.8633 10.3293 15.3883 10.0876C15.9133 9.84593 16.4924 9.7251 17.1258 9.7251C18.1924 9.7251 19.0133 9.9876 19.5883 10.5126C20.1633 11.0376 20.4508 11.7751 20.4508 12.7251V17.2751H18.9008V16.3751H18.8258C18.5424 16.7751 18.2174 17.0668 17.8508 17.2501C17.4841 17.4334 17.0591 17.5251 16.5758 17.5251ZM16.8398 16.2001C17.4123 16.2001 17.8989 16.0043 18.2995 15.6126C18.7004 15.2209 18.9008 14.7518 18.9008 14.2051C18.6674 14.0684 18.4049 13.9668 18.1133 13.9001C17.8216 13.8334 17.5112 13.8001 17.182 13.8001C16.6279 13.8001 16.2091 13.9043 15.9258 14.1126C15.6424 14.3209 15.5008 14.6257 15.5008 15.0268C15.5008 15.3757 15.6258 15.6584 15.8758 15.8751C16.1258 16.0918 16.4471 16.2001 16.8398 16.2001Z");

/** `meet` */
export function Meet(props: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="currentColor"
      {...props}
    >
      <rect fill="none" height="24" width="24" /><path d="M7,4L2,9v9c0,1.1,0.9,2,2,2h12c1.1,0,2-0.9,2-2v-4.5l4,4v-11l-4,4V6c0-1.1-0.9-2-2-2H7z M16,18H4v-8l4-4h8V18z" />
    </svg>
  );
}
Meet.displayName = "Meet";

/** `memory` */
export const Memory = icon("Memory", "M360-360v-240h240v240H360Zm80-80h80v-80h-80v80Zm-80 320v-80h-80q-33 0-56.5-23.5T200-280v-80h-80v-80h80v-80h-80v-80h80v-80q0-33 23.5-56.5T280-760h80v-80h80v80h80v-80h80v80h80q33 0 56.5 23.5T760-680v80h80v80h-80v80h80v80h-80v80q0 33-23.5 56.5T680-200h-80v80h-80v-80h-80v80h-80Zm320-160v-400H280v400h400ZM480-480Z", { viewBox: MS });

/** `merge` */
export function Merge(props: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="currentColor"
      {...props}
    >
      <g><rect fill="none" height="24" width="24" /></g><g><path d="M6.41,21L5,19.59l4.83-4.83c0.75-0.75,1.17-1.77,1.17-2.83v-5.1L9.41,8.41L8,7l4-4l4,4l-1.41,1.41L13,6.83v5.1 c0,1.06,0.42,2.08,1.17,2.83L19,19.59L17.59,21L12,15.41L6.41,21z" /></g>
    </svg>
  );
}
Merge.displayName = "Merge";

/** `mic` */
export const Mic = icon("Mic", "M14.99 11L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3s2.99-1.34 2.99-3zm2.31 0c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z", { evenodd: true });

/** `mic_off` */
export const MicOff = icon("MicOff", "M11 5c0-.55.45-1 1-1s1 .45 1 1v5.17l1.82 1.82c.11-.31.18-.64.18-.99V5c0-1.66-1.34-3-3-3S9 3.34 9 5v1.17l2 2V5zM2.81 2.81L1.39 4.22l11.65 11.65c-.33.08-.68.13-1.04.13-2.76 0-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c.57-.08 1.12-.24 1.64-.46l5.14 5.14 1.41-1.41L2.81 2.81zM19 11h-2c0 .91-.26 1.75-.69 2.48l1.46 1.46A6.921 6.921 0 0019 11z");

/** `minimize` */
export const Minimize = icon("Minimize", "M6 19h12v2H6v-2z");

/** `model_context_protocol` */
export function ModelContextProtocol(props: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 180 180"
      width="24"
      height="24"
      fill="currentColor"
      {...props}
    >
      <g clipPath="url(#model_context_protocol-clip0_19_13)" fill="none"><path d="M18 84.8528L85.8822 16.9706C95.2548 7.59798 110.451 7.59798 119.823 16.9706V16.9706C129.196 26.3431 129.196 41.5391 119.823 50.9117L68.5581 102.177" stroke="currentColor" strokeWidth="12" strokeLinecap="round" /><path d="M69.2652 101.47L119.823 50.9117C129.196 41.5391 144.392 41.5391 153.765 50.9117L154.118 51.2652C163.491 60.6378 163.491 75.8338 154.118 85.2063L92.7248 146.6C89.6006 149.724 89.6006 154.789 92.7248 157.913L105.331 170.52" stroke="currentColor" strokeWidth="12" strokeLinecap="round" /><path d="M102.853 33.9411L52.6482 84.1457C43.2756 93.5183 43.2756 108.714 52.6482 118.087V118.087C62.0208 127.459 77.2167 127.459 86.5893 118.087L136.794 67.8822" stroke="currentColor" strokeWidth="12" strokeLinecap="round" /></g><defs><clipPath id="model_context_protocol-clip0_19_13"><rect width="180" height="180" /></clipPath></defs>
    </svg>
  );
}
ModelContextProtocol.displayName = "ModelContextProtocol";

/** `monetization_on` */
export const MonetizationOn = icon("MonetizationOn", "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm2.79-7.7c.46.49.69 1.13.69 1.92 0 .65-.17 1.21-.5 1.66s-.77.79-1.29 1.01c-.22.1-.45.16-.68.21V19h-2v-1.91c-.46-.12-.89-.31-1.28-.6-.67-.5-1.14-1.2-1.41-2.1l1.78-.7c.14.53.38.96.71 1.27s.76.48 1.26.48c.42 0 .78-.1 1.08-.31s.45-.5.45-.88-.14-.68-.43-.92-.79-.49-1.52-.76l-.62-.22c-.64-.22-1.2-.57-1.65-1.03-.46-.46-.69-1.04-.69-1.74 0-.52.14-1 .41-1.43.27-.43.65-.77 1.15-1.01.24-.12.49-.2.76-.27V5h2v1.89c.41.1.77.27 1.07.51.52.42.88.92 1.08 1.49l-1.67.7c-.1-.31-.28-.57-.54-.78s-.6-.31-1-.31c-.41 0-.75.1-1.02.29-.27.19-.4.44-.4.75 0 .3.13.55.38.76s.67.41 1.25.61l.63.21c.87.3 1.53.69 2 1.18z");

/** `more` */
export const More = icon("More", "M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z", { evenodd: true });

/** `more_down` */
export const MoreDown = icon("MoreDown", "M200-200v-440h80v360h360v80H200Zm200-200v-440h80v360h360v80H400Z", { viewBox: MS });

/** `more_horizontal` */
export const MoreHorizontal = icon("MoreHorizontal", "M6 14c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm6-4c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm6 0c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z", { evenodd: true });

/** `move_down` */
export const MoveDown = icon("MoveDown", "M3 11c0 2.45 1.76 4.47 4.08 4.91l-1.49-1.49L7 13l4 4.01L7 21l-1.41-1.41 1.58-1.58v-.06A7.007 7.007 0 011 11c0-3.87 3.13-7 7-7h3v2H8c-2.76 0-5 2.24-5 5zm19 0V4h-9v7h9zm-2-2h-5V6h5v3zm-7 4h9v7h-9z");

/** `move_group` */
export const MoveGroup = icon("MoveGroup", "M320-240q-33 0-56.5-23.5T240-320v-80h80v80h480v-400H320v80h-80v-160q0-33 23.5-56.5T320-880h480q33 0 56.5 23.5T880-800v480q0 33-23.5 56.5T800-240H320zM160-80q-33 0-56.5-23.5T80-160v-560h80v560h560v80H160zm360-280l-56-56 63-64H240v-80h287l-63-64 56-56 160 160-160 160z", { viewBox: MS });

/** `news` */
export const News = icon("News", "M200-120q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h440l200 200v440q0 33-23.5 56.5T760-120H200Zm0-80h560v-400H600v-160H200v560Zm80-80h400v-80H280v80Zm0-320h200v-80H280v80Zm0 160h400v-80H280v80Zm-80-320v160-160 560-560Z", { viewBox: MS });

/** `newspaper` */
export const Newspaper = icon("Newspaper", "M160-120q-33 0-56.5-23.5T80-200v-640l67 67 66-67 67 67 67-67 66 67 67-67 67 67 66-67 67 67 67-67 66 67 67-67v640q0 33-23.5 56.5T800-120H160Zm0-80h280v-240H160v240Zm360 0h280v-80H520v80Zm0-160h280v-80H520v80ZM160-520h640v-120H160v120Z", { viewBox: MS });

/** `next` */
export const Next = icon("Next", "M8 6.5l5.5 5.5L8 17.5 9.5 19l7-7-7-7L8 6.5z", { evenodd: true });

/** `not_started` */
export function NotStarted(props: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="currentColor"
      {...props}
    >
      <g><rect fill="none" height="24" width="24" /><path d="M12,4c4.41,0,8,3.59,8,8s-3.59,8-8,8s-8-3.59-8-8S7.59,4,12,4 M12,2C6.48,2,2,6.48,2,12c0,5.52,4.48,10,10,10 s10-4.48,10-10C22,6.48,17.52,2,12,2L12,2z M11,8H9v8h2V8z M17,12l-5-4v8L17,12z" /></g>
    </svg>
  );
}
NotStarted.displayName = "NotStarted";

/** `notes` */
export function Notes(props: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="currentColor"
      {...props}
    >
      <path d="M0 0h24v24H0V0z" fill="none" /><path d="M21 13H3v-2h18v2zM3 18h12v-2H3v2zM21 6H3v2h18V6z" />
    </svg>
  );
}
Notes.displayName = "Notes";

/** `notification_do_not_disturb` */
export const NotificationDoNotDisturb = icon("NotificationDoNotDisturb", "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-5-9h10v2H7z");

/** `numbers` */
export function Numbers(props: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="currentColor"
      {...props}
    >
      <g clipPath="url(#numbers-clip0_1_38)"><path d="M6 20L7 16H3L3.5 14H7.5L8.5 10H4.5L5 8H9L10 4H12L11 8H15L16 4H18L17 8H21L20.5 10H16.5L15.5 14H19.5L19 16H15L14 20H12L13 16H9L8 20H6ZM9.5 14H13.5L14.5 10H10.5L9.5 14Z" /></g><defs><clipPath id="numbers-clip0_1_38"><rect width="24" height="24" fill="white" /></clipPath></defs>
    </svg>
  );
}
Numbers.displayName = "Numbers";

/** `one_two_four` */
export function OneTwoFour(props: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="currentColor"
      {...props}
    >
      <g clipPath="url(#one_two_four-clip0_1_126)"><path d="M5.5 15V10.5H4V9H7V15H5.5ZM9 15V12.5C9 12.2167 9.09167 11.9833 9.275 11.8C9.475 11.6 9.71667 11.5 10 11.5H12V10.5H9V9H12.5C12.7833 9 13.0167 9.1 13.2 9.3C13.4 9.48333 13.5 9.71667 13.5 10V11.5C13.5 11.7833 13.4 12.025 13.2 12.225C13.0167 12.4083 12.7833 12.5 12.5 12.5H10.5V13.5H13.5V15H9ZM15 15V13.5H18V12.5H16V11.5H18V10.5H15V9H18.5C18.7833 9 19.0167 9.1 19.2 9.3C19.4 9.48333 19.5 9.71667 19.5 10V14C19.5 14.2833 19.4 14.525 19.2 14.725C19.0167 14.9083 18.7833 15 18.5 15H15Z" /></g><defs><clipPath id="one_two_four-clip0_1_126"><rect width="24" height="24" fill="white" /></clipPath></defs>
    </svg>
  );
}
OneTwoFour.displayName = "OneTwoFour";

/** `onetwothree` */
export const Onetwothree = icon("Onetwothree", "M7 15H5.5v-4.5H4V9h3v6zm6.5-1.5h-3v-1h2c.55 0 1-.45 1-1V10c0-.55-.45-1-1-1H9v1.5h3v1h-2c-.55 0-1 .45-1 1V15h4.5v-1.5zm6 .5v-4c0-.55-.45-1-1-1H15v1.5h3v1h-2v1h2v1h-3V15h3.5c.55 0 1-.45 1-1z");

/** `online_prediction` */
export function OnlinePrediction(props: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="currentColor"
      {...props}
    >
      <g><rect fill="none" height="24" width="24" /><path d="M15.5,11.5c0,2-2.5,3.5-2.5,5h-2c0-1.5-2.5-3-2.5-5C8.5,9.57,10.07,8,12,8S15.5,9.57,15.5,11.5z M13,17.5h-2V19h2V17.5z M22,12c0-2.76-1.12-5.26-2.93-7.07l-1.06,1.06C19.55,7.53,20.5,9.66,20.5,12c0,2.34-0.95,4.47-2.49,6.01l1.06,1.06 C20.88,17.26,22,14.76,22,12z M3.5,12c0-2.34,0.95-4.47,2.49-6.01L4.93,4.93C3.12,6.74,2,9.24,2,12c0,2.76,1.12,5.26,2.93,7.07 l1.06-1.06C4.45,16.47,3.5,14.34,3.5,12z M17.5,12c0,1.52-0.62,2.89-1.61,3.89l1.06,1.06C18.22,15.68,19,13.93,19,12 c0-1.93-0.78-3.68-2.05-4.95l-1.06,1.06C16.88,9.11,17.5,10.48,17.5,12z M7.05,16.95l1.06-1.06c-1-1-1.61-2.37-1.61-3.89 c0-1.52,0.62-2.89,1.61-3.89L7.05,7.05C5.78,8.32,5,10.07,5,12C5,13.93,5.78,15.68,7.05,16.95z" /></g>
    </svg>
  );
}
OnlinePrediction.displayName = "OnlinePrediction";

/** `orders` */
export const Orders = icon("Orders", "M160-160v-516L82-846l72-34 94 202h464l94-202 72 34-78 170v516H160Zm240-280h160q17 0 28.5-11.5T600-480q0-17-11.5-28.5T560-520H400q-17 0-28.5 11.5T360-480q0 17 11.5 28.5T400-440ZM240-240h480v-358H240v358Zm0 0v-358 358Z", { viewBox: MS });

/** `outage_circle_outline` */
export const OutageCircleOutline = icon("OutageCircleOutline", "M12 2.02c-5.51 0-9.98 4.47-9.98 9.98s4.47 9.98 9.98 9.98 9.98-4.47 9.98-9.98S17.51 2.02 12 2.02zm0 17.96c-4.4 0-7.98-3.58-7.98-7.98S7.6 4.02 12 4.02 19.98 7.6 19.98 12 16.4 19.98 12 19.98zM12.75 5l-4.5 8.5h3.14V19l4.36-8.5h-3z");

/** `panel_bottom_close` */
export const PanelBottomClose = icon("PanelBottomClose", "M19 20H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h4v2H5v10h14V6h-4V4h4c1.1 0 2 .9 2 2v12a2 2 0 0 1-2 2zm-7-6l-4-4h3V4h2v6h3l-4 4z", { evenodd: true });

/** `panel_bottom_open` */
export const PanelBottomOpen = icon("PanelBottomOpen", "M5 20a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h4L7 6H5v10h14V6h-2l-2-2h4c1.1 0 2 .9 2 2v12a2 2 0 0 1-2 2H5zm7-16L8 8h3v6h2V8h3l-4-4z", { evenodd: true });

/** `panel_left_close` */
export const PanelLeftClose = icon("PanelLeftClose", "M4 19V5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v4h-2V5H8v14h10v-4h2v4c0 1.1-.9 2-2 2H6a2 2 0 0 1-2-2zm6-7l4-4v3h6v2h-6v3l-4-4z", { evenodd: true });

/** `panel_left_open` */
export const PanelLeftOpen = icon("PanelLeftOpen", "M4 5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v4l-2-2V5H8v14h10v-2l2-2v4c0 1.1-.9 2-2 2H6a2 2 0 0 1-2-2V5zm16 7l-4-4v3h-6v2h6v3l4-4z", { evenodd: true });

/** `panel_right_close` */
export const PanelRightClose = icon("PanelRightClose", "M20 19V5a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v4h2V5h10v14H6v-4H4v4c0 1.1.9 2 2 2h12a2 2 0 0 0 2-2zm-6-7l-4-4v3H4v2h6v3l4-4z", { evenodd: true });

/** `panel_right_open` */
export const PanelRightOpen = icon("PanelRightOpen", "M20 5a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v4l2-2V5h10v14H6v-2l-2-2v4c0 1.1.9 2 2 2h12a2 2 0 0 0 2-2V5zM4 12l4-4v3h6v2H8v3l-4-4z", { evenodd: true });

/** `panel_top_close` */
export const PanelTopClose = icon("PanelTopClose", "M19 4H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4v-2H5V8h14v10h-4v2h4c1.1 0 2-.9 2-2V6a2 2 0 0 0-2-2zm-7 6l-4 4h3v6h2v-6h3l-4-4z", { evenodd: true });

/** `panel_top_open` */
export const PanelTopOpen = icon("PanelTopOpen", "M5 4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4l-2-2H5V8h14v10h-2l-2 2h4c1.1 0 2-.9 2-2V6a2 2 0 0 0-2-2H5zm7 16l-4-4h3v-6h2v6h3l-4 4z", { evenodd: true });

/** `patient_list` */
export function PatientList(props: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="currentColor"
      {...props}
    >
      <g clipPath="url(#patient_list-clip0_1_130)"><path d="M16 14C15.1667 14 14.4583 13.7083 13.875 13.125C13.2917 12.5417 13 11.8333 13 11C13 10.1667 13.2917 9.45833 13.875 8.875C14.4583 8.29167 15.1667 8 16 8C16.8333 8 17.5417 8.29167 18.125 8.875C18.7083 9.45833 19 10.1667 19 11C19 11.8333 18.7083 12.5417 18.125 13.125C17.5417 13.7083 16.8333 14 16 14ZM10 20V18.1C10 17.75 10.0833 17.4167 10.25 17.1C10.4167 16.7833 10.65 16.5333 10.95 16.35C11.7 15.9 12.4917 15.5667 13.325 15.35C14.175 15.1167 15.0667 15 16 15C16.9333 15 17.8167 15.1167 18.65 15.35C19.5 15.5667 20.3 15.9 21.05 16.35C21.35 16.5333 21.5833 16.7833 21.75 17.1C21.9167 17.4167 22 17.75 22 18.1V20H10ZM12.15 18H19.85C19.2667 17.6667 18.65 17.4167 18 17.25C17.35 17.0833 16.6833 17 16 17C15.3167 17 14.65 17.0833 14 17.25C13.35 17.4167 12.7333 17.6667 12.15 18ZM16 12C16.2833 12 16.5167 11.9083 16.7 11.725C16.9 11.525 17 11.2833 17 11C17 10.7167 16.9 10.4833 16.7 10.3C16.5167 10.1 16.2833 10 16 10C15.7167 10 15.475 10.1 15.275 10.3C15.0917 10.4833 15 10.7167 15 11C15 11.2833 15.0917 11.525 15.275 11.725C15.475 11.9083 15.7167 12 16 12ZM3 14V12H11V14H3ZM3 6V4H15V6H3ZM11.1 10H3V8H12C11.7667 8.28333 11.575 8.59167 11.425 8.925C11.2917 9.25833 11.1833 9.61667 11.1 10Z" /></g><defs><clipPath id="patient_list-clip0_1_130"><rect width="24" height="24" fill="white" /></clipPath></defs>
    </svg>
  );
}
PatientList.displayName = "PatientList";

/** `pause` */
export const Pause = icon("Pause", "M6 19h4V5H6v14zm8-14v14h4V5h-4z", { evenodd: true });

/** `pen_spark` */
export const PenSpark = icon("PenSpark", "M6.5 12c0-3.04 2.46-5.5 5.5-5.5-3.04 0-5.5-2.46-5.5-5.5 0 3.04-2.46 5.5-5.5 5.5 3.04 0 5.5 2.46 5.5 5.5zM6 19h1.4l9.81-9.77-1.43-1.43L6 17.6V19zm-2 2v-4.25L17.21 3.58c.79-.79 2.08-.76 2.82 0L21.43 5c.76.76.76 2.04 0 2.8L8.25 21H4zM17.21 9.23L15.78 7.8");

/** `pending` */
export function Pending(props: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      {...props}
    >
      <path d="M2 12c0 5.52 4.48 10 10 10s10-4.48 10-10S17.52 2 12 2 2 6.48 2 12zm4 2c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm6-4c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm6 0c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" fill="var(--cm-sys-color-on-surface-variant-low)" fillRule="evenodd" />
    </svg>
  );
}
Pending.displayName = "Pending";

/** `pending_outline` */
export function PendingOutline(props: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="currentColor"
      {...props}
    >
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8z" /><circle cx="7" cy="12" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="17" cy="12" r="1.5" />
    </svg>
  );
}
PendingOutline.displayName = "PendingOutline";

/** `pentagon` */
export function Pentagon(props: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="currentColor"
      {...props}
    >
      <g clipPath="url(#pentagon-clip0_1_102)"><path d="M7.45 19H16.55L19.625 9.775L12 4.45L4.375 9.775L7.45 19ZM6 21L2 9L12 2L22 9L18 21H6Z" /></g><defs><clipPath id="pentagon-clip0_1_102"><rect width="24" height="24" fill="white" /></clipPath></defs>
    </svg>
  );
}
Pentagon.displayName = "Pentagon";

/** `person` */
export const Person = icon("Person", "M12 12a4 4 0 0 0 4-4 4 4 0 0 0-4-4 4 4 0 0 0-4 4 4 4 0 0 0 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z", { evenodd: true });

/** `person_add` */
export const PersonAdd = icon("PersonAdd", "M720-400v-120H600v-80h120v-120h80v120h120v80H800v120h-80Zm-360-80q-66 0-113-47t-47-113q0-66 47-113t113-47q66 0 113 47t47 113q0 66-47 113t-113 47ZM40-160v-112q0-34 17.5-62.5T104-378q62-31 126-46.5T360-440q66 0 130 15.5T616-378q29 15 46.5 43.5T680-272v112H40Zm80-80h480v-32q0-11-5.5-20T580-306q-54-27-109-40.5T360-360q-56 0-111 13.5T140-306q-9 5-14.5 14t-5.5 20v32Zm240-320q33 0 56.5-23.5T440-640q0-33-23.5-56.5T360-720q-33 0-56.5 23.5T280-640q0 33 23.5 56.5T360-560Zm0-80Zm0 400Z", { viewBox: MS });

/** `person_remove` */
export const PersonRemove = icon("PersonRemove", "M640-520v-80h240v80H640Zm-280 40q-66 0-113-47t-47-113q0-66 47-113t113-47q66 0 113 47t47 113q0 66-47 113t-113 47ZM40-160v-112q0-34 17.5-62.5T104-378q62-31 126-46.5T360-440q66 0 130 15.5T616-378q29 15 46.5 43.5T680-272v112H40Zm80-80h480v-32q0-11-5.5-20T580-306q-54-27-109-40.5T360-360q-56 0-111 13.5T140-306q-9 5-14.5 14t-5.5 20v32Zm240-320q33 0 56.5-23.5T440-640q0-33-23.5-56.5T360-720q-33 0-56.5 23.5T280-640q0 33 23.5 56.5T360-560Zm0-80Zm0 400Z", { viewBox: MS });

/** `personal_video` */
export const PersonalVideo = icon("PersonalVideo", "M21 3H3c-1.11 0-2 .89-2 2v12a2 2 0 0 0 2 2h5v2h8v-2h5c1.1 0 1.99-.9 1.99-2L23 5a2 2 0 0 0-2-2zm0 14H3V5h18v12z");

/** `personalized_recommendations` */
export const PersonalizedRecommendations = icon("PersonalizedRecommendations", "M13.05 22.45q-.225.225-.5.338-.275.112-.55.112t-.562-.112q-.288-.113-.513-.338l-9.375-9.4q-.225-.225-.325-.5t-.1-.55q0-.275.1-.55t.325-.5l9.375-9.4q.225-.225.513-.338.287-.112.562-.112.275 0 .55.112.275.113.5.338l9.4 9.4q.225.225.325.5t.1.55q0 .275-.1.55t-.325.5zM12 18l1.85-4.15L18 12l-4.15-1.85L12 6l-1.85 4.15L6 12l4.15 1.825z");

/** `personalmode` */
export const Personalmode = icon("Personalmode", "M19.08 4.92c-3.92-3.9-10.26-3.89-14.17.01-3.88 3.92-3.88 10.24.01 14.15a10.047 10.047 0 0 0 14.16 0c3.89-3.92 3.9-10.25 0-14.16zM6.34 17.66c.86-.8 3.22-2.16 5.67-2.16 2.45 0 4.64 1.24 5.65 2.16-3.13 3.11-8.18 3.11-11.32 0zm12.59-1.63a10.734 10.734 0 0 0-13.82 0c-1.77-3.07-1.38-7.05 1.22-9.69 3.13-3.12 8.21-3.13 11.34-.01a8.05 8.05 0 0 1 1.26 9.7zM15 8.99c0 1.66-1.34 3-3 3s-3-1.34-3-3 1.34-3 3-3 3 1.35 3 3z", { evenodd: true });

/** `photo` */
export const Photo = icon("Photo", "M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z");

/** `photo_camera` */
export function PhotoCamera(props: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="currentColor"
      {...props}
    >
      <g clipPath="url(#photo_camera-clip0_1_98)"><path d="M4 21C3.45 21 2.975 20.8083 2.575 20.425C2.19167 20.025 2 19.55 2 19V7C2 6.45 2.19167 5.98333 2.575 5.6C2.975 5.2 3.45 5 4 5H7.15L9 3H15L16.85 5H20C20.55 5 21.0167 5.2 21.4 5.6C21.8 5.98333 22 6.45 22 7V19C22 19.55 21.8 20.025 21.4 20.425C21.0167 20.8083 20.55 21 20 21H4ZM4 19H20V7H4V19ZM4 19V7V19ZM12 17.5C13.25 17.5 14.3083 17.0667 15.175 16.2C16.0583 15.3167 16.5 14.25 16.5 13C16.5 11.75 16.0583 10.6917 15.175 9.825C14.3083 8.94167 13.25 8.5 12 8.5C10.75 8.5 9.68333 8.94167 8.8 9.825C7.93333 10.6917 7.5 11.75 7.5 13C7.5 14.25 7.93333 15.3167 8.8 16.2C9.68333 17.0667 10.75 17.5 12 17.5Z" /></g><defs><clipPath id="photo_camera-clip0_1_98"><rect width="24" height="24" fill="white" /></clipPath></defs>
    </svg>
  );
}
PhotoCamera.displayName = "PhotoCamera";

/** `pin` */
export function Pin(props: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="currentColor"
      {...props}
    >
      <g clipPath="url(#pin-clip0_1_94)"><path d="M4 20C3.45 20 2.975 19.8083 2.575 19.425C2.19167 19.025 2 18.55 2 18V6C2 5.45 2.19167 4.98333 2.575 4.6C2.975 4.2 3.45 4 4 4H20C20.55 4 21.0167 4.2 21.4 4.6C21.8 4.98333 22 5.45 22 6V18C22 18.55 21.8 19.025 21.4 19.425C21.0167 19.8083 20.55 20 20 20H4ZM6.5 15H7.65V9H6.75L5 10.25L5.6 11.15L6.5 10.5V15ZM9.6 15H13.5V14H11.15L11.1 13.95C11.45 13.6167 11.7333 13.3333 11.95 13.1C12.1833 12.8667 12.3667 12.6833 12.5 12.55C12.8 12.25 13.025 11.95 13.175 11.65C13.325 11.35 13.4 11.0333 13.4 10.7C13.4 10.2167 13.2167 9.81667 12.85 9.5C12.4833 9.16667 12.0167 9 11.45 9C11.0167 9 10.625 9.125 10.275 9.375C9.925 9.625 9.68333 9.95 9.55 10.35L10.55 10.75C10.6333 10.5333 10.75 10.3667 10.9 10.25C11.0667 10.1167 11.25 10.05 11.45 10.05C11.7 10.05 11.9 10.1167 12.05 10.25C12.2167 10.3833 12.3 10.55 12.3 10.75C12.3 10.9333 12.2667 11.1083 12.2 11.275C12.1333 11.425 11.9833 11.6167 11.75 11.85C11.5667 12.0333 11.3 12.3 10.95 12.65C10.6 13 10.15 13.45 9.6 14V15ZM17 15C17.6 15 18.0833 14.8333 18.45 14.5C18.8167 14.1667 19 13.7333 19 13.2C19 12.9 18.9167 12.6333 18.75 12.4C18.5833 12.1667 18.35 11.9833 18.05 11.85V11.8C18.2833 11.6667 18.4667 11.5 18.6 11.3C18.7333 11.0833 18.8 10.8333 18.8 10.55C18.8 10.1 18.625 9.73333 18.275 9.45C17.925 9.15 17.4833 9 16.95 9C16.5333 9 16.1417 9.125 15.775 9.375C15.425 9.60833 15.2 9.9 15.1 10.25L16.1 10.65C16.1667 10.45 16.275 10.2917 16.425 10.175C16.575 10.0583 16.75 10 16.95 10C17.1667 10 17.3417 10.0667 17.475 10.2C17.625 10.3167 17.7 10.4667 17.7 10.65C17.7 10.8833 17.6167 11.0667 17.45 11.2C17.2833 11.3333 17.0667 11.4 16.8 11.4H16.35V12.4H16.85C17.1833 12.4 17.4417 12.4667 17.625 12.6C17.8083 12.7333 17.9 12.9167 17.9 13.15C17.9 13.3667 17.8083 13.5583 17.625 13.725C17.4417 13.875 17.2333 13.95 17 13.95C16.7167 13.95 16.5 13.8917 16.35 13.775C16.2 13.6417 16.0667 13.4167 15.95 13.1L14.95 13.5C15.0667 13.9833 15.3 14.3583 15.65 14.625C16.0167 14.875 16.4667 15 17 15ZM4 18H20V6H4V18ZM4 18V6V18Z" /></g><defs><clipPath id="pin-clip0_1_94"><rect width="24" height="24" fill="white" /></clipPath></defs>
    </svg>
  );
}
Pin.displayName = "Pin";

/** `pip` */
export const Pip = icon("Pip", "M80-520v-80h144L52-772l56-56 172 172v-144h80v280H80Zm80 360q-33 0-56.5-23.5T80-240v-200h80v200h320v80H160Zm640-280v-280H440v-80h360q33 0 56.5 23.5T880-720v280h-80ZM560-160v-200h320v200H560Z", { viewBox: MS });

/** `play` */
export const Play = icon("Play", "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z", { evenodd: true });

/** `play_arrow` */
export function PlayArrow(props: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="currentColor"
      {...props}
    >
      <path d="M0 0h24v24H0V0z" fill="none" /><path d="M10 8.64L15.27 12 10 15.36V8.64M8 5v14l11-7L8 5z" />
    </svg>
  );
}
PlayArrow.displayName = "PlayArrow";

/** `playlist_add` */
export const PlaylistAdd = icon("PlaylistAdd", "M14 10H2v2h12v-2zm0-4H2v2h12V6zm4 8v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zM2 16h8v-2H2v2z", { evenodd: true });

/** `playlist_add_check` */
export const PlaylistAddCheck = icon("PlaylistAddCheck", "M14 10H2v2h12v-2zm0-4H2v2h12V6zM2 16h8v-2H2v2zm19.5-4.5L23 13l-6.99 7-4.51-4.5L13 14l3.01 3 5.49-5.5z");

/** `playlist_play` */
export function PlaylistPlay(props: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="currentColor"
      {...props}
    >
      <g clipPath="url(#playlist_play-clip0_1_122)"><path d="M2.5 16V14H10.5V16H2.5ZM2.5 12V10H14.5V12H2.5ZM2.5 8V6H14.5V8H2.5ZM15.5 21V13L21.5 17L15.5 21Z" /></g><defs><clipPath id="playlist_play-clip0_1_122"><rect width="24" height="24" fill="white" /></clipPath></defs>
    </svg>
  );
}
PlaylistPlay.displayName = "PlaylistPlay";

/** `polyline` */
export const Polyline = icon("Polyline", "M600-80v-100L320-320H120v-240h172l108-124v-196h240v240H468L360-516v126l240 120v-50h240v240H600zM480-720h80v-80h-80v80zM200-400h80v-80h-80v80zm480 240h80v-80h-80v80zM520-760zM240-440zm480 240z", { viewBox: MS });

/** `preview` */
export function Preview(props: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="currentColor"
      {...props}
    >
      <g><rect fill="none" height="24" width="24" /><path d="M19,3H5C3.89,3,3,3.9,3,5v14c0,1.1,0.89,2,2,2h14c1.1,0,2-0.9,2-2V5C21,3.9,20.11,3,19,3z M19,19H5V7h14V19z M12,10.5 c1.84,0,3.48,0.96,4.34,2.5c-0.86,1.54-2.5,2.5-4.34,2.5S8.52,14.54,7.66,13C8.52,11.46,10.16,10.5,12,10.5 M12,9 c-2.73,0-5.06,1.66-6,4c0.94,2.34,3.27,4,6,4s5.06-1.66,6-4C17.06,10.66,14.73,9,12,9L12,9z M12,14.5c-0.83,0-1.5-0.67-1.5-1.5 s0.67-1.5,1.5-1.5s1.5,0.67,1.5,1.5S12.83,14.5,12,14.5z" /></g>
    </svg>
  );
}
Preview.displayName = "Preview";

/** `previous` */
export const Previous = icon("Previous", "M15.5 6.5L10 12l5.5 5.5L14 19l-7-7 7-7 1.5 1.5z", { evenodd: true });

/** `print` */
export const Print = icon("Print", "M19 8H5c-1.66 0-3 1.34-3 3v6h4v4h12v-4h4v-6c0-1.66-1.34-3-3-3zm-3 11H8v-5h8v5zm3-7c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm-1-9H6v4h12V3z");

/** `project_regulated` */
export function ProjectRegulated(props: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="currentColor"
      {...props}
    >
      <path d="M21.99 12.02l-2.63-4.57h-5.22l-2.62 4.6L14 16.27v-2.74l5.5-2.75 2.49 1.24zm-12.17-.93l2.63-4.5L9.82 2H4.61L2 6.59l2.61 4.5h5.21zm-5.21 1.82L2 17.5 4.61 22h5.23l2.61-4.5-2.63-4.59H4.61z" /><path d="M19.5 12.46l-4 2v2.55c0 1.27.38 2.42 1.14 3.46.76 1.04 1.71 1.7 2.86 1.99 1.15-.28 2.1-.95 2.86-1.99.76-1.04 1.14-2.2 1.14-3.46v-2.55l-4-2zm-.72 7l-2.02-2.02 1.05-1.07.97.97 2.43-2.38 1.05 1.05-3.48 3.45z" />
    </svg>
  );
}
ProjectRegulated.displayName = "ProjectRegulated";

/** `prompt_suggestion` */
export const PromptSuggestion = icon("PromptSuggestion", "m600-200-56-57 143-143H300q-75 0-127.5-52.5T120-580q0-75 52.5-127.5T300-760h20v80h-20q-42 0-71 29t-29 71q0 42 29 71t71 29h387L544-624l56-56 240 240-240 240Z", { viewBox: MS });

/** `publish` */
export function Publish(props: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="currentColor"
      {...props}
    >
      <path d="M0 0h24v24H0V0z" fill="none" /><path d="M20 9h-2V6H6v3H4V6c0-1.1.9-2 2-2h12c1.1 0 2 .9 2 2M8.41 14.41L11 11.83V20h2v-8.17l2.59 2.59L17 13l-5-5-5 5 1.41 1.41z" />
    </svg>
  );
}
Publish.displayName = "Publish";

/** `published_with_changes` */
export function PublishedWithChanges(props: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="currentColor"
      {...props}
    >
      <rect fill="none" height="24" width="24" /><path d="M18.6,19.5H21v2h-6v-6h2v2.73c1.83-1.47,3-3.71,3-6.23c0-4.07-3.06-7.44-7-7.93V2.05c5.05,0.5,9,4.76,9,9.95 C22,14.99,20.68,17.67,18.6,19.5z M4,12c0-2.52,1.17-4.77,3-6.23V8.5h2v-6H3v2h2.4C3.32,6.33,2,9.01,2,12c0,5.19,3.95,9.45,9,9.95 v-2.02C7.06,19.44,4,16.07,4,12z M16.24,8.11l-5.66,5.66l-2.83-2.83l-1.41,1.41l4.24,4.24l7.07-7.07L16.24,8.11z" />
    </svg>
  );
}
PublishedWithChanges.displayName = "PublishedWithChanges";

/** `query_shortcut` */
export const QueryShortcut = icon("QueryShortcut", "M540-347v-133h80v47q-13 27-33.5 49T540-347zm-100 27q-11 0-20.5-1t-19.5-3v-276h80v276q-10 2-19.5 3t-20.5 1zM265-80q-79 0-134.5-55.5T75-270q0-57 29.5-102t77.5-68H80v-80h240v240h-80v-97q-37 8-61 38t-24 69q0 46 32.5 78t77.5 32v80zm175-80q-11 0-20.5-.5T400-162v-81q10 2 19.5 2.5t20.5.5q117 0 198.5-81.5T720-520q0-117-81.5-198.5T440-800q-96 0-169 56t-99 144H89q27-121 124.5-200.5T440-880q75 0 140.5 28.5t114 77q48.5 48.5 77 114T800-520q0 64-21 121t-58 104l159 159-56 56-159-159q-47 37-104 58t-121 21z", { viewBox: MS });

/** `query_stats` */
export function QueryStats(props: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="currentColor"
      {...props}
    >
      <rect fill="none" height="24" width="24" /><g><path d="M19.88,18.47c0.44-0.7,0.7-1.51,0.7-2.39c0-2.49-2.01-4.5-4.5-4.5s-4.5,2.01-4.5,4.5s2.01,4.5,4.49,4.5 c0.88,0,1.7-0.26,2.39-0.7L21.58,23L23,21.58L19.88,18.47z M16.08,18.58c-1.38,0-2.5-1.12-2.5-2.5c0-1.38,1.12-2.5,2.5-2.5 s2.5,1.12,2.5,2.5C18.58,17.46,17.46,18.58,16.08,18.58z M15.72,10.08c-0.74,0.02-1.45,0.18-2.1,0.45l-0.55-0.83l-3.8,6.18 l-3.01-3.52l-3.63,5.81L1,17l5-8l3,3.5L13,6L15.72,10.08z M18.31,10.58c-0.64-0.28-1.33-0.45-2.05-0.49L21.37,2L23,3.18 L18.31,10.58z" /></g>
    </svg>
  );
}
QueryStats.displayName = "QueryStats";

/** `quick_reference` */
export const QuickReference = icon("QuickReference", "M5 4V9V10.025C5 10.0083 5 10 5 10C5 10 5 10.6333 5 11.9C5 13.15 5 14.6833 5 16.5C5 17.15 5 17.775 5 18.375C5 18.9583 5 19.5 5 20V4V9V4ZM7 14H10.5C10.65 13.6167 10.8333 13.2583 11.05 12.925C11.2667 12.5917 11.5167 12.2833 11.8 12H7V14ZM7 18H10.175C10.0917 17.6667 10.0333 17.3333 10 17C9.98333 16.6667 9.99167 16.3333 10.025 16H7V18ZM5 22C4.45 22 3.975 21.8083 3.575 21.425C3.19167 21.025 3 20.55 3 20V4C3 3.45 3.19167 2.98333 3.575 2.6C3.975 2.2 4.45 2 5 2H13L19 8V10.5C18.6833 10.3667 18.3583 10.2667 18.025 10.2C17.6917 10.1167 17.35 10.0583 17 10.025V9H12V4H5V20H11.025C11.2917 20.4 11.5917 20.775 11.925 21.125C12.2583 21.4583 12.625 21.75 13.025 22H5ZM16.5 19C17.2 19 17.7917 18.7583 18.275 18.275C18.7583 17.7917 19 17.2 19 16.5C19 15.8 18.7583 15.2083 18.275 14.725C17.7917 14.2417 17.2 14 16.5 14C15.8 14 15.2083 14.2417 14.725 14.725C14.2417 15.2083 14 15.8 14 16.5C14 17.2 14.2417 17.7917 14.725 18.275C15.2083 18.7583 15.8 19 16.5 19ZM21.6 23L18.9 20.3C18.55 20.5333 18.1667 20.7083 17.75 20.825C17.35 20.9417 16.9333 21 16.5 21C15.25 21 14.1833 20.5667 13.3 19.7C12.4333 18.8167 12 17.75 12 16.5C12 15.25 12.4333 14.1917 13.3 13.325C14.1833 12.4417 15.25 12 16.5 12C17.75 12 18.8083 12.4417 19.675 13.325C20.5583 14.1917 21 15.25 21 16.5C21 16.9333 20.9417 17.3583 20.825 17.775C20.7083 18.175 20.5333 18.55 20.3 18.9L23 21.6L21.6 23Z");

/** `radar` */
export const Radar = icon("Radar", "M480-80q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-80q56 0 105.5-17.5T676-227l-57-57q-29 21-64.5 32.5T480-240q-100 0-170-70t-70-170q0-100 70-170t170-70q100 0 170 70t70 170q0 39-12 75t-33 65l57 57q32-41 50-91t18-106q0-134-93-227t-227-93q-134 0-227 93t-93 227q0 134 93 227t227 93Zm0-160q22 0 42.5-5.5T561-342l-61-61q-5 2-10 2.5t-10 .5q-33 0-56.5-23.5T400-480q0-33 23.5-56.5T480-560q33 0 56.5 23.5T560-480q0 6-.5 11.5T557-458l60 60q11-18 17-38.5t6-43.5q0-66-47-113t-113-47q-66 0-113 47t-47 113q0 66 47 113t113 47Z", { viewBox: MS });

/** `rectangle` */
export function Rectangle(props: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="currentColor"
      {...props}
    >
      <g clipPath="url(#rectangle-clip0_1_70)"><path d="M2 20V4H22V20H2ZM4 18H20V6H4V18ZM4 18V6V18Z" /></g><defs><clipPath id="rectangle-clip0_1_70"><rect width="24" height="24" fill="white" /></clipPath></defs>
    </svg>
  );
}
Rectangle.displayName = "Rectangle";

/** `redo` */
export const Redo = icon("Redo", "M6 13.5C6 11.57 7.75 10 9.9 10h6.27l-2.59 2.59L15 14l5-5-5-5-1.41 1.41L16.17 8H9.9C6.65 8 4 10.47 4 13.5S6.65 19 9.9 19H17v-2H9.9C7.75 17 6 15.43 6 13.5z");

/** `refresh` */
export const Refresh = icon("Refresh", "M17.64 6.35A7.958 7.958 0 0 0 11.99 4C7.57 4 4 7.58 4 12s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08a5.99 5.99 0 0 1-5.65 4c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L12.99 11h7V4l-2.35 2.35z", { evenodd: true });

/** `remove` */
export const Remove = icon("Remove", "M19 13H5v-2h14v2z");

/** `remove_circle_outline` */
export const RemoveCircleOutline = icon("RemoveCircleOutline", "M7 11v2h10v-2H7zm5-9C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z", { evenodd: true });

/** `remove_moderator` */
export const RemoveModerator = icon("RemoveModerator", "M754-318l-60-62q12-32 19-66.5t7-69.5v-189l-240-90-146 55-62-62 208-78 320 120v244q0 51-11.5 101T754-318zm38 262L662-186q-38 39-84.5 65.5T480-80q-139-35-229.5-159.5T160-516v-172L56-792l56-56 736 736-56 56zM423-425zm91-135zm-34 396q35-11 67-31t59-47L240-608v92q0 121 68 220t172 132z", { viewBox: MS });

/** `repeat` */
export function Repeat(props: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="currentColor"
      {...props}
    >
      <g clipPath="url(#repeat-clip0_1_46)"><path d="M7 22L3 18L7 14L8.4 15.45L6.85 17H17V13H19V19H6.85L8.4 20.55L7 22ZM5 11V5H17.15L15.6 3.45L17 2L21 6L17 10L15.6 8.55L17.15 7H7V11H5Z" /></g><defs><clipPath id="repeat-clip0_1_46"><rect width="24" height="24" fill="white" /></clipPath></defs>
    </svg>
  );
}
Repeat.displayName = "Repeat";

/** `replay` */
export const Replay = icon("Replay", "M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z", { evenodd: true });

/** `resources` */
export const Resources = icon("Resources", "M6 21H3v-3h3v3zm0-5H3v-3h3v3zm0-5H3V8h3v3zm0-5H3V3h3v3zm5 15H8v-3h3v3zm0-5H8v-3h3v3zm0-5H8V8h3v3zm0-5H8V3h3v3zm5 15h-3v-3h3v3zm0-5h-3v-3h3v3zm0-5h-3V8h3v3zm0-5h-3V3h3v3zm5 15h-3v-3h3v3zm0-5h-3v-3h3v3zm0-5h-3V8h3v3zm0-5h-3V3h3v3z", { evenodd: true });

/** `restore_from_trash` */
export function RestoreFromTrash(props: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="currentColor"
      {...props}
    >
      <path d="M0 0h24v24H0V0z" fill="none" /><path d="M15 4V3H9v1H4v2h1v13c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2V6h1V4h-5zm2 15H7V6h10v13zm-6-7.17V16h2v-4.17l1.59 1.58L16 12l-4-4-4 4 1.41 1.41z" />
    </svg>
  );
}
RestoreFromTrash.displayName = "RestoreFromTrash";

/** `right` */
export const Right = icon("Right", "M8.295 16.59L9.705 18l6-6-6-6-1.41 1.41 4.58 4.59z", { evenodd: true });

/** `rocket_launch` */
export function RocketLaunch(props: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="currentColor"
      {...props}
    >
      <g><rect fill="none" height="24" width="24" /></g><g><g><path d="M6,15c-0.83,0-1.58,0.34-2.12,0.88C2.7,17.06,2,22,2,22s4.94-0.7,6.12-1.88C8.66,19.58,9,18.83,9,18C9,16.34,7.66,15,6,15 z M6.71,18.71c-0.28,0.28-2.17,0.76-2.17,0.76s0.47-1.88,0.76-2.17C5.47,17.11,5.72,17,6,17c0.55,0,1,0.45,1,1 C7,18.28,6.89,18.53,6.71,18.71z M17.42,13.65L17.42,13.65c6.36-6.36,4.24-11.31,4.24-11.31s-4.95-2.12-11.31,4.24l-2.49-0.5 C7.21,5.95,6.53,6.16,6.05,6.63L2,10.69l5,2.14L11.17,17l2.14,5l4.05-4.05c0.47-0.47,0.68-1.15,0.55-1.81L17.42,13.65z M7.41,10.83L5.5,10.01l1.97-1.97l1.44,0.29C8.34,9.16,7.83,10.03,7.41,10.83z M13.99,18.5l-0.82-1.91 c0.8-0.42,1.67-0.93,2.49-1.5l0.29,1.44L13.99,18.5z M16,12.24c-1.32,1.32-3.38,2.4-4.04,2.73l-2.93-2.93 c0.32-0.65,1.4-2.71,2.73-4.04c4.68-4.68,8.23-3.99,8.23-3.99S20.68,7.56,16,12.24z M15,11c1.1,0,2-0.9,2-2s-0.9-2-2-2s-2,0.9-2,2 S13.9,11,15,11z" /></g></g>
    </svg>
  );
}
RocketLaunch.displayName = "RocketLaunch";

/** `rolling_update` */
export const RollingUpdate = icon("RollingUpdate", "M21 10.12h-6.78l2.74-2.82c-2.73-2.7-7.15-2.8-9.88-.1a6.875 6.875 0 0 0 0 9.79 7.02 7.02 0 0 0 9.88 0C18.32 15.65 19 14.08 19 12.1h2c0 1.98-.88 4.55-2.64 6.29-3.51 3.48-9.21 3.48-12.72 0-3.5-3.47-3.53-9.11-.02-12.58a8.987 8.987 0 0 1 12.65 0L21 3v7.12zM12.5 8v4.25l3.5 2.08-.72 1.21L11 13V8h1.5z");

/** `save` */
export function Save(props: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="currentColor"
      {...props}
    >
      <g clipPath="url(#save-clip0_1_66)"><path d="M21 7V19C21 19.55 20.8 20.025 20.4 20.425C20.0167 20.8083 19.55 21 19 21H5C4.45 21 3.975 20.8083 3.575 20.425C3.19167 20.025 3 19.55 3 19V5C3 4.45 3.19167 3.98333 3.575 3.6C3.975 3.2 4.45 3 5 3H17L21 7ZM19 7.85L16.15 5H5V19H19V7.85ZM12 18C12.8333 18 13.5417 17.7083 14.125 17.125C14.7083 16.5417 15 15.8333 15 15C15 14.1667 14.7083 13.4583 14.125 12.875C13.5417 12.2917 12.8333 12 12 12C11.1667 12 10.4583 12.2917 9.875 12.875C9.29167 13.4583 9 14.1667 9 15C9 15.8333 9.29167 16.5417 9.875 17.125C10.4583 17.7083 11.1667 18 12 18ZM6 10H15V6H6V10ZM5 7.85V19V5V7.85Z" /></g><defs><clipPath id="save-clip0_1_66"><rect width="24" height="24" fill="white" /></clipPath></defs>
    </svg>
  );
}
Save.displayName = "Save";

/** `schedule` */
export function Schedule(props: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="currentColor"
      {...props}
    >
      <path d="M11.991 3C7.023 3 3 7.032 3 12s4.023 9 8.991 9C16.968 21 21 16.968 21 12s-4.032-9-9.009-9zM12 19.2A7.198 7.198 0 014.8 12c0-3.978 3.222-7.2 7.2-7.2s7.2 3.222 7.2 7.2-3.222 7.2-7.2 7.2z" /><path d="M12.45 7.5H11.1v5.4l4.725 2.835.675-1.107-4.05-2.403z" />
    </svg>
  );
}
Schedule.displayName = "Schedule";

/** `sdk` */
export const Sdk = icon("Sdk", "M4.5 21C4.08333 21 3.72917 20.8542 3.4375 20.5625C3.14583 20.2708 3 19.9167 3 19.5V6.125C3 5.95833 3.02917 5.80417 3.0875 5.6625C3.14583 5.52083 3.23333 5.38333 3.35 5.25L4.775 3.4C4.875 3.26667 4.99583 3.16667 5.1375 3.1C5.27917 3.03333 5.43333 3 5.6 3H18.425C18.5917 3 18.7458 3.03333 18.8875 3.1C19.0292 3.16667 19.15 3.26667 19.25 3.4L20.675 5.25C20.7583 5.38333 20.8333 5.52083 20.9 5.6625C20.9667 5.80417 21 5.95833 21 6.125V19.5C21 19.9167 20.8542 20.2708 20.5625 20.5625C20.2708 20.8542 19.9167 21 19.5 21H4.5ZM4.95 5.625H19.075L18.175 4.5H5.85L4.95 5.625ZM4.5 19.5H19.5V7.125H4.5V19.5ZM14.75 16.575L18 13.325L14.75 10.075L13.75 11.075L16 13.325L13.75 15.575L14.75 16.575ZM9.25 16.675L10.25 15.675L8 13.425L10.25 11.175L9.25 10.175L6 13.425L9.25 16.675Z", { evenodd: true });

/** `search` */
export const Search = icon("Search", "M15.5 14l4.99 5L19 20.49l-5-4.99v-.79l-.27-.28A6.47 6.47 0 0 1 9.5 16 6.5 6.5 0 1 1 16 9.5c0 1.61-.59 3.09-1.57 4.23l.28.27h.79zm-6 0c2.49 0 4.5-2.01 4.5-4.5S11.99 5 9.5 5 5 7.01 5 9.5 7.01 14 9.5 14z", { evenodd: true });

/** `search_check_spark` */
export const SearchCheckSpark = icon("SearchCheckSpark", "m358-488-97-96 42-42 54 54 100-100 42 42-141 142Zm382-72q-1 0-8-6-16-61-60.5-105.5T566-732q-2-1-6-8 0-2 6-8 61-16 105.5-60.5T732-914q1-2 8-6 2 0 8 6 17 61 61 105.5T914-748q2 0 6 8 0 1-6 8-61 16-105.5 60.5T748-566q0 2-8 6Zm44 440L532-372q-30 24-69 38t-83 14q-109 0-184.5-75.5T120-580q0-109 75.5-184.5T380-840q29 0 57 6t53 18l-10 87q-22-15-47-23t-53-8q-75 0-127.5 52.5T200-580q0 75 52.5 127.5T380-400q66 0 115.5-42.5T557-555l72 50q-7 22-17.5 41T588-428l252 252-56 56Z", { viewBox: MS });

/** `security_disabled` */
export const SecurityDisabled = icon("SecurityDisabled", "M12 3.19l7 3.11V11c0 1.49-.33 2.94-.91 4.26l1.49 1.49C20.48 15 21 13.03 21 11V5l-9-4-5.66 2.51 1.52 1.52L12 3.19zM2.1 2.1L.69 3.51 3 5.83V11c0 5.55 3.84 10.74 9 12 1.97-.48 3.75-1.54 5.2-2.97l3.29 3.29 1.41-1.41L2.1 2.1zM12 20.93C7.98 19.69 5 15.52 5 11V7.83l10.79 10.79c-1.08 1.06-2.37 1.87-3.79 2.31z");

/** `security_section_colored` */
export function SecuritySectionColored(props: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      {...props}
    >
      <path fillRule="evenodd" clipRule="evenodd" d="M3 5L12 1L21 5V11C21 16.55 17.16 21.74 12 23C6.84 21.74 3 16.55 3 11V5ZM19 11.99H12V3.19L5 6.3V12H12V20.93C15.72 19.78 18.47 16.11 19 11.99Z" fill="var(--cm-sys-color-primary-inverse)" /><path fillRule="evenodd" clipRule="evenodd" d="M12 12V1L21 5V11C21 16.55 17.16 21.74 12 23V20.93C15.72 19.78 18.47 16.11 19 11.99L12 12Z" fill="var(--cm-sys-color-status-activeassist)" /><path fillRule="evenodd" clipRule="evenodd" d="M20.9611 12H19.0054C19.0054 12 18.9645 12.2902 18.9111 12.5804L20.9611 12Z" fill="var(--cm-sys-color-primary)" /><path fillRule="evenodd" clipRule="evenodd" d="M3.04746 12H4.99463V11.4303L3.04746 12Z" fill="var(--cm-sys-color-primary)" />
    </svg>
  );
}
SecuritySectionColored.displayName = "SecuritySectionColored";

/** `select` */
export const Select = icon("Select", "M200-200v80q-33 0-56.5-23.5T120-200h80Zm-80-80v-80h80v80h-80Zm0-160v-80h80v80h-80Zm0-160v-80h80v80h-80Zm80-160h-80q0-33 23.5-56.5T200-840v80Zm80 640v-80h80v80h-80Zm0-640v-80h80v80h-80Zm160 640v-80h80v80h-80Zm0-640v-80h80v80h-80Zm160 640v-80h80v80h-80Zm0-640v-80h80v80h-80Zm160 560h80q0 33-23.5 56.5T760-120v-80Zm0-80v-80h80v80h-80Zm0-160v-80h80v80h-80Zm0-160v-80h80v80h-80Zm0-160v-80q33 0 56.5 23.5T840-760h-80Z", { viewBox: MS });

/** `send` */
export function Send(props: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="currentColor"
      {...props}
    >
      <path d="M0 0h24v24H0V0z" fill="none" /><path d="M2 3v18l20-9L2 3zm2 11l9-2-9-2V6.09L17.13 12 4 17.91V14z" />
    </svg>
  );
}
Send.displayName = "Send";

/** `send_spark` */
export const SendSpark = icon("SendSpark", "M120-120v-640l760 320-760 320Zm80-120 474-200-474-200v140l240 60-240 60v140Zm0 0v-400 400Zm540-320q-1 0-8-6-16-61-60.5-105.5T566-732q-2-1-6-8 0-2 6-8 61-16 105.5-60.5T732-914q1-2 8-6 2 0 8 6 17 61 61 105.5T914-748q2 0 6 8 0 1-6 8-61 16-105.5 60.5T748-566q0 2-8 6Z", { viewBox: MS });

/** `service_directory` */
export const ServiceDirectory = icon("ServiceDirectory", "M9 9h6l-1 1h-4L9 9zm11-2.5H4L3.25 8h17.5L20 6.5zM18 4H6l-.75 1.5h13.5L18 4zm4 5l-1 11H3L2 9h5.5l2 2h5l2-2H22zm-6.5 6.5c0-.41-.34-.75-.75-.75-.33 0-.6.21-.7.5H12.7a.722.722 0 0 0-.14-.24l.57-1.03c.04.01.08.02.12.02.41 0 .75-.34.75-.75s-.34-.75-.75-.75c-.33 0-.6.21-.7.5h-1.1c-.1-.29-.37-.5-.7-.5-.41 0-.75.34-.75.75s.34.75.75.75c.33 0 .6-.21.7-.5h1.1c.03.09.08.17.14.24l-.57 1.03a.502.502 0 0 0-.12-.02c-.33 0-.6.21-.7.5H9.95c-.1-.29-.37-.5-.7-.5-.41 0-.75.34-.75.75s.34.75.75.75c.33 0 .6-.21.7-.5h1.35c.03.09.08.17.14.24l-.57 1.03c-.04 0-.08-.02-.12-.02-.41 0-.75.34-.75.75s.34.75.75.75c.33 0 .6-.21.7-.5h1.1c.1.29.37.5.7.5.41 0 .75-.34.75-.75s-.34-.75-.75-.75c-.33 0-.6.21-.7.5h-1.1a.722.722 0 0 0-.14-.24l.57-1.03c.04.01.08.02.12.02.33 0 .6-.21.7-.5h1.35c.1.29.37.5.7.5.41 0 .75-.34.75-.75z");

/** `settings` */
export const Settings = icon("Settings", "M19.42 12.98c.04-.32.07-.64.07-.98 0-.34-.03-.66-.07-.98l2.11-1.65c.19-.15.24-.42.12-.64l-2-3.46c-.12-.22-.39-.3-.61-.22l-2.49 1c-.52-.4-1.08-.73-1.69-.98l-.38-2.65a.488.488 0 0 0-.49-.42h-4c-.25 0-.46.18-.49.42l-.38 2.65c-.61.25-1.17.59-1.69.98l-2.49-1c-.23-.09-.49 0-.61.22l-2 3.46c-.13.22-.07.49.12.64l2.11 1.65c-.04.32-.07.65-.07.98 0 .33.03.66.07.98l-2.11 1.65c-.19.15-.24.42-.12.64l2 3.46c.12.22.39.3.61.22l2.49-1c.52.4 1.08.73 1.69.98l.38 2.65c.03.24.24.42.49.42h4c.25 0 .46-.18.49-.42l.38-2.65c.61-.25 1.17-.59 1.69-.98l2.49 1c.23.09.49 0 .61-.22l2-3.46c.12-.22.07-.49-.12-.64l-2.11-1.65zm-7.43 2.52c-1.93 0-3.5-1.57-3.5-3.5s1.57-3.5 3.5-3.5 3.5 1.57 3.5 3.5-1.57 3.5-3.5 3.5z", { evenodd: true });

/** `settings_2` */
export const Settings2 = icon("Settings2", "m440-80-36-89q-24-6-46.5-15.5T314-207l-89 38-56-57 38-88q-6-11-11.5-21.5t-10-22q-4.5-11.5-8.5-23t-7-23.5l-90-36v-80l90-36q6-24 15-46.5t22-43.5l-38-88 57-57 88 38q21-13 43.5-22.5T404-791l36-89h80l36 89q25 6 47.5 15.5T647-753l88-38 56 57-37 87q13 21 22.5 44t15.5 48l88 35v80l-88 36q-6 25-16 47.5T753-313l38 88-57 56-87-38q-21 13-43.5 22.5T556-169l-36 89h-80Zm40-160q100 0 170-70t70-170q0-100-70-170t-170-70q-100 0-170 70t-70 170q0 100 70 170t170 70Z", { viewBox: MS });

/** `settings_suggestion` */
export const SettingsSuggestion = icon("SettingsSuggestion", "m307-80-12-94q-7-3-15-8t-13-10l-88 38-99-174 75-56v-32l-75-56 99-174 88 38q5-5 13-10t15-8l12-94h200l12 94q7 3 15 8t13 10l88-38 99 174-75 56v32l75 56-99 174-88-38q-5 5-13 10t-15 8l-12 94H307Zm100-200q50 0 85-35t35-85q0-50-35-85t-85-35q-50 0-85 35t-35 85q0 50 35 85t85 35Zm-30 120h60l8-72q29-8 49.5-20.5T535-286l66 30 28-50-58-44q8-23 8-50t-8-50l58-44-28-50-66 30q-20-21-40.5-33.5T445-568l-8-72h-60l-8 72q-29 8-49.5 20.5T279-514l-66-30-28 50 58 44q-8 23-8.5 50t8.5 50l-58 44 28 50 66-30q20 21 40.5 33.5T369-232l8 72Zm30-240Zm333-159q0-75-53-128t-128-53q75 0 128-52.5T740-920q0 75 52.5 127.5T920-740q-75 0-127.5 53T740-559Z", { viewBox: MS });

/** `severity` */
export const Severity = icon("Severity", "M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z", { evenodd: true });

/** `severity_alternate` */
export const SeverityAlternate = icon("SeverityAlternate", "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z", { evenodd: true });

/** `shape_detect` */
export const ShapeDetect = icon("ShapeDetect", "M560-280ZM427.5-412.5Q480-465 480-540t-52.5-127.5Q375-720 300-720t-127.5 52.5Q120-615 120-540t52.5 127.5Q225-360 300-360t127.5-52.5Zm-312 57Q40-431 40-540t75.5-184.5Q191-800 300-800t184.5 75.5Q560-649 560-540t-75.5 184.5Q409-280 300-280t-184.5-75.5ZM400-40q-33 0-56.5-23.5T320-120v-81q21-2 40.5-5t39.5-9v95h320v-320h-95q6-20 9-39.5t5-40.5h81q33 0 56.5 23.5T800-440v320q0 33-23.5 56.5T720-40H400ZM300-540Zm440-20q-1 0-8-6-16-61-60.5-105.5T566-732q-2-1-6-8 0-2 6-8 61-16 105.5-60.5T732-914q1-2 8-6 2 0 8 6 17 61 61 105.5T914-748q2 0 6 8 0 1-6 8-61 16-105.5 60.5T748-566q0 2-8 6Z", { viewBox: MS });

/** `shape_line` */
export function ShapeLine(props: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="currentColor"
      {...props}
    >
      <g clipPath="url(#shape_line-clip0_1_82)"><path d="M6 11C4.61667 11 3.43333 10.5167 2.45 9.55C1.48333 8.56667 1 7.38333 1 6C1 4.6 1.48333 3.41667 2.45 2.45C3.43333 1.48333 4.61667 0.999999 6 0.999999C7.4 0.999999 8.58333 1.48333 9.55 2.45C10.5167 3.41667 11 4.6 11 6C11 7.38333 10.5167 8.56667 9.55 9.55C8.58333 10.5167 7.4 11 6 11ZM6 9C6.85 9 7.55833 8.70833 8.125 8.125C8.70833 7.54167 9 6.83333 9 6C9 5.15 8.70833 4.44167 8.125 3.875C7.55833 3.29167 6.85 3 6 3C5.16667 3 4.45833 3.29167 3.875 3.875C3.29167 4.44167 3 5.15 3 6C3 6.83333 3.29167 7.54167 3.875 8.125C4.45833 8.70833 5.16667 9 6 9ZM16 23C15.45 23 14.975 22.8083 14.575 22.425C14.1917 22.025 14 21.55 14 21V16C14 15.45 14.1917 14.9833 14.575 14.6C14.975 14.2 15.45 14 16 14H21C21.55 14 22.0167 14.2 22.4 14.6C22.8 14.9833 23 15.45 23 16V21C23 21.55 22.8 22.025 22.4 22.425C22.0167 22.8083 21.55 23 21 23H16ZM16 21H21V16H16V21ZM17.725 7.7L7.7 17.7C7.78333 17.9 7.85 18.1083 7.9 18.325C7.96667 18.5417 8 18.7667 8 19C8 19.8333 7.70833 20.5417 7.125 21.125C6.55833 21.7083 5.85 22 5 22C4.16667 22 3.45833 21.7083 2.875 21.125C2.29167 20.5417 2 19.8333 2 19C2 18.15 2.29167 17.4417 2.875 16.875C3.45833 16.2917 4.16667 16 5 16C5.23333 16 5.45833 16.0333 5.675 16.1C5.89167 16.15 6.1 16.2167 6.3 16.3L16.3 6.275C16.2167 6.075 16.1417 5.875 16.075 5.675C16.025 5.45833 16 5.23333 16 5C16 4.15 16.2917 3.44167 16.875 2.875C17.4583 2.29167 18.1667 2 19 2C19.85 2 20.5583 2.29167 21.125 2.875C21.7083 3.44167 22 4.15 22 5C22 5.83333 21.7083 6.54167 21.125 7.125C20.5583 7.70833 19.85 8 19 8C18.7667 8 18.5417 7.975 18.325 7.925C18.125 7.85833 17.925 7.78333 17.725 7.7Z" /></g><defs><clipPath id="shape_line-clip0_1_82"><rect width="24" height="24" fill="white" /></clipPath></defs>
    </svg>
  );
}
ShapeLine.displayName = "ShapeLine";

/** `shield` */
export const Shield = icon("Shield", "M480-80q-139-35-229.5-159.5T160-516v-244l320-120 320 120v244q0 152-90.5 276.5T480-80zm0-84q104-33 172-132t68-220v-189l-240-90-240 90v189q0 121 68 220t172 132zm0-316z", { viewBox: MS });

/** `shield_locked` */
export const ShieldLocked = icon("ShieldLocked", "M480-480zm0 400q-139-35-229.5-159.5T160-516v-244l320-120 320 120v244q0 10-.5 20t-1.5 20q-9-2-18.5-3t-19.5-1q-11 0-21 1t-21 3q1-10 1.5-19.5t.5-20.5v-189l-240-90-240 90v189q0 121 68 220t172 132q21-7 41-17t39-23v94q-19 10-39 17.5T480-80zm194 0q-14 0-24-10t-10-24v-132q0-14 10-24t24-10h6v-40q0-33 23.5-56.5T760-400q33 0 56.5 23.5T840-320v40h6q14 0 24 10t10 24v132q0 14-10 24t-24 10H674zm46-200h80v-40q0-17-11.5-28.5T760-360q-17 0-28.5 11.5T720-320v40z", { viewBox: MS });

/** `shortcut` */
export const Shortcut = icon("Shortcut", "M16 22c-2.333-.483-4.25-1.642-5.75-3.475C8.75 16.692 8 14.583 8 12.2c0-1.65.38-3.192 1.137-4.625A10.09 10.09 0 0112.3 4H8V2h8v8h-2V5.3a7.822 7.822 0 00-2.938 2.913A7.83 7.83 0 0010 12.2c0 1.833.558 3.467 1.675 4.9 1.117 1.433 2.558 2.383 4.325 2.85V22z");

/** `signpost` */
export const Signpost = icon("Signpost", "M11 22V18H6L3 15L6 12H11V10H4V4H11V2H13V4H18L21 7L18 10H13V12H20V18H13V22H11ZM6 8H17.175L18.175 7L17.175 6H6V8ZM6.825 16H18V14H6.825L5.825 15L6.825 16ZM6 8V6V7V8ZM18 16V15V14V16Z");

/** `siren` */
export const Siren = icon("Siren", "M160-200h640v-80H160v80Zm160-240h80v-120q0-33 23.5-56.5T480-640v-80q-66 0-113 47t-47 113v120Zm160 160Zm-200-80h400v-200q0-83-58.5-141.5T480-760q-83 0-141.5 58.5T280-560v200ZM160-120q-33 0-56.5-23.5T80-200v-80q0-33 23.5-56.5T160-360h40v-200q0-117 81.5-198.5T480-840q117 0 198.5 81.5T760-560v200h40q33 0 56.5 23.5T880-280v80q0 33-23.5 56.5T800-120H160Zm320-240Z", { viewBox: MS });

/** `smart_toy` */
export const SmartToy = icon("SmartToy", "M4 15c-.8 0-1.5-.3-2.1-.9S1 12.8 1 12s.3-1.5.9-2.1S3.2 9 4 9V7c0-.5.2-1 .6-1.4S5.5 5 6 5h3c0-.8.3-1.5.9-2.1S11.2 2 12 2s1.5.3 2.1.9.9 1.3.9 2.1h3c.6 0 1 .2 1.4.6s.6.9.6 1.4v2c.8 0 1.5.3 2.1.9s.9 1.3.9 2.1-.3 1.5-.9 2.1-1.3.9-2.1.9v4c0 .6-.2 1-.6 1.4s-.8.6-1.4.6H6c-.5 0-1-.2-1.4-.6S4 19.6 4 19zm5-2c.4 0 .8-.1 1.1-.4s.4-.6.4-1.1-.1-.8-.4-1.1S9.4 10 9 10s-.8.1-1.1.4-.4.6-.4 1.1.1.8.4 1.1.7.4 1.1.4zm6 0c.4 0 .8-.1 1.1-.4s.4-.6.4-1.1-.1-.8-.4-1.1-.7-.4-1.1-.4-.8.1-1.1.4-.4.6-.4 1.1.1.8.4 1.1.7.4 1.1.4zm-7 4h8v-2H8zm-2 2h12V7H6zm0 0V7z");

/** `snapshot` */
export const Snapshot = icon("Snapshot", "M5 4.995A2 2 0 0 1 7.006 3h9.988A2 2 0 0 1 19 4.995v14.01A2 2 0 0 1 16.994 21H7.006A2 2 0 0 1 5 19.005V4.995zM7 5h10v14H7V5zm9 6V9h-3V6h-2v3H8v2h3v3h2v-3h3zm-8 6c0 .556.446 1 .997 1h6.006c.544 0 .997-.448.997-1 0-.556-.446-1-.997-1H8.997C8.453 16 8 16.448 8 17z", { evenodd: true });

/** `snowflake_logo` */
export const SnowflakeLogo = icon("SnowflakeLogo", "m805-341-169-96q-13-7-19-18.5t-6-23.5q0-12 6-23.5t18-18.5l170-95q18-11 37.5-5.5T873-598q10 17 4.5 36T855-533l-94 53 94 54q18 10 24 30t-5 37q-11 18-31 23t-38-5ZM536-102q-15-14-15-34v-192q0-14 7-25t18-17q11-6 24-7t26 7l169 96q18 10 24 30t-5 37q-11 18-30.5 23t-37.5-6l-95-53v107q0 20-15 34t-35 14q-20 0-35-14Zm-66-286q-1 0-9-4l-70-69-4-8v-20q0-1 4-9l70-69q1-1 9-3h21l9 3 70 69 4 9v20q0 2-4 8l-70 69-9 4h-21Zm1-63q4 4 9 4t9-4l21-20q4-4 4-9t-4-9l-21-20q-4-4-9-4t-9 4l-21 20q-4 4-4 9t4 9l21 20Zm-81-132q-13 1-26-7l-169-96q-18-10-24-29.5t5-36.5q11-17 30.5-23t37.5 5l95 53v-107q0-20 15-34t35-14q20 0 35 14t15 34v192q0 14-7 25t-18 17q-11 6-24 7Zm137.5-23.5Q520-618 520-632v-192q0-20 15-34t35-14q20 0 35 14t15 34v107l95-53q18-10 38-5t31 23q11 17 5 36.5T765-686l-169 96q-13 8-26 7.5t-24-6.5q-11-6-18.5-17.5ZM355-102q-15-14-15-34v-107l-95 53q-18 11-38 6t-31-23q-10-17-4-36.5t23-30.5l169-96q13-8 26-7t24 7q11 6 18.5 17t7.5 25v192q0 20-15 34t-35 14q-20 0-35-14ZM155-340q-18 10-38 5t-31-23q-11-17-5-37t24-30l94-54-94-53q-18-10-24-30t5-37q11-18 31-23.5t38 5.5l169 95q13 7 19.5 18.5T350-479q0 13-6.5 24.5T324-436l-169 96Z", { viewBox: MS });

/** `sort` */
export const Sort = icon("Sort", "M120-240v-80h240v80H120Zm0-200v-80h480v80H120Zm0-200v-80h720v80H120Z", { viewBox: MS });

/** `source_code` */
export const SourceCode = icon("SourceCode", "M3 4.995C3 3.893 3.893 3 4.995 3h14.01C20.107 3 21 3.893 21 4.995v14.01A1.995 1.995 0 0119.005 21H4.995A1.995 1.995 0 013 19.005V4.995zM18.418 12l.004-.003-3.854-3.854-1.604 1.603L15.218 12l-2.254 2.254 1.604 1.603 3.853-3.854-.003-.003zM5.575 12l-.003.003 3.853 3.854 1.604-1.603L8.775 12l2.254-2.254-1.604-1.603-3.854 3.854.004.003z", { evenodd: true });

/** `space_dashboard` */
export const SpaceDashboard = icon("SpaceDashboard", "M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM5 19V5h6v14H5zm14 0h-6v-7h6v7zm0-9h-6V5h6v5z");

/** `spark` */
export const Spark = icon("Spark", "M12 22c0-5.52 4.48-10 10-10-5.52 0-10-4.48-10-10 0 5.52-4.48 10-10 10 5.52 0 10 4.48 10 10z");

/** `spark_gradient` */
export function SparkGradient(props: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      {...props}
    >
      <path fill="url(#spark_gradient-spark-gradient-linear-gradient)" d="M23.956 11.956c-1.645 0-3.165-.312-4.614-.925a12.283 12.283 0 0 1-3.795-2.569 12.284 12.284 0 0 1-2.57-3.795 11.548 11.548 0 0 1-.933-4.623C12.044.018 12.027 0 12 0c-.027 0-.044.018-.044.044 0 1.645-.32 3.165-.96 4.614a11.769 11.769 0 0 1-2.543 3.795 12.284 12.284 0 0 1-3.795 2.57c-1.44.621-2.97.933-4.614.933-.026 0-.044.017-.044.044 0 .027.018.044.044.044 1.645 0 3.165.32 4.614.96a11.768 11.768 0 0 1 3.795 2.543 11.913 11.913 0 0 1 2.543 3.795c.63 1.45.96 2.97.96 4.614 0 .026.017.044.044.044.027 0 .044-.018.044-.044 0-1.645.312-3.165.925-4.614a12.282 12.282 0 0 1 2.569-3.795 11.912 11.912 0 0 1 3.795-2.543 11.376 11.376 0 0 1 4.614-.96c.026 0 .044-.017.044-.044.009-.027-.009-.044-.035-.044Z" /><defs><linearGradient id="spark_gradient-spark-gradient-linear-gradient" x1="7.621" x2="18.477" y1="15.693" y2="6.539" gradientUnits="userSpaceOnUse"><stop stopColor="var(--cm-sys-color-status-activeassist)" /><stop offset=".27" stopColor="var(--cm-sys-color-status-activeassist)" /><stop offset=".777" stopColor="var(--cm-sys-color-primary-inverse)" /><stop offset="1" stopColor="var(--cm-sys-color-primary-inverse)" /></linearGradient></defs>
    </svg>
  );
}
SparkGradient.displayName = "SparkGradient";

/** `stacks` */
export const Stacks = icon("Stacks", "M480-400L40-640l440-240 440 240-440 240zm0 160L63-467l84-46 333 182 333-182 84 46-417 227zm0 160L63-307l84-46 333 182 333-182 84 46L480-80zm0-411l273-149-273-149-273 149 273 149zm0-149z", { viewBox: MS });

/** `standard_cluster` */
export const StandardCluster = icon("StandardCluster", "M480-80q-54 0-92-38t-38-92q0-54 38-92t92-38q54 0 92 38t38 92q0 54-38 92t-92 38ZM210-350q-54 0-92-38t-38-92q0-54 38-92t92-38q54 0 92 38t38 92q0 54-38 92t-92 38Zm540 0q-54 0-92-38t-38-92q0-54 38-92t92-38q54 0 92 38t38 92q0 54-38 92t-92 38ZM480-620q-54 0-92-38t-38-92q0-54 38-92t92-38q54 0 92 38t38 92q0 54-38 92t-92 38Z", { viewBox: MS });

/** `star` */
export const Star = icon("Star", "M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z");

/** `star_border` */
export const StarBorder = icon("StarBorder", "M22 9.24l-7.19-.62L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21 12 17.27 18.18 21l-1.63-7.03L22 9.24zM12 15.4l-3.76 2.27 1-4.28-3.32-2.88 4.38-.38L12 6.1l1.71 4.04 4.38.38-3.32 2.88 1 4.28L12 15.4z");

/** `star_circle` */
export const StarCircle = icon("StarCircle", "M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zm0 18C7.58 20 4 16.41 4 12s3.58-8 7.99-8C16.41 4 20 7.59 20 12s-3.59 8-8.01 8zm1.69-10.23L12 5.8l-1.68 3.98-4.32.37 3.27 2.83-.98 4.22L12 14.96l3.71 2.24-.98-4.23L18 10.14z");

/** `start` */
export const Start = icon("Start", "M8 5v14l11-7z", { evenodd: true });

/** `status_critical` */
export function StatusCritical(props: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      {...props}
    >
      <path id="status_critical-Shape" fillRule="evenodd" clipRule="evenodd" d="M4 2C2.89543 2 2 2.89543 2 4V20C2 21.1046 2.89543 22 4 22H20C21.1046 22 22 21.1046 22 20V4C22 2.89543 21.1046 2 20 2H4ZM10.8539 12.16L9.22818 19.5L15.3778 9.30635L12.742 10.3173L15.75 5.75H10.1156L8.25 13.1269L10.8539 12.16Z" fill="var(--cm-sys-color-status-error)" />
    </svg>
  );
}
StatusCritical.displayName = "StatusCritical";

/** `status_destroyed` */
export function StatusDestroyed(props: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      {...props}
    >
      <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm5 13.6L15.6 17 12 13.4 8.4 17 7 15.6l3.6-3.6L7 8.4 8.4 7l3.6 3.6L15.6 7 17 8.4 13.4 12l3.6 3.6z" fill="var(--cm-sys-color-status-error)" />
    </svg>
  );
}
StatusDestroyed.displayName = "StatusDestroyed";

/** `status_error` */
export function StatusError(props: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      {...props}
    >
      <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" fill="var(--cm-sys-color-status-error)" />
    </svg>
  );
}
StatusError.displayName = "StatusError";

/** `status_high` */
export function StatusHigh(props: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 18 18"
      width="24"
      height="24"
      fill="none"
      {...props}
    >
      <path id="status_high-Shape" fillRule="evenodd" clipRule="evenodd" d="M4 2C2.89543 2 2 2.89543 2 4V14C2 15.1046 2.89543 16 4 16H14C15.1046 16 16 15.1046 16 14V4C16 2.89543 15.1046 2 14 2H4ZM13.4013 12.2667V10.8514H12.066V12.2667H13.4013ZM9.668 10.8514H8.3327V12.2667H9.668V10.8514ZM5.93467 10.8514H4.59937V12.2667H5.93467V10.8514ZM13.4013 8.07574V4.79993H12.066V8.07574L12.2411 9.86111H13.2363L13.4013 8.07574ZM9.668 4.79993H8.3327V8.07574L8.50774 9.86111H9.50296L9.668 8.07574V4.79993ZM5.93467 4.79993H4.59937V8.07574L4.77441 9.86111H5.76963L5.93467 8.07574V4.79993Z" fill="var(--cm-sys-color-status-error)" />
    </svg>
  );
}
StatusHigh.displayName = "StatusHigh";

/** `status_inactive` */
export const StatusInactive = icon("StatusInactive", "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z", { evenodd: true });

/** `status_info` */
export const StatusInfo = icon("StatusInfo", "M12 22C6.48 22 2 17.52 2 12S6.48 2 12 2s10 4.48 10 10-4.48 10-10 10zm1-15h-2v2h2V7zm0 4h-2v6h2v-6z", { evenodd: true });

/** `status_low` */
export function StatusLow(props: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      {...props}
    >
      <path id="status_low-Shape" fillRule="evenodd" clipRule="evenodd" d="M4 2C2.89543 2 2 2.89543 2 4V20C2 21.1046 2.89543 22 4 22H20C21.1046 22 22 21.1046 22 20V4C22 2.89543 21.1046 2 20 2H4ZM11.0461 5.99988H12.9537V10.6796L12.718 13.2301H11.2962L11.0461 10.6796V5.99988ZM11.0461 14.6448H12.9537V16.6667H11.0461V14.6448Z" fill="var(--cm-sys-color-status-warning)" />
    </svg>
  );
}
StatusLow.displayName = "StatusLow";

/** `status_medium` */
export function StatusMedium(props: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      {...props}
    >
      <path id="status_medium-Shape" fillRule="evenodd" clipRule="evenodd" d="M4 2C2.89543 2 2 2.89543 2 4V20C2 21.1046 2.89543 22 4 22H20C21.1046 22 22 21.1046 22 20V4C22 2.89543 21.1046 2 20 2H4ZM15.6208 5.99988H13.7132V10.6796L13.9633 13.2301H15.385L15.6208 10.6796V5.99988ZM8.37988 14.6448H10.2875V16.6667H8.37988V14.6448ZM13.7132 14.6448H15.6208V16.6667H13.7132V14.6448ZM8.37988 5.99988H10.2875V10.6796L10.0517 13.2301H8.62994L8.37988 10.6796V5.99988Z" fill="var(--cm-sys-color-status-warning)" />
    </svg>
  );
}
StatusMedium.displayName = "StatusMedium";

/** `status_mixed` */
export function StatusMixed(props: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="currentColor"
      {...props}
    >
      <rect x="3" y="10" width="18" height="4" rx="1" fillRule="evenodd" />
    </svg>
  );
}
StatusMixed.displayName = "StatusMixed";

/** `status_paused` */
export function StatusPaused(props: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      {...props}
    >
      <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm-1 14H8V8h3v8zm5 0h-3V8h3v8z" fill="var(--cm-sys-color-status-warning)" />
    </svg>
  );
}
StatusPaused.displayName = "StatusPaused";

/** `status_recommendation` */
export const StatusRecommendation = icon("StatusRecommendation", "M9 21c0 .55.45 1 1 1h4c.55 0 1-.45 1-1v-1H9v1zm3-19C8.13 2 5 5.13 5 9c0 2.38 1.19 4.47 3 5.74V17c0 .55.45 1 1 1h6c.55 0 1-.45 1-1v-2.26c1.81-1.27 3-3.36 3-5.74 0-3.87-3.13-7-7-7z", { evenodd: true });

/** `status_recommendation_blue` */
export const StatusRecommendationBlue = icon("StatusRecommendationBlue", "M9 21c0 .55.45 1 1 1h4c.55 0 1-.45 1-1v-1H9v1zm3-19C8.13 2 5 5.13 5 9c0 2.38 1.19 4.47 3 5.74V17c0 .55.45 1 1 1h6c.55 0 1-.45 1-1v-2.26c1.81-1.27 3-3.36 3-5.74 0-3.87-3.13-7-7-7z", { evenodd: true });

/** `status_running` */
export function StatusRunning(props: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      {...props}
    >
      <path d="M12 4.9c-3.9 0-7.1 3.2-7.1 7.1 0 3.9 3.2 7.1 7.1 7.1 3.9 0 7.1-3.2 7.1-7.1 0-.9-.1-1.7-.4-2.4l2.2-2.2c.7 1.4 1.1 2.9 1.1 4.6 0 5.5-4.5 10-10 10S2 17.5 2 12 6.5 2 12 2c2.8 0 5.3 1.1 7.1 2.9l-2 2L12 12V4.9z" fill="var(--cm-sys-color-status-success)" />
    </svg>
  );
}
StatusRunning.displayName = "StatusRunning";

/** `status_running_with_errors` */
export function StatusRunningWithErrors(props: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      {...props}
    >
      <path fillRule="evenodd" clipRule="evenodd" fill="var(--cm-sys-color-status-warning)" d="M12 21.3c1.4 0 2.8-.3 4-.9v-3.1c-1.1.8-2.5 1.3-4 1.3a6.7 6.7 0 010-13.4V12l4.7-4.7.6-.6 1.3-1.3c-1.7-1.7-4-2.7-6.6-2.7-5.2 0-9.3 4.2-9.3 9.3s4.1 9.3 9.3 9.3zm6.7-12h2.7V16h-2.7zm1.3 12c.7 0 1.3-.6 1.3-1.3 0-.7-.6-1.3-1.3-1.3-.7 0-1.3.6-1.3 1.3 0 .7.6 1.3 1.3 1.3zM-15 16c1.1 0 2.1-.2 3-.7V13c-.8.6-1.9 1-3 1-2.8 0-5-2.2-5-5s2.2-5 5-5v5l3.5-3.5.5-.5.9-.9C-11.3 2.8-13.1 2-15 2c-3.9 0-7 3.1-7 7s3.1 7 7 7zm5-9h2v5h-2zm1 9c.6 0 1-.4 1-1s-.4-1-1-1-1 .4-1 1 .4 1 1 1z" />
    </svg>
  );
}
StatusRunningWithErrors.displayName = "StatusRunningWithErrors";

/** `status_stopped` */
export const StatusStopped = icon("StatusStopped", "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zM8.997 16A1 1 0 0 1 8 15.003V8.997A1 1 0 0 1 8.997 8h6.006a1 1 0 0 1 .997.997v6.006a1 1 0 0 1-.997.997H8.997z", { evenodd: true });

/** `status_success` */
export function StatusSuccess(props: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      {...props}
    >
      <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm-2 15l-5-5 1.4-1.4 3.6 3.6 7.6-7.6L19 8l-9 9z" fill="var(--cm-sys-color-status-success)" />
    </svg>
  );
}
StatusSuccess.displayName = "StatusSuccess";

/** `status_success_disabled` */
export function StatusSuccessDisabled(props: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      {...props}
    >
      <g clipPath="url(#status_success_disabled-clip0_7152_19869)"><path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM10 17L5 12L6.41 10.59L10 14.17L17.59 6.58L19 8L10 17Z" fill="var(--cm-sys-color-on-surface-variant-low)" /></g><defs><clipPath id="status_success_disabled-clip0_7152_19869"><rect width="24" height="24" fill="black" /></clipPath></defs>
    </svg>
  );
}
StatusSuccessDisabled.displayName = "StatusSuccessDisabled";

/** `status_warning` */
export function StatusWarning(props: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      {...props}
    >
      <path d="M21 21c1.1 0 1.5-.8 1-1.7L13 3.7c-.6-1-1.5-1-2 0L2 19.3c-.6 1-.1 1.7 1 1.7h18zm-8-3h-2v-2h2v2zm0-4h-2v-4h2v4z" fill="var(--cm-sys-color-status-warning)" />
    </svg>
  );
}
StatusWarning.displayName = "StatusWarning";

/** `step` */
export const Step = icon("Step", "M760-360q-51 0-85.5-34.5T640-480q0-51 34.5-85.5T760-600q51 0 85.5 34.5T880-480q0 51-34.5 85.5T760-360Zm-400 80-56-57 103-103H80v-80h327L304-624l56-56 200 200-200 200Z", { viewBox: MS });

/** `sticky_note_2` */
export const StickyNote2 = icon("StickyNote2", "M19 5v9h-5v5H5V5h14m0-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h10l6-6V5c0-1.1-.9-2-2-2zm-7 11H7v-2h5v2zm5-4H7V8h10v2z");

/** `stop` */
export const Stop = icon("Stop", "M6 6h12v12H6z", { evenodd: true });

/** `storage` */
export const Storage = icon("Storage", "M120-160v-160h720v160H120Zm80-40h80v-80h-80v80Zm-80-440v-160h720v160H120Zm80-40h80v-80h-80v80Zm-80 280v-160h720v160H120Zm80-40h80v-80h-80v80Z", { viewBox: MS });

/** `summarize` */
export function Summarize(props: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="currentColor"
      {...props}
    >
      <path d="M0 0h24v24H0z" fill="none" /><path d="M15 3H5c-1.1 0-1.99.9-1.99 2L3 19c0 1.1.89 2 1.99 2H19c1.1 0 2-.9 2-2V9l-6-6zM5 19V5h9v5h5v9H5zM9 8c0 .55-.45 1-1 1s-1-.45-1-1 .45-1 1-1 1 .45 1 1zm0 4c0 .55-.45 1-1 1s-1-.45-1-1 .45-1 1-1 1 .45 1 1zm0 4c0 .55-.45 1-1 1s-1-.45-1-1 .45-1 1-1 1 .45 1 1z" />
    </svg>
  );
}
Summarize.displayName = "Summarize";

/** `support` */
export const Support = icon("Support", "M480-80q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80ZM364-182l48-110q-42-15-72.5-46.5T292-412l-110 46q23 64 71 112t111 72Zm-72-366q17-42 47.5-73.5T412-668l-46-110q-64 24-112 72t-72 112l110 46Zm188 188q50 0 85-35t35-85q0-50-35-85t-85-35q-50 0-85 35t-35 85q0 50 35 85t85 35Zm116 178q63-24 110.5-71.5T778-364l-110-48q-15 42-46 72.5T550-292l46 110Zm72-368 110-46q-24-63-71.5-110.5T596-778l-46 112q41 15 71 45.5t47 70.5Z", { viewBox: MS });

/** `support_agent` */
export const SupportAgent = icon("SupportAgent", "M440-120v-80h320v-284q0-117-81.5-198.5T480-764q-117 0-198.5 81.5T200-484v244h-40q-33 0-56.5-23.5T80-320v-80q0-21 10.5-39.5T120-469l3-53q8-68 39.5-126t79-101q47.5-43 109-67T480-840q68 0 129 24t109 66.5Q766-707 797-649t40 126l3 52q19 9 29.5 27t10.5 38v92q0 20-10.5 38T840-249v49q0 33-23.5 56.5T760-120H440ZM331.5-411.5Q320-423 320-440t11.5-28.5Q343-480 360-480t28.5 11.5Q400-457 400-440t-11.5 28.5Q377-400 360-400t-28.5-11.5Zm240 0Q560-423 560-440t11.5-28.5Q583-480 600-480t28.5 11.5Q640-457 640-440t-11.5 28.5Q617-400 600-400t-28.5-11.5ZM241-462q-7-106 64-182t177-76q89 0 156.5 56.5T720-519q-91-1-167.5-49T435-698q-16 80-67.5 142.5T241-462Z", { viewBox: MS });

/** `swap_horiz` */
export function SwapHoriz(props: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="currentColor"
      {...props}
    >
      <rect fill="none" height="24" width="24" x="0" y="0" /><path d="M17,4l-1.41,1.41L18.17,8H11v2h7.17l-2.58,2.59L17,14l5-5L17,4z M7,20l1.41-1.41L5.83,16H13v-2H5.83l2.58-2.59L7,10l-5,5 L7,20z" />
    </svg>
  );
}
SwapHoriz.displayName = "SwapHoriz";

/** `switch_left` */
export const SwitchLeft = icon("SwitchLeft", "M8.5 8.62v6.76L5.12 12 8.5 8.62M10 5l-7 7 7 7V5zm4 0v14l7-7-7-7z");

/** `switch_right` */
export function SwitchRight(props: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="currentColor"
      {...props}
    >
      <path fill="none" d="M24 24H0V0h24z" /><path d="M15.5 15.38V8.62L18.88 12l-3.38 3.38M14 19l7-7-7-7v14zm-4 0V5l-7 7 7 7z" />
    </svg>
  );
}
SwitchRight.displayName = "SwitchRight";

/** `sync` */
export const Sync = icon("Sync", "M160-160v-80h110l-16-14q-52-46-73-105t-21-119q0-111 66.5-197.5T400-790v84q-72 26-116 88.5T240-478q0 45 17 87.5t53 78.5l10 10v-98h80v240H160Zm400-10v-84q72-26 116-88.5T720-482q0-45-17-87.5T650-648l-10-10v98h-80v-240h240v80H690l16 14q49 49 71.5 106.5T800-482q0 111-66.5 197.5T560-170Z", { viewBox: MS });

/** `sync_alt` */
export function SyncAlt(props: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="currentColor"
      {...props}
    >
      <g><rect fill="none" height="24" width="24" x="0" /></g><g><g><polygon points="8.41,12.41 7,11 2,16 7,21 8.41,19.59 5.83,17 21,17 21,15 5.83,15" /><polygon points="15.59,11.59 17,13 22,8 17,3 15.59,4.41 18.17,7 3,7 3,9 18.17,9" /></g></g>
    </svg>
  );
}
SyncAlt.displayName = "SyncAlt";

/** `sync_problem` */
export const SyncProblem = icon("SyncProblem", "M120-160v-80h110l-16-14q-52-46-73-105t-21-119q0-111 66.5-197.5T360-790v84q-72 26-116 88.5T200-478q0 45 17 87.5t53 78.5l10 10v-98h80v240H120Zm360-120q-17 0-28.5-11.5T440-320q0-17 11.5-28.5T480-360q17 0 28.5 11.5T520-320q0 17-11.5 28.5T480-280Zm-40-160v-240h80v240h-80Zm160 270v-84q72-26 116-88.5T760-482q0-45-17-87.5T690-648l-10-10v98h-80v-240h240v80H730l16 14q49 49 71.5 106.5T840-482q0 111-66.5 197.5T600-170Z", { viewBox: MS });

/** `tab_recent` */
export const TabRecent = icon("TabRecent", "M18 23c-1.383 0-2.563-.488-3.537-1.462C13.488 20.562 13 19.383 13 18s.488-2.563 1.463-3.537C15.438 13.488 16.617 13 18 13s2.563.488 3.538 1.463C22.512 15.438 23 16.617 23 18s-.488 2.563-1.462 3.538C20.562 22.512 19.383 23 18 23zm1.65-2.65l.7-.7-1.85-1.85V15h-1v3.2l2.15 2.15zM13 10h7v1.3c.367.117.717.254 1.05.412.333.159.65.346.95.563V6c0-.55-.196-1.02-.587-1.412A1.926 1.926 0 0020 4H4c-.55 0-1.02.196-1.413.588A1.926 1.926 0 002 6v12c0 .55.196 1.02.587 1.413.393.39.863.587 1.413.587h7.3a6.373 6.373 0 01-.225-.975A6.901 6.901 0 0111 18H4V6h9v4z");

/** `target_pool` */
export const TargetPool = icon("TargetPool", "M12 22C6.477 22 2 17.523 2 12S6.477 2 12 2s10 4.477 10 10-4.477 10-10 10zm0-3a7 7 0 1 0 0-14 7 7 0 0 0 0 14zm0-3a4 4 0 1 1 0-8 4 4 0 0 1 0 8z", { evenodd: true });

/** `task_alt` */
export function TaskAlt(props: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="currentColor"
      {...props}
    >
      <rect fill="none" height="24" width="24" /><path d="M22,5.18L10.59,16.6l-4.24-4.24l1.41-1.41l2.83,2.83l10-10L22,5.18z M19.79,10.22C19.92,10.79,20,11.39,20,12 c0,4.42-3.58,8-8,8s-8-3.58-8-8c0-4.42,3.58-8,8-8c1.58,0,3.04,0.46,4.28,1.25l1.44-1.44C16.1,2.67,14.13,2,12,2C6.48,2,2,6.48,2,12 c0,5.52,4.48,10,10,10s10-4.48,10-10c0-1.19-0.22-2.33-0.6-3.39L19.79,10.22z" />
    </svg>
  );
}
TaskAlt.displayName = "TaskAlt";

/** `temp_preferences_custom` */
export const TempPreferencesCustom = icon("TempPreferencesCustom", "M19 9l1.25-2.75L23 5l-2.75-1.25L19 1l-1.25 2.75L15 5l2.75 1.25L19 9zm0 6l-1.25 2.75L15 19l2.75 1.25L19 23l1.25-2.75L23 19l-2.75-1.25L19 15zm-7.5-5.5L9 4 6.5 9.5 1 12l5.5 2.5L9 20l2.5-5.5L17 12l-5.5-2.5zm-1.51 3.49L9 15.17l-.99-2.18L5.83 12l2.18-.99L9 8.83l.99 2.18 2.18.99-2.18.99z");

/** `text_fields` */
export function TextFields(props: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="currentColor"
      {...props}
    >
      <g clipPath="url(#text_fields-clip0_1_42)"><path d="M7 20V7H2V4H15V7H10V20H7ZM16 20V12H13V9H22V12H19V20H16Z" /></g><defs><clipPath id="text_fields-clip0_1_42"><rect width="24" height="24" fill="white" /></clipPath></defs>
    </svg>
  );
}
TextFields.displayName = "TextFields";

/** `thumb_down` */
export const ThumbDown = icon("ThumbDown", "M15 3H6c-.83 0-1.54.5-1.84 1.22l-3.02 7.05c-.09.23-.14.47-.14.73v1.91l.01.01L1 14c0 1.1.9 2 2 2h6.31l-.95 4.57-.03.32c0 .41.17.79.44 1.06L9.83 23l6.59-6.59c.36-.36.58-.86.58-1.41V5c0-1.1-.9-2-2-2zm4 0v12h4V3h-4z", { evenodd: true });

/** `thumb_down_white` */
export const ThumbDownWhite = icon("ThumbDownWhite", "M3 17h6.31l-.95 4.57-.03.32c0 .41.17.79.44 1.06L9.83 24s7.09-6.85 7.17-7h5V4H6c-.83 0-1.54.5-1.84 1.22l-3.02 7.05c-.09.23-.14.47-.14.73v2c0 1.1.9 2 2 2zM17 6h3v9h-3V6zM3 13l3-7h9v10l-4.34 4.34L12 15H3v-2z");

/** `thumb_up` */
export const ThumbUp = icon("ThumbUp", "M1 21h4V9H1v12zm22-11c0-1.1-.9-2-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L14.17 1 7.59 7.59C7.22 7.95 7 8.45 7 9v10c0 1.1.9 2 2 2h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-1.91l-.01-.01L23 10z", { evenodd: true });

/** `thumb_up_white` */
export const ThumbUpWhite = icon("ThumbUpWhite", "M21 7h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L14.17 0S7.08 6.85 7 7H2v13h16c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73V9c0-1.1-.9-2-2-2zM7 18H4V9h3v9zm14-7l-3 7H9V8l4.34-4.34L12 9h9v2z");

/** `timer` */
export const Timer = icon("Timer", "M9 3V0.999999H15V3H9ZM11 14H13V8H11V14ZM12 22C10.7667 22 9.6 21.7667 8.5 21.3C7.41667 20.8167 6.46667 20.1667 5.65 19.35C4.83333 18.5333 4.18333 17.5833 3.7 16.5C3.23333 15.4 3 14.2333 3 13C3 11.7667 3.23333 10.6083 3.7 9.525C4.18333 8.425 4.83333 7.46667 5.65 6.65C6.46667 5.83333 7.41667 5.19167 8.5 4.725C9.6 4.24167 10.7667 4 12 4C13.0333 4 14.025 4.16667 14.975 4.5C15.925 4.83333 16.8167 5.31667 17.65 5.95L19.05 4.55L20.45 5.95L19.05 7.35C19.6833 8.18333 20.1667 9.075 20.5 10.025C20.8333 10.975 21 11.9667 21 13C21 14.2333 20.7583 15.4 20.275 16.5C19.8083 17.5833 19.1667 18.5333 18.35 19.35C17.5333 20.1667 16.575 20.8167 15.475 21.3C14.3917 21.7667 13.2333 22 12 22ZM12 20C13.9333 20 15.5833 19.3167 16.95 17.95C18.3167 16.5833 19 14.9333 19 13C19 11.0667 18.3167 9.41667 16.95 8.05C15.5833 6.68333 13.9333 6 12 6C10.0667 6 8.41667 6.68333 7.05 8.05C5.68333 9.41667 5 11.0667 5 13C5 14.9333 5.68333 16.5833 7.05 17.95C8.41667 19.3167 10.0667 20 12 20Z");

/** `timer_10` */
export function Timer10(props: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="currentColor"
      {...props}
    >
      <g clipPath="url(#timer_10-clip0_1_114)"><path d="M14 16H17V8H14V16ZM14 19C13.1667 19 12.4583 18.7083 11.875 18.125C11.2917 17.5417 11 16.8333 11 16V8C11 7.16667 11.2917 6.45833 11.875 5.875C12.4583 5.29167 13.1667 5 14 5H17C17.8333 5 18.5417 5.29167 19.125 5.875C19.7083 6.45833 20 7.16667 20 8V16C20 16.8333 19.7083 17.5417 19.125 18.125C18.5417 18.7083 17.8333 19 17 19H14ZM6 19V8H4V5H9V19H6Z" /></g><defs><clipPath id="timer_10-clip0_1_114"><rect width="24" height="24" fill="white" /></clipPath></defs>
    </svg>
  );
}
Timer10.displayName = "Timer10";

/** `tips_and_updates` */
export const TipsAndUpdates = icon("TipsAndUpdates", "M22 10l-.625-1.375L20 8l1.375-.625L22 6l.625 1.375L24 8l-1.375.625zm-3-4l-.95-2.05L16 3l2.05-.95L19 0l.95 2.05L22 3l-2.05.95zM9 22q-.825 0-1.412-.587Q7 20.825 7 20h4q0 .825-.587 1.413Q9.825 22 9 22zm-4-3v-2h8v2zm.25-3q-1.725-1.025-2.737-2.75Q1.5 11.525 1.5 9.5q0-3.125 2.188-5.312Q5.875 2 9 2q3.125 0 5.312 2.188Q16.5 6.375 16.5 9.5q0 2.025-1.012 3.75-1.013 1.725-2.738 2.75zm.6-2h6.3q1.125-.8 1.737-1.975.613-1.175.613-2.525 0-2.3-1.6-3.9T9 4Q6.7 4 5.1 5.6T3.5 9.5q0 1.35.613 2.525Q4.725 13.2 5.85 14zM9 14z");

/** `tips_and_updates_filled` */
export function TipsAndUpdatesFilled(props: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      {...props}
    >
      <path d="M7 20H11C11 21.1 10.1 22 9 22C7.9 22 7 21.1 7 20ZM5 19H13V17H5V19ZM16.5 9.5C16.5 13.32 13.84 15.36 12.73 16H5.27C4.16 15.36 1.5 13.32 1.5 9.5C1.5 5.36 4.86 2 9 2C13.14 2 16.5 5.36 16.5 9.5ZM21.37 7.37L20 8L21.37 8.63L22 10L22.63 8.63L24 8L22.63 7.37L22 6L21.37 7.37ZM19 6L19.94 3.94L22 3L19.94 2.06L19 0L18.06 2.06L16 3L18.06 3.94L19 6Z" fill="var(--cm-sys-color-status-activeassist)" />
    </svg>
  );
}
TipsAndUpdatesFilled.displayName = "TipsAndUpdatesFilled";

/** `toggle_off` */
export function ToggleOff(props: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="currentColor"
      {...props}
    >
      <g clipPath="url(#toggle_off-clip0_1_22)"><path d="M7 18C5.33333 18 3.91667 17.4167 2.75 16.25C1.58333 15.0833 1 13.6667 1 12C1 10.3333 1.58333 8.91667 2.75 7.75C3.91667 6.58333 5.33333 6 7 6H17C18.6667 6 20.0833 6.58333 21.25 7.75C22.4167 8.91667 23 10.3333 23 12C23 13.6667 22.4167 15.0833 21.25 16.25C20.0833 17.4167 18.6667 18 17 18H7ZM7 16H17C18.1 16 19.0417 15.6083 19.825 14.825C20.6083 14.0417 21 13.1 21 12C21 10.9 20.6083 9.95833 19.825 9.175C19.0417 8.39167 18.1 8 17 8H7C5.9 8 4.95833 8.39167 4.175 9.175C3.39167 9.95833 3 10.9 3 12C3 13.1 3.39167 14.0417 4.175 14.825C4.95833 15.6083 5.9 16 7 16ZM7 15C7.83333 15 8.54167 14.7083 9.125 14.125C9.70833 13.5417 10 12.8333 10 12C10 11.1667 9.70833 10.4583 9.125 9.875C8.54167 9.29167 7.83333 9 7 9C6.16667 9 5.45833 9.29167 4.875 9.875C4.29167 10.4583 4 11.1667 4 12C4 12.8333 4.29167 13.5417 4.875 14.125C5.45833 14.7083 6.16667 15 7 15Z" /></g><defs><clipPath id="toggle_off-clip0_1_22"><rect width="24" height="24" fill="white" /></clipPath></defs>
    </svg>
  );
}
ToggleOff.displayName = "ToggleOff";

/** `toggle_on` */
export function ToggleOn(props: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="currentColor"
      {...props}
    >
      <g clipPath="url(#toggle_on-clip0_1_18)"><path d="M7 18C5.33333 18 3.91667 17.4167 2.75 16.25C1.58333 15.0833 1 13.6667 1 12C1 10.3333 1.58333 8.91667 2.75 7.75C3.91667 6.58333 5.33333 6 7 6H17C18.6667 6 20.0833 6.58333 21.25 7.75C22.4167 8.91667 23 10.3333 23 12C23 13.6667 22.4167 15.0833 21.25 16.25C20.0833 17.4167 18.6667 18 17 18H7ZM7 16H17C18.1 16 19.0417 15.6083 19.825 14.825C20.6083 14.0417 21 13.1 21 12C21 10.9 20.6083 9.95833 19.825 9.175C19.0417 8.39167 18.1 8 17 8H7C5.9 8 4.95833 8.39167 4.175 9.175C3.39167 9.95833 3 10.9 3 12C3 13.1 3.39167 14.0417 4.175 14.825C4.95833 15.6083 5.9 16 7 16ZM17 15C17.8333 15 18.5417 14.7083 19.125 14.125C19.7083 13.5417 20 12.8333 20 12C20 11.1667 19.7083 10.4583 19.125 9.875C18.5417 9.29167 17.8333 9 17 9C16.1667 9 15.4583 9.29167 14.875 9.875C14.2917 10.4583 14 11.1667 14 12C14 12.8333 14.2917 13.5417 14.875 14.125C15.4583 14.7083 16.1667 15 17 15Z" /></g><defs><clipPath id="toggle_on-clip0_1_18"><rect width="24" height="24" fill="white" /></clipPath></defs>
    </svg>
  );
}
ToggleOn.displayName = "ToggleOn";

/** `traffic` */
export function Traffic(props: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="currentColor"
      {...props}
    >
      <g clipPath="url(#traffic-clip0_857_21152)"><path d="M12 18C12.4333 18 12.7917 17.8583 13.075 17.575C13.3583 17.2917 13.5 16.9333 13.5 16.5C13.5 16.0667 13.3583 15.7083 13.075 15.425C12.7917 15.1417 12.4333 15 12 15C11.5667 15 11.2083 15.1417 10.925 15.425C10.6417 15.7083 10.5 16.0667 10.5 16.5C10.5 16.9333 10.6417 17.2917 10.925 17.575C11.2083 17.8583 11.5667 18 12 18ZM12 13.5C12.4333 13.5 12.7917 13.3583 13.075 13.075C13.3583 12.7917 13.5 12.4333 13.5 12C13.5 11.5667 13.3583 11.2083 13.075 10.925C12.7917 10.6417 12.4333 10.5 12 10.5C11.5667 10.5 11.2083 10.6417 10.925 10.925C10.6417 11.2083 10.5 11.5667 10.5 12C10.5 12.4333 10.6417 12.7917 10.925 13.075C11.2083 13.3583 11.5667 13.5 12 13.5ZM12 9C12.4333 9 12.7917 8.85833 13.075 8.575C13.3583 8.29167 13.5 7.93333 13.5 7.5C13.5 7.06667 13.3583 6.70833 13.075 6.425C12.7917 6.14167 12.4333 6 12 6C11.5667 6 11.2083 6.14167 10.925 6.425C10.6417 6.70833 10.5 7.06667 10.5 7.5C10.5 7.93333 10.6417 8.29167 10.925 8.575C11.2083 8.85833 11.5667 9 12 9ZM7 15V13.85C6.15 13.6167 5.43333 13.15 4.85 12.45C4.28333 11.75 4 10.9333 4 10H7V8.85C6.15 8.61667 5.43333 8.15 4.85 7.45C4.28333 6.75 4 5.93333 4 5H7C7 4.45 7.19167 3.98333 7.575 3.6C7.975 3.2 8.45 3 9 3H15C15.55 3 16.0167 3.2 16.4 3.6C16.8 3.98333 17 4.45 17 5H20C20 5.93333 19.7083 6.75 19.125 7.45C18.5583 8.15 17.85 8.61667 17 8.85V10H20C20 10.9333 19.7083 11.75 19.125 12.45C18.5583 13.15 17.85 13.6167 17 13.85V15H20C20 15.9333 19.7083 16.75 19.125 17.45C18.5583 18.15 17.85 18.6167 17 18.85V19C17 19.55 16.8 20.025 16.4 20.425C16.0167 20.8083 15.55 21 15 21H9C8.45 21 7.975 20.8083 7.575 20.425C7.19167 20.025 7 19.55 7 19V18.85C6.15 18.6167 5.43333 18.15 4.85 17.45C4.28333 16.75 4 15.9333 4 15H7ZM9 19H15V5H9V19ZM9 19V5V19Z" /></g><defs><clipPath id="traffic-clip0_857_21152"><rect width="24" height="24" /></clipPath></defs>
    </svg>
  );
}
Traffic.displayName = "Traffic";

/** `traffic_split` */
export const TrafficSplit = icon("TrafficSplit", "M6.26 14H2v-4h4.26l5.056-5H16V2l5 4.5-5 4.5V8h-2.683l-4.05 4 4.05 4H16v-3l5 4.5-5 4.5v-3h-4.684L6.26 14z", { evenodd: true });

/** `translate` */
export const Translate = icon("Translate", "M12.87 15.07l-2.54-2.51.03-.03A17.52 17.52 0 0 0 14.07 6H17V4h-7V2H8v2H1v1.99h11.17C11.5 7.92 10.44 9.75 9 11.35 8.07 10.32 7.3 9.19 6.69 8h-2c.73 1.63 1.73 3.17 2.98 4.56l-5.09 5.02L4 19l5-5 3.11 3.11.76-2.04zM18.5 10h-2L12 22h2l1.12-3h4.75L21 22h2l-4.5-12zm-2.62 7l1.62-4.33L19.12 17h-3.24z");

/** `trending_flat` */
export const TrendingFlat = icon("TrendingFlat", "m700-300-57-56 84-84H120v-80h607l-83-84 57-56 179 180-180 180Z", { viewBox: MS });

/** `trending_up` */
export const TrendingUp = icon("TrendingUp", "m136-240-56-56 296-298 160 160 208-206H640v-80h240v240h-80v-104L536-320 376-480 136-240Z", { viewBox: MS });

/** `troubleshoot` */
export function Troubleshoot(props: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="currentColor"
      {...props}
    >
      <g><rect fill="none" height="24" width="24" /></g><g><g><path d="M22,20.59l-4.69-4.69C18.37,14.55,19,12.85,19,11c0-4.42-3.58-8-8-8c-4.08,0-7.44,3.05-7.93,7h2.02C5.57,7.17,8.03,5,11,5 c3.31,0,6,2.69,6,6s-2.69,6-6,6c-2.42,0-4.5-1.44-5.45-3.5H3.4C4.45,16.69,7.46,19,11,19c1.85,0,3.55-0.63,4.9-1.69L20.59,22 L22,20.59z" /><polygon points="8.43,9.69 9.65,15 11.29,15 12.55,11.22 13.5,13.5 15.5,13.5 15.5,12 14.5,12 13.25,9 11.71,9 10.59,12.37 9.35,7 7.7,7 6.45,11 1,11 1,12.5 7.55,12.5" /></g></g>
    </svg>
  );
}
Troubleshoot.displayName = "Troubleshoot";

/** `tune` */
export function Tune(props: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="currentColor"
      {...props}
    >
      <path d="M0 0h24v24H0V0z" fill="none" /><path d="M3 17v2h6v-2H3zM3 5v2h10V5H3zm10 16v-2h8v-2h-8v-2h-2v6h2zM7 9v2H3v2h4v2h2V9H7zm14 4v-2H11v2h10zm-6-4h2V7h4V5h-4V3h-2v6z" />
    </svg>
  );
}
Tune.displayName = "Tune";

/** `unarchive` */
export const Unarchive = icon("Unarchive", "M20.54 5.23l-1.39-1.68C18.88 3.21 18.47 3 18 3H6c-.47 0-.88.21-1.16.55L3.46 5.23C3.17 5.57 3 6.02 3 6.5V19c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V6.5c0-.48-.17-.93-.46-1.27zM6.24 5h11.52l.83 1H5.42l.82-1zM5 19V8h14v11H5zm3-5.5l4-4 4 4-1.41 1.41L13 13.33V17h-2v-3.67l-1.59 1.59L8 13.5z");

/** `undo` */
export const Undo = icon("Undo", "M12.5 8c-2.65 0-5.05.99-6.9 2.6L2 7v9h9l-3.62-3.62c1.39-1.16 3.16-1.88 5.12-1.88 3.54 0 6.55 2.31 7.6 5.5l2.37-.78C21.08 11.03 17.15 8 12.5 8z", { evenodd: true });

/** `unfold` */
export const Unfold = icon("Unfold", "M6.5 8.5L5 10l7 7 7-7-1.5-1.5L12 14 6.5 8.5z", { evenodd: true });

/** `unfolded` */
export const Unfolded = icon("Unfolded", "M6.5 15.5L5 14l7-7 7 7-1.5 1.5L12 10l-5.5 5.5z", { evenodd: true });

/** `unsuscribe` */
export const Unsuscribe = icon("Unsuscribe", "M19 14c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm2.5 4.75h-5v-1.5h5v1.5zM4 7.87l8 5.33 8-5.33V12h2V6c0-1.1-.9-2-2-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h9v-2H4V7.87zM19.2 6L12 10.8 4.8 6h14.4z");

/** `up` */
export const Up = icon("Up", "M16.59 15.705l1.41-1.41-6-6-6 6 1.41 1.41 4.59-4.58z", { evenodd: true });

/** `upgrade` */
export const Upgrade = icon("Upgrade", "M10 7h1v9H8v-6H2V7h8zm5-5h1v14h-3V5H2V2h13zM2 12h4l-.002 4H2v-4z", { viewBox: "0 0 18 18", evenodd: true });

/** `variable_insert` */
export const VariableInsert = icon("VariableInsert", "M120-280v-400h720v160h-80v-80H200v240h360v80H120Zm80-80v-240 240Zm664 200L720-303v123h-80v-260h260v80H776l144 144-56 56Z", { viewBox: MS });

/** `variables` */
export function Variables(props: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="currentColor"
      {...props}
    >
      <g><rect fill="none" height="24" width="24" /></g><g><g><g><polygon points="5,9 19,9 19,10 21,10 21,7 3,7 3,17 14,17 14,15 5,15" /></g><g><polygon points="21,15 21,12 19,12 19,15 16,15 16,17 19,17 19,20 21,20 21,17 24,17 24,15" /></g></g></g>
    </svg>
  );
}
Variables.displayName = "Variables";

/** `verified_user` */
export function VerifiedUser(props: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="currentColor"
      {...props}
    >
      <path d="M0 0h24v24H0V0z" fill="none" /><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm7 10c0 4.52-2.98 8.69-7 9.93-4.02-1.24-7-5.41-7-9.93V6.3l7-3.11 7 3.11V11zm-11.59.59L6 13l4 4 8-8-1.41-1.42L10 14.17z" />
    </svg>
  );
}
VerifiedUser.displayName = "VerifiedUser";

/** `video_youtube` */
export function VideoYoutube(props: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="currentColor"
      {...props}
    >
      <path fill="none" d="M0 0h24v24H0V0z" /><path d="M21.58 7.19c-.23-.86-.91-1.54-1.77-1.77C18.25 5 12 5 12 5s-6.25 0-7.81.42c-.86.23-1.54.91-1.77 1.77C2 8.75 2 12 2 12s0 3.25.42 4.81c.23.86.91 1.54 1.77 1.77C5.75 19 12 19 12 19s6.25 0 7.81-.42c.86-.23 1.54-.91 1.77-1.77C22 15.25 22 12 22 12s0-3.25-.42-4.81zM10 15V9l5.2 3-5.2 3z" />
    </svg>
  );
}
VideoYoutube.displayName = "VideoYoutube";

/** `view_column` */
export function ViewColumn(props: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="currentColor"
      {...props}
    >
      <g clipPath="url(#view_column-clip0_1_10)"><path d="M3 19V5H20.975V19H3ZM5 17H8.325V7H5V17ZM10.325 17H13.65V7H10.325V17ZM15.65 17H18.975V7H15.65V17Z" /></g><defs><clipPath id="view_column-clip0_1_10"><rect width="24" height="24" fill="white" /></clipPath></defs>
    </svg>
  );
}
ViewColumn.displayName = "ViewColumn";

/** `view_list` */
export const ViewList = icon("ViewList", "M3 5v14h18V5H3zm4 2v2H5V7h2zm-2 6v-2h2v2H5zm0 2h2v2H5v-2zm14 2H9v-2h10v2zm0-4H9v-2h10v2zm0-4H9V7h10v2z");

/** `view_week` */
export const ViewWeek = icon("ViewWeek", "M6 5H3c-.55 0-1 .45-1 1v12c0 .55.45 1 1 1h3c.55 0 1-.45 1-1V6c0-.55-.45-1-1-1zm14 0h-3c-.55 0-1 .45-1 1v12c0 .55.45 1 1 1h3c.55 0 1-.45 1-1V6c0-.55-.45-1-1-1zm-7 0h-3c-.55 0-1 .45-1 1v12c0 .55.45 1 1 1h3c.55 0 1-.45 1-1V6c0-.55-.45-1-1-1z");

/** `visibility` */
export const Visibility = icon("Visibility", "M12 7c-2.48 0-4.5 2.02-4.5 4.5S9.52 16 12 16s4.5-2.02 4.5-4.5S14.48 7 12 7zm0 7.2c-1.49 0-2.7-1.21-2.7-2.7 0-1.49 1.21-2.7 2.7-2.7s2.7 1.21 2.7 2.7c0 1.49-1.21 2.7-2.7 2.7zM12 4C7 4 2.73 7.11 1 11.5 2.73 15.89 7 19 12 19s9.27-3.11 11-7.5C21.27 7.11 17 4 12 4zm0 13a9.77 9.77 0 01-8.82-5.5C4.83 8.13 8.21 6 12 6s7.17 2.13 8.82 5.5A9.77 9.77 0 0112 17z");

/** `visibility_lock` */
export function VisibilityLock(props: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="currentColor"
      {...props}
    >
      <g clipPath="url(#visibility_lock-clip0_1_62)"><path d="M12 14.2C11.25 14.2 10.6083 13.9417 10.075 13.425C9.55833 12.8917 9.3 12.25 9.3 11.5C9.3 10.75 9.55833 10.1167 10.075 9.6C10.6083 9.06667 11.25 8.8 12 8.8C12.75 8.8 13.3833 9.06667 13.9 9.6C14.4333 10.1167 14.7 10.75 14.7 11.5C14.7 12.25 14.4333 12.8917 13.9 13.425C13.3833 13.9417 12.75 14.2 12 14.2ZM12 19C9.56667 19 7.35 18.325 5.35 16.975C3.35 15.6083 1.9 13.7833 1 11.5C1.9 9.21667 3.35 7.4 5.35 6.05C7.35 4.68333 9.56667 4 12 4C14.35 4 16.4917 4.63333 18.425 5.9C20.375 7.16667 21.8333 8.86667 22.8 11H20.525C19.6583 9.45 18.4667 8.23333 16.95 7.35C15.4333 6.45 13.7833 6 12 6C10.1167 6 8.38333 6.5 6.8 7.5C5.23333 8.48333 4.03333 9.81667 3.2 11.5C4.03333 13.1833 5.23333 14.525 6.8 15.525C8.38333 16.5083 10.1167 17 12 17C12.3333 17 12.6667 16.9833 13 16.95C13.3333 16.9167 13.6667 16.8667 14 16.8V18.825C13.6667 18.875 13.3333 18.9167 13 18.95C12.6667 18.9833 12.3333 19 12 19ZM12 16C12.3667 16 12.7167 15.9583 13.05 15.875C13.4 15.7917 13.725 15.675 14.025 15.525C14.1083 14.6917 14.3667 13.9417 14.8 13.275C15.25 12.6083 15.8167 12.075 16.5 11.675C16.5 11.6417 16.5 11.6167 16.5 11.6C16.5 11.5667 16.5 11.5333 16.5 11.5C16.5 10.25 16.0583 9.19167 15.175 8.325C14.3083 7.44167 13.25 7 12 7C10.75 7 9.68333 7.44167 8.8 8.325C7.93333 9.19167 7.5 10.25 7.5 11.5C7.5 12.75 7.93333 13.8167 8.8 14.7C9.68333 15.5667 10.75 16 12 16ZM17 21C16.7167 21 16.475 20.9083 16.275 20.725C16.0917 20.525 16 20.2833 16 20V17C16 16.7167 16.0917 16.4833 16.275 16.3C16.475 16.1 16.7167 16 17 16V15C17 14.45 17.1917 13.9833 17.575 13.6C17.975 13.2 18.45 13 19 13C19.55 13 20.0167 13.2 20.4 13.6C20.8 13.9833 21 14.45 21 15V16C21.2833 16 21.5167 16.1 21.7 16.3C21.9 16.4833 22 16.7167 22 17V20C22 20.2833 21.9 20.525 21.7 20.725C21.5167 20.9083 21.2833 21 21 21H17ZM18 16H20V15C20 14.7167 19.9 14.4833 19.7 14.3C19.5167 14.1 19.2833 14 19 14C18.7167 14 18.475 14.1 18.275 14.3C18.0917 14.4833 18 14.7167 18 15V16Z" /></g><defs><clipPath id="visibility_lock-clip0_1_62"><rect width="24" height="24" fill="white" /></clipPath></defs>
    </svg>
  );
}
VisibilityLock.displayName = "VisibilityLock";

/** `visibility_off` */
export const VisibilityOff = icon("VisibilityOff", "M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46A11.804 11.804 0 0 0 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78l3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01z");

/** `web` */
export const Web = icon("Web", "M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm-5 14H4v-4h11v4zm0-5H4V9h11v4zm5 5h-4V9h4v9z", { evenodd: true });

/** `youtube_live` */
export function YoutubeLive(props: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="currentColor"
      {...props}
    >
      <path d="M0 0h24v24H0V0z" fill="none" /><path d="M16.94 6.91l-1.41 1.45c.9.94 1.46 2.22 1.46 3.64s-.56 2.71-1.46 3.64l1.41 1.45c1.27-1.31 2.05-3.11 2.05-5.09s-.78-3.79-2.05-5.09zM19.77 4l-1.41 1.45C19.98 7.13 21 9.44 21 12.01c0 2.57-1.01 4.88-2.64 6.54l1.4 1.45c2.01-2.04 3.24-4.87 3.24-7.99 0-3.13-1.23-5.96-3.23-8.01zM7.06 6.91c-1.27 1.3-2.05 3.1-2.05 5.09s.78 3.79 2.05 5.09l1.41-1.45c-.9-.94-1.46-2.22-1.46-3.64s.56-2.71 1.46-3.64L7.06 6.91zM5.64 5.45L4.24 4C2.23 6.04 1 8.87 1 11.99c0 3.13 1.23 5.96 3.23 8.01l1.41-1.45C4.02 16.87 3 14.56 3 11.99s1.01-4.88 2.64-6.54z" /><circle cx="12" cy="12" r="3" />
    </svg>
  );
}
YoutubeLive.displayName = "YoutubeLive";

/** `zoom_in` */
export const ZoomIn = icon("ZoomIn", "M765-144 526-384q-30 23-65.79 35.5-35.79 12.5-76.18 12.5Q284-336 214-406t-70-170q0-100 70-170t170-70q100 0 170 70t70 170.03q0 40.39-12.5 76.18Q599-464 577-434l239 239-51 51ZM384-408q70 0 119-49t49-119q0-70-49-119t-119-49q-70 0-119 49t-49 119q0 70 49 119t119 49Zm-36-60v-72h-72v-72h72v-72h72v72h72v72h-72v72h-72Z", { viewBox: MS });

/** `zoom_out` */
export const ZoomOut = icon("ZoomOut", "M765-144 526-384q-30 23-65.79 35.5-35.79 12.5-76.18 12.5Q284-336 214-406t-70-170q0-100 70-170t170-70q100 0 170 70t70 170.03q0 40.39-12.5 76.18Q599-464 577-434l239 239-51 51ZM384-408q70 0 119-49t49-119q0-70-49-119t-119-49q-70 0-119 49t-49 119q0 70 49 119t119 49Zm-96-132v-72h192v72H288Z", { viewBox: MS });
