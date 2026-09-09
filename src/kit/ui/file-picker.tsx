"use client";

import * as React from "react";

import { Button } from "./button";
import { ExpandButton } from "./expand-button";
import { Input } from "./input";
import { Close, ErrorIcon } from "./material-symbols";
import { cn } from "./utils";

/**
 * FilePicker — a read-only field showing a filename, and a Browse button.
 *
 * A bare `<input type="file">` renders as an OS-drawn control that ignores
 * every token in this kit and looks different on every platform, so the console
 * hides it and drives it from a field the design system does own. The field is
 * `readOnly` rather than disabled: a reader can still select and copy the
 * filename, which they cannot do in a disabled input.
 *
 * ### The preview is folded away
 *
 * An image file gets a "Preview" disclosure under the field rather than a
 * thumbnail that appears unasked. A form with four uploads would otherwise
 * become four images tall the moment it is filled in, and the reader chose the
 * file — they generally do not need to be shown it.
 *
 * ### Object URLs are revoked
 *
 * Each preview is a blob URL, and one is created per selection. They are
 * revoked when the next file arrives and when the component unmounts; without
 * that, a form the user fiddles with for a minute holds every image they tried
 * in memory until the tab closes.
 *
 * ### Errors beat hints
 *
 * `error` replaces `hint` rather than stacking under it. Two lines of small
 * type under a field, one of them a problem and one of them advice, is a
 * reliable way to have the problem go unread.
 */

export interface FilePickerProps extends Omit<React.ComponentProps<"div">, "onChange"> {
  label?: string;
  /** Passed straight to the hidden input — `image/*`, `.csv,.json`. */
  accept?: string;
  /** Advice under the field. Hidden while `error` is set. */
  hint?: React.ReactNode;
  /** A problem with the chosen file. Replaces `hint`. */
  error?: React.ReactNode;
  disabled?: boolean;
  onFileChange?: (file: File | null) => void;
}

function FilePicker({
  className,
  label = "File",
  accept,
  hint,
  error,
  disabled = false,
  onFileChange,
  ...props
}: FilePickerProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [name, setName] = React.useState("");
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);

  // The ref mirrors the state so unmount can revoke the current URL without
  // making the effect depend on it — a dependency there would revoke the URL
  // the moment it was created and leave a broken image behind.
  const previewRef = React.useRef<string | null>(null);
  previewRef.current = previewUrl;
  React.useEffect(
    () => () => {
      if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    },
    [],
  );

  const take = (file: File | null) => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setName(file?.name ?? "");
    setPreviewUrl(file?.type.startsWith("image/") ? URL.createObjectURL(file) : null);
    onFileChange?.(file);
  };

  const clear = () => {
    // Resetting the input's own value matters: without it, choosing the same
    // file again fires no `change` event and the field stays empty.
    if (inputRef.current) inputRef.current.value = "";
    take(null);
  };

  return (
    <div
      data-slot="file-picker"
      className={cn("flex w-full flex-col gap-2", className)}
      {...props}
    >
      <Input
        label={label}
        value={name}
        readOnly
        disabled={disabled}
        suffix={
          <>
            {name && (
              <Button variant="text" size="icon" aria-label="Clear file" onClick={clear}>
                <Close aria-hidden className="size-[18px]" />
              </Button>
            )}
            <Button
              variant="text"
              disabled={disabled}
              onClick={() => inputRef.current?.click()}
            >
              Browse
            </Button>
          </>
        }
      />
      {/*
        `hidden` and not `sr-only`: this input is never the thing a reader
        interacts with — the field above carries the label and the button opens
        the dialog — so leaving it in the accessibility tree would announce a
        second, nameless file control.
      */}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        hidden
        onChange={(event) => take(event.target.files?.[0] ?? null)}
      />
      {error ? (
        <p className="text-cm-body-small text-cm-status-error flex items-center gap-1 ps-4">
          <ErrorIcon aria-hidden className="size-4 shrink-0" />
          {error}
        </p>
      ) : hint ? (
        <p className="text-cm-body-small text-cm-on-surface-variant ps-4">{hint}</p>
      ) : null}
      {previewUrl && (
        <ExpandButton labelCollapsed="Preview" labelExpanded="Hide preview">
          <img
            src={previewUrl}
            alt={`Preview of ${name}`}
            className="border-cm-hairline max-h-40 w-40 rounded-lg border object-contain"
          />
        </ExpandButton>
      )}
    </div>
  );
}

export { FilePicker };
