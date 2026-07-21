"use client";

import React from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

type AnimatedStepPanelProps = {
  stepKey: string | number;
  direction: number;
  children: React.ReactNode;
  className?: string;
  morphLayout?: boolean;
  slide?: boolean;
};

/** GPU-friendly step transition using opacity and translateX only. */
export function AnimatedStepPanel({
  stepKey,
  direction,
  children,
  className,
  morphLayout = false,
  slide = true,
}: AnimatedStepPanelProps) {
  const reduceMotion = useReducedMotion();

  return (
    <AnimatePresence
      mode={morphLayout ? "popLayout" : "wait"}
      custom={direction}
    >
      <motion.div
        key={stepKey}
        custom={direction}
        initial={
          reduceMotion
            ? { opacity: 1, x: 0 }
            : { opacity: 0, x: slide ? direction * 28 : 0 }
        }
        animate={{ opacity: 1, x: 0 }}
        exit={
          reduceMotion
            ? { opacity: 1, x: 0 }
            : { opacity: 0, x: slide ? direction * -28 : 0 }
        }
        transition={{
          duration: reduceMotion ? 0 : 0.26,
          ease: [0.22, 1, 0.36, 1],
        }}
        className={cn("w-full", className)}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
