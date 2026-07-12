"use client";

import { MARKETING_TOKENS } from "@altitutor/shared";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  BookOpen,
  BrainCircuit,
  Calculator,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Flag,
  Flame,
  Layers3,
  Lightbulb,
  LineChart,
  ListChecks,
  LockKeyhole,
  Mic,
  MousePointer2,
  Navigation,
  Play,
  Send,
  Sparkles,
  Target,
  TimerReset,
  Trophy,
  Video,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
  type RefObject,
} from "react";
import {
  ProtocolFeatureDetailBackdrop,
  ProtocolFeatureDetailContent,
  type ProtocolFeatureKey,
  type ProtocolFeatureOrigin,
} from "./ucat-protocol-detail-overlay";

gsap.registerPlugin(ScrollTrigger);

const { typography: typo } = MARKETING_TOKENS;

type ShowcaseCardProps = {
  index: string;
  eyebrow: string;
  title: string;
  description: string;
  detail: string;
  icon: ReactNode;
  theme: "light" | "accent" | "blue" | "dark";
  reverse?: boolean;
  demo: ProtocolFeatureKey;
  flushDemo?: boolean;
  onLearnMore: (event: MouseEvent<HTMLButtonElement>) => void;
  expanded: boolean;
  expandedPlaceholderHeight?: number;
  closeButtonRef: RefObject<HTMLButtonElement>;
  onCloseDetail: () => void;
  children: ReactNode;
};

const themeClasses = {
  light: {
    card: "border-black/5 bg-white text-marketing-charcoal",
    icon: "text-marketing-primary",
    eyebrow: "text-marketing-primary",
    description: "text-marketing-charcoal/72",
    detail: "border-black/10 text-marketing-charcoal/50",
    demo: "border-marketing-primary/10 bg-marketing-cream text-marketing-charcoal",
  },
  accent: {
    card: "border-marketing-primary/10 bg-marketing-accent text-marketing-charcoal",
    icon: "text-marketing-primary",
    eyebrow: "text-marketing-primary",
    description: "text-marketing-charcoal/72",
    detail: "border-marketing-primary/15 text-marketing-charcoal/52",
    demo: "border-marketing-primary/10 bg-marketing-cream text-marketing-charcoal",
  },
  blue: {
    card: "border-white/10 bg-marketing-primary text-marketing-cream",
    icon: "text-marketing-accent",
    eyebrow: "text-marketing-accent",
    description: "text-marketing-cream/78",
    detail: "border-white/15 text-marketing-cream/55",
    demo: "border-white/15 bg-marketing-cream text-marketing-charcoal",
  },
  dark: {
    card: "border-white/10 bg-marketing-charcoal text-marketing-cream",
    icon: "text-marketing-accent",
    eyebrow: "text-marketing-accent",
    description: "text-marketing-cream/72",
    detail: "border-white/15 text-marketing-cream/50",
    demo: "border-white/15 bg-marketing-cream text-marketing-charcoal",
  },
} as const;

function ShowcaseCard({
  index,
  eyebrow,
  title,
  description,
  detail,
  icon,
  theme,
  reverse = false,
  demo,
  flushDemo = false,
  onLearnMore,
  expanded,
  expandedPlaceholderHeight,
  closeButtonRef,
  onCloseDetail,
  children,
}: ShowcaseCardProps) {
  const classes = themeClasses[theme];

  return (
    <>
      <article
        data-protocol-slot
        data-protocol-card
        data-demo={demo}
        data-stack-index={index}
        className={`relative isolate mb-20 h-auto min-h-[640px] w-full origin-top overflow-hidden rounded-[2rem] border shadow-[0_24px_80px_rgba(10,41,65,0.1)] [transform-style:preserve-3d] last:mb-0 sm:mb-24 lg:sticky lg:top-[max(6rem,calc(50dvh-17.25rem))] lg:mb-[30vh] lg:h-[640px] lg:min-h-[640px] lg:rounded-[3rem] ${classes.card}`}
        style={{ zIndex: Number(index) }}
      >
        <div
          data-protocol-card-front
          aria-hidden={expanded || undefined}
          className="relative h-full min-h-[640px] p-7 [backface-visibility:hidden] sm:p-11 lg:p-16"
        >
          <div
            aria-hidden
            className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-marketing-accent/10 blur-3xl"
          />
          <div
            data-protocol-card-content
            className={`relative grid h-full items-center gap-14 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-20 ${reverse ? "lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]" : ""}`}
          >
            <div className={reverse ? "lg:order-2" : ""}>
              <div className="flex items-center gap-3">
                <span className={classes.icon}>{icon}</span>
                <span
                  className={`text-[11px] font-bold uppercase tracking-[0.18em] ${classes.eyebrow} ${typo.dataMono}`}
                >
                  {index} / {eyebrow}
                </span>
              </div>
              <h3
                className={`mt-8 text-3xl font-bold tracking-[-0.04em] sm:text-4xl lg:text-[2.75rem] lg:leading-[1.08] ${typo.headingSans}`}
              >
                {title}
              </h3>
              <p
                className={`mt-5 max-w-xl text-[15px] leading-7 sm:text-base ${classes.description} ${typo.secondarySans}`}
              >
                {description}
              </p>
              <p
                className={`mt-8 flex max-w-xl items-start gap-3 border-t pt-6 text-[13px] leading-6 ${classes.detail} ${typo.secondarySans}`}
              >
                <Sparkles className="mt-0.5 h-4 w-4 shrink-0" />
                {detail}
              </p>
              <button
                type="button"
                onClick={onLearnMore}
                className={`mt-8 inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition-transform hover:scale-[1.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-marketing-accent ${theme === "light" || theme === "accent" ? "border-marketing-primary/20 text-marketing-primary" : "border-marketing-cream/25 text-marketing-cream"} ${typo.secondarySans}`}
              >
                Learn more <ArrowUpRight className="h-4 w-4" />
              </button>
            </div>

            <div
              aria-hidden="true"
              className={`relative min-w-0 overflow-hidden rounded-[1.5rem] border shadow-[0_20px_55px_rgba(10,41,65,0.14)] sm:rounded-[2rem] ${classes.demo} ${reverse ? "lg:order-1" : ""}`}
            >
              {flushDemo ? null : (
                <div className="flex h-9 items-center gap-2 border-b border-marketing-primary/10 bg-white px-4">
                  <span className="h-2 w-2 rounded-full bg-marketing-accent" />
                  <span className="text-[9px] font-semibold uppercase tracking-[0.16em] text-marketing-primary/45">
                    Alti UCAT
                  </span>
                </div>
              )}
              <div className="min-h-[310px] sm:min-h-[360px]">{children}</div>
            </div>
          </div>
        </div>
        {expanded ? (
          <ProtocolFeatureDetailContent
            feature={demo}
            closeButtonRef={closeButtonRef}
            onDismiss={onCloseDetail}
          />
        ) : null}
      </article>
      {expanded ? (
        <div
          data-protocol-placeholder={demo}
          aria-hidden="true"
          className="mb-20 w-full sm:mb-24 lg:mb-[30vh] lg:h-[640px]"
          style={{ height: expandedPlaceholderHeight }}
        />
      ) : null}
    </>
  );
}

