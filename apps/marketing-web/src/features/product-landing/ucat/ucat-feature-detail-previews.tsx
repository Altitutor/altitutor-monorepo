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
  Calculator,
  Check,
  ChevronRight,
  Flag,
  Gift,
  Lightbulb,
  Navigation,
  RotateCcw,
  Sparkles,
  Trophy,
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
  return <MarketingSimulatorBleedPreview />;
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

  const shortcut = KEYBOARD_SHORTCUTS[activeIndex]!;

  return (
    <div className="flex min-h-[4.5rem] items-center justify-center px-2">
      <AnimatePresence mode="wait">
        <motion.div
          key={shortcut.label}
          className="flex w-full max-w-md items-center justify-between gap-6"
          initial={animate ? { opacity: 0, y: 10 } : false}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.28, ease: DEMO_EASE }}
        >
          <span className="text-base font-medium text-black/70">{shortcut.label}</span>
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
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

export function MarketingPracticePacePreview({ animate }: { animate: boolean }) {
  return <MarketingPracticeTimingCards animate={animate} />;
}

const STUDY_WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

export function MarketingStudyPlanSetupPreview({ animate }: { animate: boolean }) {
  const [targetScore, setTargetScore] = useState(2350);
  const [selectedDays, setSelectedDays] = useState<readonly string[]>([
    "Mon",
    "Wed",
    "Fri",
    "Sat",
  ]);

  useEffect(() => {
    if (!animate) return;
    const daySets: readonly (readonly string[])[] = [
      ["Mon", "Wed", "Fri", "Sat"],
      ["Mon", "Tue", "Thu", "Sun"],
      ["Wed", "Thu", "Fri", "Sat", "Sun"],
    ];
    const scores = [2350, 2450, 2280];
    let index = 0;
    const id = window.setInterval(() => {
      index = (index + 1) % daySets.length;
      setSelectedDays(daySets[index] ?? daySets[0]);
      setTargetScore(scores[index] ?? scores[0]);
    }, 2800);
    return () => window.clearInterval(id);
  }, [animate]);

  return (
    <div className={clsx(CARD_CHROME, "p-5 sm:p-6")}>
      <div className="flex items-center gap-2">
        {[1, 2, 3].map((step) => (
          <span
            key={step}
            className={clsx(
              "flex size-8 items-center justify-center rounded-full text-sm font-bold",
              step === 2
                ? "bg-[#0a2941] text-white"
                : step < 2
                  ? "bg-[#0a2941]/15 text-[#0a2941]"
                  : "bg-black/[0.06] text-black/35",
            )}
          >
            {step < 2 ? <Check className="size-3.5" /> : step}
          </span>
        ))}
      </div>
      <h4 className="mt-5 text-lg font-semibold tracking-tight">Your destination</h4>
      <p className="mt-1 text-sm text-black/55">
        Set your target score and UCAT test date.
      </p>
      <div className="mt-4">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium text-black/60">Target score</span>
          <span className="font-semibold tabular-nums text-[#0a2941]">
            {targetScore.toLocaleString()}
          </span>
        </div>
        <input
          type="range"
          min={1800}
          max={2700}
          step={50}
          value={targetScore}
          readOnly
          className="pointer-events-none mt-2 w-full accent-[#0a2941]"
          aria-hidden
        />
      </div>
      <div className="mt-6 border-t border-black/[0.06] pt-5">
        <p className="text-sm font-medium text-black/60">Study days</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {STUDY_WEEKDAYS.map((day) => {
            const selected = selectedDays.includes(day);
            return (
              <span
                key={day}
                className={clsx(
                  "rounded-full px-3 py-1.5 text-sm font-semibold transition-colors",
                  selected
                    ? "bg-[#0a2941] text-white"
                    : "bg-[#f6f7f9] text-black/45 ring-1 ring-black/[0.06]",
                )}
              >
                {day}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}

const ORB_SUGGESTIONS = [
  {
    title: "Start with VR inference",
    body: "Your plan recommends the inference module before today’s timed set.",
    icon: BookOpen,
  },
  {
    title: "Review yesterday’s set",
    body: "Three questions are still worth revisiting from your last practice session.",
    icon: RotateCcw,
  },
  {
    title: "Mock 1 in four days",
    body: "Keep today lighter so you arrive fresh for your scheduled mock.",
    icon: Trophy,
  },
] as const;

export function MarketingStudyOrbPreview({ animate }: { animate: boolean }) {
  const [index, setIndex] = useState(0);
  const suggestion = ORB_SUGGESTIONS[index];
  const Icon = suggestion.icon;

  useEffect(() => {
    if (!animate) return;
    const id = window.setInterval(() => {
      setIndex((value) => (value + 1) % ORB_SUGGESTIONS.length);
    }, 3200);
    return () => window.clearInterval(id);
  }, [animate]);

  return (
    <div className="relative overflow-hidden rounded-[1.25rem] bg-[#f4f5f7] p-5 ring-1 ring-black/[0.06]">
      <div className="flex items-start justify-between gap-4">
        <AnimatePresence mode="wait">
          <motion.div
            key={suggestion.title}
            initial={animate ? { opacity: 0, x: 12 } : false}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -12 }}
            transition={{ duration: 0.28, ease: DEMO_EASE }}
            className={clsx(CARD_CHROME, "min-w-0 flex-1 p-4")}
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-black/40">
              Study orb suggests
            </p>
            <p className="mt-2 text-sm font-semibold">{suggestion.title}</p>
            <p className="mt-1 text-sm leading-relaxed text-black/55">{suggestion.body}</p>
          </motion.div>
        </AnimatePresence>
        <div className="relative shrink-0">
          <span className="flex size-14 items-center justify-center rounded-full bg-[#0a2941] text-white shadow-[0_12px_28px_rgba(10,41,65,0.28)]">
            <Sparkles className="size-6" />
          </span>
          <span className="absolute -bottom-1 -right-1 flex size-6 items-center justify-center rounded-full bg-white ring-2 ring-[#f4f5f7]">
            <Icon className="size-3.5 text-[#0a2941]" aria-hidden />
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
    <div className={clsx(CARD_CHROME, "relative overflow-hidden p-5")}>
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
  );
}

const DM_MODULES = [
  { title: "Introduction to Decision Making", minutes: 12, progress: 100 },
  { title: "Syllogisms", minutes: 18, progress: 72 },
  { title: "Logical puzzles", minutes: 22, progress: 40 },
  { title: "Recognising assumptions", minutes: 16, progress: 0 },
  { title: "Interpreting information", minutes: 20, progress: 0 },
] as const;

const REMEDIATION_MODULES = [
  { title: "Syllogism accuracy refresh", minutes: 14, tag: "Gap detected" },
  { title: "Arguments — strong vs weak", minutes: 16, tag: "Recent misses" },
  { title: "Venn diagram basics", minutes: 11, tag: "Scheduled review" },
] as const;

function MarketingModuleDirectoryPreview({
  animate,
  sectionLabel,
  modules,
  highlightRemediation = false,
}: {
  animate: boolean;
  sectionLabel: string;
  modules: readonly { title: string; minutes: number; progress?: number; tag?: string }[];
  highlightRemediation?: boolean;
}) {
  const [scrollIndex, setScrollIndex] = useState(0);

  useEffect(() => {
    if (!animate) return;
    const id = window.setInterval(() => {
      setScrollIndex((value) => (value + 1) % modules.length);
    }, 2400);
    return () => window.clearInterval(id);
  }, [animate, modules.length]);

  return (
    <div className={clsx(CARD_CHROME, "overflow-hidden")}>
      <div className="border-b border-black/[0.06] px-4 py-3">
        <p className="text-xs text-black/45">Learn / {sectionLabel}</p>
        <h4 className="text-base font-semibold">{sectionLabel}</h4>
      </div>
      <div className="relative h-56 overflow-hidden">
        <motion.div
          animate={{ y: -scrollIndex * 72 }}
          transition={{ duration: 0.55, ease: DEMO_EASE }}
          className="divide-y divide-black/[0.05]"
        >
          {modules.map((module) => (
            <div
              key={module.title}
              className="flex items-center gap-3 px-4 py-4"
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
    <MarketingModuleDirectoryPreview
      animate={animate}
      sectionLabel="Decision Making"
      modules={DM_MODULES}
    />
  );
}

export function MarketingLearnRemediationDirectoryPreview({
  animate,
}: {
  animate: boolean;
}) {
  return (
    <MarketingModuleDirectoryPreview
      animate={animate}
      sectionLabel="Remediation"
      modules={REMEDIATION_MODULES}
      highlightRemediation
    />
  );
}

export function MarketingLearnWorkedExamplePreview({ animate }: { animate: boolean }) {
  return (
    <div className={clsx(CARD_CHROME, "p-5")}>
      <span className="rounded-full bg-violet-500/12 px-2.5 py-0.5 text-xs font-semibold text-violet-700">
        Worked example
      </span>
      <h4 className="mt-3 text-lg font-semibold tracking-tight">
        Spot the unsupported leap
      </h4>
      <blockquote className="mt-3 rounded-lg border-l-4 border-[#92b9c6] bg-[#eef0f3] p-3 text-sm leading-relaxed text-black/60">
        A council extended a bus-fare trial rather than making the change permanent,
        citing mixed evidence on which factor drove higher patronage.
      </blockquote>
      <ol className="mt-4 space-y-2">
        {[
          "Quote the exact evidence",
          "State what it proves",
          "Reject options that add new assumptions",
        ].map((step, index) => (
          <motion.li
            key={step}
            className="flex items-start gap-2 rounded-lg bg-violet-500/8 px-3 py-2 text-sm"
            initial={animate ? { opacity: 0, x: -8 } : false}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.08, ease: DEMO_EASE }}
          >
            <span className="text-xs font-bold text-violet-600">{index + 1}</span>
            {step}
          </motion.li>
        ))}
      </ol>
      <div className="mt-4 flex items-start gap-2 rounded-lg bg-[#eef0f3] p-3 text-sm text-black/58">
        <Lightbulb className="mt-0.5 size-4 shrink-0 text-[#0a2941]" aria-hidden />
        The best answer stops where the passage stops.
      </div>
    </div>
  );
}

const GUIDED_STEPS = [
  { label: "Question", target: "stem" as const },
  { label: "Calculator", target: "calculator" as const },
  { label: "Flag", target: "flag" as const },
  { label: "Navigator", target: "navigator" as const },
] as const;

export function MarketingLearnGuidedWalkthroughPreview({
  animate,
}: {
  animate: boolean;
}) {
  const [stepIndex, setStepIndex] = useState(0);
  const step = GUIDED_STEPS[stepIndex];

  useEffect(() => {
    if (!animate) return;
    const id = window.setInterval(() => {
      setStepIndex((value) => (value + 1) % GUIDED_STEPS.length);
    }, 2200);
    return () => window.clearInterval(id);
  }, [animate]);

  return (
    <div className="overflow-hidden rounded-[1.25rem] bg-[#f4f5f7] ring-1 ring-black/[0.06]">
      <div className="border-b border-black/[0.06] bg-[#0a2941] px-4 py-2 text-sm font-medium text-white">
        Quantitative Reasoning · Question 1 of 1
      </div>
      <div className="relative p-4">
        <div
          className={clsx(
            "rounded-lg border border-black/[0.06] bg-white p-4 text-sm leading-relaxed transition-shadow",
            step.target === "stem" && "ring-2 ring-amber-400/80 ring-offset-2",
          )}
        >
          A cinema sold 40 adult tickets at $12 each. What was the total adult revenue?
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {[
            { id: "calculator", icon: Calculator, label: "Calculator" },
            { id: "flag", icon: Flag, label: "Flag" },
            { id: "navigator", icon: Navigation, label: "Navigator" },
          ].map(({ id, icon: Icon, label }) => (
            <span
              key={id}
              className={clsx(
                "inline-flex items-center gap-1 rounded-md border border-black/10 bg-white px-2.5 py-1.5 text-xs font-medium",
                step.target === id && "ring-2 ring-amber-400/80 ring-offset-2",
              )}
            >
              <Icon className="size-3.5" aria-hidden />
              {label}
            </span>
          ))}
        </div>
        <motion.div
          key={step.label}
          initial={animate ? { opacity: 0, y: 8 } : false}
          animate={{ opacity: 1, y: 0 }}
          className="mt-4 rounded-xl border border-amber-400/30 bg-amber-50 px-4 py-3 text-sm"
        >
          <p className="font-semibold text-amber-950">Coach mark</p>
          <p className="mt-1 text-amber-900/80">
            Highlighting {step.label.toLowerCase()} — the same guided sampler flow from onboarding.
          </p>
        </motion.div>
      </div>
    </div>
  );
}

const DISCOUNT_DAYS = [
  { label: "M", earned: true },
  { label: "T", earned: true },
  { label: "W", earned: false, today: true },
  { label: "T", earned: false },
  { label: "F", earned: true },
  { label: "S", earned: false },
  { label: "S", earned: false },
] as const;

export function MarketingPracticeDiscountPreview({ animate }: { animate: boolean }) {
  return (
    <div className={clsx(CARD_CHROME, "p-5")}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">Practice streak</p>
          <p className="mt-1 text-xs text-black/45">Unlimited · weekly billing</p>
        </div>
        <span className="rounded-full bg-[#0a2941]/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-[#0a2941]">
          Unlimited
        </span>
      </div>
      <div className="mt-4 flex items-center justify-between gap-2">
        {DISCOUNT_DAYS.map((day, index) => (
          <div key={`${day.label}-${index}`} className="flex flex-col items-center gap-1.5">
            <span
              className={clsx(
                "flex size-8 items-center justify-center rounded-full text-xs font-semibold",
                day.earned
                  ? "bg-[#0a2941] text-white"
                  : "today" in day && day.today
                    ? "bg-[#0a2941]/30 ring-2 ring-[#0a2941]/50"
                    : "bg-black/[0.06] text-black/35",
              )}
            >
              {day.earned ? <Check className="size-4" /> : day.label}
            </span>
            <span className="text-[10px] text-black/40">{day.label}</span>
          </div>
        ))}
      </div>
      <div className="mt-4 flex items-start gap-2 rounded-xl bg-[#f6f7f9] p-3 text-sm">
        <Gift className="mt-0.5 size-4 shrink-0 text-[#0a2941]" aria-hidden />
        <p className="text-black/65">
          6 more questions today to earn this week&apos;s practice day discount.
        </p>
      </div>
      <motion.p
        className="mt-3 text-xs text-black/45"
        initial={animate ? { opacity: 0 } : false}
        animate={{ opacity: 1 }}
      >
        $4.50 earned in discounts this billing period
      </motion.p>
    </div>
  );
}

const DM_CATEGORIES = [
  { name: "Syllogisms", correct: 42, total: 58, best: true },
  { name: "Logical puzzles", correct: 18, total: 34, worst: false },
  { name: "Recognising assumptions", correct: 11, total: 22, worst: true },
  { name: "Interpreting information", correct: 26, total: 36, best: false },
] as const;

export function MarketingSectionStrengthsPreview({ animate }: { animate: boolean }) {
  return (
    <div className={clsx(CARD_CHROME, "p-5")}>
      <p className="text-sm font-medium text-black/50">Decision Making</p>
      <div className="mt-3 flex items-end justify-between gap-4">
        <div>
          <p className="text-sm text-black/45">Questions correct</p>
          <p className="text-3xl font-bold tabular-nums">97/150</p>
        </div>
        <div className="flex size-12 items-center justify-center rounded-full bg-[#0a2941]/10 text-sm font-bold text-[#0a2941]">
          65%
        </div>
      </div>
      <div className="mt-5 border-t border-black/[0.06] pt-4">
        <p className="text-xs font-medium text-black/45">Category breakdown</p>
        <ul className="mt-3 space-y-2">
          {DM_CATEGORIES.map((category, index) => (
            <motion.li
              key={category.name}
              className="flex items-center justify-between gap-3 text-sm"
              initial={animate ? { opacity: 0, x: -6 } : false}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.06, ease: DEMO_EASE }}
            >
              <span className="flex min-w-0 items-center gap-2 truncate text-black/60">
                {"best" in category && category.best ? (
                  <span className="shrink-0 rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
                    Best
                  </span>
                ) : null}
                {"worst" in category && category.worst ? (
                  <span className="shrink-0 rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
                    Worst
                  </span>
                ) : null}
                {category.name}
              </span>
              <span className="shrink-0 tabular-nums font-medium">
                {category.correct}/{category.total}
              </span>
            </motion.li>
          ))}
        </ul>
      </div>
    </div>
  );
}

const DM_QUESTION = {
  stem: "All managers are planners. Some planners are analysts.",
  prompt: "Can we conclude that some managers are analysts?",
  options: [
    "Yes — the groups must overlap",
    "No — the evidence does not force an overlap",
    "Cannot tell from the information given",
  ],
  correctIndex: 1,
} as const;

export function MarketingReviewExplanationDmPreview({ animate }: { animate: boolean }) {
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
      <div className={clsx(CARD_CHROME, "p-4")}>
        <p className="text-xs font-semibold uppercase tracking-wide text-black/40">
          Decision Making · Q8
        </p>
        <p className="mt-3 text-sm leading-relaxed">{DM_QUESTION.stem}</p>
        <p className="mt-3 text-sm font-medium">{DM_QUESTION.prompt}</p>
        <div className="mt-3 space-y-2">
          {DM_QUESTION.options.map((option, index) => (
            <div
              key={option}
              className={clsx(
                "rounded-lg border px-3 py-2 text-sm",
                index === DM_QUESTION.correctIndex
                  ? "border-[#0a2941]/25 bg-[#0a2941]/5 font-semibold text-[#0a2941]"
                  : "border-black/[0.08] text-black/60",
              )}
            >
              {String.fromCharCode(65 + index)}. {option}
            </div>
          ))}
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
            &ldquo;Some&rdquo; does not guarantee overlap
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-relaxed text-black/65">
            Some planners are analysts, but those analysts might all sit outside the
            manager group. The conclusion adds an overlap the premises do not require.
          </p>
          <div className="mt-4 rounded-xl border border-black/[0.08] bg-[#f6f7f9] p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-black/40">
              Explanation
            </p>
            <p className="mt-2 text-sm leading-relaxed text-black/65">
              The correct answer is B. A valid syllogism cannot infer a relationship
              between managers and analysts from these two statements alone.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

const TIMING_DATA = [
  { q: 1, seconds: 42, result: "correct" as const },
  { q: 2, seconds: 58, result: "correct" as const },
  { q: 3, seconds: 118, result: "incorrect" as const, outlier: true },
  { q: 4, seconds: 51, result: "correct" as const },
  { q: 5, seconds: 47, result: "correct" as const },
];

export function MarketingReviewTimingInteractivePreview({
  animate: _animate,
}: {
  animate: boolean;
}) {
  const [activeIndex, setActiveIndex] = useState<number | null>(2);
  const maxSeconds = 120;
  const active = activeIndex == null ? null : TIMING_DATA[activeIndex];

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
      <div className={clsx(CARD_CHROME, "p-4")}>
        <p className="text-sm font-semibold">Time per question</p>
        <p className="mt-1 text-xs text-black/45">Hover a bar to inspect timing</p>
        <div className="mt-4 flex h-36 items-end gap-2">
          {TIMING_DATA.map((item, index) => (
            <button
              key={item.q}
              type="button"
              className="group flex flex-1 flex-col items-center justify-end gap-2"
              onMouseEnter={() => setActiveIndex(index)}
              onFocus={() => setActiveIndex(index)}
            >
              <span
                className={clsx(
                  "w-full rounded-t-sm transition-all",
                  item.result === "correct" ? "bg-[#92b9c6]" : "bg-[#355d72]",
                  activeIndex === index && "opacity-100 ring-2 ring-[#0a2941]/30",
                  item.outlier && "bg-amber-500",
                )}
                style={{ height: `${(item.seconds / maxSeconds) * 100}%` }}
              />
              <span className="text-[10px] text-black/40">Q{item.q}</span>
            </button>
          ))}
        </div>
      </div>
      <div className={clsx(CARD_CHROME, "p-5")}>
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-black/45">
          <Sparkles className="size-3.5" aria-hidden />
          Timing insight
        </div>
        <h4 className="mt-3 text-lg font-semibold tracking-tight">
          One question dominated your time
        </h4>
        <p className="mt-2 text-sm leading-relaxed text-black/55">
          {active?.outlier
            ? `Question ${active.q} took ${active.seconds}s — more than double your session average.`
            : "Select a bar to see how that question compares with the rest of the set."}
        </p>
        <div className="mt-5 space-y-2 border-t border-black/[0.08] pt-4 text-sm">
          <div className="flex justify-between gap-4">
            <span className="text-black/45">Selected question</span>
            <span className="font-medium tabular-nums">
              {active ? `${active.seconds}s` : "—"}
            </span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-black/45">Session average</span>
            <span className="font-medium tabular-nums">63s</span>
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
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
      <div className="min-h-[14rem] overflow-hidden rounded-[1.25rem] bg-[#f4f5f7] ring-1 ring-black/[0.06]">
        <MarketingProgressCardSnapshot animate={animate} />
      </div>
      <MarketingScoreInsightCard animate={animate} className="h-fit" />
    </div>
  );
}

export {
  MarketingExamCalculator,
  MarketingPracticeSectionCard,
  MarketingStudyPlanCardSnapshot,
} from "./ucat-marketing-faithful-ui";

export { MarketingFindWordTrainerPreview } from "./ucat-find-word-trainer-preview";
