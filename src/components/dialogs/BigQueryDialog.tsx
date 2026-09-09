import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  Button,
  Checkbox,
  ConsoleIcons,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EmptyState,
  EmptyStateBody,
  EmptyStateIllustration,
  Input,
  MaterialSymbols,
  SlideToggle,
  SlideToggleLabel,
  Tree,
  type TreeNode,
} from "@/kit";
import type { BqTreeItem } from "@/types/chat";
import { TableDetailsContent } from "@/components/studio/TableDetailsContent";
import { GraphIcon, ModelIcon, PreviewIcon, TableIcon } from "@/components/chat/ChatIcons";
import { BQ_TREE_DATA } from "@/lib/data/bigquery-data";

/**
 * Browse BigQuery: an explorer tree on the left, and on the right either a
 * table preview or the list of what you have ticked.
 */

function nodeIcon(item: Pick<BqTreeItem, "type" | "id">): ReactNode {
  if (item.type === "model" || (item.type === "folder" && item.id === "models")) {
    return <ModelIcon aria-hidden />;
  }
  if (item.type === "graph" || (item.type === "folder" && item.id === "graph")) {
    return <GraphIcon aria-hidden />;
  }
  switch (item.type) {
    case "project":
      return <ConsoleIcons.CloudProject aria-hidden />;
    case "dataset":
      return <ConsoleIcons.Dataset aria-hidden />;
    case "table":
      return <TableIcon aria-hidden />;
    default:
      return <MaterialSymbols.Folder aria-hidden />;
  }
}

const EMPTY_TREE_GLYPH = <></>;

const HOVER_ACTION =
  "opacity-0 transition-opacity group-hover/tree-row:opacity-100 group-hover/row:opacity-100 focus-visible:opacity-100";

const branchIds = (item: BqTreeItem): string[] =>
  item.children?.length ? [item.id, ...item.children.flatMap(branchIds)] : [];

