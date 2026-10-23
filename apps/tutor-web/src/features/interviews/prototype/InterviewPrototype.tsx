"use client";

// DEV-8 THROWAWAY: Three live tutor layouts at /interviews/prototype?variant=A|B|C.
// Question: how should watching, writing, and circuit coordination share the screen?
// All data and transitions below are simulated, in memory, and NOT a proposed backend.
import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
} from "@altitutor/ui";
import {
  ArrowRight,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Circle,
  ClipboardList,
  Clock3,
  LogOut,
  Pencil,
  Mic,
  MicOff,
  Pause,
  Play,
  RotateCcw,
  ShieldCheck,
  Video,
  VideoOff,
  Wifi,
  WifiOff,
} from "lucide-react";
import { PrototypeSwitcher } from "@/shared/components/prototype-switcher";
import { tutorBtnOutline, tutorSurfaceCard } from "@/shared/lib/tutor-visual";
import { cn, navActiveStyles } from "@/shared/utils";
import { usePrototypeLeaveGuard } from "./use-prototype-leave-guard";

const variants = [
  { key: "A", name: "Watch, then write" },
  { key: "B", name: "Marking desk" },
  { key: "C", name: "Circuit workspace" },
];
const phases = [
  "Waiting",
  "Reading",
  "Questions",
  "Feedback",
  "Finished",
] as const;
type Phase = (typeof phases)[number];
const questions = [
  {
    prompt:
      "You are a medical student on placement. A fellow student tells you they are struggling and have been missing clinical sessions. They ask you to keep the conversation between the two of you.",
    title: "How would you approach this conversation?",
    rubric:
      "Acknowledge the student’s feelings. Explore their perspective without assumptions. Explain confidentiality and its limits. Use open questions before proposing action.",
  },
  {
    title: "What if they ask you not to tell anyone?",
    rubric:
      "Explore risk and immediate safety. Explain why absolute confidentiality cannot be promised. Involve appropriate support and explain the next steps sensitively.",
  },
  {
    title: "Tell me about a time you supported someone.",
    rubric:
      "Give a specific example. Explain your own contribution, what you learned, and how you would adapt your approach next time.",
  },
];
const stations = [
  { name: "Ethical reasoning", tutor: "You", student: "Amelia Chen" },
  { name: "Motivation", tutor: "Daniel", student: "Noah Williams" },
  { name: "Communication", tutor: "Sophie", student: "Olivia Patel" },
  { name: "Rural medicine", tutor: "James", student: "Ethan Nguyen" },
  { name: "Teamwork", tutor: "Aisha", student: "Isabella Smith" },
  { name: "Problem solving", tutor: "Oliver", student: "Lucas Brown" },
];
// Reading/printing always uses the FIRST question's prompt, never a station field.
const prompt = questions[0].prompt;

