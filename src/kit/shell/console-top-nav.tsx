import * as React from "react";
import { cn } from "../ui/utils";
import { Menu, MenuContent, MenuTrigger } from "../ui/menu";

/**
 * The Cloud Console blue bar: hamburger, Google Cloud logo, project pill,
 * search, then the action cluster and the avatar.
 *
 * 48px tall on `backdrop`, and that height is load-bearing — `ConsoleShell`
 * assumes it, and so does every screenshot anyone compares your prototype
 * against. The action buttons are 40px round targets inside it, and the two
 * pills — project and search — are both 36px, which is what makes them read as
 * one row rather than two things that happen to be next to each other.
 *
 * Everything is a prop with a console-plausible default, so an unconfigured
 * `<ConsoleTopNav />` already looks right. Wire the handlers you need and
 * leave the rest; a button with no handler is inert rather than broken.
 */

export interface ConsoleTopNavProps {
  /** Shown in the project pill. */
  projectName?: string;
  searchPlaceholder?: string;
  /** Fallback initial when `avatarUrl` is absent. */
  avatarLabel?: string;
  avatarUrl?: string;
  /** Hide the buttons a prototype has no story for. */
  showAssistant?: boolean;
  showCloudShell?: boolean;
  showNotifications?: boolean;
  showSearch?: boolean;
  onToggleNav?: () => void;
  onProjectClick?: () => void;
  onSearchClick?: () => void;
  onAssistantClick?: () => void;
  onCloudShellClick?: () => void;
  onNotificationsClick?: () => void;
  onMoreClick?: () => void;
  moreMenuContent?: React.ReactNode;
  onAvatarClick?: () => void;
  className?: string;
}

/** 40px round target with the console's hover layer. */
const NAV_ICON_BUTTON =
  "hover:bg-cm-container flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-full transition-colors";

