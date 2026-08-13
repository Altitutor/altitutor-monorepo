"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";

const SHORTCUTS = [
  { keys: ["A", "B", "C", "D"], label: "Choose an answer" },
  { keys: ["Alt", "C"], label: "Calculator" },
  { keys: ["Alt", "F"], label: "Flag for review" },
  { keys: ["Alt", "P"], label: "Previous question" },
  { keys: ["Alt", "V"], label: "Navigator" },
  { keys: ["Alt", "N"], label: "Next question" },
] as const;

export function QuestionEngineShortcutTourContent() {
  const [activeLabel, setActiveLabel] = useState<string | null>(null);

  useEffect(() => {
    let clearTimer: number | undefined;
    const handleKeyDown = (event: KeyboardEvent) => {
      const key =
        event.altKey && event.code.startsWith("Key")
          ? event.code.slice(3).toUpperCase()
          : event.key.toUpperCase();
      const shortcut = event.altKey
        ? SHORTCUTS.find(
            (item) => item.keys.length === 2 && item.keys[1] === key,
          )
        : ["A", "B", "C", "D"].includes(key)
          ? SHORTCUTS[0]
          : undefined;
      if (!shortcut) return;

      setActiveLabel(shortcut.label);
      if (clearTimer) window.clearTimeout(clearTimer);
      clearTimer = window.setTimeout(() => setActiveLabel(null), 900);
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
      if (clearTimer) window.clearTimeout(clearTimer);
    };
  }, []);

  return (
    <div className="space-y-3">
      <p>
        The shortcut letter is underlined on each question-engine button. Try
        any shortcut below to see its action highlighted; shortcuts are paused
        on this step so the example stays in place. On a Mac, use Option in
        place of Alt.
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        {SHORTCUTS.map((shortcut, index) => (
          <motion.div
            key={shortcut.label}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, delay: index * 0.06 }}
            className={`rounded-lg p-2.5 transition-colors ${
              activeLabel === shortcut.label
                ? "bg-primary/15 ring-2 ring-primary"
                : "bg-muted"
            }`}
          >
            <div className="flex flex-wrap gap-1.5">
              {shortcut.keys.map((key) => (
                <kbd
                  key={key}
                  className="min-w-7 rounded-md border bg-background px-1.5 py-0.5 text-center font-mono text-[11px] font-semibold shadow-sm"
                >
                  {key}
                </kbd>
              ))}
            </div>
            <p className="mt-1.5 text-xs font-medium text-muted-foreground">
              {shortcut.label}
            </p>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
