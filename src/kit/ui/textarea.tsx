import * as React from "react";
import { cn } from "./utils";

export interface TextareaProps extends React.ComponentProps<"textarea"> {
  label?: string;
  helpText?: string;
  disabledTooltip?: string;
  maxLength?: number;
  wrapperClassName?: string;
  labelBgClassName?: string;
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  (
    {
      className,
      label,
      helpText,
      disabledTooltip,
      maxLength,
      wrapperClassName,
      labelBgClassName,
      disabled,
      placeholder,
      value,
      defaultValue,
      onChange,
      onFocus,
      onBlur,
      ...props
    },
    ref
  ) => {
    const [isFocused, setIsFocused] = React.useState(false);

    // Support both controlled and uncontrolled value tracking for floating label
    const [internalValue, setInternalValue] = React.useState(
      value ?? defaultValue ?? ""
    );

    React.useEffect(() => {
      if (value !== undefined) {
        setInternalValue(value);
      }
    }, [value]);

    const handleFocus = (e: React.FocusEvent<HTMLTextAreaElement>) => {
      setIsFocused(true);
      onFocus?.(e);
    };

    const handleBlur = (e: React.FocusEvent<HTMLTextAreaElement>) => {
      setIsFocused(false);
      onBlur?.(e);
    };

    const handleValueChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setInternalValue(e.target.value);
      onChange?.(e);
    };

    const hasValue = internalValue !== "";
    const finalLabel = label || placeholder;
    const isFloating = isFocused || hasValue;
    const nativePlaceholder = isFloating && label ? placeholder : undefined;

    return (
      <div className={cn("flex flex-col w-full font-sans", wrapperClassName)}>
        {/* Main Outlined Textarea Wrapper */}
        <div
          className={cn(
            "relative flex items-start w-full rounded-lg bg-cm-surface transition-all min-h-[80px]",
            isFocused
              ? "border-2 border-cm-outline-active"
              : "border border-cm-outline",
            !isFocused && !disabled && "hover:border-cm-outline-active/80",
            disabled && "border border-cm-hairline/38 bg-cm-surface-variant cursor-not-allowed opacity-70",
            className
          )}
          title={disabled ? disabledTooltip : undefined}
        >
          {/* Floating Label */}
          {finalLabel && (
            <label
              className={cn(
                "absolute transition-all duration-150 pointer-events-none select-none origin-left px-1.5",
                isFloating
                  ? cn("top-0 -translate-y-1/2 left-2.5 text-cm-body-small text-cm-primary", labelBgClassName || "bg-cm-surface")
                  : "top-3 text-cm-body-medium text-cm-on-backdrop-variant left-3"
              )}
            >
              {finalLabel}
            </label>
          )}

          {/* Core Textarea Element */}
          <textarea
            ref={ref}
            disabled={disabled}
            placeholder={nativePlaceholder}
            value={value !== undefined ? value : internalValue}
            onChange={handleValueChange}
            onFocus={handleFocus}
            onBlur={handleBlur}
            maxLength={maxLength}
            className={cn(
              "w-full bg-transparent text-cm-body-medium text-cm-on-surface outline-none border-none placeholder:text-cm-on-surface-variant-low resize-y min-h-[72px] px-3 py-2.5 mt-0.5",
              disabled && "cursor-not-allowed text-cm-on-surface/38"
            )}
            {...props}
          />
        </div>

        {/* Footer Area: Helper Text / Character Counter */}
        {(helpText || maxLength !== undefined) && (
          <div className="flex items-start justify-between gap-4 mt-1 px-1 select-none">
            {helpText ? (
              <p className="text-cm-body-small text-cm-on-backdrop-variant">{helpText}</p>
            ) : (
              <div />
            )}
            {maxLength !== undefined && (
              <span className="text-cm-code text-cm-on-surface-variant-low font-mono shrink-0">
                {String(internalValue).length} / {maxLength}
              </span>
            )}
          </div>
        )}
      </div>
    );
  }
);

Textarea.displayName = "Textarea";

export { Textarea };
