"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import clsx from "clsx";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@altitutor/ui";
import {
  BookOpen,
  BrainCircuit,
  Check,
  ChevronDown,
  ChevronRight,
  Clock3,
  Flame,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { DEMO_EASE } from "./demo-stage";
import {
  MarketingPracticeTimingCards,
  MarketingProgressCardSnapshot,
  MarketingScoreInsightCard,
  MarketingSimulatorBleedPreview,
} from "./ucat-marketing-faithful-ui";

const CARD_CHROME =
  "rounded-[1.25rem] bg-white shadow-sm ring-1 ring-black/[0.055]";

const KEYBOARD_SHORTCUTS = [
  { keys: ["Alt", "N"], label: "Next question" },
  { keys: ["Alt", "C"], label: "Calculator" },
  { keys: ["Alt", "F"], label: "Flag for review" },
  { keys: ["Alt", "V"], label: "Navigator" },
  { keys: ["Alt", "S"], label: "Submit / review" },
] as const;

function KeyCap({ label }: { label: string }) {
  return (
    <span className="inline-flex min-w-[2rem] items-center justify-center rounded-md border border-black/10 bg-[#f6f7f9] px-2 py-1 text-xs font-semibold text-[#0a2941] shadow-[0_1px_0_rgba(0,0,0,0.06)]">
      {label}
    </span>
  );
}

export function MarketingSimulatorDetailPreview() {
  return (
    <div className="mx-auto w-full">
      <MarketingSimulatorBleedPreview className="w-full" />
    </div>
  );
}

const SHORTCUT_ROW_HEIGHT = 52;

function ShortcutRow({
  shortcut,
  emphasis,
}: {
  shortcut: (typeof KEYBOARD_SHORTCUTS)[number];
  emphasis: "center" | "edge";
}) {
  return (
    <div
      className={clsx(
        "flex h-[52px] items-center justify-between gap-6 px-2",
        emphasis === "center"
          ? "text-[#0a2941]"
          : "text-black/40",
      )}
    >
      <span
        className={clsx(
          "font-medium",
          emphasis === "center" ? "text-base" : "text-sm",
        )}
      >
        {shortcut.label}
      </span>
      <span className="flex items-center gap-1.5">
        {shortcut.keys.map((key, keyIndex) => (
          <span key={key} className="flex items-center gap-1.5">
            {keyIndex > 0 ? (
              <span className="text-xs font-semibold text-black/35">+</span>
            ) : null}
            <KeyCap label={key} />
          </span>
        ))}
      </span>
    </div>
  );
}

export function MarketingKeyboardShortcutsPreview({ animate }: { animate: boolean }) {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (!animate) return;
    const id = window.setInterval(() => {
      setActiveIndex((value) => (value + 1) % KEYBOARD_SHORTCUTS.length);
    }, 2200);
    return () => window.clearInterval(id);
  }, [animate]);

  const shortcutCount = KEYBOARD_SHORTCUTS.length;
  const carouselRows = [
    ...KEYBOARD_SHORTCUTS,
    ...KEYBOARD_SHORTCUTS,
    ...KEYBOARD_SHORTCUTS,
  ];
  const centerOffset = shortcutCount;

  return (
    <div className="flex justify-center px-2">
      <div
        className="relative w-full max-w-md overflow-hidden bg-marketing-cream"
        style={{ height: SHORTCUT_ROW_HEIGHT * 3 }}
      >
        <div
          className="pointer-events-none absolute inset-x-0 top-0 z-10 h-14 bg-gradient-to-b from-[#F2F0E9] via-[#F2F0E9]/95 to-transparent"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-14 bg-gradient-to-t from-[#F2F0E9] via-[#F2F0E9]/95 to-transparent"
          aria-hidden
        />
        <motion.div
          animate={{
            y: SHORTCUT_ROW_HEIGHT - (activeIndex + centerOffset) * SHORTCUT_ROW_HEIGHT,
          }}
          transition={{ duration: 0.42, ease: DEMO_EASE }}
        >
          {carouselRows.map((shortcut, index) => {
            const distance = Math.abs(index - (activeIndex + centerOffset));
            return (
              <ShortcutRow
                key={`${shortcut.label}-${index}`}
                shortcut={shortcut}
                emphasis={distance === 0 ? "center" : "edge"}
              />
            );
          })}
        </motion.div>
      </div>
    </div>
  );
}

export function MarketingPracticePacePreview({ animate }: { animate: boolean }) {
  return <MarketingPracticeTimingCards animate={animate} />;
}

const STUDY_SETUP_DAYS = [
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
  { value: 0, label: "Sunday" },
] as const;

const STUDY_SETUP_SURFACE =
  "rounded-2xl bg-white ring-1 ring-black/[0.06]";

