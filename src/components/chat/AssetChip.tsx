import { Chip as KitChip, MaterialSymbols, Tooltip, cn } from "@/kit";
import type { Chip as ChipType } from "@/types/chat";
import {
  TableIcon,
  ChartIcon,
  NotebookIcon,
  StorageIcon,
  HubIcon,
} from "./ChatIcons";

interface AssetChipProps {
  chip: ChipType;
  onRemove?: () => void;
  className?: string;
}

export function AssetChip({ chip, onRemove, className }: AssetChipProps) {
  const getIcon = () => {
    switch (chip.type) {
      case "table":
        return <TableIcon className="size-3.5 shrink-0 text-cm-primary" />;
      case "chart":
        return <ChartIcon className="size-3.5 shrink-0 text-cm-status-activeassist" />;
      case "notebook":
        return <NotebookIcon className="size-3.5 shrink-0 text-cm-status-warning" />;
      case "gcs":
        return <StorageIcon className="size-3.5 shrink-0 text-cm-primary-inverse" />;
      case "graph":
        return <HubIcon size={14} className="size-3.5 shrink-0 text-cm-primary" />;
      case "file":
      default:
        return <MaterialSymbols.Description className="size-3.5 shrink-0 text-cm-on-surface-variant" />;
    }
  };

  return (
    <Tooltip content={chip.label} position="top">
      <KitChip
        icon={getIcon()}
        onRemove={onRemove ? () => onRemove() : undefined}
        removeLabel={`Remove ${chip.label}`}
        className={cn(
          "max-w-[220px] bg-cm-surface border-cm-hairline text-cm-on-surface shadow-xs",
          className
        )}
      >
        <span className="truncate">{chip.label}</span>
      </KitChip>
    </Tooltip>
  );
}
