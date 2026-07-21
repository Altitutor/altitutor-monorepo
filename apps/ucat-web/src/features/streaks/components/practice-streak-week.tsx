import { Check, Flame } from "lucide-react";
import {
  practiceStreakWeekday,
  type PracticeStreakSummary,
} from "@/features/streaks/lib/practice-streak";
import { cn } from "@/lib/utils";

export function PracticeStreakWeek({
  streak,
  compact = false,
}: {
  streak: PracticeStreakSummary;
  compact?: boolean;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-muted-foreground">
            Current streak
          </p>
          <p className="mt-0.5 flex items-center gap-1.5 text-2xl font-semibold tabular-nums tracking-tight">
            <Flame
              className="h-5 w-5 fill-amber-400 text-amber-500"
              aria-hidden
            />
            {streak.current} day{streak.current === 1 ? "" : "s"}
          </p>
        </div>
        <p className="text-right text-xs text-muted-foreground">
          {streak.practicedToday
            ? "Extended today"
            : streak.current > 0
              ? "Answer 1 question today"
              : "Answer 1 question to begin"}
        </p>
      </div>
      <div
        className="grid grid-cols-7 gap-1.5"
        aria-label="Last 7 practice days"
      >
        {streak.recentDays.map((day) => (
          <div key={day.dateKey} className="flex flex-col items-center gap-1.5">
            <span
              className={cn(
                "flex items-center justify-center rounded-full border text-xs font-semibold transition-colors",
                compact ? "h-7 w-7" : "h-8 w-8",
                day.practiced
                  ? "border-amber-400 bg-amber-400 text-amber-950 shadow-[0_3px_12px_rgba(251,191,36,0.24)]"
                  : day.isToday
                    ? "border-dashed border-amber-500/70 bg-amber-500/[0.06] text-amber-700 dark:text-amber-300"
                    : "border-border/70 bg-muted/55 text-muted-foreground",
              )}
              aria-label={`${day.dateKey}: ${day.practiced ? "practice streak completed" : "no practice"}`}
            >
              {day.practiced ? <Check className="h-4 w-4" aria-hidden /> : null}
            </span>
            <span
              className={cn(
                "text-[10px] font-medium text-muted-foreground",
                day.isToday && "text-foreground",
              )}
            >
              {practiceStreakWeekday(day.dateKey)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
