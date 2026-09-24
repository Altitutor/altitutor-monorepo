"use client";

import { AnimatePresence, motion } from "motion/react";
import { cn } from "@/lib/utils";

export function ScoreBarFeedback({
  feedback,
  origin,
}: {
  feedback: "correct" | "incorrect" | null;
  origin: { id: number; x: number; y: number } | null;
}) {
  return (
    <AnimatePresence mode="wait">
      {feedback ? (
        <motion.span
          key={`${feedback}-${origin?.id ?? 0}`}
          initial={{ scale: 0.75, opacity: 0, y: 10 }}
          animate={{ scale: 1, opacity: 1, y: -18 }}
          exit={{ scale: 0.85, opacity: 0, y: -34 }}
          transition={{ type: "spring", stiffness: 500, damping: 28 }}
          style={{
            left: origin?.x ?? "50%",
            top: origin?.y ?? "45%",
          }}
          className={cn(
            "pointer-events-none fixed z-50 inline-flex -translate-x-1/2 -translate-y-1/2 items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold shadow-lg",
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

export function ScoreDeltaFeedback({
  delta,
}: {
  delta: { id: number; value: number } | null;
}) {
  const magnitude = Math.abs(delta?.value ?? 0);
  const sizeClass =
    magnitude >= 30
      ? "px-3 py-1 text-base"
      : magnitude >= 10
      ? "px-2.5 py-0.5 text-sm"
      : "px-2 py-0.5 text-xs";
  const lift = magnitude >= 30 ? -18 : magnitude >= 10 ? -14 : -10;

  return (
    <AnimatePresence>
      {delta && delta.value !== 0 ? (
        <motion.span
          key={delta.id}
          initial={{ opacity: 0, y: 8, scale: 0.85 }}
          animate={{ opacity: 1, y: lift, scale: magnitude >= 30 ? 1.12 : 1 }}
          exit={{ opacity: 0, y: lift - 16, scale: 0.95 }}
          transition={{ type: "spring", stiffness: 420, damping: 30 }}
          className={cn(
            "inline-flex rounded-full font-black tabular-nums shadow-sm ring-1",
            sizeClass,
            delta.value > 0
              ? "bg-green-500 text-white ring-green-400/70"
              : "bg-red-500 text-white ring-red-400/70",
          )}
        >
          {delta.value > 0 ? "+" : ""}
          {delta.value}
        </motion.span>
      ) : null}
    </AnimatePresence>
  );
}
