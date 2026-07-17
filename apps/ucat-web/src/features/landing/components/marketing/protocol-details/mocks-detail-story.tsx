import { MARKETING_TOKENS } from "@altitutor/shared";
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Calculator,
  Check,
  Clock3,
  Flag,
  Layers3,
  Navigation,
  Play,
} from "lucide-react";

const { typography: typo } = MARKETING_TOKENS;

export function MocksDetailStory() {
  return (
    <div className="mx-auto max-w-5xl px-5 pb-24 pt-10 sm:px-8 sm:pt-14 lg:px-12">
      <section data-detail-reveal>
        <p
          className={`text-xs font-bold uppercase tracking-[0.18em] text-marketing-primary ${typo.dataMono}`}
        >
          Mock exam simulation
        </p>
        <h2
          id="protocol-detail-mocks"
          className={`mt-4 max-w-3xl text-4xl font-bold tracking-[-0.04em] sm:text-5xl ${typo.headingSans}`}
        >
          Build section stamina, then rehearse the complete exam
        </h2>
        <p
          className={`mt-5 max-w-3xl text-base leading-7 text-marketing-charcoal/62 sm:text-lg ${typo.secondarySans}`}
        >
          Curated sets provide sustained practice within one UCAT section. Full
          mocks then combine the sections in the same timed question engine used
          throughout the platform.
        </p>
      </section>

      <section data-detail-reveal className="mt-16">
        <div className="grid gap-7 lg:grid-cols-[0.75fr_1.25fr] lg:items-center">
          <div>
            <p className="text-xs font-bold text-marketing-primary">01</p>
            <h3 className={`mt-3 text-2xl font-bold ${typo.headingSans}`}>
              Curated question sets develop sustained section practice
            </h3>
            <p className="mt-4 text-sm leading-6 text-marketing-charcoal/60">
              Sets group questions by section and topic, with a defined length
              and pacing target. Students can resume an unfinished set, see what
              has already been attempted and move gradually toward the workload
              of a complete mock.
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
                  Verbal Reasoning
                </p>
                <h4 className="mt-1 text-base font-bold">Question sets</h4>
              </div>
              <span className="flex items-center gap-1 rounded-full bg-marketing-accent/20 px-3 py-1.5 text-[9px] font-bold text-marketing-primary">
                <Layers3 className="h-3.5 w-3.5" /> 18 sets
              </span>
            </div>
            <div className="mt-5 space-y-3">
              {[
                [
                  "Verbal Reasoning Set 04",
                  "Reading comprehension",
                  "12 questions",
                  "42%",
                ],
                [
                  "Verbal Reasoning Set 05",
                  "Author opinion",
                  "16 questions",
                  "Not started",
                ],
                [
                  "Verbal Reasoning Set 06",
                  "Inference",
                  "14 questions",
                  "Not started",
                ],
              ].map(([title, topic, count, status], index) => (
                <div key={title} className="rounded-xl bg-marketing-cream p-4">
                  <div className="flex items-center gap-3">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-marketing-primary">
                      <Play className="h-3.5 w-3.5 fill-current" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-bold">{title}</p>
                      <p className="mt-1 text-[9px] text-marketing-charcoal/40">
                        {topic} · {count}
                      </p>
                    </div>
                    <span className="text-[9px] font-semibold text-marketing-primary">
                      {status}
                    </span>
                  </div>
                  {index === 0 ? (
                    <div className="ml-10 mt-3 h-1.5 rounded-full bg-white">
                      <div className="h-full w-[42%] rounded-full bg-marketing-primary" />
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section data-detail-reveal className="mt-20">
        <div>
          <p className="text-xs font-bold text-marketing-primary">02</p>
          <h3 className={`mt-3 text-2xl font-bold ${typo.headingSans}`}>
            Full mocks use the UCAT-style question engine
          </h3>
          <p className="mt-4 max-w-3xl text-sm leading-6 text-marketing-charcoal/60">
            The engine includes section timing, question counts, calculator and
            flag controls, Previous, Navigator and Next buttons, four answer
            options and the same keyboard shortcuts used during preparation. The
            timer counts down in real time while the mock is running.
          </p>
        </div>
        <div
          data-ui-animate
          aria-hidden
          className="mt-8 overflow-hidden rounded-2xl border border-[#0b6ca2]/30 bg-white font-[Arial,sans-serif] shadow-[0_22px_60px_rgba(10,41,65,0.12)]"
        >
          <div className="flex min-h-11 items-center justify-between bg-[#0b6ca2] px-4 text-white">
            <span className="text-xs font-bold">Verbal Reasoning</span>
            <span className="text-[10px]">
              Time Remaining 20:14 · Question 7 of 44
            </span>
          </div>
          <div className="flex min-h-8 items-center justify-between bg-[#4f7ec1] px-4 text-[10px] text-white">
            <span className="flex items-center gap-1.5">
              <Calculator className="h-3.5 w-3.5" />
              <span>
                <u>C</u>alculator
              </span>
            </span>
            <span className="flex items-center gap-1.5">
              <Flag className="h-3.5 w-3.5" />
              <span>
                <u>F</u>lag for Review
              </span>
            </span>
          </div>
          <div className="grid min-h-[330px] md:grid-cols-[0.9fr_1.1fr] md:divide-x md:divide-slate-300">
            <div className="bg-slate-50 p-5">
              <p className="text-xs font-bold">Scientific reporting</p>
              <p className="mt-4 text-[11px] leading-5 text-slate-600">
                Independent review allows researchers to test whether results
                can be repeated. Transparency about uncertainty is central to
                public trust in new findings.
              </p>
            </div>
            <div className="p-5">
              <p className="text-xs font-bold leading-5">
                The passage suggests that public confidence is most likely to
                improve when...
              </p>
              <div className="mt-4 space-y-2">
                {[
                  "results are independently verified",
                  "research is completed rapidly",
                  "all uncertainty is removed",
                  "findings are never revised",
                ].map((answer, index) => (
                  <div
                    key={answer}
                    className={`flex items-center gap-3 border p-3 text-[10px] ${index === 0 ? "border-[#0b6ca2] bg-[#e6f0f4]" : "border-slate-300"}`}
                  >
                    <span
                      className={`flex h-4 w-4 items-center justify-center rounded-full border ${index === 0 ? "border-[#0b6ca2] bg-[#0b6ca2] text-white" : "border-slate-400"}`}
                    >
                      {index === 0 ? <Check className="h-2.5 w-2.5" /> : null}
                    </span>
                    {answer}
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="flex h-11 items-stretch justify-between bg-[#0b6ca2] text-white">
            <span className="flex items-center gap-1 border-r border-white/40 px-4 text-[10px]">
              <ArrowLeft className="h-3 w-3" />
              <span>
                <u>P</u>revious
              </span>
            </span>
            <div className="flex items-stretch">
              <span className="flex items-center gap-1 border-l border-white/40 px-4 text-[10px]">
                <Navigation className="h-3 w-3" />
                <span>
                  Na<u>v</u>igator
                </span>
              </span>
              <span className="flex items-center gap-1 border-l border-white/40 bg-[#4f7ec1] px-4 text-[10px] font-bold">
                <span>
                  <u>N</u>ext
                </span>
                <ArrowRight className="h-3 w-3" />
              </span>
            </div>
          </div>
        </div>
      </section>

      <section data-detail-reveal className="mt-20">
        <div className="grid gap-7 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
          <div>
            <p className="text-xs font-bold text-marketing-primary">03</p>
            <h3 className={`mt-3 text-2xl font-bold ${typo.headingSans}`}>
              Set and mock attempts use the same analysis system
            </h3>
            <p className="mt-4 text-sm leading-6 text-marketing-charcoal/60">
              After submission, the attempt page summarises the result by
              section and question. Review accuracy, average pace, flagged
              questions and explanations, then use the weak topics to choose the
              next set or practice session.
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
                  Mock attempt analysis
                </p>
                <h4 className="mt-1 text-base font-bold">UCAT Mock 3</h4>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold">2310</p>
                <p className="text-[9px] text-marketing-charcoal/40">
                  + Band 2
                </p>
              </div>
            </div>
            <div className="mt-5 grid grid-cols-3 gap-2">
              {[
                ["Verbal Reasoning", "720", "31/44"],
                ["Decision Making", "790", "27/35"],
                ["Quantitative Reasoning", "800", "30/36"],
              ].map(([section, score, marks]) => (
                <div
                  key={section}
                  className="rounded-xl bg-marketing-cream p-3"
                >
                  <BarChart3 className="h-3.5 w-3.5 text-marketing-primary" />
                  <p className="mt-2 text-[8px] text-marketing-charcoal/40">
                    {section}
                  </p>
                  <p className="mt-1 text-base font-bold">{score}</p>
                  <p className="text-[8px] text-marketing-charcoal/40">
                    {marks}
                  </p>
                </div>
              ))}
            </div>
            <div className="mt-5 flex items-center gap-3 rounded-xl bg-marketing-accent/20 p-4">
              <Clock3 className="h-5 w-5 text-marketing-primary" />
              <div>
                <p className="text-xs font-bold">Timing review</p>
                <p className="mt-1 text-[10px] text-marketing-charcoal/55">
                  6 questions exceeded the recommended pace
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