function StudySetupToggle({ enabled }: { enabled: boolean }) {
  return (
    <span
      className={clsx(
        "relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors",
        enabled ? "bg-[#0a2941]" : "bg-black/25",
      )}
      aria-hidden
    >
      <span
        className={clsx(
          "absolute top-0.5 size-5 rounded-full bg-white shadow transition-transform",
          enabled ? "left-[22px]" : "left-0.5",
        )}
      />
    </span>
  );
}

const STUDY_DAY_PRESETS = [
  { weekdays: [1, 2, 4, 5, 6] as const, mockWeekday: 6 },
  { weekdays: [1, 3, 4, 5, 0] as const, mockWeekday: 0 },
  { weekdays: [2, 3, 4, 6, 0] as const, mockWeekday: 6 },
] as const;

export function MarketingStudyPlanSetupPreview({ animate }: { animate: boolean }) {
  const [presetIndex, setPresetIndex] = useState(0);
  const preset = STUDY_DAY_PRESETS[presetIndex] ?? STUDY_DAY_PRESETS[0];
  const enabledDays = new Set<number>(preset.weekdays);

  useEffect(() => {
    if (!animate) return;
    const id = window.setInterval(() => {
      setPresetIndex((value) => (value + 1) % STUDY_DAY_PRESETS.length);
    }, 2800);
    return () => window.clearInterval(id);
  }, [animate]);

  return (
    <div className="flex justify-center">
      <div className="w-full max-w-lg">
        <div
          className="mb-6 flex items-center gap-3"
          aria-label="Step 3 of 3"
        >
          {[1, 2, 3].map((step) => {
            const complete = step < 3;
            const active = step === 3;
            return (
              <div key={step} className="flex items-center gap-3">
                <span
                  className={clsx(
                    "flex size-8 items-center justify-center rounded-full text-sm font-bold transition-all",
                    active && "scale-105 bg-[#0a2941] text-white",
                    complete && "bg-[#0a2941]/15 text-[#0a2941]",
                    !active && !complete && "bg-black/[0.06] text-black/35",
                  )}
                >
                  {complete ? <Check className="size-3.5" aria-hidden /> : step}
                </span>
                {step < 3 ? (
                  <span className="h-px w-10 bg-[#0a2941]/40" aria-hidden />
                ) : null}
              </div>
            );
          })}
        </div>

        <div className="mb-5">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#0a2941]">
            Study plan setup · 3 of 3
          </p>
          <h4 className="mt-2 text-2xl font-bold tracking-tight text-[#0a2941]">
            When could you realistically study?
          </h4>
        </div>

        <div className="space-y-3">
          {STUDY_SETUP_DAYS.map((day) => {
            const enabled = enabledDays.has(day.value);
            return (
              <div
                key={day.value}
                className={clsx(
                  STUDY_SETUP_SURFACE,
                  "flex items-center justify-between gap-4 px-4 py-4 sm:px-5",
                )}
              >
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <StudySetupToggle enabled={enabled} />
                  <span className="text-sm text-[#0a2941]">{day.label}</span>
                </div>
                <span className="text-xs text-black/45">
                  {enabled ? "Available" : "Rest day"}
                </span>
              </div>
            );
          })}

          
        </div>
      </div>
    </div>
  );
}

type StudyOrbTaskType = "learn" | "practice" | "review";

function StudyOrbTaskIcon({
  taskType,
  className,
}: {
  taskType: StudyOrbTaskType;
  className?: string;
}) {
  if (taskType === "learn") return <BookOpen className={className} />;
  if (taskType === "review") return <RotateCcw className={className} />;
  return <BrainCircuit className={className} />;
}

const ORB_GUIDANCE_TASKS = [
  {
    eyebrow: "Suggested next step",
    activityTypeLabel: "Learning module",
    title: "Syllogisms: All, Some and None",
    description: "Finish the remaining sections in this module.",
    rationale:
      "Decision Making syllogisms are your highest-value gap before timed practice.",
    estimatedMinutes: 18,
    taskType: "learn" as const,
    completedTasks: 2,
    totalTasks: 5,
  },
  {
    eyebrow: "Carried over",
    activityTypeLabel: "Practice",
    title: "DM syllogisms · untimed",
    description: "Finish the remaining questions.",
    rationale:
      "This incomplete work remains visible until the next replan.",
    estimatedMinutes: 20,
    taskType: "practice" as const,
    completedTasks: 2,
    totalTasks: 5,
  },
  {
    eyebrow: "Suggested next step",
    activityTypeLabel: "Review",
    title: "Review · DM syllogisms · untimed",
    description:
      "Check the questions that need attention and identify the method or timing change to carry forward.",
    rationale:
      "Use review to preserve accuracy while pace increases.",
    estimatedMinutes: 15,
    taskType: "review" as const,
    completedTasks: 3,
    totalTasks: 5,
  },
] as const;

