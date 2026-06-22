"use client";

import { useMemo } from "react";
import { useReducedMotion } from "motion/react";

const STAGGER_EASE = [0.32, 0.72, 0, 1] as const;

/** Staggered fade-up reveal — matches dashboard, settings, and sessions list pages. */
export function useUcatStaggerMotion() {
  const reduceMotion = useReducedMotion();

  const containerVariants = useMemo(
    () => ({
      hidden: {},
      show: {
        transition: {
          staggerChildren: reduceMotion ? 0 : 0.04,
          delayChildren: reduceMotion ? 0 : 0.03,
        },
      },
    }),
    [reduceMotion],
  );

  const itemVariants = useMemo(
    () => ({
      hidden: reduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 8 },
      show: {
        opacity: 1,
        y: 0,
        transition: {
          duration: reduceMotion ? 0 : 0.2,
          ease: STAGGER_EASE,
        },
      },
    }),
    [reduceMotion],
  );

  return { containerVariants, itemVariants, reduceMotion };
}
