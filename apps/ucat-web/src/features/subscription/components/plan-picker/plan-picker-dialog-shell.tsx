"use client";

import type { ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";
import { ArrowLeft } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@altitutor/ui";
import { planPickerDialogChrome } from "./plan-picker-surface-theme";
import { cn } from "@/lib/utils";

type PlanPickerDialogShellProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  /** When false, blocks outside click, escape, and programmatic close via onOpenChange(false). */
  dismissible?: boolean;
  hideCloseButton?: boolean;
  hideBackButton?: boolean;
  footer?: ReactNode;
  fullScreen?: boolean;
};

export function PlanPickerDialogShell({
  open,
  onOpenChange,
  title,
  description,
  children,
  dismissible = true,
  hideCloseButton = false,
  hideBackButton = false,
  footer,
  fullScreen = false,
}: PlanPickerDialogShellProps) {
  const reduceMotion = useReducedMotion();

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && !dismissible) return;
    onOpenChange(nextOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className={planPickerDialogChrome(
          fullScreen
            ? "!inset-0 !left-0 !top-0 !h-dvh !max-h-dvh !w-screen !max-w-none !translate-x-0 !translate-y-0 !rounded-none sm:!inset-0 sm:!left-0 sm:!top-0 sm:!h-dvh sm:!max-h-dvh sm:!w-screen sm:!max-w-none sm:!translate-x-0 sm:!translate-y-0 sm:!rounded-none"
            : undefined,
        )}
        hideCloseButton={hideCloseButton || fullScreen}
        style={
          fullScreen
            ? {
                inset: 0,
                left: 0,
                top: 0,
                right: 0,
                bottom: 0,
                width: "100%",
                minWidth: "100vw",
                height: "100dvh",
                maxWidth: "none",
                maxHeight: "none",
                transform: "none",
                borderRadius: 0,
              }
            : undefined
        }
        {...(dismissible
          ? {}
          : {
              onInteractOutside: (event) => {
                event.preventDefault();
              },
              onPointerDownOutside: (event) => {
                event.preventDefault();
              },
              onEscapeKeyDown: (event) => {
                event.preventDefault();
              },
            })}
      >
        <motion.div
          initial={(reduceMotion ?? false) ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: (reduceMotion ?? false) ? 0 : 0.28,
            ease: [0.32, 0.72, 0, 1],
          }}
        >
          {fullScreen && !hideBackButton ? (
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground transition hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" /> Back
            </button>
          ) : null}
          <DialogHeader className="text-left">
            <DialogTitle>{title}</DialogTitle>
            {description ? (
              <DialogDescription>{description}</DialogDescription>
            ) : null}
          </DialogHeader>
          <div className="mt-4">{children}</div>
          {footer ? <div className="mt-6">{footer}</div> : null}
        </motion.div>
      </DialogContent>
    </Dialog>
  );
}

export function planPickerCardMotionProps(reduceMotion: boolean) {
  return {
    variants: {
      hidden: reduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 14 },
      show: {
        opacity: 1,
        y: 0,
        transition: {
          duration: reduceMotion ? 0 : 0.28,
          ease: [0.32, 0.72, 0, 1] as const,
        },
      },
    },
  };
}

export function PlanPickerAnimatedCard({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  const reduceMotion = useReducedMotion();
  const motionProps = planPickerCardMotionProps(reduceMotion ?? false);

  return (
    <motion.div className={cn("h-full", className)} {...motionProps}>
      {children}
    </motion.div>
  );
}
