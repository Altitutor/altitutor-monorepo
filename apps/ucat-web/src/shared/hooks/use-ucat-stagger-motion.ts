"use client";

import { useMemo } from "react";
import { useReducedMotion } from "motion/react";

const STAGGER_EASE = [0.32, 0.72, 0, 1] as const;

/** Staggered fade-up reveal for sidebar page content (dashboard, lists, hubs, etc.). */
export function useUcatStaggerMotion() {
  // useReducedMotion() is null until the media query resolves. null and false both
  // mean "allow motion" — normalize so variant object identity stays stable.
  // Otherwise Motion sees new `variants` and restarts the stagger (a visible flash).
  const reduceMotionPreference = useReducedMotion();
  const reduceMotion = reduceMotionPreference === true;

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
