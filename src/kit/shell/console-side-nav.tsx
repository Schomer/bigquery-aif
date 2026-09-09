import * as React from "react";

import {
  Add,
  KeyboardArrowDown,
  KeyboardArrowUp,
  LeftPanelClose,
  LeftPanelOpen,
  MoreVert,
} from "../ui/material-symbols";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "../ui/menu";
import { snackbar } from "../ui/snackbar";
import { cn } from "../ui/utils";

/**
 * The console's product rail.
 *
 * 56px collapsed, 272px expanded, and it animates between the two rather than
 * appearing — the label opacity is delayed 100ms on the way out so text never
 * flashes at half width. Rows are 36px, rounded on the right only, and the
 * selected one carries a 4px indicator flush to the left edge plus a
 * `backdrop-active` fill. Those are the console's numbers; keep them and your
 * prototype reads as the console at a glance.
 *
 * Every icon in the rail sits on the same vertical axis, 28px from the left —
 * the product icon, every row icon, and the top bar's hamburger above them all.
 * That one column is what stops the chrome looking assembled from parts, and it
 * is why the collapsed width is 56 rather than 48: 28 has to be the middle.
 *
 * The rail collapses itself. The button at the right of the header closes it;
 * once closed, hovering the product icon turns it into an expand button. The
 * hamburger in the top bar is not wired to this — in the console it opens the
 * product picker, and `ConsoleShell` leaves it for you.
 *
 * Unlike the product rails it imitates, this one is data-driven: pass `items`.
 * Selection is uncontrolled unless you pass `activeId`, so the rail is useful
 * before you have any routing.
 *
 *     <ConsoleSideNav
 *       productName="My Product"
 *       productIcon={<MaterialSymbols.Analytics className="size-5" />}
 *       items={[
 *         { id: 'home', label: 'Home', icon: <MaterialSymbols.Home className="size-[18px]" /> },
 *         { id: 'jobs', label: 'Jobs', icon: <MaterialSymbols.List className="size-[18px]" /> },
 *       ]}
 *     />
 */

export interface ConsoleSideNavItem {
  id: string;
  label: string;
  /** Size it yourself — `size-[18px]` matches the console. */
  icon?: React.ReactNode;
  /** Pins the item to the bottom group, where settings and help live. */
  footer?: boolean;
  /** Renders as a collapsible section header (e.g., "Manage", "Workspaces"). */
  isSection?: boolean;
  /** Initial expanded state for collapsible sections. Defaults to true. */
  defaultOpen?: boolean;
  /** Child items inside a section or sub-items inside a folder. */
  children?: ConsoleSideNavItem[];
  onClick?: () => void;
  /** Optional callback when creating a new chat in this workspace/item */
  onAddChat?: () => void;
  /** Optional action button rendered on the section header (e.g. Add workspace) */
  action?: {
    icon: React.ReactNode;
    title: string;
    onClick: () => void;
  };
}

export interface ConsoleSideNavProps {
  items: ConsoleSideNavItem[];
  /** Header row, above the items. Omit both and the header is not drawn. */
  productName?: string;
  productIcon?: React.ReactNode;
  /** Controlled selection. Omit to let the rail track its own. */
  activeId?: string;
  defaultActiveId?: string;
  onSelect?: (id: string) => void;
  /** Controlled width. Omit and the rail tracks its own. */
  isExpanded?: boolean;
  defaultExpanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
  onProductClick?: (e: React.MouseEvent) => void;
  className?: string;
}

/**
 * 40px round target on the icon column. `pl-2` puts its centre at 28, which is
 * where the top bar's hamburger sits and where every row icon below it sits.
 */
const RAIL_ICON_BUTTON =
  "hover:bg-cm-container flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-full transition-colors";

