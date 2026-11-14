"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, addDays, parseISO } from "date-fns";
import { interviewRoundDurationMinutes } from "@altitutor/shared";
import type {
  InterviewAssignment,
  InterviewCatalog,
  InterviewRoundSetup,
} from "@altitutor/shared";
import {
  Badge,
  Button,
  Checkbox,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EntityChip,
  Input,
  SmartDatePickerField,
  TimePicker,
} from "@altitutor/ui";
import { Plus, GripVertical } from "lucide-react";
import { sessionsApi } from "@/features/sessions/api/sessions";
import { useInterviewCommand } from "../hooks/use-interviews";
import { planInterviewRounds } from "../lib/bulk-rounds";
import { createRoundsSubmission } from "../lib/round-submission";
import { nextInterviewRoundSchedule } from "../lib/round-defaults";
import {
  InterviewError,
  InterviewField,
  InterviewSelect,
} from "./interview-ui";
import { InterviewStudentPicker } from "./InterviewStudentPicker";
import {
  tutorBtnPrimary,
  tutorDialogContentClass,
  tutorDialogFooterStrip,
  tutorDialogHeaderStrip,
} from "@/shared/lib/tutor-visual";
import { cn } from "@/shared/utils";

const steps = [
  "Interview & settings",
  "Students",
  "Arrange rounds",
  "Station staff",
  "Review & confirm",
];
const partition = (ids: string[], capacity: number) =>
  Array.from(
    { length: Math.ceil(ids.length / Math.max(1, capacity)) },
    (_, index) =>
      ids.slice(
        index * Math.max(1, capacity),
        (index + 1) * Math.max(1, capacity),
      ),
  );

