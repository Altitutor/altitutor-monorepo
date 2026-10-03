import {
  ArrowRight,
  BarChart3,
  CalendarCheck,
  Check,
  ClipboardCheck,
} from "lucide-react";
import { AnalyticsLink } from "../analytics-link";
import { PRODUCT_LINKS } from "@/lib/site";
import motion from "@/features/marketing/components/magnetic-button.module.css";
import {
  MARKETING_SECTION_EYEBROW_CLASS,
  MARKETING_CONTENT_WIDTH_CLASS,
  MARKETING_SECTION_PADDING_CLASS,
  MARKETING_SECTION_DESCRIPTION_CLASS,
  MARKETING_BODY_DESCRIPTION_CLASS,
  MARKETING_SECTION_HEADING_CLASS,
  MARKETING_CARD_TITLE_CLASS,
} from "@/features/marketing/section-styles";

import { MARKETING_TYPOGRAPHY as typo } from "@/features/marketing/theme";

const steps = [
  {
    number: "01",
    title: "Start free",
    body: "Create an account, set your target score, and tell us how much time you have to study.",
  },
  {
    number: "02",
    title: "Build your baseline",
    body: "Complete a benchmark test and our system will build you a personalised study plan, which adapts over time.",
  },
  {
    number: "03",
    title: "Follow your plan",
    body: "Work through learning modules, practice questions, and mocks, and see your predicted score improve over time.",
  },
] as const;

function StartVisual() {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/[0.06]">
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="rounded-xl bg-[#f2f3f4] p-3">
          <p className="text-[9px] uppercase tracking-wider text-black/38">
            Target score
          </p>
          <p className="mt-1 text-lg font-bold text-marketing-primary">2,350</p>
        </div>
        <div className="rounded-xl bg-[#f2f3f4] p-3">
          <p className="text-[9px] uppercase tracking-wider text-black/38">
            Weekly time
          </p>
          <p className="mt-1 text-lg font-bold text-marketing-primary">
            4 hours
          </p>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between rounded-xl bg-marketing-primary px-3 py-2.5 text-[10px] font-semibold text-white">
        <span>Account ready</span>
        <Check className="size-3.5 text-marketing-accent" aria-hidden />
      </div>
    </div>
  );
}

function BaselineVisual() {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/[0.06]">
      <div className="flex items-center gap-2 text-[10px] font-semibold">
        <ClipboardCheck className="size-4 text-marketing-primary" aria-hidden />{" "}
        Baseline progress
      </div>
      <div className="mt-4 space-y-3">
        {[
          ["Verbal Reasoning", 100],
          ["Decision Making", 100],
          ["Quantitative Reasoning", 64],
        ].map(([label, width]) => (
          <div key={String(label)}>
            <div className="flex justify-between text-[9px] text-black/45">
              <span>{label}</span>
              <span>{width === 100 ? "Complete" : "In progress"}</span>
            </div>
            <div className="mt-1.5 h-1.5 rounded-full bg-[#e8eaed]">
              <div
                className="h-full rounded-full bg-marketing-primary"
                style={{ width: `${width}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PlanVisual() {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/[0.06]">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-[10px] font-semibold">
          <CalendarCheck
            className="size-4 text-marketing-primary"
            aria-hidden
          />{" "}
          Today&apos;s plan
        </span>
        <span className="text-[9px] text-black/40">35 min</span>
      </div>
      <div className="mt-3 space-y-2">
        {[
          "Syllogism warm-up",
          "Targeted VR practice",
          "Review missed questions",
        ].map((task, index) => (
          <div
            key={task}
            className={`flex items-center gap-2 rounded-xl px-3 py-2.5 text-[10px] ${index === 1 ? "bg-marketing-primary font-semibold text-white" : "bg-[#f2f3f4]"}`}
          >
            <span
              className={`grid size-5 place-items-center rounded-full ${index === 1 ? "bg-white/15" : "bg-white"}`}
            >
              {index + 1}
            </span>
            <span className="flex-1">{task}</span>
            <ArrowRight className="size-3" aria-hidden />
          </div>
        ))}
      </div>
    </div>
  );
}

export function UcatHowItWorks() {
  return (
    <section
      id="how-it-works"
      className={`bg-marketing-cream ${MARKETING_SECTION_PADDING_CLASS}`}
    >
      <div className={MARKETING_CONTENT_WIDTH_CLASS}>
        <div className="mx-auto max-w-3xl text-center">
          <p className={`${MARKETING_SECTION_EYEBROW_CLASS} ${typo.dataMono}`}>
            How it works
          </p>
          <h2
            className={`mt-4 ${MARKETING_SECTION_HEADING_CLASS} ${typo.headingSans}`}
          >
            Get a personalised study plan in minutes.
          </h2>
          <p
            className={`mx-auto mt-6 max-w-2xl ${MARKETING_SECTION_DESCRIPTION_CLASS} ${typo.secondarySans}`}
          >
            Answer a few questions, take a short diagnostic test, and we&apos;ll
            map out your path to the score you want to get.
          </p>
        </div>

        <div className="mt-16 grid gap-5 min-[801px]:grid-cols-3">
          {steps.map((step, index) => (
            <article
              key={step.number}
              data-how-step
              className="flex flex-col rounded-[30px] border border-marketing-charcoal/10 bg-white p-5 shadow-sm sm:p-7"
            >
              <div className="flex items-center justify-between">
                <span
                  className={`text-xs font-semibold tracking-[0.16em] text-marketing-primary/50 ${typo.dataMono}`}
                >
                  {step.number}
                </span>
                {index === 1 ? (
                  <BarChart3
                    className="size-5 text-marketing-primary"
                    aria-hidden
                  />
                ) : null}
              </div>
              <h3
                className={`mt-6 ${MARKETING_CARD_TITLE_CLASS} ${typo.headingSans}`}
              >
                {step.title}
              </h3>
              <p
                className={`mt-3 min-h-[5.25rem] ${MARKETING_BODY_DESCRIPTION_CLASS} ${typo.secondarySans}`}
              >
                {step.body}
              </p>
              <div className="mt-6">
                {index === 0 ? (
                  <StartVisual />
                ) : index === 1 ? (
                  <BaselineVisual />
                ) : (
                  <PlanVisual />
                )}
              </div>
            </article>
          ))}
        </div>

        <div className="mt-10 text-center">
          <AnalyticsLink
            href={PRODUCT_LINKS.ucatSignup}
            analytics={{
              product: "ucat",
              placement: "how_it_works",
              action: "start_free",
            }}
            className={`${motion.magnetic} inline-flex items-center gap-2 rounded-full bg-marketing-primary px-6 py-3.5 text-sm font-semibold text-white ${typo.secondarySans}`}
          >
            Start preparing free <ArrowRight className="size-4" aria-hidden />
          </AnalyticsLink>
        </div>
      </div>
    </section>
  );
}
