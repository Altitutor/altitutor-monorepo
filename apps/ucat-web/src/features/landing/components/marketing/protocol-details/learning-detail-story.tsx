import { MARKETING_TOKENS } from "@altitutor/shared";
import {
  BookOpen,
  Check,
  ChevronRight,
  FileQuestion,
  Lightbulb,
  Play,
  PlayCircle,
  Video,
} from "lucide-react";

const { typography: typo } = MARKETING_TOKENS;

export function LearningDetailStory() {
  return (
    <div className="mx-auto max-w-5xl px-5 pb-24 pt-10 sm:px-8 sm:pt-14 lg:px-12">
      <section data-detail-reveal>
        <p
          className={`text-xs font-bold uppercase tracking-[0.18em] text-marketing-primary ${typo.dataMono}`}
        >
          Learn
        </p>
        <h2
          id="protocol-detail-learning"
          className={`mt-4 max-w-3xl text-4xl font-bold tracking-[-0.04em] sm:text-5xl ${typo.headingSans}`}
        >
          How the learning course is structured
        </h2>
        <p
          className={`mt-5 max-w-3xl text-base leading-7 text-marketing-charcoal/62 sm:text-lg ${typo.secondarySans}`}
        >
          The learning area is organised as a course rather than a collection of
          unrelated notes. Each UCAT section has its own modules, lessons,
          worked examples and embedded practice.
        </p>
      </section>

      <section data-detail-reveal className="mt-16">
        <div className="grid gap-7 lg:grid-cols-[0.72fr_1.28fr] lg:items-center">
          <div>
            <p className="text-xs font-bold text-marketing-primary">01</p>
            <h3 className={`mt-3 text-2xl font-bold ${typo.headingSans}`}>
              Navigate the complete UCAT course
            </h3>
            <p className="mt-4 text-sm leading-6 text-marketing-charcoal/60">
              The left navigation separates introductory content from Verbal
              Reasoning, Decision Making, Quantitative Reasoning and Situational
              Judgement. Within each section, lessons are ordered so
              prerequisite ideas are covered before harder applications.
            </p>
          </div>
          <div
            data-ui-animate
            aria-hidden
            className="grid overflow-hidden rounded-2xl border border-marketing-primary/10 bg-white shadow-[0_18px_50px_rgba(10,41,65,0.09)] sm:grid-cols-[180px_1fr]"
          >
            <div className="border-b border-slate-200 bg-slate-50 p-4 sm:border-b-0 sm:border-r">
              <div className="flex items-center gap-2 text-sm font-bold">
                <BookOpen className="h-4 w-4 text-marketing-primary" /> Learn
              </div>
              <div className="mt-4 grid grid-cols-2 gap-1 sm:grid-cols-1">
                {[
                  "Introduction",
                  "Verbal Reasoning",
                  "Decision Making",
                  "Quantitative Reasoning",
                  "Situational Judgement",
                ].map((label, index) => (
                  <div
                    key={label}
                    className={`rounded-lg px-3 py-2 text-[10px] ${index === 1 ? "bg-marketing-accent/20 font-bold text-marketing-primary" : "text-slate-500"}`}
                  >
                    {label}
                  </div>
                ))}
              </div>
            </div>
            <div className="p-5 sm:p-7">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-wider text-marketing-primary">
                    Verbal Reasoning
                  </p>
                  <p className="mt-1 text-base font-bold">Reading critically</p>
                </div>
                <span className="text-xs font-semibold text-marketing-primary">
                  68% complete
                </span>
              </div>
              <div className="mt-5 h-1.5 rounded-full bg-slate-100">
                <div className="h-full w-[68%] rounded-full bg-marketing-primary" />
              </div>
              <div className="mt-5 divide-y divide-slate-100">
                {[
                  ["How the subtest works", "Complete"],
                  ["Finding the author’s position", "Complete"],
                  ["Reading for inference", "Lesson 3"],
                  ["Handling qualifying language", "Next"],
                ].map(([label, status], index) => (
                  <div key={label} className="flex items-center gap-3 py-3">
                    {index < 2 ? (
                      <Check className="h-4 w-4 text-marketing-primary" />
                    ) : index === 2 ? (
                      <Play className="h-4 w-4 fill-marketing-primary text-marketing-primary" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-slate-300" />
                    )}
                    <span className="flex-1 text-xs font-semibold">
                      {label}
                    </span>
                    <span className="text-[9px] text-slate-400">{status}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section data-detail-reveal className="mt-20">
        <div className="grid gap-7 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
          <div
            data-ui-animate
            aria-hidden
            className="rounded-2xl border border-marketing-primary/10 bg-white p-6 shadow-[0_18px_50px_rgba(10,41,65,0.08)] sm:p-8"
          >
            <p className="text-[9px] font-bold uppercase tracking-wider text-marketing-primary">
              Introduction to the UCAT
            </p>
            <h4 className="mt-2 text-lg font-bold">Start here</h4>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {[
                ["What the UCAT tests", "8 min"],
                ["How the sections are timed", "6 min"],
                ["Using the question engine", "Interactive"],
                ["Planning your preparation", "7 min"],
              ].map(([label, meta]) => (
                <div key={label} className="rounded-xl bg-marketing-cream p-4">
                  <PlayCircle className="h-4 w-4 text-marketing-primary" />
                  <p className="mt-3 text-xs font-bold">{label}</p>
                  <p className="mt-1 text-[9px] text-marketing-charcoal/40">
                    {meta}
                  </p>
                </div>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs font-bold text-marketing-primary">02</p>
            <h3 className={`mt-3 text-2xl font-bold ${typo.headingSans}`}>
              Introductory modules establish the basics
            </h3>
            <p className="mt-4 text-sm leading-6 text-marketing-charcoal/60">
              New students can begin with the exam format, timing, controls and
              preparation approach before opening a section-specific lesson.
              This gives the rest of the course a clear starting point.
            </p>
          </div>
        </div>
      </section>

      <section data-detail-reveal className="mt-20">
        <div className="grid gap-7 lg:grid-cols-[0.72fr_1.28fr] lg:items-center">
          <div>
            <p className="text-xs font-bold text-marketing-primary">03</p>
            <h3 className={`mt-3 text-2xl font-bold ${typo.headingSans}`}>
              Techniques are explained in small steps
            </h3>
            <p className="mt-4 text-sm leading-6 text-marketing-charcoal/60">
              Lessons describe the decision rule, show where it applies and
              identify the common traps. The aim is to give students a method
              they can repeat, not a long list of tips to memorise.
            </p>
          </div>
          <div
            data-ui-animate
            aria-hidden
            className="rounded-2xl bg-marketing-primary p-6 text-marketing-cream sm:p-8"
          >
            <div className="flex items-center gap-2 text-marketing-accent">
              <Lightbulb className="h-4 w-4" />
              <span className="text-[9px] font-bold uppercase tracking-wider">
                Technique
              </span>
            </div>
            <h4 className="mt-4 text-lg font-bold">
              Separate what the passage says from what seems likely
            </h4>
            <div className="mt-5 space-y-3">
              {[
                "Find the exact claim in the passage.",
                "Check whether the statement adds a new assumption.",
                "Choose Can’t tell when the evidence is incomplete.",
              ].map((text, index) => (
                <div
                  key={text}
                  className="flex gap-3 border-t border-white/15 pt-3"
                >
                  <span className="text-xs font-bold text-marketing-accent">
                    {index + 1}
                  </span>
                  <p className="text-xs leading-5 text-marketing-cream/70">
                    {text}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section data-detail-reveal className="mt-20">
        <div className="grid gap-7 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
          <div
            data-ui-animate
            aria-hidden
            className="rounded-2xl border border-marketing-primary/10 bg-white p-6 shadow-[0_18px_50px_rgba(10,41,65,0.08)] sm:p-8"
          >
            <div className="flex items-center gap-2 text-marketing-primary">
              <FileQuestion className="h-4 w-4" />
              <span className="text-[9px] font-bold uppercase tracking-wider">
                Check your understanding
              </span>
            </div>
            <p className="mt-4 text-sm font-semibold">
              The passage confirms that the treatment improved average recovery
              time. Can we conclude that every patient recovered faster?
            </p>
            <div className="mt-5 grid grid-cols-3 gap-2">
              {[
                ["True", false],
                ["False", true],
                ["Can’t tell", false],
              ].map(([label, selected]) => (
                <div
                  key={String(label)}
                  className={`rounded-xl border p-3 text-center text-xs font-bold ${selected ? "border-marketing-primary bg-marketing-accent/25" : "border-slate-200"}`}
                >
                  {label}
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-xl bg-marketing-cream p-4 text-xs leading-5 text-marketing-charcoal/60">
              <strong className="text-marketing-charcoal">Walkthrough:</strong>{" "}
              an average result does not establish that every individual had the
              same outcome.
            </div>
          </div>
          <div>
            <p className="text-xs font-bold text-marketing-primary">04</p>
            <h3 className={`mt-3 text-2xl font-bold ${typo.headingSans}`}>
              Questions and walkthroughs are embedded in the lesson
            </h3>
            <p className="mt-4 text-sm leading-6 text-marketing-charcoal/60">
              Students apply a technique immediately, then compare their
              reasoning with a worked explanation. The lesson can therefore
              correct a misunderstanding before it becomes a repeated habit.
            </p>
          </div>
        </div>
      </section>

      <section data-detail-reveal className="mt-20">
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="rounded-2xl bg-marketing-accent p-7 sm:p-8">
            <p className="text-xs font-bold text-marketing-primary">05</p>
            <h3 className={`mt-3 text-2xl font-bold ${typo.headingSans}`}>
              Progress is saved at lesson and module level
            </h3>
            <p className="mt-4 text-sm leading-6 text-marketing-charcoal/60">
              Completed blocks, the current lesson and overall module progress
              remain visible in the navigation, so students can resume without
              finding their place again.
            </p>
            <div data-ui-animate className="mt-6 rounded-xl bg-white/70 p-4">
              <div className="flex justify-between text-xs font-semibold">
                <span>Reading critically</span>
                <span>68%</span>
              </div>
              <div className="mt-3 h-2 rounded-full bg-white">
                <div className="h-full w-[68%] rounded-full bg-marketing-primary" />
              </div>
            </div>
          </div>
          <div className="rounded-2xl border border-marketing-primary/10 bg-white p-7 sm:p-8">
            <div className="flex items-center justify-between gap-4">
              <Video className="h-5 w-5 text-marketing-primary" />
              <span className="rounded-full bg-marketing-accent/20 px-3 py-1 text-[9px] font-bold text-marketing-primary">
                Coming soon
              </span>
            </div>
            <h3 className={`mt-5 text-2xl font-bold ${typo.headingSans}`}>
              Video explanations and walkthroughs
            </h3>
            <p className="mt-4 text-sm leading-6 text-marketing-charcoal/60">
              Planned video blocks will provide an alternative explanation of
              key techniques and guided walkthroughs of representative UCAT
              questions.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
