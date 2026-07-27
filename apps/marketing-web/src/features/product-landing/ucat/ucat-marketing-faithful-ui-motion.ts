"use client";

import { useReducedMotion } from "motion/react";

export function useFaithfulMotion() {
  const reduceMotion = useReducedMotion();
  return { animate: !reduceMotion, reduceMotion: reduceMotion ?? false };
}
