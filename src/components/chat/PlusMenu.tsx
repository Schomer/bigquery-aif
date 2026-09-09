import * as React from "react";
import {
  Button,
  Menu,
  MenuContent,
  MenuItem,
  MenuTrigger,
  snackbar,
} from "@/kit";
import { PlusIcon } from "./ChatIcons";

export const PLUS_MENU_ITEMS = [
  {
    label: "Upload files",
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" className="shrink-0">
        <path
          d="M9 1v10M5 5l4-4 4 4M2 13v2a1 1 0 001 1h12a1 1 0 001-1v-2"
          stroke="var(--cm-sys-color-on-surface)"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    label: "BigQuery",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" fillRule="evenodd" className="shrink-0">
        <path d="M7 11v1.922c.25.87 1.176 1.48 2 1.85V11z" opacity=".6" />
        <path d="M10 9v5.933c.34.04.688.067 1.045.067.326 0 .643-.023.955-.058V9z" />
        <path
          d="M13.007 12v2.7c.836-.373 1.618-.825 2-1.85V12zm7.883 7.072-3.19-3.188a.36.36 0 00-.304-.095 7.8 7.8 0 01-1.61 1.6.37.37 0 00.097.3l3.187 3.18a.38.38 0 00.537 0l1.28-1.28a.38.38 0 000-.54z"
          opacity=".6"
        />
        <path d="M11 3a8 8 0 100 16 8 8 0 000-16m0 14a6 6 0 110-12 6 6 0 010 12" />
      </svg>
    ),
  },
  {
    label: "Cloud Storage",
    icon: (
      <svg width="18" height="13" viewBox="0 0 15 12" fill="none" className="shrink-0">
        <path
          d="M13.5 6.75H0V12H15V6.75H13.5ZM7.5 9.75H3V9H7.5V9.75ZM10.87 10.5C10.646 10.5 10.427 10.434 10.241 10.309C10.055 10.184 9.91 10.007 9.825 9.8C9.74 9.593 9.718 9.365 9.763 9.146C9.807 8.926 9.916 8.725 10.075 8.567C10.234 8.41 10.436 8.303 10.656 8.261C10.876 8.218 11.103 8.242 11.309 8.329C11.516 8.416 11.692 8.562 11.814 8.75C11.937 8.937 12.002 9.156 12 9.38C11.997 9.678 11.877 9.963 11.666 10.173C11.454 10.382 11.168 10.5 10.87 10.5ZM14.25 0H0V5.25H15V0H14.25ZM7.5 3H3V2.25H7.5V3ZM10.87 3.75C10.646 3.75 10.427 3.683 10.241 3.559C10.055 3.434 9.91 3.257 9.825 3.05C9.74 2.843 9.718 2.615 9.763 2.396C9.807 2.176 9.916 1.975 10.075 1.817C10.234 1.66 10.436 1.553 10.656 1.511C10.876 1.468 11.103 1.492 11.309 1.579C11.516 1.666 11.692 1.812 11.814 2C11.937 2.187 12.002 2.406 12 2.63C11.997 2.928 11.877 3.213 11.666 3.423C11.454 3.632 11.168 3.75 10.87 3.75Z"
          fill="var(--cm-sys-color-on-surface)"
        />
      </svg>
    ),
  },
];

export interface PlusMenuProps {
  onAttachFile?: (fileName: string) => void;
  onAttachBigQuery?: () => void;
  onAttachGCS?: () => void;
  onBigQueryClick?: () => void;
  onGCSClick?: () => void;
  children?: React.ReactNode;
}

export function PlusMenu({
  onAttachFile,
  onAttachBigQuery,
  onAttachGCS,
  onBigQueryClick,
  onGCSClick,
  children,
}: PlusMenuProps) {
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleBigQuery = () => {
    onBigQueryClick?.();
    onAttachBigQuery?.();
  };

  const handleGCS = () => {
    onGCSClick?.();
    onAttachGCS?.();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onAttachFile?.(file.name);
      snackbar(`Attached file "${file.name}"`);
    }
  };

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={handleFileChange}
      />
      <Menu>
        <MenuTrigger asChild>
          {children || (
            <Button
              variant="text"
              size="icon"
              title="Add data context or upload"
              aria-label="Add data context or upload"
            >
              <PlusIcon size={18} />
            </Button>
          )}
        </MenuTrigger>
        <MenuContent align="start" side="top" sideOffset={8} className="z-[1100] w-[220px]">
          {PLUS_MENU_ITEMS.map((item) => (
            <MenuItem
              key={item.label}
              onSelect={() => {
                if (item.label === "Upload files") {
                  fileInputRef.current?.click();
                } else if (item.label === "BigQuery") {
                  handleBigQuery();
                } else if (item.label === "Cloud Storage") {
                  handleGCS();
                }
              }}
              className="flex items-center gap-2.5 py-2 px-3 rounded-lg text-cm-body-medium cursor-pointer"
            >
              {item.icon}
              <span>{item.label}</span>
            </MenuItem>
          ))}
        </MenuContent>
      </Menu>
    </>
  );
}
