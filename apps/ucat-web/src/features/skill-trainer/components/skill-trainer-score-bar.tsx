"use client";

import type { ComponentType, ReactNode } from "react";
import { Clock, Flame, LogOut, Trophy } from "lucide-react";
import { Button } from "@altitutor/ui";
import { ScoreBarFeedback } from "@/features/skill-trainer/components/score-bar-feedback";
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
  feedback,
  onExit,
}: {
  remaining: number;
  score: number;
  streak: number;
  streakEnabled: boolean;
  feedback: "correct" | "incorrect" | null;
  onExit: () => void;
}) {
  const showStreak = streakEnabled && streak >= 2;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/20 bg-gradient-to-r from-primary/5 via-background to-primary/5 px-3 py-2 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <StatPill icon={Clock} label="Time" value={`${remaining}s`} />
        <div className="relative">
          <StatPill icon={Trophy} label="Score" value={score} />
          <div className="pointer-events-none absolute left-full top-1/2 z-10 ml-2 -translate-y-1/2 whitespace-nowrap">
            <ScoreBarFeedback feedback={feedback} />
          </div>
        </div>
        {showStreak ? (
          <div className="inline-flex items-center gap-1.5 rounded-full border border-orange-300/50 bg-orange-500/10 px-3 py-1.5 text-sm font-bold tabular-nums text-orange-700 shadow-sm dark:border-orange-500/40 dark:bg-orange-500/15 dark:text-orange-200">
            <Flame className="h-3.5 w-3.5 shrink-0 text-orange-500" aria-hidden />
            <span className="text-orange-600/80 dark:text-orange-300/80">Streak</span>
            <span>{streak}</span>
          </div>
        ) : null}
      </div>
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
    </div>
  );
}
