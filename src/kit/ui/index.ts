// The kit's component barrel. One import for everything:
//
//     import { Button, Card, Table } from "@/kit/ui";
//
// `material-symbols` is exported as a namespace rather than flattened — it
// holds ~200 glyph names and would swamp autocomplete for every other export.
// `icons` is the small set of console marks the catalogue does not have, and is
// namespaced for the same reason.
//
// `console-icons` is the console's own directory, all 414 of it, and is
// namespaced for the most obvious reason of the three.
//
//     import { MaterialSymbols, ConsoleIcons, Icons } from "@/kit/ui";
//     <MaterialSymbols.Search className="size-[18px]" />
//     <ConsoleIcons.Dataproc className="size-[18px]" />
//     <Icons.VmInstance className="size-[18px]" />
//
// Reach for them in that order. `ConsoleIcons` repeats about thirty names that
// `MaterialSymbols` already has — see the note at the top of `console-icons.tsx`.

export { cn } from "./utils";
export * as MaterialSymbols from "./material-symbols";
export * as ConsoleIcons from "./console-icons";
export * as Icons from "./icons";

export * from "./action-bar";
export * from "./breadcrumb";
export * from "./button";
export * from "./callout";
export * from "./callout-tour";
export * from "./card";
export * from "./checkbox";
export * from "./checklist";
export * from "./chip";
export * from "./code-snippet";
export * from "./collapsible";
export * from "./comparison-table";
export * from "./context-menu";
export * from "./date-picker";
export * from "./date-time-picker";
export * from "./definition-list";
export * from "./dialog";
export * from "./easy-copy";
export * from "./empty-state";
export * from "./expand-button";
export * from "./expanding-row";
export * from "./file-picker";
export * from "./filter";
export * from "./filter-chips";
export * from "./form-list";
export * from "./form-stack";
export * from "./help-button";
export * from "./input";
export * from "./interval-picker";
export * from "./item-list";
export * from "./key-value-list";
export * from "./link";
export * from "./list";
export * from "./location-selection";
export * from "./menu";
export * from "./message";
export * from "./pagination";
export * from "./panel";
export * from "./product-badge";
export * from "./progress";
export * from "./promotion-card";
export * from "./radio-group";
export * from "./rich-card";
export * from "./rich-tooltip";
export * from "./scorecard";
export * from "./scroll-area";
export * from "./select";
export * from "./separator";
export * from "./skeleton";
export * from "./slider";
export * from "./slide-toggle";
export * from "./snackbar";
export * from "./split-button";
export * from "./stepper";
export * from "./subtask";
export * from "./summary-column";
export * from "./table";
export * from "./tabs";
export * from "./tag";
export * from "./textarea";
export * from "./timezone-picker";
export * from "./toggle";
export * from "./toggle-group";
export * from "./tooltip";
export * from "./tree";
export * from "./tree-grid";
export * from "./unfold";
export * from "./usage-indicator";
export * from "./custom";
