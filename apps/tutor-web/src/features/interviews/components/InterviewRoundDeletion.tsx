"use client";

import { Button, type JSONContent } from "@altitutor/ui";
import { interviewText, type InterviewRichText, type InterviewStationAttempt, type TutorInterviewRoundSummary } from "@altitutor/shared";
import { randomUuid } from "@altitutor/ui/lib/random-uuid";
import { useInterviewCommand, useInterviewPrintRound } from "../hooks/use-interviews";
import { ConfirmAction, InterviewDocument, InterviewError } from "./interview-ui";

function Feedback({ value }: { value: InterviewRichText | undefined }) {
  if (!interviewText(value ?? null).trim()) return null;
  if (value && typeof value === "object" && !Array.isArray(value))
    return <InterviewDocument value={value as JSONContent} />;
  return <p className="whitespace-pre-wrap text-sm">{interviewText(value ?? null)}</p>;
}

function assessmentValues(attempt: InterviewStationAttempt) {
  return JSON.stringify([attempt.score, attempt.notAssessedReason, attempt.generalFeedback, attempt.feedback]);
}

export function InterviewRoundDeletion({ round, open, onOpenChange }: {
  round: TutorInterviewRoundSummary;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const deletion = useInterviewCommand();
  // This read must never heartbeat: reviewing deletion is not participation.
  // Disable it during the mutation so deleting cannot refetch a now-missing round.
  const query = useInterviewPrintRound(round.id, { enabled: open && !deletion.isPending });
  const snapshot = query.data;
  const fresh = query.isFetchedAfterMount && !query.isFetching && !query.isError && !!snapshot;
  const presentIds = new Set([...(snapshot?.connectedStudentIds ?? []), ...(snapshot?.connectedTutorIds ?? [])]);
  const presentNames = [...(snapshot?.students ?? []), ...(snapshot?.tutors ?? [])]
    .filter((person) => presentIds.has(person.id)).map((person) => person.name);
  const saved = snapshot?.attempts.filter((attempt) => attempt.score !== null || !!attempt.notAssessedReason ||
    !!interviewText(attempt.generalFeedback ?? null).trim() || attempt.feedback.some((entry) =>
      entry.score != null || !!interviewText(entry.value).trim())) ?? [];
  const assessments = [
    ...saved.map((attempt) => ({ attempt, label: "Current assessment", key: attempt.id })),
    ...(snapshot?.releasedResults.flatMap((release) => release.attempts
      .filter((attempt) => {
        const current = snapshot.attempts.find((item) => item.id === attempt.id);
        return !current || assessmentValues(current) !== assessmentValues(attempt);
      }).map((attempt) => ({ attempt, label: `Published assessment · revision ${release.revision}`,
        key: `published:${release.studentId}:${release.revision}:${attempt.id}` }))) ?? []),
  ];

  return <ConfirmAction open={open} onOpenChange={onOpenChange}
    title="Are you sure you want to delete this round?"
    description={`Remove ${round.name} from interview lists. Its scores, feedback and recordings will no longer be available to participants.`}
    destructive preventClose pending={deletion.isPending} confirmDisabled={!fresh || presentIds.size > 0}
    confirmLabel={deletion.isPending ? "Deleting…" : "Delete round"} error={deletion.error}
    onConfirm={() => {
      if (!fresh || !snapshot || presentIds.size || deletion.isPending) return;
      void deletion.mutateAsync({ type: "deleteRound", commandId: randomUuid(), roundId: round.id,
        expectedVersion: snapshot.version,
        expectedAttemptVersions: snapshot.attempts.map(({ id, version }) => ({ id, version })),
      }).then(() => onOpenChange(false)).catch(() => undefined);
    }}>
    <div className="max-h-[55vh] space-y-4 overflow-y-auto">
      {query.isFetching && <p role="status" className="text-sm">Loading current scores and feedback…</p>}
      <InterviewError error={query.error} retry={() => void query.refetch()} />
      {fresh && snapshot && <>
        {presentIds.size > 0 && <div role="status" className="rounded-md bg-amber-500/10 p-3 text-sm">
          Someone is still in this interview{presentNames.length ? `: ${presentNames.join(", ")}` : ""}. They must leave before it can be deleted.
        </div>}
        <div className="flex items-center justify-between gap-3 text-sm">
          <p>{saved.length} station assessments with saved work · {snapshot.recordings.length} recordings</p>
          <Button variant="outline" size="sm" onClick={() => { deletion.reset(); void query.refetch(); }}>Refresh</Button>
        </div>
        {!!snapshot.releasedResults.length && <p className="text-sm">Published results will also be removed from student access. Published assessments that differ from the current work are shown below.</p>}
        {!assessments.length && <p className="text-sm text-muted-foreground">No saved scores or written feedback.</p>}
        {assessments.map(({ attempt, label, key }) => {
          const station = snapshot.stations.find((item) => item.id === attempt.stationId);
          const student = snapshot.students.find((item) => item.id === attempt.studentId);
          return <section key={key} className="space-y-2 rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">{label}</p>
            <h3 className="font-medium">{student?.name ?? "Student"} · {station?.name ?? "Station"}</h3>
            <p className="text-sm font-medium">{attempt.notAssessedReason
              ? `Not scored: ${attempt.notAssessedReason}`
              : attempt.score === null ? "No station score" : `${attempt.score} / ${station?.maximumPoints ?? "—"}`}</p>
            <Feedback value={attempt.generalFeedback} />
            {attempt.feedback.filter((entry) => entry.score != null || !!interviewText(entry.value).trim()).map((entry) => {
              const question = station?.questions.find((item) => item.id === entry.placementId);
              return <div key={entry.placementId} className="space-y-1 border-t pt-2">
                <p className="text-sm font-medium">{question ? interviewText(question.question) : "Question feedback"}</p>
                {entry.score != null && <p className="text-sm">Question score: {entry.score} / {station?.maximumPoints ?? "—"}</p>}
                <Feedback value={entry.value} />
              </div>;
            })}
          </section>;
        })}
      </>}
    </div>
  </ConfirmAction>;
}
