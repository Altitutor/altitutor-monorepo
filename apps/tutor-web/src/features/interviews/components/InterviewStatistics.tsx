"use client";

import Link from "next/link";
import { useMemo } from "react";
import { DataTable, TablePagination } from "@altitutor/ui";
import { tutorDefaultDisplaySettings, type DataTableColumnDefinition, type DataTableFilterDefinition } from "@altitutor/shared";
import { TutorEntityToolbar } from "@/features/quick-filters/components/TutorEntityToolbar";
import { tutorCardCn, tutorDataTableProps, tutorToolbarProps } from "@/shared/lib/tutor-visual";
import { useInterviewAccess } from "../hooks/use-interview-access";
import { useInterviewStatistics, type InterviewScoredAttempt, type InterviewTutorStatistics } from "../hooks/use-interview-statistics";
import { InterviewPageHeader, interviewCrumbs } from "./interview-page";
import { InterviewError } from "./interview-ui";
import { pageRows, sortRows, useInterviewTable } from "./interview-table";

function average(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

function averageAttemptScore(attempts: InterviewScoredAttempt[]) {
  return average(attempts.map(({ score, maximum }) => 100 * score / maximum));
}

function averageMockScore(attempts: InterviewScoredAttempt[]) {
  const byMock = new Map<string, number>();
  for (const { roundId, studentId, mockScore, mockMaximum } of attempts) {
    if (mockScore !== null && mockMaximum !== null && mockMaximum > 0)
      byMock.set(`${roundId}:${studentId}`, 100 * mockScore / mockMaximum);
  }
  return average([...byMock.values()]);
}

function percentage(score: number | null) {
  return score === null ? "—" : `${Number(score.toFixed(1))}%`;
}

function contentAttempts(attempts: InterviewScoredAttempt[], kind: "station" | "interview", id: string) {
  return attempts.filter((attempt) => (kind === "station" ? attempt.stationId : attempt.interviewId) === id);
}

export function averageContentScore(attempts: InterviewScoredAttempt[], kind: "station" | "interview", id: string) {
  const students = new Map<string, InterviewScoredAttempt[]>();
  for (const attempt of contentAttempts(attempts, kind, id)) {
    const studentAttempts = students.get(attempt.studentId) ?? [];
    studentAttempts.push(attempt);
    students.set(attempt.studentId, studentAttempts);
  }
  return percentage(average([...students.values()].flatMap((attempts) => {
    const score = kind === "interview" ? averageMockScore(attempts) : averageAttemptScore(attempts);
    return score === null ? [] : [score];
  })));
}

function InterviewScoredStudents({ attempts }: { attempts: InterviewScoredAttempt[] }) {
  const rows = new Map<string, InterviewScoredAttempt[]>();
  for (const attempt of attempts) {
    const key = `${attempt.studentId}:${attempt.tutorId}`;
    const encounters = rows.get(key) ?? [];
    encounters.push(attempt);
    rows.set(key, encounters);
  }

  if (!rows.size) return <p className="text-sm text-muted-foreground">There are no released scores yet.</p>;

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-left">
          <tr>
            <th scope="col" className="p-3">Student</th>
            <th scope="col" className="p-3">Assigned tutor</th>
            <th scope="col" className="p-3 text-right">Scored encounters</th>
            <th scope="col" className="p-3 text-right">Average station score</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {[...rows].sort(([, a], [, b]) => a[0].studentName.localeCompare(b[0].studentName)).map(([key, encounters]) => (
            <tr key={key}>
              <td className="p-3">{encounters[0].studentName}</td>
              <td className="p-3">{encounters[0].tutorName}</td>
              <td className="p-3 text-right tabular-nums">{encounters.length}</td>
              <td className="p-3 text-right tabular-nums">{percentage(averageAttemptScore(encounters))}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function InterviewContentStatistics({ kind, id }: { kind: "station" | "interview"; id: string }) {
  const query = useInterviewStatistics();
  if (query.isPending) return <p role="status">Loading statistics…</p>;
  if (query.error) return <InterviewError error={query.error} retry={() => void query.refetch()} />;
  const attempts = query.data?.attempts ?? [];
  return (
    <div className="space-y-4">
      <p className="text-sm">Average score per student <strong>{averageContentScore(attempts, kind, id)}</strong></p>
      <InterviewScoredStudents attempts={contentAttempts(attempts, kind, id)} />
    </div>
  );
}

const columns: DataTableColumnDefinition[] = [
  { key: "name", label: "Tutor", visibleByDefault: true },
  { key: "interviews", label: "Interviews scored", visibleByDefault: true },
  { key: "averageMock", label: "Average mock score", visibleByDefault: true },
  { key: "averageStation", label: "Average station score", visibleByDefault: true },
  { key: "reviews", label: "Published performance reviews", visibleByDefault: true },
  { key: "sessions", label: "Sessions attended", visibleByDefault: true },
];
const keys = columns.map(({ key }) => key);
const countFilters: DataTableFilterDefinition[] = [
  ["interviews", "Number of interviews"],
  ["reviews", "Number of performance reviews"],
  ["sessions", "Sessions attended"],
].map(([key, label]) => ({ key, label, type: "number-range", minKey: `${key}Min`, maxKey: `${key}Max` }));
const root = "/interviews/tutors";
type TutorStatsRow = InterviewTutorStatistics & {
  attempts: InterviewScoredAttempt[];
  averageMock: number | null;
  averageStation: number | null;
};

function inRange(value: number, filters: Record<string, unknown[]>, key: string) {
  const minimum = filters[`${key}Min`]?.[0];
  const maximum = filters[`${key}Max`]?.[0];
  return (minimum === undefined || minimum === "" || value >= Number(minimum)) &&
    (maximum === undefined || maximum === "" || value <= Number(maximum));
}

export function InterviewTutorsPage({ tutorId }: { tutorId?: string }) {
  const access = useInterviewAccess();
  const query = useInterviewStatistics(!!access.data);
  const table = useInterviewTable(keys, undefined, { sortBy: "name", sortDirection: "asc" });
  const tutors = useMemo(() => {
    const attemptsByTutor = new Map<string, InterviewScoredAttempt[]>();
    for (const attempt of query.data?.attempts ?? []) {
      const attempts = attemptsByTutor.get(attempt.tutorId) ?? [];
      attempts.push(attempt);
      attemptsByTutor.set(attempt.tutorId, attempts);
    }
    return (query.data?.tutors ?? []).map((tutor) => {
      const attempts = attemptsByTutor.get(tutor.id) ?? [];
      return { ...tutor, attempts, averageMock: averageMockScore(attempts), averageStation: averageAttemptScore(attempts) };
    });
  }, [query.data]);
  const tutor = tutors.find(({ id }) => id === tutorId);
  const rows = sortRows(tutors.filter((row) =>
    row.name.toLowerCase().includes(table.state.search.trim().toLowerCase()) &&
    inRange(row.interviews, table.state.filters, "interviews") &&
    inRange(row.reviews, table.state.filters, "reviews") &&
    inRange(row.sessions, table.state.filters, "sessions")
  ), table.state, "name", {
    name: (row) => row.name, interviews: (row) => row.interviews, reviews: (row) => row.reviews,
    sessions: (row) => row.sessions, averageMock: (row) => row.averageMock ?? -1,
    averageStation: (row) => row.averageStation ?? -1,
  });
  const page = pageRows(rows, table.state.page, table.state.pageSize);
  const visible = new Set(table.state.visibleColumns);

  if (access.error || query.error) return <InterviewError error={access.error ?? query.error} retry={() => { void access.refetch(); void query.refetch(); }} />;
  if (!access.isPending && !access.data) return <p className="py-8">Medicine Interview tutor access is required.</p>;
  if (access.isPending || query.isPending) return <p role="status" className="py-8">Loading interview statistics…</p>;

  return (
    <div className="space-y-6 py-8 md:py-10">
      <InterviewPageHeader title={tutor?.name ?? "Tutors"} backHref={tutorId ? root : "/interviews"}
        breadcrumbs={tutorId ? [...interviewCrumbs("Tutors"), { label: tutor?.name ?? "Unavailable" }] : interviewCrumbs("Tutors")} />
      {tutorId ? tutor ? (
        <>
          <dl className={tutorCardCn("grid gap-4 p-4 sm:grid-cols-3")}>
            {columns.slice(1).map(({ key, label }) => (
              <div key={key}>
                <dt className="text-sm text-muted-foreground">{label}</dt>
                <dd className="font-semibold tabular-nums">{key === "averageMock" ? percentage(tutor.averageMock)
                  : key === "averageStation" ? percentage(tutor.averageStation)
                  : key === "interviews" ? tutor.interviews : key === "reviews" ? tutor.reviews : tutor.sessions}</dd>
              </div>
            ))}
          </dl>
          <InterviewScoredStudents attempts={tutor.attempts} />
        </>
      ) : <p>This tutor is unavailable.</p> : (
        <>
          <TutorEntityToolbar pageKey="interview_tutors" defaultSettings={tutorDefaultDisplaySettings(keys, { sortBy: "name", sortDirection: "asc" })}
            state={table.state} {...table.actions} filterDefinitions={countFilters} columnDefinitions={columns}
            sortOptions={columns.map(({ key, label }) => ({ key, label }))} searchPlaceholder="Search tutors" {...tutorToolbarProps} />
          <DataTable<TutorStatsRow, unknown> {...tutorDataTableProps} pagination="external" data={page.rows} columns={columns.filter(({ key }) => visible.has(key)).map(({ key, label }) => ({
            id: key, header: label,
            cell: ({ row }: { row: { original: TutorStatsRow } }) => {
              const tutor = row.original;
              if (key === "name") return <Link className="font-medium hover:underline" href={`${root}/${tutor.id}`}>{tutor.name}</Link>;
              if (key === "averageMock") return percentage(tutor.averageMock);
              if (key === "averageStation") return percentage(tutor.averageStation);
              return key === "interviews" ? tutor.interviews : key === "reviews" ? tutor.reviews : tutor.sessions;
            },
          }))} />
          {!page.total && <p className="py-5 text-center text-muted-foreground">No tutors match these filters.</p>}
          {!!page.total && <TablePagination page={page.page} pageSize={table.state.pageSize} total={page.total}
            onPageChange={table.actions.onPageChange} onPageSizeChange={table.actions.onPageSizeChange} pageSizeOptions={[10, 20, 50]} />}
        </>
      )}
    </div>
  );
}