export function BigQueryDialog({
  open,
  onOpenChange,
  onSelect,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (tables: string[]) => void;
}) {
  const [searchInputValue, setSearchInputValue] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [previewTableId, setPreviewTableId] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<string[]>(["daui_storage", "ecommerce"]);
  const [checkedTables, setCheckedTables] = useState<Set<string>>(new Set());
  const [starredIds, setStarredIds] = useState<Set<string>>(new Set());
  const [starredOnly, setStarredOnly] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);

  const isSearchActive = searchFocused || Boolean(searchInputValue) || Boolean(searchQuery);

  const flatTables = useMemo(() => {
    const walk = (
      item: BqTreeItem,
      currentDataset = ""
    ): Array<{ id: string; label: string; type: BqTreeItem["type"]; dataset: string }> => {
      const dataset = item.type === "dataset" ? item.label : currentDataset;
      const results: Array<{ id: string; label: string; type: BqTreeItem["type"]; dataset: string }> = [];
      if (item.type === "table" || item.type === "model" || item.type === "graph") {
        results.push({ id: item.id, label: item.label, type: item.type, dataset });
      }
      for (const child of item.children ?? []) results.push(...walk(child, dataset));
      return results;
    };
    return walk(BQ_TREE_DATA);
  }, []);

  const tableIds = useMemo(
    () => new Set(flatTables.filter((t) => t.type === "table").map((t) => t.id)),
    [flatTables]
  );

  const filteredFlatTables = useMemo(() => {
    if (!searchQuery) return [];
    const q = searchQuery.toLowerCase().trim();
    return flatTables.filter(
      (t) => t.label.toLowerCase().includes(q) || t.dataset.toLowerCase().includes(q)
    );
  }, [flatTables, searchQuery]);

  const toggleTable = (id: string) => {
    setCheckedTables((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const filterStarred = (item: BqTreeItem): BqTreeItem | null => {
    if (item.type === "table") return starredIds.has(item.id) ? item : null;
    const children = (item.children ?? [])
      .map(filterStarred)
      .filter((child): child is BqTreeItem => child !== null);
    return children.length > 0 ? { ...item, children } : null;
  };

  const toggleStar = (id: string) => {
    setStarredIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setSearchInputValue("");
      setSearchQuery("");
      setPreviewTableId(null);
      setCheckedTables(new Set());
    }
    onOpenChange(next);
  };

  const handleSelect = () => {
    onSelect(Array.from(checkedTables));
    handleOpenChange(false);
  };

  const rowActions = (id: string, label: string) => {
    const starred = starredIds.has(id);
    const previewing = previewTableId === id;
    return (
      <>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`${starred ? "Unstar" : "Star"} ${label}`}
          aria-pressed={starred}
          onClick={(e) => {
            e.stopPropagation();
            toggleStar(id);
          }}
          className={starred ? undefined : HOVER_ACTION}
        >
          {starred ? <ConsoleIcons.Star aria-hidden /> : <ConsoleIcons.StarBorder aria-hidden />}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Preview ${label}`}
          aria-pressed={previewing}
          onClick={(e) => {
            e.stopPropagation();
            setPreviewTableId(id);
          }}
          className={previewing ? "bg-cm-container-primary-outline" : HOVER_ACTION}
        >
          <PreviewIcon aria-hidden />
        </Button>
      </>
    );
  };

  const toTreeNode = (item: BqTreeItem): TreeNode => ({
    id: item.id,
    icon: EMPTY_TREE_GLYPH,
    label: (
      <span className="flex min-w-0 items-center gap-2">
        {item.type === "table" ? (
          <Checkbox
            checked={checkedTables.has(item.id)}
            onCheckedChange={() => toggleTable(item.id)}
            onClick={(e) => e.stopPropagation()}
            aria-label={`Attach ${item.label}`}
          />
        ) : (
          <span aria-hidden className="size-[18px] shrink-0" />
        )}
        <span
          aria-hidden
          className="flex shrink-0 items-center text-cm-on-surface-variant [&>svg]:size-5"
        >
          {nodeIcon(item)}
        </span>
        <span className="truncate">{item.label}</span>
      </span>
    ),
    actions: item.type === "table" ? rowActions(item.id, item.label) : undefined,
    alwaysShowActions: true,
    children: item.children?.map(toTreeNode),
  });

  const visibleTree = starredOnly ? filterStarred(BQ_TREE_DATA) : BQ_TREE_DATA;
  const selectedCount = checkedTables.size;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="z-[2000] flex h-[550px] w-[920px] max-w-[95vw] flex-col gap-0 overflow-hidden p-0 sm:max-w-[920px]">
        <DialogHeader className="px-6 pt-5 pb-2">
          <DialogTitle className="text-cm-title-small">Browse BigQuery</DialogTitle>
          <DialogDescription className="sr-only">
            Search or browse your BigQuery resources and attach tables to your prompt.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-1 overflow-hidden border-y border-cm-container-high">
          {/* Explorer */}
          <div
            className={`flex flex-col gap-4 overflow-hidden border-r border-cm-container-high p-5 transition-all duration-300 ease-in-out ${
              previewTableId ? "w-[36%]" : "w-[53%]"
            }`}
          >
            <div className="relative flex h-9 shrink-0 items-center gap-2">
              <Input
                value={searchInputValue}
                onChange={(e) => {
                  setSearchInputValue(e.target.value);
                  if (e.target.value === "") setSearchQuery("");
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") setSearchQuery(searchInputValue);
                }}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setSearchFocused(false)}
                placeholder={previewTableId ? "Search BigQuery" : "Search BigQuery resources"}
                clearable
                wrapperClassName={
                  isSearchActive
                    ? "absolute inset-x-0 top-0 z-10"
                    : "min-w-0 flex-1"
                }
                suffix={
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Search"
                    onClick={() => setSearchQuery(searchInputValue)}
                  >
                    <MaterialSymbols.Search aria-hidden />
                  </Button>
                }
              />

              <Button variant="stroked" className="ms-auto shrink-0">
                <MaterialSymbols.Database aria-hidden />
                Data
                <MaterialSymbols.ArrowDropDown aria-hidden />
              </Button>
            </div>

            {searchQuery ? (
              <div className="flex flex-1 flex-col gap-1 overflow-hidden">
                <div className="flex shrink-0 items-center gap-2 px-0.5 py-1">
                  {["Project", "Region", "Type"].map((facet) => (
                    <Button key={facet} variant="stroked">
                      {facet}
                      <MaterialSymbols.ArrowDropDown aria-hidden />
                    </Button>
                  ))}
                </div>

                <div className="flex flex-1 flex-col gap-0.5 overflow-y-auto border-t border-cm-hairline pt-2 pr-1">
                  {filteredFlatTables.length === 0 ? (
                    <p className="p-8 text-center text-cm-body-medium text-cm-on-surface-variant-low">
                      No matching resources found
                    </p>
                  ) : (
                    filteredFlatTables.map((item) => {
                      const isSelectedForPreview = previewTableId === item.id;
                      return (
                        <div
                          key={item.id}
                          className={`group/row flex h-[46px] items-center justify-between rounded border-b border-cm-hairline px-1 py-1.5 transition-colors ${
                            isSelectedForPreview ? "bg-cm-container-high" : "hover:bg-cm-on-surface/8"
                          }`}
                        >
                          <div className="flex min-w-0 items-center gap-2.5">
                            <Checkbox
                              checked={checkedTables.has(item.id)}
                              onCheckedChange={() => toggleTable(item.id)}
                              aria-label={`Attach ${item.label}`}
                            />
                            <span className="flex size-[18px] shrink-0 items-center justify-center text-cm-on-surface [&>svg]:size-[18px]">
                              {nodeIcon(item)}
                            </span>
                            <div className="flex min-w-0 flex-col">
                              <span className="truncate text-cm-body-medium text-cm-primary-on-container">
                                {item.label}
                              </span>
                              <span className="text-cm-body-small text-cm-on-surface-variant">
                                Dataset: {item.dataset}
                              </span>
                            </div>
                          </div>

                          <div className="flex shrink-0 items-center">
                            {rowActions(item.id, item.label)}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            ) : (
              <>
                <div className="flex shrink-0 items-center gap-3 select-none">
                  <SlideToggle
                    id="bq-starred-only"
                    checked={starredOnly}
                    onCheckedChange={(next) => {
                      setStarredOnly(next);
                      if (next) {
                        const pruned = filterStarred(BQ_TREE_DATA);
                        if (pruned) setExpandedIds(branchIds(pruned));
                      }
                    }}
                  />
                  <SlideToggleLabel htmlFor="bq-starred-only">Show starred only</SlideToggleLabel>
                </div>

                <div className="flex-1 overflow-y-auto pr-1">
                  {visibleTree === null ? (
                    <p className="p-8 text-center text-cm-body-medium text-cm-on-surface-variant-low">
                      You haven't starred any resources
                    </p>
                  ) : (
                    <Tree
                      nodes={[toTreeNode(visibleTree)]}
                      selectedId={previewTableId ?? ""}
                      expandedIds={expandedIds}
                      onExpandedChange={setExpandedIds}
                      onSelect={(node) => {
                        if (tableIds.has(node.id)) toggleTable(node.id);
                      }}
                    />
                  )}
                </div>
              </>
            )}
          </div>

          {/* Preview, or what has been picked so far */}
          {previewTableId ? (
            <div className="flex w-[64%] flex-col overflow-hidden bg-cm-surface transition-all duration-300 ease-in-out">
              <TableDetailsContent
                tableName={previewTableId}
                onClose={() => setPreviewTableId(null)}
              />
            </div>
          ) : (
            <div className="flex w-[47%] flex-col overflow-hidden p-5 transition-all duration-300 ease-in-out">
              <h3 className="mb-4 shrink-0 text-cm-label-medium text-cm-on-surface">
                Selected ({selectedCount})
              </h3>

              {selectedCount === 0 ? (
                <EmptyState className="flex-1">
                  <EmptyStateIllustration name="box" />
                  <EmptyStateBody className="text-cm-on-surface-variant-low">
                    You haven't selected any resources
                  </EmptyStateBody>
                </EmptyState>
              ) : (
                <div className="flex flex-1 flex-col gap-0.5 overflow-y-auto pr-1">
                  {Array.from(checkedTables).map((tableId) => (
                    <div
                      key={tableId}
                      className="group/row flex h-8 items-center justify-between rounded px-1 text-cm-body-medium text-cm-on-surface hover:bg-cm-on-surface/8"
                    >
                      <span className="flex min-w-0 items-center gap-1.5">
                        <TableIcon aria-hidden className="size-[18px] shrink-0" />
                        <span className="truncate">{tableId}</span>
                      </span>
                      <span className="flex shrink-0 items-center">
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Preview ${tableId}`}
                          onClick={() => setPreviewTableId(tableId)}
                        >
                          <PreviewIcon aria-hidden />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Remove ${tableId}`}
                          onClick={() => toggleTable(tableId)}
                        >
                          <MaterialSymbols.Close aria-hidden />
                        </Button>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="shrink-0 bg-cm-surface-variant px-6 py-4">
          <Button variant="stroked" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSelect} disabled={selectedCount === 0}>
            Select
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
