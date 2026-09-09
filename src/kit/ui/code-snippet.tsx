import * as React from "react";

import { Button } from "./button";
import { useCopyToClipboard } from "./easy-copy";
import { Input } from "./input";
import { Check, ContentCopy } from "./material-symbols";
import { Tooltip } from "./tooltip";
import { cn } from "./utils";

/**
 * CodeSnippet — a command, a key, or a fragment of config, set in the code
 * token and copyable.
 *
 * Four shapes, and CDS picks between them by props rather than by exporting
 * four components:
 *
 *   default        a block of code on a tinted surface, with a copy button
 *   shell          the same block with a `$` gutter — a command to run
 *   inline         a run of code inside a sentence; no copy button
 *   keySelector    a read-only field holding an API key, copy in the suffix
 *
 * `inline` has no copy button and that is not an omission. Inline code is read
 * as part of the sentence around it; a 32px button in the middle of a line of
 * prose breaks the line box and pushes the whole paragraph apart.
 *
 * The type is `text-cm-code` — the one token with no size axis — set in
 * `font-mono`, which is the pairing `Input`'s `code` variant already uses. The
 * block does **not** get `tracking-wide`: that exception is for IDs and keys
 * scanned character by character, and a shell command is read as words.
 */

export interface CodeSnippetProps extends React.ComponentProps<"div"> {
  /**
   * What the copy button puts on the clipboard. Defaults to the children when
   * they are a plain string, which covers nearly every call.
   */
  copyText?: string;
  /** A run of code inside a sentence. No copy button, no surface. */
  inline?: boolean;
  /** A command: adds the `$` gutter. Wins over `inline`, as in CDS. */
  shell?: boolean;
  /** Render as a read-only field holding this value — an API key. */
  keySelector?: string;
  keySelectorLabel?: string;
}

/** The copy button shared by the block and the field. */
function CopySnippetButton({
  text,
  position = "bottom",
}: {
  text: string;
  position?: "bottom" | "left";
}) {
  const { copied, copy } = useCopyToClipboard();

  return (
    <Tooltip content={copied ? "Copied" : "Copy to clipboard"} position={position}>
      <Button variant="text" size="icon" aria-label="Copy to clipboard" onClick={() => copy(text)}>
        {copied ? (
          <Check aria-hidden className="text-cm-status-success size-[18px]" />
        ) : (
          <ContentCopy aria-hidden className="size-[18px]" />
        )}
      </Button>
    </Tooltip>
  );
}

function CodeSnippet({
  className,
  children,
  copyText,
  inline = false,
  shell = false,
  keySelector,
  keySelectorLabel,
  ...props
}: CodeSnippetProps) {
  const text = copyText ?? (typeof children === "string" ? children : "");

  if (keySelector !== undefined) {
    return (
      <Input
        data-slot="code-snippet"
        code
        readOnly
        label={keySelectorLabel}
        value={keySelector}
        className={className}
        suffix={<CopySnippetButton text={copyText ?? keySelector} position="left" />}
      />
    );
  }

  if (inline && !shell) {
    return (
      <code
        data-slot="code-snippet"
        className={cn(
          "bg-cm-container text-cm-on-container text-cm-code rounded-[4px] px-1.5 py-0.5 font-mono",
          className,
        )}
      >
        {children}
      </code>
    );
  }

  return (
    <div
      data-slot="code-snippet"
      className={cn(
        "bg-cm-container border-cm-hairline flex items-start gap-2 rounded-lg border p-2 pl-3",
        className,
      )}
      {...props}
    >
      {shell && (
        // `select-none` so that dragging across the block to copy it by hand
        // does not pick up a `$` that was never part of the command.
        <span aria-hidden className="text-cm-on-surface-variant-low text-cm-code shrink-0 select-none py-1.5 font-mono">
          $
        </span>
      )}
      {/*
        `overflow-x-auto` and not `whitespace-pre-wrap`: a wrapped command is a
        command someone will paste with a line break in the middle of it.
      */}
      <pre className="text-cm-code text-cm-on-container min-w-0 flex-1 overflow-x-auto py-1.5 font-mono">
        <code>{children}</code>
      </pre>
      <CopySnippetButton text={text} />
    </div>
  );
}

export { CodeSnippet };
