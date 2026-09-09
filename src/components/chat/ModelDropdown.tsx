import * as React from "react";
import {
  Button,
  Menu,
  MenuContent,
  MenuRadioGroup,
  MenuRadioItem,
  MenuTrigger,
  MaterialSymbols,
} from "@/kit";
import { MODEL_OPTIONS, type ModelId } from "@/types/chat";

interface ModelDropdownProps {
  modelId?: ModelId;
  onModelChange?: (model: ModelId) => void;
}

export function ModelDropdown({
  modelId = "flash",
  onModelChange,
}: ModelDropdownProps) {
  const [selected, setSelected] = React.useState<ModelId>(modelId);

  React.useEffect(() => {
    if (modelId) setSelected(modelId);
  }, [modelId]);

  const currentOption =
    MODEL_OPTIONS.find((m) => m.id === selected) || MODEL_OPTIONS[0];

  const handleSelect = (id: string) => {
    const next = id as ModelId;
    setSelected(next);
    onModelChange?.(next);
  };

  return (
    <Menu>
      <MenuTrigger asChild>
        <Button
          variant="ghost"
          onClick={(e) => e.stopPropagation()}
        >
          <span>{currentOption.short}</span>
          <MaterialSymbols.ArrowDropDown className="size-4 -mr-0.5" />
        </Button>
      </MenuTrigger>
      <MenuContent align="end" side="top" sideOffset={8} className="min-w-[190px] p-1 z-50">
        <MenuRadioGroup value={selected} onValueChange={handleSelect}>
          {MODEL_OPTIONS.map((option) => (
            <MenuRadioItem
              key={option.id}
              value={option.id}
              className="flex items-center gap-2 py-2 px-3 text-cm-body-medium cursor-pointer"
            >
              <span>{option.label}</span>
            </MenuRadioItem>
          ))}
        </MenuRadioGroup>
      </MenuContent>
    </Menu>
  );
}
