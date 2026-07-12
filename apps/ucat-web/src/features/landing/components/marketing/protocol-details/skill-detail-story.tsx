import { MARKETING_TOKENS } from "@altitutor/shared";
import { BrainCircuit, Calculator, Flame, Gauge, Trophy } from "lucide-react";

const { typography: typo } = MARKETING_TOKENS;

export function SkillDetailStory() {
  return (
    <div className="mx-auto max-w-7xl px-5 pb-24 pt-12 sm:px-8 sm:pt-16 lg:px-12 lg:pt-20">
      <section className="text-center" data-detail-reveal>
        <p
          className={`text-xs font-bold uppercase tracking-[0.2em] text-marketing-primary ${typo.dataMono}`}
        >
          Deliberate practice
        </p>
        <h2
          id="protocol-detail-skill"
          className={`mx-auto mt-5 max-w-5xl text-4xl font-bold tracking-[-0.05em] sm:text-6xl ${typo.headingSans}`}
        >
          Isolate the skill that is costing you marks.
        </h2>
        <p
          className={`mx-auto mt-7 max-w-3xl text-lg leading-8 text-marketing-charcoal/62 ${typo.secondarySans}`}
        >
          A full question mixes reading, calculation and exam technique. Skill
          trainers strip that complexity away so you can repeat one mental move
          until it becomes fast and reliable.
        </p>
      </section>

      <section
        data-detail-reveal
        aria-hidden
        className="mx-auto mt-14 max-w-5xl overflow-hidden rounded-[2rem] border border-marketing-primary/10 bg-white shadow-[0_24px_70px_rgba(10,41,65,0.12)]"
      >
        <div className="flex items-center justify-between border-b border-marketing-primary/10 px-6 py-4">
          <div className="flex items-center gap-3">
            <BrainCircuit className="h-5 w-5 text-marketing-primary" />
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-marketing-primary">
                Quick syllogisms
              </p>
              <p className="text-sm font-semibold">
                Does the conclusion follow?
              </p>
            </div>
          </div>
          <span className="text-sm font-bold tabular-nums">00:42</span>
        </div>
        <div className="grid gap-0 lg:grid-cols-[1fr_240px]">
          <div className="p-6 sm:p-9">
            <p className="text-sm text-marketing-charcoal/55">
              All surgeons are doctors. No doctors are architects.
            </p>
            <p className="mt-4 text-xl font-bold">
              No surgeons are architects.
            </p>
            <div className="mt-8 grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-marketing-accent bg-marketing-accent/25 p-4 text-center text-sm font-bold">
                Yes
              </div>
              <div className="rounded-xl border border-marketing-primary/10 p-4 text-center text-sm font-bold">
                No
              </div>
            </div>
          </div>
          <div className="border-t border-marketing-primary/10 bg-marketing-cream p-6 lg:border-l lg:border-t-0">
            {[
              ["Score", "8"],
              ["Streak", "4"],
              ["Best", "18"],
            ].map(([label, value], index) => (
              <div
                key={label}
                className="flex items-center justify-between border-b border-marketing-primary/10 py-4 first:pt-0"
              >
                <span className="text-xs font-semibold text-marketing-charcoal/45">
                  {label}
                </span>
                <span className="flex items-center gap-2 text-xl font-bold">
                  {index === 1 ? (
                    <Flame className="h-4 w-4 text-marketing-primary" />
                  ) : index === 2 ? (
                    <Trophy className="h-4 w-4 text-marketing-primary" />
                  ) : null}
                  {value}
                </span>
              </div>
            ))}
            <p className="mt-5 text-xs font-semibold text-marketing-primary">
              Correct · next drill loading
            </p>
          </div>
        </div>
      </section>

      <section
        data-detail-reveal
        className="mt-20 grid gap-6 lg:grid-cols-[0.8fr_1.2fr]"
      >
        <div className="rounded-[2rem] bg-marketing-accent p-8 sm:p-10">
          <Gauge className="h-5 w-5 text-marketing-primary" />
          <h3 className={`mt-5 text-3xl font-bold ${typo.headingSans}`}>
            Beat your own baseline.
          </h3>
          <p
            className={`mt-4 text-sm leading-6 text-marketing-charcoal/65 ${typo.secondarySans}`}
          >
            Scores, streaks and personal bests show whether repetition is
            producing real speed—not just familiarity.
          </p>
        </div>
        <div className="rounded-[2rem] border border-marketing-primary/10 bg-white p-8 sm:p-10">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-marketing-primary">
            Choose the precise trainer
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {[
              ["Quick syllogisms", BrainCircuit],
              ["Mental maths", Gauge],
              ["Calculator maths", Calculator],
            ].map(([label, Icon]) => {
              const TrainerIcon = Icon as typeof BrainCircuit;
              return (
                <div
                  key={label as string}
                  className="border-t border-marketing-primary/15 pt-5"
                >
                  <TrainerIcon className="h-5 w-5 text-marketing-primary" />
                  <p className="mt-3 text-sm font-bold">{label as string}</p>
                  <p className="mt-1 text-xs text-marketing-charcoal/45">
                    Short timed drill
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}
