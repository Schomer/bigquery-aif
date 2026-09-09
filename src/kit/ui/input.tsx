import * as React from "react";
import { HelpButton } from "./help-button";
import { cn } from "./utils";

export interface InputProps extends Omit<React.ComponentProps<"input">, "prefix"> {
  label?: string;
  prefix?: React.ReactNode;
  suffix?: React.ReactNode;
  code?: boolean;
  numericOnly?: boolean;
  clearable?: boolean;
  refreshable?: boolean;
  onRefresh?: () => void;
  helpText?: string;
  /** Renders a `HelpButton` in the suffix cluster. A string becomes the panel's prose. */
  helpButtonTooltip?: React.ReactNode;
  disabledTooltip?: string;
  maxLength?: number;
  isPassword?: boolean;
  wrapperClassName?: string;
  labelBgClassName?: string;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      type = "text",
      label,
      prefix,
      suffix,
      code = false,
      numericOnly = false,
      clearable = false,
      refreshable = false,
      onRefresh,
      helpText,
      helpButtonTooltip,
      disabledTooltip,
      maxLength,
      isPassword = false,
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
    const [showPassword, setShowPassword] = React.useState(false);
    const prefixRef = React.useRef<HTMLDivElement>(null);
    const [prefixWidth, setPrefixWidth] = React.useState(0);

    React.useEffect(() => {
      if (prefixRef.current) {
        setPrefixWidth(prefixRef.current.offsetWidth);
      } else {
        setPrefixWidth(0);
      }
    }, [prefix]);

    // Support both controlled and uncontrolled value tracking for floating label
    const [internalValue, setInternalValue] = React.useState(
      value ?? defaultValue ?? ""
    );

    React.useEffect(() => {
      if (value !== undefined) {
        setInternalValue(value);
      }
    }, [value]);

    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
      setIsFocused(true);
      onFocus?.(e);
    };

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      setIsFocused(false);
      onBlur?.(e);
    };

    const handleValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      let val = e.target.value;

      if (numericOnly) {
        // Only allow numbers, decimals, and negative sign
        val = val.replace(/[^0-9.-]/g, "");
      }

      setInternalValue(val);

      if (onChange) {
        // Pass modified event back if numerical check triggered
        const syntheticEvent = {
          ...e,
          target: {
            ...e.target,
            value: val,
          },
        } as React.ChangeEvent<HTMLInputElement>;
        onChange(syntheticEvent);
      }
    };

    const handleClear = () => {
      setInternalValue("");
      if (onChange) {
        const syntheticEvent = {
          target: { value: "" },
        } as React.ChangeEvent<HTMLInputElement>;
        onChange(syntheticEvent);
      }
    };

    const hasValue = internalValue !== "";
    const finalLabel = label || placeholder;
    const isFloating = isFocused || hasValue || type === "date";
    const nativePlaceholder = isFloating && label ? placeholder : undefined;

    // Determine actual type of input tag
    let inputType = type;
    if (isPassword) {
      inputType = showPassword ? "text" : "password";
    }

    return (
      <div className={cn("flex flex-col w-full font-sans", wrapperClassName)}>
        {/* Main Outlined Input Wrapper */}
        <div
          className={cn(
            "relative flex items-center w-full rounded-lg bg-cm-surface transition-all h-[36px]",
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
                  ? cn("top-0 -translate-y-1/2 text-cm-body-small text-cm-primary", labelBgClassName || "bg-cm-surface")
                  : "top-1/2 -translate-y-1/2 text-cm-body-medium text-cm-on-backdrop-variant"
              )}
              style={{
                left: isFloating ? "10px" : `${prefixWidth > 0 ? prefixWidth : 12}px`
              }}
            >
              {finalLabel}
            </label>
          )}

          {/* Left Prefix */}
          {prefix && (
            <div
              ref={prefixRef}
              className="flex items-center justify-center pl-3 pr-1 text-cm-on-backdrop-variant shrink-0 select-none"
            >
              {prefix}
            </div>
          )}

          {/* Core Input Element */}
          <input
            ref={ref}
            type={inputType}
            disabled={disabled}
            placeholder={nativePlaceholder}
            value={value !== undefined ? value : internalValue}
            onChange={handleValueChange}
            onFocus={handleFocus}
            onBlur={handleBlur}
            maxLength={maxLength}
            className={cn(
              "w-full h-full bg-transparent text-cm-body-medium text-cm-on-surface outline-none border-none placeholder:text-cm-on-surface-variant-low",
              prefix ? "pl-1.5" : "pl-3",
              suffix || clearable || refreshable || isPassword ? "pr-1.5" : "pr-3",
              // `text-cm-code` is the token; `font-mono` is the family it is
              // meant to be set in, and `tracking-wide` is the same exception
              // MENU_SHORTCUT takes — an ID or a key is scanned character by
              // character, so the characters have to come apart.
              code && "font-mono text-cm-code tracking-wide",
              disabled && "cursor-not-allowed text-cm-on-surface/38"
            )}
            {...props}
          />

          {/* Suffix Area */}
          {(suffix || clearable || refreshable || isPassword || helpButtonTooltip) && (
            <div className="flex items-center gap-1.5 pr-2.5 pl-1 text-cm-on-backdrop-variant shrink-0 select-none">
              {/* Clear button if enabled and has value */}
              {clearable && hasValue && !disabled && (
                <button
                  type="button"
                  onClick={handleClear}
                  className="p-1 rounded-full hover:bg-cm-container text-cm-on-surface-variant-low hover:text-cm-on-surface-variant transition-colors"
                  title="Clear input"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </button>
              )}

              {/* Refresh button if refreshable */}
              {refreshable && !disabled && (
                <button
                  type="button"
                  onClick={onRefresh}
                  className="p-1 rounded-full hover:bg-cm-container text-cm-on-surface-variant hover:text-cm-primary transition-colors"
                  title="Refresh value"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
                  </svg>
                </button>
              )}

              {/* Password eye toggle */}
              {isPassword && !disabled && (
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="p-1 rounded-full hover:bg-cm-container text-cm-on-surface-variant hover:text-cm-primary transition-colors"
                  title={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              )}

              {/* Help button icon with tooltip */}
              {helpButtonTooltip && (
                <HelpButton label={label ? `About ${label}` : "Help"}>
                  {helpButtonTooltip}
                </HelpButton>
              )}

              {/* Standard Custom Suffix */}
              {suffix}
            </div>
          )}
        </div>

        {/* Footer Area: Helper Text / Validation / Character Counter */}
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

Input.displayName = "Input";

export { Input };
