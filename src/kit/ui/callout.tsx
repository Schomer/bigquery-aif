import * as React from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { Close } from "./material-symbols";
import { cn } from "./utils";
import { Button, type ButtonProps } from "./button";

function CalloutProvider({ children }: { children?: React.ReactNode }) {
  return <>{children}</>;
}

function Callout({
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Root>) {
  return <PopoverPrimitive.Root data-slot="callout" {...props} />;
}

function CalloutTrigger({
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Trigger>) {
  return <PopoverPrimitive.Trigger data-slot="callout-trigger" {...props} />;
}

function CalloutContent({
  className,
  align = "start",
  sideOffset = 8,
  children,
  showClose = true,
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Content> & {
  showClose?: boolean;
}) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        data-slot="callout-content"
        align={align}
        sideOffset={sideOffset}
        className={cn(
          "w-[350px] max-w-[calc(100vw-36px)] bg-cm-primary text-cm-on-primary rounded-[12px] p-4 shadow-cm-elevation z-[999] select-text data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 origin-(--radix-popover-content-transform-origin) outline-none relative",
          className,
        )}
        {...props}
      >
        {children}
        {showClose && (
          <PopoverPrimitive.Close
            className="size-[18px] absolute top-4 right-4 flex items-center justify-center text-cm-on-primary/80 hover:text-cm-on-primary hover:bg-cm-on-primary/10 rounded-full transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-cm-on-primary/50"
            aria-label="Close callout"
            title="Close"
          >
            <Close weight={700} className="size-[18px]" />
          </PopoverPrimitive.Close>
        )}
        <PopoverPrimitive.Arrow className="fill-cm-primary z-[999]" width={16} height={8} />
      </PopoverPrimitive.Content>
    </PopoverPrimitive.Portal>
  );
}

function CalloutHeader({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="callout-header"
      className={cn("flex items-start justify-between pr-6", className)}
      {...props}
    />
  );
}

function CalloutTitle({
  className,
  ...props
}: React.ComponentProps<"h2">) {
  return (
    <h2
      data-slot="callout-title"
      className={cn(
        "text-cm-title-small text-cm-on-primary",
        className
      )}
      {...props}
    />
  );
}

function CalloutDescription({
  className,
  ...props
}: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="callout-description"
      className={cn(
        "text-cm-body-medium text-cm-on-primary mt-3",
        className
      )}
      {...props}
    />
  );
}

function CalloutShortcut({
  className,
  ...props
}: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="callout-shortcut"
      className={cn(
        "text-cm-body-medium text-cm-on-primary/95 mt-3.5",
        className
      )}
      {...props}
    />
  );
}

function CalloutFooter({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="callout-footer"
      className={cn("flex items-center justify-between mt-4 gap-3 flex-wrap", className)}
      {...props}
    />
  );
}

function CalloutSteps({
  className,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="callout-steps"
      className={cn("text-cm-body-medium text-cm-on-primary select-none", className)}
      {...props}
    />
  );
}

function CalloutActions({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="callout-actions"
      className={cn("flex items-center gap-2 flex-wrap", className)}
      {...props}
    />
  );
}

function CalloutButton({ className, variant = "outline", size, ...props }: ButtonProps) {
  return (
    <Button
      data-slot="callout-button"
      variant={variant}
      size={size}
      className={cn(
        "border-cm-on-primary/80 text-cm-on-primary hover:bg-cm-on-primary/15 hover:text-cm-on-primary border focus-visible:ring-cm-on-primary/50 text-cm-body-medium px-3.5 bg-transparent",
        className,
      )}
      {...props}
    />
  );
}

function CalloutClose({
  className,
  children,
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Close>) {
  return (
    <PopoverPrimitive.Close
      data-slot="callout-close"
      asChild
      {...props}
    >
      {children ? (
        children
      ) : (
        <CalloutButton className={className}>Got it</CalloutButton>
      )}
    </PopoverPrimitive.Close>
  );
}

export {
  Callout,
  CalloutTrigger,
  CalloutContent,
  CalloutHeader,
  CalloutTitle,
  CalloutDescription,
  CalloutShortcut,
  CalloutFooter,
  CalloutSteps,
  CalloutActions,
  CalloutButton,
  CalloutClose,
  CalloutProvider,
};