export function ConsoleTopNav({
  projectName = "my-project",
  searchPlaceholder = "Search (/) for resources, docs, products, and more",
  avatarLabel = "A",
  avatarUrl,
  showAssistant = true,
  showCloudShell = true,
  showNotifications = true,
  showSearch = true,
  onToggleNav,
  onProjectClick,
  onSearchClick,
  onAssistantClick,
  onCloudShellClick,
  onNotificationsClick,
  onMoreClick,
  moreMenuContent,
  onAvatarClick,
  className,
}: ConsoleTopNavProps) {
  return (
    <div
      className={cn(
        "bg-cm-backdrop relative flex h-12 shrink-0 items-center justify-between pr-1 pl-2",
        className,
      )}
    >
      {/* Left: hamburger, logo, project pill */}
      <div className="flex shrink-0 items-center gap-6">
        <div className="flex items-center gap-3">
          <button type="button" onClick={onToggleNav} className={NAV_ICON_BUTTON} title="Navigation menu">
            <svg width="18" height="12" viewBox="0 0 13.5 9" fill="none" aria-hidden>
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M0 0H13.5V1.5H0V0ZM0 3.75H13.5V5.25H0V3.75ZM0 7.5H13.5V9H0V7.5Z"
                fill="var(--cm-sys-color-on-backdrop-variant)"
              />
            </svg>
          </button>
          <a aria-label="Google Cloud Platform Home" href="#" className="flex items-center" rel="noopener">
            {/* Served by Google; the only external asset the kit references.
                A wordmark is artwork, not a token, so the theme swap is one of
                the few legitimate uses of `dark:`. */}
            <img
              aria-hidden="true"
              alt="Google Cloud"
              src="https://www.gstatic.com/pantheon/images/cm3/googleCloudColoredLogoLight_wm.svg"
              className="block h-[20px] w-auto dark:hidden"
            />
            <img
              aria-hidden="true"
              alt="Google Cloud"
              src="https://www.gstatic.com/pantheon/images/cm3/googleCloudColoredLogoDark_wm.svg"
              className="hidden h-[20px] w-auto dark:block"
            />
          </a>
        </div>
        <button
          type="button"
          onClick={onProjectClick}
          // 36px tall, the same as the search pill beside it, and padded on
          // both sides — the icon used to sit flush against the left border
          // because this carried `pl-0`.
          className="border-cm-outline hover:bg-cm-container relative flex h-9 cursor-pointer items-center gap-2 rounded-full border pr-4 pl-3 transition-colors"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
            <path
              fillRule="evenodd"
              clipRule="evenodd"
              d="M10.2453 11.989L8.53516 9.02301L10.2453 6.00781H13.6654L15.3755 9.02301L13.6654 11.989H10.2453ZM3.7101 15.9968L2 13.0308L3.7101 10.0156H7.1302L8.8403 13.0308L7.1302 15.9968H3.7101ZM3.7101 7.9812L2 5.0152L3.7101 2H7.1302L8.8403 5.0152L7.1302 7.9812H3.7101Z"
              fill="var(--cm-sys-color-on-backdrop-variant)"
            />
          </svg>
          <span className="text-cm-body-medium text-cm-on-surface">{projectName}</span>
        </button>
      </div>

      {/* Centre: the search pill.
          A `<button>`, not a styled `<div>` — it looks like a control and it
          opens something, so it has to be reachable by tab and by Enter. And
          the pointer and hover edge are conditional: with no handler wired this
          is a picture of a search box, and a picture that follows the cursor
          around is the most annoying kind of dead end. */}
      {showSearch && (
        <div className="mx-2 max-w-[704px] flex-1">
          <button
            type="button"
            onClick={onSearchClick}
            aria-label={searchPlaceholder}
            className={cn(
              "bg-cm-backdrop-inset border-cm-hairline flex h-9 w-full items-center rounded-[12px] border px-4 text-left transition-colors outline-none",
              onSearchClick &&
                "hover:border-cm-container-primary-outline focus-visible:border-cm-container-primary-outline focus-visible:ring-cm-outline-focus/50 cursor-pointer focus-visible:ring-[3px]",
            )}
          >
            <span className="text-cm-body-medium text-cm-on-surface-variant flex-1 truncate">{searchPlaceholder}</span>
            <span className="text-cm-on-surface-variant flex shrink-0 items-center gap-1.5 pl-2">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
              </svg>
              <span className="text-cm-body-medium">Search</span>
            </span>
          </button>
        </div>
      )}

      {/* Right: actions and avatar */}
      <div className="relative flex shrink-0 items-center">
        {showAssistant && (
          <button type="button" onClick={onAssistantClick} className={NAV_ICON_BUTTON} title="Gemini">
            {/* The Gemini spark: four cusps on the 256 grid, inlined because
                the Material catalogue has no brand marks. */}
            <svg width="24" height="24" viewBox="0 0 256 256" fill="none" aria-hidden>
              <path
                d="M128 256q0-26.56-10.24-49.92-9.92-23.36-27.2-40.64c-17.28-17.28-25.067-20.587-40.64-27.2Q26.56 128 0 128q26.56 0 49.92-9.92 23.36-10.24 40.64-27.52c17.28-17.28 20.587-25.067 27.2-40.64Q128 26.56 128 0q0 26.56 9.92 49.92 10.24 23.36 27.52 40.64c17.28 17.28 25.067 20.693 40.64 27.52Q229.44 128 256 128q-26.56 0-49.92 10.24-23.36 9.92-40.64 27.2c-17.28 17.28-20.693 25.067-27.52 40.64Q128 229.44 128 256"
                fill="var(--cm-sys-color-on-backdrop-variant)"
              />
            </svg>
          </button>
        )}
        {showCloudShell && (
          <button type="button" onClick={onCloudShellClick} className={NAV_ICON_BUTTON} title="Cloud Shell">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="var(--cm-sys-color-on-backdrop-variant)" aria-hidden>
              <path d="M19 3C20.1 3 21 3.9 21 5V19C21 20.1 20.1 21 19 21H5C3.9 21 3 20.1 3 19V5C3 3.9 3.9 3 5 3H19ZM5 19H19V5H5V19ZM13 14L10 17H7L10 14L7 11H10L13 14ZM17 15V17H13V15H17Z" />
            </svg>
          </button>
        )}
        {showNotifications && (
          <button type="button" onClick={onNotificationsClick} className={NAV_ICON_BUTTON} title="Notifications">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="var(--cm-sys-color-on-backdrop-variant)" aria-hidden>
              <path d="M14 20C14 21.1 13.1 22 12 22C10.9 22 10 21.1 10 20H14ZM12 2.5C12.83 2.5 13.5 3.17 13.5 4V4.67969C16.37 5.35969 18 7.93 18 11V17H20V19H4V17H6V11C6 7.92 7.64 5.35969 10.5 4.67969V4C10.5 3.17 11.17 2.5 12 2.5ZM12 6.5C9.51 6.5 8 8.52 8 11V17H16V11C16 8.52 14.49 6.5 12 6.5Z" />
            </svg>
          </button>
        )}
        {moreMenuContent ? (
          <Menu>
            <MenuTrigger asChild>
              <button type="button" className={NAV_ICON_BUTTON} title="More options">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="var(--cm-sys-color-on-surface-variant)" aria-hidden>
                  <path
                    fillRule="evenodd"
                    clipRule="evenodd"
                    d="M12 8a2 2 0 100-4 2 2 0 000 4zm0 6a2 2 0 100-4 2 2 0 000 4zm0 6a2 2 0 100-4 2 2 0 000 4z"
                  />
                </svg>
              </button>
            </MenuTrigger>
            <MenuContent align="end" side="bottom" sideOffset={6} className="min-w-[220px]">
              {moreMenuContent}
            </MenuContent>
          </Menu>
        ) : (
          <button type="button" onClick={onMoreClick} className={NAV_ICON_BUTTON} title="More options">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="var(--cm-sys-color-on-surface-variant)" aria-hidden>
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M12 8a2 2 0 100-4 2 2 0 000 4zm0 6a2 2 0 100-4 2 2 0 000 4zm0 6a2 2 0 100-4 2 2 0 000 4z"
              />
            </svg>
          </button>
        )}
        <button
          type="button"
          onClick={onAvatarClick}
          className="bg-cm-container-high text-cm-label-small text-cm-primary-on-container hover:ring-cm-primary/50 ml-1 flex size-8 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-full transition-all select-none hover:ring-2"
          title="Account"
        >
          {avatarUrl ? <img src={avatarUrl} alt="" className="size-full rounded-full object-cover" /> : avatarLabel}
        </button>
      </div>
    </div>
  );
}
