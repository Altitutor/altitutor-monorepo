"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";

const SHORTCUTS = [
  { keys: ["A", "B", "C", "D"], label: "Choose an answer" },
  { keys: ["Alt", "C"], label: "Open or close the calculator" },
  { keys: ["Alt", "F"], label: "Flag the current question" },
  { keys: ["Alt", "P"], label: "Go to the previous question" },
  { keys: ["Alt", "V"], label: "Open the navigator" },
  { keys: ["Alt", "N"], label: "Go to the next question" },
  { keys: ["Alt", "S"], label: "Open or return to the review screen" },
] as const;

export function QuestionEngineShortcutTourContent() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setIndex((current) => (current + 1) % SHORTCUTS.length);
    }, 1800);
    return () => window.clearInterval(interval);
  }, []);

  const shortcut = SHORTCUTS[index];

  return (
    <div className="space-y-3">
      <p>
        Underlined letters show the available keyboard command. On a Mac, use
        Option wherever the interface says Alt.
      </p>
      <div className="min-h-20 rounded-lg bg-muted p-3">
        <AnimatePresence mode="wait">
          <motion.div
            key={shortcut.label}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2 }}
            className="space-y-2"
          >
            <div className="flex flex-wrap gap-1.5">
              {shortcut.keys.map((key) => (
                <motion.kbd
                  key={key}
                  initial={{ scale: 0.85 }}
                  animate={{ scale: [0.85, 1.08, 1] }}
                  transition={{ duration: 0.35 }}
                  className="min-w-8 rounded-md border bg-background px-2 py-1 text-center font-mono text-xs font-semibold shadow-sm"
                >
                  {key}
                </motion.kbd>
              ))}
            </div>
            <p className="text-xs font-medium text-muted-foreground">
              {shortcut.label}
            </p>
          </motion.div>
        </AnimatePresence>
      </div>
      <div className="flex gap-1" aria-hidden>
        {SHORTCUTS.map((item, itemIndex) => (
          <span
            key={item.label}
            className={`h-1 flex-1 rounded-full ${
              itemIndex === index ? "bg-primary" : "bg-muted"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
