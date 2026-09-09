import * as React from "react";

import { Button } from "./button";
import { Check, ContentCopy } from "./material-symbols";
import { Tooltip } from "./tooltip";
import { cn } from "./utils";

/**
 * EasyCopy — a value with a copy button hung off it.
 *
 * Project IDs, resource names, connection strings, service-account emails: the
 * console is full of strings whose only purpose is to be pasted somewhere else,
 * and every one of them is a small failure if the reader has to select it by
 * hand. This is the affordance that fixes that, and it is deliberately
 * unglamorous — the value renders as itself, and a 32px icon button appears
 * beside it on hover.
 *
 * The button is hidden until hover because these turn up in lists. Twenty rows
 * with a permanent copy icon is twenty pieces of furniture competing with the
 * data; `alwaysShow` opts a lone one back in, and keyboard focus reveals it
 * regardless — an affordance you can only find with a mouse is not one.
 */

/**
 * Copy, then say so for two seconds.
 *
 * Exported because `CodeSnippet` needs exactly this and a second copy of a
 * `setTimeout` that has to be cleared on unmount is a second place to get it
 * wrong. The timer is cleared on re-copy and on unmount: without the first, two
 * quick copies leave the tick resetting early; without the second, React warns
 * about a state update on an unmounted component.
 */
export function useCopyToClipboard(resetAfterMs = 2000) {
  const [copied, setCopied] = React.useState(false);
  const timer = React.useRef<number | undefined>(undefined);

  React.useEffect(() => () => window.clearTimeout(timer.current), []);

  const copy = React.useCallback(
    async (text: string) => {
      if (!text) return false;
      try {
        await navigator.clipboard.writeText(text);
      } catch {
        // Clipboard access is refused on an insecure origin and in a sandboxed
        // frame. Neither is worth an exception a prototype has to catch, and a
        // tick that does not appear is its own error message.
        return false;
      }
      setCopied(true);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setCopied(false), resetAfterMs);
      return true;
    },
    [resetAfterMs],
  );

  return { copied, copy };
}

// `onCopy` is a DOM clipboard handler on every element, and ours takes the text
// rather than an event. Omitting the native one is the honest fix: keeping both
// under one name is how a caller ends up with a handler that never fires.
export interface EasyCopyProps extends Omit<React.ComponentProps<"span">, "onCopy"> {
  /**
   * What lands on the clipboard. Separate from `children` on purpose: the row
   * shows a truncated ID and copies the whole one, which is most of why anyone
   * wants this component.
   */
  copyText: string;
  /** Keep the button on show. Default is hover and focus only. */
  alwaysShow?: boolean;
  tooltipText?: string;
  copiedTooltipText?: string;
  onCopy?: (text: string) => void;
}

function EasyCopy({
  className,
  children,
  copyText,
  alwaysShow = false,
  tooltipText = "Copy to clipboard",
  copiedTooltipText = "Copied",
  onCopy,
  ...props
}: EasyCopyProps) {
  const { copied, copy } = useCopyToClipboard();

  return (
    <span
      data-slot="easy-copy"
      className={cn("group/copy inline-flex items-center gap-1 align-middle", className)}
      {...props}
    >
      {children}
      <Tooltip content={copied ? copiedTooltipText : tooltipText}>
        <Button
          variant="text"
          size="icon"
          aria-label={tooltipText}
          onClick={async () => {
            if (await copy(copyText)) onCopy?.(copyText);
          }}
          className={cn(
            "focus-visible:opacity-100 group-hover/copy:opacity-100",
            !alwaysShow && "opacity-0",
          )}
        >
          {/*
            The tick is `status-success` and the mark it replaces is not — the
            colour is the confirmation, and the two icons are the same 18px so
            the swap does not shift the row.
          */}
          {copied ? (
            <Check aria-hidden className="text-cm-status-success size-[18px]" />
          ) : (
            <ContentCopy aria-hidden className="size-[18px]" />
          )}
        </Button>
      </Tooltip>
    </span>
  );
}

export { EasyCopy };
