"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, FilePlus } from "lucide-react";
import { toast } from "sonner";
import { Button, DataTable, InterviewReviewMockHistory, TablePagination } from "@altitutor/ui";
import { formatInterviewReviewDate, tutorDefaultDisplaySettings, type DataTableColumnDefinition,
  type DataTableFilterDefinition, type InterviewReviewMock, type TutorInterviewReviewSummary } from "@altitutor/shared";
import { TutorEntityToolbar } from "@/features/quick-filters/components/TutorEntityToolbar";
import { TutorDialogShell } from "@/shared/components/tutor-dialog-shell";
import { TutorPageContainer } from "@/shared/components/layouts";
import { tutorBtnOutline, tutorBtnPrimary, tutorCardCn, tutorDataTableProps, tutorToolbarProps } from "@/shared/lib/tutor-visual";
import { UcatRowActions } from "@/features/ucat/shared/row-actions";
import { useInterviewStudents, type InterviewStudentSummary } from "../hooks/use-interview-students";
import { useInterviewReviewCommand, useInterviewReviewWorkspace } from "../hooks/use-interview-performance-reviews";
import { useInterviewAccess } from "../hooks/use-interview-access";
import { useInterviewCatalog } from "../hooks/use-interviews";
import { InterviewPageHeader, interviewCrumbs } from "./interview-page";
import { InterviewError } from "./interview-ui";
import { pageRows, sortRows, useInterviewTable } from "./interview-table";

const columns: DataTableColumnDefinition[] = [
  { key: "student", label: "Student", visibleByDefault: true },
  { key: "interviews", label: "Interviews", visibleByDefault: true },
  { key: "average", label: "Average score", visibleByDefault: true },
  { key: "reviews", label: "Performance reviews", visibleByDefault: true },
];
const columnKeys = columns.map(({ key }) => key);
const root = "/interviews/students";

function averageScore(student: InterviewStudentSummary) {
  const percentages = student.mocks.flatMap((mock) => mock.score !== null && mock.maximumPoints !== null && mock.maximumPoints > 0 ? [mock.score / mock.maximumPoints * 100] : []);
  return percentages.length ? percentages.reduce((sum, value) => sum + value, 0) / percentages.length : null;
}
function scoreLabel(student: InterviewStudentSummary) {
  const average = averageScore(student);
  return average === null ? "—" : `${Number(average.toFixed(1))}%`;
}
function reviewsFor(student: InterviewStudentSummary, reviews: TutorInterviewReviewSummary[]) {
  return reviews.filter((review) => review.studentId === student.id);
}
function inRange(value: number, filters: Record<string, unknown[]>, key: string) {
  const minimum = filters[`${key}Min`]?.[0];
  const maximum = filters[`${key}Max`]?.[0];
  return (minimum === undefined || minimum === "" || value >= Number(minimum)) &&
    (maximum === undefined || maximum === "" || value <= Number(maximum));
}

