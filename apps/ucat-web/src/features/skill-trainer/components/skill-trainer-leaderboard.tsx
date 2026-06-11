"use client";

import { useId, useState } from "react";
import { Skeleton } from "@altitutor/ui";
import { SegmentedControl } from "@/features/progress/components/segmented-control";
import { useSkillTrainerLeaderboard } from "@/features/skill-trainer/hooks/use-skill-trainers";
import {
  UCAT_NATIVE_TABLE_BODY_ROW,
  UCAT_NATIVE_TABLE_HEADER_ROW,
  UCAT_TABLE_HEADER_CLASSNAME,
  UCAT_TABLE_SHELL,
} from "@/lib/ucat-surface-motion";

type LeaderboardWindow = "week" | "all_time" | "my_scores";

function formatAchievedAt(iso: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

export function SkillTrainerLeaderboard({ trainerKey }: { trainerKey: string }) {
  const [window, setWindow] = useState<LeaderboardWindow>("week");
  const headingId = useId();
  const { data, isLoading } = useSkillTrainerLeaderboard(trainerKey, window);

  return (
    <div className="space-y-4">
      <SegmentedControl<LeaderboardWindow>
        value={window}
        onValueChange={setWindow}
        options={[
          { value: "week", label: "This week" },
          { value: "all_time", label: "All time" },
          { value: "my_scores", label: "My scores" },
        ]}
      />

      {isLoading ? <Skeleton className="h-40 w-full" /> : null}

      {!isLoading && (data?.length ?? 0) === 0 ? (
        <p className="text-sm text-muted-foreground">
          {window === "my_scores"
            ? "You have no completed runs yet."
            : "No scores yet — be the first!"}
        </p>
      ) : null}

      {(data?.length ?? 0) > 0 ? (
        <div className={UCAT_TABLE_SHELL}>
          <div className="overflow-x-auto">
            <table
              className="w-full min-w-[420px] caption-bottom text-sm"
              aria-labelledby={headingId}
            >
              <thead className={UCAT_TABLE_HEADER_CLASSNAME}>
                <tr className={UCAT_NATIVE_TABLE_HEADER_ROW}>
                  {window === "my_scores" ? null : (
                    <th className="w-12 px-4 py-3 text-left font-medium">#</th>
                  )}
                  <th className="px-4 py-3 text-left font-medium">
                    {window === "my_scores" ? "Date" : "Student"}
                  </th>
                  <th className="px-4 py-3 text-right font-medium">Score</th>
                </tr>
              </thead>
              <tbody>
                {data?.map((row) => (
                  <tr
                    key={
                      window === "my_scores"
                        ? row.achieved_at
                        : `${row.student_id}-${row.rank}`
                    }
                    className={UCAT_NATIVE_TABLE_BODY_ROW}
                  >
                    {window === "my_scores" ? null : (
                      <td className="px-4 py-3">{row.rank}</td>
                    )}
                    <td className="px-4 py-3">
                      {window === "my_scores"
                        ? formatAchievedAt(row.achieved_at)
                        : row.display_name}
                    </td>
                    <td className="px-4 py-3 text-right font-medium">{row.best_score}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}