function LearningDemo() {
  return (
    <div className="grid min-h-[310px] grid-cols-[52px_1fr] bg-slate-50 sm:min-h-[360px] sm:grid-cols-[118px_1fr]">
      <div className="border-r border-slate-200 bg-white px-2 py-4 sm:px-3">
        <div className="mb-5 flex items-center gap-2 px-1">
          <BookOpen className="h-4 w-4 text-marketing-primary" />
          <span className="hidden text-[11px] font-bold text-slate-700 sm:block">
            Learn
          </span>
        </div>
        {[
          "Overview",
          "Verbal Reasoning",
          "Decision Making",
          "Quantitative Reasoning",
          "Situational Judgement",
        ].map((label, index) => (
          <div
            key={label}
            className={`mb-1 rounded-lg px-2 py-2 text-[9px] font-medium ${
              index === 1
                ? "bg-marketing-accent/15 text-marketing-primary"
                : "text-slate-400"
            }`}
          >
            <span className="hidden text-[7px] leading-tight sm:inline">
              {label}
            </span>
            <span className="mx-auto block h-1.5 w-1.5 rounded-full bg-current sm:hidden" />
          </div>
        ))}
      </div>
      <div className="min-w-0 p-4 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-marketing-primary">
              Verbal Reasoning
            </p>
            <h4 className="mt-1 text-base font-bold text-slate-900 sm:text-lg">
              Reading critically
            </h4>
          </div>
          <span className="hidden rounded-full bg-marketing-accent/15 px-2.5 py-1 text-[9px] font-semibold text-marketing-primary sm:block">
            Lesson 3
          </span>
        </div>
        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-slate-200">
          <div
            data-learning-progress
            className="h-full w-[68%] origin-left rounded-full bg-marketing-primary"
          />
        </div>
        <div className="mt-5 space-y-2.5">
          {[
            ["How the subtest works", true],
            ["Finding the author’s position", true],
            ["Reading for inference", true],
            ["Handling qualifying language", false],
          ].map(([label, done], index) => (
            <div
              data-learning-row
              key={String(label)}
              className={`flex items-center gap-3 rounded-xl border bg-white p-3 shadow-sm ${
                index === 3
                  ? "border-marketing-accent/40 ring-2 ring-marketing-accent/25"
                  : "border-slate-200"
              }`}
            >
              <span
                data-learning-check={done ? "done" : undefined}
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                  done
                    ? "bg-marketing-accent/25 text-marketing-primary"
                    : "bg-marketing-primary text-white"
                }`}
              >
                {done ? (
                  <Check className="h-3.5 w-3.5" />
                ) : (
                  <Play className="ml-0.5 h-3 w-3 fill-current" />
                )}
              </span>
              <span className="min-w-0 flex-1 truncate text-[10px] font-semibold text-slate-700 sm:text-xs">
                {label}
              </span>
              {index === 3 ? (
                <span className="text-[9px] font-bold text-marketing-primary">
                  Continue
                </span>
              ) : (
                <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SkillTrainerDemo() {
  return (
    <div className="relative min-h-[310px] bg-marketing-cream p-4 text-marketing-charcoal sm:min-h-[360px] sm:p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BrainCircuit className="h-4 w-4 text-marketing-primary" />
          <div>
            <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-marketing-primary">
              Skill trainer
            </p>
            <p className="text-xs font-semibold text-marketing-charcoal">
              Quick syllogisms
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 rounded-full bg-marketing-primary/5 px-3 py-1.5 text-[10px] font-bold">
          <Clock3 className="h-3 w-3 text-marketing-primary" /> 00:42
        </div>
      </div>
      <div className="mt-5 grid grid-cols-3 gap-2">
        <div className="rounded-xl border border-marketing-primary/10 bg-white p-3">
          <p className="text-[8px] uppercase tracking-wider text-marketing-charcoal/40">
            Score
          </p>
          <p data-skill-score className="mt-1 text-lg font-bold tabular-nums">
            7
          </p>
        </div>
        <div className="rounded-xl border border-marketing-accent/40 bg-marketing-accent/20 p-3">
          <p className="text-[8px] uppercase tracking-wider text-marketing-primary/60">
            Streak
          </p>
          <p className="mt-1 flex items-center gap-1 text-lg font-bold text-marketing-primary">
            <Flame className="h-4 w-4 fill-current" /> 4
          </p>
        </div>
        <div className="rounded-xl border border-marketing-primary/10 bg-white p-3">
          <p className="text-[8px] uppercase tracking-wider text-marketing-charcoal/40">
            Best
          </p>
          <p className="mt-1 flex items-center gap-1 text-lg font-bold">
            <Trophy className="h-3.5 w-3.5 text-marketing-primary" /> 18
          </p>
        </div>
      </div>
      <div
        data-skill-question
        className="mt-4 rounded-2xl border border-marketing-primary/10 bg-white p-4"
      >
        <p className="text-[10px] leading-relaxed text-marketing-charcoal/60">
          All surgeons are doctors. No doctors are architects.
        </p>
        <p className="mt-2 text-xs font-semibold">
          No surgeons are architects.
        </p>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            data-skill-answer="correct"
            type="button"
            tabIndex={-1}
            className="rounded-xl border border-marketing-primary/15 bg-marketing-cream py-2.5 text-[10px] font-bold"
          >
            Yes
          </button>
          <button
            data-skill-answer="other"
            type="button"
            tabIndex={-1}
            className="rounded-xl border border-marketing-primary/15 bg-marketing-cream py-2.5 text-[10px] font-bold"
          >
            No
          </button>
        </div>
      </div>
      <div
        data-skill-toast
        className="pointer-events-none absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full bg-marketing-primary px-4 py-2 text-[10px] font-bold text-marketing-cream opacity-0 shadow-xl"
      >
        <CheckCircle2 className="h-3.5 w-3.5" /> Correct · +1
      </div>
    </div>
  );
}

const practiceSections = [
  "Verbal Reasoning",
  "Decision Making",
  "Quantitative Reasoning",
  "Situational Judgement",
];

function PracticeDemo() {
  return (
    <div className="min-h-[310px] bg-slate-50 p-4 sm:min-h-[360px] sm:p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-marketing-primary">
            Practice
          </p>
          <h4 className="mt-1 text-sm font-bold text-slate-900 sm:text-base">
            Choose a section
          </h4>
        </div>
        <span className="rounded-full bg-white px-2.5 py-1 text-[9px] font-semibold text-slate-500 shadow-sm">
          Step 1 of 4
        </span>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        {practiceSections.map((section, index) => (
          <div
            data-practice-section
            key={section}
            className={`rounded-xl border bg-white p-3 ${index === 1 ? "border-marketing-accent ring-2 ring-marketing-accent/25" : "border-slate-200"}`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-semibold text-slate-700 sm:text-xs">
                {section}
              </span>
              <span
                className={`h-3.5 w-3.5 rounded-full border ${index === 1 ? "border-[4px] border-marketing-primary" : "border-slate-300"}`}
              />
            </div>
          </div>
        ))}
      </div>
      <div
        data-practice-config
        className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
      >
        <div className="flex items-center justify-between text-[10px]">
          <span className="font-semibold text-slate-700">Session length</span>
          <span className="font-bold text-marketing-primary">20 questions</span>
        </div>
        <div className="mt-3 h-1.5 rounded-full bg-slate-200">
          <div
            data-practice-slider
            className="relative h-full w-[58%] rounded-full bg-marketing-primary"
          >
            <span className="absolute right-0 top-1/2 h-3.5 w-3.5 -translate-y-1/2 translate-x-1/2 rounded-full border-2 border-white bg-marketing-primary shadow" />
          </div>
        </div>
        <div className="mt-4 flex items-center justify-between rounded-xl bg-slate-50 p-3">
          <span className="flex items-center gap-2 text-[10px] font-semibold text-slate-600">
            <TimerReset className="h-3.5 w-3.5 text-marketing-primary" /> Exam
            pace
          </span>
          <span className="rounded-md bg-marketing-accent/25 px-2 py-1 text-[9px] font-bold text-marketing-primary">
            60 sec / question
          </span>
        </div>
      </div>
      <div className="mt-4 flex justify-end">
        <div
          data-practice-start
          className="flex items-center gap-2 rounded-xl bg-marketing-primary px-4 py-2.5 text-[10px] font-bold text-white shadow-lg shadow-marketing-accent/40"
        >
          Review setup <ArrowUpRight className="h-3.5 w-3.5" />
        </div>
      </div>
      <MousePointer2
        data-practice-cursor
        className="pointer-events-none absolute h-5 w-5 fill-white text-slate-900 drop-shadow-md"
      />
    </div>
  );
}

const setRows = [
  ["Verbal Reasoning Set 04", "Reading comprehension", "12 questions"],
  ["Verbal Reasoning Set 05", "Author opinion", "16 questions"],
  ["Verbal Reasoning Set 06", "Inference", "14 questions"],
];

function SetsDemo() {
  return (
    <div className="min-h-[310px] bg-white p-4 sm:min-h-[360px] sm:p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-marketing-primary">
            Verbal Reasoning
          </p>
          <h4 className="mt-1 text-sm font-bold text-slate-900 sm:text-base">
            Question sets
          </h4>
        </div>
        <span className="flex items-center gap-1 rounded-lg bg-marketing-accent/15 px-2.5 py-1.5 text-[9px] font-bold text-marketing-primary">
          <Layers3 className="h-3 w-3" /> 18 sets
        </span>
      </div>
      <div className="mt-5 space-y-2.5">
        {setRows.map(([title, category, count], index) => (
          <div
            data-set-row
            key={title}
            className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3"
          >
            <div
              className={
                index === 0 ? "text-marketing-primary" : "text-slate-400"
              }
            >
              {index === 0 ? (
                <Play className="ml-0.5 h-3.5 w-3.5 fill-current" />
              ) : index === 2 ? (
                <LockKeyhole className="h-3.5 w-3.5" />
              ) : (
                <ListChecks className="h-3.5 w-3.5" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold text-slate-800 sm:text-xs">
                {title}
              </p>
              <p className="truncate text-[8px] text-slate-400 sm:text-[9px]">
                {category} · {count}
              </p>
              {index === 0 ? (
                <div className="mt-2 h-1 overflow-hidden rounded-full bg-slate-200">
                  <div
                    data-set-progress
                    className="h-full w-[42%] origin-left rounded-full bg-marketing-primary"
                  />
                </div>
              ) : null}
            </div>
            <ChevronRight className="h-4 w-4 text-slate-300" />
          </div>
        ))}
      </div>
      <div
        data-set-generator
        className="mt-3 flex items-center justify-between rounded-xl border border-dashed border-marketing-accent bg-marketing-accent/15 p-3"
      >
        <div className="flex items-center gap-2.5">
          <span className="rounded-lg bg-white p-2 text-marketing-primary shadow-sm">
            <Sparkles className="h-3.5 w-3.5" />
          </span>
          <div>
            <p className="text-[10px] font-bold text-slate-800">
              Build a custom set
            </p>
            <p className="text-[8px] text-slate-500">
              Target unanswered or incorrect questions
            </p>
          </div>
        </div>
        <ArrowUpRight className="h-4 w-4 text-marketing-primary" />
      </div>
    </div>
  );
}

function MocksDemo() {
  return (
    <div className="relative flex min-h-[310px] flex-col overflow-hidden bg-white font-[Arial,sans-serif] sm:min-h-[360px]">
      <div className="flex h-11 shrink-0 items-center justify-between bg-[#0b6ca2] px-3 text-white">
        <span className="text-[9px] font-bold sm:text-[11px]">
          Verbal Reasoning
        </span>
        <div className="text-right text-[7px] leading-tight sm:text-[9px]">
          <div>
            Time Remaining <span data-mock-timer>20:14</span>
          </div>
          <div>
            Question <span data-mock-question-number>7</span> of 44
          </div>
        </div>
      </div>

      <div className="flex h-7 shrink-0 items-center justify-between border-b border-[#3f6fb2] bg-[#4f7ec1] px-3 text-[7px] text-white sm:text-[9px]">
        <span className="flex items-center gap-1">
          <Calculator className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
          <span>
            <u>C</u>alculator
          </span>
        </span>
        <span className="flex items-center gap-1">
          <Flag className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
          <span>
            <u>F</u>lag for Review
          </span>
        </span>
      </div>

      <div className="relative min-h-[232px] flex-1 overflow-hidden bg-white sm:min-h-[282px]">
        <div
          data-mock-screen="one"
          className="absolute inset-0 grid grid-cols-[0.88fr_1.12fr] divide-x divide-slate-300"
        >
          <div className="bg-slate-50 p-3 sm:p-4">
            <p className="text-[7px] font-bold text-slate-800 sm:text-[8px]">
              Scientific reporting
            </p>
            <p className="mt-2 text-[6px] leading-[1.55] text-slate-600 sm:text-[7px]">
              Independent review allows researchers to test whether results can
              be repeated. Transparency about uncertainty is central to public
              trust in new findings.
            </p>
          </div>
          <div className="p-3 sm:p-4">
            <p className="text-[7px] font-semibold leading-relaxed text-slate-800 sm:text-[8px]">
              The passage suggests that public confidence is most likely to
              improve when...
            </p>
            <div className="mt-2 space-y-1.5">
              {[
                "results are independently verified",
                "research is completed rapidly",
                "all uncertainty is removed",
                "findings are never revised",
              ].map((answer, index) => (
                <div
                  data-mock-answer="one"
                  data-answer-index={index}
                  key={answer}
                  className="flex items-start gap-2 border border-slate-300 bg-white p-1.5"
                >
                  <span className="mt-px flex h-3 w-3 shrink-0 items-center justify-center rounded-full border border-slate-400 text-white">
                    {index === 0 ? <Check className="h-2 w-2" /> : null}
                  </span>
                  <span className="text-[6px] leading-snug text-slate-700 sm:text-[7px]">
                    {answer}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div
          data-mock-screen="two"
          className="absolute inset-0 grid grid-cols-[0.88fr_1.12fr] divide-x divide-slate-300 opacity-0"
        >
          <div className="bg-slate-50 p-3 sm:p-4">
            <p className="text-[7px] font-bold text-slate-800 sm:text-[8px]">
              Scientific reporting
            </p>
            <p className="mt-2 text-[6px] leading-[1.55] text-slate-600 sm:text-[7px]">
              Replication can strengthen confidence, while transparent
              limitations help readers judge how widely a result should be
              applied.
            </p>
          </div>
          <div className="p-3 sm:p-4">
            <p className="text-[7px] font-semibold leading-relaxed text-slate-800 sm:text-[8px]">
              Which statement is best supported by the passage?
            </p>
            <div className="mt-2 space-y-1.5">
              {[
                "limitations should always invalidate a study",
                "replication can increase confidence in a finding",
                "all studies must produce identical results",
                "public reporting should exclude uncertainty",
              ].map((answer, index) => (
                <div
                  data-mock-answer="two"
                  data-answer-index={index}
                  key={answer}
                  className="flex items-start gap-2 border border-slate-300 bg-white p-1.5"
                >
                  <span className="mt-px flex h-3 w-3 shrink-0 items-center justify-center rounded-full border border-slate-400 text-white">
                    {index === 1 ? <Check className="h-2 w-2" /> : null}
                  </span>
                  <span className="text-[6px] leading-snug text-slate-700 sm:text-[7px]">
                    {answer}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="flex h-10 shrink-0 items-stretch justify-between bg-[#0b6ca2] text-white">
        <span className="flex h-full items-center gap-1 border-r border-white/45 px-3 text-[7px] sm:text-[8px]">
          <ArrowLeft className="h-2.5 w-2.5" />
          <span>
            <u>P</u>revious
          </span>
        </span>
        <div className="flex h-full items-stretch">
          <span className="flex h-full items-center gap-1 border-l border-white/45 px-3 text-[7px] sm:text-[8px]">
            <Navigation className="h-2.5 w-2.5" />
            <span>
              Na<u>v</u>igator
            </span>
          </span>
          <span
            data-mock-next
            className="flex h-full items-center gap-1 border-l border-white/45 bg-[#4f7ec1] px-3 text-[7px] font-bold sm:text-[8px]"
          >
            <span>
              <u>N</u>ext
            </span>
            <ArrowRight className="h-2.5 w-2.5" />
          </span>
        </div>
      </div>
    </div>
  );
}

function LiveSessionDemo() {
  return (
    <div className="grid min-h-[310px] grid-cols-[1.08fr_0.92fr] bg-marketing-cream sm:min-h-[360px]">
      <div className="relative overflow-hidden bg-marketing-primary p-3 text-marketing-cream sm:p-5">
        <div className="flex items-center justify-between">
          <span className="text-[8px] font-bold uppercase tracking-[0.14em] text-marketing-accent sm:text-[9px]">
            Live tutorial
          </span>
          <span className="flex items-center gap-1.5 rounded-full bg-white/10 px-2 py-1 text-[7px] font-bold sm:text-[8px]">
            <span
              data-live-pulse
              className="h-1.5 w-1.5 rounded-full bg-marketing-accent"
            />
            Live
          </span>
        </div>

        <div className="mt-3 flex h-[190px] items-center justify-center rounded-xl border border-white/10 bg-white/[0.06] sm:h-[224px]">
          <div className="text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-marketing-accent text-lg font-bold text-marketing-charcoal sm:h-16 sm:w-16">
              JT
            </div>
            <p className="mt-2 text-[9px] font-semibold sm:text-[10px]">
              James · UCAT tutor
            </p>
            <p className="mt-0.5 text-[7px] text-marketing-cream/50">
              Explaining inference
            </p>
          </div>
          <div className="absolute bottom-12 right-3 flex h-16 w-20 items-center justify-center rounded-lg border-2 border-marketing-accent bg-marketing-charcoal text-[8px] font-semibold shadow-lg sm:bottom-14 sm:right-5 sm:h-20 sm:w-24">
            You
          </div>
        </div>

        <div className="mt-3 flex items-center justify-center gap-2">
          <span className="rounded-full bg-white/10 p-2">
            <Mic className="h-3 w-3" />
          </span>
          <span className="rounded-full bg-marketing-accent p-2 text-marketing-charcoal">
            <Video className="h-3 w-3" />
          </span>
        </div>
      </div>

      <div className="min-w-0 bg-white p-3 sm:p-5">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-[8px] font-bold uppercase tracking-[0.12em] text-marketing-primary">
              Session controls
            </p>
            <p className="mt-1 text-[9px] font-semibold text-marketing-charcoal sm:text-[10px]">
              Tutor workspace
            </p>
          </div>
          <span className="rounded-full bg-marketing-accent/20 px-2 py-1 text-[7px] font-bold text-marketing-primary">
            Coming soon
          </span>
        </div>

        <div
          data-live-question
          className="mt-4 rounded-xl border border-marketing-primary/10 bg-marketing-cream p-3"
        >
          <div className="flex items-center gap-2 text-[8px] font-bold text-marketing-charcoal">
            <Send className="h-3 w-3 text-marketing-primary" /> Send a question
          </div>
          <p className="mt-2 text-[7px] leading-relaxed text-marketing-charcoal/55">
            Verbal Reasoning · Author opinion · 60 sec
          </p>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-marketing-primary/10">
            <div
              data-live-response
              className="h-full w-[74%] origin-left rounded-full bg-marketing-accent"
            />
          </div>
        </div>

        <div
          data-live-insight
          className="mt-3 rounded-xl border border-marketing-accent/40 bg-marketing-accent/15 p-3"
        >
          <div className="flex items-center gap-2 text-[8px] font-bold text-marketing-primary">
            <Lightbulb className="h-3 w-3" /> Live insight
          </div>
          <p className="mt-2 text-[7px] leading-relaxed text-marketing-charcoal/60">
            Strong accuracy. Recommend a faster first pass before returning to
            qualifiers.
          </p>
        </div>
      </div>
    </div>
  );
}

function ProgressDemo() {
  return (
    <div className="min-h-[310px] bg-slate-50 p-4 sm:min-h-[360px] sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-marketing-primary">
            Score projection
          </p>
          <h4 className="mt-1 text-sm font-bold text-slate-900 sm:text-base">
            Your UCAT trajectory
          </h4>
        </div>
        <div className="text-right">
          <p
            data-progress-score
            className="text-xl font-bold tabular-nums text-slate-900 sm:text-2xl"
          >
            2310
          </p>
          <p className="text-[8px] font-semibold text-marketing-primary">
            High confidence ± 40
          </p>
        </div>
      </div>
      <div className="relative mt-5 h-36 overflow-hidden rounded-xl border border-slate-200 bg-white p-3 sm:h-40">
        <div className="absolute inset-x-3 top-1/4 border-t border-dashed border-slate-200" />
        <div className="absolute inset-x-3 top-2/4 border-t border-dashed border-slate-200" />
        <div className="absolute inset-x-3 top-3/4 border-t border-dashed border-slate-200" />
        <svg
          className="relative h-full w-full overflow-visible"
          viewBox="0 0 420 130"
          preserveAspectRatio="none"
          aria-label="Projected UCAT score rising over time"
        >
          <defs>
            <linearGradient id="progress-area" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#92b9c6" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#92b9c6" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path
            data-progress-area
            d="M0 116 C48 108 62 102 96 98 S145 88 184 82 S235 66 275 62 S336 38 420 20 L420 130 L0 130 Z"
            fill="url(#progress-area)"
          />
          <path
            data-progress-line
            d="M0 116 C48 108 62 102 96 98 S145 88 184 82 S235 66 275 62 S336 38 420 20"
            fill="none"
            stroke="#0a2941"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <circle
            data-progress-point
            cx="275"
            cy="62"
            r="5"
            fill="#0a2941"
            stroke="white"
            strokeWidth="3"
          />
        </svg>
        <span
          data-progress-label
          className="absolute right-3 top-3 rounded-full bg-marketing-primary px-2.5 py-1 text-[8px] font-bold text-white shadow-lg"
        >
          Projected 2580
        </span>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {[
          ["Verbal Reasoning", "760", "+40"],
          ["Decision Making", "790", "+60"],
          ["Quantitative Reasoning", "760", "+80"],
        ].map(([label, score, delta]) => (
          <div
            data-progress-metric
            key={label}
            className="rounded-xl border border-slate-200 bg-white p-2.5 sm:p-3"
          >
            <p className="truncate text-[8px] font-semibold text-slate-400">
              {label}
            </p>
            <div className="mt-1 flex items-baseline justify-between gap-1">
              <span className="text-sm font-bold text-slate-800">{score}</span>
              <span className="text-[8px] font-bold text-marketing-primary">
                {delta}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function buildDemoTimeline(card: HTMLElement) {
  const demo = card.dataset.demo;
  const timeline = gsap.timeline({
    paused: true,
    repeat: -1,
    repeatDelay: 1.15,
  });

  if (demo === "learning") {
    timeline
      .from(card.querySelectorAll("[data-learning-row]"), {
        y: 12,
        opacity: 0,
        stagger: 0.1,
        duration: 0.42,
        ease: "power2.out",
      })
      .fromTo(
        card.querySelector("[data-learning-progress]"),
        { scaleX: 0.22 },
        { scaleX: 1, duration: 1.1, ease: "power2.inOut" },
        "-=0.15",
      )
      .fromTo(
        card.querySelectorAll("[data-learning-check='done']"),
        { scale: 0.35, opacity: 0 },
        {
          scale: 1,
          opacity: 1,
          stagger: 0.14,
          duration: 0.35,
          ease: "back.out(2)",
        },
        "-=0.7",
      )
      .to({}, { duration: 1.1 });
  }

  if (demo === "skill") {
    const score = { value: 7 };
    const scoreElement = card.querySelector<HTMLElement>("[data-skill-score]");
    timeline
      .fromTo(
        card.querySelector("[data-skill-question]"),
        { y: 12, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.45, ease: "power2.out" },
      )
      .to(
        card.querySelector("[data-skill-answer='correct']"),
        {
          backgroundColor: "#92b9c6",
          borderColor: "#92b9c6",
          color: "#1a1a1a",
          scale: 1.035,
          duration: 0.25,
        },
        "+=0.55",
      )
      .fromTo(
        card.querySelector("[data-skill-toast]"),
        { y: 12, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.3, ease: "back.out(1.7)" },
        "<",
      )
      .to(
        score,
        {
          value: 8,
          duration: 0.45,
          ease: "power2.out",
          onUpdate: () => {
            if (scoreElement)
              scoreElement.textContent = String(Math.round(score.value));
          },
        },
        "<",
      )
      .to(
        card.querySelector("[data-skill-toast]"),
        { y: -8, opacity: 0, duration: 0.25 },
        "+=0.85",
      )
      .to(card.querySelector("[data-skill-answer='correct']"), {
        backgroundColor: "#f2f0e9",
        borderColor: "rgba(10,41,65,0.15)",
        color: "#1a1a1a",
        scale: 1,
        duration: 0.25,
      })
      .call(() => {
        score.value = 7;
        if (scoreElement) scoreElement.textContent = "7";
      });
  }

  if (demo === "practice") {
    timeline
      .from(card.querySelectorAll("[data-practice-section]"), {
        y: 10,
        opacity: 0,
        stagger: 0.08,
        duration: 0.35,
      })
      .from(
        card.querySelector("[data-practice-config]"),
        { y: 12, opacity: 0, duration: 0.4 },
        "-=0.15",
      )
      .fromTo(
        card.querySelector("[data-practice-slider]"),
        { scaleX: 0.15, transformOrigin: "left center" },
        { scaleX: 1, duration: 0.85, ease: "power2.inOut" },
      )
      .fromTo(
        card.querySelector("[data-practice-cursor]"),
        { x: 70, y: 225, opacity: 0 },
        { x: 295, y: 288, opacity: 1, duration: 0.75, ease: "power2.inOut" },
        "+=0.2",
      )
      .to(
        card.querySelector("[data-practice-start]"),
        { scale: 0.96, duration: 0.12 },
        "-=0.1",
      )
      .to(card.querySelector("[data-practice-start]"), {
        scale: 1,
        duration: 0.16,
      })
      .to(card.querySelector("[data-practice-cursor]"), {
        opacity: 0,
        duration: 0.2,
      })
      .to({}, { duration: 0.7 });
  }

  if (demo === "sets") {
    timeline
      .from(card.querySelectorAll("[data-set-row]"), {
        x: 18,
        opacity: 0,
        stagger: 0.12,
        duration: 0.45,
        ease: "power2.out",
      })
      .fromTo(
        card.querySelector("[data-set-progress]"),
        { scaleX: 0 },
        { scaleX: 1, duration: 1.1, ease: "power2.inOut" },
        "-=0.2",
      )
      .from(
        card.querySelector("[data-set-generator]"),
        { y: 12, opacity: 0, duration: 0.4, ease: "back.out(1.4)" },
        "-=0.25",
      )
      .to(
        card.querySelector("[data-set-generator]"),
        {
          borderColor: "#92b9c6",
          backgroundColor: "rgba(146, 185, 198, 0.15)",
          duration: 0.35,
        },
        "+=0.65",
      )
      .to({}, { duration: 0.75 });
  }

  if (demo === "mocks") {
    const timer = { seconds: 1214 };
    const timerElement = card.querySelector<HTMLElement>("[data-mock-timer]");
    const questionNumber = card.querySelector<HTMLElement>(
      "[data-mock-question-number]",
    );
    const answerOne = card.querySelector(
      '[data-mock-answer="one"][data-answer-index="0"]',
    );
    const answerTwo = card.querySelector(
      '[data-mock-answer="two"][data-answer-index="1"]',
    );
    const answerOneRadio = card.querySelector(
      '[data-mock-answer="one"][data-answer-index="0"] > span',
    );
    const answerTwoRadio = card.querySelector(
      '[data-mock-answer="two"][data-answer-index="1"] > span',
    );
    const screenOne = card.querySelector('[data-mock-screen="one"]');
    const screenTwo = card.querySelector('[data-mock-screen="two"]');
    const nextButton = card.querySelector("[data-mock-next]");
    timeline
      .to(
        timer,
        {
          seconds: 1208,
          duration: 6,
          ease: "none",
          onUpdate: () => {
            if (!timerElement) return;
            const seconds = Math.ceil(timer.seconds);
            timerElement.textContent = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
          },
        },
        0,
      )
      .to(
        answerOne,
        { backgroundColor: "#e6f0f4", borderColor: "#0b6ca2", duration: 0.22 },
        0.8,
      )
      .to(
        answerOneRadio,
        { backgroundColor: "#0b6ca2", borderColor: "#0b6ca2", duration: 0.2 },
        "<",
      )
      .to(nextButton, { backgroundColor: "#1b4c7d", duration: 0.12 }, 1.55)
      .to(nextButton, { backgroundColor: "#4f7ec1", duration: 0.16 })
      .to(screenOne, { opacity: 0, duration: 0.28 }, 1.9)
      .to(screenTwo, { opacity: 1, duration: 0.28 }, 1.9)
      .call(
        () => {
          if (questionNumber) questionNumber.textContent = "8";
        },
        [],
        1.9,
      )
      .to(
        answerTwo,
        { backgroundColor: "#e6f0f4", borderColor: "#0b6ca2", duration: 0.22 },
        3.25,
      )
      .to(
        answerTwoRadio,
        { backgroundColor: "#0b6ca2", borderColor: "#0b6ca2", duration: 0.2 },
        "<",
      )
      .to(nextButton, { backgroundColor: "#1b4c7d", duration: 0.12 }, 4.25)
      .to(nextButton, { backgroundColor: "#4f7ec1", duration: 0.16 })
      .call(() => {
        timer.seconds = 1214;
        if (timerElement) timerElement.textContent = "20:14";
        if (questionNumber) questionNumber.textContent = "7";
      });
  }

  if (demo === "live") {
    timeline
      .fromTo(
        card.querySelector("[data-live-pulse]"),
        { scale: 0.7, opacity: 0.45 },
        {
          scale: 1.35,
          opacity: 1,
          duration: 0.7,
          repeat: 2,
          yoyo: true,
          ease: "sine.inOut",
        },
      )
      .from(
        card.querySelector("[data-live-question]"),
        { x: 14, opacity: 0, duration: 0.4, ease: "power2.out" },
        0.15,
      )
      .fromTo(
        card.querySelector("[data-live-response]"),
        { scaleX: 0.08 },
        { scaleX: 1, duration: 1.15, ease: "power2.inOut" },
        0.55,
      )
      .from(
        card.querySelector("[data-live-insight]"),
        { y: 12, opacity: 0, duration: 0.4, ease: "back.out(1.5)" },
        "-=0.15",
      )
      .to({}, { duration: 1 });
  }

  if (demo === "progress") {
    const score = { value: 2180 };
    const scoreElement = card.querySelector<HTMLElement>(
      "[data-progress-score]",
    );
    timeline
      .fromTo(
        card.querySelector("[data-progress-line]"),
        { strokeDasharray: 700, strokeDashoffset: 700 },
        { strokeDashoffset: 0, duration: 1.65, ease: "power2.inOut" },
      )
      .fromTo(
        card.querySelector("[data-progress-area]"),
        { opacity: 0 },
        { opacity: 1, duration: 0.7 },
        "-=0.8",
      )
      .from(
        card.querySelector("[data-progress-point]"),
        {
          scale: 0,
          transformOrigin: "center",
          duration: 0.35,
          ease: "back.out(2)",
        },
        "-=0.4",
      )
      .from(
        card.querySelector("[data-progress-label]"),
        { y: 8, opacity: 0, duration: 0.35 },
        "-=0.2",
      )
      .to(
        score,
        {
          value: 2310,
          duration: 1.25,
          ease: "power2.out",
          onUpdate: () => {
            if (scoreElement)
              scoreElement.textContent = String(
                Math.round(score.value / 10) * 10,
              );
          },
        },
        0.15,
      )
      .from(
        card.querySelectorAll("[data-progress-metric]"),
        { y: 10, opacity: 0, stagger: 0.1, duration: 0.35 },
        "-=0.35",
      )
      .to({}, { duration: 1 })
      .call(() => {
        score.value = 2180;
        if (scoreElement) scoreElement.textContent = "2180";
      });
  }

  return timeline;
}

export function UcatLandingProtocol() {
  const containerRef = useRef<HTMLElement>(null);
  const detailTriggerRef = useRef<HTMLButtonElement | null>(null);
  const detailCardRef = useRef<HTMLElement | null>(null);
  const detailCloseButtonRef = useRef<HTMLButtonElement>(null);
  const detailTimelineRef = useRef<gsap.core.Timeline | null>(null);
  const detailClosingRef = useRef(false);
  const [activeDetail, setActiveDetail] = useState<{
    feature: ProtocolFeatureKey;
    origin: ProtocolFeatureOrigin;
  } | null>(null);

  const openDetail = useCallback(
    (feature: ProtocolFeatureKey, event: MouseEvent<HTMLButtonElement>) => {
      if (activeDetail) return;
      const card = event.currentTarget.closest<HTMLElement>(
        "[data-protocol-card]",
      );
      if (!card) return;
      const rect = card.getBoundingClientRect();
      detailTriggerRef.current = event.currentTarget;
      setActiveDetail({
        feature,
        origin: {
          left: rect.left,
          top: rect.top,
          width: rect.width,
          height: rect.height,
        },
      });
    },
    [activeDetail],
  );

  const closeDetail = useCallback(() => {
    if (!activeDetail || detailClosingRef.current) return;
    detailClosingRef.current = true;
    detailTimelineRef.current?.kill();

    const trigger = detailTriggerRef.current;
    const card = detailCardRef.current;
    const backdrop = document.querySelector<HTMLElement>(
      "[data-protocol-detail-backdrop]",
    );
    const placeholder = containerRef.current?.querySelector<HTMLElement>(
      `[data-protocol-placeholder="${activeDetail.feature}"]`,
    );
    const target = placeholder?.getBoundingClientRect() ?? activeDetail.origin;
    const detailBack = card?.querySelector<HTMLElement>(
      "[data-protocol-detail-back]",
    );
    const cardFront = card?.querySelector<HTMLElement>(
      "[data-protocol-card-front]",
    );

    // Once the opening turn finishes we normalise both faces back to 0deg so
    // the scrollable detail surface is not left inside a rotated compositor
    // layer. Restore the equivalent 180deg state before playing the close turn.
    if (card?.dataset.detailNormalized === "true") {
      gsap.set(card, { rotationY: 180 });
      if (detailBack) gsap.set(detailBack, { rotationY: 180 });
      if (cardFront) gsap.set(cardFront, { visibility: "visible" });
      delete card.dataset.detailNormalized;
    }

    const finish = () => {
      if (card) {
        const detailBack = card.querySelector<HTMLElement>(
          "[data-protocol-detail-back]",
        );
        const cardFront = card.querySelector<HTMLElement>(
          "[data-protocol-card-front]",
        );
        if (detailBack) gsap.set(detailBack, { clearProps: "transform" });
        if (cardFront) gsap.set(cardFront, { clearProps: "visibility" });
        delete card.dataset.detailNormalized;
        gsap.set(card, {
          clearProps:
            "position,top,left,width,height,margin,borderRadius,transform,filter,opacity,transformOrigin,transformStyle,boxShadow",
        });
        card.style.zIndex = String(Number(card.dataset.stackIndex ?? 1));
      }
      detailTimelineRef.current = null;
      detailCardRef.current = null;
      setActiveDetail(null);
      window.requestAnimationFrame(() => {
        ScrollTrigger.refresh();
        trigger?.focus();
      });
    };

    if (
      !card ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      if (backdrop) gsap.set(backdrop, { opacity: 0 });
      finish();
      return;
    }

    detailTimelineRef.current = gsap
      .timeline({ onComplete: finish })
      .to(backdrop, { opacity: 0, duration: 0.28 }, 0)
      .to(
        card,
        {
          top: target.top,
          left: target.left,
          width: target.width,
          height: target.height,
          rotationY: 0,
          borderRadius: window.innerWidth >= 640 ? 48 : 32,
          duration: 0.72,
          ease: "power3.inOut",
        },
        0,
      );
  }, [activeDetail]);

  useLayoutEffect(() => {
    if (!activeDetail) return;

    detailClosingRef.current = false;
    const card = containerRef.current?.querySelector<HTMLElement>(
      `[data-protocol-card][data-demo="${activeDetail.feature}"]`,
    );
    const backdrop = document.querySelector<HTMLElement>(
      "[data-protocol-detail-backdrop]",
    );
    if (!card || !backdrop) return;

    detailCardRef.current = card;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const inset = window.innerWidth < 640 ? 12 : 24;
    const detailWidth = window.innerWidth - inset * 2;
    const detailHeight = window.innerHeight - inset * 2;
    const reveals = card.querySelectorAll("[data-detail-reveal]");
    const detailBack = card.querySelector<HTMLElement>(
      "[data-protocol-detail-back]",
    );
    const cardFront = card.querySelector<HTMLElement>(
      "[data-protocol-card-front]",
    );

    const normaliseExpandedFaces = () => {
      if (cardFront) gsap.set(cardFront, { visibility: "hidden" });
      if (detailBack) gsap.set(detailBack, { rotationY: 0 });
      gsap.set(card, { rotationY: 0 });
      card.dataset.detailNormalized = "true";
    };

    gsap.set(backdrop, { opacity: 0 });
    gsap.set(card, {
      position: "fixed",
      top: activeDetail.origin.top,
      left: activeDetail.origin.left,
      width: activeDetail.origin.width,
      height: activeDetail.origin.height,
      margin: 0,
      zIndex: 120,
      rotationY: 0,
      scale: 1,
      filter: "blur(0px)",
      opacity: 1,
      transformOrigin: "center center",
      transformStyle: "preserve-3d",
    });

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeDetail();
      if (event.key === "Tab") {
        event.preventDefault();
        detailCloseButtonRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);

    if (reduceMotion) {
      gsap.set(backdrop, { opacity: 1 });
      gsap.set(card, {
        top: inset,
        left: inset,
        width: detailWidth,
        height: detailHeight,
        borderRadius: window.innerWidth >= 640 ? 40 : 28,
      });
      normaliseExpandedFaces();
      gsap.set(reveals, { opacity: 1 });
      detailCloseButtonRef.current?.focus();
    } else {
      // Keep reveal elements on the card's existing 3D plane. Giving them a
      // nested transform while the card is turned 180deg causes Chromium to
      // render those descendants mirrored after the flip completes.
      gsap.set(reveals, { opacity: 0 });
      detailTimelineRef.current = gsap
        .timeline()
        .to(backdrop, { opacity: 1, duration: 0.3 }, 0)
        .to(
          card,
          {
            top: inset,
            left: inset,
            width: detailWidth,
            height: detailHeight,
            rotationY: 180,
            borderRadius: window.innerWidth >= 640 ? 40 : 28,
            boxShadow: "0 32px 100px rgba(0,0,0,0.32)",
            duration: 0.82,
            ease: "power3.inOut",
          },
          0,
        )
        .call(normaliseExpandedFaces, [], 0.82)
        .to(
          reveals,
          {
            opacity: 1,
            stagger: 0.08,
            duration: 0.45,
            ease: "power2.out",
          },
          0.48,
        )
        .call(() => detailCloseButtonRef.current?.focus(), [], 0.78);
    }

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
      detailTimelineRef.current?.kill();
    };
  }, [activeDetail, closeDetail]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const demoObservers: IntersectionObserver[] = [];

    const context = gsap.context(() => {
      const cards = Array.from(
        container.querySelectorAll<HTMLElement>("[data-protocol-card]"),
      );
      const reduceMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;

      gsap.set(cards, { transformOrigin: "top center" });

      gsap.from("[data-protocol-heading] > *", {
        scrollTrigger: {
          trigger: "[data-protocol-heading]",
          start: "top 78%",
          once: true,
        },
        y: 28,
        opacity: 0,
        stagger: 0.1,
        duration: reduceMotion ? 0 : 0.7,
        ease: "power3.out",
      });

      cards.forEach((card) => {
        gsap.from(card.querySelector("[data-protocol-card-content]"), {
          scrollTrigger: {
            trigger: card,
            start: "top 90%",
            once: true,
          },
          y: reduceMotion ? 0 : 54,
          opacity: 0,
          duration: reduceMotion ? 0 : 0.85,
          ease: "power3.out",
        });

        if (reduceMotion) return;
        const timeline = buildDemoTimeline(card);
        const observer = new IntersectionObserver(
          ([entry]) => {
            if (entry?.isIntersecting) {
              timeline.restart();
            } else {
              timeline.pause(0);
            }
          },
          { threshold: 0.05 },
        );
        observer.observe(card);
        demoObservers.push(observer);
      });

      if (!reduceMotion && window.matchMedia("(min-width: 1024px)").matches) {
        cards.slice(0, -1).forEach((card, index) => {
          gsap.fromTo(
            card,
            {
              scale: 1,
              filter: "blur(0px)",
              opacity: 1,
            },
            {
              scrollTrigger: {
                trigger: cards[index + 1],
                start: "top 86%",
                end: () =>
                  `top top+=${Math.max(96, window.innerHeight / 2 - 276)}`,
                scrub: true,
                invalidateOnRefresh: true,
              },
              scale: 0.9,
              filter: "blur(20px)",
              opacity: 0.48,
              transformOrigin: "top center",
              ease: "none",
              immediateRender: false,
            },
          );
        });
      }
    }, container);

    return () => {
      demoObservers.forEach((observer) => observer.disconnect());
      context.revert();
    };
  }, []);

  return (
    <section
      ref={containerRef}
      id="how-it-works"
      className="relative w-full overflow-x-clip bg-marketing-cream px-4 py-24 sm:px-6 sm:py-32 lg:px-8 lg:pb-[40vh] lg:pt-40"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-0 h-[540px] w-[900px] -translate-x-1/2 rounded-full bg-marketing-primary/[0.06] blur-[120px]"
      />

      <div
        data-protocol-heading
        className="relative mx-auto mb-14 max-w-4xl text-center text-marketing-charcoal sm:mb-20"
      >
        <p
          className={`text-xs font-bold uppercase tracking-[0.2em] text-marketing-primary ${typo.dataMono}`}
        >
          Inside Alti UCAT
        </p>
        <h2
          className={`mt-5 text-4xl font-bold tracking-[-0.05em] sm:text-6xl lg:text-7xl ${typo.headingSans}`}
        >
          One platform. Every part of your prep.
        </h2>
        <p
          className={`mx-auto mt-6 max-w-2xl text-base leading-relaxed text-marketing-charcoal/60 sm:text-xl ${typo.secondarySans}`}
        >
          Learn the method, sharpen individual skills, practise with intent and
          track the evidence that moves your score.
        </p>
      </div>

      <div className="relative mx-auto w-full max-w-7xl">
        <ShowcaseCard
          index="01"
          eyebrow="Learning modules"
          title="Learn the thinking before the timing."
          description="Work through structured lessons for every UCAT section, from first principles to exam-ready strategies. Your place is saved and every completed lesson builds a visible path through the course."
          detail="Lessons connect directly to relevant skill trainers and practice questions, so theory immediately becomes applied practice."
          icon={<BookOpen className="h-5 w-5" />}
          theme="light"
          demo="learning"
          onLearnMore={(event) => openDetail("learning", event)}
          expanded={activeDetail?.feature === "learning"}
          expandedPlaceholderHeight={activeDetail?.origin.height}
          closeButtonRef={detailCloseButtonRef}
          onCloseDetail={closeDetail}
        >
          <LearningDemo />
        </ShowcaseCard>

        <ShowcaseCard
          index="02"
          eyebrow="Skill trainers"
          title="Train one mental move at a time."
          description="Short, timed drills isolate the skills that cost you marks—syllogisms, mental arithmetic, reading speed and more—so you can improve without the noise of a full question set."
          detail="Instant feedback, streaks, personal bests and leaderboards turn deliberate repetition into something you can feel improving."
          icon={<BrainCircuit className="h-5 w-5" />}
          theme="accent"
          reverse
          demo="skill"
          onLearnMore={(event) => openDetail("skill", event)}
          expanded={activeDetail?.feature === "skill"}
          expandedPlaceholderHeight={activeDetail?.origin.height}
          closeButtonRef={detailCloseButtonRef}
          onCloseDetail={closeDetail}
        >
          <SkillTrainerDemo />
        </ShowcaseCard>

        <ShowcaseCard
          index="03"
          eyebrow="Practice questions"
          title="Make every practice session intentional."
          description="Choose the section, categories, pacing and number of questions you need. Focus on new material, revisit incorrect answers or remove the clock while you build confidence."
          detail="Every session is assembled around your choices and recorded for review—no aimless trawling through a static question bank."
          icon={<Target className="h-5 w-5" />}
          theme="blue"
          demo="practice"
          onLearnMore={(event) => openDetail("practice", event)}
          expanded={activeDetail?.feature === "practice"}
          expandedPlaceholderHeight={activeDetail?.origin.height}
          closeButtonRef={detailCloseButtonRef}
          onCloseDetail={closeDetail}
        >
          <PracticeDemo />
        </ShowcaseCard>

        <ShowcaseCard
          index="04"
          eyebrow="Question sets"
          title="Build stamina in focused blocks."
          description="Move from individual questions into curated, section-specific sets. Resume unfinished work, see what you have attempted and create a custom set when you need a precise challenge."
          detail="Sets bridge the gap between targeted practice and the sustained pacing required in a full mock exam."
          icon={<Layers3 className="h-5 w-5" />}
          theme="light"
          reverse
          demo="sets"
          onLearnMore={(event) => openDetail("sets", event)}
          expanded={activeDetail?.feature === "sets"}
          expandedPlaceholderHeight={activeDetail?.origin.height}
          closeButtonRef={detailCloseButtonRef}
          onCloseDetail={closeDetail}
        >
          <SetsDemo />
        </ShowcaseCard>

        <ShowcaseCard
          index="05"
          eyebrow="Mock exams"
          title="Rehearse the real pressure."
          description="Sit full-length UCAT mocks in the same question engine used across the platform, with section timing, flagging, keyboard shortcuts and a navigator that keeps the whole exam in view."
          detail="Review every attempt by section and question after the clock stops, then take the evidence back into targeted practice."
          icon={<Clock3 className="h-5 w-5" />}
          theme="dark"
          demo="mocks"
          flushDemo
          onLearnMore={(event) => openDetail("mocks", event)}
          expanded={activeDetail?.feature === "mocks"}
          expandedPlaceholderHeight={activeDetail?.origin.height}
          closeButtonRef={detailCloseButtonRef}
          onCloseDetail={closeDetail}
        >
          <MocksDemo />
        </ShowcaseCard>

        <ShowcaseCard
          index="06"
          eyebrow="Live online sessions"
          title="Bring a tutor into the platform with you."
          description="Join a live video session where your tutor can guide the lesson from inside Alti, send questions into your workspace and respond to how you solve them in real time."
          detail="Tutors will be able to analyse your progress, recommend the next focus area and give targeted tips and advice while the evidence is still fresh. Coming soon."
          icon={<Video className="h-5 w-5" />}
          theme="blue"
          reverse
          demo="live"
          onLearnMore={(event) => openDetail("live", event)}
          expanded={activeDetail?.feature === "live"}
          expandedPlaceholderHeight={activeDetail?.origin.height}
          closeButtonRef={detailCloseButtonRef}
          onCloseDetail={closeDetail}
        >
          <LiveSessionDemo />
        </ShowcaseCard>

        <ShowcaseCard
          index="07"
          eyebrow="Progress"
          title="See the work become a score."
          description="Bring practice, set and mock performance together in one progress view. Track section trends, review activity and see a projected UCAT score grounded in your weighted attempt history."
          detail="Confidence ranges make uncertainty visible, while forward projections show where your current trajectory could take you."
          icon={<LineChart className="h-5 w-5" />}
          theme="light"
          demo="progress"
          onLearnMore={(event) => openDetail("progress", event)}
          expanded={activeDetail?.feature === "progress"}
          expandedPlaceholderHeight={activeDetail?.origin.height}
          closeButtonRef={detailCloseButtonRef}
          onCloseDetail={closeDetail}
        >
          <ProgressDemo />
        </ShowcaseCard>
      </div>

      {activeDetail ? (
        <ProtocolFeatureDetailBackdrop onDismiss={closeDetail} />
      ) : null}

      <div className="relative mx-auto mt-12 flex max-w-7xl items-center justify-center gap-3 text-center text-sm text-marketing-charcoal/45 sm:mt-16">
        <BarChart3 className="h-4 w-4 text-marketing-primary" />
        <span className={typo.secondarySans}>
          One continuous record—from your first lesson to your final mock.
        </span>
      </div>
    </section>
  );
}
