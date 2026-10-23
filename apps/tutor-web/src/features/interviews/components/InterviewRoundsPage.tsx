"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  addDays,
  format,
  isSameDay,
  startOfWeek,
} from "date-fns";
import {
  Badge,
  Button,
  DataTable,
  DataTableToolbar,
  Popover,
  PopoverAnchor,
  PopoverContent,
  TablePagination,
} from "@altitutor/ui";
import type {
  DataTableColumnDefinition,
  DataTableFilterDefinition,
  DataTableSortOption,
  InterviewRound,
} from "@altitutor/shared";
import {
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  DoorOpen,
  Pencil,
  Plus,
} from "lucide-react";
import { UcatRowActions } from "@/features/ucat/shared/row-actions";
import {
  tutorBtnOutline,
  tutorBtnPrimary,
  tutorDataTableProps,
  tutorToolbarProps,
} from "@/shared/lib/tutor-visual";
import { cn } from "@/shared/utils";
import {
  useInterviewCatalog,
  useInterviewRounds,
} from "../hooks/use-interviews";
import { InterviewError } from "./interview-ui";
import { InterviewRoundDialog } from "./InterviewRoundSetup";
import { InterviewPageHeader, interviewCrumbs } from "./interview-page";
import {
  matchesMulti,
  pageRows,
  sortRows,
  useInterviewTable,
} from "./interview-table";

const columnDefinitions: DataTableColumnDefinition[] = [
  { key: "name", label: "Round", visibleByDefault: true },
  { key: "interview", label: "Interview", visibleByDefault: true },
  { key: "when", label: "When", visibleByDefault: true },
  { key: "delivery", label: "Delivery", visibleByDefault: true },
  { key: "phase", label: "Status", visibleByDefault: true },
  { key: "students", label: "Students", visibleByDefault: true },
];

const sortOptions: DataTableSortOption[] = [
  { key: "when", label: "When" },
  { key: "name", label: "Name" },
];

const slotHeight = 72;
const dayStartHour = 8;
const dayEndHour = 20;

function statusLabel(round: InterviewRound) {
  if (round.phase === "completed") return "Completed";
  if (round.startedAt) return round.phase;
  if (round.scheduledAt) return "Scheduled";
  return "Waiting room";
}

function whenLabel(round: InterviewRound) {
  if (round.scheduledAt) return new Date(round.scheduledAt).toLocaleString();
  if (round.startedAt) return new Date(round.startedAt).toLocaleString();
  return "Not scheduled";
}

function RoundActions({
  round,
  onEdit,
}: {
  round: InterviewRound;
  onEdit: (round: InterviewRound) => void;
}) {
  const completed = round.phase === "completed";
  const started = !!round.startedAt;
  return (
    <UcatRowActions
      actions={[
        ...(!started && !completed
          ? [
              {
                label: "Edit round",
                icon: <Pencil className="h-4 w-4" />,
                onClick: () => onEdit(round),
              },
            ]
          : []),
        ...(!completed
          ? [
              {
                label: started ? "Rejoin interview" : "Waiting room",
                icon: <DoorOpen className="h-4 w-4" />,
                href: `/interviews/rounds/${round.id}/${started ? "live" : "waiting"}`,
              },
            ]
          : [
              {
                label: "Review results",
                icon: <ClipboardList className="h-4 w-4" />,
                href: `/interviews/rounds/${round.id}/results`,
              },
            ]),
      ]}
    />
  );
}

