"use client";

import { useRef, useState } from "react";
import { Button } from "@altitutor/ui";
import { randomUuid } from "@altitutor/ui/lib/random-uuid";
import type {
  InterviewCatalog,
  InterviewCommand,
  InterviewRound,
} from "@altitutor/shared";
import { useInterviewCommand } from "../hooks/use-interviews";
import {
  ConfirmAction,
  InterviewError,
  InterviewPanel,
  InterviewSelect,
} from "./interview-ui";

type Correction = Extract<
  InterviewCommand,
  { type: "replaceStudent" | "swapStationStudents" }
>;

export function InterviewReassignment({
  round,
  catalog,
  beforeChange,
}: {
  round: InterviewRound;
  catalog: InterviewCatalog;
  beforeChange: () => Promise<void>;
}) {
  const command = useInterviewCommand();
  const [operation, setOperation] = useState<
    "replaceStudent" | "swapStationStudents"
  >("replaceStudent");
  const [studentId, setStudentId] = useState<string | null>(null);
  const [targetStudentId, setTargetStudentId] = useState<string | null>(null);
  const [stationId, setStationId] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const pending = useRef<Correction | null>(null);
  const assignedStations = round.stations.filter((station) =>
    round.assignments.some(
      (assignment) =>
        assignment.stationId === station.id &&
        assignment.tutorId === catalog.actorId,
    ),
  );
  const targets =
    operation === "replaceStudent"
      ? catalog.students.filter(
          (student) => !round.studentIds.includes(student.id),
        )
      : round.students.filter((student) => student.id !== studentId);
  const canManage =
    round.createdBy === catalog.actorId ||
    round.tutors.some((tutor) => tutor.id === catalog.actorId);
  if (!canManage) return null;
  const source = round.students.find((student) => student.id === studentId);
  const target = targets.find((student) => student.id === targetStudentId);
  const ready =
    !!source &&
    !!target &&
    (operation === "replaceStudent" ||
      assignedStations.some((station) => station.id === stationId));
  const apply = async () => {
    try {
      await beforeChange();
      if (!pending.current && studentId && targetStudentId) {
        const base = {
          commandId: randomUuid(),
          roundId: round.id,
          expectedVersion: round.version,
          studentId,
          targetStudentId,
        };
        pending.current =
          operation === "replaceStudent"
            ? { ...base, type: operation }
            : { ...base, type: operation, stationId: stationId! };
      }
      if (!pending.current) return;
      await command.mutateAsync(pending.current);
      pending.current = null;
      setConfirmation(false);
      setStudentId(null);
      setTargetStudentId(null);
      setError(null);
    } catch (reason) {
      if (
        reason &&
        typeof reason === "object" &&
        "status" in reason &&
        typeof reason.status === "number" &&
        reason.status >= 400 &&
        reason.status < 500
      )
        pending.current = null;
      setError(
        reason instanceof Error
          ? reason
          : new Error("Unable to reassign the interview."),
      );
    }
  };
  return (
    <InterviewPanel title="Correct student attribution" className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Replace a mistakenly added student, or swap two students’ complete
        encounters at your station. Scores, feedback, question timing and
        recordings stay together.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <InterviewSelect
          label="Correction"
          value={operation}
          options={[
            { id: "replaceStudent", label: "Replace a student on this round" },
            {
              id: "swapStationStudents",
              label: "Swap two students at a station",
              disabled: !assignedStations.length,
            },
          ]}
          disabled={command.isPending}
          onChange={(value) => {
            setOperation(
              value === "swapStationStudents" ? value : "replaceStudent",
            );
            setTargetStudentId(null);
            pending.current = null;
          }}
        />
        <InterviewSelect
          label="Student currently attributed"
          value={studentId}
          options={round.students.map((student) => ({
            id: student.id,
            label: student.name,
          }))}
          disabled={command.isPending}
          onChange={(value) => {
            setStudentId(value);
            setTargetStudentId(null);
            pending.current = null;
          }}
        />
        <InterviewSelect
          label={
            operation === "replaceStudent"
              ? "Replacement student"
              : "Swap with student"
          }
          value={targetStudentId}
          options={targets.map((student) => ({
            id: student.id,
            label: student.name,
          }))}
          disabled={command.isPending}
          onChange={(value) => {
            setTargetStudentId(value);
            pending.current = null;
          }}
        />
        {operation === "swapStationStudents" && (
          <InterviewSelect
            label="Your station"
            value={stationId}
            options={assignedStations.map((station) => ({
              id: station.id,
              label: station.name,
            }))}
            disabled={command.isPending}
            onChange={(value) => {
              setStationId(value);
              pending.current = null;
            }}
          />
        )}
      </div>
      <p className="text-sm text-amber-800 dark:text-amber-300">
        Affected students’ released results and playback will be withdrawn until
        corrected results are released. Published performance reviews keep their
        existing evidence: ask their authors to review and republish affected
        reviews separately.
      </p>
      <InterviewError error={error} />
      <Button
        variant="outline"
        disabled={!ready || command.isPending}
        onClick={() => {
          setError(null);
          setConfirmation(true);
        }}
      >
        Review reassignment
      </Button>
      <ConfirmAction
        error={error}
        preventClose
        pending={command.isPending}
        open={confirmation}
        onOpenChange={(open) => {
          if (!command.isPending) setConfirmation(open);
        }}
        title={
          operation === "replaceStudent"
            ? "Replace this student?"
            : "Swap these station encounters?"
        }
        description={
          operation === "replaceStudent"
            ? `All encounters attributed to ${source?.name} will belong to ${target?.name}. ${source?.name} will no longer have access to this round. Affected results and playback will be withdrawn until you release the correction.`
            : `${source?.name} and ${target?.name} will exchange their complete encounters at the selected station. Both students’ results and playback will be withdrawn until you release the correction.`
        }
        confirmLabel={command.isPending ? "Saving…" : "Confirm reassignment"}
        onConfirm={() => {
          if (!command.isPending) void apply();
        }}
      />
    </InterviewPanel>
  );
}