export function MarketingStudyOrbPreview({ animate }: { animate: boolean }) {
  const [index, setIndex] = useState(0);
  const task = ORB_GUIDANCE_TASKS[index] ?? ORB_GUIDANCE_TASKS[0];
  const progressPercent = Math.round((task.completedTasks / task.totalTasks) * 100);

  useEffect(() => {
    if (!animate) return;
    const id = window.setInterval(() => {
      setIndex((value) => (value + 1) % ORB_GUIDANCE_TASKS.length);
    }, 3200);
    return () => window.clearInterval(id);
  }, [animate]);

  return (
    <div className="flex justify-end">
      <div className="relative w-[min(390px,100%)] pb-14">
        <div className="w-full overflow-hidden rounded-2xl border border-black/[0.08] bg-white/95 shadow-[0_18px_55px_rgba(0,0,0,0.18)] ring-1 ring-black/[0.03] backdrop-blur-xl">
          <div className="flex flex-col">
            <div className="flex w-full shrink-0 items-start justify-between gap-4 border-b border-black/[0.06] px-4 py-3.5">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold uppercase tracking-[0.15em] text-[#0a2941]">
                  Suggested next step
                </p>
                <h2 className="mt-0.5 font-semibold">Your Study plan</h2>
                <p className="mt-1 text-xs text-black/45">
                  {task.completedTasks} of {task.totalTasks} tasks complete
                </p>
              </div>
              <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full text-black/45">
                <ChevronDown className="size-4" aria-hidden />
              </span>
            </div>

            <div className="h-1 shrink-0 bg-black/[0.06]">
              <motion.div
                className="h-full rounded-r-full bg-[#0a2941]"
                initial={false}
                animate={{ width: `${progressPercent}%` }}
                transition={{ duration: 0.45, ease: DEMO_EASE }}
              />
            </div>

            <div className="p-3">
              <AnimatePresence mode="wait">
                <motion.div
                  key={task.title}
                  initial={animate ? { opacity: 0, y: 5 } : false}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  transition={{ duration: 0.18, ease: DEMO_EASE }}
                  className="rounded-xl border border-[#0a2941]/20 bg-[#0a2941]/[0.06] p-3.5"
                >
                  <div className="flex items-start gap-3">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#0a2941]/12 text-[#0a2941]">
                      <StudyOrbTaskIcon taskType={task.taskType} className="size-3.5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.13em] text-[#0a2941]">
                        {task.eyebrow} · {task.activityTypeLabel}
                      </p>
                      <p className="mt-1 text-sm font-semibold leading-snug">
                        {task.title}
                      </p>
                      <p className="mt-1 text-sm leading-snug text-black/55">
                        {task.description}
                      </p>
                      <p className="mt-2 flex items-center gap-1 text-xs text-black/45">
                        <Clock3 className="size-3" aria-hidden />
                        About {task.estimatedMinutes} min
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="mt-3 w-full rounded-xl bg-[#0a2941] px-4 py-2 text-sm font-semibold text-white"
                  >
                    Start
                  </button>
                </motion.div>
              </AnimatePresence>
            </div>

            <div className="flex shrink-0 items-center justify-between gap-2 border-t border-black/[0.06] px-3 py-3">
              <button
                type="button"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-black/55"
              >
                <RotateCcw className="size-4" aria-hidden />
                Suggest something else
              </button>
              <button
                type="button"
                className="rounded-lg border border-black/[0.08] px-3 py-1.5 text-sm font-medium"
              >
                Full plan
              </button>
            </div>
          </div>
        </div>

        <div className="absolute bottom-0 right-0 flex h-14 w-14 items-center justify-center overflow-hidden rounded-full border border-black/[0.08] bg-white/95 shadow-[0_18px_55px_rgba(0,0,0,0.18)] ring-1 ring-black/[0.03] backdrop-blur-xl">
          <span className="relative flex size-11 items-center justify-center rounded-full bg-[#0a2941]/10 text-[#0a2941]">
            <Sparkles className="size-5" aria-hidden />
          </span>
        </div>
      </div>
    </div>
  );
}

const STUDY_INSIGHTS = [
  {
    title: "Decision Making is your biggest gap",
    body: "Arguments and syllogisms are scheduled twice this week.",
  },
  {
    title: "Pacing is improving in VR",
    body: "Your last three timed sets were closer to exam pace.",
  },
  {
    title: "Mock readiness rising",
    body: "Section estimates suggest you are ready for a full mock next week.",
  },
] as const;

export function MarketingStudyPlanInsightsPreview({ animate }: { animate: boolean }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!animate) return;
    const id = window.setInterval(() => {
      setIndex((value) => (value + 1) % STUDY_INSIGHTS.length);
    }, 2600);
    return () => window.clearInterval(id);
  }, [animate]);

  return (
    <div className="flex justify-center">
      <div className={clsx(CARD_CHROME, "relative w-full max-w-md overflow-hidden p-5")}>
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-black/45">
          <Sparkles className="size-3.5" aria-hidden />
          Plan insight
        </div>
        <AnimatePresence mode="wait">
          <motion.div
            key={STUDY_INSIGHTS[index].title}
            initial={animate ? { opacity: 0, y: 10 } : false}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.28, ease: DEMO_EASE }}
            className="mt-3"
          >
            <p className="text-base font-semibold tracking-tight">
              {STUDY_INSIGHTS[index].title}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-black/55">
              {STUDY_INSIGHTS[index].body}
            </p>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

