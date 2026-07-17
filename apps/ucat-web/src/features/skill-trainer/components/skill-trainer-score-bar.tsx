"use client";

import type { ComponentType, ReactNode } from "react";
import { Clock, Flame, LogOut, Trophy } from "lucide-react";
import { motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { ScoreDeltaFeedback } from "@/features/skill-trainer/components/score-bar-feedback";
import { cn } from "@/lib/utils";

function StatPill({
  icon: Icon,
  label,
  value,
  className,
}: {
  icon?: ComponentType<{ className?: string }>;
  label: string;
  value: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-background/80 px-3 py-1.5 text-sm shadow-sm backdrop-blur-sm",
        className,
      )}
    >
      {Icon ? <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden /> : null}
      <span className="text-muted-foreground">{label}</span>
      <span className="font-bold tabular-nums text-foreground">{value}</span>
    </div>
  );
}

export function SkillTrainerScoreBar({
  remaining,
  score,
  streak,
  streakEnabled,
  scoreDelta,
  onExit,
}: {
  remaining: number;
  score: number;
  streak: number;
  streakEnabled: boolean;
  scoreDelta: { id: number; value: number } | null;
  onExit?: () => void;
}) {
  const showStreak = streakEnabled && streak >= 2;
  const streakLevel = streak >= 15 ? 4 : streak >= 10 ? 3 : streak >= 5 ? 2 : 1;
  const streakClass = cn(
    "inline-flex h-8 w-[112px] items-center justify-center gap-1.5 rounded-full border px-3 text-sm font-bold tabular-nums shadow-sm transition-colors",
    streakLevel === 1 &&
      "border-orange-300/50 bg-orange-500/10 text-orange-700 dark:border-orange-500/40 dark:bg-orange-500/15 dark:text-orange-200",
    streakLevel === 2 &&
      "border-orange-400/60 bg-orange-500/20 text-orange-800 shadow-orange-500/10 dark:border-orange-400/50 dark:bg-orange-500/25 dark:text-orange-100",
    streakLevel === 3 &&
      "border-amber-300/70 bg-amber-400/25 text-amber-900 shadow-amber-400/20 dark:border-amber-300/60 dark:bg-amber-400/25 dark:text-amber-100",
    streakLevel === 4 &&
      "border-yellow-300/80 bg-yellow-300/30 text-yellow-950 shadow-lg shadow-yellow-400/20 dark:border-yellow-200/70 dark:bg-yellow-300/25 dark:text-yellow-50",
  );
  const flameClass = cn(
    "shrink-0",
    streakLevel === 1 && "h-3.5 w-3.5 text-orange-500",
    streakLevel === 2 && "h-4 w-4 text-orange-500",
    streakLevel === 3 && "h-[18px] w-[18px] text-amber-400",
    streakLevel === 4 && "h-5 w-5 text-yellow-300",
  );

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 overflow-visible rounded-xl border border-primary/20 bg-gradient-to-r from-primary/5 via-background to-primary/5 px-3 py-2 shadow-sm">
      <div className="flex flex-wrap items-center gap-2 overflow-visible">
        <StatPill icon={Clock} label="Time" value={`${remaining}s`} />
        <div className="relative">
          <StatPill icon={Trophy} label="Score" value={score} />
          <div className="pointer-events-none absolute left-1/2 top-full z-10 mt-1 -translate-x-1/2 whitespace-nowrap">
            <ScoreDeltaFeedback delta={scoreDelta} />
          </div>
        </div>
        <div className="relative h-8 w-[112px] shrink-0 overflow-visible">
          {showStreak ? (
            <div className="pointer-events-none absolute left-1/2 top-1/2 h-8 w-[112px] -translate-x-1/2 -translate-y-1/2 overflow-visible">
              <motion.div
                key={streak}
                className={streakClass}
                initial={{ scale: 0.95 }}
                animate={{
                  scale:
                    streakLevel >= 4
                      ? [1.06, 1.2, 1.06]
                      : streakLevel >= 3
                      ? [1.03, 1.13, 1.03]
                      : [1, 1.07, 1],
                }}
                transition={{ duration: 0.45, ease: "easeOut" }}
              >
                <motion.span
                  className="relative inline-flex h-5 w-5 items-center justify-center"
                  animate={{
                    rotate:
                      streakLevel >= 3
                        ? [0, -10, 8, -5, 0]
                        : [0, -6, 5, 0],
                    y: streakLevel >= 4 ? [0, -2, 0] : [0, -1, 0],
                    filter:
                      streakLevel >= 3
                        ? [
                            "drop-shadow(0 0 0 rgba(251, 146, 60, 0))",
                            "drop-shadow(0 0 7px rgba(251, 191, 36, 0.75))",
                            "drop-shadow(0 0 3px rgba(251, 146, 60, 0.45))",
                          ]
                        : undefined,
                  }}
                  transition={{
                    duration: streakLevel >= 3 ? 0.85 : 0.45,
                    repeat: streakLevel >= 3 ? Infinity : 0,
                    repeatDelay: streakLevel >= 4 ? 0.15 : 0.7,
                  }}
                  aria-hidden
                >
                  {streakLevel >= 3 ? (
                    <>
                      <motion.span
                        className="absolute inset-0 flex items-center justify-center text-yellow-300/70"
                        animate={{
                          opacity: [0.35, 0.9, 0.45],
                          scale: [0.85, 1.22, 0.95],
                          y: [1, -2, 0],
                        }}
                        transition={{ duration: 0.7, repeat: Infinity, repeatDelay: 0.1 }}
                      >
                        <Flame className={flameClass} />
                      </motion.span>
                      <motion.span
                        className="absolute inset-0 flex items-center justify-center text-orange-500/60"
                        animate={{
                          opacity: [0.25, 0.7, 0.3],
                          scale: [0.75, 1.1, 0.8],
                          x: [-1, 1, 0],
                        }}
                        transition={{ duration: 0.5, repeat: Infinity, repeatDelay: 0.2 }}
                      >
                        <Flame className={flameClass} />
                      </motion.span>
                    </>
                  ) : null}
                  <Flame className={cn(flameClass, "relative z-10")} />
                </motion.span>
                <span className="text-current/80">Streak</span>
                <span>{streak}</span>
              </motion.div>
            </div>
          ) : null}
        </div>
      </div>
      {onExit ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="gap-1.5 text-muted-foreground hover:text-foreground"
          onClick={onExit}
        >
          <LogOut className="h-4 w-4" aria-hidden />
          Exit
        </Button>
      ) : null}
    </div>
  );
}
