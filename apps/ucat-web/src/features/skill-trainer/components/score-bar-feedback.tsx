"use client";

import { AnimatePresence, motion } from "motion/react";
import { cn } from "@/lib/utils";

export function ScoreBarFeedback({
  feedback,
}: {
  feedback: "correct" | "incorrect" | null;
}) {
  return (
    <AnimatePresence mode="wait">
      {feedback ? (
        <motion.span
          key={feedback}
          initial={{ scale: 0.75, opacity: 0, x: -4 }}
          animate={{ scale: 1, opacity: 1, x: 0 }}
          exit={{ scale: 0.85, opacity: 0, x: 4 }}
          transition={{ type: "spring", stiffness: 500, damping: 28 }}
          className={cn(
            "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold shadow-sm",
            feedback === "correct"
              ? "bg-green-500 text-white"
              : "bg-red-500 text-white",
          )}
        >
          <motion.span
            animate={{ rotate: feedback === "correct" ? [0, -12, 12, 0] : [0, 4, -4, 0] }}
            transition={{ duration: 0.35 }}
            aria-hidden
          >
            {feedback === "correct" ? "✓" : "✗"}
          </motion.span>
          {feedback === "correct" ? "Correct!" : "Wrong"}
        </motion.span>
      ) : null}
    </AnimatePresence>
  );
}