const MODULE_ROW_HEIGHT = 72;

const DM_MODULES = [
  { title: "Understanding Decision Making", minutes: 12, progress: 100 },
  { title: "Syllogisms: All, Some and None", minutes: 18, progress: 72 },
  { title: "Grouping, Teams and Seating Constraints", minutes: 22, progress: 40 },
  { title: "Ordering and Positioning Puzzles", minutes: 16, progress: 0 },
  { title: "Strong Arguments: Relevance, Scope and Support", minutes: 20, progress: 0 },
] as const;

const REMEDIATION_MODULES = [
  { title: "Complex and Mixed Syllogisms", minutes: 14, tag: "Gap detected" },
  {
    title: "Grouping, Teams and Seating Constraints",
    minutes: 16,
    tag: "Recent misses",
  },
  {
    title: "Syllogisms: Conditional Language, Negation and Complements",
    minutes: 11,
    tag: "Scheduled review",
  },
] as const;

function MarketingModuleDirectoryPreview({
  animate,
  sectionLabel,
  modules,
  highlightRemediation = false,
  visibleCount = 4,
}: {
  animate: boolean;
  sectionLabel: string;
  modules: readonly {
    title: string;
    minutes: number;
    progress?: number;
    tag?: string;
  }[];
  highlightRemediation?: boolean;
  visibleCount?: number;
}) {
  const [scrollIndex, setScrollIndex] = useState(0);
  const maxScrollIndex = Math.max(0, modules.length - visibleCount);
  const containerHeight =
    Math.min(modules.length, visibleCount) * MODULE_ROW_HEIGHT;

  useEffect(() => {
    if (!animate || maxScrollIndex === 0) return;
    const id = window.setInterval(() => {
      setScrollIndex((value) => (value >= maxScrollIndex ? 0 : value + 1));
    }, 2400);
    return () => window.clearInterval(id);
  }, [animate, maxScrollIndex]);

  return (
    <div
      className={clsx(CARD_CHROME, "overflow-hidden")}
      style={{ height: containerHeight + 57 }}
    >
      <div className="border-b border-black/[0.06] px-4 py-3">
        <p className="text-xs text-black/45">Learn / {sectionLabel}</p>
        <h4 className="text-base font-semibold">{sectionLabel}</h4>
      </div>
      <div
        className="relative overflow-hidden"
        style={{ height: containerHeight }}
      >
        <motion.div
          animate={{ y: -scrollIndex * MODULE_ROW_HEIGHT }}
          transition={{ duration: 0.55, ease: DEMO_EASE }}
          className="divide-y divide-black/[0.05]"
        >
          {modules.map((module) => (
            <div
              key={module.title}
              className="flex items-center gap-3 px-4"
              style={{ height: MODULE_ROW_HEIGHT }}
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#0a2941]/10 text-[#0a2941]">
                <BookOpen className="size-4" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{module.title}</p>
                <p className="mt-0.5 text-xs text-black/45">{module.minutes} min</p>
                {module.tag ? (
                  <span
                    className={clsx(
                      "mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold",
                      highlightRemediation
                        ? "bg-amber-400/15 text-amber-800"
                        : "bg-[#0a2941]/10 text-[#0a2941]",
                    )}
                  >
                    {module.tag}
                  </span>
                ) : null}
              </div>
              {typeof module.progress === "number" ? (
                <div className="w-16 shrink-0">
                  <div className="h-1.5 overflow-hidden rounded-full bg-black/[0.06]">
                    <div
                      className="h-full rounded-full bg-[#0a2941]"
                      style={{ width: `${module.progress}%` }}
                    />
                  </div>
                  <p className="mt-1 text-right text-[10px] tabular-nums text-black/40">
                    {module.progress}%
                  </p>
                </div>
              ) : (
                <ChevronRight className="size-4 shrink-0 text-black/25" aria-hidden />
              )}
            </div>
          ))}
        </motion.div>
      </div>
    </div>
  );
}

export function MarketingLearnSectionDirectoryPreview({
  animate,
}: {
  animate: boolean;
}) {
  return (
    <div className="flex justify-center">
      <div className="w-full max-w-md">
        <MarketingModuleDirectoryPreview
          animate={animate}
          sectionLabel="Decision Making"
          modules={DM_MODULES}
        />
      </div>
    </div>
  );
}

