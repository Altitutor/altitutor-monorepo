"use client";

import type { ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";
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
};

export function PlanPickerDialogShell({
  open,
  onOpenChange,
  title,
  description,
  children,
}: PlanPickerDialogShellProps) {
  const reduceMotion = useReducedMotion();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={planPickerDialogChrome()}>
        <motion.div
          initial={(reduceMotion ?? false) ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: (reduceMotion ?? false) ? 0 : 0.28,
            ease: [0.32, 0.72, 0, 1],
          }}
        >
          <DialogHeader className="text-left">
            <DialogTitle>{title}</DialogTitle>
            {description ? (
              <DialogDescription>{description}</DialogDescription>
            ) : null}
          </DialogHeader>
          <div className="mt-4">{children}</div>
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
