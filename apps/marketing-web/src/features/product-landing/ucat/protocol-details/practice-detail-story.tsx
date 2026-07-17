import { MARKETING_TOKENS } from "@altitutor/shared";
import {
  BarChart3,
  BrainCircuit,
  Check,
  Clock3,
  Flame,
  Gauge,
  Smartphone,
  Target,
  Trophy,
} from "lucide-react";

const { typography: typo } = MARKETING_TOKENS;

export function PracticeDetailStory() {
  return (
    <div className="mx-auto max-w-5xl px-5 pb-24 pt-10 sm:px-8 sm:pt-14 lg:px-12">
      <section data-detail-reveal>
        <p
          className={`text-xs font-bold uppercase tracking-[0.18em] text-marketing-primary ${typo.dataMono}`}
        >
          Practice tools
        </p>
        <h2
          id="protocol-detail-practice"
          className={`mt-4 max-w-3xl text-4xl font-bold tracking-[-0.04em] sm:text-5xl ${typo.headingSans}`}
        >
          Choose the type of practice that matches the problem
        </h2>
        <p
          className={`mt-5 max-w-3xl text-base leading-7 text-marketing-charcoal/62 sm:text-lg ${typo.secondarySans}`}
        >
          Practice tools range from short drills for one skill to configured
          multi-question sessions. All attempts feed into the same review and
          progress system.
        </p>
      </section>

      <section data-detail-reveal className="mt-16">
        <div className="grid gap-7 lg:grid-cols-[0.75fr_1.25fr] lg:items-center">
          <div>
            <p className="text-xs font-bold text-marketing-primary">01</p>
            <h3 className={`mt-3 text-2xl font-bold ${typo.headingSans}`}>
              Skill trainers isolate a specific ability
            </h3>
            <p className="mt-4 text-sm leading-6 text-marketing-charcoal/60">
              Trainers remove the surrounding complexity of a full UCAT
              question. Students can repeatedly practise skills such as quick
              syllogisms, mental maths or calculator use while seeing their
              score, streak and personal best.
            </p>
          </div>
          <div
            data-ui-animate
            aria-hidden
            className="rounded-2xl border border-marketing-primary/10 bg-white p-6 shadow-[0_18px_50px_rgba(10,41,65,0.09)]"
          >
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <BrainCircuit className="h-5 w-5 text-marketing-primary" />
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-wider text-marketing-primary">
                    Skill trainer
                  </p>
                  <p className="text-sm font-bold">Quick syllogisms</p>
                </div>
              </div>
              <span className="flex items-center gap-1 rounded-full bg-marketing-cream px-3 py-1.5 text-xs font-bold">
                <Clock3 className="h-3.5 w-3.5" /> 00:42
              </span>
            </div>
            <div className="mt-5 grid grid-cols-3 gap-2">
              {[
                ["Score", "8"],
                ["Streak", "4"],
                ["Best", "18"],
              ].map(([label, value], index) => (
                <div key={label} className="rounded-xl bg-marketing-cream p-3">
                  <p className="text-[8px] uppercase text-marketing-charcoal/40">
                    {label}
                  </p>
                  <p className="mt-1 flex items-center gap-1 text-lg font-bold">
                    {index === 1 ? <Flame className="h-4 w-4" /> : null}
                    {index === 2 ? <Trophy className="h-4 w-4" /> : null}
                    {value}
                  </p>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-xl bg-marketing-cream p-4">
              <p className="text-xs text-marketing-charcoal/55">
                All surgeons are doctors. No doctors are architects.
              </p>
              <p className="mt-2 text-sm font-bold">
                No surgeons are architects.
              </p>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <div className="rounded-lg border border-marketing-primary bg-marketing-accent/25 py-2.5 text-center text-xs font-bold">
                  Yes
                </div>
                <div className="rounded-lg border border-marketing-primary/15 py-2.5 text-center text-xs font-bold">
                  No
                </div>
              </div>
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
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[9px] font-bold uppercase tracking-wider text-marketing-primary">
                  Custom practice session
                </p>
                <h4 className="mt-1 text-lg font-bold">Review setup</h4>
              </div>
              <span className="rounded-full bg-marketing-cream px-3 py-1 text-[9px] font-semibold">
                Step 4 of 4
              </span>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {[
                ["Section", "Decision Making"],
                ["Categories", "Syllogisms + Venn diagrams"],
                ["Session length", "20 questions"],
                ["Pacing", "Exam pace · 60 sec/question"],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl bg-marketing-cream p-4">
                  <p className="text-[9px] text-marketing-charcoal/40">
                    {label}
                  </p>
                  <p className="mt-1 text-xs font-bold">{value}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap gap-2 text-[9px] font-semibold">
              <span className="rounded-full bg-marketing-accent/20 px-3 py-1.5 text-marketing-primary">
                Include unanswered
              </span>
              <span className="rounded-full bg-marketing-accent/20 px-3 py-1.5 text-marketing-primary">
                Include incorrect
              </span>
              <span className="rounded-full bg-slate-100 px-3 py-1.5 text-slate-500">
                Exclude mastered
              </span>
            </div>
          </div>
          <div>
            <p className="text-xs font-bold text-marketing-primary">02</p>
            <h3 className={`mt-3 text-2xl font-bold ${typo.headingSans}`}>
              Custom sessions control content and pacing
            </h3>
            <p className="mt-4 text-sm leading-6 text-marketing-charcoal/60">
              Select the UCAT section, categories, number of questions and
              timing mode. Sessions can prioritise new questions, revisit
              incorrect work or run without a clock while a technique is still
              being learned.
            </p>
          </div>
        </div>
      </section>

      <section data-detail-reveal className="mt-20">
        <div className="grid gap-5 sm:grid-cols-[0.75fr_1.25fr]">
          <div className="rounded-2xl bg-marketing-accent p-7 sm:p-8">
            <div className="flex items-center justify-between">
              <Smartphone className="h-5 w-5 text-marketing-primary" />
              <span className="rounded-full bg-white/60 px-3 py-1 text-[9px] font-bold text-marketing-primary">
                Coming soon
              </span>
            </div>
            <p className="mt-5 text-xs font-bold text-marketing-primary">03</p>
            <h3 className={`mt-3 text-2xl font-bold ${typo.headingSans}`}>
              Practice from the mobile app
            </h3>
            <p className="mt-4 text-sm leading-6 text-marketing-charcoal/60">
              Planned mobile practice will make shorter drills and question
              sessions available away from a computer while keeping attempts in
              the same account and progress history.
            </p>
          </div>
          <div
            data-ui-animate
            aria-hidden
            className="rounded-2xl border border-marketing-primary/10 bg-white p-6 sm:p-8"
          >
            <div className="mx-auto max-w-[260px] rounded-[2rem] border-4 border-marketing-charcoal bg-marketing-cream p-3 shadow-xl">
              <div className="mx-auto h-1.5 w-16 rounded-full bg-marketing-charcoal/20" />
              <p className="mt-5 text-[9px] font-bold uppercase tracking-wider text-marketing-primary">
                Quick practice
              </p>
              <p className="mt-2 text-sm font-bold">Decision Making</p>
              <div className="mt-4 space-y-2">
                {[
                  "Quick syllogisms",
                  "Probability basics",
                  "Venn diagrams",
                ].map((label) => (
                  <div
                    key={label}
                    className="flex items-center justify-between rounded-xl bg-white p-3 text-[10px] font-semibold"
                  >
                    {label}{" "}
                    <Target className="h-3.5 w-3.5 text-marketing-primary" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section data-detail-reveal className="mt-20">
        <div className="grid gap-7 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
          <div>
            <p className="text-xs font-bold text-marketing-primary">04</p>
            <h3 className={`mt-3 text-2xl font-bold ${typo.headingSans}`}>
              Every session has an attempt analysis page
            </h3>
            <p className="mt-4 text-sm leading-6 text-marketing-charcoal/60">
              Review the session score, accuracy, average time and each answer.
              Explanations show why the correct option is supported, while
              timing data identifies questions that consumed too much of the
              session.
            </p>
          </div>
          <div
            data-ui-animate
            aria-hidden
            className="rounded-2xl border border-marketing-primary/10 bg-white p-6 shadow-[0_18px_50px_rgba(10,41,65,0.09)] sm:p-8"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[9px] font-bold uppercase tracking-wider text-marketing-primary">
                  Practice attempt
                </p>
                <h4 className="mt-1 text-base font-bold">
                  Decision Making · 20 questions
                </h4>
              </div>
              <span className="text-2xl font-bold">16/20</span>
            </div>
            <div className="mt-5 grid grid-cols-3 gap-2">
              {[
                ["Accuracy", "80%", BarChart3],
                ["Avg. time", "52 sec", Clock3],
                ["Target", "60 sec", Gauge],
              ].map(([label, value, Icon]) => {
                const MetricIcon = Icon as typeof BarChart3;
                return (
                  <div
                    key={String(label)}
                    className="rounded-xl bg-marketing-cream p-3"
                  >
                    <MetricIcon className="h-3.5 w-3.5 text-marketing-primary" />
                    <p className="mt-2 text-[8px] text-marketing-charcoal/40">
                      {label as string}
                    </p>
                    <p className="mt-1 text-xs font-bold">{value as string}</p>
                  </div>
                );
              })}
            </div>
            <div className="mt-5 divide-y divide-slate-100">
              {[
                ["Question 1", "Correct", "44 sec"],
                ["Question 2", "Incorrect", "71 sec"],
                ["Question 3", "Correct", "39 sec"],
              ].map(([question, result, time]) => (
                <div
                  key={question}
                  className="flex items-center gap-3 py-3 text-xs"
                >
                  <span
                    className={`flex h-6 w-6 items-center justify-center rounded-full ${result === "Correct" ? "bg-marketing-accent/25 text-marketing-primary" : "bg-red-50 text-red-600"}`}
                  >
                    {result === "Correct" ? (
                      <Check className="h-3.5 w-3.5" />
                    ) : (
                      "×"
                    )}
                  </span>
                  <span className="flex-1 font-semibold">{question}</span>
                  <span className="text-slate-400">{time}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
