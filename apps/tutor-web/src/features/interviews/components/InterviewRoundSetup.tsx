"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Badge,
  Button,
  Checkbox,
  Input,
  SmartDatePickerField,
  TimePicker,
} from "@altitutor/ui";
import type {
  InterviewCatalog,
  InterviewRoundSetup as RoundSetup,
  InterviewTemplate,
  InterviewRound,
} from "@altitutor/shared";
import {
  useInterviewCatalog,
  useInterviewCommand,
  useInterviewRound,
} from "../hooks/use-interviews";
import {
  InterviewError,
  InterviewField,
  InterviewPanel,
  InterviewSearch,
  InterviewSelect,
} from "./interview-ui";
import { tutorBtnOutline } from "@/shared/lib/tutor-visual";
import { cn } from "@/shared/utils";

function SetupEditor({
  interview,
  catalog,
  existingRound,
}: {
  interview: InterviewTemplate;
  catalog: InterviewCatalog;
  existingRound?: InterviewRound;
}) {
  const router = useRouter();
  const command = useInterviewCommand();
  const [step, setStep] = useState(0);
  const [roundVersion] = useState(existingRound?.version ?? 0);
  const [setup, setSetup] = useState<RoundSetup>(
    existingRound
      ? {
          interviewId: existingRound.interviewId,
          name: existingRound.name,
          delivery: existingRound.delivery,
          mode: existingRound.mode,
          recordingEnabled: existingRound.recordingEnabled,
          scheduledAt: existingRound.scheduledAt,
          studentIds: existingRound.studentIds,
          assignments: existingRound.assignments,
        }
      : {
          interviewId: interview.id,
          name: interview.name,
          delivery: "online",
          mode: "exam",
          recordingEnabled: interview.recordingEnabled,
          scheduledAt: null,
          studentIds: [],
          assignments: interview.stations.map((station, index) => ({
            stationId: station.id,
            tutorId: index === 0 ? catalog.actorId : "",
          })),
        },
  );
  const [schedule, setSchedule] = useState(
    existingRound?.scheduledAt ? "later" : "now",
  );
  const [date, setDate] = useState<string | null>(() => {
    if (!existingRound?.scheduledAt) return null;
    const value = new Date(existingRound.scheduledAt);
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
  });
  const [time, setTime] = useState(() =>
    existingRound?.scheduledAt
      ? new Date(existingRound.scheduledAt).toTimeString().slice(0, 5)
      : "09:00",
  );
  const [search, setSearch] = useState("");
  const [classId, setClassId] = useState<string | null>(null);
  const [validation, setValidation] = useState<string | null>(null);
  const students = catalog.students.filter(
    (student) =>
      (!classId || student.classIds.includes(classId)) &&
      student.name.toLowerCase().includes(search.toLowerCase()),
  );
  const steps = ["Details", "Students", "Tutor assignments", "Review"];
  const selectedStudents = catalog.students.filter((student) =>
    setup.studentIds.includes(student.id),
  );
  const canAdvance =
    step === 0
      ? !!setup.name.trim() && (schedule === "now" || !!date)
      : step === 1
        ? setup.studentIds.length > 0
        : step === 2
          ? setup.assignments.every((assignment) => !!assignment.tutorId) &&
            new Set(setup.assignments.map((assignment) => assignment.tutorId))
              .size === interview.stations.length
          : true;
  const create = async () => {
    setValidation(null);
    const scheduledAt =
      schedule === "later" && date
        ? new Date(`${date.slice(0, 10)}T${time}:00`).toISOString()
        : null;
    if (scheduledAt && Date.parse(scheduledAt) <= Date.now()) {
      setValidation("Choose a future date and time.");
      return;
    }
    const roundId = existingRound?.id ?? crypto.randomUUID();
    await command.mutateAsync(
      existingRound
        ? {
            type: "updateRound",
            commandId: crypto.randomUUID(),
            roundId,
            expectedVersion: roundVersion,
            setup: { ...setup, scheduledAt },
          }
        : {
            type: "createRound",
            commandId: crypto.randomUUID(),
            roundId,
            setup: { ...setup, scheduledAt },
          },
    );
    router.push(`/interviews/rounds/${roundId}/waiting`);
  };
  return (
    <div className="mx-auto max-w-5xl space-y-6 py-8">
      <Link
        href={`/interviews/${interview.id}`}
        className="text-sm text-muted-foreground hover:underline"
      >
        ← {interview.name}
      </Link>
      <div>
        <h1 className="text-2xl font-semibold">
          {existingRound ? "Edit round setup" : "Set up a round"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Prepare the circuit before opening the fullscreen waiting room.
        </p>
      </div>
      <ol className="grid grid-cols-4 gap-2">
        {steps.map((label, index) => (
          <li
            key={label}
            className={cn(
              "rounded-xl px-3 py-3 text-sm",
              index === step
                ? "bg-muted font-semibold"
                : "text-muted-foreground",
            )}
          >
            <span className="mr-2">{index + 1}.</span>
            {label}
          </li>
        ))}
      </ol>
      <InterviewError
        error={command.error ?? (validation ? new Error(validation) : null)}
      />
      <InterviewPanel title={steps[step]}>
        {step === 0 && (
          <div className="space-y-5">
            <InterviewField label="Round name">
              <Input
                value={setup.name}
                onChange={(event) =>
                  setSetup({ ...setup, name: event.target.value })
                }
              />
            </InterviewField>
            <div className="grid gap-4 sm:grid-cols-2">
              <InterviewField label="Delivery">
                <InterviewSelect
                  label="Delivery"
                  value={setup.delivery}
                  options={[
                    { id: "online", label: "Online" },
                    { id: "in_person", label: "In person" },
                  ]}
                  onChange={(value) =>
                    setSetup({
                      ...setup,
                      delivery: value === "in_person" ? "in_person" : "online",
                    })
                  }
                />
              </InterviewField>
              <InterviewField label="Mode">
                <InterviewSelect
                  label="Mode"
                  value={setup.mode}
                  options={[
                    { id: "exam", label: "Exam mode" },
                    { id: "feedback", label: "Feedback mode" },
                  ]}
                  onChange={(value) =>
                    setSetup({
                      ...setup,
                      mode: value === "feedback" ? "feedback" : "exam",
                    })
                  }
                />
              </InterviewField>
            </div>
            <p className="text-sm text-muted-foreground">
              {setup.mode === "exam"
                ? "Students cannot see or hear tutors during reading. Communication stops when answers end."
                : "Two-way communication continues through reading, answers and verbal feedback."}
            </p>
            <label className="flex items-start gap-3">
              <Checkbox
                checked={setup.recordingEnabled}
                onCheckedChange={(value) =>
                  setSetup({ ...setup, recordingEnabled: value === true })
                }
              />
              <span className="text-sm">
                Record this round
                <span className="mt-1 block text-muted-foreground">
                  {setup.delivery === "online"
                    ? "Modest-quality video"
                    : "Audio only"}{" "}
                  ·{" "}
                  {setup.mode === "exam"
                    ? "Answers only"
                    : "Answers and feedback"}{" "}
                  · available for 90 days after recording.
                </span>
              </span>
            </label>
            <InterviewField label="When">
              <InterviewSelect
                label="Start time"
                value={schedule}
                options={[
                  { id: "now", label: "Start now" },
                  { id: "later", label: "Schedule for later" },
                ]}
                onChange={(value) => setSchedule(value ?? "now")}
              />
            </InterviewField>
            {schedule === "later" && (
              <div className="space-y-3">
                <div className="grid gap-4 sm:grid-cols-2">
                  <InterviewField label="Date">
                    <SmartDatePickerField
                      value={date}
                      onChange={setDate}
                      valueFormat="date"
                    />
                  </InterviewField>
                  <InterviewField label="Time">
                    <TimePicker
                      value={time}
                      onChange={setTime}
                      aria-label="Scheduled time"
                    />
                  </InterviewField>
                </div>
                <p className="text-sm text-muted-foreground">
                  Time zone: {Intl.DateTimeFormat().resolvedOptions().timeZone}.
                  A tutor still explicitly starts the round.
                </p>
              </div>
            )}
          </div>
        )}
        {step === 1 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Choose currently enrolled students across classes.
              </p>
              <Badge variant="secondary">
                {setup.studentIds.length} / {interview.stations.length}
              </Badge>
            </div>
            <InterviewSearch
              value={search}
              onChange={setSearch}
              placeholder="Search students…"
            >
              <div className="w-52">
                <InterviewSelect
                  label="Filter by class"
                  clear
                  value={classId}
                  options={catalog.classes.map((item) => ({
                    id: item.id,
                    label: item.name,
                  }))}
                  onChange={setClassId}
                />
              </div>
            </InterviewSearch>
            <div className="max-h-96 overflow-y-auto">
              {students.map((student) => (
                <label
                  key={student.id}
                  className={cn(
                    "flex items-center gap-3 rounded-xl p-3",
                    setup.studentIds.includes(student.id) && "bg-muted",
                  )}
                >
                  <Checkbox
                    checked={setup.studentIds.includes(student.id)}
                    disabled={
                      !setup.studentIds.includes(student.id) &&
                      setup.studentIds.length >= interview.stations.length
                    }
                    onCheckedChange={(checked) =>
                      setSetup({
                        ...setup,
                        studentIds: checked
                          ? [...setup.studentIds, student.id]
                          : setup.studentIds.filter((id) => id !== student.id),
                      })
                    }
                  />
                  <span className="text-sm">
                    {student.name}
                    <span className="block text-xs text-muted-foreground">
                      {student.classIds
                        .map(
                          (id) =>
                            catalog.classes.find((item) => item.id === id)
                              ?.name,
                        )
                        .filter(Boolean)
                        .join(", ")}
                    </span>
                  </span>
                </label>
              ))}
              {!students.length && (
                <p className="p-4 text-sm text-muted-foreground">
                  No eligible students match.
                </p>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              Fewer students than stations is supported. Empty stations are idle
              in each online rotation.
            </p>
          </div>
        )}
        {step === 2 && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Assign one different Medicine interview tutor to every station.
              Assignments are fixed once the round starts.
            </p>
            {interview.stations.map((station, index) => (
              <InterviewField
                key={station.id}
                label={`${index + 1}. ${station.name}`}
              >
                <InterviewSelect
                  label={`Tutor for station ${index + 1}`}
                  value={
                    setup.assignments.find(
                      (assignment) => assignment.stationId === station.id,
                    )?.tutorId ?? null
                  }
                  options={catalog.tutors.map((tutor) => ({
                    id: tutor.id,
                    label: tutor.name,
                    disabled: setup.assignments.some(
                      (assignment) =>
                        assignment.tutorId === tutor.id &&
                        assignment.stationId !== station.id,
                    ),
                  }))}
                  onChange={(id) =>
                    setSetup({
                      ...setup,
                      assignments: setup.assignments.map((assignment) =>
                        assignment.stationId === station.id
                          ? { ...assignment, tutorId: id ?? "" }
                          : assignment,
                      ),
                    })
                  }
                />
              </InterviewField>
            ))}
          </div>
        )}
        {step === 3 && (
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <h3 className="font-medium">{setup.name}</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  {setup.delivery === "online" ? "Online" : "In person"} ·{" "}
                  {setup.mode === "exam" ? "Exam" : "Feedback"} · Recording{" "}
                  {setup.recordingEnabled ? "on" : "off"}
                </p>
                <p className="text-sm text-muted-foreground">
                  {schedule === "later"
                    ? `${date?.slice(0, 10)} at ${time}`
                    : "Start now"}
                </p>
              </div>
              <div>
                <p className="text-sm">
                  {interview.readingTimeSeconds} seconds reading ·{" "}
                  {interview.questionTimeSeconds} seconds answering
                </p>
                <p className="text-sm">
                  {setup.studentIds.length} students ·{" "}
                  {interview.stations.length} stations
                </p>
              </div>
            </div>
            {setup.delivery === "online" ? (
              <div className="overflow-x-auto">
                <h3 className="mb-3 font-medium">Online rotation plan</h3>
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr>
                      <th className="p-2">Station / Tutor</th>
                      {interview.stations.map((_, index) => (
                        <th className="p-2" key={index}>
                          Rotation {index + 1}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {interview.stations.map((station, stationIndex) => (
                      <tr key={station.id} className="border-t">
                        <th className="p-2 font-medium">
                          {station.name}
                          <span className="block text-xs font-normal text-muted-foreground">
                            {
                              catalog.tutors.find(
                                (tutor) =>
                                  tutor.id ===
                                  setup.assignments.find(
                                    (assignment) =>
                                      assignment.stationId === station.id,
                                  )?.tutorId,
                              )?.name
                            }
                          </span>
                        </th>
                        {interview.stations.map((_, rotation) => (
                          <td className="p-2" key={rotation}>
                            {selectedStudents[
                              (stationIndex -
                                rotation +
                                interview.stations.length) %
                                interview.stations.length
                            ]?.name ?? "Idle"}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="rounded-xl bg-muted p-4 text-sm">
                There is no assigned station order. Each tutor selects the
                student arriving at their room. A student cannot be selected at
                two stations at once.
              </div>
            )}
            <p className="text-sm text-muted-foreground">
              Participants can join through their notification or the active
              card on their Interviews page. Opening the waiting room does not
              start reading time.
            </p>
          </div>
        )}
      </InterviewPanel>
      <div className="flex justify-between gap-3">
        <Button
          variant="outline"
          className={tutorBtnOutline}
          disabled={step === 0 || command.isPending}
          onClick={() => setStep(step - 1)}
        >
          Previous
        </Button>
        {step < 3 ? (
          <Button disabled={!canAdvance} onClick={() => setStep(step + 1)}>
            Continue
          </Button>
        ) : (
          <Button
            disabled={command.isPending}
            onClick={() => void create().catch(() => undefined)}
          >
            {command.isPending
              ? "Creating…"
              : schedule === "later"
                ? "Schedule round"
                : "Open waiting room"}
          </Button>
        )}
      </div>
    </div>
  );
}

export function InterviewRoundSetup({ id }: { id: string }) {
  const query = useInterviewCatalog();
  const params = useSearchParams();
  const roundId = params.get("round");
  const roundQuery = useInterviewRound(roundId ?? "");
  const interview = query.data?.interviews.find((item) => item.id === id);
  if (!query.data || !interview)
    return (
      <div className="py-8">
        <InterviewError error={query.error} />
        {query.isPending ? "Loading setup…" : "Interview not found."}
      </div>
    );
  if (roundId && !roundQuery.data)
    return (
      <div className="py-8">
        <InterviewError error={roundQuery.error} />
        Loading round setup…
      </div>
    );
  if (roundQuery.data?.startedAt)
    return (
      <div className="py-8">
        <p>This round has started. Tutor assignments and setup are fixed.</p>
        <Link href={`/interviews/rounds/${roundId}/live`}>
          Return to interview
        </Link>
      </div>
    );
  return (
    <SetupEditor
      key={roundId ?? id}
      interview={interview}
      catalog={query.data}
      existingRound={roundQuery.data}
    />
  );
}