export function MarketingLearnRemediationDirectoryPreview({
  animate,
}: {
  animate: boolean;
}) {
  return (
    <div className="flex justify-center">
      <div className="w-full max-w-md">
        <MarketingModuleDirectoryPreview
          animate={animate}
          sectionLabel="Remediation"
          modules={REMEDIATION_MODULES}
          highlightRemediation
          visibleCount={2}
        />
      </div>
    </div>
  );
}

const WORKED_EXAMPLE_PUZZLE = {
  intro:
    "A circular table has five seats. Leon, Sally, Ashley, Kelvin and Joanna each occupy one seat.",
  rules: [
    "Leon and Sally cannot sit next to each other.",
    "Ashley and Kelvin cannot sit next to each other.",
    "Leon sits next to both Ashley and Joanna.",
  ],
  prompt: "Which of the following statements MUST be true?",
  options: [
    "There are exactly two possible unique configurations for the five individuals to be arranged.",
    "Ashley sits next to Leon and Kelvin.",
    "Sally does not sit next to Kelvin.",
    "Joanna sits next to Leon and Sally.",
  ],
  correctIndex: 0,
} as const;

const WORKED_EXAMPLE_STEPS = [
  {
    title: "Lock Leon between Ashley and Joanna",
    body: "Leon must have Ashley and Joanna on either side. Draw the three seats first.",
    visual: "leon-slot" as const,
  },
  {
    title: "Place Sally and Kelvin in the gaps",
    body: "The remaining two seats are opposite the Leon block. Test both orderings.",
    visual: "full-slot" as const,
  },
  {
    title: "Count the valid arrangements",
    body: "Only two mirror-image configurations work. Rule out options that fail in one layout.",
    visual: "full-slot" as const,
  },
] as const;

function CircularSeatDiagram({ highlight }: { highlight: "leon-slot" | "full-slot" }) {
  const seats = [
    { label: "Ashley", angle: -90 },
    { label: "Leon", angle: -18 },
    { label: "Joanna", angle: 54 },
    { label: "Sally", angle: 126 },
    { label: "Kelvin", angle: 198 },
  ] as const;

  return (
    <div className="relative mx-auto size-36" aria-hidden>
      <div className="absolute inset-4 rounded-full border border-dashed border-[#0a2941]/20" />
      {seats.map((seat) => {
        const radians = (seat.angle * Math.PI) / 180;
        const x = 50 + Math.cos(radians) * 38;
        const y = 50 + Math.sin(radians) * 38;
        const isLeonBlock =
          highlight === "leon-slot"
            ? seat.label === "Leon" ||
              seat.label === "Ashley" ||
              seat.label === "Joanna"
            : true;

        return (
          <div
            key={seat.label}
            className={clsx(
              "absolute flex size-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border text-[10px] font-semibold",
              isLeonBlock
                ? "border-[#0a2941]/30 bg-[#0a2941]/10 text-[#0a2941]"
                : "border-black/[0.08] bg-white text-black/45",
            )}
            style={{ left: `${x}%`, top: `${y}%` }}
          >
            {seat.label.slice(0, 3)}
          </div>
        );
      })}
    </div>
  );
}

