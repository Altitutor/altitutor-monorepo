"use client";

import { useId, useMemo, useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@altitutor/ui";
import { ProgressTablePagination } from "./progress-table-pagination";
import { UcatTableRowActionLink } from "./ucat-table-row-action-link";
import { format } from "date-fns";
import { filterByTimeFrame } from "../lib/progress-data-utils";
import type { PracticeAttemptRow } from "@/app/api/ucat/progress/route";
import {
  UCAT_TABLE_BODY_ROW,
  UCAT_TABLE_HEADER_CLASSNAME,
  UCAT_TABLE_HEADER_ROW,
  UCAT_TABLE_SHELL,
} from "@/lib/ucat-surface-motion";
import type { ProgressMode, TimeFrameDays } from "../lib/progress-mode";

type PracticeAttemptsCardProps = {
  attempts: PracticeAttemptRow[];
  mode: ProgressMode;
  timeFrameDays: TimeFrameDays;
};

const PAGE_SIZE_OPTIONS = [10, 20, 50];

export function PracticeAttemptsCard({
  attempts,
  mode,
  timeFrameDays,
}: PracticeAttemptsCardProps) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const filteredAttempts = useMemo(
    () => filterByTimeFrame(attempts, mode, timeFrameDays),
    [attempts, mode, timeFrameDays],
  );

  const paginatedAttempts = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredAttempts.slice(start, start + pageSize);
  }, [filteredAttempts, page, pageSize]);

  const attemptsTableTitleId = useId();

  if (filteredAttempts.length === 0) {
    return null;
  }

  return (
    <section
      aria-labelledby={attemptsTableTitleId}
      className="space-y-4"
    >
      <h2
        id={attemptsTableTitleId}
        className="text-2xl font-semibold tracking-tight"
      >
        Practice sessions
      </h2>
        <div className={UCAT_TABLE_SHELL}>
          <Table>
            <TableHeader className={UCAT_TABLE_HEADER_CLASSNAME}>
              <TableRow className={UCAT_TABLE_HEADER_ROW}>
                <TableHead>Section</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Questions</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedAttempts.map((a) => {
              const score =
                a.totalPoints != null &&
                a.totalPoints > 0 &&
                a.scorePoints != null
                  ? `${a.scorePoints} / ${a.totalPoints}`
                  : "—";
              const date = a.completedAt ?? a.attemptedAt;
                return (
                  <TableRow key={a.id} className={UCAT_TABLE_BODY_ROW}>
                    <TableCell className="font-medium">
                      {a.sectionName}
                      {a.unlimited ? " (unlimited)" : ""}
                    </TableCell>
                    <TableCell>{score}</TableCell>
                    <TableCell>{a.questionCount ?? "—"}</TableCell>
                    <TableCell>
                      {date ? format(new Date(date), "PPp") : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <UcatTableRowActionLink
                        href={`/progress/practice-sessions/${a.id}`}
                        label="View session"
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
        <ProgressTablePagination
          total={filteredAttempts.length}
          page={page}
          pageSize={pageSize}
          pageSizeOptions={PAGE_SIZE_OPTIONS}
          onPageChange={setPage}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setPage(1);
          }}
        />
    </section>
  );
}
