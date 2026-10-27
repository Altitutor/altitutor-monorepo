"use client";

import { useEffect, useRef, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Badge,
  Button,
  Input,
  Switch,
  type JSONContent,
} from "@altitutor/ui";
import { randomUuid } from "@altitutor/ui/lib/random-uuid";
import {
  INTERVIEW_NOT_SCORED,
  type InterviewStationAttempt,
  type InterviewRound,
  type InterviewSnapshotStation,
} from "@altitutor/shared";
import {
  useInterviewCommand,
  useInterviewCatalog,
  useInterviewRound,
} from "../hooks/use-interviews";
import { useAttemptDraft } from "../hooks/use-attempt-draft";
import {
  InterviewDocument,
  InterviewError,
  InterviewField,
  InterviewPanel,
} from "./interview-ui";
import {
  tutorBtnOutline,
  tutorTableBodyRow,
  tutorTableHeaderRow,
  tutorTableShell,
} from "@/shared/lib/tutor-visual";
import { cn } from "@/shared/utils";
import { InterviewPageHeader } from "./interview-page";

function ResultStationEditor({
  round,
  station,
  attempt,
  registerFlush,
  readOnly,
}: {
  round: InterviewRound;
  station: InterviewSnapshotStation;
  attempt: InterviewStationAttempt;
  registerFlush: (save: (() => Promise<void>) | null) => void;
  readOnly: boolean;
}) {
  const {
    draft,
    update,
    flush,
    state,
    error,
    newerRevision,
    recoveryUnavailable,
    loadSaved,
    keepDraft,
  } = useAttemptDraft(round.id, attempt);
  const notScored = !!draft.notAssessedReason?.trim();
  useEffect(() => {
    registerFlush(flush);
    return () => registerFlush(null);
  }, [flush, registerFlush]);
  return (
    <div className="space-y-5">
      <InterviewError
        error={error}
        retry={() => void flush().catch(() => undefined)}
      />
{recoveryUnavailable && <p role="status" className="text-sm text-amber-700 dark:text-amber-300">Local recovery is unavailable. Online saving still works; wait for Saved before leaving or refreshing.</p>}
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
        <h3 className="font-semibold">{station.name}</h3>
        <Badge variant={state === "failed" ? "destructive" : "secondary"}>
          {state === "saved"
            ? "Saved"
            : state === "saving"
              ? "Saving…"
              : state === "failed"
                ? "Save failed"
                : "Unsaved"}
        </Badge>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <InterviewField label="Overall station score">
          <div className="flex items-center gap-2">
            <Input
              type="number"
              step="any"
              min={0}
              max={station.maximumPoints}
              disabled={notScored || readOnly}
              value={notScored ? "" : (draft.score ?? "")}
              onChange={(event) =>
                update({
                  ...draft,
                  score:
                    event.target.value === ""
                      ? null
                      : Number(event.target.value),
                  notAssessedReason: null,
                })
              }
            />
            <span className="whitespace-nowrap text-sm">
              / {station.maximumPoints}
            </span>
          </div>
        </InterviewField>
        <label className="inline-flex items-center gap-2 self-end text-sm">
          Not scored
          <Switch
            checked={notScored}
            disabled={readOnly}
            aria-label="Not scored"
            onCheckedChange={(checked) =>
              update({
                ...draft,
                score: null,
                notAssessedReason: checked ? INTERVIEW_NOT_SCORED : null,
              })
            }
          />
        </label>
      </div>
      {notScored && (
        <p className="text-sm text-muted-foreground">
          Excluded from possible points. This student’s result will be labelled
          partial.
        </p>
      )}
      <InterviewPanel title="General station feedback">
        <InterviewDocument
          value={draft.generalFeedback as JSONContent | null}
          onChange={
            readOnly
              ? undefined
              : (value) => update({ ...draft, generalFeedback: value })
          }
          placeholder="Write overall feedback for this station (optional)…"
        />
      </InterviewPanel>
      {station.questions.map((question, index) => (
        <InterviewPanel key={question.id} title={`Question ${index + 1}`}>
          <InterviewDocument value={question.question as JSONContent} />
          <InterviewField label="Written feedback">
            <InterviewDocument
              value={
                (draft.feedback.find(
                  (feedback) => feedback.placementId === question.id,
                )?.value as JSONContent) ?? null
              }
              onChange={
                readOnly
                  ? undefined
                  : (value) =>
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
            />
          </InterviewField>
        </InterviewPanel>
      ))}
    </div>
  );
}

function studentSummary(round: InterviewRound, studentId: string) {
  const attempts = round.attempts.filter(
    (attempt) => attempt.studentId === studentId,
  );
  const partial = attempts.some(
    (attempt) => !!attempt.notAssessedReason?.trim(),
  );
  const missing = round.stations.filter((station) => {
    const attempt = attempts.find((item) => item.stationId === station.id);
    return (
      !attempt || (attempt.score === null && !attempt.notAssessedReason?.trim())
    );
  }).length;
  return {
    partial,
    missing,
    score: attempts.reduce((total, attempt) => total + (attempt.score ?? 0), 0),
    possible: round.stations
      .filter(
        (station) =>
          !attempts
            .find((attempt) => attempt.stationId === station.id)
            ?.notAssessedReason?.trim(),
      )
      .reduce((total, station) => total + station.maximumPoints, 0),
  };
}

export function InterviewResults({ id }: { id: string }) {
  const query = useInterviewRound(id);
  const catalog = useInterviewCatalog();
  const command = useInterviewCommand();
  const [studentId, setStudentId] = useState<string | null>(null);
  const [stationId, setStationId] = useState<string | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [releaseConfirm, setReleaseConfirm] = useState(false);
  const flush = useRef<(() => Promise<void>) | null>(null);
  const registerFlush = useRef((save: (() => Promise<void>) | null) => {
    flush.current = save;
  }).current;
  const round = query.data;
  const transition = async (action: () => void) => {
    try {
      await flush.current?.();
      action();
      setError(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason : new Error("Save failed."));
    }
  };
  if (!round)
    return (
      <div className="py-8">
        <InterviewError error={query.error} />
        {query.isPending && "Loading results…"}
      </div>
    );
  const selectedStudent =
    round.students.find((student) => student.id === studentId) ??
    round.students[0];
  const station =
    round.stations.find((item) => item.id === stationId) ?? round.stations[0];
  const attempt = round.attempts.find(
    (item) =>
      item.studentId === selectedStudent?.id && item.stationId === station?.id,
  );
  const released = round.releasedResults.length > 0;
  const release = async () => {
    await flush.current?.();
    const latest = await query.refetch();
    if (!latest.data) return;
    await command.mutateAsync({
      type: "release",
      roundId: id,
      commandId: randomUuid(),
      expectedVersion: latest.data.version,
    });
  };
  return (
    <div className="space-y-6 py-8 md:py-10">
      <InterviewPageHeader
        title={`${round.name} · Results`}
        backHref="/interviews/rounds"
        backLabel="Back to interview rounds"
        breadcrumbs={[
          { label: "Interviews", href: "/interviews" },
          { label: "Interview rounds", href: "/interviews/rounds" },
          { label: "Results" },
        ]}
      />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {released
            ? "Corrections remain drafts until you release an update. Students keep seeing their previous release."
            : "Scores, feedback and recordings stay private until explicitly released."}
        </p>
        <Button
          disabled={command.isPending || round.phase !== "completed"}
          onClick={() => setReleaseConfirm(true)}
        >
          {released ? "Release updated results" : "Release all results"}
        </Button>
      </div>
      <InterviewError error={error ?? command.error ?? query.error} />
      <AlertDialog open={releaseConfirm} onOpenChange={setReleaseConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {released ? "Release updated results?" : "Release results?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Students will be able to see their scores, feedback, and
              recordings.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                void release().catch((reason: unknown) =>
                  setError(
                    reason instanceof Error
                      ? reason
                      : new Error("Unable to release results."),
                  ),
                )
              }
            >
              Release results
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <div className={tutorTableShell}>
        <table className="w-full text-left text-sm">
          <thead>
            <tr className={tutorTableHeaderRow}>
              <th className="p-4">Student</th>
              <th className="p-4">Draft total</th>
              <th className="p-4">Readiness</th>
              <th className="p-4">Released</th>
            </tr>
          </thead>
          <tbody>
            {round.students.map((student) => {
              const summary = studentSummary(round, student.id);
              const result = round.releasedResults.find(
                (item) => item.studentId === student.id,
              );
              return (
                <tr
                  key={student.id}
                  className={cn(
                    tutorTableBodyRow,
                    selectedStudent?.id === student.id && "bg-muted",
                  )}
                >
                  <td className="p-4">
                    <button
                      className="font-medium hover:underline"
                      onClick={() =>
                        void transition(() => setStudentId(student.id))
                      }
                    >
                      {student.name}
                    </button>
                  </td>
                  <td className="p-4">
                    {summary.missing
                      ? "Incomplete"
                      : `${summary.score} / ${summary.possible}`}
                    {summary.partial && (
                      <Badge variant="outline" className="ml-2">
                        Partial
                      </Badge>
                    )}
                  </td>
                  <td className="p-4">
                    {summary.missing
                      ? `${summary.missing} unresolved`
                      : "Ready"}
                  </td>
                  <td className="p-4">
                    {result
                      ? `Revision ${result.revision} · ${new Date(result.releasedAt).toLocaleDateString()}`
                      : "Not released"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {selectedStudent && (
        <InterviewPanel title={selectedStudent.name}>
          <div className="mb-5 flex flex-wrap gap-2">
            {round.stations.map((item, index) => (
              <Button
                key={item.id}
                variant="ghost"
                className={cn(item.id === station?.id && "bg-muted")}
                onClick={() => void transition(() => setStationId(item.id))}
              >
                Station {index + 1}
              </Button>
            ))}
          </div>
          {station && attempt ? (
            <ResultStationEditor
              key={attempt.id}
              round={round}
              station={station}
              attempt={attempt}
              registerFlush={registerFlush}
              readOnly={
                round.assignments.find(
                  (assignment) => assignment.stationId === station.id,
                )?.tutorId !== catalog.data?.actorId
              }
            />
          ) : (
            <p className="text-sm text-muted-foreground">
              No attempt exists for this station. Complete the round before
              resolving its results.
            </p>
          )}
          {attempt && (
            <div className="mt-6 space-y-3 border-t pt-5">
              <h3 className="font-medium">Recordings</h3>
              {!round.recordingEnabled ? (
                <p className="text-sm text-muted-foreground">
                  Recording was off for this round.
                </p>
              ) : (
                round.recordings
                  .filter((recording) => recording.attemptId === attempt.id)
                  .map((recording) => (
                    <div
                      key={recording.id}
                      className="flex flex-wrap justify-between gap-3 text-sm"
                    >
                      <p>
                        {recording.kind === "video" ? "Video" : "Audio"} ·{" "}
                        {recording.state}
                        <span className="ml-2 text-muted-foreground">
                          Expires{" "}
                          {new Date(recording.expiresAt).toLocaleDateString()}
                        </span>
                      </p>
                      {recording.state === "ready" && (
                        <Button
                          variant="outline"
                          className={tutorBtnOutline}
                          onClick={() => {
                            void (async () => {
                              const response = await fetch(
                                `/api/interviews/rounds/${id}/recordings/${recording.id}`,
                              );
                              if (!response.ok)
                                throw new Error("Unable to open recording.");
                              const body: { url: string } =
                                await response.json();
                              window.open(
                                body.url,
                                "_blank",
                                "noopener,noreferrer",
                              );
                            })().catch((reason: unknown) =>
                              setError(
                                reason instanceof Error
                                  ? reason
                                  : new Error("Recording unavailable."),
                              ),
                            );
                          }}
                        >
                          Play recording
                        </Button>
                      )}
                    </div>
                  ))
              )}
              {round.recordingEnabled &&
                !round.recordings.some(
                  (recording) => recording.attemptId === attempt.id,
                ) && (
                  <p className="text-sm text-muted-foreground">
                    No recording is available for this station.
                  </p>
                )}
            </div>
          )}
        </InterviewPanel>
      )}
    </div>
  );
}