export function MarketingLearnWorkedExamplePreview({ animate }: { animate: boolean }) {
  const [stepIndex, setStepIndex] = useState(0);
  const step = WORKED_EXAMPLE_STEPS[stepIndex] ?? WORKED_EXAMPLE_STEPS[0];

  useEffect(() => {
    if (!animate) return;
    const id = window.setInterval(() => {
      setStepIndex((value) => (value + 1) % WORKED_EXAMPLE_STEPS.length);
    }, 3200);
    return () => window.clearInterval(id);
  }, [animate]);

  return (
    <div className="flex justify-center">
      <div className={clsx(CARD_CHROME, "w-full max-w-lg p-5 sm:p-6")}>
        <p className="text-xs font-semibold uppercase tracking-wide text-black/40">
          Logical puzzles · Worked example
        </p>
        <h4 className="mt-2 text-lg font-semibold tracking-tight">
          Circular seating constraints
        </h4>
        <blockquote className="mt-3 rounded-lg border-l-4 border-[#92b9c6] bg-[#eef0f3] p-3 text-sm leading-relaxed text-black/60">
          <p>{WORKED_EXAMPLE_PUZZLE.intro}</p>
          <ul className="mt-2 list-disc space-y-1 pl-4">
            {WORKED_EXAMPLE_PUZZLE.rules.map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
          </ul>
          <p className="mt-3 font-medium text-black/75">
            {WORKED_EXAMPLE_PUZZLE.prompt}
          </p>
          <div className="mt-3 space-y-1.5">
            {WORKED_EXAMPLE_PUZZLE.options.map((option, index) => (
              <p
                key={option}
                className={clsx(
                  index === WORKED_EXAMPLE_PUZZLE.correctIndex &&
                    "font-semibold text-[#0a2941]",
                )}
              >
                {String.fromCharCode(65 + index)}. {option}
              </p>
            ))}
          </div>
        </blockquote>

        <div className="mt-4 space-y-3">
          <CircularSeatDiagram highlight={step.visual} />
          <ol className="space-y-2">
            {WORKED_EXAMPLE_STEPS.map((workedStep, index) => (
              <li
                key={workedStep.title}
                className={clsx(
                  "rounded-lg border px-3 py-2.5 text-sm transition-colors duration-300",
                  index === stepIndex
                    ? "border-[#0a2941]/20 bg-[#0a2941]/[0.05]"
                    : "border-black/[0.06] bg-white text-black/55",
                )}
              >
                <p className="font-semibold text-[#0a2941]">
                  Step {index + 1}. {workedStep.title}
                </p>
                <p className="mt-1 leading-relaxed">{workedStep.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}

export { MarketingLearnGuidedWalkthroughPreview } from "./ucat-guided-walkthrough-preview";

const STREAK_DAYS = [
  { label: "Mon", practiced: true, isToday: false },
  { label: "Tue", practiced: true, isToday: false },
  { label: "Wed", practiced: false, isToday: true },
  { label: "Thu", practiced: false, isToday: false },
  { label: "Fri", practiced: false, isToday: false },
  { label: "Sat", practiced: false, isToday: false },
  { label: "Sun", practiced: false, isToday: false },
] as const;

export function MarketingPracticeDiscountPreview({ animate }: { animate: boolean }) {
  const currentStreak = 3;

  return (
    <div className="flex justify-center">
      <div className={clsx(CARD_CHROME, "w-full max-w-md p-5 sm:p-6")}>
        <div className="flex items-start justify-between gap-3">
          <p className="text-sm font-semibold">Practice streak</p>
          <span className="shrink-0 rounded-full bg-[#0a2941]/10 px-2.5 py-0.5 text-[10px] font-semibold text-[#0a2941]">
            UCAT Unlimited
          </span>
        </div>

        <div className="mt-4 space-y-3">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-xs font-medium text-black/45">Current streak</p>
              <p className="mt-0.5 flex items-center gap-1.5 text-2xl font-semibold tabular-nums tracking-tight">
                <Flame
                  className="size-5 fill-amber-400 text-amber-500"
                  aria-hidden
                />
                {currentStreak} days
              </p>
            </div>
          </div>

          <div
            className="grid grid-cols-7 gap-1.5"
            aria-label="Last 7 practice days"
          >
            {STREAK_DAYS.map((day) => (
              <div key={day.label} className="flex flex-col items-center gap-1.5">
                <span
                  className={clsx(
                    "flex size-8 items-center justify-center rounded-full border text-xs font-semibold",
                    day.practiced
                      ? "border-amber-400 bg-amber-400 text-amber-950 shadow-[0_3px_12px_rgba(251,191,36,0.24)]"
                      : day.isToday
                        ? "border-dashed border-amber-500/70 bg-amber-500/[0.06] text-amber-700"
                        : "border-black/[0.08] bg-black/[0.04] text-black/35",
                  )}
                >
                  {day.practiced ? (
                    <Check className="size-4" aria-hidden />
                  ) : null}
                </span>
                <span
                  className={clsx(
                    "text-[10px] font-medium text-black/40",
                    day.isToday && "text-black/70",
                  )}
                >
                  {day.label.slice(0, 1)}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-5 space-y-2 rounded-xl border border-black/[0.08] bg-black/[0.03] p-3">
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <p className="font-medium">6 more questions to earn today&apos;s discount</p>
            <span className="text-xs tabular-nums text-black/45">12/18</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-black/[0.06]">
            <motion.div
              className="h-full rounded-full bg-[#0a2941]"
              initial={animate ? { width: "0%" } : false}
              animate={{ width: "67%" }}
              transition={{ duration: 0.6, ease: DEMO_EASE }}
            />
          </div>
          <p className="text-xs text-black/45">
            $14 saved this month.
          </p>
        </div>
      </div>
    </div>
  );
}

const DM_SECTION_TOTAL = 3_480;
const DM_COMPLETED = 870;
const DM_CORRECT = 566;
const DM_ACCURACY = Math.round((DM_CORRECT / DM_COMPLETED) * 100);

const DM_CATEGORIES = [
  { name: "Syllogisms", correct: 268, total: 376 },
  { name: "Logical puzzles", correct: 154, total: 274, worst: true },
  { name: "Recognising assumptions", correct: 106, total: 178 },
  { name: "Interpreting information", correct: 38, total: 42, best: true },
] as const;

export function MarketingSectionStrengthsPreview({ animate }: { animate: boolean }) {
  return (
    <div className="flex justify-center">
      <div className={clsx(CARD_CHROME, "w-full max-w-md p-5 sm:p-6")}>
        <p className="text-base font-medium text-black/50">Decision Making</p>
        <div className="mt-4 flex items-end justify-between gap-4">
          <div>
            <p className="text-base font-medium text-black/50">Questions correct</p>
            <p className="mt-1 text-2xl font-bold tabular-nums">
              {DM_CORRECT.toLocaleString()}/{DM_COMPLETED.toLocaleString()}
            </p>
            <p className="mt-1 text-xs text-black/45">
              {DM_COMPLETED.toLocaleString()} of{" "}
              {DM_SECTION_TOTAL.toLocaleString()} questions attempted
            </p>
          </div>
          <div
            className="relative flex size-12 shrink-0 items-center justify-center"
            aria-hidden
          >
            <svg className="size-12 -rotate-90" viewBox="0 0 48 48">
              <circle
                cx="24"
                cy="24"
                r="20"
                fill="none"
                stroke="currentColor"
                strokeWidth="4"
                className="text-black/[0.08]"
              />
              <circle
                cx="24"
                cy="24"
                r="20"
                fill="none"
                stroke="currentColor"
                strokeWidth="4"
                strokeDasharray={`${2 * Math.PI * 20 * (DM_ACCURACY / 100)} ${2 * Math.PI * 20}`}
                className="text-[#0a2941]"
              />
            </svg>
            <span className="absolute text-xs font-bold tabular-nums text-[#0a2941]">
              {DM_ACCURACY}%
            </span>
          </div>
        </div>
        <div className="mt-5 border-t border-black/[0.06] pt-4">
          <p className="text-xs font-medium text-black/45">Category breakdown</p>
          <ul className="mt-3 space-y-2">
            {DM_CATEGORIES.map((category, index) => (
              <motion.li
                key={category.name}
                className="flex items-center justify-between gap-3 text-sm tabular-nums"
                initial={animate ? { opacity: 0, x: -6 } : false}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.06, ease: DEMO_EASE }}
              >
                <span className="flex min-w-0 items-center gap-1.5 truncate text-black/55">
                  {"best" in category && category.best ? (
                    <span className="shrink-0 rounded bg-emerald-500/20 px-1.5 py-0.5 text-xs font-medium text-emerald-700">
                      Best
                    </span>
                  ) : null}
                  {"worst" in category && category.worst ? (
                    <span className="shrink-0 rounded bg-amber-500/20 px-1.5 py-0.5 text-xs font-medium text-amber-700">
                      Worst
                    </span>
                  ) : null}
                  {category.name}
                </span>
                <span className="shrink-0 font-medium">
                  {category.correct}/{category.total}
                </span>
              </motion.li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

const QR_QUESTION = {
  stem:
    "In April, a council's three air-quality monitoring teams collected 3,000 filter samples. Harbour collected 40% of all samples. Hillside collected 25% more samples than Riverside. Before laboratory analysis, 10% of Riverside samples, 5% of Hillside samples and 8% of Harbour samples were rejected. Each remaining sample was analysed at $6.50.",
  prompt: "How many samples did the Riverside team collect?",
  options: ["720", "800", "1,000", "1,200", "1,800"],
  correctIndex: 1,
  selectedIndex: 2,
} as const;

export function MarketingReviewExplanationDmPreview({ animate }: { animate: boolean }) {
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
      <div className={clsx(CARD_CHROME, "p-4")}>
        <p className="text-xs font-semibold uppercase tracking-wide text-black/40">
          Quantitative Reasoning · Q3
        </p>
        <p className="mt-3 text-sm leading-relaxed">{QR_QUESTION.stem}</p>
        <p className="mt-3 text-sm font-medium">{QR_QUESTION.prompt}</p>
        <div className="mt-3 space-y-2">
          {QR_QUESTION.options.map((option, index) => {
            const isCorrect = index === QR_QUESTION.correctIndex;
            const isSelected = index === QR_QUESTION.selectedIndex;
            return (
              <div
                key={option}
                className={clsx(
                  "rounded-lg border px-3 py-2 text-sm",
                  isCorrect
                    ? "border-[#16855b]/40 bg-[#16855b]/[0.06] font-semibold text-[#16855b]"
                    : isSelected
                      ? "border-[#c84444]/35 bg-[#c84444]/[0.05] text-[#c84444]"
                      : "border-black/[0.08] text-black/60",
                )}
              >
                {String.fromCharCode(65 + index)}. {option}
              </div>
            );
          })}
        </div>
      </div>
      <Card
        className={clsx(
          "overflow-hidden border-[#0a2941]/15 bg-gradient-to-br from-[#0a2941]/[0.06] via-white to-white",
          animate && "animate-in fade-in duration-300",
        )}
      >
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-black/45">
            <Sparkles className="size-3.5" aria-hidden />
            Question insight
          </div>
          <CardTitle className="pt-1 text-lg font-semibold tracking-tight">
            Split the total before comparing teams
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-relaxed text-black/65">
            Harbour&apos;s 40% share comes off the 3,000 total first. Only then can
            you set Riverside and Hillside as x and 1.25x.
          </p>
          <div className="mt-4 rounded-xl border border-black/[0.08] bg-[#f6f7f9] p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-black/40">
              Explanation
            </p>
            <p className="mt-2 text-sm leading-relaxed text-black/65">
              Harbour collected 1,200 samples, leaving 1,800 for Riverside and
              Hillside. With Hillside at 1.25x, 2.25x = 1,800, so Riverside
              collected 800 samples.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

const TIMING_DATA = [
  { q: 1, seconds: 48, result: "correct" as const, height: 41 },
  { q: 2, seconds: 52, result: "correct" as const, height: 44 },
  { q: 3, seconds: 118, result: "incorrect" as const, height: 100, outlier: true },
  { q: 4, seconds: 45, result: "correct" as const, height: 38 },
  { q: 5, seconds: 51, result: "correct" as const, height: 43 },
] as const;

const TIMING_SESSION_AVERAGE_SECONDS = 49;
const TIMING_OUTLIER = TIMING_DATA[2];

function formatTimingSeconds(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return mins > 0 ? `${mins}:${String(secs).padStart(2, "0")}` : `${secs}s`;
}

export function MarketingReviewTimingInteractivePreview({
  animate: _animate,
}: {
  animate: boolean;
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
      <div className={clsx(CARD_CHROME, "p-4")}>
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-semibold">Time per question</p>
          <div className="flex items-center gap-3 text-xs text-black/45">
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2.5 rounded-sm bg-[#16855b]" aria-hidden />
              Correct
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2.5 rounded-sm bg-[#c84444]" aria-hidden />
              Incorrect
            </span>
          </div>
        </div>
        <div className="mt-4 flex h-32 items-end gap-1.5">
          {TIMING_DATA.map((item) => (
            <div
              key={item.q}
              className="flex min-w-0 flex-1 flex-col items-center gap-2"
            >
              <div className="relative flex h-28 w-full items-end rounded-sm bg-[#e8eaed] px-0.5 pt-1">
                <span
                  className={clsx(
                    "block w-full rounded-sm",
                    item.result === "correct" ? "bg-[#16855b]" : "bg-[#c84444]",
                  )}
                  style={{ height: item.height }}
                />
              </div>
              <span className="text-[10px] text-black/40">Q{item.q}</span>
            </div>
          ))}
        </div>
      </div>
      <div className={clsx(CARD_CHROME, "p-5")}>
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-black/45">
          <Sparkles className="size-3.5" aria-hidden />
          Timing insight
        </div>
        <h4 className="mt-3 text-lg font-semibold tracking-tight">
          Too long on a question you missed
        </h4>
        <p className="mt-2 text-sm leading-relaxed text-black/55">
          Question {TIMING_OUTLIER.q} took{" "}
          {formatTimingSeconds(TIMING_OUTLIER.seconds)} — more than double your
          set average — and you answered incorrectly. When you&apos;re unsure,
          it&apos;s better to flag and move on rather than wasting more time.
        </p>
        <a
          href="#"
          className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-[#0a2941] underline-offset-4 hover:underline"
          onClick={(event) => event.preventDefault()}
        >
          Review percentage-change method
          <ChevronRight className="size-4" aria-hidden />
        </a>
        <div className="mt-5 space-y-2 border-t border-black/[0.08] pt-4 text-sm">
          <div className="flex justify-between gap-4">
            <span className="text-black/45">Question {TIMING_OUTLIER.q}</span>
            <span className="font-medium tabular-nums">
              {formatTimingSeconds(TIMING_OUTLIER.seconds)}
            </span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-black/45">Set average</span>
            <span className="font-medium tabular-nums">
              {formatTimingSeconds(TIMING_SESSION_AVERAGE_SECONDS)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function MarketingProgressScoreTrackingPreview({
  animate,
}: {
  animate: boolean;
}) {
  return <MarketingProgressCardSnapshot animate={animate} />;
}

export function MarketingProgressScoreInsightPreview({
  animate,
}: {
  animate: boolean;
}) {
  return (
    <div className="flex justify-center">
      <MarketingScoreInsightCard
        animate={animate}
        className="h-fit w-full max-w-md"
      />
    </div>
  );
}

export {
  MarketingExamCalculator,
  MarketingPracticeSectionCard,
  MarketingStudyPlanCardSnapshot,
} from "./ucat-marketing-faithful-ui";

export { MarketingFindWordTrainerPreview } from "./ucat-find-word-trainer-preview";
