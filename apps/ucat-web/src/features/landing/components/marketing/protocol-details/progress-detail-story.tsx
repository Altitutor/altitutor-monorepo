import { MARKETING_TOKENS } from "@altitutor/shared";
import { Activity, BarChart3, CalendarDays, TrendingUp } from "lucide-react";

const { typography: typo } = MARKETING_TOKENS;
const sectionRows = [
  ["Verbal Reasoning", "720", "72%"],
  ["Decision Making", "790", "78%"],
  ["Quantitative Reasoning", "800", "69%"],
  ["Situational Judgement", "Band 2", "74%"],
];

export function ProgressDetailStory() {
  return (
    <div className="mx-auto max-w-7xl px-5 pb-24 pt-12 sm:px-8 sm:pt-16 lg:px-12 lg:pt-20">
      <section
        className="grid items-end gap-10 lg:grid-cols-[1fr_0.75fr]"
        data-detail-reveal
      >
        <div>
          <p
            className={`text-xs font-bold uppercase tracking-[0.2em] text-marketing-primary ${typo.dataMono}`}
          >
            Your evidence, connected
          </p>
          <h2
            id="protocol-detail-progress"
            className={`mt-5 text-4xl font-bold tracking-[-0.05em] sm:text-6xl ${typo.headingSans}`}
          >
            See what is improving—and what to do next.
          </h2>
        </div>
        <p
          className={`text-lg leading-8 text-marketing-charcoal/62 ${typo.secondarySans}`}
        >
          Alti brings practice, sets and mocks into one progress record. Score
          projections include visible uncertainty, so a promising trajectory
          never pretends to be a guarantee.
        </p>
      </section>

      <section
        data-detail-reveal
        aria-hidden
        className="mt-14 grid gap-5 lg:grid-cols-[1.1fr_0.9fr]"
      >
        <div className="rounded-[2rem] border border-marketing-primary/10 bg-white p-7 shadow-[0_24px_70px_rgba(10,41,65,0.08)] sm:p-9">
          <div className="flex items-start justify-between gap-5">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-marketing-primary">
                Predicted UCAT score
              </p>
              <p className="mt-2 text-sm text-marketing-charcoal/45">
                Sections 1–3 · weighted attempt history
              </p>
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold tabular-nums">2310</p>
              <p className="text-[10px] font-semibold text-marketing-charcoal/40">
                High confidence ± 40
              </p>
            </div>
          </div>
          <div className="relative mt-8 h-56 overflow-hidden rounded-xl border border-slate-100 bg-slate-50">
            <div className="absolute inset-x-5 top-1/4 border-t border-dashed border-slate-200" />
            <div className="absolute inset-x-5 top-2/4 border-t border-dashed border-slate-200" />
            <div className="absolute inset-x-5 top-3/4 border-t border-dashed border-slate-200" />
            <svg
              viewBox="0 0 600 220"
              preserveAspectRatio="none"
              className="absolute inset-5 h-[calc(100%-40px)] w-[calc(100%-40px)]"
            >
              <path
                d="M0 170 C90 160 125 125 200 135 S330 95 410 105 S520 50 600 66 L600 110 C520 90 475 120 410 135 S280 135 200 160 S80 185 0 190 Z"
                fill="rgba(146,185,198,.24)"
              />
              <path
                d="M0 180 C90 170 125 138 200 148 S330 108 410 118 S520 68 600 78"
                fill="none"
                stroke="#0a2941"
                strokeWidth="5"
                strokeLinecap="round"
              />
            </svg>
          </div>
          <div className="mt-5 grid grid-cols-3 gap-3">
            {[
              ["30 days", "2370–2450"],
              ["60 days", "2430–2540"],
              ["Exam date", "2490–2630"],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl bg-marketing-cream p-3">
                <p className="text-[10px] text-marketing-charcoal/40">
                  {label}
                </p>
                <p className="mt-1 text-sm font-bold">{value}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-[2rem] border border-marketing-primary/10 bg-white p-7 sm:p-9">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-marketing-primary">
                Section progress
              </p>
              <p className="mt-2 text-sm text-marketing-charcoal/45">
                Predicted score and accuracy
              </p>
            </div>
            <BarChart3 className="h-5 w-5 text-marketing-primary" />
          </div>
          <div className="mt-7 divide-y divide-marketing-primary/10">
            {sectionRows.map(([section, score, accuracy]) => (
              <div
                key={section}
                className="grid grid-cols-[1fr_auto_auto] items-center gap-4 py-4"
              >
                <span className="text-sm font-semibold">{section}</span>
                <strong className="text-sm tabular-nums">{score}</strong>
                <span className="w-10 text-right text-xs text-marketing-charcoal/40">
                  {accuracy}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section
        data-detail-reveal
        className="mt-5 grid gap-5 lg:grid-cols-[0.85fr_1.15fr]"
      >
        <div className="rounded-[2rem] bg-marketing-accent p-8 sm:p-10">
          <CalendarDays className="h-5 w-5 text-marketing-primary" />
          <h3 className={`mt-5 text-2xl font-bold ${typo.headingSans}`}>
            Review heatmap
          </h3>
          <p
            className={`mt-3 text-sm leading-6 text-marketing-charcoal/60 ${typo.secondarySans}`}
          >
            Daily question and set attempts make consistency visible without
            turning the platform into a guilt counter.
          </p>
          <div aria-hidden className="mt-7 grid grid-cols-12 gap-1">
            {Array.from({ length: 60 }).map((_, index) => (
              <span
                key={index}
                className={`aspect-square rounded-[2px] ${index % 9 === 0 ? "bg-marketing-primary" : index % 4 === 0 ? "bg-marketing-primary/55" : index % 3 === 0 ? "bg-marketing-primary/25" : "bg-white/60"}`}
              />
            ))}
          </div>
        </div>
        <div className="rounded-[2rem] bg-marketing-primary p-8 text-marketing-cream sm:p-10">
          <Activity className="h-5 w-5 text-marketing-accent" />
          <h3 className={`mt-5 text-3xl font-bold ${typo.headingSans}`}>
            Turn analysis into a decision.
          </h3>
          <p
            className={`mt-4 max-w-xl text-sm leading-6 text-marketing-cream/65 ${typo.secondarySans}`}
          >
            Open any section, mock or set to inspect timing and answers. Then
            use that evidence to choose the next lesson, trainer or targeted
            practice session.
          </p>
          <div className="mt-8 flex items-center gap-3 border-t border-white/15 pt-6">
            <TrendingUp className="h-5 w-5 text-marketing-accent" />
            <span className="text-sm font-semibold">
              Progress should change what you practise tomorrow.
            </span>
          </div>
        </div>
      </section>
    </div>
  );
}
