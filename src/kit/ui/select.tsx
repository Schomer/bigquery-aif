"use client";

import * as React from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import {
  Close,
  KeyboardArrowUp,
  ProgressActivity,
  Search,
} from "./material-symbols";
import { cn } from "./utils";
import { StatusError } from "./icons";
import { Checkbox } from "./checkbox";
import { Button } from "./button";
import { MENU_LABEL } from "./menu";

function Select({
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Root>) {
  return <SelectPrimitive.Root data-slot="select" {...props} />;
}

function SelectGroup({
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Group>) {
  return <SelectPrimitive.Group data-slot="select-group" {...props} />;
}

function SelectValue({
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Value>) {
  return <SelectPrimitive.Value data-slot="select-value" {...props} />;
}

function SelectTrigger({
  className,
  size = "default",
  children,
  variant = "default",
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Trigger> & {
  size?: "sm" | "default" | "lg";
  variant?: "default" | "inline";
}) {
  return (
    <SelectPrimitive.Trigger
      data-slot="select-trigger"
      data-size={size}
      className={cn(
        "group flex w-full items-center justify-between gap-2 rounded-lg border border-cm-outline bg-cm-surface px-3 text-cm-body-medium text-cm-on-surface transition-all outline-none cursor-pointer select-none h-[36px]",
        "hover:border-cm-outline-active/80 focus:border-2 focus:border-cm-outline-active data-[state=open]:border-2 data-[state=open]:border-cm-outline-active",
        "data-[placeholder]:text-cm-on-surface-variant-low",
        "disabled:cursor-not-allowed disabled:bg-cm-surface-variant disabled:border-cm-hairline/38 disabled:text-cm-on-surface/38 disabled:opacity-70",
        size === "sm" && "h-8 text-cm-body-small px-2.5",
        size === "lg" && "h-10",
        variant === "inline" && "inline-flex w-auto border-transparent hover:bg-cm-backdrop-inset",
        className,
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon asChild>
        <svg
          viewBox="0 0 24 24"
          className="size-5 fill-cm-on-surface-variant-low shrink-0 group-hover:fill-cm-on-surface group-disabled:opacity-38 transition-transform duration-200 group-data-[state=open]:rotate-180"
        >
          <path fillRule="evenodd" d="M18 9H6l6 6z" fill="currentColor" />
        </svg>
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  );
}

function SelectContent({
  className,
  children,
  position = "popper",
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Content>) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        data-slot="select-content"
        className={cn(
          "relative z-50 max-h-[320px] min-w-[8rem] overflow-hidden rounded-[16px] border border-cm-hairline/60 bg-cm-container shadow-cm-elevation text-cm-on-surface data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
          position === "popper" &&
            "data-[side=bottom]:translate-y-1.5 data-[side=left]:-translate-x-1.5 data-[side=right]:translate-x-1.5 data-[side=top]:-translate-y-1.5",
          className,
        )}
        position={position}
        {...props}
      >
        <SelectScrollUpButton />
        <SelectPrimitive.Viewport
          className={cn(
            "p-0 overflow-hidden",
            position === "popper" &&
              "h-[var(--radix-select-trigger-height)] w-full min-w-[var(--radix-select-trigger-width)]",
          )}
        >
          {children}
        </SelectPrimitive.Viewport>
        <SelectScrollDownButton />
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  );
}

function SelectLabel({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Label>) {
  return (
    <SelectPrimitive.Label
      data-slot="select-label"
      // A section heading inside a floating list is the same thing whether the
      // list is a Menu or a Select, so it borrows MENU_LABEL rather than keeping
      // its own. It used to be uppercase and letterspaced, which is the one place
      // the two components disagreed for no reason.
      className={cn(MENU_LABEL, className)}
      {...props}
    />
  );
}

function SelectItem({
  className,
  children,
  description,
  icon,
  badge,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Item> & {
  description?: React.ReactNode;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
}) {
  return (
    <SelectPrimitive.Item
      data-slot="select-item"
      className={cn(
        "relative flex w-full cursor-pointer select-none items-center justify-between gap-2 px-4 py-2.5 min-h-[40px] text-cm-body-medium text-cm-on-surface outline-none transition-colors",
        "hover:bg-cm-backdrop-inset/70 focus:bg-cm-backdrop-inset/70",
        "data-[state=checked]:bg-cm-container-high data-[state=checked]:text-cm-on-surface",
        "data-[disabled]:pointer-events-none data-[disabled]:opacity-38",
        className,
      )}
      {...props}
    >
      {/* Left indicator bar for active/selected item */}
      <SelectPrimitive.ItemIndicator asChild>
        <span className="absolute left-0 top-0 bottom-0 w-[4px] bg-cm-primary block" />
      </SelectPrimitive.ItemIndicator>

      <div className="flex items-center gap-2.5 min-w-0 flex-1 pl-0.5">
        {icon && <span className="shrink-0 text-cm-on-surface-variant-low">{icon}</span>}
        <div className="flex flex-col min-w-0">
          <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
          {description && (
            <span className="text-cm-body-small text-cm-on-surface-variant-low truncate">
              {description}
            </span>
          )}
        </div>
      </div>
      {badge && (
        <div className="flex items-center gap-2 shrink-0">
          {badge}
        </div>
      )}
    </SelectPrimitive.Item>
  );
}

function SelectSeparator({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Separator>) {
  return (
    <SelectPrimitive.Separator
      data-slot="select-separator"
      className={cn("bg-cm-hairline -mx-1 my-1 h-px", className)}
      {...props}
    />
  );
}

function SelectScrollUpButton({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.ScrollUpButton>) {
  return (
    <SelectPrimitive.ScrollUpButton
      data-slot="select-scroll-up-button"
      className={cn("flex cursor-default items-center justify-center py-1 text-cm-on-surface-variant-low", className)}
      {...props}
    >
      <KeyboardArrowUp className="size-4" />
    </SelectPrimitive.ScrollUpButton>
  );
}

function SelectScrollDownButton({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.ScrollDownButton>) {
  return (
    <SelectPrimitive.ScrollDownButton
      data-slot="select-scroll-down-button"
      className={cn("flex cursor-default items-center justify-center py-1 text-cm-on-surface-variant-low", className)}
      {...props}
    >
      <svg viewBox="0 0 24 24" className="size-4 fill-current">
        <path fillRule="evenodd" d="M18 9H6l6 6z" fill="currentColor" />
      </svg>
    </SelectPrimitive.ScrollDownButton>
  );
}

interface SelectFieldProps {
  label?: string;
  placeholder?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  disabled?: boolean;
  isLoading?: boolean;
  value?: string;
  defaultValue?: string;
  onValueChange?: (val: string) => void;
  children?: React.ReactNode;
  className?: string;
  triggerClassName?: string;
  id?: string;
}

function SelectField({
  label,
  placeholder = "Select an option",
  hint,
  error,
  required = false,
  disabled = false,
  isLoading = false,
  value,
  defaultValue,
  onValueChange,
  children,
  className,
  triggerClassName,
  id,
}: SelectFieldProps) {
  const [internalVal, setInternalVal] = React.useState(defaultValue || "");
  const currentVal = value !== undefined ? value : internalVal;
  const hasValue = Boolean(currentVal);

  const handleValueChange = (val: string) => {
    if (value === undefined) setInternalVal(val);
    onValueChange?.(val);
  };

  // useId must run unconditionally; fall back to it only when no id was passed.
  const generatedId = React.useId();
  const fieldId = id || generatedId;

  return (
    <div className={cn("flex flex-col w-full font-sans", className)}>
      <div className="relative">
        <Select
          value={currentVal || undefined}
          onValueChange={handleValueChange}
          disabled={disabled || isLoading}
        >
          {label && (
            <label
              htmlFor={fieldId}
              className={cn(
                "absolute top-0 -translate-y-1/2 left-[10px] z-10 px-1.5 bg-cm-surface text-cm-body-small transition-all pointer-events-none select-none origin-left",
                disabled
                  ? "text-cm-on-surface/38"
                  : error
                  ? "text-cm-status-error"
                  : hasValue
                  ? "text-cm-primary"
                  : "text-cm-on-backdrop-variant",
              )}
            >
              {label}
              {required && <span className="text-cm-status-error ml-0.5">*</span>}
            </label>
          )}

          <SelectTrigger
            id={fieldId}
            className={cn(
              "h-[36px] px-3 rounded-lg border border-cm-outline",
              error && "border-cm-status-error focus:border-cm-status-error focus:ring-cm-status-error/30",
              triggerClassName
            )}
          >
            {isLoading ? (
              <div className="flex items-center gap-2 text-cm-on-surface-variant-low text-cm-body-medium">
                <ProgressActivity className="size-4 animate-spin text-cm-primary" />
                <span>Loading options...</span>
              </div>
            ) : (
              <SelectValue placeholder={placeholder} />
            )}
          </SelectTrigger>

          <SelectContent>
            {children}
          </SelectContent>
        </Select>
      </div>

      {error ? (
        <p className="text-cm-body-small text-cm-status-error mt-1 flex items-start gap-1.5 px-1">
          {/* `mt-px` nudges the 18px mark onto the optical centre of a 16px
              line; `items-start` keeps it on the first line when the message
              wraps rather than floating to the middle of two. */}
          <StatusError aria-hidden className="mt-px size-[18px] shrink-0" />
          {error}
        </p>
      ) : hint ? (
        <p className="text-cm-body-small text-cm-on-backdrop-variant mt-1 px-1">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

interface MultiSelectOption {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
}

interface MultiSelectProps {
  label?: string;
  placeholder?: string;
  options: MultiSelectOption[];
  value?: string[];
  defaultValue?: string[];
  onChange?: (values: string[]) => void;
  hint?: string;
  error?: string;
  required?: boolean;
  disabled?: boolean;
  filterable?: boolean;
  showActions?: boolean;
  className?: string;
  id?: string;
}

function MultiSelect({
  label,
  placeholder = "Select options",
  options,
  value,
  defaultValue = [],
  onChange,
  hint,
  error,
  required = false,
  disabled = false,
  filterable = true,
  showActions = false,
  className,
  id,
}: MultiSelectProps) {
  const [open, setOpen] = React.useState(false);
  const [internalValues, setInternalValues] = React.useState<string[]>(defaultValue);
  const [pendingValues, setPendingValues] = React.useState<string[]>(defaultValue);
  const [filterText, setFilterText] = React.useState("");

  const currentValues = value !== undefined ? value : internalValues;

  const handleToggle = (val: string) => {
    if (showActions) {
      setPendingValues((prev) =>
        prev.includes(val) ? prev.filter((v) => v !== val) : [...prev, val]
      );
    } else {
      const next = currentValues.includes(val)
        ? currentValues.filter((v) => v !== val)
        : [...currentValues, val];
      if (value === undefined) setInternalValues(next);
      onChange?.(next);
    }
  };

  const handleApply = () => {
    if (value === undefined) setInternalValues(pendingValues);
    onChange?.(pendingValues);
    setOpen(false);
  };

  const handleCancel = () => {
    setPendingValues(currentValues);
    setOpen(false);
  };

  const activeValues = showActions ? pendingValues : currentValues;
  const filteredOptions = options.filter((opt) =>
    opt.label.toLowerCase().includes(filterText.toLowerCase())
  );

  const selectedLabels = options
    .filter((opt) => currentValues.includes(opt.value))
    .map((opt) => opt.label);

  // useId must run unconditionally; fall back to it only when no id was passed.
  const generatedId = React.useId();
  const fieldId = id || generatedId;

  return (
    <div className={cn("flex flex-col w-full font-sans relative", className)}>
      <div className="relative">
        {label && (
          <label
            htmlFor={fieldId}
            className={cn(
              "absolute top-0 -translate-y-1/2 left-[10px] z-10 px-1.5 bg-cm-surface text-cm-body-small transition-all pointer-events-none select-none origin-left",
              disabled
                ? "text-cm-on-surface/38"
                : error
                ? "text-cm-status-error"
                : currentValues.length > 0
                ? "text-cm-primary"
                : "text-cm-on-backdrop-variant"
            )}
          >
            {label}
            {required && <span className="text-cm-status-error ml-0.5">*</span>}
          </label>
        )}

        <button
          type="button"
          id={fieldId}
          disabled={disabled}
          onClick={() => {
            if (!disabled) {
              setPendingValues(currentValues);
              setOpen(!open);
            }
          }}
          className={cn(
            "group flex w-full items-center justify-between gap-2 rounded-lg border border-cm-outline bg-cm-surface h-[36px] px-3 text-cm-body-medium text-cm-on-surface transition-all outline-none cursor-pointer text-left",
            "hover:border-cm-outline-active/80 focus:border-2 focus:border-cm-outline-active",
            open && "border-2 border-cm-outline-active",
            disabled && "cursor-not-allowed bg-cm-surface-variant border-cm-hairline/38 text-cm-on-surface/38 opacity-70",
            error && "border-cm-status-error focus:border-cm-status-error focus:ring-cm-status-error/30"
          )}
        >
          <div className="flex items-center gap-1.5 flex-1 min-w-0 overflow-hidden">
            {selectedLabels.length === 0 ? (
              <span className="text-cm-on-surface-variant-low">{placeholder}</span>
            ) : (
              <span className="truncate text-cm-on-surface">
                {selectedLabels.join(", ")}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {selectedLabels.length > 0 && (
              <span className="bg-cm-backdrop-active text-cm-primary text-cm-label-small px-1.5 py-0.5 rounded-full">
                {selectedLabels.length}
              </span>
            )}
            <svg
              viewBox="0 0 24 24"
              className={cn(
                "size-5 fill-cm-on-surface-variant-low shrink-0 transition-transform duration-200",
                open && "rotate-180"
              )}
            >
              <path fillRule="evenodd" d="M18 9H6l6 6z" fill="currentColor" />
            </svg>
          </div>
        </button>

        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <div
              className="absolute left-0 top-full mt-1.5 z-50 w-full min-w-[220px] rounded-[16px] border border-cm-hairline/60 bg-cm-container shadow-cm-elevation overflow-hidden py-1.5 flex flex-col max-h-[320px]"
            >
              {filterable && (
                <div className="px-3 pb-2 pt-1 border-b border-cm-hairline/60">
                  <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg border border-cm-outline/60 bg-cm-surface">
                    <Search className="size-3.5 text-cm-on-surface-variant-low shrink-0" />
                    <input
                      type="text"
                      value={filterText}
                      onChange={(e) => setFilterText(e.target.value)}
                      placeholder="Filter options..."
                      className="w-full text-cm-body-medium bg-transparent outline-none text-cm-on-surface placeholder:text-cm-on-surface-variant-low"
                    />
                    {filterText && (
                      <button type="button" onClick={() => setFilterText("")}>
                        <Close className="size-3 text-cm-on-surface-variant-low hover:text-cm-on-surface" />
                      </button>
                    )}
                  </div>
                </div>
              )}

              <div className="overflow-y-auto flex-1 py-1">
                {filteredOptions.length === 0 ? (
                  <div className="py-4 text-center text-cm-body-small text-cm-on-surface-variant-low">
                    No options found
                  </div>
                ) : (
                  filteredOptions.map((opt) => {
                    const isChecked = activeValues.includes(opt.value);
                    return (
                      <div
                        key={opt.value}
                        onClick={() => !opt.disabled && handleToggle(opt.value)}
                        className={cn(
                          "relative flex items-center gap-3 px-4 py-2.5 min-h-[40px] text-cm-body-medium cursor-pointer transition-colors",
                          "hover:bg-cm-backdrop-inset/70 select-none",
                          isChecked && "bg-cm-container-high",
                          opt.disabled && "opacity-38 cursor-not-allowed pointer-events-none"
                        )}
                      >
                        {isChecked && (
                          <span className="absolute left-0 top-0 bottom-0 w-[4px] bg-cm-primary block" />
                        )}
                        <Checkbox checked={isChecked} disabled={opt.disabled} className="pointer-events-none" />
                        <span className="text-cm-on-surface flex-1 truncate">{opt.label}</span>
                      </div>
                    );
                  })
                )}
              </div>

              {showActions && (
                <div className="flex items-center justify-end gap-2 px-3 pt-2 pb-1 border-t border-cm-hairline/60">
                  <Button variant="ghost" onClick={handleCancel} className="text-cm-body-small">
                    Cancel
                  </Button>
                  <Button variant="default" onClick={handleApply} className="text-cm-body-small">
                    OK
                  </Button>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {error ? (
        <p className="text-cm-body-small text-cm-status-error mt-1 flex items-start gap-1.5 px-1">
          {/* `mt-px` nudges the 18px mark onto the optical centre of a 16px
              line; `items-start` keeps it on the first line when the message
              wraps rather than floating to the middle of two. */}
          <StatusError aria-hidden className="mt-px size-[18px] shrink-0" />
          {error}
        </p>
      ) : hint ? (
        <p className="text-cm-body-small text-cm-on-backdrop-variant mt-1 px-1">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
  SelectField,
  MultiSelect,
};
