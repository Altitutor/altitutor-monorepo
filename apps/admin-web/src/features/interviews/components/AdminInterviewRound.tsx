"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  Badge,
  Button,
  InterviewMedia,
  InterviewRoundOverview,
  InterviewStationStatusStrip,
  RichTextEditor,
  type JSONContent,
} from "@altitutor/ui";
import {
  interviewText,
  type InterviewRound,
  type InterviewRichText,
} from "@altitutor/shared";
import { useQuickActions } from "@/shared/contexts/QuickActionsContext";

function Document({ value }: { value: InterviewRichText | undefined }) {
  if (!value || !interviewText(value).trim())
    return <p className="text-sm text-muted-foreground">No feedback yet.</p>;
  return (
    <RichTextEditor
      content={
        typeof value === "object" && !Array.isArray(value)
          ? (value as JSONContent)
          : {
              type: "doc",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: interviewText(value) }],
                },
              ],
            }
      }
      editable={false}
      minHeight="0"
      autoHeight
    />
  );
}
function portalOrigin(name: "TUTOR" | "STUDENT") {
  const configured =
    name === "TUTOR"
      ? process.env.NEXT_PUBLIC_TUTOR_URL
      : process.env.NEXT_PUBLIC_STUDENT_URL;
  return (
    configured ||
    (process.env.NODE_ENV === "production"
      ? `https://${name.toLowerCase()}.altitutor.com`
      : `http://localhost:${name === "TUTOR" ? 3002 : 3001}`)
  ).replace(/\/$/, "");
}
export function AdminInterviewRound({ roundId }: { roundId: string }) {
  const [selectedStationId, setSelectedStationId] = useState<string | null>(
    null,
  );
  const [questionIndex, setQuestionIndex] = useState(0);
  const [now, setNow] = useState(Date.now());
  const { openAnnouncementsModal } = useQuickActions();
  const query = useQuery({
    queryKey: ["admin-interview-round", roundId],
    queryFn: async (): Promise<InterviewRound> => {
      const response = await fetch(
        `/api/interviews/rounds/${encodeURIComponent(roundId)}`,
        { cache: "no-store" },
      );
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error ?? "Unable to load interview.");
      return data;
    },
    refetchInterval: 2000,
    refetchIntervalInBackground: false,
  });
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  if (!query.data)
    return (
      <main className="p-6">
        {query.isError ? (
          <div role="alert">
            <p>{query.error.message}</p>
            <Button onClick={() => void query.refetch()}>Try again</Button>
          </div>
        ) : (
          <p role="status">Loading interview…</p>
        )}
      </main>
    );
  const round = query.data;
  const station = round.stations.find((item) => item.id === selectedStationId);
  const progress = round.progress.find(
    (item) => item.stationId === selectedStationId,
  );
  const student = round.students.find(
    (item) => item.id === progress?.studentId,
  );
  const tutor = round.tutors.find((item) => item.id === progress?.tutorId);
  const attempt = round.attempts.find(
    (item) =>
      item.stationId === selectedStationId &&
      item.studentId === progress?.studentId,
  );
  const question =
    station?.questions[Math.min(questionIndex, station.questions.length - 1)];
  const seconds = round.pausedAt
    ? Math.max(0, Math.ceil((round.remainingMilliseconds ?? 0) / 1000))
    : round.phaseDeadline
      ? Math.max(
          0,
          Math.ceil(
            (Date.parse(round.phaseDeadline) -
              (now + Date.parse(round.serverNow) - query.dataUpdatedAt)) /
              1000,
          ),
        )
      : null;
  const phase =
    round.phase === "questions"
      ? "Question time"
      : round.phase === "feedback" && round.mode === "exam"
        ? "Marking"
        : round.phase === "waiting" && !round.startedAt
          ? "Waiting room"
          : round.phase.charAt(0).toUpperCase() + round.phase.slice(1);
  const canObserve =
    round.delivery === "online" &&
    round.phase !== "completed" &&
    !!progress?.studentId;
  return (
    <main className="flex h-[calc(100dvh-4rem)] min-h-0 flex-col gap-4 p-4 lg:p-6">
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-3">
        <div>
          <Link
            className="text-sm text-muted-foreground underline"
            href="/sessions"
          >
            Sessions
          </Link>
          <h1 className="text-xl font-semibold">{round.name}</h1>
          <div className="mt-2 flex flex-wrap gap-2">
            <Badge variant="outline">Read only</Badge>
            <Badge variant="secondary">
              {round.mode === "exam" ? "Exam mode" : "Feedback mode"}
            </Badge>
            <Badge variant="outline">
              {round.delivery === "online" ? "Online" : "In person"}
            </Badge>
            <Badge variant="outline">
              {round.pausedAt ? "Paused · " : ""}
              {phase}
            </Badge>
            {seconds !== null && (
              <span
                role="timer"
                aria-label="Phase time remaining"
                className="font-mono text-sm tabular-nums"
              >
                {Math.floor(seconds / 60)}:
                {String(seconds % 60).padStart(2, "0")}
              </span>
            )}
            <span className="text-sm text-muted-foreground">
              Rotation {round.rotation + 1}/{round.stations.length}
            </span>
          </div>
        </div>
        <Button
          variant="outline"
          onClick={() =>
            openAnnouncementsModal(round.students.map((person) => person.id))
          }
        >
          Message students
        </Button>
      </header>
      {query.isError && (
        <p role="alert" className="text-sm text-destructive">
          Live updates are unavailable. Showing the last received state.
          Retrying…
        </p>
      )}
      {round.startedAt && (
        <div className="shrink-0">
          <InterviewStationStatusStrip
            round={round}
            selectedStationId={selectedStationId}
            onSelectStation={(id) => {
              setSelectedStationId((previous) => (previous === id ? null : id));
              setQuestionIndex(0);
            }}
          />
        </div>
      )}
      {station && round.startedAt ? (
        <>
          <div className="flex shrink-0 items-center justify-between gap-2">
            <h2 className="font-semibold">
              {station.name} · {student?.name ?? "No student"}
              {tutor ? ` · ${tutor.name}` : ""}
            </h2>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedStationId(null)}
            >
              Overview
            </Button>
          </div>
          <div className="grid min-h-0 flex-1 gap-5 overflow-auto lg:grid-cols-2 lg:overflow-hidden">
            {canObserve ? (
              <section className="min-h-0 overflow-auto rounded-xl border bg-card">
                <InterviewMedia
                  role="admin"
                  stationId={station.id}
                  roundId={round.id}
                  phase={round.phase}
                  delivery={round.delivery}
                  enabled={!round.pausedAt && !progress?.feedbackComplete && !(round.mode === 'exam' && progress?.endedEarly)}
                  className="w-full"
                />
                <p className="p-3 text-sm text-muted-foreground">
                  Watching this station. Your camera and microphone are off.
                </p>
              </section>
            ) : (
              <section className="min-h-0 space-y-4 overflow-auto rounded-xl border bg-card p-5">
                <h3 className="font-semibold">Station details</h3>
                <dl className="grid grid-cols-[auto_1fr] gap-3 text-sm">
                  <dt className="text-muted-foreground">Tutor</dt>
                  <dd>{tutor?.name ?? "Unassigned"}</dd>
                  <dt className="text-muted-foreground">Student</dt>
                  <dd>{student?.name ?? "No student"}</dd>
                  <dt className="text-muted-foreground">Mode</dt>
                  <dd>
                    {round.mode === "exam" ? "Exam mode" : "Feedback mode"}
                  </dd>
                  <dt className="text-muted-foreground">Status</dt>
                  <dd>{phase}</dd>
                </dl>
                <p className="text-sm text-muted-foreground">
                  {round.delivery === "in_person"
                    ? "This station is taking place in person."
                    : round.phase === "completed"
                      ? "This interview is complete."
                      : "There is no student at this station."}
                </p>
              </section>
            )}
            <section className="min-h-0 space-y-5 overflow-auto rounded-xl border bg-card p-5">
              <section>
                <h3 className="mb-2 font-semibold">Reading prompt</h3>
                <Document value={station.prompt} />
              </section>
              <div
                className="flex flex-wrap gap-2"
                aria-label="Station questions"
              >
                {station.questions.map((item, index) => (
                  <Button
                    key={item.id}
                    variant={question?.id === item.id ? "default" : "outline"}
                    size="sm"
                    onClick={() => setQuestionIndex(index)}
                  >
                    Question {index + 1}
                  </Button>
                ))}
              </div>
              {question && (
                <>
                  <section>
                    <h3 className="mb-2 font-semibold">
                      Question {station.questions.indexOf(question) + 1}
                    </h3>
                    <Document value={question.question} />
                  </section>
                  <section>
                    <h3 className="mb-2 font-semibold">Marking guidance</h3>
                    <Document value={question.rubric} />
                  </section>
                  <section>
                    <h3 className="mb-2 font-semibold">
                      Live question feedback
                    </h3>
                    <Document
                      value={
                        attempt?.feedback.find(
                          (item) => item.placementId === question.id,
                        )?.value
                      }
                    />
                  </section>
                </>
              )}
              <section>
                <h3 className="mb-2 font-semibold">General station feedback</h3>
                <Document value={attempt?.generalFeedback} />
              </section>
              <p className="border-t pt-4 text-sm">
                {attempt?.notAssessedReason
                  ? `Not assessed: ${attempt.notAssessedReason}`
                  : `Score: ${attempt?.score ?? "Not scored"} / ${station.maximumPoints}`}
              </p>
            </section>
          </div>
        </>
      ) : (
        <div className="min-h-0 flex-1 overflow-auto">
          <div className="mx-auto max-w-5xl">
            <InterviewRoundOverview
              round={round}
              tutorJoinUrl={`${portalOrigin("TUTOR")}/interviews/rounds/${round.id}/waiting`}
              studentJoinUrl={`${portalOrigin("STUDENT")}/interviews/rounds/${round.id}`}
            />
            {round.startedAt && (
              <p className="mt-4 text-sm text-muted-foreground">
                Select a station above to view its live feedback
                {round.delivery === "online" ? " and video" : ""}.
              </p>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
