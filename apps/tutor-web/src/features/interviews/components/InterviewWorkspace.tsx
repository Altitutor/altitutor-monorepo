"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Input,
  InterviewMedia,
  type JSONContent,
} from "@altitutor/ui";
import {
  interviewText,
  type InterviewAttempt,
  type InterviewCommand,
  type InterviewRound,
  type InterviewSnapshotStation,
} from "@altitutor/shared";
import {
  useInterviewCatalog,
  useInterviewCommand,
  useInterviewRound,
} from "../hooks/use-interviews";
import { useAttemptDraft } from "../hooks/use-attempt-draft";
import { useInterviewLeaveGuard } from "../hooks/use-interview-leave-guard";
import { sendInterviewCommand } from "../api/interviews";
import {
  InterviewDocument,
  InterviewError,
  InterviewField,
  InterviewPanel,
  InterviewSelect,
} from "./interview-ui";
import { tutorBtnOutline } from "@/shared/lib/tutor-visual";
import { cn } from "@/shared/utils";

function timerText(milliseconds: number) {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

function PhaseTimer({ round }: { round: InterviewRound }) {
  const [now, setNow] = useState(Date.now());
  const offset = useRef(Date.parse(round.serverNow) - Date.now());
  useEffect(() => {
    offset.current = Date.parse(round.serverNow) - Date.now();
  }, [round.serverNow]);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, []);
  const serverNow = now + offset.current;
  const value = round.phaseDeadline
    ? round.pausedAt
      ? (round.remainingMilliseconds ?? 0)
      : Date.parse(round.phaseDeadline) - serverNow
    : (round.pausedAt ? Date.parse(round.pausedAt) : serverNow) -
      Date.parse(round.phaseStartedAt);
  return (
    <InterviewPanel
      title={`${round.phase[0].toUpperCase()}${round.phase.slice(1)}${round.pausedAt ? " · Paused" : ""}`}
    >
      <p className="font-mono text-4xl tabular-nums">{timerText(value)}</p>
      <p className="mt-2 text-xs text-muted-foreground">
        {round.phaseDeadline ? "Time remaining" : "Elapsed time"}
      </p>
    </InterviewPanel>
  );
}

