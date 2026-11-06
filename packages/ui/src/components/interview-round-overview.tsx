"use client";
import { useState, type ReactNode } from "react";
import {
  interviewText,
  type InterviewRound,
  type InterviewStationProgress,
} from "@altitutor/shared";
import { Button } from "./button";
import { Input } from "./input";
import { Badge } from "./badge";
import { cn } from "../lib/cn";

function InviteLink({ label, href }: { label: string; href: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      if (navigator.clipboard?.writeText)
        await navigator.clipboard.writeText(href);
      else {
        const field = document.createElement("textarea");
        field.value = href;
        document.body.appendChild(field);
        field.select();
        const copied = document.execCommand("copy");
        field.remove();
        if (!copied) return;
      }
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };
  return (
    <label className="block space-y-2 text-sm font-medium">
      {label}
      <div className="flex gap-2">
        <Input
          readOnly
          value={href}
          onFocus={(event) => event.currentTarget.select()}
          aria-label={label}
        />
        <Button variant="outline" onClick={() => void copy()}>
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
    </label>
  );
}

/** Shared waiting-room and live overview. Actions and media stay with each portal. */
export function InterviewRoundOverview({
  round,
  tutorJoinUrl,
  studentJoinUrl,
  children,
  actorId,
  joinedTutorIds = round.connectedTutorIds ?? [],
}: {
  round: InterviewRound;
  tutorJoinUrl: string;
  studentJoinUrl: string;
  children?: ReactNode;
  actorId?: string;
  joinedTutorIds?: string[];
}) {
  return (
    <div className="space-y-5">
      <div className="grid items-start gap-5 md:grid-cols-2">
        {(["tutors", "students"] as const).map((kind) => (
          <section key={kind} className="rounded-xl border bg-card p-5">
            <h2 className="mb-4 font-semibold">
              {kind === "tutors" ? "Tutors" : "Students"}
            </h2>
            <ul className="space-y-2">
              {round[kind].map((person) => {
                const joined = (
                  kind === "tutors" ? joinedTutorIds : round.connectedStudentIds
                ).includes(person.id);
                return (
                  <li
                    key={person.id}
                    className="flex items-center justify-between gap-3 rounded-lg bg-muted/40 px-3 py-2 text-sm"
                  >
                    <span>
                      {person.name}
                      {kind === "tutors" && person.id === actorId
                        ? " · You"
                        : ""}
                    </span>
                    {kind === "students" && round.delivery === "in_person" ? (
                      <span className="text-muted-foreground">In person</span>
                    ) : joined ? (
                      <Badge variant="success">Joined</Badge>
                    ) : (
                      <span className="text-muted-foreground">Not joined</span>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
      <section className="space-y-4 rounded-xl border bg-card p-5">
        <h2 className="font-semibold">Join links</h2>
        <p className="text-sm text-muted-foreground">
          Send a link to someone on this round. They sign in first, then land in
          the waiting room. Anyone who is not added to the round cannot enter.
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          <InviteLink label="Tutor link" href={tutorJoinUrl} />
          <InviteLink label="Student link" href={studentJoinUrl} />
        </div>
      </section>
      {children}
    </div>
  );
}

function status(round: InterviewRound, item: InterviewStationProgress) {
  if (round.phase === "completed") return "Completed";
  if (!round.startedAt) return "Not started";
  if (!item.studentId) return item.ready ? "Idle · Ready" : "Idle";
  if (item.feedbackComplete) return "Completed";
  if (round.pausedAt) return "Paused";
  if (item.endedEarly || round.phase === "feedback")
    return round.mode === "exam" ? "Marking" : "Feedback";
  if (round.phase === "waiting") return item.ready ? "Ready" : "Waiting";
  return round.phase === "reading" ? "Reading" : "Question time";
}

export function InterviewStationStatusStrip({
  round,
  actorId,
  selectedStationId,
  onSelectStation,
}: {
  round: InterviewRound;
  actorId?: string;
  selectedStationId?: string | null;
  onSelectStation?: (stationId: string) => void;
}) {
  return (
    <div className="flex gap-2 overflow-x-auto p-1" aria-label="Stations">
      {round.progress.map((item, index) => {
        const station = round.stations.find(
          (entry) => entry.id === item.stationId,
        );
        const tutor = round.tutors.find((entry) => entry.id === item.tutorId);
        const student = round.students.find(
          (entry) => entry.id === item.studentId,
        );
        const attempt = round.attempts.find(
          (entry) =>
            entry.stationId === item.stationId &&
            entry.studentId === item.studentId,
        );
        const answered =
          station?.questions.filter((question) =>
            attempt?.feedback.some(
              (feedback) =>
                feedback.placementId === question.id &&
                interviewText(feedback.value).trim(),
            ),
          ).length ?? 0;
        const content = (
          <>
            <p className="mb-2 truncate font-medium">
              Station {index + 1} · {station?.name ?? "Station"}
              {actorId === item.tutorId ? " · You" : ""}
            </p>
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
              <dt className="text-muted-foreground">Tutor</dt>
              <dd className="truncate">{tutor?.name ?? "Unassigned"}</dd>
              <dt className="text-muted-foreground">Student</dt>
              <dd className="truncate">{student?.name ?? "No student"}</dd>
              <dt className="text-muted-foreground">Status</dt>
              <dd>{status(round, item)}</dd>
              <dt className="text-muted-foreground">Questions</dt>
              <dd>
                {answered}/{station?.questions.length ?? 0}
              </dd>
            </dl>
          </>
        );
        const className = cn(
          "w-64 shrink-0 rounded-xl border bg-card p-3 text-left md:min-w-56 md:flex-1",
          (selectedStationId === item.stationId || actorId === item.tutorId) &&
            "ring-2 ring-primary",
        );
        return onSelectStation ? (
          <button
            key={item.stationId}
            type="button"
            className={className}
            aria-pressed={selectedStationId === item.stationId}
            onClick={() => onSelectStation(item.stationId)}
          >
            {content}
          </button>
        ) : (
          <div key={item.stationId} className={className}>
            {content}
          </div>
        );
      })}
    </div>
  );
}