function RowSnowmanMenu({ itemName }: { itemName: string }) {
  return (
    <Menu>
      <MenuTrigger asChild>
        <button
          type="button"
          title="More actions"
          onClick={(e) => e.stopPropagation()}
          className="hover:bg-cm-container-high text-cm-on-surface-variant hover:text-cm-on-surface mr-1 flex size-6 shrink-0 items-center justify-center rounded-full opacity-0 transition-opacity group-hover:opacity-100 data-[state=open]:opacity-100"
        >
          <MoreVert className="size-4" />
        </button>
      </MenuTrigger>
      <MenuContent align="end" className="w-44">
        <MenuItem
          onClick={(e) => {
            e.stopPropagation();
            snackbar(`Renaming "${itemName}"`);
          }}
        >
          Rename
        </MenuItem>
        <MenuItem
          onClick={(e) => {
            e.stopPropagation();
            snackbar(`Link copied for "${itemName}"`);
          }}
        >
          Copy link
        </MenuItem>
        <MenuItem
          onClick={(e) => {
            e.stopPropagation();
            snackbar(`Duplicated "${itemName}"`);
          }}
        >
          Duplicate
        </MenuItem>
        <MenuItem
          onClick={(e) => {
            e.stopPropagation();
            snackbar(`Deleted "${itemName}"`);
          }}
        >
          Delete
        </MenuItem>
      </MenuContent>
    </Menu>
  );
}