export function AttemptEditor({
  round,
  station,
  attempt,
  registerFlush,
  actions,
}: {
  round: InterviewRound;
  station: InterviewSnapshotStation;
  attempt: InterviewAttempt;
  registerFlush?: (flush: (() => Promise<void>) | null) => void;
  actions?: React.ReactNode;
}) {
  const {
    draft,
    update,
    flush,
    state,
    error,
    newerRevision,
    loadSaved,
    keepDraft,
  } = useAttemptDraft(round.id, attempt);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [rubric, setRubric] = useState<JSONContent | null>(null);
  const [editingRubric, setEditingRubric] = useState(false);
  const [editingRubricVersion, setEditingRubricVersion] = useState(0);
  const command = useInterviewCommand();
  const seenRubricVersions = useRef(
    new Map(station.questions.map((item) => [item.id, item.rubricVersion])),
  );
  const [updatedRubricIds, setUpdatedRubricIds] = useState<string[]>([]);
  useEffect(() => {
    const changed = station.questions
      .filter(
        (item) =>
          seenRubricVersions.current.has(item.id) &&
          seenRubricVersions.current.get(item.id) !== item.rubricVersion,
      )
      .map((item) => item.id);
    station.questions.forEach((item) =>
      seenRubricVersions.current.set(item.id, item.rubricVersion),
    );
    if (changed.length)
      setUpdatedRubricIds((ids) => Array.from(new Set([...ids, ...changed])));
  }, [station.questions]);
  const question = station.questions[questionIndex];
  const response = draft.feedback.find(
    (feedback) => feedback.placementId === question?.id,
  );
  useEffect(() => {
    registerFlush?.(flush);
    return () => registerFlush?.(null);
  }, [flush, registerFlush]);
  return (
    <div className="space-y-4">
      <InterviewError
        error={error}
        retry={() => void flush().catch(() => undefined)}
      />
      {newerRevision && (
        <div
          role="alert"
          className="space-y-3 rounded-xl bg-amber-500/10 p-4 text-sm"
        >
          <p>
            Another saved revision is available. Your draft is still shown
            below.
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                if (
                  window.confirm(
                    "Discard this draft and load the saved revision?",
                  )
                )
                  loadSaved();
              }}
            >
              Load saved version
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                if (
                  window.confirm(
                    "Replace the saved revision with your current draft?",
                  )
                )
                  keepDraft();
              }}
            >
              Keep my draft
            </Button>
          </div>
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold">
            {
              round.students.find((student) => student.id === attempt.studentId)
                ?.name
            }
          </h2>
          <p
            role="status"
            className={cn(
              "text-xs",
              state === "failed" ? "text-destructive" : "text-muted-foreground",
            )}
          >
            {state === "saved"
              ? "All feedback saved"
              : state === "saving"
                ? "Saving feedback…"
                : state === "failed"
                  ? "Save failed — your draft is retained in this tab"
                  : "Unsaved changes"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor={`score-${attempt.id}`} className="text-sm">
            Score
          </label>
          <Input
            id={`score-${attempt.id}`}
            className="w-24"
            type="number"
            min={0}
            max={station.maximumPoints}
            step="any"
            value={draft.score ?? ""}
            onChange={(event) =>
              update({
                ...draft,
                score:
                  event.target.value === "" ? null : Number(event.target.value),
                notAssessedReason: null,
              })
            }
          />
          <span className="text-sm text-muted-foreground">
            / {station.maximumPoints}
          </span>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {station.questions.map((item, index) => (
          <Button
            variant="ghost"
            className={cn(index === questionIndex && "bg-muted")}
            key={item.id}
            onClick={() => setQuestionIndex(index)}
          >
            Question {index + 1}
            {!interviewText(
              draft.feedback.find(
                (feedback) => feedback.placementId === item.id,
              )?.value ?? null,
            ).trim() && (
              <Badge className="ml-2" variant="outline">
                Unanswered
              </Badge>
            )}
          </Button>
        ))}
      </div>
      {question && (
        <>
          <InterviewPanel title={`Question ${questionIndex + 1}`}>
            <InterviewDocument value={question.question as JSONContent} />
            <InterviewField label="Feedback">
              <InterviewDocument
                key={question.id}
                value={(response?.value as JSONContent) ?? null}
                onChange={(value) =>
                  update({
                    ...draft,
                    feedback: [
                      ...draft.feedback.filter(
                        (feedback) => feedback.placementId !== question.id,
                      ),
                      { placementId: question.id, value },
                    ],
                  })
                }
                placeholder="Write feedback to mark this question answered…"
              />
            </InterviewField>
          </InterviewPanel>
          <InterviewPanel
            title={`Rubric · revision ${question.rubricVersion}`}
            action={
              <Button
                variant="outline"
                className={tutorBtnOutline}
                onClick={() => {
                  setRubric(question.rubric as JSONContent);
                  setEditingRubricVersion(question.rubricVersion);
                  setEditingRubric(true);
                }}
              >
                Edit
              </Button>
            }
          >
            {updatedRubricIds.includes(question.id) && (
              <p role="status" className="mb-3 rounded-lg bg-muted p-3 text-sm">
                The shared rubric was updated during this interview. You are
                viewing revision {question.rubricVersion}.
              </p>
            )}
            <InterviewDocument value={question.rubric as JSONContent} />
          </InterviewPanel>
          <div className="flex items-center justify-between gap-3">
            <Button
              variant="outline"
              className={tutorBtnOutline}
              disabled={questionIndex === 0}
              onClick={() => setQuestionIndex(questionIndex - 1)}
            >
              Previous question
            </Button>
            <Button
              variant="outline"
              className={tutorBtnOutline}
              disabled={questionIndex === station.questions.length - 1}
              onClick={() => setQuestionIndex(questionIndex + 1)}
            >
              Next question
            </Button>
          </div>
        </>
      )}
      {actions}
      <Dialog open={editingRubric} onOpenChange={setEditingRubric}>
        <DialogContent className="max-h-[85dvh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit shared rubric</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This change applies to every active round using this question.
            Question wording stays fixed.
          </p>
          <InterviewDocument value={rubric} onChange={setRubric} />
          <InterviewError error={command.error} />
          <Button
            disabled={command.isPending || !question}
            onClick={() => {
              if (question)
                void command
                  .mutateAsync({
                    type: "saveRubric",
                    commandId: crypto.randomUUID(),
                    questionId: question.questionId,
                    expectedVersion: editingRubricVersion,
                    rubric,
                  })
                  .then(() => setEditingRubric(false))
                  .catch(() => undefined);
            }}
          >
            Save rubric
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function InterviewWorkspace({ id }: { id: string }) {
  const query = useInterviewRound(id);
  const refetch = query.refetch;
  const catalog = useInterviewCatalog();
  const command = useInterviewCommand();
  const leaveGuard = useInterviewLeaveGuard();
  const [toolbar, setToolbar] = useState(true);
  const [override, setOverride] = useState(false);
  const [claim, setClaim] = useState<string | null | undefined>(undefined);
  const [leaving, setLeaving] = useState(false);
  const [pendingAudio, setPendingAudio] = useState(0);
  const [recordingAudio, setRecordingAudio] = useState(false);
  useEffect(() => {
    const listener = (event: Event) => {
      const detail = (
        event as CustomEvent<{
          roundId: string;
          pending: number;
          recording: boolean;
        }>
      ).detail;
      if (detail?.roundId === id) {
        setPendingAudio(detail.pending);
        setRecordingAudio(detail.recording);
      }
    };
    window.addEventListener("altitutor:interview-audio-pending", listener);
    return () =>
      window.removeEventListener("altitutor:interview-audio-pending", listener);
  }, [id]);
  const [localError, setLocalError] = useState<Error | null>(null);
  const flush = useRef<(() => Promise<void>) | null>(null);
  const registerFlush = useRef((callback: (() => Promise<void>) | null) => {
    flush.current = callback;
  }).current;
  const round = query.data;
  const tickKey = useRef<string | null>(null);
  useEffect(() => {
    if (!round?.phaseDeadline || round.pausedAt) return;
    const deadline = round.phaseDeadline;
    const serverOffset = Date.parse(round.serverNow) - Date.now();
    const timer = setInterval(() => {
      if (
        Date.now() + serverOffset < Date.parse(deadline) ||
        tickKey.current === deadline
      )
        return;
      tickKey.current = deadline;
      void sendInterviewCommand({
        type: "tick",
        roundId: id,
        commandId: crypto.randomUUID(),
      })
        .then((result) => {
          if (result.mediaWarning)
            setLocalError(new Error(result.mediaWarning));
          return refetch();
        })
        .catch(() => {
          tickKey.current = null;
        });
    }, 500);
    return () => clearInterval(timer);
  }, [id, refetch, round?.phaseDeadline, round?.pausedAt, round?.serverNow]);
  const run = async (action: InterviewCommand) => {
    setLocalError(null);
    try {
      await flush.current?.();
      if ("expectedVersion" in action && "roundId" in action && round) {
        const latest = await refetch();
        if (!latest.data)
          throw new Error("Unable to refresh the round before this action.");
        const controls = (value: InterviewRound) =>
          JSON.stringify({
            phase: value.phase,
            rotation: value.rotation,
            startedAt: value.startedAt,
            pausedAt: value.pausedAt,
            progress: value.progress,
          });
        if (controls(latest.data) !== controls(round))
          throw new Error(
            "The round changed while your feedback was saving. Review its current state and try again.",
          );
        await command.mutateAsync({
          ...action,
          expectedVersion: latest.data.version,
        });
      } else await command.mutateAsync(action);
    } catch (error) {
      setLocalError(
        error instanceof Error ? error : new Error("Unable to save changes."),
      );
    }
  };
  const exit = async () => {
    setLeaving(true);
    try {
      await flush.current?.();
      leaveGuard.leave();
    } catch (error) {
      setLocalError(
        error instanceof Error
          ? error
          : new Error("Save your feedback before leaving."),
      );
      setLeaving(false);
    }
  };
  if (!round)
    return (
      <div className="flex min-h-dvh items-center justify-center p-6">
        <InterviewError
          error={query.error}
          retry={() => void query.refetch()}
        />
        {query.isPending && "Loading waiting room…"}
      </div>
    );
  const actorId = catalog.data?.actorId;
  const progress = round.progress.find((item) => item.tutorId === actorId);
  const station = round.stations.find(
    (item) => item.id === progress?.stationId,
  );
  const attempt = round.attempts.find(
    (item) =>
      item.studentId === progress?.studentId && item.stationId === station?.id,
  );
  const base = {
    roundId: id,
    expectedVersion: round.version,
    commandId: crypto.randomUUID(),
  };
  const allReady = round.progress.every((item) => item.ready);
  const allFinished = round.progress.every(
    (item) => item.feedbackComplete || !item.studentId,
  );
  const missingStudents = round.studentIds.filter(
    (studentId) => !round.connectedStudentIds.includes(studentId),
  );
  const isWaiting = !round.startedAt || round.phase === "waiting";
  return (
    <div className="min-h-dvh bg-background">
      <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur">
        <div className="flex items-center justify-between gap-3 px-5 py-3">
          <div className="flex items-center gap-3">
            <h1 className="font-semibold">{round.name}</h1>
            <Badge variant="secondary">
              {isWaiting ? "Waiting room" : round.phase}
            </Badge>
            {round.pausedAt && <Badge variant="outline">Paused</Badge>}
          </div>
          <Button variant="ghost" onClick={() => setToolbar(!toolbar)}>
            {toolbar ? "Hide toolbar" : "Show toolbar"}
          </Button>
        </div>
        {toolbar && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t px-5 py-3">
            <p className="text-sm text-muted-foreground">
              {round.delivery === "online" ? "Online" : "In person"} ·{" "}
              {round.mode === "exam" ? "Exam mode" : "Feedback mode"} · Rotation{" "}
              {round.rotation + 1} / {round.stations.length} · Recording{" "}
              {round.recordingEnabled ? "on" : "off"}
            </p>
            <div className="flex gap-2">
              {round.startedAt && round.phase !== "completed" && (
                <Button
                  variant="outline"
                  className={tutorBtnOutline}
                  disabled={!progress || command.isPending}
                  onClick={() =>
                    void run({
                      ...base,
                      type: round.pausedAt ? "resume" : "pause",
                    })
                  }
                >
                  {round.pausedAt ? "Resume everyone" : "Pause everyone"}
                </Button>
              )}
              <Button
                variant="outline"
                className={tutorBtnOutline}
                onClick={leaveGuard.requestExit}
              >
                Exit
              </Button>
            </div>
          </div>
        )}
      </header>
      <main className="mx-auto max-w-[1600px] space-y-5 p-5">
        <InterviewError
          error={localError ?? command.error ?? query.error}
          retry={() => void query.refetch()}
        />
        {query.isError && (
          <p className="text-sm text-destructive">
            Connection interrupted. The circuit continues; retrying the current
            state.
          </p>
        )}
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-6">
          {round.progress.map((item, index) => (
            <div
              key={item.stationId}
              className={cn(
                "rounded-xl border p-3 text-sm",
                item.tutorId === actorId && "bg-muted",
              )}
            >
              <p className="font-medium">
                Station {index + 1}
                {item.tutorId === actorId && " · You"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {round.tutors.find((tutor) => tutor.id === item.tutorId)?.name}
              </p>
              <p className="mt-2 truncate">
                {round.students.find((student) => student.id === item.studentId)
                  ?.name ?? "No student"}
              </p>
              <Badge variant="outline" className="mt-2">
                {item.feedbackComplete
                  ? "Finished"
                  : item.endedEarly
                    ? "Marking"
                    : item.ready
                      ? "Ready"
                      : "Not ready"}
              </Badge>
            </div>
          ))}
        </div>
        {round.phase === "completed" ? (
          <InterviewPanel title="Round complete">
            <p className="mb-4 text-sm text-muted-foreground">
              Review missing marks and release results when every student is
              ready.
            </p>
            <Button asChild>
              <Link href={`/interviews/rounds/${id}/results`}>
                Review results
              </Link>
            </Button>
          </InterviewPanel>
        ) : (
          <div className="grid items-start gap-5 lg:grid-cols-[minmax(260px,0.8fr)_minmax(0,1.4fr)]">
            <div className="space-y-4">
              <PhaseTimer round={round} />
              <InterviewPanel title={station?.name ?? "Your station"}>
                <InterviewMedia
                  role="tutor"
                  roundId={id}
                  phase={round.phase}
                  delivery={round.delivery}
                  enabled={
                    !round.pausedAt &&
                    !(round.mode === "exam" && !!progress?.endedEarly)
                  }
                />
                {round.delivery === "in_person" && (
                  <p className="mt-3 text-sm text-muted-foreground">
                    Students read printed prompts outside the room. Select
                    whoever arrives; no station order is assigned.
                  </p>
                )}
                {round.recordings
                  .filter(
                    (recording) =>
                      recording.attemptId === attempt?.id &&
                      recording.state === "failed",
                  )
                  .map((recording) => (
                    <p
                      role="alert"
                      className="mt-3 text-sm text-amber-700 dark:text-amber-300"
                      key={recording.id}
                    >
                      Recording failed. Continue the interview; feedback and
                      marks can still be saved.
                    </p>
                  ))}
              </InterviewPanel>
              {round.delivery === "in_person" &&
                station &&
                ["waiting", "reading", "questions"].includes(round.phase) && (
                  <InterviewPanel title="Student at your station">
                    <InterviewSelect
                      label="Select arriving student"
                      value={progress?.studentId ?? null}
                      clear
                      options={round.students.map((student) => ({
                        id: student.id,
                        label: student.name,
                        disabled: round.progress.some(
                          (item) =>
                            item.studentId === student.id &&
                            item.stationId !== station.id,
                        ),
                      }))}
                      onChange={(studentId) => {
                        if (
                          attempt &&
                          (attempt.score !== null ||
                            attempt.notAssessedReason !== null ||
                            attempt.feedback.length > 0 ||
                            round.recordings.some(
                              (recording) => recording.attemptId === attempt.id,
                            ))
                        )
                          setClaim(studentId);
                        else
                          void run({
                            ...base,
                            type: "claimStudent",
                            studentId,
                          });
                      }}
                    />
                  </InterviewPanel>
                )}
            </div>
            <div className="space-y-4">
              {isWaiting && (
                <InterviewPanel
                  title={
                    round.startedAt
                      ? "Ready for the next rotation"
                      : "Waiting room"
                  }
                >
                  <p className="mb-4 text-sm text-muted-foreground">
                    {round.scheduledAt
                      ? `Scheduled ${new Date(round.scheduledAt).toLocaleString()}. `
                      : ""}
                    Any participating tutor may start reading once every station
                    is ready.
                  </p>
                  <div className="space-y-2">
                    {round.students.map((student) => (
                      <div
                        key={student.id}
                        className="flex justify-between rounded-lg bg-muted/40 p-3 text-sm"
                      >
                        <span>{student.name}</span>
                        <span className="text-muted-foreground">
                          {round.connectedStudentIds.includes(student.id)
                            ? "Connected"
                            : round.delivery === "online"
                              ? "Not connected"
                              : "In person"}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-5 flex flex-wrap gap-2">
                    {!round.startedAt && (
                      <Button
                        asChild
                        variant="outline"
                        className={tutorBtnOutline}
                      >
                        <Link
                          href={`/interviews/${round.interviewId}/setup?round=${round.id}`}
                        >
                          Edit setup
                        </Link>
                      </Button>
                    )}
                    {!round.startedAt && (
                      <Button
                        disabled={!progress || command.isPending}
                        onClick={() => void run({ ...base, type: "start" })}
                      >
                        Start round
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      className={tutorBtnOutline}
                      disabled={
                        !progress || !round.startedAt || command.isPending
                      }
                      onClick={() =>
                        void run({
                          ...base,
                          type: "ready",
                          ready: !progress?.ready,
                        })
                      }
                    >
                      {progress?.ready ? "Mark not ready" : "I’m ready"}
                    </Button>
                    <Button
                      disabled={
                        !progress ||
                        !round.startedAt ||
                        !allReady ||
                        command.isPending
                      }
                      onClick={() => {
                        if (
                          round.delivery === "online" &&
                          missingStudents.length
                        )
                          setOverride(true);
                        else void run({ ...base, type: "startReading" });
                      }}
                    >
                      Start reading
                    </Button>
                  </div>
                </InterviewPanel>
              )}
              {round.startedAt && attempt && station && (
                <AttemptEditor
                  key={attempt.id}
                  round={round}
                  station={station}
                  attempt={attempt}
                  registerFlush={registerFlush}
                  actions={
                    <div className="flex flex-wrap gap-2">
                      {round.phase === "questions" && !progress?.endedEarly && (
                        <Button
                          variant="outline"
                          className={tutorBtnOutline}
                          disabled={command.isPending}
                          onClick={() =>
                            void run({ ...base, type: "endStation" })
                          }
                        >
                          End my station early
                        </Button>
                      )}
                      {(round.phase === "feedback" || progress?.endedEarly) &&
                        !progress?.feedbackComplete && (
                          <Button
                            disabled={command.isPending}
                            onClick={() =>
                              void run({ ...base, type: "finishFeedback" })
                            }
                          >
                            Finish feedback
                          </Button>
                        )}
                    </div>
                  }
                />
              )}
              {!isWaiting && !attempt && (
                <InterviewPanel title="Station idle">
                  <p className="text-sm text-muted-foreground">
                    {round.delivery === "in_person"
                      ? "Select the arriving student to start feedback and scoring."
                      : "No student is assigned in this rotation."}
                  </p>
                </InterviewPanel>
              )}
              {round.phase === "feedback" && (
                <InterviewPanel>
                  <Button
                    disabled={!progress || !allFinished || command.isPending}
                    onClick={() => void run({ ...base, type: "next" })}
                  >
                    {round.rotation + 1 === round.stations.length
                      ? "Complete round"
                      : "Next rotation"}
                  </Button>
                  {!allFinished && (
                    <p className="mt-3 text-sm text-muted-foreground">
                      Waiting for every tutor to finish feedback.
                    </p>
                  )}
                </InterviewPanel>
              )}
            </div>
          </div>
        )}
      </main>
      <Dialog
        open={leaveGuard.open}
        onOpenChange={(open) => {
          if (!open) leaveGuard.cancel();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Leave this interview?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {round.phase === "completed"
              ? "This round is complete. You can return to its results from Interviews."
              : "The round continues for everyone else. We’ll save your pending feedback before leaving. You can rejoin from Interviews."}
          </p>
          <InterviewError error={localError} />
          {(pendingAudio > 0 || recordingAudio) && (
            <p className="rounded-lg bg-amber-500/10 p-3 text-sm">
              {recordingAudio
                ? "Audio is still recording. Stop your microphone before leaving to finish the current segment. "
                : ""}
              {pendingAudio > 0
                ? `${pendingAudio} audio segment(s) still need uploading. Keep this tab open until uploads finish, or rejoin later from this browser to retry.`
                : ""}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={leaveGuard.cancel}>
              Stay
            </Button>
            <Button disabled={leaving} onClick={() => void exit()}>
              {leaving ? "Saving feedback…" : "Save feedback and exit"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={override} onOpenChange={setOverride}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Start without every student connected?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {round.students
              .filter((student) => missingStudents.includes(student.id))
              .map((student) => student.name)
              .join(", ")}{" "}
            can reconnect, but the timer will continue.
          </p>
          <Button
            onClick={() => {
              setOverride(false);
              void run({
                ...base,
                type: "startReading",
                overrideMissingStudents: true,
              });
            }}
          >
            Start reading anyway
          </Button>
        </DialogContent>
      </Dialog>
      <Dialog
        open={claim !== undefined}
        onOpenChange={(open) => {
          if (!open) setClaim(undefined);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Move feedback to this student?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Confirm that your existing feedback and score belong to the newly
            selected student.
          </p>
          <Button
            onClick={() => {
              if (claim !== undefined)
                void run({
                  ...base,
                  type: "claimStudent",
                  studentId: claim,
                  confirmMove: true,
                });
              setClaim(undefined);
            }}
          >
            Confirm student correction
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
