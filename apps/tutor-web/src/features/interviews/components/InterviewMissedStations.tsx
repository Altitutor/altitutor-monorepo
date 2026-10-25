"use client";

import React, { useState } from "react";
import type {
  InterviewRound,
  InterviewStationAttempt,
} from "@altitutor/shared";
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Input,
} from "@altitutor/ui";
import { randomUuid } from "@altitutor/ui/lib/random-uuid";
import { useInterviewCommand } from "../hooks/use-interviews";
import {
  InterviewError,
  InterviewField,
  InterviewSelect,
} from "./interview-ui";

function MissedAttempt({
  round,
  attempt,
  onSaved,
}: {
  round: InterviewRound;
  attempt: InterviewStationAttempt;
  onSaved: () => void;
}) {
  const [reason, setReason] = useState(attempt.notAssessedReason ?? "");
  const [version] = useState(attempt.version);
  const command = useInterviewCommand();
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Mark this missed encounter as not assessed. It will be excluded from
        possible points; written feedback is retained.
      </p>
      <InterviewField label="Reason not assessed">
        <Input
          aria-label="Reason not assessed"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
        />
      </InterviewField>
      <InterviewError error={command.error} />
      <Button
        disabled={!reason.trim() || command.isPending}
        onClick={() => {
          void command
            .mutateAsync({
              type: "saveAttempt",
              commandId: randomUuid(),
              roundId: round.id,
              attemptId: attempt.id,
              expectedAttemptVersion: version,
              score: null,
              notAssessedReason: reason.trim(),
              generalFeedback: attempt.generalFeedback ?? null,
              feedback: attempt.feedback,
            })
            .then(onSaved)
            .catch(() => undefined);
        }}
      >
        Save not-assessed reason
      </Button>
    </div>
  );
}

/** Resolves unvisited encounters without claiming an absent student or changing attendance. */
export function InterviewMissedStations({
  round,
  stationId,
}: {
  round: InterviewRound;
  stationId: string;
}) {
  const [open, setOpen] = useState(false);
  const [studentId, setStudentId] = useState<string | null>(null);
  const progress = round.progress.find((item) => item.stationId === stationId);
  const attempts = round.attempts.filter(
    (item) =>
      item.stationId === stationId &&
      !item.completed &&
      (round.phase === "waiting" || item.studentId !== progress?.studentId),
  );
  const attempt =
    attempts.find((item) => item.studentId === studentId) ?? attempts[0];
  if (!attempts.length) return null;
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        Resolve missed stations
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              Resolve a missed encounter at your station
            </DialogTitle>
          </DialogHeader>
          <InterviewSelect
            label="Student"
            value={attempt?.studentId ?? null}
            options={attempts.map((item) => ({
              id: item.studentId,
              label:
                round.students.find((student) => student.id === item.studentId)
                  ?.name ?? "Student",
            }))}
            onChange={setStudentId}
          />
          {attempt && (
            <MissedAttempt
              key={`${attempt.id}:${open}`}
              round={round}
              attempt={attempt}
              onSaved={() => setOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
