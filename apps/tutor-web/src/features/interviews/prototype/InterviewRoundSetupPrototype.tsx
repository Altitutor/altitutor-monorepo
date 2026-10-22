"use client";

// DEV-8 THROWAWAY: three round-setup layouts on the authoring route, via ?variant=.
// A guided flow, B a roster workspace, C a circuit board. All operations are local.
import { useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@altitutor/ui";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  Circle,
  Clock3,
  Settings2,
  Users,
  Video,
} from "lucide-react";
import { PrototypeSwitcher } from "@/shared/components/prototype-switcher";
import {
  tutorBtnOutline,
  tutorBtnPrimary,
  tutorDialogContentClass,
  tutorSurfaceCard,
} from "@/shared/lib/tutor-visual";
import { cn, navActiveStyles } from "@/shared/utils";
import type { PrototypeInterview } from "./authoring-data";

const variants = [
  { key: "A", name: "Guided setup" },
  { key: "B", name: "Roster workspace" },
  { key: "C", name: "Circuit first" },
];
const students = [
  { id: "amelia", name: "Amelia Chen", className: "Thursday MMI" },
  { id: "noah", name: "Noah Williams", className: "Thursday MMI" },
  { id: "olivia", name: "Olivia Patel", className: "Saturday MMI" },
  { id: "liam", name: "Liam Nguyen", className: "Saturday MMI" },
  { id: "ava", name: "Ava Wilson", className: "Thursday MMI" },
  { id: "ethan", name: "Ethan Lee", className: "Saturday MMI" },
];
const tutors = [
  { id: "john", name: "John Doe (you)" },
  { id: "sarah", name: "Sarah Chen" },
  { id: "alex", name: "Alex Patel" },
  { id: "james", name: "James Wilson" },
  { id: "emma", name: "Emma Nguyen" },
  { id: "grace", name: "Grace Lee" },
];
const fieldClass =
  "w-full rounded-xl border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring";
const tagClass =
  "inline-flex rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground";
const stepNames = ["Round details", "Students", "Tutor assignments", "Review"];

function Panel({
  title,
  detail,
  children,
}: {
  title: string;
  detail?: string;
  children: ReactNode;
}) {
  return (
    <section className={cn(tutorSurfaceCard, "space-y-4 p-5")}>
      <div>
        <h2 className="font-semibold">{title}</h2>
        {detail && (
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            {detail}
          </p>
        )}
      </div>
      {children}
    </section>
  );
}
export function RoundSetupVariantA({
  navigation,
  content,
  footer,
}: {
  navigation: ReactNode;
  content: ReactNode;
  footer: ReactNode;
}) {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {navigation}
      {content}
      {footer}
    </div>
  );
}
export function RoundSetupVariantB({
  roster,
  settings,
}: {
  roster: ReactNode;
  settings: ReactNode;
}) {
  return (
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(320px,1fr)]">
      <div className="space-y-5">{roster}</div>
      <div className="space-y-5">{settings}</div>
    </div>
  );
}
export function RoundSetupVariantC({
  controls,
  circuit,
  footer,
}: {
  controls: ReactNode;
  circuit: ReactNode;
  footer: ReactNode;
}) {
  return (
    <div className="space-y-6">
      {controls}
      {circuit}
      {footer}
    </div>
  );
}

