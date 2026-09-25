"use client";

import { useReducedMotion } from "motion/react";
import { usePreviewActivity } from "./preview-activity";

export function useFaithfulMotion() {
  const reduceMotion = useReducedMotion();
  const active = usePreviewActivity();
  return {
    animate: active && !reduceMotion,
    reduceMotion: !active || (reduceMotion ?? false),
  };
}