function NavRow({
  item,
  active,
  activeId,
  isExpanded,
  showSnowman = false,
  onSelect,
}: {
  item: ConsoleSideNavItem;
  active: boolean;
  activeId: string;
  isExpanded: boolean;
  showSnowman?: boolean;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="flex w-full flex-col">
      <div
        role="button"
        tabIndex={0}
        title={item.label}
        onClick={() => {
          item.onClick?.();
          onSelect(item.id);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            item.onClick?.();
            onSelect(item.id);
          }
        }}
        className={cn(
          "group relative flex h-9 w-full cursor-pointer items-center justify-between rounded-r-[12px] pl-4 pr-1 text-left transition-colors",
          active ? "bg-cm-backdrop-active" : "hover:bg-cm-container",
        )}
      >
        {active && <span aria-hidden className="bg-cm-on-backdrop-variant absolute top-0 bottom-0 left-0 w-1" />}
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          {/* 24px slot, not 20: `pl-4` plus half of it is 28, the icon column. */}
          <span
            className={cn(
              "flex size-6 shrink-0 items-center justify-center",
              active ? "text-cm-on-backdrop" : "text-cm-on-surface-variant",
            )}
          >
            {item.icon}
          </span>
          {/* Always rendered, faded out when collapsed: animating opacity keeps the
              row from reflowing mid-transition, which a conditional render cannot. */}
          <span
            className={cn(
              "truncate whitespace-nowrap transition-opacity duration-200",
              // Same 14/20 either way — only the weight moves, which is the whole
              // difference between `label-medium` and `body-medium`.
              active
                ? "text-cm-label-medium text-cm-on-backdrop"
                : "text-cm-body-medium text-cm-on-surface-variant",
              isExpanded ? "opacity-100 delay-100" : "opacity-0",
            )}
          >
            {item.label}
          </span>
        </div>
        {isExpanded && showSnowman && (
          <div className="flex items-center">
            <button
              type="button"
              title="Create new untitled chat"
              aria-label="Create new untitled chat"
              onClick={(e) => {
                e.stopPropagation();
                if (item.onAddChat) {
                  item.onAddChat();
                } else {
                  snackbar(`New untitled chat created in "${item.label}"`);
                }
              }}
              className="hover:bg-cm-container-high text-cm-on-surface-variant hover:text-cm-on-surface flex size-6 shrink-0 items-center justify-center rounded-full opacity-0 transition-opacity group-hover:opacity-100"
            >
              <Add className="size-4" />
            </button>
            <RowSnowmanMenu itemName={item.label} />
          </div>
        )}
      </div>

      {isExpanded && item.children && item.children.length > 0 && (
        <div className="flex w-full flex-col">
          {item.children.map((subItem) => {
            const subActive = subItem.id === activeId;
            return (
              <div
                key={subItem.id}
                role="button"
                tabIndex={0}
                title={subItem.label}
                onClick={() => {
                  subItem.onClick?.();
                  onSelect(subItem.id);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    subItem.onClick?.();
                    onSelect(subItem.id);
                  }
                }}
                className={cn(
                  "group relative flex h-8 w-full cursor-pointer items-center justify-between rounded-r-[12px] pl-[42px] pr-1 text-left transition-colors",
                  subActive ? "bg-cm-backdrop-active" : "hover:bg-cm-container",
                )}
              >
                {subActive && (
                  <span aria-hidden className="bg-cm-on-backdrop-variant absolute top-0 bottom-0 left-0 w-1" />
                )}
                <span
                  className={cn(
                    "truncate whitespace-nowrap min-w-0 flex-1",
                    subActive
                      ? "text-cm-label-medium text-cm-on-backdrop"
                      : "text-cm-body-medium text-cm-on-surface-variant",
                  )}
                >
                  {subItem.label}
                </span>
                {showSnowman && <RowSnowmanMenu itemName={subItem.label} />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function NavSection({
  section,
  activeId,
  isExpanded,
  onSelect,
}: {
  section: ConsoleSideNavItem;
  activeId: string;
  isExpanded: boolean;
  onSelect: (id: string) => void;
}) {
  const [open, setOpen] = React.useState(section.defaultOpen ?? true);
  const isWorkspaceSection =
    Boolean(section.id && section.id.toLowerCase().includes("workspace")) ||
    Boolean(section.label && section.label.toLowerCase().includes("workspace"));

  if (!isExpanded) {
    // When collapsed, render any child items that have icons so the icon rail remains functional
    return (
      <>
        {section.children?.map((child) => (
          <NavRow
            key={child.id}
            item={child}
            active={child.id === activeId}
            activeId={activeId}
            isExpanded={isExpanded}
            showSnowman={isWorkspaceSection}
            onSelect={onSelect}
          />
        ))}
      </>
    );
  }

  return (
    <div className="mt-2 flex w-full flex-col">
      <div
        role="button"
        tabIndex={0}
        onClick={() => setOpen((prev) => !prev)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOpen((prev) => !prev);
          }
        }}
        className="group text-cm-label-medium text-cm-on-surface hover:bg-cm-container flex h-8 w-full cursor-pointer items-center justify-between rounded-r-[12px] pl-4 pr-1 text-left transition-colors"
      >
        <span className="truncate">{section.label}</span>
        <div className="flex items-center gap-0.5">
          {section.action && (
            <button
              type="button"
              title={section.action.title}
              onClick={(e) => {
                e.stopPropagation();
                section.action?.onClick();
              }}
              className="hover:bg-cm-container-high text-cm-on-surface-variant hover:text-cm-on-surface flex size-6 shrink-0 items-center justify-center rounded-full transition-colors"
            >
              {section.action.icon}
            </button>
          )}
          <span
            aria-label={open ? `Collapse ${section.label}` : `Expand ${section.label}`}
            className="text-cm-on-surface-variant flex size-6 shrink-0 items-center justify-center"
          >
            {open ? (
              <KeyboardArrowUp className="size-5 shrink-0" />
            ) : (
              <KeyboardArrowDown className="size-5 shrink-0" />
            )}
          </span>
        </div>
      </div>
      {open && (
        <div className="flex w-full flex-col">
          {section.children?.map((child) => (
            <NavRow
              key={child.id}
              item={child}
              active={child.id === activeId}
              activeId={activeId}
              isExpanded={isExpanded}
              showSnowman={isWorkspaceSection}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function ConsoleSideNav({
  items,
  productName,
  productIcon,
  activeId: controlledActiveId,
  defaultActiveId,
  onSelect,
  isExpanded: controlledExpanded,
  defaultExpanded = false,
  onExpandedChange,
  onProductClick,
  className,
}: ConsoleSideNavProps) {
  const main = items.filter((i) => !i.footer);
  const footer = items.filter((i) => i.footer);

  const [uncontrolledActive, setUncontrolledActive] = React.useState(defaultActiveId ?? main[0]?.id ?? "");
  const activeId = controlledActiveId ?? uncontrolledActive;

  const [uncontrolledExpanded, setUncontrolledExpanded] = React.useState(defaultExpanded);
  const isExpanded = controlledExpanded ?? uncontrolledExpanded;

  const handleSelect = (id: string) => {
    if (controlledActiveId === undefined) setUncontrolledActive(id);
    onSelect?.(id);
  };

  const setExpanded = (next: boolean) => {
    if (controlledExpanded === undefined) setUncontrolledExpanded(next);
    onExpandedChange?.(next);
  };

  // Expanded, a tight right gutter keeps rows close to the rail's edge.
  const rowGutter = cn("flex w-full flex-col transition-[padding] duration-300 ease-in-out", isExpanded ? "pr-1" : "pr-0");

  return (
    <nav
      className={cn(
        "bg-cm-backdrop flex h-full shrink-0 flex-col justify-between overflow-hidden transition-[width] duration-300 ease-in-out",
        isExpanded ? "w-[256px]" : "w-[56px] min-w-[56px]",
        className,
      )}
    >
      <div className="flex w-full flex-1 flex-col overflow-hidden">
        {(productName || productIcon) && (
          <div className="flex h-12 shrink-0 items-center gap-2 pr-1 pl-2">
            {isExpanded ? (
              /* Expanded, the product icon is just a label for the rail. The
                 control that closes the rail is the button on the far right. */
              <span
                onClick={onProductClick}
                className={cn("text-cm-on-surface flex size-10 shrink-0 items-center justify-center", onProductClick && "cursor-pointer")}
              >
                {productIcon}
              </span>
            ) : (
              /* Collapsed, there is no room for a second button, so the product
                 icon becomes the expand control on hover. Swapped with `group-`
                 classes rather than state: a hover that needs a re-render is a
                 hover that lags. */
              <button
                type="button"
                onClick={(e) => {
                  if (onProductClick) onProductClick(e);
                  setExpanded(true);
                }}
                title="Expand navigation"
                className={cn(RAIL_ICON_BUTTON, "group text-cm-on-surface")}
              >
                <span className="flex items-center justify-center group-hover:hidden group-focus-visible:hidden">
                  {productIcon}
                </span>
                <LeftPanelOpen className="hidden size-5 group-hover:block group-focus-visible:block" />
              </button>
            )}
            <span
              onClick={onProductClick}
              className={cn(
                "text-cm-label-large text-cm-on-surface flex-1 truncate whitespace-nowrap transition-opacity duration-200",
                onProductClick && "cursor-pointer select-none",
                isExpanded ? "opacity-100 delay-100" : "opacity-0",
              )}
            >
              {productName}
            </span>
            {isExpanded && (
              <button
                type="button"
                onClick={() => setExpanded(false)}
                title="Collapse navigation"
                className={cn(RAIL_ICON_BUTTON, "text-cm-on-surface-variant")}
              >
                <LeftPanelClose className="size-[18px]" />
              </button>
            )}
          </div>
        )}
        {/* 8px of headroom separates the first row from the header. */}
        <div className={cn(rowGutter, "flex-1 overflow-y-auto overflow-x-hidden pt-2")}>
          {main.map((item) =>
            item.isSection ? (
              <NavSection
                key={item.id}
                section={item}
                activeId={activeId}
                isExpanded={isExpanded}
                onSelect={handleSelect}
              />
            ) : (
              <NavRow
                key={item.id}
                item={item}
                active={item.id === activeId}
                activeId={activeId}
                isExpanded={isExpanded}
                onSelect={handleSelect}
              />
            ),
          )}
        </div>
      </div>

      {footer.length > 0 && (
        <div className={cn(rowGutter, "pb-2")}>
          {footer.map((item) => (
            <NavRow
              key={item.id}
              item={item}
              active={item.id === activeId}
              activeId={activeId}
              isExpanded={isExpanded}
              onSelect={handleSelect}
            />
          ))}
        </div>
      )}
    </nav>
  );
}
