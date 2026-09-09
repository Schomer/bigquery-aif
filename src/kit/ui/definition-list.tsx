import * as React from "react";

import { cn } from "./utils";

/**
 * DefinitionList — terms and what they mean, as prose rather than as a table.
 *
 * The kit already has `KeyValueList`, and the two are easy to confuse, so the
 * split is worth stating plainly:
 *
 *   KeyValueList     a resource's metadata. Ruled rows, fixed 216px key column,
 *                    scanned down the left edge for a field name.
 *   DefinitionList   explanatory copy. No rules, no columns, read as sentences.
 *
 * So this is the one for a glossary in a help panel, the "what these settings
 * mean" block under a form, or the legend beside a chart. If a reader is
 * looking *up* a value, they want the table. If they are being *told* something,
 * they want this.
 *
 * Both are real `<dl>`s. The semantics are the same; only the density differs.
 *
 * ### Two layouts
 *
 *   stacked   term on its own line, description indented under it. Default,
 *             and the only one that survives a long term or a narrow column.
 *   inline    term and description side by side in a 1/3–2/3 grid. Reads
 *             tighter, but a term that wraps to three lines wrecks it, so it
 *             is for short labels only.
 */

export interface DefinitionListProps extends React.ComponentProps<"dl"> {
  layout?: "stacked" | "inline";
}

const DefinitionLayoutContext = React.createContext<"stacked" | "inline">("stacked");

function DefinitionList({ className, layout = "stacked", ...props }: DefinitionListProps) {
  return (
    <DefinitionLayoutContext.Provider value={layout}>
      <dl
        data-slot="definition-list"
        data-layout={layout}
        className={cn(
          layout === "inline"
            ? "grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-x-4 gap-y-2"
            : "flex flex-col gap-3",
          className,
        )}
        {...props}
      />
    </DefinitionLayoutContext.Provider>
  );
}

/**
 * The term. `label-large` rather than a heading token: it is the emphasised
 * half of a pair, not a section head, and giving it `title-small` would make a
 * six-term glossary read as six sections.
 */
function DefinitionTerm({ className, ...props }: React.ComponentProps<"dt">) {
  return (
    <dt
      data-slot="definition-term"
      className={cn("text-cm-label-large text-cm-on-surface", className)}
      {...props}
    />
  );
}

/**
 * The description. Indented under the term in `stacked` — a `<dd>` carries a
 * 40px browser default margin that has to go either way, and 0 with a 12px gap
 * reads as a pair while 40px reads as a hanging quote.
 */
function DefinitionDescription({ className, ...props }: React.ComponentProps<"dd">) {
  const layout = React.useContext(DefinitionLayoutContext);

  return (
    <dd
      data-slot="definition-description"
      className={cn(
        "text-cm-body-medium text-cm-on-surface-variant m-0",
        layout === "stacked" && "mt-1",
        className,
      )}
      {...props}
    />
  );
}

export { DefinitionList, DefinitionTerm, DefinitionDescription };
