import { useId, useState } from "react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  Button,
  Checkbox,
  CheckboxLabel,
  ConsoleIcons,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  MaterialSymbols,
} from "@/kit";
import { BUCKETS, BUCKET_FILES } from "@/lib/data/gcs-data";

/**
 * Pick a bucket, then pick files inside it, and attach them to the prompt.
 */
export function GCSDialog({
  open,
  onOpenChange,
  onSelect,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (paths: string[]) => void;
}) {
  const [view, setView] = useState<"buckets" | "files">("buckets");
  const [selectedBucket, setSelectedBucket] = useState<string | null>(null);
  const [checkedFiles, setCheckedFiles] = useState<Set<string>>(new Set());
  const fileId = useId();

  const backToBuckets = () => {
    setView("buckets");
    setCheckedFiles(new Set());
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setView("buckets");
      setSelectedBucket(null);
      setCheckedFiles(new Set());
    }
    onOpenChange(next);
  };

  const toggleFile = (file: string) => {
    setCheckedFiles((prev) => {
      const next = new Set(prev);
      if (next.has(file)) next.delete(file);
      else next.add(file);
      return next;
    });
  };

  const handleSelect = () => {
    if (view === "files") {
      const paths = Array.from(checkedFiles).map((f) => `gs://${selectedBucket}/${f}`);
      if (paths.length > 0) onSelect(paths);
      else if (selectedBucket) onSelect([`gs://${selectedBucket}`]);
    }
    handleOpenChange(false);
  };

  const bucketData = selectedBucket ? BUCKET_FILES[selectedBucket] : null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="z-[2000] flex w-[520px] flex-col gap-0 overflow-hidden p-0 sm:max-w-[520px]">
        <DialogHeader className="px-6 pt-6 pb-4">
          <DialogTitle>Browse Google Cloud Storage</DialogTitle>
          <DialogDescription className="sr-only">
            Choose a bucket, then the files in it to attach to your prompt.
          </DialogDescription>
        </DialogHeader>

        {/* Where you are: the bucket list, or a trail into one bucket. */}
        <div className="border-b border-cm-hairline px-6 py-2">
          {view === "buckets" ? (
            <div className="flex items-center justify-between">
              <span className="text-cm-label-medium text-cm-on-surface">Buckets</span>
              <Button variant="ghost" size="icon" aria-label="Search buckets">
                <MaterialSymbols.Search aria-hidden />
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              <div className="mb-1 flex items-center justify-between">
                <Button variant="text" onClick={backToBuckets} className="-ml-3">
                  <MaterialSymbols.ArrowBack aria-hidden />
                  Previous
                </Button>
                <Button variant="ghost" size="icon" aria-label="Search files">
                  <MaterialSymbols.Search aria-hidden />
                </Button>
              </div>
              <Breadcrumb>
                <BreadcrumbList>
                  <BreadcrumbItem>
                    <BreadcrumbLink asChild>
                      <button type="button" onClick={backToBuckets}>
                        <ConsoleIcons.HomeStorage aria-hidden />
                        {selectedBucket}
                      </button>
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbItem>
                    <BreadcrumbPage>
                      <MaterialSymbols.Folder aria-hidden />
                      {bucketData?.folder ?? ""}
                    </BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
            </div>
          )}
        </div>

        <div className="min-h-[200px] max-h-[320px] flex-1 overflow-y-auto px-3 py-1">
          {view === "buckets"
            ? BUCKETS.map((bucket) => (
                <button
                  key={bucket}
                  type="button"
                  onClick={() => {
                    setSelectedBucket(bucket);
                    setView("files");
                  }}
                  className="flex w-full items-center justify-between rounded px-3 py-2 transition-colors hover:bg-cm-container cursor-pointer"
                >
                  <span className="flex items-center gap-2 text-cm-body-medium text-cm-on-surface">
                    <ConsoleIcons.HomeStorage aria-hidden className="size-[18px]" />
                    {bucket}
                  </span>
                  <MaterialSymbols.ChevronRight
                    aria-hidden
                    className="size-[18px] text-cm-on-surface"
                  />
                </button>
              ))
            : (bucketData?.files ?? []).map((file) => {
                const checked = checkedFiles.has(file);
                return (
                  <div
                    key={file}
                    className={`flex w-full items-center gap-3 rounded px-3 py-2 transition-colors ${
                      checked ? "bg-cm-selection-container" : "hover:bg-cm-container"
                    }`}
                  >
                    <Checkbox
                      id={`${fileId}-${file}`}
                      checked={checked}
                      onCheckedChange={() => toggleFile(file)}
                    />
                    <CheckboxLabel
                      htmlFor={`${fileId}-${file}`}
                      className="flex min-w-0 flex-1 items-center gap-2 cursor-pointer"
                    >
                      <ConsoleIcons.Draft aria-hidden className="size-[18px] shrink-0" />
                      <span className="truncate">{file}</span>
                    </CheckboxLabel>
                  </div>
                );
              })}
        </div>

        <DialogFooter className="border-t border-cm-hairline px-3 py-3">
          <Button variant="stroked" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSelect}>Select</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