function BulkRoundEditor({
  catalog,
  onClose,
}: {
  catalog: InterviewCatalog;
  onClose: () => void;
}) {
  const command = useInterviewCommand();
  const [submission] = useState(() =>
    createRoundsSubmission(command.mutateAsync),
  );
  const [step, setStep] = useState(0);
  const interviews = catalog.interviews.filter((item) => !item.archived);
  const [interviewId, setInterviewId] = useState<string | null>(
    interviews[0]?.id ?? null,
  );
  const interview = interviews.find((item) => item.id === interviewId);
  const [start] = useState(() => nextInterviewRoundSchedule());
  const [date, setDate] = useState<string | null>(format(start, "yyyy-MM-dd"));
  const [time, setTime] = useState(format(start, "HH:mm"));
  const [sessionDate, setSessionDate] = useState<string | null>(
    format(start, "yyyy-MM-dd"),
  );
  const [name, setName] = useState(interview?.name ?? "Interview");
  const [delivery, setDelivery] =
    useState<InterviewRoundSetup["delivery"]>("in_person");
  const [mode, setMode] = useState<InterviewRoundSetup["mode"]>("feedback");
  const [recordingEnabled, setRecordingEnabled] = useState(true);
  const [allowance, setAllowance] = useState(2);
  const [studentIds, setStudentIds] = useState<string[]>([]);
  const [groups, setGroups] = useState<string[][]>([]);
  const [assignments, setAssignments] = useState<InterviewAssignment[]>(
    () =>
      interview?.stations.map((station, index) => ({
        stationId: station.id,
        tutorId: index === 0 ? catalog.actorId : "",
      })) ?? [],
  );
  const [overrides, setOverrides] = useState<
    Record<number, InterviewAssignment[]>
  >({});
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [dragged, setDragged] = useState<{
    group: number;
    studentId: string;
  } | null>(null);
  const [movingStudent, setMovingStudent] = useState<string | null>(null);
  const capacity = interview?.stations.length ?? 0;
  const durationMinutes = interview
    ? interviewRoundDurationMinutes(
        interview.readingTimeSeconds,
        interview.questionTimeSeconds,
        capacity,
        allowance * 60,
      )
    : 0;
  const locked = command.isPending || submission.pending;
  const rangeDate =
    sessionDate && !Number.isNaN(Date.parse(sessionDate))
      ? parseISO(sessionDate)
      : start;
  const from = format(addDays(rangeDate, -30), "yyyy-MM-dd");
  const to = format(addDays(rangeDate, 30), "yyyy-MM-dd");
  const sessions = useQuery({
    queryKey: ["interviews", "session-options", catalog.actorId, from, to],
    queryFn: () => sessionsApi.getSessionsInDateRange(from, to),
    enabled: step === 1,
  });
  const sessionOptions = (sessions.data ?? []).filter(
    (session) =>
      session.session_id &&
      session.class_id &&
      catalog.classes.some((item) => item.id === session.class_id),
  );
  const selectStudents = (ids: string[]) => {
    if (
      ids.length === studentIds.length &&
      ids.every((id, index) => id === studentIds[index])
    )
      return;
    setStudentIds(ids);
    setGroups(partition(ids, capacity));
    setOverrides({});
  };
  const moveStudent = (studentId: string, target: number) => {
    const source = groups.findIndex((group) => group.includes(studentId));
    if (source < 0 || source === target) return;
    setGroups((current) => {
      const next = current.map((group) => [...group]);
      next[source] = next[source].filter((id) => id !== studentId);
      if (next[target].length >= capacity)
        next[source].push(next[target].pop()!);
      next[target].push(studentId);
      return next;
    });
    setMovingStudent(null);
  };
  const importSession = async () => {
    if (
      !sessionId ||
      !sessionOptions.some((item) => item.session_id === sessionId)
    )
      return;
    setImporting(true);
    setError(null);
    try {
      const details = await sessionsApi.getSessionsWithDetails([sessionId]);
      const detail = details[sessionId];
      if (!detail)
        throw new Error(
          "This session is no longer available. Reload the session list and try again.",
        );
      const members = detail.students;
      const eligible = members.filter((student) =>
        catalog.students.some((item) => item.id === student.id),
      );
      const added = eligible.filter(
        (student) => !studentIds.includes(student.id),
      );
      selectStudents([
        ...new Set([...studentIds, ...eligible.map((student) => student.id)]),
      ]);
      setNotice(
        `Added ${added.length} student${added.length === 1 ? "" : "s"}.${members.length > eligible.length ? ` ${members.length - eligible.length} without current interview enrolment excluded.` : ""}`,
      );
    } catch (caught) {
      setError(caught);
    } finally {
      setImporting(false);
    }
  };
  let planned: InterviewRoundSetup[] = [];
  let planError: string | null = null;
  try {
    if (!interview) throw new Error("Choose an interview.");
    const scheduledAt =
      date && time ? new Date(`${date}T${time}:00`).toISOString() : null;
    planned = planInterviewRounds({
      interview,
      studentIds,
      groups: groups.filter((group) => group.length),
      settings: {
        name,
        delivery,
        mode,
        recordingEnabled,
        rotationAllowanceSeconds: allowance * 60,
        scheduledAt,
        assignments,
      },
      // Retain indexes while excluding empty group cards.
      assignmentsByRound: Object.fromEntries(
        groups
          .map((group, index) => ({ group, index }))
          .filter(({ group }) => group.length)
          .map(({ index }, compactIndex) => [
            compactIndex,
            overrides[index] ?? assignments,
          ]),
      ),
    });
    if (!scheduledAt || Date.parse(scheduledAt) <= Date.now())
      throw new Error("Choose a future start time.");
  } catch (caught) {
    planError =
      caught instanceof Error ? caught.message : "Review the round settings.";
  }
  const detailsValid =
    !!interview &&
    capacity > 0 &&
    !!name.trim() &&
    !!date &&
    !!time &&
    Number.isFinite(allowance) &&
    allowance >= 0 &&
    allowance <= 120;
  const staffValid = (list: InterviewAssignment[]) =>
    list.length === capacity &&
    list.every((item) => !!item.tutorId) &&
    new Set(list.map((item) => item.tutorId)).size === capacity;
  const canAdvance =
    step === 0
      ? detailsValid
      : step === 1
        ? studentIds.length > 0
        : step === 2
          ? groups.some((group) => group.length)
          : step === 3
            ? staffValid(assignments) &&
              groups.every(
                (group, index) =>
                  !group.length || staffValid(overrides[index] ?? assignments),
              )
            : !planError;
  const close = () => {
    if (!locked) onClose();
  };
  const submit = async () => {
    if ((planError || !planned.length) && !submission.pending) return;
    setError(null);
    try {
      await submission.submit(planned);
      onClose();
    } catch (caught) {
      setError(caught);
    }
  };
  const tutorPicker = (
    value: string,
    onChange: (value: string) => void,
    label: string,
  ) => (
    <InterviewSelect
      label={label}
      value={value || null}
      options={catalog.tutors.map((tutor) => ({
        id: tutor.id,
        label: tutor.name,
      }))}
      onChange={(id) => onChange(id ?? "")}
    />
  );
  return (
    <DialogContent
      className={cn(
        tutorDialogContentClass,
        "flex max-h-[90dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-5xl",
      )}
      onEscapeKeyDown={(event) => {
        if (locked) event.preventDefault();
      }}
      onInteractOutside={(event) => {
        if (locked) event.preventDefault();
      }}
      hideCloseButton
    >
      <div className={cn("shrink-0 p-6", tutorDialogHeaderStrip)}>
        <DialogHeader>
          <DialogTitle>Create multiple rounds</DialogTitle>
          <DialogDescription>
            Choose an interview, arrange students, then review consecutive
            rounds before creating them.
          </DialogDescription>
        </DialogHeader>
        <ol
          className="mt-5 flex gap-2 overflow-x-auto"
          aria-label="Bulk round setup steps"
        >
          {steps.map((label, index) => (
            <li
              key={label}
              aria-current={step === index ? "step" : undefined}
              className={cn(
                "min-w-28 flex-1 rounded-md px-3 py-2 text-xs",
                step === index
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground",
              )}
            >
              {index + 1}. {label}
            </li>
          ))}
        </ol>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-6">
        <fieldset disabled={locked || importing} className="min-w-0 space-y-5">
          {step === 0 && (
            <>
              <InterviewField label="Interview">
                <InterviewSelect
                  label="Interview"
                  value={interviewId}
                  options={interviews.map((item) => ({
                    id: item.id,
                    label: item.name,
                  }))}
                  onChange={(id) => {
                    const next = interviews.find((item) => item.id === id);
                    setInterviewId(id);
                    setName(next?.name ?? "Interview");
                    setAssignments(
                      next?.stations.map((station, index) => ({
                        stationId: station.id,
                        tutorId: index === 0 ? catalog.actorId : "",
                      })) ?? [],
                    );
                    setGroups(
                      partition(studentIds, next?.stations.length ?? 1),
                    );
                    setOverrides({});
                  }}
                />
              </InterviewField>
              {!interviews.length && (
                <p>Create an interview in the bank before scheduling rounds.</p>
              )}
              <InterviewField label="Round name prefix">
                <Input
                  aria-label="Round name prefix"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                />
              </InterviewField>
              <div className="grid gap-4 sm:grid-cols-2">
                <InterviewField label="Delivery">
                  <InterviewSelect
                    label="Delivery"
                    value={delivery}
                    options={[
                      { id: "in_person", label: "In person" },
                      { id: "online", label: "Online" },
                    ]}
                    onChange={(value) =>
                      setDelivery(value === "online" ? "online" : "in_person")
                    }
                  />
                </InterviewField>
                <InterviewField label="Mode">
                  <InterviewSelect
                    label="Mode"
                    value={mode}
                    options={[
                      { id: "feedback", label: "Feedback" },
                      { id: "exam", label: "Exam" },
                    ]}
                    onChange={(value) =>
                      setMode(value === "exam" ? "exam" : "feedback")
                    }
                  />
                </InterviewField>
                <InterviewField label="First round date">
                  <SmartDatePickerField
                    value={date}
                    onChange={(value) => {
                      setDate(value);
                      setSessionId(null);
                    }}
                  />
                </InterviewField>
                <InterviewField label="First round time">
                  <TimePicker value={time} onChange={setTime} />
                </InterviewField>
              </div>
              <InterviewField label="Feedback and transition allowance per rotation (minutes)">
                <Input
                  aria-label="Allowance per rotation (minutes)"
                  type="number"
                  min={0}
                  max={120}
                  value={Number.isFinite(allowance) ? allowance : ""}
                  onChange={(event) => setAllowance(event.target.valueAsNumber)}
                />
                <p className="text-sm text-muted-foreground">
                  Added to reading and question time for each rotation to plan
                  consecutive starts. Live feedback still ends when tutors
                  finish.
                </p>
              </InterviewField>
              <label className="flex items-center gap-2">
                <Checkbox
                  checked={recordingEnabled}
                  onCheckedChange={(value) =>
                    setRecordingEnabled(value === true)
                  }
                />
                Record encounters
              </label>
            </>
          )}
          {step === 1 && (
            <>
              <InterviewStudentPicker
                students={catalog.students}
                selectedIds={studentIds}
                onChange={(ids) => {
                  if (!importing) selectStudents(ids);
                }}
              />
              <div className="rounded-lg border p-4">
                <h3 className="mb-3 font-medium">
                  Add students from a session
                </h3>
                <p className="mb-3 text-sm text-muted-foreground">
                  Interview sessions within 30 days of the session date below.
                  Only students with current interview enrolment are added.
                </p>
                <div className="mb-4 max-w-sm">
                  <InterviewField label="Session date">
                    <SmartDatePickerField
                      value={sessionDate}
                      onChange={(value) => {
                        setSessionDate(value);
                        setSessionId(null);
                      }}
                    />
                  </InterviewField>
                </div>
                <div className="flex flex-wrap items-end gap-3">
                  <div className="min-w-56 flex-1">
                    <InterviewSelect
                      label="Session"
                      value={sessionId}
                      options={sessionOptions.map((session) => ({
                        id: session.session_id!,
                        label: `${session.long_name ?? "Interview session"} · ${session.start_at ? format(parseISO(session.start_at), "d MMM yyyy, h:mm a") : "Unscheduled"}`,
                      }))}
                      onChange={setSessionId}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={
                      !sessionOptions.some(
                        (item) => item.session_id === sessionId,
                      ) || importing
                    }
                    onClick={() => void importSession()}
                  >
                    {importing ? "Adding…" : "Add session"}
                  </Button>
                </div>
                {sessions.isPending && (
                  <p className="mt-2 text-sm">Loading sessions…</p>
                )}
                <InterviewError
                  error={sessions.error}
                  retry={() => void sessions.refetch()}
                />
                {notice && (
                  <p role="status" className="mt-3 text-sm">
                    {notice}
                  </p>
                )}
              </div>
            </>
          )}
          {step === 2 && (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-muted-foreground">
                  Drag students between rounds, or choose a student chip to move
                  them. Dropping onto a full round swaps its last student back.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setGroups((current) => [...current, []])}
                >
                  <Plus className="mr-2 size-4" />
                  Add round
                </Button>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {groups.map((group, index) => (
                  <section
                    key={index}
                    className="min-w-0 rounded-lg border p-4"
                    aria-label={`Round ${index + 1}`}
                    onDragOver={(event) => {
                      event.preventDefault();
                      event.dataTransfer.dropEffect = "move";
                    }}
                    onDrop={(event) => {
                      event.preventDefault();
                      if (dragged) moveStudent(dragged.studentId, index);
                      setDragged(null);
                    }}
                  >
                    <h3 className="mb-3 font-medium">
                      Round {index + 1}{" "}
                      <Badge variant="secondary">
                        {group.length}/{capacity}
                      </Badge>
                    </h3>
                    <div className="space-y-3">
                      {group.map((id) => (
                        <div
                          key={id}
                          draggable
                          onDragStart={() =>
                            setDragged({ group: index, studentId: id })
                          }
                          onDragEnd={() => setDragged(null)}
                          className="flex min-w-0 items-center gap-1"
                        >
                          <GripVertical className="size-4 shrink-0 text-muted-foreground" />
                          <EntityChip
                            entityType="student"
                            label={
                              catalog.students.find(
                                (student) => student.id === id,
                              )?.name ?? "Student"
                            }
                            onClick={() =>
                              setMovingStudent(movingStudent === id ? null : id)
                            }
                          />
                          {movingStudent === id && (
                            <InterviewSelect
                              label="Move to round"
                              value={null}
                              options={groups.flatMap((_, target) =>
                                target === index
                                  ? []
                                  : [
                                      {
                                        id: String(target),
                                        label: `Round ${target + 1}${groups[target].length >= capacity ? " (swap)" : ""}`,
                                      },
                                    ],
                              )}
                              onChange={(target) => {
                                if (target !== null)
                                  moveStudent(id, Number(target));
                              }}
                            />
                          )}
                        </div>
                      ))}
                      {!group.length && (
                        <p className="text-sm text-muted-foreground">
                          Drop a student here. Empty rounds are not created.
                        </p>
                      )}
                    </div>
                  </section>
                ))}
              </div>
            </>
          )}
          {step === 3 && (
            <>
              <h3 className="font-medium">Default staff for every round</h3>
              {assignments.map((assignment, stationIndex) => (
                <InterviewField
                  key={assignment.stationId}
                  label={`Station ${stationIndex + 1}`}
                >
                  {tutorPicker(
                    assignment.tutorId,
                    (tutorId) =>
                      setAssignments((current) =>
                        current.map((item, index) =>
                          index === stationIndex ? { ...item, tutorId } : item,
                        ),
                      ),
                    `Tutor for station ${stationIndex + 1}`,
                  )}
                </InterviewField>
              ))}
              <p className="text-sm text-muted-foreground">
                One different tutor per station. Defaults apply to all rounds
                unless overridden below.
              </p>
              {groups.map(
                (group, index) =>
                  group.length > 0 && (
                    <div key={index} className="rounded-lg border p-4">
                      <label className="flex items-center gap-2">
                        <Checkbox
                          checked={!!overrides[index]}
                          onCheckedChange={(checked) =>
                            setOverrides((current) => {
                              const next = { ...current };
                              if (checked)
                                next[index] = assignments.map((item) => ({
                                  ...item,
                                }));
                              else delete next[index];
                              return next;
                            })
                          }
                        />
                        Different staff for round {index + 1}
                      </label>
                      {overrides[index]?.map((assignment, stationIndex) => (
                        <div key={assignment.stationId} className="mt-3">
                          {tutorPicker(
                            assignment.tutorId,
                            (tutorId) =>
                              setOverrides((current) => ({
                                ...current,
                                [index]: current[index].map((item, position) =>
                                  position === stationIndex
                                    ? { ...item, tutorId }
                                    : item,
                                ),
                              })),
                            `Round ${index + 1}, station ${stationIndex + 1} tutor`,
                          )}
                        </div>
                      ))}
                    </div>
                  ),
              )}
            </>
          )}
          {step === 4 && (
            <>
              <p>
                {planned.length} consecutive rounds · {studentIds.length}{" "}
                students · {delivery === "in_person" ? "In person" : "Online"} ·{" "}
                {mode === "feedback" ? "Feedback" : "Exam"} · Recording{" "}
                {recordingEnabled ? "on" : "off"}
              </p>
              {planError && (
                <p role="alert" className="text-sm text-destructive">
                  {planError}
                </p>
              )}
              <div className="space-y-4">
                {planned.map((round, index) => (
                  <section key={index} className="rounded-lg border p-4">
                    <h3 className="font-medium">
                      {round.name} ·{" "}
                      {format(parseISO(round.scheduledAt!), "d MMM, h:mm a")} –{" "}
                      {format(
                        new Date(
                          Date.parse(round.scheduledAt!) +
                            durationMinutes * 60_000,
                        ),
                        "h:mm a",
                      )}
                    </h3>
                    <div className="my-3 flex flex-wrap gap-2">
                      {round.studentIds.map((id) => (
                        <EntityChip
                          key={id}
                          entityType="student"
                          label={
                            catalog.students.find(
                              (student) => student.id === id,
                            )?.name ?? "Student"
                          }
                        />
                      ))}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {round.assignments
                        .map(
                          (assignment, stationIndex) =>
                            `Station ${stationIndex + 1}: ${catalog.tutors.find((tutor) => tutor.id === assignment.tutorId)?.name ?? "Unassigned"}`,
                        )
                        .join(" · ")}
                    </p>
                  </section>
                ))}
              </div>
              <p className="text-sm text-muted-foreground">
                All rounds are created together. Tutors still start each round
                explicitly at its scheduled time.
              </p>
            </>
          )}
        </fieldset>
        <InterviewError error={error} />
        {submission.pending && !command.isPending && (
          <p role="status" className="mt-3 text-sm">
            The result of the previous request is unknown. Retry the original
            series to safely recover it before editing or closing.
          </p>
        )}
      </div>
      <DialogFooter
        className={cn(
          "shrink-0 flex-row justify-between gap-2 p-4",
          tutorDialogFooterStrip,
        )}
      >
        <Button
          type="button"
          variant="outline"
          disabled={locked || importing}
          onClick={step ? () => setStep(step - 1) : close}
        >
          {step ? "Back" : "Cancel"}
        </Button>
        <Button
          type="button"
          className={tutorBtnPrimary}
          disabled={
            importing ||
            command.isPending ||
            (!submission.pending && !canAdvance)
          }
          onClick={step === 4 ? () => void submit() : () => setStep(step + 1)}
        >
          {command.isPending
            ? "Creating rounds…"
            : step === 4
              ? submission.pending
                ? "Retry original rounds"
                : `Create ${planned.length} rounds`
              : "Continue"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

export function InterviewBulkRoundDialog({
  open,
  onClose,
  catalog,
}: {
  open: boolean;
  onClose: () => void;
  catalog: InterviewCatalog;
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!value) onClose();
      }}
    >
      {open && <BulkRoundEditor catalog={catalog} onClose={onClose} />}
    </Dialog>
  );
}
