import { MARKETING_TOKENS } from "@altitutor/shared";
import { BarChart3, CalendarCheck, ClipboardList } from "lucide-react";

const { typography: typo } = MARKETING_TOKENS;

const outcomes = [
  {
    icon: BarChart3,
    title: "See your current position",
    body: "Build a score estimate from real practice and understand the plausible range around it.",
  },
  {
    icon: ClipboardList,
    title: "Find the gap that matters",
    body: "Compare section performance with your target and see where your next block of work can help most.",
  },
  {
    icon: CalendarCheck,
    title: "Turn evidence into a plan",
    body: "Get a useful next step now, or build a complete adaptive schedule through to test day.",
  },
] as const;

export function UcatLandingFeatures() {
  return (
    <section
      id="overview"
      className="bg-marketing-cream px-4 py-20 sm:px-8 sm:py-28"
    >
      <div className="mx-auto max-w-7xl">
        <div className="grid overflow-hidden rounded-[2rem] border border-marketing-charcoal/10 bg-white shadow-sm sm:grid-cols-3">
          {[
            ["10,000+", "practice questions"],
            ["30+", "full UCAT mocks"],
            ["Free forever", "with allowances that reset"],
          ].map(([value, label], index) => (
            <div
              key={value}
              className={`px-6 py-7 text-center ${index > 0 ? "border-t border-marketing-charcoal/10 sm:border-l sm:border-t-0" : ""}`}
            >
              <p
                className={`text-2xl font-bold text-marketing-primary sm:text-3xl ${typo.headingSans}`}
              >
                {value}
              </p>
              <p
                className={`mt-1 text-sm text-marketing-charcoal/55 ${typo.secondarySans}`}
              >
                {label}
              </p>
            </div>
          ))}
        </div>

        <div className="mx-auto mt-24 max-w-3xl text-center">
          <p
            className={`text-xs font-semibold uppercase tracking-[0.18em] text-marketing-primary/60 ${typo.dataMono}`}
          >
            Practice with direction
          </p>
          <h2
            className={`mt-4 text-4xl font-semibold tracking-[-0.035em] text-marketing-charcoal sm:text-5xl ${typo.headingSans}`}
          >
            More questions are not the same as a better plan.
          </h2>
          <p
            className={`mx-auto mt-6 max-w-2xl text-base leading-relaxed text-marketing-charcoal/60 sm:text-lg ${typo.secondarySans}`}
          >
            Completing questions is only useful when you know what the results
            mean. Altitutor UCAT shows where you are improving, where you are
            losing marks, and what deserves your attention now.
          </p>
        </div>

        <div className="mt-14 grid gap-5 md:grid-cols-3">
          {outcomes.map(({ icon: Icon, title, body }) => (
            <article
              key={title}
              className="rounded-[1.75rem] border border-marketing-charcoal/10 bg-white p-7 shadow-sm"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-marketing-primary/10 text-marketing-primary">
                <Icon className="h-5 w-5" aria-hidden />
              </span>
              <h3
                className={`mt-6 text-xl font-semibold text-marketing-charcoal ${typo.headingSans}`}
              >
                {title}
              </h3>
              <p
                className={`mt-3 text-sm leading-relaxed text-marketing-charcoal/60 ${typo.secondarySans}`}
              >
                {body}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
