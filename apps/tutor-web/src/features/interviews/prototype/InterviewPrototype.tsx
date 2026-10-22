"use client";

// DEV-8 THROWAWAY: Three live tutor layouts at /interviews/prototype?variant=A|B|C.
// Question: how should watching, writing, and circuit coordination share the screen?
// All data and transitions below are simulated, in memory, and NOT a proposed backend.
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@altitutor/ui";
import {
  ArrowRight,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Circle,
  ClipboardList,
  Clock3,
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
import { tutorSurfaceCard } from "@/shared/lib/tutor-visual";
import { cn } from "@/shared/utils";

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
const prompt =
  "You are a medical student on placement. A fellow student tells you they are struggling and have been missing clinical sessions. They ask you to keep the conversation between the two of you.";

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
    : "A";
  const [phase, setPhase] = useState<Phase>("Questions");
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
  const student = stations[(rotation - 1) % stations.length].student;
  const ownVisible =
    phase === "Questions" ||
    (mode === "Feedback" && (phase === "Reading" || phase === "Feedback"));
  const tutorReceives =
    phase === "Reading" ||
    phase === "Questions" ||
    (phase === "Feedback" && mode === "Feedback");
  const remaining =
    phase === "Reading" ? "01:30" : phase === "Questions" ? "04:32" : "—";
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
    storage: "in-memory only",
    timers: "static example; not realtime",
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
    if (phase === "Finished" && rotation < 6) {
      setRotation(rotation + 1);
      setPhase("Waiting");
      setReady(false);
      setOthersDone(false);
      setQuestion(0);
      setNotes(["", "", ""]);
      setScore("");
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
        <Button
          variant="ghost"
          size="icon"
          aria-label={camera ? "Disable demo camera" : "Enable demo camera"}
          onClick={() => setCamera(!camera)}
        >
          {camera ? <Video size={17} /> : <VideoOff size={17} />}
        </Button>
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

  const video = (compact = false, studentView = false) => (
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
                recordingFailed ? "bg-amber-100 text-amber-900" : "bg-black/25",
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
        {compact ? "Station 1" : "Station 1 · Ethical reasoning"}
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
                index === 0
                  ? "bg-sky-50 text-slate-900 ring-1 ring-sky-100"
                  : "bg-muted/30",
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
                {stations[(index + rotation - 1) % stations.length].student}
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
                index === question
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted",
              )}
            >
              Q{index + 1}
              {notes[index] && " •"}
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
                <div className="rounded-xl bg-sky-50/70 p-3 text-xs leading-relaxed text-slate-600">
                  <strong className="mb-1 block text-slate-800">
                    Rubric · example
                  </strong>
                  {item.rubric}
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
            variant="ghost"
            disabled={question === 0}
            onClick={() => setQuestion(question - 1)}
          >
            <ChevronLeft size={15} /> Previous
          </Button>
          <Button
            size="sm"
            variant="ghost"
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
        <span className="ml-2 text-muted-foreground">Student-facing</span>
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
        <h2 className="mb-6 mt-4 text-xl font-semibold">
          Station 1 · Ethical reasoning
        </h2>
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
          This student preview is inside the tutor shell for discussion. Real
          media is not connected.
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
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground",
              )}
            >
              {index + 1}
            </span>
            <div className="text-xs">
              {station.name}
              <div className="mt-1 text-[10px] text-muted-foreground">
                {index === 0 ? "Current station" : "Still to come"}
              </div>
            </div>
          </div>
        ))}
      </section>
    </div>
  );

  return (
    <div className="space-y-5 pb-28 pt-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-xs text-muted-foreground">
          Interviews <span className="mx-2">/</span> Live mock{" "}
          <span className="mx-2">/</span> UI exploration
        </div>
        <Pill tone="amber">Prototype · all activity is simulated</Pill>
      </div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-2 text-[10px] font-medium uppercase tracking-[.18em] text-muted-foreground">
            Medicine interviews
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Thursday MMI practice
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Station 1 · Ethical reasoning <span className="mx-2">·</span>{" "}
            {student}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Pill tone={disconnected ? "amber" : "green"}>
            {disconnected ? <WifiOff size={12} /> : <Wifi size={12} />}
            {disconnected ? "Connection issue · demo" : "Connected · demo"}
          </Pill>
          <div className="rounded-xl border px-4 py-2 text-right">
            <div className="text-[10px] text-muted-foreground">
              {paused ? "Paused · demo" : phase}
            </div>
            <div className="font-mono text-xl font-medium tabular-nums">
              {remaining}
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-y py-3">
        <div className="flex gap-1 rounded-xl bg-muted/60 p-1">
          {["Tutor", "Student"].map((item) => (
            <button
              key={item}
              onClick={() => setView(item)}
              className={cn(
                "rounded-lg px-4 py-1.5 text-xs",
                view === item && "bg-background font-medium shadow-sm",
              )}
            >
              {item} preview
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <ShieldCheck size={14} />
          {mode} mode
          <span className="hidden sm:inline">· 6 tutors · 6 students</span>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setPaused(!paused)}
            className="gap-1.5 rounded-lg"
          >
            {paused ? <Play size={13} /> : <Pause size={13} />}
            {paused ? "Resume" : "Pause"} · demo
          </Button>
        </div>
      </div>
      {(disconnected || (recordingFailed && recordingEnabled) || paused) && (
        <div
          role="status"
          className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"
        >
          {paused ? "Interview paused in this demo. " : ""}
          {disconnected
            ? "Connection interrupted. Your feedback remains in this tab. "
            : ""}
          {recordingFailed && recordingEnabled
            ? "Recording unavailable. The tutor can still continue the interview. "
            : ""}
          <span className="block pt-1 text-xs">
            These controls explore the UI; they do not test real network
            recovery.
          </span>
        </div>
      )}
      {view === "Student" ? (
        studentPreview
      ) : variant === "A" ? (
        <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_230px]">
          <div className="space-y-4">
            {video()}
            {controls}
            {promptCard}
            {marking()}
          </div>
          {circuit()}
        </div>
      ) : variant === "B" ? (
        <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
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
          <div className="grid items-start gap-5 xl:grid-cols-2">
            <div className="space-y-4">
              {video()}
              {promptCard}
              {controls}
            </div>
            {marking(true)}
          </div>
        </div>
      )}

      <details className="rounded-xl border border-dashed p-4 text-xs" open>
        <summary className="cursor-pointer font-medium">
          Prototype controls & visible state
        </summary>
        <p className="mt-2 text-muted-foreground">
          Compare layouts with the floating arrows. Inputs survive layout
          changes, but reset on refresh. Phase times are examples. No backend,
          media, saving, or realtime is connected.
        </p>
        <div className="my-4 flex flex-wrap items-center gap-3">
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
            <input
              type="checkbox"
              checked={disconnected}
              onChange={(event) => setDisconnected(event.target.checked)}
            />{" "}
            Connection lost
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={recordingFailed}
              onChange={(event) => setRecordingFailed(event.target.checked)}
            />{" "}
            Recording failed
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={recordingEnabled}
              onChange={(event) => setRecordingEnabled(event.target.checked)}
            />
            Recording enabled for this interview
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={othersDone}
              onChange={(event) => setOthersDone(event.target.checked)}
            />{" "}
            Other stations finished
          </label>
          <Button variant="ghost" size="sm" onClick={reset} className="gap-1">
            <RotateCcw size={13} />
            Reset
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
      </details>
      <PrototypeSwitcher variants={variants} />
    </div>
  );
}