function layoutColumns(
  items: { id: string; start: number; end: number }[],
) {
  const groups: { id: string; start: number; end: number }[][] = [];
  const seen = new Set<string>();
  for (const item of items) {
    if (seen.has(item.id)) continue;
    const group = [item];
    seen.add(item.id);
    let grew = true;
    while (grew) {
      grew = false;
      for (const other of items) {
        if (seen.has(other.id)) continue;
        const overlaps = group.some(
          (member) => member.start < other.end && member.end > other.start,
        );
        if (overlaps) {
          group.push(other);
          seen.add(other.id);
          grew = true;
        }
      }
    }
    groups.push(group);
  }
  const placements = new Map<string, { column: number; columnCount: number }>();
  for (const group of groups) {
    const sorted = [...group].sort((a, b) => a.start - b.start);
    const columnEnds: number[] = [];
    const columnById = new Map<string, number>();
    for (const item of sorted) {
      const open = columnEnds.findIndex((end) => item.start >= end);
      const column = open === -1 ? columnEnds.length : open;
      columnEnds[column] = item.end;
      columnById.set(item.id, column);
    }
    const columnCount = Math.max(columnEnds.length, 1);
    for (const item of group) {
      placements.set(item.id, {
        column: columnById.get(item.id) ?? 0,
        columnCount,
      });
    }
  }
  return placements;
}