function formatTime(seconds: number) {
  return `${Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;
}

function Pill({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "green" | "amber" | "blue";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium",
        tone === "green"
          ? "bg-emerald-50 text-emerald-700"
          : tone === "amber"
            ? "bg-amber-50 text-amber-800"
            : tone === "blue"
              ? "bg-sky-50 text-sky-700"
              : "bg-muted text-muted-foreground",
      )}
    >
      {children}
    </span>
  );
}

export function InterviewPrototype() {
  const params = useSearchParams();
  const variant = variants.some((item) => item.key === params.get("variant"))
    ? params.get("variant")
    : "C";
  const [phase, setPhaseState] = useState<Phase>("Questions");
  const [clock, setClock] = useState(() => ({
    epoch: Date.now(),
    carriedMs: 0,
  }));
  const [now, setNow] = useState(() => Date.now());
  const [toolbarOpen, setToolbarOpen] = useState(true);
  const [showPrototypeControls, setShowPrototypeControls] = useState(false);
  const leaveGuard = usePrototypeLeaveGuard();
  const [rubrics, setRubrics] = useState(questions.map((item) => item.rubric));
  const [editingRubric, setEditingRubric] = useState<number | null>(null);
  const [rubricDraft, setRubricDraft] = useState("");
  const [delivery, setDelivery] = useState("Online");
  const [inPersonClaims, setInPersonClaims] = useState<(string | null)[]>([
    null,
    "Noah Williams",
    "Olivia Patel",
    "Ethan Nguyen",
    "Isabella Smith",
    null,
  ]);
  const [pendingStudent, setPendingStudent] = useState<string | null>(null);
  const [claimMessage, setClaimMessage] = useState("");
  const [startOverride, setStartOverride] = useState(false);
  const [mode, setMode] = useState("Feedback");
  const [view, setView] = useState("Tutor");
  const [question, setQuestion] = useState(0);
  const [notes, setNotes] = useState([
    "Identifies the need to listen first. Good empathy; explore confidentiality more clearly.",
    "",
    "",
  ]);
  const [score, setScore] = useState("");
  const [rotation, setRotation] = useState(1);
  const [paused, setPaused] = useState(false);
  const [disconnected, setDisconnected] = useState(false);
  const [recordingFailed, setRecordingFailed] = useState(false);
  const [recordingEnabled, setRecordingEnabled] = useState(true);
  const [muted, setMuted] = useState(false);
  const [camera, setCamera] = useState(true);
  const [rubric, setRubric] = useState(false);
  const [othersDone, setOthersDone] = useState(false);
  const [ready, setReady] = useState(false);
  const student =
    delivery === "In person"
      ? (inPersonClaims[0] ?? "Choose arriving student")
      : stations[(rotation - 1) % stations.length].student;
  const setPhase = useCallback((next: Phase) => {
    const timestamp = Date.now();
    setPhaseState(next);
    setClock({ epoch: timestamp, carriedMs: 0 });
    setNow(timestamp);
  }, []);
  const elapsedMs = paused
    ? clock.carriedMs
    : clock.carriedMs + now - clock.epoch;
  const elapsedSeconds = Math.max(0, Math.floor(elapsedMs / 1000));
  const countingDown = phase === "Reading" || phase === "Questions";
  const seconds = countingDown
    ? Math.max(0, (phase === "Reading" ? 120 : 480) - elapsedSeconds)
    : elapsedSeconds;
  const togglePause = () => {
    const timestamp = Date.now();
    setClock({
      epoch: timestamp,
      carriedMs: paused
        ? clock.carriedMs
        : clock.carriedMs + timestamp - clock.epoch,
    });
    setNow(timestamp);
    setPaused(!paused);
  };
  useEffect(() => {
    if (paused) return;
    const interval = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(interval);
  }, [paused]);
  useEffect(() => {
    if (paused || seconds > 0) return;
    if (phase === "Reading") setPhase("Questions");
    else if (phase === "Questions") setPhase("Feedback");
  }, [paused, phase, seconds, setPhase]);

  const applyStudentClaim = (name: string) => {
    if (inPersonClaims.slice(1).includes(name)) {
      setClaimMessage(
        "That student is already at another station. Choose someone else.",
      );
      setPendingStudent(null);
      return;
    }
    setInPersonClaims((claims) =>
      claims.map((claim, index) => (index === 0 ? name : claim)),
    );
    setPendingStudent(null);
    setClaimMessage("");
  };
  const chooseStudent = (name: string) => {
    if (!name || name === inPersonClaims[0]) return;
    if (inPersonClaims.slice(1).includes(name)) {
      setClaimMessage("That student is already at another station.");
      return;
    }
    if (
      inPersonClaims[0] &&
      (notes.some((note) => note.trim()) || score !== "")
    )
      setPendingStudent(name);
    else applyStudentClaim(name);
  };
  const ownVisible =
    phase === "Questions" ||
    (mode === "Feedback" && (phase === "Reading" || phase === "Feedback"));
  const tutorReceives =
    phase === "Reading" ||
    phase === "Questions" ||
    (phase === "Feedback" && mode === "Feedback");
  const state = {
    variant,
    view,
    mode,
    phase,
    rotation,
    student,
    question: question + 1,
    score,
    notes,
    paused,
    disconnected,
    recordingFailed,
    recordingEnabled,
    muted,
    camera,
    ready,
    othersDone,
    delivery,
    inPersonClaims,
    answered: notes.map((note) => note.trim().length > 0),
    rubrics,
    phaseSeconds: seconds,
    storage: "in-memory only",
    timers: "local wall-clock simulation; no multi-client sync",
    media: "placeholder; not connected",
    controlPolicy: "any tutor explicitly advances; disconnect does not pause",
  };
  const actionLabel =
    phase === "Waiting"
      ? ready
        ? "Start reading · demo"
        : "I’m ready"
      : phase === "Reading"
        ? "Skip to questions · demo"
        : phase === "Questions"
          ? "End my station early"
          : phase === "Feedback"
            ? "Finish my feedback"
            : rotation === 6
              ? "Interview complete"
              : "Next rotation · demo";
  const advance = () => {
    if (phase === "Waiting" && !ready) {
      setReady(true);
      return;
    }
    if (phase === "Waiting" && delivery === "Online" && disconnected) {
      setStartOverride(true);
      return;
    }
    if (phase === "Finished" && rotation < 6) {
      setRotation(rotation + 1);
      setPhase("Waiting");
      setReady(false);
      setOthersDone(false);
      setQuestion(0);
      setNotes(["", "", ""]);
      setScore("");
      setInPersonClaims([null, null, null, null, null, null]);
      return;
    }
    setPhase(phases[Math.min(phases.indexOf(phase) + 1, phases.length - 1)]);
  };
  const reset = () => {
    setPhase("Questions");
    setRotation(1);
    setPaused(false);
    setDisconnected(false);
    setRecordingFailed(false);
    setOthersDone(false);
    setReady(false);
    setQuestion(0);
    setEditingRubric(null);
    setScore("");
    setNotes([
      "Identifies the need to listen first. Good empathy; explore confidentiality more clearly.",
      "",
      "",
    ]);
  };

  const controls = (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-muted/40 p-3">
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          aria-label={muted ? "Unmute demo microphone" : "Mute demo microphone"}
          onClick={() => setMuted(!muted)}
        >
          {muted ? <MicOff size={17} /> : <Mic size={17} />}
        </Button>
        {delivery === "Online" && (
          <Button
            variant="ghost"
            size="icon"
            aria-label={camera ? "Disable demo camera" : "Enable demo camera"}
            onClick={() => setCamera(!camera)}
          >
            {camera ? <Video size={17} /> : <VideoOff size={17} />}
          </Button>
        )}
        <span className="ml-1 text-xs text-muted-foreground">
          Your controls · simulated
        </span>
      </div>
      <Button
        disabled={
          paused || (phase === "Finished" && (!othersDone || rotation === 6))
        }
        onClick={advance}
        className="gap-2 rounded-xl"
      >
        {actionLabel}
        <ArrowRight size={15} />
      </Button>
    </div>
  );

  const video = (compact = false, studentView = false) =>
    delivery === "In person" ? (
      <section
        className={cn(
          tutorSurfaceCard,
          "flex min-h-64 flex-col items-center justify-center gap-4 p-6 text-center",
        )}
      >
        <Mic size={28} className="text-muted-foreground" />
        <div>
          <h2 className="text-lg font-medium">
            {inPersonClaims[0] ?? "Waiting for a student"}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            In-person interview · audio only
          </p>
        </div>
        <Pill tone={recordingFailed ? "amber" : "neutral"}>
          {!recordingEnabled
            ? "Recording off"
            : recordingFailed
              ? "Recording unavailable"
              : !inPersonClaims[0]
                ? "Choose a student to record"
                : phase === "Questions" ||
                    (phase === "Feedback" && mode === "Feedback")
                  ? "Audio recording · demo"
                  : "Recording starts with question time"}
        </Pill>
        <p className="text-xs text-muted-foreground">
          No microphone is accessed in this prototype.
        </p>
      </section>
    ) : (
      <div
        className={cn(
          "relative flex flex-col items-center justify-center overflow-hidden rounded-2xl bg-slate-900 text-white",
          compact ? "min-h-48" : "min-h-64 xl:min-h-80",
        )}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-slate-700/40 via-transparent to-sky-950/70" />
        <div className="absolute left-3 top-3 z-10 flex flex-wrap gap-1">
          <span className="rounded-md bg-black/25 px-2 py-1 text-[10px] tracking-widest">
            VIDEO PLACEHOLDER
          </span>
          {recordingEnabled &&
            (phase === "Questions" ||
              (phase === "Feedback" && mode === "Feedback")) && (
              <span
                className={cn(
                  "rounded-md px-2 py-1 text-[10px]",
                  recordingFailed
                    ? "bg-amber-100 text-amber-900"
                    : "bg-black/25",
                )}
              >
                <span className="mr-1 text-red-400">●</span>
                {recordingFailed ? "Recording unavailable" : "Recording · demo"}
              </span>
            )}
        </div>
        <div
          className={cn(
            "z-10 flex items-center justify-center rounded-full bg-slate-600/60 font-light",
            compact ? "h-12 w-12 text-lg" : "h-20 w-20 text-2xl",
          )}
        >
          {!tutorReceives && !studentView ? (
            <VideoOff size={24} />
          ) : disconnected ? (
            <WifiOff size={30} />
          ) : studentView ? (
            "JL"
          ) : (
            student
              .split(" ")
              .map((part) => part[0])
              .join("")
          )}
        </div>
        <p className={cn("z-10", compact ? "mt-2 text-sm" : "mt-4 text-lg")}>
          {!tutorReceives && !studentView
            ? "Media off for this phase"
            : disconnected
              ? "Reconnecting to student…"
              : studentView
                ? "Your interviewer"
                : student}
        </p>
        {!compact && (
          <p className="z-10 mt-1 px-5 text-center text-xs text-slate-400">
            {disconnected
              ? "The interview continues. Rejoin your current station when connected."
              : "No camera or microphone is accessed in this prototype."}
          </p>
        )}
        <div className="absolute bottom-4 left-4 text-xs text-slate-300">
          {compact || studentView
            ? "Station 1"
            : "Station 1 · Ethical reasoning"}
        </div>
        <div
          className={cn(
            "absolute bottom-3 right-3 flex items-center justify-center rounded-lg border border-white/10 bg-slate-700 text-xs",
            compact ? "h-8 w-12" : "h-14 w-20",
          )}
        >
          {camera ? "You" : <VideoOff size={18} />}
          {muted && <MicOff size={12} className="ml-2" />}
        </div>
      </div>
    );

  const circuit = (horizontal = false) => (
    <section className={cn(tutorSurfaceCard, "p-4")}>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold">The circuit</h2>
        <span className="text-xs text-muted-foreground">
          Rotation {rotation} / 6
        </span>
      </div>
      <div
        className={
          horizontal ? "grid grid-cols-2 gap-2 xl:grid-cols-6" : "space-y-1"
        }
      >
        {stations.map((station, index) => {
          const status =
            index === 0
              ? phase
              : othersDone
                ? "Finished"
                : index === 3 && disconnected
                  ? "Connection issue"
                  : "Questions";
          return (
            <div
              key={station.name}
              className={cn(
                "rounded-xl p-3",
                index === 0 ? navActiveStyles : "bg-muted/30",
              )}
            >
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-background text-[10px] font-semibold text-foreground">
                  {index + 1}
                </span>
                <span className="truncate text-xs font-semibold">
                  {horizontal ? station.tutor : station.name}
                </span>
              </div>
              <p className="mt-2 truncate text-xs">
                {delivery === "In person"
                  ? (inPersonClaims[index] ?? "No student selected")
                  : stations[(index + rotation - 1) % stations.length].student}
              </p>
              <div className="mt-1.5 flex items-center gap-1.5 text-[10px] text-muted-foreground">
                <Circle
                  size={6}
                  className={
                    status === "Finished"
                      ? "fill-emerald-500 text-emerald-500"
                      : status === "Connection issue"
                        ? "fill-amber-500 text-amber-500"
                        : "fill-sky-500 text-sky-500"
                  }
                />
                {status}
                {!horizontal && (
                  <span className="ml-auto">{station.tutor}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {!horizontal && (
        <div className="mt-4 border-t pt-3 text-xs text-muted-foreground">
          {phase === "Finished"
            ? othersDone
              ? "All stations finished. Ready to rotate."
              : "Your feedback is finished. Waiting for 5 stations."
            : "Tutors stay at their station. Students rotate."}
        </div>
      )}
    </section>
  );

  const marking = (single = false) => (
    <section className={cn(tutorSurfaceCard, "overflow-hidden")}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-5 py-4">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <ClipboardList size={16} />
          Questions & feedback
        </h2>
        <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
          <Check size={12} />
          Kept in this tab · demo
        </span>
      </div>
      {single && (
        <div className="flex gap-2 border-b px-5 py-3">
          {questions.map((item, index) => (
            <button
              key={item.title}
              onClick={() => setQuestion(index)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs",
                index === question ? navActiveStyles : "hover:bg-muted/60",
              )}
              aria-pressed={index === question}
            >
              Q{index + 1}
              {!notes[index].trim() && (
                <span className="ml-2 rounded-full border px-1.5 py-0.5 text-[9px] text-muted-foreground">
                  Unanswered
                </span>
              )}
            </button>
          ))}
        </div>
      )}
      <div className="space-y-5 p-5">
        {(single ? [questions[question]] : questions).map((item) => {
          const index = questions.indexOf(item);
          return (
            <div key={item.title} className="space-y-3">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 text-xs font-medium text-muted-foreground">
                  0{index + 1}
                </span>
                <h3 className="text-sm font-medium leading-relaxed">
                  {item.title}
                </h3>
                {!notes[index].trim() && <Pill>Unanswered</Pill>}
              </div>
              <textarea
                aria-label={`Feedback for question ${index + 1}`}
                value={notes[index]}
                onChange={(event) =>
                  setNotes(
                    notes.map((note, noteIndex) =>
                      noteIndex === index ? event.target.value : note,
                    ),
                  )
                }
                placeholder="What went well? What could improve?"
                className={cn(
                  "w-full resize-y rounded-xl border bg-muted/20 p-3 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-sky-400",
                  single ? "min-h-36" : "min-h-20",
                )}
              />
              {(rubric || single) && (
                <div className="rounded-xl bg-muted/40 p-4 text-xs leading-relaxed">
                  <div className="mb-2 flex items-center justify-between">
                    <strong>Rubric</strong>
                    {editingRubric !== index && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 gap-1 px-2 text-xs"
                        onClick={() => {
                          setEditingRubric(index);
                          setRubricDraft(rubrics[index]);
                        }}
                      >
                        <Pencil size={12} />
                        Edit
                        <span className="sr-only">
                          {" "}
                          rubric for question {index + 1}
                        </span>
                      </Button>
                    )}
                  </div>
                  {editingRubric === index ? (
                    <div className="space-y-3">
                      <textarea
                        aria-label={`Rubric for question ${index + 1}`}
                        className="min-h-28 w-full rounded-lg border bg-background p-3 text-sm"
                        value={rubricDraft}
                        onChange={(event) => setRubricDraft(event.target.value)}
                      />
                      <p className="text-muted-foreground">
                        Updates the shared rubric, including active rounds.
                        Simulated in this prototype.
                      </p>
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className={tutorBtnOutline}
                          onClick={() => setEditingRubric(null)}
                        >
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => {
                            setRubrics((values) =>
                              values.map((value, rubricIndex) =>
                                rubricIndex === index ? rubricDraft : value,
                              ),
                            );
                            setEditingRubric(null);
                          }}
                        >
                          Save rubric
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-muted-foreground">{rubrics[index]}</p>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {!single && (
          <button
            onClick={() => setRubric(!rubric)}
            className="flex items-center gap-1 text-xs font-medium text-sky-700"
          >
            {rubric ? "Hide" : "Show"} rubrics
            <ChevronDown size={13} />
          </button>
        )}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t bg-muted/20 px-5 py-4">
        <div>
          <div className="text-xs font-medium">Station score</div>
          <div className="mt-1 text-[10px] text-muted-foreground">
            Maximum configured per station · decimals allowed
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input
            aria-label="Station score"
            type="number"
            min={0}
            max={6}
            step="any"
            value={score}
            onChange={(event) => setScore(event.target.value)}
            placeholder="—"
            className="h-9 w-16 rounded-lg border bg-background px-2 text-center text-sm"
          />
          <span className="text-sm text-muted-foreground">/ 6</span>
        </div>
      </div>
      {single && (
        <div className="flex justify-between px-5 py-3">
          <Button
            size="sm"
            variant="outline"
            className={tutorBtnOutline}
            disabled={question === 0}
            onClick={() => setQuestion(question - 1)}
          >
            <ChevronLeft size={15} /> Previous
          </Button>
          <Button
            size="sm"
            variant="outline"
            className={tutorBtnOutline}
            disabled={question === 2}
            onClick={() => setQuestion(question + 1)}
          >
            Next question <ChevronRight size={15} />
          </Button>
        </div>
      )}
    </section>
  );

  const promptCard = (
    <details className={cn(tutorSurfaceCard, "px-5 py-4")}>
      <summary className="cursor-pointer text-xs font-medium">
        Reading prompt{" "}
        <span className="ml-2 text-muted-foreground">From question 1</span>
      </summary>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
        {prompt}
      </p>
    </details>
  );

  const studentPreview = (
    <div className="grid gap-5 xl:grid-cols-[1fr_220px]">
      <section className={cn(tutorSurfaceCard, "p-6")}>
        <Pill tone="blue">Student view · illustrative</Pill>
        <h2 className="mb-6 mt-4 text-xl font-semibold">Station 1</h2>
        {ownVisible ? (
          video(false, true)
        ) : (
          <div className="relative flex min-h-56 flex-col items-center justify-center rounded-2xl bg-muted/40 p-6 text-center">
            <Clock3 className="mb-4 text-sky-600" size={28} />
            <h3 className="text-lg font-medium">
              {phase === "Reading"
                ? "Your reading time"
                : phase === "Waiting"
                  ? "Your reading time will start soon"
                  : "Your station is complete"}
            </h3>
            <p className="mt-2 max-w-sm text-sm text-muted-foreground">
              {phase === "Reading"
                ? "Your tutor can see and hear you. You cannot see or hear them yet."
                : "Stay on this page. Your tutor will guide the next step."}
            </p>
            {phase === "Reading" && (
              <div className="absolute bottom-3 right-3 flex h-12 w-16 items-center justify-center rounded-lg bg-slate-700 text-xs text-white">
                You
              </div>
            )}
          </div>
        )}
        {(phase === "Reading" ||
          phase === "Questions" ||
          (phase === "Feedback" && mode === "Feedback")) && (
          <div className="mt-6">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Your prompt
            </h3>
            <p className="text-base leading-relaxed">{prompt}</p>
          </div>
        )}
        <div className="mt-5 text-xs text-muted-foreground">
          Prototype · real media is not connected.
        </div>
      </section>
      <section className={cn(tutorSurfaceCard, "h-fit p-5")}>
        <h2 className="mb-5 text-sm font-semibold">Your progress</h2>
        {stations.map((station, index) => (
          <div key={station.name} className="mb-5 flex items-center gap-3">
            <span
              className={cn(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs",
                index === 0
                  ? navActiveStyles
                  : "bg-muted/30 text-muted-foreground",
              )}
            >
              {index + 1}
            </span>
            <div className="text-xs">
              Station {index + 1}
              <div className="mt-1 text-[10px] text-muted-foreground">
                {index === 0 ? "Current station" : "Still to come"}
              </div>
            </div>
          </div>
        ))}
      </section>
    </div>
  );

  const timerCard = (
    <section
      data-phase-timer
      className={cn(tutorSurfaceCard, "flex items-center gap-4 px-5 py-3")}
      aria-label={`${phase} timer`}
    >
      <Clock3 size={20} className="text-muted-foreground" />
      <div>
        <div className="text-xs font-medium">
          {phase === "Questions" ? "Question time" : `${phase} time`}
          {paused && " · Paused"}
        </div>
        <div className="mt-0.5 text-[10px] text-muted-foreground">
          {countingDown ? "Time remaining" : "Time elapsed"}
        </div>
      </div>
      <div
        role="timer"
        aria-live="off"
        className="ml-4 font-mono text-3xl font-medium tabular-nums"
      >
        {formatTime(seconds)}
      </div>
    </section>
  );

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-background">
      <header className="shrink-0 border-b bg-card">
        <div className="flex min-h-10 items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex items-center gap-3 text-xs">
            <span className="font-semibold">Altitutor · Interviews</span>
            <span className="hidden text-muted-foreground sm:inline">
              Thursday MMI practice
            </span>
            <Pill>Prototype</Pill>
          </div>
          <Button
            variant="ghost"
            size="sm"
            aria-label={
              toolbarOpen
                ? "Collapse interview toolbar"
                : "Expand interview toolbar"
            }
            aria-expanded={toolbarOpen}
            onClick={() => setToolbarOpen(!toolbarOpen)}
            className="gap-2 text-xs"
          >
            {toolbarOpen ? "Hide controls" : "Show controls"}
            {toolbarOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </Button>
        </div>
        {toolbarOpen && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-dashed px-4 py-3 sm:px-6">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex gap-1 rounded-xl border p-1">
                {["Tutor", "Student"].map((item) => (
                  <button
                    key={item}
                    onClick={() => setView(item)}
                    aria-pressed={view === item}
                    className={cn(
                      "rounded-lg px-3 py-1.5 text-xs",
                      view === item && navActiveStyles,
                    )}
                  >
                    {item} preview
                  </button>
                ))}
              </div>
              <Button
                size="sm"
                variant="outline"
                className={tutorBtnOutline}
                onClick={() => setShowPrototypeControls(!showPrototypeControls)}
                aria-expanded={showPrototypeControls}
              >
                Prototype controls
              </Button>
            </div>
            <div className="flex items-center gap-2">
              {view === "Tutor" && (
                <Button
                  size="sm"
                  variant="outline"
                  className={cn(tutorBtnOutline, "gap-2")}
                  onClick={togglePause}
                >
                  {paused ? <Play size={14} /> : <Pause size={14} />}
                  {paused ? "Resume interview" : "Pause interview"}
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                className={cn(tutorBtnOutline, "gap-2")}
                onClick={leaveGuard.requestExit}
              >
                <LogOut size={14} />
                Exit interview
              </Button>
            </div>
          </div>
        )}
      </header>

      <div className="min-h-0 flex-1 overflow-auto">
        <div
          className={cn(
            "mx-auto max-w-[1600px] space-y-5 px-4 py-5 sm:px-6 lg:px-8",
            showPrototypeControls ? "pb-28" : "pb-8",
          )}
        >
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
                <ShieldCheck size={14} />
                {mode} mode<span>·</span>
                {delivery}
              </div>
              <h1 className="text-xl font-semibold tracking-tight">
                {view === "Student"
                  ? "Station 1"
                  : "Station 1 · Ethical reasoning"}
              </h1>
              {view === "Tutor" && (
                <p className="mt-1 text-sm text-muted-foreground">{student}</p>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Pill tone={disconnected ? "amber" : "green"}>
                {disconnected ? <WifiOff size={12} /> : <Wifi size={12} />}
                {disconnected ? "Connection interrupted" : "Connected · demo"}
              </Pill>
              {view === "Tutor" || phase === "Reading" ? (
                timerCard
              ) : (
                <Pill>
                  {phase}
                  {paused && " · Paused"}
                </Pill>
              )}
            </div>
          </div>

          {view === "Tutor" && delivery === "In person" && (
            <section
              className={cn(
                tutorSurfaceCard,
                "flex flex-wrap items-center justify-between gap-4 p-4",
              )}
            >
              <div>
                <h2 className="text-sm font-semibold">
                  Who is at your station?
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Choose the student you can see. There is no assigned station
                  order.
                </p>
              </div>
              <label className="flex items-center gap-2 text-xs">
                Student
                <select
                  aria-label="Student at your station"
                  value={inPersonClaims[0] ?? ""}
                  disabled={phase === "Feedback" || phase === "Finished"}
                  onChange={(event) => chooseStudent(event.target.value)}
                  className="min-w-56 rounded-xl border bg-background p-3 text-sm"
                >
                  <option value="">Choose arriving student</option>
                  {stations.map((station) => {
                    const occupied = inPersonClaims
                      .slice(1)
                      .includes(station.student);
                    return (
                      <option
                        key={station.student}
                        value={station.student}
                        disabled={occupied}
                      >
                        {station.student}
                        {occupied ? " · at another station" : ""}
                      </option>
                    );
                  })}
                </select>
              </label>
              {claimMessage && (
                <p role="alert" className="w-full text-xs text-amber-700">
                  {claimMessage}
                </p>
              )}
            </section>
          )}

          {(disconnected ||
            (recordingFailed && recordingEnabled) ||
            paused) && (
            <div
              role="status"
              className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"
            >
              {paused ? "Interview paused. " : ""}
              {disconnected
                ? "Connection interrupted. The interview continues; reconnect to the current station. "
                : ""}
              {recordingFailed && recordingEnabled
                ? "Recording unavailable. The interview can continue. "
                : ""}
              <span className="block pt-1 text-xs">
                Simulated state for UI review.
              </span>
            </div>
          )}
          {view === "Student" ? (
            studentPreview
          ) : variant === "A" ? (
            <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_230px]">
              <div className="space-y-4">
                {video()}
                {controls}
                {promptCard}
                {marking()}
              </div>
              {circuit()}
            </div>
          ) : variant === "B" ? (
            <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
              <div className="space-y-4">
                {promptCard}
                {marking()}
                {controls}
              </div>
              <div className="space-y-4">
                {video(true)}
                {circuit()}
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              {circuit(true)}
              <div className="grid items-start gap-5 lg:grid-cols-2">
                <div className="space-y-4">
                  {video()}
                  {promptCard}
                  {controls}
                </div>
                {marking(true)}
              </div>
            </div>
          )}

          {showPrototypeControls && (
            <section className="rounded-xl border border-dashed p-4 text-xs">
              <h2 className="font-semibold">
                Prototype controls & visible state
              </h2>
              <p className="mt-2 text-muted-foreground">
                All data is in memory. Timers run locally and advance reading →
                questions → feedback. No video, recording, server saves or
                multi-client realtime is connected.
              </p>
              <div className="my-4 flex flex-wrap items-center gap-4">
                <label className="flex items-center gap-2">
                  Phase
                  <select
                    className="rounded-lg border bg-background p-2"
                    value={phase}
                    onChange={(event) => setPhase(event.target.value as Phase)}
                  >
                    {phases.map((item) => (
                      <option key={item}>{item}</option>
                    ))}
                  </select>
                </label>
                <label className="flex items-center gap-2">
                  Mode
                  <select
                    className="rounded-lg border bg-background p-2"
                    value={mode}
                    onChange={(event) => setMode(event.target.value)}
                  >
                    <option>Feedback</option>
                    <option>Exam</option>
                  </select>
                </label>
                <label className="flex items-center gap-2">
                  Delivery
                  <select
                    className="rounded-lg border bg-background p-2"
                    value={delivery}
                    onChange={(event) => {
                      setDelivery(event.target.value);
                      setNotes(["", "", ""]);
                      setScore("");
                    }}
                  >
                    <option>Online</option>
                    <option>In person</option>
                  </select>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={disconnected}
                    onChange={(event) => setDisconnected(event.target.checked)}
                  />
                  Connection lost
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={recordingFailed}
                    onChange={(event) =>
                      setRecordingFailed(event.target.checked)
                    }
                  />
                  Recording failed
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={recordingEnabled}
                    onChange={(event) =>
                      setRecordingEnabled(event.target.checked)
                    }
                  />
                  Recording enabled
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={othersDone}
                    onChange={(event) => setOthersDone(event.target.checked)}
                  />
                  Other stations finished
                </label>
                <Button
                  variant="outline"
                  size="sm"
                  className={tutorBtnOutline}
                  disabled={!countingDown || paused}
                  onClick={() => {
                    const timestamp = Date.now();
                    setClock({
                      epoch: timestamp,
                      carriedMs: ((phase === "Reading" ? 120 : 480) - 3) * 1000,
                    });
                    setNow(timestamp);
                  }}
                >
                  Jump to final 3 seconds
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={reset}
                  className={cn(tutorBtnOutline, "gap-1")}
                >
                  <RotateCcw size={13} />
                  Reset example
                </Button>
              </div>
              <details>
                <summary className="cursor-pointer text-muted-foreground">
                  Full relevant state
                </summary>
                <pre className="mt-3 max-h-64 overflow-auto rounded-lg bg-muted p-3 text-[10px]">
                  {JSON.stringify(state, null, 2)}
                </pre>
              </details>
              <PrototypeSwitcher variants={variants} defaultVariant="C" />
            </section>
          )}
        </div>
      </div>

      <AlertDialog
        open={leaveGuard.open}
        onOpenChange={(open) => {
          if (!open) leaveGuard.cancelExit();
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leave this live interview?</AlertDialogTitle>
            <AlertDialogDescription>
              The interview will continue for everyone else. This prototype
              keeps your edits only in this tab; leaving will discard them.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button
              variant="outline"
              className={tutorBtnOutline}
              onClick={leaveGuard.cancelExit}
            >
              Stay in interview
            </Button>
            <Button variant="destructive" onClick={leaveGuard.confirmExit}>
              Leave interview
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog
        open={pendingStudent !== null}
        onOpenChange={(open) => {
          if (!open) setPendingStudent(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Move this feedback to {pendingStudent}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              You have already entered feedback or a score for{" "}
              {inPersonClaims[0]}. Confirm that these entries belong to{" "}
              {pendingStudent} before changing the student.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button
              variant="outline"
              className={tutorBtnOutline}
              onClick={() => setPendingStudent(null)}
            >
              Keep current student
            </Button>
            <Button
              onClick={() => {
                if (pendingStudent) applyStudentClaim(pendingStudent);
              }}
            >
              Confirm student change
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={startOverride} onOpenChange={setStartOverride}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Start with a student disconnected?
            </AlertDialogTitle>
            <AlertDialogDescription>
              The reading timer will run for everyone. The disconnected student
              can rejoin the current phase later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button
              variant="outline"
              className={tutorBtnOutline}
              onClick={() => setStartOverride(false)}
            >
              Wait for connection
            </Button>
            <Button
              onClick={() => {
                setStartOverride(false);
                setPhase("Reading");
              }}
            >
              Start anyway
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
