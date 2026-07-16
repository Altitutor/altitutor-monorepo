import { MARKETING_TOKENS } from "@altitutor/shared";
import {
  Activity,
  CalendarDays,
  Check,
  Clock3,
  ListChecks,
  Target,
  TrendingUp,
  Users,
} from "lucide-react";

const { typography: typo } = MARKETING_TOKENS;

export function ProgressDetailStory() {
  return (
    <div className="mx-auto max-w-5xl px-5 pb-24 pt-10 sm:px-8 sm:pt-14 lg:px-12">
      <section data-detail-reveal>
        <p
          className={`text-xs font-bold uppercase tracking-[0.18em] text-marketing-primary ${typo.dataMono}`}
        >
          Progress tracking
        </p>
        <h2
          id="protocol-detail-progress"
          className={`mt-4 max-w-3xl text-4xl font-bold tracking-[-0.04em] sm:text-5xl ${typo.headingSans}`}
        >
          Turn attempt history into specific preparation decisions
        </h2>
        <p
          className={`mt-5 max-w-3xl text-base leading-7 text-marketing-charcoal/62 sm:text-lg ${typo.secondarySans}`}
        >
          Practice sessions, question sets and mocks are combined into one
          progress record. The views below explain score, comparison, timing,
          trends, planning and consistency separately.
        </p>
      </section>

      <section data-detail-reveal className="mt-16">
        <div className="grid gap-7 lg:grid-cols-[0.75fr_1.25fr] lg:items-center">
          <div>
            <p className="text-xs font-bold text-marketing-primary">01</p>
            <h3 className={`mt-3 text-2xl font-bold ${typo.headingSans}`}>
              Score estimates summarise current performance
            </h3>
            <p className="mt-4 text-sm leading-6 text-marketing-charcoal/60">
              Completed mocks provide section scores and a total score estimate
              using the UCAT marking model. Situational Judgement is displayed
              as a band, separately from the three cognitive-section total.
            </p>
          </div>
          <div
            data-ui-animate
            aria-hidden
            className="rounded-2xl border border-marketing-primary/10 bg-white p-6 shadow-[0_18px_50px_rgba(10,41,65,0.09)] sm:p-8"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[9px] font-bold uppercase tracking-wider text-marketing-primary">
                  Mock score
                </p>
                <h4 className="mt-1 text-base font-bold">UCAT Mock 3</h4>
              </div>
              <div className="text-right">
                <p className="text-3xl font-bold">2310</p>
                <p className="text-[9px] text-marketing-charcoal/40">
                  + Band 2
                </p>
              </div>
            </div>
            <div className="mt-6 divide-y divide-slate-100">
              {[
                ["Verbal Reasoning", "720", "74th percentile"],
                ["Decision Making", "790", "89th percentile"],
                ["Quantitative Reasoning", "800", "91st percentile"],
                ["Situational Judgement", "Band 2", "78% accuracy"],
              ].map(([section, score, comparison]) => (
                <div key={section} className="flex items-center gap-4 py-3">
                  <span className="flex-1 text-xs font-semibold">
                    {section}
                  </span>
                  <strong className="text-sm">{score}</strong>
                  <span className="w-24 text-right text-[9px] text-slate-400">
                    {comparison}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section data-detail-reveal className="mt-20">
        <div className="grid gap-7 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
          <div
            data-ui-animate
            aria-hidden
            className="rounded-2xl border border-marketing-primary/10 bg-white p-6 shadow-[0_18px_50px_rgba(10,41,65,0.08)] sm:p-8"
          >
            <div className="flex items-center gap-2 text-marketing-primary">
              <Users className="h-4 w-4" />
              <p className="text-[9px] font-bold uppercase tracking-wider">
                Answer comparison
              </p>
            </div>
            <p className="mt-4 text-sm font-semibold">
              The most recent Nobel prize in Chemistry was awarded to three
              Americans.
            </p>
            <div className="mt-5 space-y-3">
              {[
                ["A", "True", "19%", false],
                ["B", "False", "47%", true],
                ["C", "Can’t tell", "34%", false],
              ].map(([letter, answer, percentage, selected]) => (
                <div
                  key={String(letter)}
                  className="grid grid-cols-[28px_1fr_1fr_42px] items-center gap-2 text-xs"
                >
                  <span className="font-bold">{letter}.</span>
                  <span className="font-semibold">{answer}</span>
                  <div className="h-2 rounded-full bg-slate-100">
                    <div
                      className={`h-full rounded-full ${selected ? "bg-marketing-primary" : "bg-marketing-accent"}`}
                      style={{ width: percentage as string }}
                    />
                  </div>
                  <span className="text-right font-bold">{percentage}</span>
                </div>
              ))}
            </div>
            <p className="mt-5 rounded-xl bg-marketing-cream p-3 text-[10px] text-marketing-charcoal/55">
              Your answer: False · Correct answer: Can’t tell
            </p>
          </div>
          <div>
            <p className="text-xs font-bold text-marketing-primary">02</p>
            <h3 className={`mt-3 text-2xl font-bold ${typo.headingSans}`}>
              Compare scores and answers with other students
            </h3>
            <p className="mt-4 text-sm leading-6 text-marketing-charcoal/60">
              Percentiles show where a mock result sits within the comparison
              group. Individual question reviews also show the proportion of
              students selecting each answer, helping distinguish a common trap
              from an unusual mistake.
            </p>
          </div>
        </div>
      </section>

      <section data-detail-reveal className="mt-20">
        <div className="grid gap-7 lg:grid-cols-[0.78fr_1.22fr] lg:items-center">
          <div>
            <p className="text-xs font-bold text-marketing-primary">03</p>
            <h3 className={`mt-3 text-2xl font-bold ${typo.headingSans}`}>
              Speed analysis identifies pacing problems
            </h3>
            <p className="mt-4 text-sm leading-6 text-marketing-charcoal/60">
              Attempt reviews compare time per question with the recommended
              pace and the average time taken by students who answered
              correctly. Slow correct answers and rushed mistakes can then be
              addressed differently.
            </p>
          </div>
          <div
            data-ui-animate
            aria-hidden
            className="rounded-2xl border border-marketing-primary/10 bg-white p-6 shadow-[0_18px_50px_rgba(10,41,65,0.08)] sm:p-8"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock3 className="h-4 w-4 text-marketing-primary" />
                <span className="text-xs font-bold">Timing</span>
              </div>
              <span className="text-[9px] text-slate-400">
                Verbal Reasoning · 32/44 marks
              </span>
            </div>
            <div className="mt-5 grid grid-cols-4 gap-2 sm:grid-cols-8">
              {[42, 31, 68, 36, 55, 29, 47, 24].map((seconds, index) => (
                <div key={`${seconds}-${index}`} className="text-center">
                  <div
                    className={`mx-auto flex h-10 w-10 items-center justify-center rounded-lg text-[10px] font-bold ${seconds > 60 ? "bg-red-50 text-red-600" : seconds > 45 ? "bg-marketing-accent/25 text-marketing-primary" : "bg-marketing-cream"}`}
                  >
                    {index + 1}
                  </div>
                  <p className="mt-1 text-[8px] text-slate-400">{seconds}s</p>
                </div>
              ))}
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-marketing-cream p-4">
                <p className="text-[9px] text-marketing-charcoal/40">You</p>
                <p className="mt-1 text-xl font-bold">52s</p>
              </div>
              <div className="rounded-xl bg-marketing-cream p-4">
                <p className="text-[9px] text-marketing-charcoal/40">
                  Avg. correct student
                </p>
                <p className="mt-1 text-xl font-bold">43s</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section data-detail-reveal className="mt-20">
        <div>
          <p className="text-xs font-bold text-marketing-primary">04</p>
          <h3 className={`mt-3 text-2xl font-bold ${typo.headingSans}`}>
            View section performance over time
          </h3>
          <p className="mt-4 max-w-3xl text-sm leading-6 text-marketing-charcoal/60">
            Mock scores and practice accuracy are plotted by date, with each
            UCAT section kept separate. This shows whether an apparent
            improvement is sustained across several attempts rather than based
            on one result.
          </p>
        </div>
        <div
          data-ui-animate
          aria-hidden
          className="mt-8 rounded-2xl border border-marketing-primary/10 bg-white p-6 shadow-[0_18px_50px_rgba(10,41,65,0.08)] sm:p-8"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[9px] font-bold uppercase tracking-wider text-marketing-primary">
                Mock scores over time
              </p>
              <p className="mt-1 text-sm font-bold">Verbal Reasoning</p>
            </div>
            <div className="text-right">
              <p className="text-[9px] text-slate-400">Last 3 mocks avg.</p>
              <p className="text-lg font-bold">760</p>
            </div>
          </div>
          <div className="relative mt-6 h-52 overflow-hidden rounded-xl bg-slate-50">
            <div className="absolute inset-x-5 top-1/4 border-t border-dashed border-slate-200" />
            <div className="absolute inset-x-5 top-2/4 border-t border-dashed border-slate-200" />
            <div className="absolute inset-x-5 top-3/4 border-t border-dashed border-slate-200" />
            <svg
              viewBox="0 0 600 190"
              className="absolute inset-5 h-[calc(100%-40px)] w-[calc(100%-40px)]"
              preserveAspectRatio="none"
            >
              <path
                d="M0 155 L110 105 L220 130 L350 82 L470 42 L600 58"
                fill="none"
                stroke="#0a2941"
                strokeWidth="5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {[
                [0, 155],
                [110, 105],
                [220, 130],
                [350, 82],
                [470, 42],
                [600, 58],
              ].map(([x, y]) => (
                <circle
                  key={`${x}-${y}`}
                  cx={x}
                  cy={y}
                  r="6"
                  fill="#92b9c6"
                  stroke="white"
                  strokeWidth="3"
                />
              ))}
            </svg>
          </div>
        </div>
      </section>

      <section data-detail-reveal className="mt-20">
        <div className="grid gap-7 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
          <div
            data-ui-animate
            aria-hidden
            className="rounded-2xl bg-marketing-primary p-7 text-marketing-cream sm:p-8"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[9px] font-bold uppercase tracking-wider text-marketing-accent">
                  Score projection
                </p>
                <h4 className="mt-1 text-lg font-bold">Exam-date range</h4>
              </div>
              <div className="text-right">
                <p className="text-3xl font-bold">2490–2630</p>
                <p className="text-[9px] text-marketing-cream/50">
                  Projected range
                </p>
              </div>
            </div>
            <div className="mt-6 rounded-xl bg-white/10 p-4">
              <div className="flex items-center justify-between text-xs">
                <span>Current estimate</span>
                <strong>2310 ± 40</strong>
              </div>
              <div className="mt-3 h-2 rounded-full bg-white/10">
                <div className="h-full w-[64%] rounded-full bg-marketing-accent" />
              </div>
              <p className="mt-3 text-[10px] leading-5 text-marketing-cream/60">
                Projection uses weighted attempt history and displays
                uncertainty rather than a guaranteed future score.
              </p>
            </div>
            <div className="mt-4 rounded-xl bg-white/10 p-4">
              <div className="flex items-center gap-2 text-xs font-bold">
                <ListChecks className="h-4 w-4 text-marketing-accent" /> Next
                study block
              </div>
              <p className="mt-2 text-xs text-marketing-cream/65">
                Decision Making: probability lesson → 10-minute trainer → 20
                custom questions
              </p>
            </div>
          </div>
          <div>
            <p className="text-xs font-bold text-marketing-primary">05</p>
            <h3 className={`mt-3 text-2xl font-bold ${typo.headingSans}`}>
              Score projection and the study planner connect trends to action
            </h3>
            <p className="mt-4 text-sm leading-6 text-marketing-charcoal/60">
              The projection estimates a future score range from weighted
              attempt history and shows its uncertainty. The study planner then
              converts section weaknesses into a sequence of lessons, trainers
              and practice sessions rather than leaving the chart unexplained.
            </p>
          </div>
        </div>
      </section>

      <section data-detail-reveal className="mt-20">
        <div className="grid gap-5 sm:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-2xl bg-marketing-accent p-7 sm:p-8">
            <p className="text-xs font-bold text-marketing-primary">06</p>
            <h3 className={`mt-3 text-2xl font-bold ${typo.headingSans}`}>
              Consistent practice contributes to the practice discount
            </h3>
            <p className="mt-4 text-sm leading-6 text-marketing-charcoal/60">
              Eligible completed practice is counted toward the subscription’s
              practice-discount progress. This provides a practical incentive to
              maintain regular, meaningful activity rather than relying on a
              cosmetic streak alone.
            </p>
          </div>
          <div
            data-ui-animate
            aria-hidden
            className="rounded-2xl border border-marketing-primary/10 bg-white p-6 sm:p-8"
          >
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <CalendarDays className="h-5 w-5 text-marketing-primary" />
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-wider text-marketing-primary">
                    Practice discount
                  </p>
                  <p className="mt-1 text-sm font-bold">This billing period</p>
                </div>
              </div>
              <span className="text-lg font-bold">72%</span>
            </div>
            <div className="mt-5 h-2.5 rounded-full bg-marketing-cream">
              <div className="h-full w-[72%] rounded-full bg-marketing-primary" />
            </div>
            <div className="mt-5 grid grid-cols-3 gap-2">
              {[
                ["Questions", "184", Activity],
                ["Active days", "9", TrendingUp],
                ["Eligible work", "12", Target],
              ].map(([label, value, Icon]) => {
                const MetricIcon = Icon as typeof Activity;
                return (
                  <div
                    key={String(label)}
                    className="rounded-xl bg-marketing-cream p-3"
                  >
                    <MetricIcon className="h-3.5 w-3.5 text-marketing-primary" />
                    <p className="mt-2 text-[8px] text-marketing-charcoal/40">
                      {label as string}
                    </p>
                    <p className="mt-1 text-base font-bold">
                      {value as string}
                    </p>
                  </div>
                );
              })}
            </div>
            <div className="mt-5 flex items-center gap-2 rounded-xl bg-marketing-accent/20 p-3 text-[10px] text-marketing-primary">
              <Check className="h-4 w-4" /> Practice completed today has been
              added to your progress.
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