function RoundDetailsTooltip({
  round,
  interviewName,
  className,
  style,
  children,
}: {
  round: InterviewRound;
  interviewName: string;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const triggerHovered = useRef(false);
  const contentHovered = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const cancel = () => clearTimeout(timer.current);
  useEffect(() => () => clearTimeout(timer.current), []);
  const show = () => {
    cancel();
    timer.current = setTimeout(() => setOpen(true), 250);
  };
  const hide = () => {
    cancel();
    timer.current = setTimeout(() => {
      if (triggerHovered.current || contentHovered.current) return;
      setOpen(false);
    }, 200);
  };
  const start = round.scheduledAt ? new Date(round.scheduledAt) : null;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <div
          className={className}
          style={style}
          onMouseEnter={() => {
            triggerHovered.current = true;
            show();
          }}
          onMouseLeave={() => {
            triggerHovered.current = false;
            hide();
          }}
        >
          {children}
        </div>
      </PopoverAnchor>
      <PopoverContent
        side="right"
        className="z-[100] w-80 max-w-[calc(100vw-24px)] border bg-popover p-4 text-popover-foreground shadow-lg"
        onOpenAutoFocus={(event) => event.preventDefault()}
        onCloseAutoFocus={(event) => event.preventDefault()}
        onMouseEnter={() => {
          contentHovered.current = true;
          cancel();
        }}
        onMouseLeave={() => {
          contentHovered.current = false;
          hide();
        }}
      >
        <div className="space-y-3">
          <div className="space-y-1">
            <h3 className="text-sm font-semibold">{round.name}</h3>
            <p className="text-xs text-muted-foreground">{interviewName}</p>
            <div className="flex flex-wrap gap-1.5">
              <Badge variant="secondary">{statusLabel(round)}</Badge>
              <Badge variant="outline">
                {round.delivery === "online" ? "Online" : "In person"}
              </Badge>
              <Badge variant="outline">
                {round.mode === "exam" ? "Exam" : "Feedback"}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              {start ? format(start, "EEE d MMM · h:mm a") : "Not scheduled"}
              {round.recordingEnabled ? " · Recording on" : ""}
            </p>
          </div>
          <section className="space-y-1">
            <h4 className="text-xs font-medium">Students</h4>
            {round.students.length ? (
              <ul className="space-y-0.5 text-xs text-muted-foreground">
                {round.students.map((student) => (
                  <li key={student.id}>{student.name}</li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-muted-foreground">None</p>
            )}
          </section>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function RoundsCalendar({
  rounds,
  interviewName,
  onEdit,
}: {
  rounds: InterviewRound[];
  interviewName: (id: string) => string;
  onEdit: (round: InterviewRound) => void;
}) {
  const [anchor, setAnchor] = useState(new Date());
  const weekStart = startOfWeek(anchor, { weekStartsOn: 1 });
  const days = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
  const hours = Array.from(
    { length: dayEndHour - dayStartHour },
    (_, index) => dayStartHour + index,
  );
  const now = new Date();
  const scheduled = rounds.filter((round) => round.scheduledAt);
  const unscheduled = rounds.filter((round) => !round.scheduledAt);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end gap-2">
        <Button
          variant="outline"
          className={tutorBtnOutline}
          onClick={() => setAnchor(addDays(anchor, -7))}
          aria-label="Previous week"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          className={tutorBtnOutline}
          onClick={() => setAnchor(new Date())}
        >
          Today
        </Button>
        <Button
          variant="outline"
          className={tutorBtnOutline}
          onClick={() => setAnchor(addDays(anchor, 7))}
          aria-label="Next week"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
      <div className="overflow-auto rounded-xl border">
        <div
          className="grid min-w-[880px] bg-background"
          style={{
            gridTemplateColumns: `88px repeat(${days.length}, minmax(140px, 1fr))`,
          }}
        >
          <div className="sticky top-0 z-20 border-b border-r bg-background p-2 text-center text-xs font-medium">
            Time
          </div>
          {days.map((day) => (
            <div
              key={day.toISOString()}
              className={cn(
                "sticky top-0 z-20 border-b border-r bg-background p-2 text-center text-sm font-medium",
                isSameDay(day, now) && "bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300",
              )}
            >
              {format(day, "EEE d MMM")}
            </div>
          ))}
          {hours.map((hour, hourIndex) => (
            <div key={hour} className="contents">
              <div className="sticky left-0 z-10 flex items-center justify-center border-b border-r bg-muted/30 text-sm font-medium" style={{ height: slotHeight }}>
                {format(new Date(2000, 0, 1, hour, 0), "h a")}
              </div>
              {days.map((day) => {
                const dayRounds = scheduled.filter(
                  (round) =>
                    round.scheduledAt &&
                    isSameDay(new Date(round.scheduledAt), day),
                );
                const placements = layoutColumns(
                  dayRounds.flatMap((round) => {
                    if (!round.scheduledAt) return [];
                    const start = new Date(round.scheduledAt);
                    const startMinutes = start.getHours() * 60 + start.getMinutes();
                    const duration = Math.max(
                      30,
                      (round.readingTimeSeconds + round.questionTimeSeconds) / 60,
                    );
                    return [{ id: round.id, start: startMinutes, end: startMinutes + duration }];
                  }),
                );
                return (
                  <div
                    key={`${day.toISOString()}-${hour}`}
                    className={cn(
                      "relative border-b border-r",
                      isSameDay(day, now) ? "bg-blue-50/30 dark:bg-blue-900/10" : "bg-background",
                    )}
                    style={{ height: slotHeight }}
                  >
                    {hourIndex === 0
                      ? dayRounds.map((round) => {
                          if (!round.scheduledAt) return null;
                          const start = new Date(round.scheduledAt);
                          const startMinutes = start.getHours() * 60 + start.getMinutes();
                          const duration = Math.max(
                            30,
                            (round.readingTimeSeconds + round.questionTimeSeconds) / 60,
                          );
                          const place = placements.get(round.id);
                          const column = place?.column ?? 0;
                          const columnCount = place?.columnCount ?? 1;
                          const width = 100 / columnCount;
                          const top =
                            ((startMinutes - dayStartHour * 60) / 60) * slotHeight;
                          const height = Math.max(48, (duration / 60) * slotHeight);
                          return (
                            <RoundDetailsTooltip
                              key={round.id}
                              round={round}
                              interviewName={interviewName(round.interviewId)}
                              className="absolute z-10 overflow-hidden rounded-lg border bg-card p-2 shadow-sm"
                              style={{
                                top,
                                height,
                                left: `calc(${column * width}% + 4px)`,
                                width: `calc(${width}% - 8px)`,
                              }}
                            >
                              <div className="flex items-start justify-between gap-1">
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-medium">{round.name}</p>
                                  <p className="truncate text-xs text-muted-foreground">
                                    {format(start, "h:mm a")} · {interviewName(round.interviewId)}
                                  </p>
                                  <Badge variant="secondary" className="mt-1">
                                    {statusLabel(round)}
                                  </Badge>
                                </div>
                                <RoundActions round={round} onEdit={onEdit} />
                              </div>
                            </RoundDetailsTooltip>
                          );
                        })
                      : null}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
      {unscheduled.length > 0 ? (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold">Not on the calendar</h2>
          <div className="divide-y rounded-xl border">
            {unscheduled.map((round) => (
              <div
                key={round.id}
                className="flex items-center justify-between gap-3 px-4 py-3"
              >
                <div>
                  <p className="font-medium">{round.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {interviewName(round.interviewId)} · {statusLabel(round)} ·{" "}
                    {round.students.length} students
                  </p>
                </div>
                <RoundActions round={round} onEdit={onEdit} />
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

export function InterviewRoundsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const catalogQuery = useInterviewCatalog();
  const roundsQuery = useInterviewRounds();
  const table = useInterviewTable(columnDefinitions.map((column) => column.key));
  const [view, setView] = useState<"calendar" | "table">("calendar");
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<InterviewRound | null>(null);
  const [dismissedEditId, setDismissedEditId] = useState<string | null>(null);
  const catalog = catalogQuery.data;
  const editRoundId = searchParams.get("edit");
  const linkedRound =
    editRoundId && dismissedEditId !== editRoundId
      ? (roundsQuery.data ?? []).find(
          (round) =>
            round.id === editRoundId &&
            !round.startedAt &&
            round.phase !== "completed",
        ) ?? null
      : null;
  const activeRound = editing ?? linkedRound;
  const closeRoundDialog = () => {
    setCreating(false);
    setEditing(null);
    if (editRoundId) {
      setDismissedEditId(editRoundId);
      router.replace("/interviews/rounds");
    }
  };
  const interviewName = (id: string) =>
    catalog?.interviews.find((interview) => interview.id === id)?.name ?? "Interview";

  const filterDefinitions: DataTableFilterDefinition[] = [
    {
      key: "delivery",
      label: "Delivery",
      options: [
        { label: "Online", value: "online" },
        { label: "In person", value: "in_person" },
      ],
    },
    {
      key: "phase",
      label: "Status",
      options: [
        { label: "Waiting", value: "waiting" },
        { label: "Reading", value: "reading" },
        { label: "Questions", value: "questions" },
        { label: "Feedback", value: "feedback" },
        { label: "Completed", value: "completed" },
      ],
    },
  ];

  const rounds = useMemo(() => {
    const names = new Map(
      (catalog?.interviews ?? []).map((interview) => [interview.id, interview.name]),
    );
    const query = table.state.search.trim().toLowerCase();
    const rows = (roundsQuery.data ?? []).filter((round) => {
      const name = `${round.name} ${names.get(round.interviewId) ?? ""}`.toLowerCase();
      return (
        (!query || name.includes(query)) &&
        matchesMulti(table.state.filters, "delivery", round.delivery) &&
        matchesMulti(table.state.filters, "phase", round.phase)
      );
    });
    return sortRows(rows, table.state, "when", {
      when: (round) => round.scheduledAt ?? round.startedAt ?? round.createdAt,
      name: (round) => round.name,
    });
  }, [catalog?.interviews, roundsQuery.data, table.state]);

  const paged = pageRows(rounds, table.state.page, table.state.pageSize);
  const visible = new Set(table.state.visibleColumns);

  return (
    <div className="space-y-6 py-8 md:py-10">
      <InterviewPageHeader
        title="Interview rounds"
        backHref="/interviews"
        backLabel="Back to interviews"
        breadcrumbs={interviewCrumbs("Interview rounds")}
        actions={
          <Button className={tutorBtnPrimary} onClick={() => setCreating(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New round
          </Button>
        }
      />
      <InterviewError
        error={catalogQuery.error ?? roundsQuery.error}
        retry={() => {
          void catalogQuery.refetch();
          void roundsQuery.refetch();
        }}
      />
      <DataTableToolbar
        state={table.state}
        onSearchChange={table.actions.onSearchChange}
        onFiltersChange={table.actions.onFiltersChange}
        onSortChange={table.actions.onSortChange}
        onGroupByChange={table.actions.onGroupByChange}
        onVisibleColumnsChange={table.actions.onVisibleColumnsChange}
        onQuickFilterApply={table.actions.onQuickFilterApply}
        onReset={table.actions.onReset}
        filterDefinitions={filterDefinitions}
        columnDefinitions={columnDefinitions}
        sortOptions={sortOptions}
        searchPlaceholder="Search rounds"
        viewTarget="interview_rounds"
        view={{
          value: view,
          options: [
            { value: "table", label: "Table" },
            { value: "calendar", label: "Calendar" },
          ],
          onChange: (next) => {
            if (next === "table" || next === "calendar") setView(next);
          },
        }}
        {...tutorToolbarProps}
      />
      {roundsQuery.isPending && !roundsQuery.data ? (
        <p className="text-sm text-muted-foreground">Loading rounds…</p>
      ) : view === "calendar" ? (
        <RoundsCalendar
          rounds={rounds}
          interviewName={interviewName}
          onEdit={setEditing}
        />
      ) : paged.total === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No rounds match these filters.
        </p>
      ) : (
        <>
          <DataTable
            {...tutorDataTableProps}
            pagination="external"
            columns={[
              ...(visible.has("name")
                ? [
                    {
                      id: "name",
                      header: "Round",
                      cell: ({ row }: { row: { original: InterviewRound } }) => (
                        <span className="font-medium">{row.original.name}</span>
                      ),
                    },
                  ]
                : []),
              ...(visible.has("interview")
                ? [
                    {
                      id: "interview",
                      header: "Interview",
                      cell: ({ row }: { row: { original: InterviewRound } }) =>
                        interviewName(row.original.interviewId),
                    },
                  ]
                : []),
              ...(visible.has("when")
                ? [
                    {
                      id: "when",
                      header: "When",
                      cell: ({ row }: { row: { original: InterviewRound } }) =>
                        whenLabel(row.original),
                    },
                  ]
                : []),
              ...(visible.has("delivery")
                ? [
                    {
                      id: "delivery",
                      header: "Delivery",
                      cell: ({ row }: { row: { original: InterviewRound } }) =>
                        row.original.delivery === "online" ? "Online" : "In person",
                    },
                  ]
                : []),
              ...(visible.has("phase")
                ? [
                    {
                      id: "phase",
                      header: "Status",
                      cell: ({ row }: { row: { original: InterviewRound } }) => (
                        <Badge variant="secondary">{statusLabel(row.original)}</Badge>
                      ),
                    },
                  ]
                : []),
              ...(visible.has("students")
                ? [
                    {
                      id: "students",
                      header: "Students",
                      cell: ({ row }: { row: { original: InterviewRound } }) =>
                        row.original.students.length,
                    },
                  ]
                : []),
              {
                id: "actions",
                header: "Actions",
                cell: ({ row }: { row: { original: InterviewRound } }) => (
                  <div className="flex justify-end">
                    <RoundActions round={row.original} onEdit={setEditing} />
                  </div>
                ),
              },
            ]}
            data={paged.rows}
          />
          <TablePagination
            page={paged.page}
            pageSize={table.state.pageSize}
            total={paged.total}
            onPageChange={table.actions.onPageChange}
            onPageSizeChange={table.actions.onPageSizeChange}
            pageSizeOptions={[10, 20, 50]}
            className="pt-3"
          />
        </>
      )}
      {catalog && (creating || activeRound) ? (
        <InterviewRoundDialog
          key={activeRound?.id ?? "new"}
          open
          onClose={closeRoundDialog}
          catalog={catalog}
          existingRound={activeRound ?? undefined}
        />
      ) : null}
    </div>
  );
}
