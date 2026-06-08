"use client";

import { useState } from "react";
import { Button, Skeleton, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@altitutor/ui";
import { useSkillTrainerLeaderboard } from "@/features/skill-trainer/hooks/use-skill-trainers";

export function SkillTrainerLeaderboard({ trainerKey }: { trainerKey: string }) {
  const [window, setWindow] = useState<"week" | "all_time">("week");
  const { data, isLoading } = useSkillTrainerLeaderboard(trainerKey, window);

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Button
          type="button"
          size="sm"
          variant={window === "week" ? "default" : "outline"}
          onClick={() => setWindow("week")}
        >
          This week
        </Button>
        <Button
          type="button"
          size="sm"
          variant={window === "all_time" ? "default" : "outline"}
          onClick={() => setWindow("all_time")}
        >
          All time
        </Button>
      </div>

      {isLoading ? <Skeleton className="h-40 w-full" /> : null}

      {!isLoading && (data?.length ?? 0) === 0 ? (
        <p className="text-sm text-muted-foreground">No scores yet — be the first!</p>
      ) : null}

      {(data?.length ?? 0) > 0 ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">#</TableHead>
              <TableHead>Student</TableHead>
              <TableHead className="text-right">Score</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data?.map((row) => (
              <TableRow key={`${row.student_id}-${row.rank}`}>
                <TableCell>{row.rank}</TableCell>
                <TableCell>{row.display_name}</TableCell>
                <TableCell className="text-right font-medium">{row.best_score}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : null}
    </div>
  );
}
