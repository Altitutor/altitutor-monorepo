"use client";

import { useId, useState } from "react";
import { Trophy } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { Skeleton } from "@altitutor/ui";
import { SegmentedControl } from "@/features/progress/components/segmented-control";
import { useSkillTrainerLeaderboard } from "@/features/skill-trainer/hooks/use-skill-trainers";
import {
  UCAT_NATIVE_TABLE_BODY_ROW,
  UCAT_NATIVE_TABLE_HEADER_ROW,
  UCAT_TABLE_HEADER_CLASSNAME,
  UCAT_TABLE_SHELL,
} from "@/lib/ucat-surface-motion";

type LeaderboardWindow = "week" | "all_time";

export function SkillTrainerLeaderboard({
  trainerKey,
}: {
  trainerKey: string;
}) {
  const [window, setWindow] = useState<LeaderboardWindow>("week");
  const headingId = useId();
  const reduceMotion = useReducedMotion();
  const { data, isLoading } = useSkillTrainerLeaderboard(trainerKey, window);
  const podium = [data?.[1], data?.[0], data?.[2]].filter(
    (entry): entry is NonNullable<typeof entry> => Boolean(entry),
  );

  return (
    <section className="space-y-4" aria-labelledby={headingId}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id={headingId} className="text-2xl font-semibold tracking-tight">
          Leaderboard
        </h2>
        <SegmentedControl<LeaderboardWindow>
          value={window}
          onValueChange={setWindow}
          options={[
            { value: "week", label: "This week" },
            { value: "all_time", label: "All time" },
          ]}
        />
      </div>

      {isLoading ? <Skeleton className="h-72 w-full" /> : null}

      {!isLoading && (data?.length ?? 0) === 0 ? (
        <p className="text-sm text-muted-foreground">
          No scores yet — be the first!
        </p>
      ) : null}

      {(data?.length ?? 0) > 0 ? (
        <div className="space-y-5">
          <div
            className="flex items-end justify-center gap-2 overflow-hidden rounded-xl border bg-gradient-to-b from-amber-500/5 to-background px-2 pb-4 pt-8 sm:gap-4 sm:px-6"
            aria-label="Leaderboard podium"
          >
            {podium.map((entry, index) => {
              const isWinner = entry.rank === 1;
              const podiumHeight =
                entry.rank === 1
                  ? "min-h-[11rem]"
                  : entry.rank === 2
                    ? "min-h-[9rem]"
                    : "min-h-[8rem]";
              const trophyColour =
                entry.rank === 1
                  ? "text-amber-400"
                  : entry.rank === 2
                    ? "text-slate-400"
                    : "text-orange-700";
              return (
                <motion.div
                  key={entry.student_id}
                  className={`flex w-[31%] max-w-48 flex-col items-center justify-end rounded-t-xl border bg-card px-2 pb-4 text-center shadow-sm ${podiumHeight}`}
                  initial={reduceMotion ? false : { opacity: 0, y: 28 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    delay: reduceMotion ? 0 : index * 0.1,
                    duration: 0.4,
                    ease: "easeOut",
                  }}
                >
                  <motion.div
                    animate={
                      reduceMotion
                        ? undefined
                        : {
                            rotate: isWinner ? [0, -8, 8, 0] : [0, -4, 4, 0],
                            y: isWinner ? [0, -4, 0] : [0, -2, 0],
                          }
                    }
                    transition={{
                      duration: isWinner ? 1.8 : 2.4,
                      repeat: reduceMotion ? 0 : Infinity,
                      repeatDelay: 1.2 + index * 0.25,
                    }}
                  >
                    <Trophy
                      className={`mb-2 h-8 w-8 drop-shadow-sm sm:h-10 sm:w-10 ${trophyColour}`}
                      aria-hidden
                    />
                  </motion.div>
                  <span className="text-xs font-semibold text-muted-foreground">
                    #{entry.rank}
                  </span>
                  <span className="mt-1 max-w-full truncate text-sm font-semibold">
                    {entry.display_name}
                  </span>
                  <span className="mt-1 text-lg font-bold tabular-nums">
                    {entry.best_score}
                  </span>
                </motion.div>
              );
            })}
          </div>

          <div className={UCAT_TABLE_SHELL}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[420px] caption-bottom text-sm">
                <caption className="sr-only">Skill trainer leaderboard</caption>
                <thead className={UCAT_TABLE_HEADER_CLASSNAME}>
                  <tr className={UCAT_NATIVE_TABLE_HEADER_ROW}>
                    <th className="w-12 px-4 py-3 text-left font-medium">#</th>
                    <th className="px-4 py-3 text-left font-medium">Student</th>
                    <th className="px-4 py-3 text-right font-medium">Score</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.map((row) => (
                    <tr
                      key={`${row.student_id}-${row.rank}`}
                      className={UCAT_NATIVE_TABLE_BODY_ROW}
                    >
                      <td className="px-4 py-3">{row.rank}</td>
                      <td className="px-4 py-3">{row.display_name}</td>
                      <td className="px-4 py-3 text-right font-medium">
                        {row.best_score}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
