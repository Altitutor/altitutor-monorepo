"use client";

import { reportInterviewCallFailure } from "@/lib/sentry/interview-call-reporting";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Input,
  InterviewMedia,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
  type JSONContent,
} from "@altitutor/ui";
import { randomUuid } from "@altitutor/ui/lib/random-uuid";
import {
  Check,
  Circle,
  GraduationCap,
  Lock,
  Maximize2,
  Minimize2,
  Users,
  Wifi,
  WifiOff,
  X,
} from "lucide-react";
import {
  interviewText,
  type InterviewStationAttempt,
  type InterviewCommand,
  type InterviewRound,
  type InterviewSnapshotStation,
} from "@altitutor/shared";
import {
  useInterviewCatalog,
  useInterviewCommand,
  useInterviewRound,
} from "../hooks/use-interviews";
import { AttemptEditor, StationMaterials } from "./InterviewStationAssessment";
import { useInterviewLeaveGuard } from "../hooks/use-interview-leave-guard";
import { InterviewMissedStations } from "./InterviewMissedStations";
import {
  ConfirmAction,
  InterviewDocument,
  InterviewError,
  InterviewPanel,
  InterviewSelect,
} from "./interview-ui";
import { InterviewRoundDialog } from "./InterviewRoundSetup";
import { tutorBtnOutline } from "@/shared/lib/tutor-visual";
import { cn } from "@/shared/utils";

function timerText(milliseconds: number) {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

function usePhaseClock(round: InterviewRound) {
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
  const countingDown = Boolean(round.phaseDeadline);
  const milliseconds = round.phaseDeadline
    ? round.pausedAt
      ? (round.remainingMilliseconds ?? 0)
      : Date.parse(round.phaseDeadline) - serverNow
    : (round.pausedAt ? Date.parse(round.pausedAt) : serverNow) -
      Date.parse(round.phaseStartedAt);
  return { milliseconds, countingDown };
}

function FullscreenButton() {
  const [active, setActive] = useState(false);
  useEffect(() => {
    const sync = () => setActive(document.fullscreenElement !== null);
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);
  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      className={tutorBtnOutline}
      aria-label={active ? "Exit fullscreen" : "Full screen"}
      onClick={() => {
        if (document.fullscreenElement) void document.exitFullscreen();
        else
          void document.documentElement
            .requestFullscreen()
            .catch(() => undefined);
      }}
    >
      {active ? (
        <Minimize2 className="size-4" />
      ) : (
        <Maximize2 className="size-4" />
      )}
    </Button>
  );
}

function useBrowserOnline() {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const sync = () => setOnline(navigator.onLine);
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);
  return online;
}

function phaseAppearance(round: InterviewRound) {
  const blank = {
    stationId: "",
    tutorId: "",
    studentId: null,
    ready: false,
    endedEarly: false,
    feedbackComplete: round.phase === "completed",
  };
  if (!round.startedAt || round.phase === "waiting")
    return { label: "Waiting", pill: "bg-amber-400 text-amber-950" };
  if (round.phase === "completed")
    return { label: "Completed", pill: stationStatus(blank, "completed").pill };
  return stationStatus(blank, round.phase);
}

function questionProgress(
  round: InterviewRound,
  item: InterviewRound["progress"][number],
) {
  if (round.phase !== "questions" || item.endedEarly || item.feedbackComplete)
    return null;
  const station = round.stations.find(
    (station) => station.id === item.stationId,
  );
  if (!station?.questions.length) return null;
  const attempt = round.attempts.find(
    (attempt) =>
      attempt.stationId === item.stationId &&
      attempt.studentId === item.studentId,
  );
  const answered = station.questions.filter((question) =>
    interviewText(
      attempt?.feedback.find((feedback) => feedback.placementId === question.id)
        ?.value ?? null,
    ).trim(),
  ).length;
  return `${answered}/${station.questions.length}`;
}

function stationStatusFor(
  round: InterviewRound,
  item: InterviewRound["progress"][number],
) {
  const status = stationStatus(item, round.phase);
  const progress = questionProgress(round, item);
  return progress
    ? { ...status, label: `${status.label} · ${progress}` }
    : status;
}

function timerDetail(round: InterviewRound, clock: { countingDown: boolean }) {
  const phase =
    round.phase === "reading"
      ? "Reading"
      : round.phase === "questions"
        ? "Question"
        : round.phase === "feedback"
          ? "Feedback"
          : round.phase === "waiting"
            ? "Waiting"
            : "Completed";
  const totalSeconds = clock.countingDown
    ? round.phase === "reading"
      ? round.readingTimeSeconds
      : round.phase === "questions"
        ? round.questionTimeSeconds
        : null
    : null;
  return [
    round.pausedAt ? "Timer frozen" : null,
    `${phase} phase ${clock.countingDown ? "remaining" : "elapsed time"}`,
    totalSeconds == null ? null : `${timerText(totalSeconds * 1000)} total`,
  ]
    .filter((part) => part !== null)
    .join(" · ");
}

function sharedActionText(round: InterviewRound) {
  const action = round.sharedAction;
  if (!action?.actorId || action.type === "pause") return null;
  const name =
    round.tutors.find((tutor) => tutor.id === action.actorId)?.name ??
    "A tutor";
  if (action.type === "start") return `Interview started by ${name}`;
  if (action.type === "resume") return `Resumed by ${name}`;
  if (action.type === "startReading") return `Reading started by ${name}`;
  if (action.type === "skipReading") return `Question time started by ${name}`;
  if (action.type === "next")
    return round.phase === "completed"
      ? `Round completed by ${name}`
      : `Next rotation by ${name}`;
  return null;
}

