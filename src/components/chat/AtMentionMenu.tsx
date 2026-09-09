import * as React from "react";
import { AT_MENU_ITEMS, type ChipType } from "@/types/chat";
import {
  TableIcon,
  ChartIcon,
  NotebookIcon,
  StorageIcon,
  HubIcon,
} from "./ChatIcons";

interface AtMentionMenuProps {
  onSelect: (name: string, type: ChipType) => void;
  onClose: () => void;
  leftOffset?: number;
  filterQuery?: string;
  selectedIndex?: number;
}

export function AtMentionMenu({
  onSelect,
  onClose,
  leftOffset = 0,
  filterQuery = "",
  selectedIndex = 0,
}: AtMentionMenuProps) {
  const ref = React.useRef<HTMLDivElement>(null);
  const selectedItemRef = React.useRef<HTMLButtonElement>(null);

  React.useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  React.useEffect(() => {
    if (selectedItemRef.current) {
      selectedItemRef.current.scrollIntoView({
        block: "nearest",
        behavior: "smooth",
      });
    }
  }, [selectedIndex]);

  const cleanQuery = filterQuery.toLowerCase().trim();
  const filteredItems = AT_MENU_ITEMS.filter(
    (item) =>
      item.name.toLowerCase().includes(cleanQuery) ||
      item.subtitle.toLowerCase().includes(cleanQuery)
  );

  const getItemIcon = (type: string) => {
    switch (type) {
      case "table":
        return <TableIcon className="size-4 shrink-0 text-cm-primary" />;
      case "chart":
        return <ChartIcon className="size-4 shrink-0 text-cm-status-activeassist" />;
      case "notebook":
        return <NotebookIcon className="size-4 shrink-0 text-cm-status-warning" />;
      case "gcs":
        return <StorageIcon className="size-4 shrink-0 text-cm-primary-inverse" />;
      case "graph":
        return <HubIcon size={16} className="size-4 shrink-0 text-cm-primary" />;
      default:
        return <TableIcon className="size-4 shrink-0 text-cm-primary" />;
    }
  };

  return (
    <div
      ref={ref}
      className="absolute bottom-full mb-3 w-[400px] max-h-[300px] overflow-hidden rounded-2xl bg-white border border-[#e2e8f0] shadow-[0_12px_32px_rgba(0,0,0,0.12),0_2px_8px_rgba(0,0,0,0.06)] z-50 flex flex-col animate-in fade-in zoom-in-95 duration-150"
      style={{
        left: Math.min(Math.max(12, leftOffset), 260),
      }}
    >
      <div className="px-3 py-2 border-b border-cm-hairline/60 bg-cm-surface-variant/40 flex items-center justify-between">
        <span className="text-cm-label-small text-cm-on-surface-variant font-medium">
          Mention data asset or resource
        </span>
        <span className="text-[11px] text-cm-on-surface-variant-low">
          ↑↓ to navigate · ↵ to select
        </span>
      </div>

      <div className="flex flex-col overflow-y-auto p-1.5 gap-0.5 max-h-[250px]">
        {filteredItems.length > 0 ? (
          filteredItems.map((item, idx) => {
            const isSelected = idx === selectedIndex;
            return (
              <button
                key={item.name}
                ref={isSelected ? selectedItemRef : null}
                type="button"
                onClick={() => onSelect(item.name, item.type as ChipType)}
                className={`flex items-center gap-3 px-3 py-2 text-left rounded-xl transition-all cursor-pointer group ${
                  isSelected
                    ? "bg-cm-backdrop-active text-cm-on-backdrop shadow-2xs"
                    : "hover:bg-cm-surface-variant text-cm-on-surface"
                }`}
              >
                <div className="shrink-0 size-7 flex items-center justify-center rounded-lg bg-cm-surface border border-cm-hairline/60 shadow-2xs">
                  {getItemIcon(item.type)}
                </div>
                <div className="flex flex-col min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-cm-label-medium text-cm-on-surface font-medium truncate">
                      {item.name}
                    </span>
                    <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.2 bg-cm-container text-cm-on-surface-variant rounded-full">
                      {item.type}
                    </span>
                  </div>
                  <span className="text-cm-body-small text-cm-on-surface-variant-low truncate mt-0.5 text-[12px]">
                    {item.subtitle}
                  </span>
                </div>
              </button>
            );
          })
        ) : (
          <div className="px-4 py-6 text-cm-body-medium text-cm-on-surface-variant-low text-center">
            No matching data resources found for "{filterQuery}"
          </div>
        )}
      </div>
    </div>
  );
}
