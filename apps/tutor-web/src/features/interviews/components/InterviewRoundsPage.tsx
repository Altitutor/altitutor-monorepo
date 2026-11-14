"use client";
import { TutorEntityToolbar } from "@/features/quick-filters/components/TutorEntityToolbar";
import {
  interviewRoundDurationMinutes,
  tutorDefaultDisplaySettings,
} from "@altitutor/shared";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { addDays, format, isSameDay, startOfWeek } from "date-fns";
import {
  Badge,
  Button,
  DataTable,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Popover,
  PopoverAnchor,
  PopoverContent,
  PopoverTrigger,
  TablePagination,
} from "@altitutor/ui";
import type {
  DataTableColumnDefinition,
  DataTableFilterDefinition,
  DataTableSortOption,
  InterviewRound,
} from "@altitutor/shared";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  DoorOpen,
  Pencil,
  Plus,
  Printer,
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
import { InterviewBulkRoundDialog } from "./InterviewBulkRoundSetup";
import { InterviewPrintDialog } from "./InterviewPrintDialog";
import { InterviewPageHeader, interviewCrumbs } from "./interview-page";
import { roundCanEdit } from "../lib/round-calendar";
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
  { key: "results", label: "Results released", visibleByDefault: false },
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
  onPrint,
}: {
  round: InterviewRound;
  onEdit: (round: InterviewRound) => void;
  onPrint: (round: InterviewRound) => void;
}) {
  const completed = round.phase === "completed";
  const started = !!round.startedAt;
  return (
    <UcatRowActions
      actions={[
        {
          label: "Print prompts",
          icon: <Printer className="h-4 w-4" />,
          onClick: () => onPrint(round),
        },
        ...(roundCanEdit(round)
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

function layoutColumns(items: { id: string; start: number; end: number }[]) {
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
  compact = false,
  onEdit,
  onPrint,
}: {
  round: InterviewRound;
  interviewName: string;
  compact?: boolean;
  onEdit: (round: InterviewRound) => void;
  onPrint: (round: InterviewRound) => void;
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
  const duration = interviewRoundDurationMinutes(
    round.readingTimeSeconds,
    round.questionTimeSeconds,
    round.stations.length,
    round.rotationAllowanceSeconds ?? 0,
  );
  const end = start ? new Date(start.getTime() + duration * 60_000) : null;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <div
          className={className}
          style={style}
          onMouseEnter={() => {
            if (compact) return;
            triggerHovered.current = true;
            show();
          }}
          onMouseLeave={() => {
            if (compact) return;
            triggerHovered.current = false;
            hide();
          }}
        >
          {compact ? (
            <PopoverTrigger asChild>
              <button
                type="button"
                className="flex h-full w-full items-center overflow-hidden px-1 text-left text-xs font-medium"
                aria-label={`View ${round.name}`}
              >
                <span className="truncate">{round.name}</span>
              </button>
            </PopoverTrigger>
          ) : (
            children
          )}
        </div>
      </PopoverAnchor>
      <PopoverContent
        side="right"
        className="z-[100] w-80 max-w-[calc(100vw-24px)] border bg-popover p-4 text-popover-foreground shadow-lg"
        onOpenAutoFocus={(event) => event.preventDefault()}
        onCloseAutoFocus={(event) => event.preventDefault()}
        onMouseEnter={() => {
          if (compact) return;
          contentHovered.current = true;
          cancel();
        }}
        onMouseLeave={() => {
          if (compact) return;
          contentHovered.current = false;
          hide();
        }}
      >
        <div className="space-y-3">
          <div className="space-y-1">
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-sm font-semibold">{round.name}</h3>
            </div>
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
              {start && end
                ? `${format(start, "EEE d MMM · h:mm a")}–${format(end, "h:mm a")} · ${duration} min estimate`
                : "Not scheduled"}
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
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => {
              setOpen(false);
              onPrint(round);
            }}>
              <Printer className="mr-2 size-4" />Print prompts
            </Button>
            {roundCanEdit(round) && (
              <Button variant="outline" size="sm" onClick={() => {
                setOpen(false);
                onEdit(round);
              }}>Edit round</Button>
            )}
            <Button variant="outline" size="sm" asChild>
              <Link href={`/interviews/rounds/${round.id}/${round.phase === "completed" ? "results" : round.startedAt ? "live" : "waiting"}`}>
                {round.phase === "completed" ? "Review results" : round.startedAt ? "Rejoin interview" : "Waiting room"}
              </Link>
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function RoundsCalendar({
  rounds,
  interviewName,
  onEdit,
  onPrint,
}: {
  rounds: InterviewRound[];
  interviewName: (id: string) => string;
  onEdit: (round: InterviewRound) => void;
  onPrint: (round: InterviewRound) => void;
}) {
  const [anchor, setAnchor] = useState(new Date());
  const weekStart = startOfWeek(anchor, { weekStartsOn: 1 });
  const days = Array.from({ length: 7 }, (_, index) =>
    addDays(weekStart, index),
  );
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
                isSameDay(day, now) &&
                  "bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300",
              )}
            >
              {format(day, "EEE d MMM")}
            </div>
          ))}
          {hours.map((hour, hourIndex) => (
            <div key={hour} className="contents">
              <div
                className="sticky left-0 z-10 flex items-center justify-center border-b border-r bg-muted/30 text-sm font-medium"
                style={{ height: slotHeight }}
              >
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
                    const startMinutes =
                      start.getHours() * 60 + start.getMinutes();
                    const duration = interviewRoundDurationMinutes(
                      round.readingTimeSeconds,
                      round.questionTimeSeconds,
                      round.stations.length,
                      round.rotationAllowanceSeconds ?? 0,
                    );
                    return [
                      {
                        id: round.id,
                        start: startMinutes,
                        end: startMinutes + duration,
                      },
                    ];
                  }),
                );
                return (
                  <div
                    key={`${day.toISOString()}-${hour}`}
                    className={cn(
                      "relative border-b border-r",
                      isSameDay(day, now)
                        ? "bg-blue-50/30 dark:bg-blue-900/10"
                        : "bg-background",
                    )}
                    style={{ height: slotHeight }}
                  >
                    {hourIndex === 0
                      ? dayRounds.map((round) => {
                          if (!round.scheduledAt) return null;
                          const start = new Date(round.scheduledAt);
                          const startMinutes =
                            start.getHours() * 60 + start.getMinutes();
                          const duration = interviewRoundDurationMinutes(
                            round.readingTimeSeconds,
                            round.questionTimeSeconds,
                            round.stations.length,
                            round.rotationAllowanceSeconds ?? 0,
                          );
                          const place = placements.get(round.id);
                          const column = place?.column ?? 0;
                          const columnCount = place?.columnCount ?? 1;
                          const width = 100 / columnCount;
                          const top =
                            ((startMinutes - dayStartHour * 60) / 60) *
                            slotHeight;
                          const height = Math.max(
                            4,
                            (duration / 60) * slotHeight,
                          );
                          return (
                            <RoundDetailsTooltip
                              key={round.id}
                              round={round}
                              interviewName={interviewName(round.interviewId)}
                              compact={height < 48}
                              onEdit={onEdit}
                              onPrint={onPrint}
                              className={cn(
                                "absolute z-10 overflow-hidden rounded-lg border bg-card shadow-sm",
                                height >= 48 && "p-2",
                              )}
                              style={{
                                top,
                                height,
                                left: `calc(${column * width}% + 4px)`,
                                width: `calc(${width}% - 8px)`,
                              }}
                            >
                              <div className="flex items-start justify-between gap-1">
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-medium">
                                    {round.name}
                                  </p>
                                  <p className="truncate text-xs text-muted-foreground">
                                    {format(start, "h:mm a")} ·{" "}
                                    {interviewName(round.interviewId)}
                                  </p>
                                  <Badge variant="secondary" className="mt-1">
                                    {statusLabel(round)}
                                  </Badge>
                                </div>
                                <RoundActions
                                  round={round}
                                  onEdit={onEdit}
                                  onPrint={onPrint}
                                />
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
                <RoundActions round={round} onEdit={onEdit} onPrint={onPrint} />
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
  const table = useInterviewTable(
    columnDefinitions
      .filter((column) => column.visibleByDefault)
      .map((column) => column.key),
  );
  const [view, setView] = useState<"calendar" | "table">("calendar");
  const [creating, setCreating] = useState(false);
  const [bulkCreating, setBulkCreating] = useState(false);
  const [printing, setPrinting] = useState<InterviewRound | null>(null);
  const [editing, setEditing] = useState<InterviewRound | null>(null);
  const [dismissedEditId, setDismissedEditId] = useState<string | null>(null);
  const catalog = catalogQuery.data;
  const editRoundId = searchParams.get("edit");
  const linkedRound =
    editRoundId && dismissedEditId !== editRoundId
      ? ((roundsQuery.data ?? []).find(
          (round) =>
            round.id === editRoundId &&
            !round.startedAt &&
            round.phase !== "completed",
        ) ?? null)
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
    catalog?.interviews.find((interview) => interview.id === id)?.name ??
    "Interview";

  const filterDefinitions: DataTableFilterDefinition[] = [
    {
      key: "date",
      label: "Date",
      type: "date-range",
      fromKey: "from",
      toKey: "to",
    },
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
      (catalog?.interviews ?? []).map((interview) => [
        interview.id,
        interview.name,
      ]),
    );
    const query = table.state.search.trim().toLowerCase();
    const rows = (roundsQuery.data ?? []).filter((round) => {
      const name =
        `${round.name} ${names.get(round.interviewId) ?? ""}`.toLowerCase();
      const when = new Date(
        round.scheduledAt ?? round.startedAt ?? round.createdAt,
      );
      const date = Number.isFinite(when.getTime())
        ? format(when, "yyyy-MM-dd")
        : "";
      const from = table.state.filters.from?.[0];
      const to = table.state.filters.to?.[0];
      return (
        (typeof from !== "string" || !from || (!!date && date >= from)) &&
        (typeof to !== "string" || !to || (!!date && date <= to)) &&
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
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button className={tutorBtnPrimary}>
                <Plus className="mr-2 h-4 w-4" />
                New round
                <ChevronDown className="ml-2 h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => setCreating(true)}>
                Single round
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setBulkCreating(true)}>
                Multiple rounds
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        }
      />
      <InterviewError
        error={catalogQuery.error ?? roundsQuery.error}
        retry={() => {
          void catalogQuery.refetch();
          void roundsQuery.refetch();
        }}
      />
      <TutorEntityToolbar
        pageKey={"interview_rounds"}
        defaultSettings={tutorDefaultDisplaySettings(
          table.state.defaultVisibleColumns ?? [],
          { layout: "calendar" },
        )}
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
        view={{
          value: view,
          options: [
            { value: "table", label: "Table" },
            { value: "calendar", label: "Calendar" },
          ],
          onChange: (next) => {
            if (next === "table" || next === "calendar") setView(next);
          },
          onPresetApply: (settings) => {
            if (settings.layout === "table" || settings.layout === "calendar")
              setView(settings.layout);
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
          onPrint={setPrinting}
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
                      cell: ({
                        row,
                      }: {
                        row: { original: InterviewRound };
                      }) => (
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
                        row.original.delivery === "online"
                          ? "Online"
                          : "In person",
                    },
                  ]
                : []),
              ...(visible.has("phase")
                ? [
                    {
                      id: "phase",
                      header: "Status",
                      cell: ({
                        row,
                      }: {
                        row: { original: InterviewRound };
                      }) => (
                        <Badge variant="secondary">
                          {statusLabel(row.original)}
                        </Badge>
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
              ...(visible.has("results")
                ? [
                    {
                      id: "results",
                      header: "Results released",
                      cell: ({
                        row,
                      }: {
                        row: { original: InterviewRound };
                      }) => (
                        <Badge
                          variant={
                            row.original.releasedResults.length
                              ? "default"
                              : "secondary"
                          }
                        >
                          {row.original.releasedResults.length
                            ? "Released"
                            : "Not released"}
                        </Badge>
                      ),
                    },
                  ]
                : []),
              {
                id: "actions",
                header: "Actions",
                cell: ({ row }: { row: { original: InterviewRound } }) => (
                  <div className="flex justify-end">
                    <RoundActions
                      round={row.original}
                      onEdit={setEditing}
                      onPrint={setPrinting}
                    />
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
      {catalog && bulkCreating ? (
        <InterviewBulkRoundDialog
          open
          onClose={() => setBulkCreating(false)}
          catalog={catalog}
        />
      ) : null}
      {printing ? (
        <InterviewPrintDialog
          round={printing}
          onClose={() => setPrinting(null)}
        />
      ) : null}
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