function tutorHasJoined(
  round: InterviewRound,
  tutorId: string,
  actorId: string | undefined,
  selfStatus: "online" | "offline" | "reconnecting",
) {
  if (tutorId === actorId && selfStatus !== "offline") return true;
  return (round.connectedTutorIds ?? []).includes(tutorId);
}

function historyPhaseName(phase: string) {
  if (phase === "waiting") return "Waiting";
  if (phase === "reading") return "Reading";
  if (phase === "questions") return "Questions";
  if (phase === "feedback") return "Feedback";
  return phase;
}

function TimerBreakdown({
  round,
  description,
}: {
  round: InterviewRound;
  description: string;
}) {
  const history = round.phaseHistory ?? [];
  const rotations = [...new Set(history.map((item) => item.rotation))].sort(
    (left, right) => left - right,
  );
  return (
    <div className="w-56 space-y-2 text-left">
      <p>{description}</p>
      {rotations.map((rotation) => (
        <div key={rotation} className="border-t border-border pt-2">
          <p className="text-xs font-semibold">Rotation {rotation + 1}</p>
          <div className="mt-1 space-y-0.5">
            {history
              .filter((item) => item.rotation === rotation)
              .map((item, index) => (
                <div
                  key={`${item.phase}-${index}`}
                  className="flex justify-between gap-4"
                >
                  <span>{historyPhaseName(item.phase)}</span>
                  <span className="font-mono tabular-nums">
                    {timerText(item.milliseconds)}
                  </span>
                </div>
              ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function ActionButton({
  reason,
  disabled,
  children,
  ...props
}: React.ComponentProps<typeof Button> & { reason?: string }) {
  const button = (
    <Button {...props} disabled={disabled}>
      {children}
    </Button>
  );
  if (!disabled || !reason) return button;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex">{button}</span>
      </TooltipTrigger>
      <TooltipContent>{reason}</TooltipContent>
    </Tooltip>
  );
}

function CircuitMark({ status }: { status: "done" | "current" | "remaining" }) {
  const Icon = status === "done" ? Check : status === "current" ? Circle : X;
  const label =
    status === "done" ? "Done" : status === "current" ? "Here now" : "Not yet";
  return (
    <span className="inline-flex shrink-0" aria-label={label}>
      <Icon className="size-3.5" />
    </span>
  );
}

function StudentCircuit({
  round,
  studentId,
  children,
}: {
  round: InterviewRound;
  studentId: string;
  children: React.ReactElement;
}) {
  const currentId = round.progress.find(
    (item) => item.studentId === studentId,
  )?.stationId;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent
        side="bottom"
        align="start"
        className="w-52 p-3 text-left"
      >
        <ul className="space-y-1">
          {round.stations.map((station, index) => {
            const done = round.attempts.some(
              (attempt) =>
                attempt.studentId === studentId &&
                attempt.stationId === station.id &&
                attempt.completed,
            );
            const status = done
              ? "done"
              : station.id === currentId
                ? "current"
                : "remaining";
            return (
              <li
                key={station.id}
                className="flex items-center justify-between gap-3"
              >
                <span>Station {index + 1}</span>
                <CircuitMark status={status} />
              </li>
            );
          })}
        </ul>
      </TooltipContent>
    </Tooltip>
  );
}

function TutorCircuit({
  round,
  stationId,
  children,
}: {
  round: InterviewRound;
  stationId: string;
  children: React.ReactElement;
}) {
  const currentId =
    round.progress.find((item) => item.stationId === stationId)?.studentId ??
    null;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent
        side="bottom"
        align="start"
        className="w-56 p-3 text-left"
      >
        <ul className="space-y-1">
          {round.students.map((student) => {
            const done = round.attempts.some(
              (attempt) =>
                attempt.stationId === stationId &&
                attempt.studentId === student.id &&
                attempt.completed,
            );
            const status = done
              ? "done"
              : student.id === currentId
                ? "current"
                : "remaining";
            return (
              <li
                key={student.id}
                className="flex items-center justify-between gap-3"
              >
                <span className="min-w-0 truncate">{student.name}</span>
                <CircuitMark status={status} />
              </li>
            );
          })}
        </ul>
      </TooltipContent>
    </Tooltip>
  );
}

function stationStatus(
  item: InterviewRound["progress"][number],
  phase: InterviewRound["phase"],
) {
  if (item.feedbackComplete)
    return {
      label: "Finished",
      tone: "text-sky-800 dark:text-sky-200",
      card: "border-sky-500/40 bg-sky-500/10",
      pill: "bg-sky-500 text-white",
    };
  if (item.endedEarly || phase === "feedback")
    return {
      label: "Feedback",
      tone: "text-purple-800 dark:text-purple-200",
      card: "border-purple-500/40 bg-purple-500/10",
      pill: "bg-purple-600 text-white",
    };
  if (phase === "questions")
    return {
      label: "Question time",
      tone: "text-blue-800 dark:text-blue-200",
      card: "border-blue-500/40 bg-blue-500/10",
      pill: "bg-blue-600 text-white",
    };
  if (phase === "reading")
    return {
      label: "Reading time",
      tone: "text-yellow-950 dark:text-yellow-100",
      card: "border-yellow-500/60 bg-yellow-400/25",
      pill: "bg-yellow-400 text-yellow-950",
    };
  if (item.ready)
    return {
      label: "Ready",
      tone: "text-emerald-800 dark:text-emerald-200",
      card: "border-emerald-500/50 bg-emerald-500/10",
      pill: "bg-emerald-500 text-emerald-950",
    };
  return {
    label: "Not ready",
    tone: "text-red-800 dark:text-red-200",
    card: "border-red-500/50 bg-red-500/10",
    pill: "bg-red-600 text-white",
  };
}

function CountMenu({
  label,
  singular,
  count,
  icon: Icon,
  people,
  paused,
}: {
  label: string;
  singular: string;
  count: number;
  icon: typeof Users;
  people: { id: string; name: string; status: string; tone?: string }[];
  paused: boolean;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2 py-1 text-sm font-medium tabular-nums",
            paused ? "hover:bg-amber-950/10" : "hover:bg-muted",
          )}
          aria-label={`${count} ${count === 1 ? singular : label.toLowerCase()}`}
        >
          <Icon className="h-4 w-4" />
          {count}
        </button>
      </TooltipTrigger>
      <TooltipContent
        side="bottom"
        align="start"
        className="w-72 p-3 text-left"
      >
        <p className="text-xs font-semibold text-muted-foreground">{label}</p>
        <ul className="mt-2 max-h-72 space-y-1.5 overflow-y-auto">
          {people.length ? (
            people.map((person) => (
              <li
                key={person.id}
                className="flex items-baseline justify-between gap-3 text-sm"
              >
                <span className="min-w-0 truncate">{person.name}</span>
                <span className={cn("shrink-0 text-xs", person.tone)}>
                  {person.status}
                </span>
              </li>
            ))
          ) : (
            <li className="text-sm text-muted-foreground">No one yet</li>
          )}
        </ul>
      </TooltipContent>
    </Tooltip>
  );
}

function SelfStatus({
  status,
  paused,
}: {
  status: "online" | "offline" | "reconnecting";
  paused: boolean;
}) {
  const label =
    status === "online"
      ? "Online"
      : status === "offline"
        ? "Offline"
        : "Reconnecting";
  const Icon = status === "offline" ? WifiOff : Wifi;
  const tone = paused
    ? status === "online"
      ? "text-emerald-950"
      : "text-red-950"
    : status === "online"
      ? "text-emerald-600 dark:text-emerald-400"
      : status === "offline"
        ? "text-red-600 dark:text-red-400"
        : "text-amber-700 dark:text-amber-300";
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          tabIndex={0}
          className={cn(
            "inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2 py-1 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring",
            tone,
          )}
          aria-label={`You are ${label.toLowerCase()}`}
        >
          <Icon
            className={cn("h-4 w-4", status !== "online" && "animate-pulse")}
          />
          <span>{label}</span>
        </span>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        {status === "online"
          ? "You are online"
          : status === "offline"
            ? "You are offline"
            : "Connection interrupted. Reconnecting."}
      </TooltipContent>
    </Tooltip>
  );
}

function StudentLock() {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          tabIndex={0}
          aria-label="Student locked"
          className="inline-flex shrink-0 text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Lock className="size-4" />
        </span>
      </TooltipTrigger>
      <TooltipContent>
        This student is locked in. You cannot change them after you are ready,
        or once the station has started.
      </TooltipContent>
    </Tooltip>
  );
}

function StationFacts({
  round,
  item,
  detailed = false,
  studentControl,
}: {
  round: InterviewRound;
  item: InterviewRound["progress"][number];
  detailed?: boolean;
  studentControl?: React.ReactNode;
}) {
  const station = round.stations.find((entry) => entry.id === item.stationId);
  const tutorName =
    round.tutors.find((tutor) => tutor.id === item.tutorId)?.name ??
    "Unassigned";
  const studentName =
    round.students.find((student) => student.id === item.studentId)?.name ??
    "No student selected";
  const locked =
    Boolean(item.studentId) && (item.ready || round.phase !== "waiting");
  const phase = detailed
    ? stationStatusFor(round, item)
    : stationStatus(item, round.phase);
  return (
    <div
      className={cn(
        "grid items-center",
        detailed
          ? "grid-cols-[3.25rem_minmax(0,1fr)] gap-y-1 text-xs"
          : "grid-cols-[5.5rem_minmax(0,1fr)] gap-y-2 text-sm",
      )}
    >
      <div className="text-muted-foreground">Tutor</div>
      <div className="min-w-0">
        {station ? (
          <TutorCircuit round={round} stationId={station.id}>
            <button
              type="button"
              className="max-w-full truncate text-left font-medium hover:underline"
            >
              {tutorName}
            </button>
          </TutorCircuit>
        ) : (
          tutorName
        )}
      </div>
      <div className="text-muted-foreground">Student</div>
      <div className="flex min-w-0 items-center gap-1.5">
        <div className="min-w-0 flex-1">
          {studentControl ??
            (item.studentId ? (
              <StudentCircuit round={round} studentId={item.studentId}>
                <button
                  type="button"
                  className="max-w-full truncate text-left font-medium hover:underline"
                >
                  {studentName}
                </button>
              </StudentCircuit>
            ) : (
              <span className="truncate text-muted-foreground">
                {studentName}
              </span>
            ))}
        </div>
        {locked && <StudentLock />}
      </div>
      <div className="text-muted-foreground">Phase</div>
      <div>
        <span
          className={cn(
            "inline-block rounded-full px-2 py-0.5 text-xs font-semibold",
            phase.pill,
          )}
        >
          {phase.label}
        </span>
      </div>
    </div>
  );
}

function StationStrip({
  round,
  actorId,
}: {
  round: InterviewRound;
  actorId: string | undefined;
}) {
  return (
    <div className="flex gap-2 overflow-x-auto p-1" aria-label="Stations">
      {round.progress.map((item, index) => {
        const status = stationStatusFor(round, item);
        const you = item.tutorId === actorId;
        const station = round.stations.find(
          (entry) => entry.id === item.stationId,
        );
        const title = `Station ${index + 1} · ${station?.name ?? "Station"}`;
        return (
          <div
            key={item.stationId}
            className={cn(
              "w-64 shrink-0 rounded-xl border p-2.5 md:w-auto md:min-w-56 md:flex-1",
              status.card,
              you && "ring-2 ring-primary",
            )}
          >
            <div className="mb-2 flex min-w-0 items-center gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <p className="min-w-0 truncate font-medium">{title}</p>
                </TooltipTrigger>
                <TooltipContent>{title}</TooltipContent>
              </Tooltip>
              {you && (
                <span className="shrink-0 text-xs font-medium">· You</span>
              )}
            </div>
            <StationFacts round={round} item={item} detailed />
          </div>
        );
      })}
    </div>
  );
}

function studentJoinOrigin() {
  const configured = process.env.NEXT_PUBLIC_STUDENT_URL?.replace(/\/$/, "");
  if (configured) return configured;
  return process.env.NODE_ENV === "production"
    ? "https://student.altitutor.com"
    : "http://localhost:3001";
}

function CopyJoinLink({ label, href }: { label: string; href: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    if (!href) return;
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(href);
      else {
        const field = document.createElement("textarea");
        field.value = href;
        document.body.appendChild(field);
        field.select();
        document.execCommand("copy");
        field.remove();
      }
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{label}</p>
      <div className="flex gap-2">
        <Input
          readOnly
          value={href}
          aria-label={label}
          onFocus={(event) => event.currentTarget.select()}
        />
        <Button
          type="button"
          variant="outline"
          className={tutorBtnOutline}
          disabled={!href}
          onClick={() => void copy()}
        >
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
    </div>
  );
}

function WaitingRoom({
  round,
  actorId,
  selfStatus,
  pending,
  onStart,
  onEdit,
}: {
  round: InterviewRound;
  actorId: string | undefined;
  selfStatus: "online" | "offline" | "reconnecting";
  pending: boolean;
  onStart: () => void;
  onEdit: () => void;
}) {
  const [confirm, setConfirm] = useState(false);
  const [tutorOrigin, setTutorOrigin] = useState("");
  useEffect(() => {
    setTutorOrigin(window.location.origin);
  }, []);
  const allTutorsJoined = round.tutors.every((tutor) =>
    tutorHasJoined(round, tutor.id, actorId, selfStatus),
  );
  return (
    <div className="mx-auto w-full max-w-5xl space-y-5">
      {round.delivery === "online" ? (
        <InterviewMedia
          onCallFailure={reportInterviewCallFailure}
          className="mx-auto max-w-4xl"
          role="tutor"
          roundId={round.id}
          phase={round.phase}
          delivery={round.delivery}
          enabled={!round.pausedAt && selfStatus !== "offline"}
        />
      ) : null}
      <div className="grid items-start gap-5 md:grid-cols-2">
        <InterviewPanel title="Tutors">
          <ul className="space-y-2">
            {round.tutors.map((tutor) => {
              const joined = tutorHasJoined(
                round,
                tutor.id,
                actorId,
                selfStatus,
              );
              return (
                <li
                  key={tutor.id}
                  className="flex items-center justify-between gap-3 rounded-lg bg-muted/40 px-3 py-2 text-sm"
                >
                  <span>
                    {tutor.name}
                    {tutor.id === actorId ? " · You" : ""}
                  </span>
                  {joined ? (
                    <Badge variant="success">Joined</Badge>
                  ) : (
                    <span className="text-muted-foreground">Not joined</span>
                  )}
                </li>
              );
            })}
          </ul>
        </InterviewPanel>
        <InterviewPanel title="Students">
          <ul className="space-y-2">
            {round.students.map((student) => {
              const joined =
                round.delivery === "online" &&
                round.connectedStudentIds.includes(student.id);
              return (
                <li
                  key={student.id}
                  className="flex items-center justify-between gap-3 rounded-lg bg-muted/40 px-3 py-2 text-sm"
                >
                  <span>{student.name}</span>
                  {round.delivery === "online" ? (
                    joined ? (
                      <Badge variant="success">Joined</Badge>
                    ) : (
                      <span className="text-muted-foreground">Not joined</span>
                    )
                  ) : (
                    <span className="text-muted-foreground">In person</span>
                  )}
                </li>
              );
            })}
          </ul>
        </InterviewPanel>
      </div>
      <InterviewPanel title="Join links">
        <p className="mb-4 text-sm text-muted-foreground">
          Send a link to someone on this round. They sign in first, then land
          in the waiting room. Anyone who is not added to the round cannot
          enter.
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          <CopyJoinLink
            label="Tutor link"
            href={
              tutorOrigin
                ? `${tutorOrigin}/interviews/rounds/${round.id}/waiting`
                : ""
            }
          />
          <CopyJoinLink
            label="Student link"
            href={`${studentJoinOrigin()}/interviews/rounds/${encodeURIComponent(round.id)}`}
          />
        </div>
      </InterviewPanel>
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="outline" className={tutorBtnOutline} onClick={onEdit}>
          Edit round
        </Button>
        <ActionButton
          reason={
            pending
              ? "Wait for the current action to finish."
              : allTutorsJoined
                ? undefined
                : "Wait until every tutor has joined."
          }
          disabled={pending || !allTutorsJoined}
          onClick={() => setConfirm(true)}
        >
          Start round
        </ActionButton>
      </div>
      <ConfirmAction
        open={confirm}
        title="Start the round?"
        description="The setup is locked after this. Everyone stays in the waiting room until a tutor starts reading."
        confirmLabel="Start round"
        onOpenChange={setConfirm}
        onConfirm={() => {
          setConfirm(false);
          onStart();
        }}
      />
    </div>
  );
}

function InPersonRoundView({
  round,
  actorId,
  selfStatus,
  progress,
  station,
  attempt,
  isWaiting,
  allReady,
  allFinished,
  pending,
  registerFlush,
  registerFinish,
  registerFinalizeAudio,
  error,
  connectionInterrupted,
  onRetry,
  onPause,
  onExit,
  onStart,
  onReady,
  onStartReading,
  onSkipReading,
  onEndStation,
  onFinishFeedback,
  onRequestFinish,
  onEdit,
  onNext,
  onSelectStudent,
}: {
  round: InterviewRound;
  actorId: string | undefined;
  selfStatus: "online" | "offline" | "reconnecting";
  progress: InterviewRound["progress"][number] | undefined;
  station: InterviewSnapshotStation | undefined;
  attempt: InterviewStationAttempt | undefined;
  isWaiting: boolean;
  allReady: boolean;
  allFinished: boolean;
  pending: boolean;
  registerFlush: (flush: (() => Promise<void>) | null) => void;
  registerFinish: (finish: (() => void) | null) => void;
  registerFinalizeAudio: (finalize: (() => Promise<void>) | null) => void;
  error: unknown;
  connectionInterrupted: boolean;
  onRetry: () => void;
  onPause: () => void;
  onExit: () => void;
  onStart: () => void;
  onReady: () => void;
  onStartReading: () => void;
  onSkipReading: () => void;
  onEndStation: () => void;
  onFinishFeedback: () => void;
  onRequestFinish: () => void;
  onEdit: () => void;
  onNext: () => void;
  onSelectStudent: (studentId: string | null) => void;
}) {
  const clock = usePhaseClock(round);
  const paused = Boolean(round.pausedAt);
  const [confirm, setConfirm] = useState<null | "end" | "skip">(null);
  const actionText = sharedActionText(round);
  const phase = phaseAppearance(round);
  const detail = timerDetail(round, clock);
  const studentLocked = Boolean(progress?.ready) || round.phase !== "waiting";
  const online = round.delivery === "online";
  const canSelectStudent = !online && !!station && !studentLocked;
  const circuitComplete = round.attempts.every(
    (item) => item.completed || !!item.notAssessedReason?.trim(),
  );
  const pendingReason = pending
    ? "Wait for the current action to finish."
    : undefined;
  const assignedReason = progress
    ? undefined
    : "You are not assigned to a station.";
  const readyReason =
    assignedReason ??
    (!round.startedAt
      ? "Start the round before marking ready."
      : pendingReason);
  const readingReason =
    assignedReason ??
    (!round.startedAt
      ? "Start the round before reading can start."
      : (pendingReason ??
        (!allReady
          ? "Every station must be ready before reading can start."
          : !round.progress.some((item) => item.studentId)
            ? "At least one station needs a student."
            : undefined)));
  const nextReason =
    assignedReason ??
    pendingReason ??
    (allFinished ? undefined : "Waiting for every tutor to finish feedback.");
  const pausedBy = round.tutors.find(
    (tutor) => tutor.id === round.pausedBy,
  )?.name;
  const connectedTutors = new Set(round.connectedTutorIds ?? []);
  const staff = round.progress.map((item, index) => {
    const status = stationStatusFor(round, item);
    const connection =
      item.tutorId === actorId
        ? selfStatus === "online"
          ? "Connected"
          : selfStatus === "offline"
            ? "Offline"
            : "Reconnecting"
        : connectedTutors.has(item.tutorId)
          ? "Connected"
          : "Offline";
    return {
      id: `${item.tutorId}-${item.stationId}`,
      name:
        round.tutors.find((tutor) => tutor.id === item.tutorId)?.name ??
        "Staff",
      status: `Station ${index + 1} · ${status.label} · ${connection}`,
      tone:
        connection === "Connected"
          ? "text-emerald-700 dark:text-emerald-300"
          : connection === "Reconnecting"
            ? "text-amber-700 dark:text-amber-300"
            : "text-red-700 dark:text-red-300",
    };
  });
  const students = round.students.map((student) => {
    const index = round.progress.findIndex(
      (item) => item.studentId === student.id,
    );
    const connected = round.connectedStudentIds.includes(student.id);
    return {
      id: student.id,
      name: student.name,
      status: `${index >= 0 ? `Station ${index + 1}` : "Not at a station"} · ${
        connected ? "Connected" : "Offline"
      }`,
      tone: connected
        ? "text-emerald-700 dark:text-emerald-300"
        : "text-red-700 dark:text-red-300",
    };
  });
  return (
    <TooltipProvider delayDuration={150}>
      <div
        className={cn(
          "min-h-dvh",
          paused ? "bg-amber-50 dark:bg-amber-950/30" : "bg-background",
        )}
      >
        <header
          className={cn(
            "sticky top-0 z-30 border-b",
            paused
              ? "border-amber-700 bg-amber-400 text-amber-950"
              : "border-border bg-background/95 backdrop-blur",
          )}
        >
          <div className="grid items-center gap-3 px-4 py-3 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:px-5">
            <div className="flex min-w-0 items-center gap-1">
              <h1 className="min-w-0 truncate font-semibold">{round.name}</h1>
              <CountMenu
                label="Staff"
                singular="staff member"
                count={new Set(round.progress.map((item) => item.tutorId)).size}
                icon={Users}
                people={staff}
                paused={paused}
              />
              <CountMenu
                label="Students"
                singular="student"
                count={round.students.length}
                icon={GraduationCap}
                people={students}
                paused={paused}
              />
              <SelfStatus status={selfStatus} paused={paused} />
            </div>
            <div className="flex flex-col items-center gap-1 text-center">
              {paused && (
                <div>
                  <p className="text-xl font-black uppercase tracking-[0.22em]">
                    Paused
                  </p>
                  {pausedBy && (
                    <p className="text-xs font-semibold normal-case tracking-normal">
                      by {pausedBy}
                    </p>
                  )}
                </div>
              )}
              <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
                <p
                  className={cn(
                    "rounded-full px-2.5 py-1 text-xs font-semibold",
                    phase.pill,
                    paused && "ring-1 ring-amber-950/40",
                  )}
                >
                  {phase.label}
                </p>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <p
                      role="timer"
                      tabIndex={0}
                      aria-label={`${paused ? "Paused, " : ""}${phase.label}, rotation ${round.rotation + 1} of ${round.stations.length}, ${timerText(clock.milliseconds)}. ${detail}`}
                      className={cn(
                        "font-mono tabular-nums leading-none outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        paused ? "text-4xl font-bold" : "text-2xl",
                      )}
                    >
                      {timerText(clock.milliseconds)}
                    </p>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-none">
                    <TimerBreakdown round={round} description={detail} />
                  </TooltipContent>
                </Tooltip>
                <p className="text-xs font-medium">
                  Rotation {round.rotation + 1}/{round.stations.length}
                </p>
              </div>
              {actionText && (
                <p className="text-xs font-medium">{actionText}</p>
              )}
            </div>
            <div className="flex items-center justify-end gap-2">
              <FullscreenButton />
              {!online &&
                round.startedAt &&
                round.phase !== "completed" &&
                station && (
                  <InterviewMissedStations
                    round={round}
                    stationId={station.id}
                  />
                )}
              {round.startedAt && round.phase !== "completed" && (
                <Button
                  variant={paused ? "default" : "outline"}
                  className={
                    paused
                      ? "bg-amber-950 text-amber-50 hover:bg-amber-900"
                      : tutorBtnOutline
                  }
                  disabled={!progress || pending}
                  onClick={onPause}
                >
                  {paused ? "Resume everyone" : "Pause everyone"}
                </Button>
              )}
              <Button variant="destructive" onClick={onExit}>
                Exit
              </Button>
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-[1600px] space-y-5 p-4 md:p-5">
          <InterviewError error={error} retry={onRetry} />
          {connectionInterrupted && (
            <p className="text-sm text-destructive">
              Connection interrupted. The circuit continues; retrying the
              current state.
            </p>
          )}
          {!round.startedAt ? (
            <WaitingRoom
              round={round}
              actorId={actorId}
              selfStatus={selfStatus}
              pending={pending}
              onStart={onStart}
              onEdit={onEdit}
            />
          ) : (
            <>
              <StationStrip round={round} actorId={actorId} />
              <div
                className={
                  online
                    ? "grid items-stretch gap-5 md:grid-cols-[minmax(0,1fr)_16rem]"
                    : "mx-auto w-full max-w-5xl"
                }
              >
                {online ? (
                  <InterviewMedia
          onCallFailure={reportInterviewCallFailure}
                    className="self-start"
                    role="tutor"
                    roundId={round.id}
                    phase={round.phase}
                    delivery={round.delivery}
                    enabled={
                      !round.pausedAt &&
                      !(round.mode === "exam" && !!progress?.endedEarly)
                    }
                  />
                ) : null}
                <InterviewPanel
                  title={station?.name ?? "Your station"}
                  className={online ? "h-full" : undefined}
                >
                  <div
                    className={
                      online
                        ? "flex h-full flex-col gap-2"
                        : "grid items-stretch gap-5 md:grid-cols-[minmax(0,1fr)_minmax(16rem,0.72fr)]"
                    }
                  >
                    <div
                      className={online ? "flex flex-col gap-2" : "space-y-4"}
                    >
                      {progress ? (
                        <StationFacts
                          round={round}
                          item={progress}
                          studentControl={
                            canSelectStudent && station ? (
                              progress.studentId ? (
                                <InterviewSelect
                                  label="Select arriving student"
                                  value={progress.studentId}
                                  clear
                                  options={round.students.map((student) => {
                                    const alreadyDone = round.attempts.some(
                                      (item) =>
                                        item.stationId === station.id &&
                                        item.studentId === student.id &&
                                        item.completed,
                                    );
                                    return {
                                      id: student.id,
                                      label: alreadyDone
                                        ? `${student.name} · already did this station`
                                        : student.name,
                                      disabled:
                                        alreadyDone ||
                                        round.progress.some(
                                          (item) =>
                                            item.studentId === student.id &&
                                            item.stationId !== station.id,
                                        ),
                                    };
                                  })}
                                  onChange={onSelectStudent}
                                />
                              ) : (
                                <InterviewSelect
                                  label="Select arriving student"
                                  value={null}
                                  clear
                                  options={round.students.map((student) => {
                                    const alreadyDone = round.attempts.some(
                                      (item) =>
                                        item.stationId === station.id &&
                                        item.studentId === student.id &&
                                        item.completed,
                                    );
                                    return {
                                      id: student.id,
                                      label: alreadyDone
                                        ? `${student.name} · already did this station`
                                        : student.name,
                                      disabled:
                                        alreadyDone ||
                                        round.progress.some(
                                          (item) =>
                                            item.studentId === student.id &&
                                            item.stationId !== station.id,
                                        ),
                                    };
                                  })}
                                  onChange={onSelectStudent}
                                />
                              )
                            ) : undefined
                          }
                        />
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          You are not assigned to a station.
                        </p>
                      )}
                      <div
                        className={
                          online
                            ? "flex flex-col gap-2 [&>button]:w-full [&>span]:w-full"
                            : "flex flex-wrap gap-2 empty:hidden"
                        }
                      >
                        {isWaiting && (
                          <ActionButton
                            variant="outline"
                            className={tutorBtnOutline}
                            reason={readyReason}
                            disabled={Boolean(readyReason)}
                            onClick={onReady}
                          >
                            {progress?.ready
                              ? "Mark not ready"
                              : !online && !progress?.studentId
                                ? "Ready — idle this rotation"
                                : "I’m ready"}
                          </ActionButton>
                        )}
                        {isWaiting && (
                          <ActionButton
                            reason={readingReason}
                            disabled={Boolean(readingReason)}
                            onClick={onStartReading}
                          >
                            Start reading
                          </ActionButton>
                        )}
                        {round.phase === "reading" && !paused && (
                          <ActionButton
                            variant="outline"
                            className={tutorBtnOutline}
                            reason={pendingReason}
                            disabled={pending}
                            onClick={() => setConfirm("skip")}
                          >
                            Skip reading time
                          </ActionButton>
                        )}
                        {round.phase === "questions" &&
                          progress &&
                          !progress.endedEarly && (
                            <ActionButton
                              variant="outline"
                              className={tutorBtnOutline}
                              reason={pendingReason}
                              disabled={pending}
                              onClick={() => setConfirm("end")}
                            >
                              End my station early
                            </ActionButton>
                          )}
                        {progress &&
                          (round.phase === "feedback" || progress.endedEarly) &&
                          !progress.feedbackComplete && (
                            <ActionButton
                              reason={pendingReason}
                              disabled={pending}
                              onClick={onRequestFinish}
                            >
                              Finish feedback
                            </ActionButton>
                          )}
                        {(round.phase === "feedback" ||
                          (!online &&
                            round.phase === "waiting" &&
                            circuitComplete)) && (
                          <ActionButton
                            reason={nextReason}
                            disabled={Boolean(nextReason)}
                            onClick={onNext}
                          >
                            {circuitComplete
                              ? "Complete round"
                              : "Next rotation"}
                          </ActionButton>
                        )}
                      </div>
                      {round.recordings
                        .filter(
                          (recording) =>
                            recording.attemptId === attempt?.id &&
                            recording.state === "failed",
                        )
                        .map((recording) => (
                          <p
                            role="alert"
                            className="text-sm text-amber-700 dark:text-amber-300"
                            key={recording.id}
                          >
                            Recording failed. Continue the interview; feedback
                            and marks can still be saved.
                          </p>
                        ))}
                    </div>
                    {!online ? (
                      <div className="relative h-full md:pl-5">
                        <div
                          aria-hidden
                          className="absolute inset-y-0 left-0 hidden w-px bg-border md:block"
                        />
                        <div className="border-t pt-4 md:border-t-0 md:pt-0">
                          <InterviewMedia
          onCallFailure={reportInterviewCallFailure}
                            registerFinalize={registerFinalizeAudio}
                            plain
                            role="tutor"
                            roundId={round.id}
                            phase={round.phase}
                            delivery={round.delivery}
                            enabled={
                              !round.pausedAt &&
                              !(round.mode === "exam" && !!progress?.endedEarly)
                            }
                          />
                        </div>
                      </div>
                    ) : null}
                  </div>
                </InterviewPanel>
              </div>
              <div className="grid items-start gap-5 md:grid-cols-2">
                {attempt && station ? (
                  <AttemptEditor
                    key={attempt.id}
                    round={round}
                    station={station}
                    attempt={attempt}
                    registerFlush={registerFlush}
                    registerFinish={registerFinish}
                    onFinishFeedback={onFinishFeedback}
                    leading={
                      <InterviewPanel title="Reading prompt">
                        <InterviewDocument
                          value={station.prompt as JSONContent}
                        />
                      </InterviewPanel>
                    }
                  />
                ) : station ? (
                  <StationMaterials station={station} />
                ) : (
                  <InterviewPanel title="Your station">
                    <p className="text-sm text-muted-foreground">
                      You are not assigned to a station.
                    </p>
                  </InterviewPanel>
                )}
              </div>
            </>
          )}
        </main>
      </div>
      <ConfirmAction
        open={confirm !== null}
        title={
          confirm === "skip" ? "Skip reading time?" : "End your station early?"
        }
        description={
          confirm === "skip"
            ? "Everyone will go straight to question time. You cannot go back to reading time."
            : "You cannot go back to question time."
        }
        confirmLabel={confirm === "skip" ? "Skip reading time" : "End station"}
        onOpenChange={(open) => {
          if (!open) setConfirm(null);
        }}
        onConfirm={() => {
          const action = confirm;
          setConfirm(null);
          if (action === "skip") onSkipReading();
          if (action === "end") onEndStation();
        }}
      />
    </TooltipProvider>
  );
}

export function InterviewWorkspace({ id }: { id: string }) {
  const query = useInterviewRound(id, true);
  const browserOnline = useBrowserOnline();
  const refetch = query.refetch;
  const catalog = useInterviewCatalog();
  const command = useInterviewCommand();
  const leaveGuard = useInterviewLeaveGuard();
  const [override, setOverride] = useState(false);
  const [claim, setClaim] = useState<string | null | undefined>(undefined);
  const [leaving, setLeaving] = useState(false);
  const [pendingAudio, setPendingAudio] = useState(0);
  const [recordingAudio, setRecordingAudio] = useState(false);
  const [endConfirm, setEndConfirm] = useState(false);
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
  const [editingRound, setEditingRound] = useState(false);
  const flush = useRef<(() => Promise<void>) | null>(null);
  const finalizeAudio = useRef<(() => Promise<void>) | null>(null);
  const registerFinalizeAudio = useCallback(
    (callback: (() => Promise<void>) | null) => {
      finalizeAudio.current = callback;
    },
    [],
  );
  const finishRequest = useRef<(() => void) | null>(null);
  const registerFlush = useRef((callback: (() => Promise<void>) | null) => {
    flush.current = callback;
  }).current;
  const registerFinish = useCallback((finish: (() => void) | null) => {
    finishRequest.current = finish;
  }, []);
  const currentLeaveGuard = useRef(leaveGuard);
  currentLeaveGuard.current = leaveGuard;
  const navigation = useRef<Promise<void> | null>(null);
  const exit = useCallback((href?: string) => {
    if (navigation.current) return navigation.current;
    setLeaving(true);
    setLocalError(null);
    const saving = (async () => {
      try {
        await flush.current?.();
        await finalizeAudio.current?.();
        if (href) currentLeaveGuard.current.leaveTo(href);
        else currentLeaveGuard.current.leave();
      } catch (error) {
        setLocalError(
          error instanceof Error
            ? error
            : new Error("Save your feedback and audio before leaving."),
        );
      } finally {
        navigation.current = null;
        setLeaving(false);
      }
    })();
    navigation.current = saving;
    return saving;
  }, []);
  useEffect(() => {
    if (query.data?.phase === "completed")
      void exit(`/interviews/rounds/${id}/results`);
  }, [id, query.data?.phase, exit]);
  useEffect(() => {
    if (query.data?.startedAt) setEditingRound(false);
  }, [query.data?.startedAt]);
  const round = query.data;
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
    commandId: randomUuid(),
  };
  const allReady = round.progress.every((item) => item.ready);
  const allFinished = round.progress.every(
    (item) =>
      item.feedbackComplete ||
      !item.studentId ||
      round.attempts.some(
        (attempt) =>
          attempt.stationId === item.stationId &&
          attempt.studentId === item.studentId &&
          !!attempt.notAssessedReason?.trim(),
      ),
  );
  const missingStudents = round.studentIds.filter(
    (studentId) => !round.connectedStudentIds.includes(studentId),
  );
  const isWaiting = !round.startedAt || round.phase === "waiting";
  const selfStatus = !browserOnline
    ? "offline"
    : query.heartbeatFailed
      ? "reconnecting"
      : "online";
  const requestFinish = () => {
    if (finishRequest.current) finishRequest.current();
    else void run({ ...base, type: "finishFeedback" });
  };
  return (
    <>
      {round.phase === "completed" && (
        <div
          className="flex flex-wrap items-center justify-between gap-3 border-b bg-muted p-4"
          role="status"
        >
          <p>
            This round is complete. Feedback and audio must finish saving before
            opening results.
          </p>
          <Button
            disabled={leaving}
            onClick={() => void exit(`/interviews/rounds/${id}/results`)}
          >
            {leaving ? "Saving feedback and audio…" : "Save and view results"}
          </Button>
        </div>
      )}
      <InPersonRoundView
        round={round}
        actorId={actorId}
        selfStatus={selfStatus}
        progress={progress}
        station={station}
        attempt={attempt}
        isWaiting={isWaiting}
        allReady={allReady}
        allFinished={allFinished}
        pending={command.isPending}
        registerFlush={registerFlush}
        registerFinish={registerFinish}
        registerFinalizeAudio={registerFinalizeAudio}
        error={localError ?? command.error ?? query.error}
        connectionInterrupted={query.isError}
        onRetry={() => void query.refetch()}
        onPause={() =>
          void run({
            ...base,
            type: round.pausedAt ? "resume" : "pause",
          })
        }
        onExit={leaveGuard.requestExit}
        onStart={() => void run({ ...base, type: "start" })}
        onReady={() =>
          void run({ ...base, type: "ready", ready: !progress?.ready })
        }
        onStartReading={() => {
          if (round.delivery === "online" && missingStudents.length)
            setOverride(true);
          else void run({ ...base, type: "startReading" });
        }}
        onSkipReading={() => void run({ ...base, type: "skipReading" })}
        onEndStation={() => void run({ ...base, type: "endStation" })}
        onFinishFeedback={() => void run({ ...base, type: "finishFeedback" })}
        onRequestFinish={requestFinish}
        onEdit={() => setEditingRound(true)}
        onNext={() => void run({ ...base, type: "next" })}
        onSelectStudent={(studentId) => {
          if (
            attempt &&
            (attempt.score !== null ||
              attempt.notAssessedReason !== null ||
              !!interviewText(attempt.generalFeedback ?? null).trim() ||
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
                ? "The current audio segment will finish and upload before leaving. "
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
              {leaving
                ? "Saving feedback and audio…"
                : "Save feedback and exit"}
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
      <ConfirmAction
        open={endConfirm}
        title="End your station early?"
        description="You cannot go back to question time."
        confirmLabel="End station"
        onOpenChange={setEndConfirm}
        onConfirm={() => {
          setEndConfirm(false);
          void run({ ...base, type: "endStation" });
        }}
      />
      {catalog.data && "interviews" in catalog.data && !round.startedAt && (
        <InterviewRoundDialog
          open={editingRound}
          onClose={() => setEditingRound(false)}
          catalog={catalog.data}
          existingRound={round}
        />
      )}
    </>
  );
}
