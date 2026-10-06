"use client"

import * as React from "react"
import * as AlertDialogPrimitive from "@radix-ui/react-alert-dialog"
import * as DialogPrimitive from "@radix-ui/react-dialog"

import { cn } from "../lib/cn"
import { handleModalInteractOutside } from "../lib/modal-interact-outside"
import {
  DIALOG_CANCEL_ATTR,
  DIALOG_PRIMARY_ACTION_ATTR,
} from "../lib/dialog-primary-shortcut"
import { useDialogPrimaryActionShortcut } from "../hooks/use-dialog-primary-action-shortcut"
import { buttonVariants } from "./button"

import { Dialog, DialogContent } from "./dialog"
import { useDialogScope } from "./dialog-scope"

// Radix AlertDialog always locks the document. Use its nonmodal Dialog counterpart
// inside a pane, preserving explicit confirmation and cancellation.
const ScopedAlertContext = React.createContext(false);
const AlertDialog = (props: React.ComponentProps<typeof AlertDialogPrimitive.Root>) => {
  const scoped = Boolean(useDialogScope());
  return (
    <ScopedAlertContext.Provider value={scoped}>
      {scoped ? <Dialog {...props} /> : <AlertDialogPrimitive.Root {...props} />}
    </ScopedAlertContext.Provider>
  );
}

const AlertDialogTrigger = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Trigger>
>((props, ref) => React.useContext(ScopedAlertContext)
  ? <DialogPrimitive.Trigger {...props} ref={ref} />
  : <AlertDialogPrimitive.Trigger {...props} ref={ref} />);
AlertDialogTrigger.displayName = "AlertDialogTrigger";

const AlertDialogPortal = AlertDialogPrimitive.Portal

const AlertDialogOverlay = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Overlay
    className={cn(
      "fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className
    )}
    {...props}
    ref={ref}
  />
))
AlertDialogOverlay.displayName = AlertDialogPrimitive.Overlay.displayName

type AlertDialogContentProps = React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Content> & {
  onInteractOutside?: (event: Event) => void;
  /** When false, Cmd/Ctrl+Enter will not activate the primary footer action. */
  primaryShortcut?: boolean;
};

const AlertDialogContent = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Content>,
  AlertDialogContentProps
>(({ className, onInteractOutside, primaryShortcut = true, ...props }, ref) => {
  const scoped = React.useContext(ScopedAlertContext);
  const contentRef = React.useRef<HTMLDivElement | null>(null);
  useDialogPrimaryActionShortcut(contentRef, primaryShortcut && !scoped);

  const handleInteractOutside = React.useCallback((e: Event) => {
    handleModalInteractOutside(e);
    onInteractOutside?.(e);
  }, [onInteractOutside]);

  const mergedRef = React.useCallback(
    (node: HTMLDivElement | null) => {
      contentRef.current = node;
      if (typeof ref === "function") {
        ref(node);
      } else if (ref) {
        ref.current = node;
      }
    },
    [ref],
  );

  const contentProps: React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Content> & {
    onInteractOutside?: (event: Event) => void;
  } = {
    ...props,
    onInteractOutside: handleInteractOutside,
  };

  if (scoped) {
    return (
      <DialogContent
        {...props}
        ref={mergedRef}
        role="alertdialog"
        hideCloseButton
        dismissOnOverlay={false}
        primaryShortcut={primaryShortcut}
        className={className}
        onInteractOutside={handleInteractOutside}
        onOpenAutoFocus={(event) => {
          props.onOpenAutoFocus?.(event);
          if (!event.defaultPrevented) {
            event.preventDefault();
            contentRef.current?.querySelector<HTMLElement>(`[${DIALOG_CANCEL_ATTR}]`)?.focus();
          }
        }}
      />
    );
  }

  return (
    <AlertDialogPortal>
      <AlertDialogOverlay />
      <AlertDialogPrimitive.Content
        ref={mergedRef}
        data-slot="alert-dialog-content"
        data-primary-shortcut={primaryShortcut ? undefined : "off"}
        className={cn(
          "fixed inset-0 z-50 grid h-[100dvh] w-screen max-w-none translate-x-0 translate-y-0 gap-4 overflow-y-auto overflow-x-hidden border bg-background p-4 duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom sm:left-[50%] sm:top-[50%] sm:right-auto sm:bottom-auto sm:h-auto sm:min-h-0 sm:max-h-[calc(100dvh-2rem)] sm:w-full sm:max-w-lg sm:translate-x-[-50%] sm:translate-y-[-50%] sm:data-[state=closed]:zoom-out-95 sm:data-[state=open]:zoom-in-95 sm:data-[state=closed]:slide-out-to-left-1/2 sm:data-[state=closed]:slide-out-to-top-[48%] sm:data-[state=open]:slide-in-from-left-1/2 sm:data-[state=open]:slide-in-from-top-[48%] sm:rounded-[var(--radius)]",
          className,
          "max-sm:!fixed max-sm:!inset-0 max-sm:!bottom-0 max-sm:!left-0 max-sm:!right-0 max-sm:!top-0 max-sm:!h-[100dvh] max-sm:!max-h-[100dvh] max-sm:!min-h-[100dvh] max-sm:!w-screen max-sm:!max-w-none max-sm:!translate-x-0 max-sm:!translate-y-0 max-sm:!rounded-none"
        )}
        {...(contentProps as React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Content>)}
      />
    </AlertDialogPortal>
  );
})
AlertDialogContent.displayName = AlertDialogPrimitive.Content.displayName

const AlertDialogHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    data-slot="alert-dialog-header"
    className={cn(
      "flex flex-col space-y-2 text-center sm:text-left",
      className
    )}
    {...props}
  />
)
AlertDialogHeader.displayName = "AlertDialogHeader"

const AlertDialogFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    data-slot="alert-dialog-footer"
    className={cn(
      "flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2",
      className
    )}
    {...props}
  />
)
AlertDialogFooter.displayName = "AlertDialogFooter"

const AlertDialogTitle = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Title>
>(({ className, ...props }, ref) => {
  const Component = React.useContext(ScopedAlertContext) ? DialogPrimitive.Title : AlertDialogPrimitive.Title;
  return (
    <Component
      ref={ref}
      className={cn("text-lg font-semibold", className)}
      {...props}
    />
  );
})
AlertDialogTitle.displayName = AlertDialogPrimitive.Title.displayName

const AlertDialogDescription = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Description>
>(({ className, ...props }, ref) => {
  const Component = React.useContext(ScopedAlertContext) ? DialogPrimitive.Description : AlertDialogPrimitive.Description;
  return (
    <Component
      ref={ref}
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  );
})
AlertDialogDescription.displayName =
  AlertDialogPrimitive.Description.displayName

const AlertDialogAction = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>(({ className, ...props }, ref) => (
  <button
    ref={ref}
    className={cn(buttonVariants(), className)}
    {...{ [DIALOG_PRIMARY_ACTION_ATTR]: "" }}
    {...props}
  />
))
AlertDialogAction.displayName = "AlertDialogAction"

const AlertDialogCancel = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Cancel>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Cancel>
>(({ className, ...props }, ref) => {
  const Component = React.useContext(ScopedAlertContext) ? DialogPrimitive.Close : AlertDialogPrimitive.Cancel;
  return (
    <Component
      ref={ref}
      className={cn(
        buttonVariants({ variant: "outline" }),
        "mt-2 sm:mt-0",
        className
      )}
      {...{ [DIALOG_CANCEL_ATTR]: "" }}
      {...props}
    />
  );
})
AlertDialogCancel.displayName = AlertDialogPrimitive.Cancel.displayName

export {
  AlertDialog,
  AlertDialogPortal,
  AlertDialogOverlay,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
}
