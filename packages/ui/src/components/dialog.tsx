"use client"

import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { X } from "lucide-react"

import { cn } from "../lib/cn"
import {
  handleModalInteractOutside,
  useModalNativeDateTimeFocusGuards,
} from "../lib/modal-interact-outside"
import { useDialogPrimaryActionShortcut } from "../hooks/use-dialog-primary-action-shortcut"
import "../styles/dialog-bottom-sheet.css"

const Dialog = DialogPrimitive.Root

const DialogTrigger = DialogPrimitive.Trigger

const DialogPortal = ({
  ...props
}: DialogPrimitive.DialogPortalProps) => (
  <DialogPrimitive.Portal {...props} />
)
DialogPortal.displayName = DialogPrimitive.Portal.displayName

const DialogClose = DialogPrimitive.Close

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    data-slot="dialog-overlay"
    className={cn(
      "fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className
    )}
    {...props}
  />
))
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName

interface DialogContentProps
  extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> {
  hideCloseButton?: boolean;
  mobilePresentation?: "fullscreen" | "bottom-sheet";
  /** When false, Cmd/Ctrl+Enter will not activate the primary footer action. */
  primaryShortcut?: boolean;
}

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  DialogContentProps
>(({ className, children, hideCloseButton = false, mobilePresentation = "fullscreen", primaryShortcut = true, ...props }, ref) => {
  const setDateTimeFocusRef = useModalNativeDateTimeFocusGuards<HTMLDivElement>();
  const contentRef = React.useRef<HTMLDivElement | null>(null);
  useDialogPrimaryActionShortcut(contentRef, primaryShortcut);
  const handleInteractOutside = React.useCallback((e: Event) => {
    handleModalInteractOutside(e);
  }, []);

  const mergedRef = React.useCallback(
    (node: HTMLDivElement | null) => {
      contentRef.current = node;
      setDateTimeFocusRef(node);
      if (typeof ref === 'function') {
        ref(node);
      } else if (ref) {
        ref.current = node;
      }
    },
    [ref, setDateTimeFocusRef]
  );

  const isBottomSheet = mobilePresentation === "bottom-sheet";

  return (
    <DialogPortal>
      <DialogOverlay
        data-mobile-bottom-sheet={isBottomSheet ? "true" : undefined}
        className={cn(isBottomSheet && "max-md:bg-black/60")}
      />
      <DialogPrimitive.Content
        ref={mergedRef}
        data-slot="dialog-content"
        data-primary-shortcut={primaryShortcut ? undefined : "off"}
        data-mobile-bottom-sheet={isBottomSheet ? "true" : undefined}
        className={cn(
          "fixed z-50 gap-4 overflow-x-hidden border bg-background p-4",
          isBottomSheet
            ? cn(
                // Mobile: bottom-anchored sheet — slide up from below (ucat-web nav style)
                "max-md:inset-x-0 max-md:bottom-0 max-md:top-auto max-md:left-0 max-md:right-0 max-md:flex max-md:h-[88dvh] max-md:max-h-[88dvh] max-md:min-h-0 max-md:w-screen max-md:max-w-none max-md:translate-x-0 max-md:flex-col max-md:overflow-hidden max-md:rounded-b-none max-md:rounded-t-3xl max-md:border-0",
                // Desktop: centered modal with zoom
                "md:inset-auto md:left-[50%] md:top-[50%] md:flex md:h-auto md:min-h-0 md:max-h-[calc(100dvh-2rem)] md:w-full md:max-w-lg md:translate-x-[-50%] md:translate-y-[-50%] md:flex-col md:overflow-hidden md:rounded-[var(--radius)] md:duration-200 md:data-[state=open]:animate-in md:data-[state=closed]:animate-out md:data-[state=closed]:fade-out-0 md:data-[state=open]:fade-in-0 md:data-[state=closed]:zoom-out-95 md:data-[state=open]:zoom-in-95 md:data-[state=closed]:slide-out-to-left-1/2 md:data-[state=closed]:slide-out-to-top-[48%] md:data-[state=open]:slide-in-from-left-1/2 md:data-[state=open]:slide-in-from-top-[48%]",
              )
            : cn(
                "inset-0 grid h-[100dvh] w-screen max-w-none translate-x-0 translate-y-0 overflow-y-auto duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom sm:left-[50%] sm:top-[50%] sm:right-auto sm:bottom-auto sm:h-auto sm:min-h-0 sm:max-h-[calc(100dvh-2rem)] sm:w-full sm:max-w-lg sm:translate-x-[-50%] sm:translate-y-[-50%] sm:data-[state=closed]:zoom-out-95 sm:data-[state=open]:zoom-in-95 sm:data-[state=closed]:slide-out-to-left-1/2 sm:data-[state=closed]:slide-out-to-top-[48%] sm:data-[state=open]:slide-in-from-left-1/2 sm:data-[state=open]:slide-in-from-top-[48%] sm:rounded-[var(--radius)]",
                "max-sm:!fixed max-sm:!inset-0 max-sm:!bottom-0 max-sm:!left-0 max-sm:!right-0 max-sm:!top-0 max-sm:!h-[100dvh] max-sm:!max-h-[100dvh] max-sm:!min-h-[100dvh] max-sm:!w-screen max-sm:!max-w-none max-sm:!translate-x-0 max-sm:!translate-y-0 max-sm:!rounded-none",
              ),
          className,
        )}
        onInteractOutside={handleInteractOutside}
        onPointerDownOutside={handleInteractOutside}
        {...props}
      >
        {children}
        {!hideCloseButton ? (
          <DialogPrimitive.Close className="absolute left-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-muted dark:data-[state=open]:bg-white/[0.11] data-[state=open]:text-muted-foreground sm:left-auto sm:right-4">
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        ) : null}
      </DialogPrimitive.Content>
    </DialogPortal>
  );
})
DialogContent.displayName = DialogPrimitive.Content.displayName

const DialogHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    data-slot="dialog-header"
    className={cn(
      "flex flex-col space-y-1.5 text-left",
      className
    )}
    {...props}
  />
)
DialogHeader.displayName = "DialogHeader"

const DialogFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    data-slot="dialog-footer"
    className={cn(
      "flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2",
      className
    )}
    {...props}
  />
)
DialogFooter.displayName = "DialogFooter"

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn(
      "text-lg font-semibold leading-none tracking-tight",
      className
    )}
    {...props}
  />
))
DialogTitle.displayName = DialogPrimitive.Title.displayName

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
))
DialogDescription.displayName = DialogPrimitive.Description.displayName

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
}
