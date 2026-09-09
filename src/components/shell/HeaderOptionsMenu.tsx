'use client';

import * as React from 'react';
import { usePreferences, type OutputViewMode } from '@/lib/preferences-context';
import { useLayout, type ChatLayout } from '@/lib/layout-context';
import {
  MenuGroup,
  MenuItem,
  MenuLabel,
  MenuRadioGroup,
  MenuRadioItem,
  MenuCheckboxItem,
  MenuSeparator,
  MaterialSymbols,
} from '@/kit';

interface HeaderOptionsMenuProps {
  onOpenProjectPicker?: () => void;
  onOpenAvatarMenu?: () => void;
}

export function HeaderOptionsMenu({
  onOpenProjectPicker,
  onOpenAvatarMenu,
}: HeaderOptionsMenuProps) {
  const { layout, setLayout } = useLayout();
  const { showProvenance, setShowProvenance, showSuggestions, setShowSuggestions, outputViewMode, setOutputViewMode } = usePreferences();

  const handleLayoutChange = (value: string) => {
    setLayout(value as ChatLayout);
  };

  const handleOutputViewModeChange = (value: string) => {
    setOutputViewMode(value as OutputViewMode);
  };

  return (
    <>
      <MenuGroup>
        <MenuLabel>Layout view</MenuLabel>
        <MenuRadioGroup value={layout} onValueChange={handleLayoutChange}>
          <MenuRadioItem value="unified" className="flex items-center gap-2.5">
            <MaterialSymbols.ViewSidebar className="size-4 shrink-0 text-cm-on-surface-variant" />
            <span>Inline (Single pane)</span>
          </MenuRadioItem>
          <MenuRadioItem value="chat-left" className="flex items-center gap-2.5">
            <MaterialSymbols.DockToRight className="size-4 shrink-0 text-cm-on-surface-variant" />
            <span>Left sidebar</span>
          </MenuRadioItem>
          <MenuRadioItem value="chat-right" className="flex items-center gap-2.5">
            <MaterialSymbols.DockToLeft className="size-4 shrink-0 text-cm-on-surface-variant" />
            <span>Right sidebar</span>
          </MenuRadioItem>
        </MenuRadioGroup>
      </MenuGroup>

      <MenuSeparator />

      <MenuGroup>
        <MenuLabel>Outputs view</MenuLabel>
        <MenuRadioGroup value={outputViewMode} onValueChange={handleOutputViewModeChange}>
          <MenuRadioItem value="all" className="flex items-center gap-2.5">
            <span className="material-symbols-outlined size-4 shrink-0 text-cm-on-surface-variant text-[16px] leading-none flex items-center justify-center">view_agenda</span>
            <span>All outputs (scrolling list)</span>
          </MenuRadioItem>
          <MenuRadioItem value="single" className="flex items-center gap-2.5">
            <span className="material-symbols-outlined size-4 shrink-0 text-cm-on-surface-variant text-[16px] leading-none flex items-center justify-center">crop_landscape</span>
            <span>Single output</span>
          </MenuRadioItem>
        </MenuRadioGroup>
      </MenuGroup>

      <MenuSeparator />

      <MenuGroup>
        <MenuLabel>Display Preferences</MenuLabel>
        <MenuCheckboxItem
          checked={showProvenance}
          onCheckedChange={(checked) => setShowProvenance(Boolean(checked))}
        >
          <span>Show SQL Provenance</span>
        </MenuCheckboxItem>
        <MenuCheckboxItem
          checked={showSuggestions}
          onCheckedChange={(checked) => setShowSuggestions(Boolean(checked))}
        >
          <span>Show AI Suggestions</span>
        </MenuCheckboxItem>
      </MenuGroup>

      <MenuSeparator />

      <MenuGroup>
        {onOpenProjectPicker && (
          <MenuItem onClick={onOpenProjectPicker} className="flex items-center gap-2.5">
            <MaterialSymbols.FolderOpen className="size-4 shrink-0 text-cm-on-surface-variant" />
            <span>Select Project...</span>
          </MenuItem>
        )}
        {onOpenAvatarMenu && (
          <MenuItem onClick={onOpenAvatarMenu} className="flex items-center gap-2.5">
            <MaterialSymbols.Shield className="size-4 shrink-0 text-cm-on-surface-variant" />
            <span>Account & Preferences...</span>
          </MenuItem>
        )}
      </MenuGroup>
    </>
  );
}
