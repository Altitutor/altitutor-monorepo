import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  BookOpen,
  BrainCircuit,
  Calculator,
  Check,
  Clock3,
  Flag,
  Flame,
  Navigation,
  Play,
  Trophy,
} from "lucide-react";

export function LearnCardPreview() {
  return (
    <div className="grid min-h-[310px] grid-cols-[58px_1fr] bg-slate-50 sm:min-h-[360px] sm:grid-cols-[124px_1fr]">
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
            className={`mb-1 rounded-lg px-2 py-2 text-[9px] font-medium ${index === 1 ? "bg-marketing-accent/15 text-marketing-primary" : "text-slate-400"}`}
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
            <h4 className="mt-1 text-sm font-bold text-slate-900 sm:text-base">
              Reading critically
            </h4>
          </div>
          <span className="rounded-full bg-white px-2.5 py-1 text-[9px] font-semibold text-slate-500 shadow-sm">
            Lesson 3
          </span>
        </div>
        <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-slate-200">
          <div
            data-learn-preview-progress
            className="h-full w-[68%] origin-left rounded-full bg-marketing-primary"
          />
        </div>
        <div className="mt-5 space-y-2.5">
          {[
            ["How the subtest works", true],
            ["Finding the author’s position", true],
            ["Reading for inference", false],
            ["Handling qualifying language", false],
          ].map(([label, done], index) => (
            <div
              data-learn-preview-row
              key={String(label)}
              className={`flex items-center gap-3 rounded-xl border p-3 ${index === 3 ? "border-marketing-accent bg-white ring-1 ring-marketing-accent/25" : "border-slate-200 bg-white"}`}
            >
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${done ? "bg-marketing-accent/20 text-marketing-primary" : "bg-slate-100 text-slate-400"}`}
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
              <span className="text-[9px] font-bold text-marketing-primary">
                {index === 3 ? "Continue" : done ? "Complete" : "Next"}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function PracticeToolsCardPreview() {
  return (
    <div className="grid min-h-[310px] gap-3 bg-marketing-cream p-4 text-marketing-charcoal sm:min-h-[360px] sm:grid-cols-[1.08fr_0.92fr] sm:p-5">
      <div className="rounded-2xl border border-marketing-primary/10 bg-white p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BrainCircuit className="h-4 w-4 text-marketing-primary" />
            <div>
              <p className="text-[8px] font-bold uppercase tracking-[0.14em] text-marketing-primary">
                Skill trainer
              </p>
              <p className="text-[10px] font-semibold">Quick syllogisms</p>
            </div>
          </div>
          <span className="flex items-center gap-1 rounded-full bg-marketing-primary/5 px-2 py-1 text-[8px] font-bold">
            <Clock3 className="h-3 w-3" /> 00:42
          </span>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-1.5">
          {[
            ["Score", "7"],
            ["Streak", "4"],
            ["Best", "18"],
          ].map(([label, value], index) => (
            <div key={label} className="rounded-lg bg-marketing-cream p-2">
              <p className="text-[6px] uppercase text-marketing-charcoal/40">
                {label}
              </p>
              <p className="mt-1 flex items-center gap-1 text-xs font-bold">
                {index === 1 ? <Flame className="h-3 w-3" /> : null}
                {index === 2 ? <Trophy className="h-3 w-3" /> : null}
                <span data-practice-preview-score={index === 0 || undefined}>
                  {value}
                </span>
              </p>
            </div>
          ))}
        </div>
        <div className="mt-3 rounded-xl bg-marketing-cream p-3">
          <p className="text-[8px] leading-relaxed text-marketing-charcoal/55">
            All surgeons are doctors. No doctors are architects.
          </p>
          <p className="mt-1.5 text-[9px] font-bold">
            No surgeons are architects.
          </p>
          <div className="mt-3 grid grid-cols-2 gap-1.5">
            <span
              data-practice-preview-answer
              className="rounded-lg border border-marketing-primary/15 py-2 text-center text-[8px] font-bold"
            >
              Yes
            </span>
            <span className="rounded-lg border border-marketing-primary/15 py-2 text-center text-[8px] font-bold">
              No
            </span>
          </div>
        </div>
      </div>
      <div className="rounded-2xl border border-marketing-primary/10 bg-white p-4">
        <p className="text-[8px] font-bold uppercase tracking-[0.14em] text-marketing-primary">
          Custom practice
        </p>
        <p className="mt-1 text-[11px] font-bold">Build a session</p>
        <div className="mt-4 space-y-2">
          {[
            ["Section", "Decision Making"],
            ["Questions", "20"],
            ["Pacing", "Exam pace"],
          ].map(([label, value]) => (
            <div
              data-practice-preview-option
              key={label}
              className="rounded-xl bg-marketing-cream p-3"
            >
              <p className="text-[7px] text-marketing-charcoal/40">{label}</p>
              <p className="mt-1 text-[9px] font-bold">{value}</p>
            </div>
          ))}
        </div>
        <div className="mt-3 rounded-xl bg-marketing-primary px-3 py-2.5 text-center text-[8px] font-bold text-white">
          Review setup
        </div>
      </div>
    </div>
  );
}

export function MockSimulationCardPreview() {
  return (
    <div className="relative flex min-h-[310px] flex-col overflow-hidden bg-white font-[Arial,sans-serif] sm:min-h-[360px]">
      <div className="flex h-11 shrink-0 items-center justify-between bg-[#0b6ca2] px-3 text-white">
        <span className="text-[9px] font-bold sm:text-[11px]">
          Verbal Reasoning
        </span>
        <div className="text-right text-[7px] leading-tight sm:text-[9px]">
          <div>
            Time Remaining <span data-mock-preview-timer>20:14</span>
          </div>
          <div>
            Question <span data-mock-preview-number>7</span> of 44
          </div>
        </div>
      </div>
      <div className="flex h-7 shrink-0 items-center justify-between bg-[#4f7ec1] px-3 text-[7px] text-white sm:text-[9px]">
        <span className="flex items-center gap-1">
          <Calculator className="h-3 w-3" />
          <span>
            <u>C</u>alculator
          </span>
        </span>
        <span className="flex items-center gap-1">
          <Flag className="h-3 w-3" />
          <span>
            <u>F</u>lag for Review
          </span>
        </span>
      </div>
      <div className="grid min-h-[232px] flex-1 grid-cols-[0.88fr_1.12fr] divide-x divide-slate-300 sm:min-h-[282px]">
        <div className="bg-slate-50 p-3 sm:p-4">
          <p className="text-[7px] font-bold text-slate-800 sm:text-[8px]">
            Scientific reporting
          </p>
          <p className="mt-2 text-[6px] leading-[1.55] text-slate-600 sm:text-[7px]">
            Independent review allows researchers to test whether results can be
            repeated. Transparency about uncertainty is central to public trust
            in new findings.
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
                data-mock-preview-answer={index === 0 || undefined}
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
      <div className="flex h-10 shrink-0 items-stretch justify-between bg-[#0b6ca2] text-white">
        <span className="flex items-center gap-1 border-r border-white/45 px-3 text-[7px]">
          <ArrowLeft className="h-2.5 w-2.5" />
          <span>
            <u>P</u>revious
          </span>
        </span>
        <div className="flex items-stretch">
          <span className="flex items-center gap-1 border-l border-white/45 px-3 text-[7px]">
            <Navigation className="h-2.5 w-2.5" />
            <span>
              Na<u>v</u>igator
            </span>
          </span>
          <span
            data-mock-preview-next
            className="flex items-center gap-1 border-l border-white/45 bg-[#4f7ec1] px-3 text-[7px] font-bold"
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

export function ProgressTrackingCardPreview() {
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
            data-progress-preview-score
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
          <path
            data-progress-preview-area
            d="M0 116 C48 108 62 102 96 98 S145 88 184 82 S235 66 275 62 S336 38 420 20 L420 130 L0 130 Z"
            fill="rgba(146,185,198,.28)"
          />
          <path
            data-progress-preview-line
            d="M0 116 C48 108 62 102 96 98 S145 88 184 82 S235 66 275 62 S336 38 420 20"
            fill="none"
            stroke="#0a2941"
            strokeWidth="3"
            strokeLinecap="round"
          />
        </svg>
        <span className="absolute right-3 top-3 rounded-full bg-marketing-primary px-2.5 py-1 text-[8px] font-bold text-white">
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
            data-progress-preview-metric
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
      <div className="mt-3 flex items-center gap-2 text-[9px] font-semibold text-marketing-primary">
        <BarChart3 className="h-3.5 w-3.5" /> Updated from practice, sets and
        mocks
      </div>
    </div>
  );
}