export function InterviewRoundSetupPrototype({
  interview,
  onBack,
}: {
  interview: PrototypeInterview;
  onBack: () => void;
}) {
  const params = useSearchParams();
  const variant = ["A", "B", "C"].includes(params.get("variant") ?? "")
    ? params.get("variant")
    : "B";
  const [step, setStep] = useState(0);
  const [delivery, setDelivery] = useState<"online" | "in-person">("online");
  const [mode, setMode] = useState<"exam" | "feedback">("exam");
  const [recording, setRecording] = useState(true);
  const [when, setWhen] = useState<"now" | "later">("now");
  const [scheduledAt, setScheduledAt] = useState("");
  const [selectedStudents, setSelectedStudents] = useState(() =>
    students
      .slice(0, Math.min(3, interview.stations.length))
      .map((student) => student.id),
  );
  const [assignments, setAssignments] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      interview.stations.map((station, i) => [station.id, tutors[i]?.id ?? ""]),
    ),
  );
  const [studentSearch, setStudentSearch] = useState("");
  const [classFilter, setClassFilter] = useState("all");
  const [rotation, setRotation] = useState(0);
  const [dialog, setDialog] = useState<
    "students" | "settings" | "override" | null
  >(null);
  const [stage, setStage] = useState<
    "setup" | "scheduled" | "lobby" | "reading"
  >("setup");
  const [readyTutors, setReadyTutors] = useState<string[]>(["john"]);
  const [connectedStudents, setConnectedStudents] = useState<string[]>([
    "amelia",
    "noah",
  ]);
  const [startOverride, setStartOverride] = useState(false);
  const selected = selectedStudents
    .map((id) => students.find((student) => student.id === id))
    .filter((student) => student !== undefined);
  const visibleStudents = students.filter(
    (student) =>
      (classFilter === "all" || student.className === classFilter) &&
      student.name.toLowerCase().includes(studentSearch.toLowerCase()),
  );
  const assigned = interview.stations.filter(
    (station) => assignments[station.id],
  );
  const noDuplicates =
    new Set(assigned.map((station) => assignments[station.id])).size ===
    assigned.length;
  const completeContent =
    interview.stations.length > 0 &&
    interview.stations.every((station) => station.questionIds.length > 0);
  const scheduleValid =
    when === "now" ||
    (Boolean(scheduledAt) && new Date(scheduledAt).getTime() > Date.now());
  const checks = [
    {
      ok: completeContent,
      label: completeContent
        ? "Every station has questions"
        : "Add questions to every station in the builder",
    },
    {
      ok: selected.length > 0 && selected.length <= interview.stations.length,
      label: selected.length
        ? `${selected.length} of ${interview.stations.length} student places filled`
        : "Choose at least one student",
    },
    {
      ok: assigned.length === interview.stations.length && noDuplicates,
      label:
        assigned.length === interview.stations.length && noDuplicates
          ? "A different tutor is assigned to every station"
          : "Assign a different tutor to every station",
    },
    {
      ok: scheduleValid,
      label:
        when === "now"
          ? "Ready to open the waiting room"
          : scheduleValid
            ? "Future date and time selected"
            : "Choose a future date and time",
    },
  ];
  const canCreate = checks.every((check) => check.ok);
  const allTutorsReady =
    assigned.length === interview.stations.length &&
    assigned.every((station) => readyTutors.includes(assignments[station.id]));
  const participating = assigned.some(
    (station) => assignments[station.id] === "john",
  );
  const missingStudents =
    delivery === "online"
      ? selected.filter((student) => !connectedStudents.includes(student.id))
      : [];
  const studentAt = (stationIndex: number, roundIndex: number) =>
    selected[
      (stationIndex - roundIndex + interview.stations.length) %
        interview.stations.length
    ];
  const toggleStudent = (id: string) =>
    setSelectedStudents((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : current.length < interview.stations.length
          ? [...current, id]
          : current,
    );
  const setTutor = (stationId: string, tutorId: string) => {
    if (
      tutorId &&
      Object.entries(assignments).some(
        ([id, assignedId]) => id !== stationId && assignedId === tutorId,
      )
    )
      return;
    setAssignments((current) => ({ ...current, [stationId]: tutorId }));
  };
  const createRound = () => {
    if (canCreate) setStage(when === "later" ? "scheduled" : "lobby");
  };
  const startReading = () => {
    if (!allTutorsReady || !participating) return;
    if (missingStudents.length) setDialog("override");
    else setStage("reading");
  };

  const details = (
    <Panel
      title="Round details"
      detail="Timing and station content come from the prepared interview."
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-2 text-xs font-medium">
          Delivery
          <select
            aria-label="Delivery"
            className={fieldClass}
            value={delivery}
            onChange={(event) =>
              setDelivery(
                event.target.value === "online" ? "online" : "in-person",
              )
            }
          >
            <option value="online">Online</option>
            <option value="in-person">In person</option>
          </select>
        </label>
        <label className="space-y-2 text-xs font-medium">
          Mode
          <select
            aria-label="Interview mode"
            className={fieldClass}
            value={mode}
            onChange={(event) =>
              setMode(event.target.value === "exam" ? "exam" : "feedback")
            }
          >
            <option value="exam">Exam</option>
            <option value="feedback">Feedback</option>
          </select>
        </label>
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">
        {mode === "exam"
          ? "Exam: tutors can see and hear students during reading. Communication is two-way during answers, then stops for marking."
          : "Feedback: two-way communication during reading, answers and verbal feedback."}
      </p>
      <div className="border-t pt-4">
        <label className="flex cursor-pointer items-start gap-3">
          <input
            className="mt-1 accent-primary"
            type="checkbox"
            checked={recording}
            onChange={(event) => setRecording(event.target.checked)}
          />
          <span className="text-sm font-medium">
            Record this round
            <span className="mt-1 block text-xs font-normal leading-relaxed text-muted-foreground">
              {delivery === "online" ? "Modest-quality video" : "Audio only"} ·{" "}
              {mode === "exam" ? "answers only" : "answers and feedback"}.
              Available for 90 days.
            </span>
          </span>
        </label>
      </div>
      <div className="space-y-3 border-t pt-4">
        <div className="grid grid-cols-2 gap-2">
          {(["now", "later"] as const).map((value) => (
            <button
              key={value}
              aria-pressed={when === value}
              className={cn(
                "flex items-center justify-center gap-2 rounded-xl border p-3 text-sm",
                when === value ? navActiveStyles : "text-muted-foreground",
              )}
              onClick={() => setWhen(value)}
            >
              {value === "now" ? (
                <Clock3 size={15} />
              ) : (
                <CalendarDays size={15} />
              )}
              {value === "now" ? "Start now" : "Schedule for later"}
            </button>
          ))}
        </div>
        {when === "later" && (
          <label className="block space-y-2 text-xs">
            Date and time
            <input
              aria-label="Scheduled date and time"
              type="datetime-local"
              className={fieldClass}
              value={scheduledAt}
              onInput={(event) => setScheduledAt(event.currentTarget.value)}
              onChange={(event) => setScheduledAt(event.target.value)}
            />
            <span className="block leading-relaxed text-muted-foreground">
              In your device’s local time. Appears in students’ upcoming
              interviews; a tutor still starts it manually.
            </span>
          </label>
        )}
      </div>
    </Panel>
  );

  const roster = (
    <Panel
      title="Students"
      detail={`Choose up to ${interview.stations.length} currently enrolled students, across any interview classes.`}
    >
      <div className="flex flex-wrap gap-2">
        <input
          aria-label="Search students"
          placeholder="Search students"
          className={cn(fieldClass, "min-w-40 flex-1")}
          value={studentSearch}
          onChange={(event) => setStudentSearch(event.target.value)}
        />
        <select
          aria-label="Filter by class"
          className={cn(fieldClass, "w-auto")}
          value={classFilter}
          onChange={(event) => setClassFilter(event.target.value)}
        >
          <option value="all">All interview classes</option>
          <option>Thursday MMI</option>
          <option>Saturday MMI</option>
        </select>
      </div>
      <div className="space-y-1">
        {visibleStudents.map((student) => (
          <label
            key={student.id}
            className={cn(
              "flex cursor-pointer items-center gap-3 rounded-xl p-3",
              selectedStudents.includes(student.id)
                ? navActiveStyles
                : "hover:bg-muted/30",
              !selectedStudents.includes(student.id) &&
                selected.length >= interview.stations.length &&
                "opacity-40",
            )}
          >
            <input
              type="checkbox"
              aria-label={`Select ${student.name}`}
              checked={selectedStudents.includes(student.id)}
              disabled={
                !selectedStudents.includes(student.id) &&
                selected.length >= interview.stations.length
              }
              onChange={() => toggleStudent(student.id)}
              className="accent-primary"
            />
            <span className="min-w-0 flex-1 text-sm font-medium">
              {student.name}
              <span className="mt-1 block text-xs font-normal text-muted-foreground">
                {student.className}
              </span>
            </span>
          </label>
        ))}
        {visibleStudents.length === 0 && (
          <p className="py-4 text-sm text-muted-foreground">
            No students match your search.
          </p>
        )}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3 text-xs text-muted-foreground">
        <span>
          {selected.length} selected ·{" "}
          {interview.stations.length - selected.length} places remaining
        </span>
        <button
          className="hover:underline"
          onClick={() => setSelectedStudents([])}
        >
          Clear selection
        </button>
      </div>
      {selected.length > 0 && selected.length < interview.stations.length && (
        <p className="text-xs text-muted-foreground">
          {interview.stations.length - selected.length} stations will be idle
          each rotation. Students still visit every station.
        </p>
      )}
    </Panel>
  );

  const tutorSelect = (stationId: string, index: number) => (
    <select
      aria-label={`Tutor for station ${index + 1}`}
      className={fieldClass}
      value={assignments[stationId] ?? ""}
      onChange={(event) => setTutor(stationId, event.target.value)}
    >
      <option value="">Choose a tutor</option>
      {tutors.map((tutor) => (
        <option
          key={tutor.id}
          value={tutor.id}
          disabled={Object.entries(assignments).some(
            ([id, assignedId]) => id !== stationId && assignedId === tutor.id,
          )}
        >
          {tutor.name}
        </option>
      ))}
    </select>
  );
  const assignmentTable = (
    <Panel
      title="Tutor assignments"
      detail="Tutors stay at their station for the whole round. Only Medicine interview tutors are listed."
    >
      <div className="divide-y">
        {interview.stations.map((station, i) => (
          <div
            key={station.id}
            className="grid items-center gap-3 py-3 sm:grid-cols-[1fr_1fr]"
          >
            <div>
              <span className="text-xs text-muted-foreground">
                Station {i + 1}
              </span>
              <p className="mt-1 text-sm font-medium">{station.name}</p>
            </div>
            {tutorSelect(station.id, i)}
          </div>
        ))}
      </div>
    </Panel>
  );

  const rotationPreview = (
    <Panel
      title={delivery === "online" ? "Rotation preview" : "Student arrival"}
      detail={
        delivery === "online"
          ? "Tutors stay in place while students rotate. This plan is visible to tutors."
          : "No assigned station order. Tutors choose the student who arrives, including during reading time."
      }
    >
      {delivery === "online" ? (
        <>
          <div className="flex flex-wrap gap-1">
            {interview.stations.map((station, i) => (
              <button
                key={station.id}
                aria-pressed={rotation === i}
                className={cn(
                  "rounded-lg px-3 py-2 text-xs",
                  rotation === i ? navActiveStyles : "text-muted-foreground",
                )}
                onClick={() => setRotation(i)}
              >
                Rotation {i + 1}
              </button>
            ))}
          </div>
          <div className="divide-y">
            {interview.stations.map((station, i) => (
              <div
                key={station.id}
                className="flex justify-between gap-4 py-3 text-sm"
              >
                <span className="text-muted-foreground">Station {i + 1}</span>
                <span>{studentAt(i, rotation)?.name ?? "Idle"}</span>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="space-y-3 rounded-xl bg-muted/40 p-4 text-sm">
          <p>A student can only be claimed at one station at a time.</p>
          <p className="text-xs text-muted-foreground">
            Students read the printed prompt at the door. Tutors select arrivals
            in the live workspace.
          </p>
        </div>
      )}
    </Panel>
  );
  const summary = (
    <Panel title="Round summary">
      <div className="flex flex-wrap gap-2">
        <span className={tagClass}>{interview.stations.length} stations</span>
        <span className={tagClass}>{selected.length} students</span>
        <span className={tagClass}>{assigned.length} tutors</span>
      </div>
      <p className="text-sm">
        {interview.readingMinutes} min reading + {interview.questionMinutes} min
        answers per station
      </p>
      <p className="text-xs text-muted-foreground">
        {interview.stations.length *
          (interview.readingMinutes + interview.questionMinutes)}{" "}
        minutes, plus feedback and transitions
      </p>
      <div className="space-y-3 border-t pt-4">
        {checks.map((check) => (
          <div
            key={check.label}
            className={cn(
              "flex items-start gap-2 text-xs",
              !check.ok && "text-amber-600 dark:text-amber-400",
            )}
          >
            {check.ok ? (
              <Check size={15} className="shrink-0" />
            ) : (
              <Circle size={15} className="shrink-0" />
            )}
            <span>{check.label}</span>
          </div>
        ))}
      </div>
      <Button
        className={cn(tutorBtnPrimary, "w-full gap-2")}
        disabled={!canCreate}
        onClick={createRound}
      >
        {when === "later" ? (
          <CalendarDays size={15} />
        ) : (
          <ArrowRight size={15} />
        )}
        {when === "later" ? "Schedule round" : "Open waiting room"}
      </Button>
      <p className="text-xs leading-relaxed text-muted-foreground">
        {when === "later"
          ? "Students will see the upcoming round once scheduled."
          : "Opening the waiting room does not start reading. Every tutor must be ready."}
      </p>
    </Panel>
  );

  const lobby = (
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(300px,1fr)]">
      <Panel
        title="Waiting room"
        detail="Any participating tutor may start reading once all tutors are ready. No lead tutor is required."
      >
        <div className="divide-y">
          {interview.stations.map((station, i) => (
            <div
              key={station.id}
              className="flex items-center justify-between gap-3 py-4"
            >
              <div>
                <p className="text-sm font-medium">
                  Station {i + 1} · {station.name}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {
                    tutors.find((tutor) => tutor.id === assignments[station.id])
                      ?.name
                  }
                </p>
              </div>
              {assignments[station.id] === "john" ? (
                <Button
                  variant="outline"
                  className={cn(
                    tutorBtnOutline,
                    readyTutors.includes("john") && navActiveStyles,
                  )}
                  onClick={() =>
                    setReadyTutors((current) =>
                      current.includes("john")
                        ? current.filter((id) => id !== "john")
                        : [...current, "john"],
                    )
                  }
                >
                  {readyTutors.includes("john") ? "Ready · undo" : "I’m ready"}
                </Button>
              ) : (
                <span className={tagClass}>
                  {readyTutors.includes(assignments[station.id])
                    ? "Ready"
                    : "Not ready"}
                </span>
              )}
            </div>
          ))}
        </div>
        <div className="border-t pt-4">
          <h3 className="mb-3 text-sm font-medium">Students</h3>
          {selected.map((student) => (
            <div
              key={student.id}
              className="flex items-center justify-between py-2 text-sm"
            >
              <span>{student.name}</span>
              <span className={tagClass}>
                {delivery === "in-person"
                  ? "Select on arrival"
                  : connectedStudents.includes(student.id)
                    ? "Connected"
                    : "Not connected"}
              </span>
            </div>
          ))}
        </div>
      </Panel>
      <div className="space-y-5">
        {rotationPreview}
        <Panel title="Start the first station">
          {!participating && (
            <p className="text-xs text-muted-foreground">
              Only a tutor assigned to this round can start reading.
            </p>
          )}
          <p className="text-sm">
            {allTutorsReady
              ? "All tutors are ready."
              : "Waiting for every tutor to be ready."}
          </p>
          {missingStudents.length > 0 && (
            <p className="text-xs leading-relaxed text-amber-600 dark:text-amber-400">
              {missingStudents.map((student) => student.name).join(", ")}{" "}
              {missingStudents.length === 1 ? "is" : "are"} not connected. You
              can explicitly start without them; they can reconnect to the
              current phase.
            </p>
          )}
          <Button
            disabled={!allTutorsReady || !participating}
            className={cn(tutorBtnPrimary, "w-full")}
            onClick={startReading}
          >
            {missingStudents.length
              ? "Review missing connections"
              : "Start reading time"}
          </Button>
        </Panel>
      </div>
    </div>
  );

  return (
    <div className="space-y-6 pb-28">
      <Button
        variant="ghost"
        size="sm"
        className="-ml-3 gap-2 text-muted-foreground"
        onClick={onBack}
      >
        <ArrowLeft size={14} />
        Back to interview
      </Button>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-2 text-xs text-muted-foreground">
            {interview.name} · Prototype
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {stage === "setup"
              ? "Set up a round"
              : stage === "scheduled"
                ? "Round scheduled"
                : stage === "reading"
                  ? "Reading time started"
                  : "Round waiting room"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {stage === "setup"
              ? "Choose who is joining and how this mock interview will run."
              : `${delivery === "online" ? "Online" : "In person"} · ${mode === "exam" ? "Exam mode" : "Feedback mode"} · Recording ${recording ? "on" : "off"}`}
          </p>
        </div>
        {stage !== "setup" && (
          <Button
            variant="outline"
            className={tutorBtnOutline}
            onClick={() => {
              setStage("setup");
              setStartOverride(false);
            }}
          >
            Edit setup
          </Button>
        )}
      </div>

      {stage === "setup" && (
        <>
          {variant === "A" && (
            <RoundSetupVariantA
              navigation={
                <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                  {stepNames.map((name, i) => (
                    <button
                      key={name}
                      aria-pressed={step === i}
                      onClick={() => setStep(i)}
                      className={cn(
                        "flex items-center gap-3 rounded-xl border p-3 text-left text-sm",
                        step === i ? navActiveStyles : "text-muted-foreground",
                      )}
                    >
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs">
                        {i + 1}
                      </span>
                      {name}
                    </button>
                  ))}
                </div>
              }
              content={
                step === 0 ? (
                  details
                ) : step === 1 ? (
                  roster
                ) : step === 2 ? (
                  assignmentTable
                ) : (
                  <div className="grid gap-5 md:grid-cols-2">
                    {rotationPreview}
                    {summary}
                  </div>
                )
              }
              footer={
                <div className="flex justify-between">
                  <Button
                    variant="outline"
                    className={tutorBtnOutline}
                    disabled={step === 0}
                    onClick={() => setStep((current) => current - 1)}
                  >
                    Previous
                  </Button>
                  {step < 3 && (
                    <Button
                      className={cn(tutorBtnPrimary, "gap-2")}
                      onClick={() => setStep((current) => current + 1)}
                    >
                      Next: {stepNames[step + 1]}
                      <ArrowRight size={14} />
                    </Button>
                  )}
                </div>
              }
            />
          )}
          {variant === "B" && (
            <RoundSetupVariantB
              roster={
                <>
                  {roster}
                  {assignmentTable}
                </>
              }
              settings={
                <>
                  {details}
                  {summary}
                  <details className={cn(tutorSurfaceCard, "p-4")}>
                    <summary className="cursor-pointer text-sm font-medium">
                      {delivery === "online"
                        ? "Preview student rotations"
                        : "How students arrive"}
                    </summary>
                    <div className="mt-4">{rotationPreview}</div>
                  </details>
                </>
              }
            />
          )}
          {variant === "C" && (
            <RoundSetupVariantC
              controls={
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-muted/40 p-4">
                  <div className="flex flex-wrap gap-2">
                    <span className={tagClass}>
                      {delivery === "online" ? "Online" : "In person"}
                    </span>
                    <span className={tagClass}>
                      {mode === "exam" ? "Exam" : "Feedback"}
                    </span>
                    <span className={tagClass}>
                      {recording ? "Recording on" : "Recording off"}
                    </span>
                    <span className={tagClass}>
                      {when === "now" ? "Start now" : "Scheduled"}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      className={cn(tutorBtnOutline, "gap-2")}
                      onClick={() => setDialog("settings")}
                    >
                      <Settings2 size={14} />
                      Round details
                    </Button>
                    <Button
                      variant="outline"
                      className={cn(tutorBtnOutline, "gap-2")}
                      onClick={() => setDialog("students")}
                    >
                      <Users size={14} />
                      Choose students ({selected.length})
                    </Button>
                  </div>
                </div>
              }
              circuit={
                <>
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {interview.stations.map((station, i) => (
                      <Panel
                        key={station.id}
                        title={`Station ${i + 1}`}
                        detail={station.name}
                      >
                        <div className="space-y-2">
                          <p className="text-xs text-muted-foreground">Tutor</p>
                          {tutorSelect(station.id, i)}
                        </div>
                        <div className="rounded-xl bg-muted/40 p-4">
                          <p className="mb-2 text-xs text-muted-foreground">
                            {delivery === "online"
                              ? "Starting student"
                              : "Student"}
                          </p>
                          <p className="text-sm font-medium">
                            {delivery === "online"
                              ? (studentAt(i, 0)?.name ?? "Idle")
                              : "Selected by tutor on arrival"}
                          </p>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {station.questionIds.length} questions ·{" "}
                          {station.maximum} points
                        </p>
                      </Panel>
                    ))}
                  </div>
                  {delivery === "online" ? (
                    <Panel title="The whole circuit">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                          <thead>
                            <tr>
                              <th className="p-3 font-medium">Student</th>
                              {interview.stations.map((station, i) => (
                                <th
                                  key={station.id}
                                  className="p-3 font-medium"
                                >
                                  Rotation {i + 1}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {selected.map((student, studentIndex) => (
                              <tr key={student.id} className="border-t">
                                <td className="p-3 font-medium">
                                  {student.name}
                                </td>
                                {interview.stations.map((station, i) => (
                                  <td
                                    key={station.id}
                                    className="p-3 text-muted-foreground"
                                  >
                                    Station{" "}
                                    {((studentIndex + i) %
                                      interview.stations.length) +
                                      1}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </Panel>
                  ) : (
                    rotationPreview
                  )}
                </>
              }
              footer={<div className="ml-auto max-w-lg">{summary}</div>}
            />
          )}
        </>
      )}

      {stage === "scheduled" && (
        <div className="mx-auto max-w-2xl space-y-5">
          <Panel
            title="Upcoming interview"
            detail="Student preview · the same date is shown in each student’s local time."
          >
            <div className="flex items-start gap-4">
              <CalendarDays className="mt-1 shrink-0" size={25} />
              <div>
                <h3 className="font-semibold">{interview.name}</h3>
                <p className="mt-2 text-sm">
                  {new Date(scheduledAt).toLocaleString(undefined, {
                    dateStyle: "full",
                    timeStyle: "short",
                  })}
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {delivery === "online" ? "Online" : "In person"} ·{" "}
                  {interview.stations.length} stations ·{" "}
                  {mode === "exam" ? "Exam" : "Feedback"}
                </p>
              </div>
            </div>
          </Panel>
          <p className="text-center text-sm text-muted-foreground">
            Scheduled for {selected.map((student) => student.name).join(", ")}.
            A tutor starts the round manually.
          </p>
          <Button
            className={cn(tutorBtnPrimary, "w-full")}
            onClick={() => setStage("lobby")}
          >
            Open waiting room
          </Button>
        </div>
      )}
      {stage === "lobby" && lobby}
      {stage === "reading" && (
        <div className="mx-auto max-w-2xl space-y-5">
          <Panel title="The first reading phase has begun">
            <div className="flex items-center gap-4 rounded-xl bg-muted/40 p-5">
              <Clock3 size={28} />
              <div>
                <p className="text-3xl font-semibold tabular-nums">
                  {interview.readingMinutes}:00
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Illustrative phase start · this timer is static
                </p>
              </div>
            </div>
            <p className="text-sm">
              {startOverride
                ? `Started with ${missingStudents.map((student) => student.name).join(", ")} disconnected. They rejoin the current phase when connected.`
                : "All required tutors are ready and connection checks are satisfied."}
            </p>
            <p className="text-xs leading-relaxed text-muted-foreground">
              This setup preview stops here. The accepted live workspace is a
              separate fixture; opening it does not transfer this round.
            </p>
            <Link
              href="/interviews/prototype?variant=C"
              className="inline-flex items-center gap-2 text-sm underline"
            >
              <Video size={14} />
              Open accepted live workspace
            </Link>
          </Panel>
          <Button
            variant="outline"
            className={tutorBtnOutline}
            onClick={() => {
              setStage("lobby");
              setStartOverride(false);
            }}
          >
            Back to waiting room simulation
          </Button>
        </div>
      )}

      <details className={cn(tutorSurfaceCard, "p-4 text-xs")}>
        <summary className="cursor-pointer font-medium">
          Prototype controls & state · {variant}
        </summary>
        <div className="mt-4 space-y-4">
          <p className="text-muted-foreground">
            Mock participants and connections. Nothing is scheduled, recorded or
            saved outside this tab. Refresh or leaving setup resets this round.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              className={tutorBtnOutline}
              onClick={() => setReadyTutors(tutors.map((tutor) => tutor.id))}
            >
              Simulate all tutors ready
            </Button>
            <Button
              variant="outline"
              size="sm"
              className={tutorBtnOutline}
              onClick={() => setReadyTutors(["john"])}
            >
              Simulate tutors not ready
            </Button>
            <Button
              variant="outline"
              size="sm"
              className={tutorBtnOutline}
              onClick={() => setConnectedStudents([...selectedStudents])}
            >
              Simulate all students connected
            </Button>
            <Button
              variant="outline"
              size="sm"
              className={tutorBtnOutline}
              onClick={() =>
                setConnectedStudents(selectedStudents.slice(0, -1))
              }
            >
              Simulate one student disconnected
            </Button>
          </div>
          <pre className="max-h-72 overflow-auto rounded-lg bg-muted/40 p-3">
            {JSON.stringify(
              {
                variant,
                stage,
                interviewId: interview.id,
                delivery,
                mode,
                recording,
                when,
                scheduledAt,
                selectedStudents,
                assignments,
                rotation,
                readyTutors,
                connectedStudents,
                startOverride,
              },
              null,
              2,
            )}
          </pre>
        </div>
      </details>
      <PrototypeSwitcher variants={variants} defaultVariant="B" />

      <Dialog
        open={dialog !== null}
        onOpenChange={(open) => {
          if (!open) setDialog(null);
        }}
      >
        <DialogContent
          className={cn(
            tutorDialogContentClass,
            "max-h-[85vh] overflow-auto sm:max-w-xl",
          )}
        >
          <DialogHeader>
            <DialogTitle>
              {dialog === "students"
                ? "Choose students"
                : dialog === "settings"
                  ? "Round details"
                  : "Start without everyone connected?"}
            </DialogTitle>
            <DialogDescription>
              {dialog === "override"
                ? "This starts reading time for the whole round. Missing students can reconnect to its current phase."
                : "Changes stay with this round while you compare layouts."}
            </DialogDescription>
          </DialogHeader>
          {dialog === "students" ? (
            roster
          ) : dialog === "settings" ? (
            details
          ) : (
            <div className="space-y-5">
              <p className="text-sm">
                Not connected:{" "}
                {missingStudents.map((student) => student.name).join(", ")}.
              </p>
              <div className="flex flex-wrap justify-end gap-2">
                <Button
                  variant="outline"
                  className={tutorBtnOutline}
                  onClick={() => setDialog(null)}
                >
                  Keep waiting
                </Button>
                <Button
                  className={tutorBtnPrimary}
                  onClick={() => {
                    if (!allTutorsReady || !participating) return;
                    setStartOverride(true);
                    setStage("reading");
                    setDialog(null);
                  }}
                >
                  Start reading anyway
                </Button>
              </div>
            </div>
          )}
          {dialog !== "override" && (
            <Button className={tutorBtnPrimary} onClick={() => setDialog(null)}>
              Done
            </Button>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