export function InterviewStudentsPage({ studentId }: { studentId?: string }) {
  const router = useRouter();
  const access = useInterviewAccess();
  const studentsQuery = useInterviewStudents(!!access.data);
  const workspace = useInterviewReviewWorkspace(!!access.data);
  const catalog = useInterviewCatalog();
  const command = useInterviewReviewCommand();
  const pendingCreate = useRef<{ studentId: string; id: string } | null>(null);
  const [mock, setMock] = useState<InterviewReviewMock | null>(null);
  const table = useInterviewTable(columnKeys, undefined, { sortBy: "student", sortDirection: "asc" });
  const students = studentsQuery.data ?? [];
  const reviews = workspace.data?.reviews ?? [];
  const visible = new Set(table.state.visibleColumns);
  const filters = table.state.filters;
  const filterDefinitions: DataTableFilterDefinition[] = [
    { key: "class", label: "Class", options: (catalog.data?.classes ?? []).map((item) => ({ value: item.id, label: item.name })) },
    ...[ ["interviews", "Number of interviews"], ["reviews", "Number of performance reviews"], ["sessions", "Sessions attended"] ].map(([key, label]) => ({
      key, label, type: "number-range" as const, minKey: `${key}Min`, maxKey: `${key}Max`,
    })),
  ];
  const rows = sortRows(students.filter((student) => {
    const selectedClasses = (filters.class ?? []).map(String);
    return student.name.toLowerCase().includes(table.state.search.trim().toLowerCase()) &&
      (!selectedClasses.length || student.classIds.some((id) => selectedClasses.includes(id))) &&
      inRange(student.mocks.length, filters, "interviews") && inRange(reviewsFor(student, reviews).length, filters, "reviews") &&
      inRange(student.sessions.filter((session) => session.attended === true).length, filters, "sessions");
  }), table.state, "student", {
    student: (student) => student.name, interviews: (student) => student.mocks.length,
    average: (student) => averageScore(student) ?? -1, reviews: (student) => reviewsFor(student, reviews).length,
  });
  const paged = pageRows(rows, table.state.page, table.state.pageSize);
  const selected = students.find((student) => student.id === studentId);

  async function createReview(student: InterviewStudentSummary) {
    if (command.isPending) return;
    const pending = pendingCreate.current?.studentId === student.id ? pendingCreate.current : { studentId: student.id, id: crypto.randomUUID() };
    pendingCreate.current = pending;
    try {
      await command.mutateAsync({ type: "createReview", id: pending.id, studentId: student.id,
        date: new Intl.DateTimeFormat("en-CA", { timeZone: "Australia/Adelaide" }).format(new Date()) });
      pendingCreate.current = null;
      router.push(`/interviews/performance-reviews/${pending.id}`);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Unable to create review."); }
  }
  const mockLinks = (student: InterviewStudentSummary) => <ul className="space-y-1">{student.mocks.map((item) => <li key={item.id}>
    <button className="text-left text-sm text-primary hover:underline" onClick={() => setMock(item)}>
      {item.title} · {item.score === null ? "Unscored" : `${item.score} / ${item.maximumPoints ?? "—"}`}
    </button>
  </li>)}</ul>;
  const reviewLinks = (student: InterviewStudentSummary) => <ul className="space-y-1">{reviewsFor(student, reviews).map((review) => <li key={review.id}>
    <Link className="text-sm text-primary hover:underline" href={`/interviews/performance-reviews/${review.id}`}>
      {review.title || "Performance review"} · {formatInterviewReviewDate(review.date)}{review.published ? "" : " · Draft"}
    </Link>
  </li>)}</ul>;
  const error = access.error ?? studentsQuery.error ?? workspace.error ?? catalog.error;
  if (error) return <InterviewError error={error} retry={() => { void access.refetch(); void studentsQuery.refetch(); void workspace.refetch(); void catalog.refetch(); }} />;
  if (!access.isPending && !access.data) return <p className="py-8">Medicine Interview tutor access is required.</p>;
  if (access.isPending || studentsQuery.isPending || workspace.isPending) return <p role="status" className="py-8">Loading interview students…</p>;

  return <TutorPageContainer className="space-y-6">
    <InterviewPageHeader title={selected?.name ?? "Students"} backHref={studentId ? root : "/interviews"}
      breadcrumbs={studentId ? [...interviewCrumbs("Students"), { label: selected?.name ?? "Unavailable" }] : interviewCrumbs("Students")}
      actions={selected && <Button className={tutorBtnPrimary} disabled={command.isPending} onClick={() => void createReview(selected)}><FilePlus className="size-4" /> Create performance review</Button>} />
    {studentId ? selected ? <>
      <section className={tutorCardCn("space-y-3 p-5")}><h2 className="font-semibold">Interviews</h2>
        <p className="text-sm text-muted-foreground">Average score: {scoreLabel(selected)}</p>
        {selected.mocks.length ? mockLinks(selected) : <p>No completed interviews yet.</p>}
      </section>
      <section className={tutorCardCn("space-y-3 p-5")}><h2 className="font-semibold">Performance reviews</h2>
        {reviewsFor(selected, reviews).length ? reviewLinks(selected) : <p>No performance reviews yet.</p>}
      </section>
      <section className={tutorCardCn("space-y-3 p-5")}><h2 className="font-semibold">Session attendance</h2>
        <p className="text-sm text-muted-foreground">Medicine Interview sessions only</p>
        {selected.sessions.length ? <ul className="divide-y">{selected.sessions.map((session) => <li key={session.id} className="flex flex-wrap justify-between gap-3 py-2 text-sm">
          <span>{session.name}{session.startAt ? ` · ${new Date(session.startAt).toLocaleString()}` : ""}</span>
          <span>{session.attended === true ? "Attended" : session.attended === false ? "Absent" : "Not logged"}</span>
        </li>)}</ul> : <p>No interview sessions yet.</p>}
      </section>
    </> : <p>This student is unavailable or is no longer eligible for Medicine Interview.</p> : <>
      <TutorEntityToolbar pageKey="interview_students" defaultSettings={tutorDefaultDisplaySettings(columnKeys, { sortBy: "student", sortDirection: "asc" })}
        state={table.state} {...table.actions} filterDefinitions={filterDefinitions} columnDefinitions={columns}
        sortOptions={columns.map(({ key, label }) => ({ key, label }))} searchPlaceholder="Search students" {...tutorToolbarProps} />
      <DataTable {...tutorDataTableProps} pagination="external" data={paged.rows} columns={[
        ...(visible.has("student") ? [{ id: "student", header: "Student", cell: ({ row }: { row: { original: InterviewStudentSummary } }) =>
          <Link className="font-medium hover:underline" href={`${root}/${row.original.id}`}>{row.original.name}</Link> }] : []),
        ...(visible.has("interviews") ? [{ id: "interviews", header: "Interviews", cell: ({ row }: { row: { original: InterviewStudentSummary } }) => row.original.mocks.length ? mockLinks(row.original) : "—" }] : []),
        ...(visible.has("average") ? [{ id: "average", header: "Average score", cell: ({ row }: { row: { original: InterviewStudentSummary } }) => scoreLabel(row.original) }] : []),
        ...(visible.has("reviews") ? [{ id: "reviews", header: "Performance reviews", cell: ({ row }: { row: { original: InterviewStudentSummary } }) => reviewsFor(row.original, reviews).length ? reviewLinks(row.original) : "—" }] : []),
        { id: "actions", header: "Actions", cell: ({ row }) => <UcatRowActions actions={[
          { label: "View", icon: <Eye className="size-4" />, href: `${root}/${row.original.id}` },
          { label: "Create performance review", icon: <FilePlus className="size-4" />, onClick: () => void createReview(row.original) },
        ]} /> },
      ]} />
      {!paged.total && <p className="py-6 text-center text-muted-foreground">No students match these filters.</p>}
      {!!paged.total && <TablePagination page={paged.page} pageSize={table.state.pageSize} total={paged.total}
        onPageChange={table.actions.onPageChange} onPageSizeChange={table.actions.onPageSizeChange} pageSizeOptions={[10, 20, 50]} />}
    </>}
    <TutorDialogShell open={!!mock} onOpenChange={(open) => { if (!open) setMock(null); }} title={mock?.title ?? "Mock feedback"}
      footer={<Button variant="outline" className={tutorBtnOutline} onClick={() => setMock(null)}>Close</Button>}>
      {mock && <div className="overflow-y-auto"><InterviewReviewMockHistory key={mock.id} round={mock} /></div>}
    </TutorDialogShell>
  </TutorPageContainer>;
}
