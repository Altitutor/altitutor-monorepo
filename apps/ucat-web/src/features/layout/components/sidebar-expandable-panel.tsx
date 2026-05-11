"use client";

import { type ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";

type SidebarExpandablePanelProps = {
  expanded: boolean;
  children: ReactNode;
};

/**
 * Smooth height open/close for sidebar sub-nav without measuring content.
 * Uses CSS grid 0fr → 1fr, which Motion can interpolate.
 */
export function SidebarExpandablePanel({
  expanded,
  children,
}: SidebarExpandablePanelProps) {
  const reduceMotion = useReducedMotion();
  const duration = reduceMotion ? 0 : 0.22;

  return (
    <motion.div
      className="grid"
      initial={false}
      animate={{ gridTemplateRows: expanded ? "1fr" : "0fr" }}
      transition={{
        duration,
        ease: [0.32, 0.72, 0, 1],
      }}
    >
      <div className="min-h-0 overflow-hidden">{children}</div>
    </motion.div>
  );
}
