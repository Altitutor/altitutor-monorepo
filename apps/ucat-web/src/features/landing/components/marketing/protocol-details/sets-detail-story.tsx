import { MARKETING_TOKENS } from "@altitutor/shared";
import {
  CheckCircle2,
  Layers3,
  ListChecks,
  Play,
  SlidersHorizontal,
} from "lucide-react";

const { typography: typo } = MARKETING_TOKENS;

export function SetsDetailStory() {
  return (
    <div className="mx-auto max-w-7xl px-5 pb-24 pt-12 sm:px-8 sm:pt-16 lg:px-12 lg:pt-20">
      <section className="grid items-center gap-12 lg:grid-cols-[0.75fr_1.25fr] lg:gap-20">
        <div data-detail-reveal>
          <p
            className={`text-xs font-bold uppercase tracking-[0.2em] text-marketing-primary ${typo.dataMono}`}
          >
            From accuracy to stamina
          </p>
          <h2
            id="protocol-detail-sets"
            className={`mt-5 text-4xl font-bold tracking-[-0.05em] sm:text-6xl ${typo.headingSans}`}
          >
            Join individual questions into focused blocks.
          </h2>
          <p
            className={`mt-7 text-lg leading-8 text-marketing-charcoal/62 ${typo.secondarySans}`}
          >
            Question sets make you hold concentration across a run of related
            questions without committing to a full mock. Resume unfinished work
            or create a set around one precise weakness.
          </p>
        </div>
        <div
          data-detail-reveal
          aria-hidden
          className="rounded-[2rem] border border-marketing-primary/10 bg-white p-6 shadow-[0_24px_70px_rgba(10,41,65,0.1)] sm:p-8"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-marketing-primary">
                Verbal Reasoning
              </p>
              <h3 className="mt-1 text-xl font-bold">Question sets</h3>
            </div>
            <span className="text-xs font-bold text-marketing-primary">
              18 available
            </span>
          </div>
          <div className="mt-6 divide-y divide-marketing-primary/10 border-y border-marketing-primary/10">
            {[
              ["Set 04", "Reading comprehension", "42%"],
              ["Set 05", "Author opinion", "Not started"],
              ["Set 06", "Inference", "Not started"],
            ].map(([title, category, status], index) => (
              <div key={title} className="flex items-center gap-4 py-4">
                {index === 0 ? (
                  <Play className="h-4 w-4 fill-marketing-primary text-marketing-primary" />
                ) : (
                  <ListChecks className="h-4 w-4 text-slate-300" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold">{title}</p>
                  <p className="mt-1 text-xs text-marketing-charcoal/40">
                    {category}
                  </p>
                  {index === 0 ? (
                    <div className="mt-2 h-1 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full w-[42%] bg-marketing-primary" />
                    </div>
                  ) : null}
                </div>
                <span className="text-xs font-semibold text-marketing-primary">
                  {status}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section
        data-detail-reveal
        className="mt-20 grid overflow-hidden rounded-[2rem] border border-marketing-primary/10 bg-white lg:grid-cols-[0.9fr_1.1fr]"
      >
        <div className="bg-marketing-primary p-8 text-marketing-cream sm:p-12">
          <SlidersHorizontal className="h-5 w-5 text-marketing-accent" />
          <h3 className={`mt-5 text-3xl font-bold ${typo.headingSans}`}>
            Build a custom set.
          </h3>
          <p
            className={`mt-4 text-sm leading-6 text-marketing-cream/65 ${typo.secondarySans}`}
          >
            Select section, categories, question count and evidence source. The
            generator creates a bounded task you can finish and review.
          </p>
        </div>
        <div aria-hidden className="p-8 sm:p-12">
          <p className="text-xs font-bold uppercase tracking-[0.15em] text-marketing-primary">
            Set configuration
          </p>
          {[
            ["Section", "Decision Making"],
            ["Categories", "Syllogisms · Logic puzzles"],
            ["Question source", "Unanswered + incorrect"],
            ["Length", "16 questions"],
          ].map(([label, value]) => (
            <div
              key={label}
              className="flex flex-col gap-1 border-b border-marketing-primary/10 py-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <span className="text-xs text-marketing-charcoal/40">
                {label}
              </span>
              <strong className="text-sm">{value}</strong>
            </div>
          ))}
        </div>
      </section>

      <section
        data-detail-reveal
        className="mt-16 flex flex-col items-start justify-between gap-8 border-t border-marketing-primary/15 pt-10 lg:flex-row lg:items-center"
      >
        <div className="flex items-start gap-4">
          <CheckCircle2 className="mt-1 h-5 w-5 shrink-0 text-marketing-primary" />
          <div>
            <h3 className={`text-2xl font-bold ${typo.headingSans}`}>
              Finish, review, then target again.
            </h3>
            <p
              className={`mt-2 max-w-2xl text-sm leading-6 text-marketing-charcoal/55 ${typo.secondarySans}`}
            >
              Set results feed the same progress record as practice and mocks,
              so the next custom set can respond to what actually happened.
            </p>
          </div>
        </div>
        <Layers3 className="h-12 w-12 text-marketing-accent" />
      </section>
    </div>
  );
}
