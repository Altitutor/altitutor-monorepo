import { MARKETING_TOKENS } from "@altitutor/shared";
import { BookOpen, Check, ChevronRight, Play, Zap } from "lucide-react";

const { typography: typo } = MARKETING_TOKENS;

const lessons = [
  ["How the subtest works", "Complete"],
  ["Finding the author’s position", "Complete"],
  ["Reading for inference", "Lesson 3"],
  ["Handling qualifying language", "Next"],
] as const;

export function LearningDetailStory() {
  return (
    <div className="mx-auto max-w-7xl px-5 pb-24 pt-12 sm:px-8 sm:pt-16 lg:px-12 lg:pt-20">
      <section className="grid items-center gap-12 lg:grid-cols-[0.82fr_1.18fr] lg:gap-20">
        <div data-detail-reveal>
          <p
            className={`text-xs font-bold uppercase tracking-[0.2em] text-marketing-primary ${typo.dataMono}`}
          >
            A course, not a content dump
          </p>
          <h2
            id="protocol-detail-learning"
            className={`mt-5 text-4xl font-bold tracking-[-0.05em] sm:text-6xl ${typo.headingSans}`}
          >
            Understand the method before the timer starts.
          </h2>
          <p
            className={`mt-7 text-lg leading-8 text-marketing-charcoal/62 ${typo.secondarySans}`}
          >
            Every UCAT section is broken into an ordered path of lessons. You
            learn the reasoning pattern, see it applied and move into a related
            question while the idea is still fresh.
          </p>
        </div>

        <div
          data-detail-reveal
          aria-hidden
          className="overflow-hidden rounded-[1.75rem] border border-marketing-primary/10 bg-white shadow-[0_24px_70px_rgba(10,41,65,0.12)]"
        >
          <div className="flex items-center justify-between border-b border-marketing-primary/10 px-6 py-5">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-marketing-primary">
                Verbal Reasoning
              </p>
              <p className="mt-1 text-xl font-bold">Reading critically</p>
            </div>
            <span className="text-xs font-semibold text-marketing-primary">
              68% complete
            </span>
          </div>
          <div className="grid sm:grid-cols-[150px_1fr]">
            <div className="border-b border-marketing-primary/10 bg-slate-50 p-5 sm:border-b-0 sm:border-r">
              <BookOpen className="h-5 w-5 text-marketing-primary" />
              {[
                "Overview",
                "Verbal Reasoning",
                "Decision Making",
                "Quantitative Reasoning",
                "Situational Judgement",
              ].map((section, index) => (
                <div
                  key={section}
                  className={`mt-3 text-[11px] leading-4 ${index === 1 ? "font-bold text-marketing-primary" : "text-slate-400"}`}
                >
                  {section}
                </div>
              ))}
            </div>
            <div className="p-5 sm:p-7">
              <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full w-[68%] bg-marketing-primary" />
              </div>
              <div className="mt-5 divide-y divide-slate-100 border-y border-slate-100">
                {lessons.map(([lesson, status], index) => (
                  <div key={lesson} className="flex items-center gap-3 py-4">
                    {index < 2 ? (
                      <Check className="h-4 w-4 text-marketing-primary" />
                    ) : index === 2 ? (
                      <Play className="h-4 w-4 fill-marketing-primary text-marketing-primary" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-slate-300" />
                    )}
                    <span className="min-w-0 flex-1 text-sm font-semibold">
                      {lesson}
                    </span>
                    <span className="text-[10px] font-semibold text-slate-400">
                      {status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section data-detail-reveal className="mt-20 grid gap-4 lg:grid-cols-3">
        {[
          [
            "1. Learn",
            "A concise explanation gives you the decision rule and the common traps.",
          ],
          [
            "2. Apply",
            "Embedded examples make you use the method instead of only recognising it.",
          ],
          [
            "3. Reinforce",
            "The lesson hands you into the relevant trainer or question bank.",
          ],
        ].map(([title, copy]) => (
          <div
            key={title}
            className="border-t border-marketing-primary/15 py-7 lg:px-6 lg:first:pl-0"
          >
            <h3 className={`text-xl font-bold ${typo.headingSans}`}>{title}</h3>
            <p
              className={`mt-3 text-sm leading-6 text-marketing-charcoal/55 ${typo.secondarySans}`}
            >
              {copy}
            </p>
          </div>
        ))}
      </section>

      <section
        data-detail-reveal
        className="mt-10 grid items-center gap-8 rounded-[2rem] bg-marketing-primary p-8 text-marketing-cream sm:p-12 lg:grid-cols-[1fr_auto]"
      >
        <div>
          <Zap className="h-5 w-5 text-marketing-accent" />
          <p
            className={`mt-5 max-w-3xl text-2xl font-semibold leading-snug sm:text-4xl ${typo.headingSans}`}
          >
            You always know what to learn next—and exactly where to practise it.
          </p>
        </div>
        <span
          className={`text-xs font-bold uppercase tracking-[0.18em] text-marketing-accent ${typo.dataMono}`}
        >
          Your place is saved
        </span>
      </section>
    </div>
  );
}
