'use client';

import { useAuth } from '@/lib/auth-context';
import { usePreferences } from '@/lib/preferences-context';
import { useLayout, type ChatLayout } from '@/lib/layout-context';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Button,
  SlideToggle,
  SlideToggleLabel,
  Separator,
  MaterialSymbols,
  cn,
} from '@/kit';

interface AvatarMenuProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const LAYOUT_OPTIONS: { value: ChatLayout; label: string; icon: React.ReactNode }[] = [
  { value: 'chat-left', label: 'Chat left', icon: <MaterialSymbols.DockToRight className="size-4" /> },
  { value: 'unified', label: 'Unified', icon: <MaterialSymbols.ViewSidebar className="size-4" /> },
  { value: 'chat-right', label: 'Chat right', icon: <MaterialSymbols.DockToLeft className="size-4" /> },
];

export function AvatarMenu({ open, onOpenChange }: AvatarMenuProps) {
  const { user, signOut } = useAuth();
  const { showProvenance, setShowProvenance, showSuggestions, setShowSuggestions } = usePreferences();
  const { layout, setLayout } = useLayout();

  const displayName = user?.name || user?.email?.split('@')[0] || 'User';
  const email = user?.email || '';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-6">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="size-12 rounded-full overflow-hidden bg-cm-primary text-cm-on-primary font-medium text-lg flex items-center justify-center shrink-0 shadow-2xs">
              {user?.picture ? (
                <img src={user.picture} alt="" className="size-full object-cover" />
              ) : (
                displayName.charAt(0).toUpperCase()
              )}
            </div>
            <div className="flex flex-col min-w-0">
              <DialogTitle className="text-cm-title-small truncate">{displayName}</DialogTitle>
              <p className="text-cm-body-small text-cm-on-surface-variant truncate mt-0.5">{email}</p>
            </div>
          </div>
        </DialogHeader>

        <Separator className="my-1" />

        {/* Layout Options */}
        <div className="flex flex-col gap-2">
          <span className="text-cm-label-small uppercase text-cm-on-surface-variant font-medium">Chat Layout</span>
          <div className="grid grid-cols-3 gap-2">
            {LAYOUT_OPTIONS.map((opt) => {
              const isSelected = layout === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setLayout(opt.value)}
                  className={cn(
                    'flex flex-col items-center justify-center gap-1.5 p-2.5 rounded-xl border transition-all text-center cursor-pointer',
                    isSelected
                      ? 'bg-cm-backdrop-active border-cm-primary text-cm-on-backdrop font-medium shadow-2xs'
                      : 'border-cm-hairline hover:bg-cm-surface-variant text-cm-on-surface'
                  )}
                >
                  {opt.icon}
                  <span className="text-[12px]">{opt.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <Separator className="my-1" />

        {/* Display Preferences */}
        <div className="flex flex-col gap-3">
          <span className="text-cm-label-small uppercase text-cm-on-surface-variant font-medium">Display Preferences</span>
          <div className="flex items-center justify-between">
            <SlideToggleLabel htmlFor="pref-prov">Show "How was this computed?"</SlideToggleLabel>
            <SlideToggle
              id="pref-prov"
              checked={showProvenance}
              onCheckedChange={setShowProvenance}
            />
          </div>
          <div className="flex items-center justify-between">
            <SlideToggleLabel htmlFor="pref-sugg">Show next-action suggestions</SlideToggleLabel>
            <SlideToggle
              id="pref-sugg"
              checked={showSuggestions}
              onCheckedChange={setShowSuggestions}
            />
          </div>
        </div>

        <Separator className="my-1" />

        {/* Footer actions */}
        <div className="flex items-center justify-between pt-1">
          <Button
            variant="link"
            asChild
          >
            <a href="/project-status.html" target="_blank" rel="noopener noreferrer">
              Project Status
              <MaterialSymbols.OpenInNew className="size-3.5 ml-1" />
            </a>
          </Button>
          <Button
            variant="stroked"
            onClick={() => {
              onOpenChange(false);
              signOut();
            }}
            leftIcon={<MaterialSymbols.Logout className="size-4" />}
          >
            Sign Out
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
