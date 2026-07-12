import { MARKETING_TOKENS } from "@altitutor/shared";
import { Check, Clock3, RotateCcw, Target } from "lucide-react";

const { typography: typo } = MARKETING_TOKENS;
const sections = [
  "Verbal Reasoning",
  "Decision Making",
  "Quantitative Reasoning",
  "Situational Judgement",
];

export function PracticeDetailStory() {
  return (
    <div className="mx-auto max-w-7xl px-5 pb-24 pt-12 sm:px-8 sm:pt-16 lg:px-12 lg:pt-20">
      <section
        className="grid items-end gap-10 lg:grid-cols-[1fr_0.8fr]"
        data-detail-reveal
      >
        <div>
          <p
            className={`text-xs font-bold uppercase tracking-[0.2em] text-marketing-primary ${typo.dataMono}`}
          >
            Practice with a purpose
          </p>
          <h2
            id="protocol-detail-practice"
            className={`mt-5 text-4xl font-bold tracking-[-0.05em] sm:text-6xl ${typo.headingSans}`}
          >
            Build the session you need today.
          </h2>
        </div>
        <p
          className={`text-lg leading-8 text-marketing-charcoal/62 ${typo.secondarySans}`}
        >
          Choose exactly what enters the session, how quickly it moves and
          whether you want new material or questions that previously caught you
          out.
        </p>
      </section>

      <section
        data-detail-reveal
        aria-hidden
        className="mt-14 overflow-hidden rounded-[2rem] border border-marketing-primary/10 bg-white shadow-[0_24px_70px_rgba(10,41,65,0.1)]"
      >
        <div className="grid border-b border-marketing-primary/10 sm:grid-cols-4">
          {["Section", "Categories", "Question pool", "Timing"].map(
            (step, index) => (
              <div
                key={step}
                className={`px-5 py-4 text-xs font-bold ${index === 0 ? "bg-marketing-primary text-white" : "text-marketing-charcoal/35"}`}
              >
                0{index + 1} · {step}
              </div>
            ),
          )}
        </div>
        <div className="grid gap-0 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="p-6 sm:p-9">
            <p className="text-sm font-bold">Choose a UCAT section</p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {sections.map((section, index) => (
                <div
                  key={section}
                  className={`flex items-center justify-between rounded-xl border p-4 ${index === 1 ? "border-marketing-accent bg-marketing-accent/15" : "border-marketing-primary/10"}`}
                >
                  <span className="text-sm font-semibold">{section}</span>
                  <span
                    className={`flex h-4 w-4 items-center justify-center rounded-full border ${index === 1 ? "border-marketing-primary bg-marketing-primary text-white" : "border-slate-300"}`}
                  >
                    {index === 1 ? <Check className="h-2.5 w-2.5" /> : null}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div className="border-t border-marketing-primary/10 bg-marketing-cream p-6 sm:p-8 lg:border-l lg:border-t-0">
            <p className="text-xs font-bold uppercase tracking-[0.15em] text-marketing-primary">
              Session preview
            </p>
            {[
              ["Questions", "20"],
              ["Pace", "60 sec / question"],
              ["Pool", "Previously incorrect"],
            ].map(([label, value]) => (
              <div
                key={label}
                className="flex justify-between border-b border-marketing-primary/10 py-4 text-sm"
              >
                <span className="text-marketing-charcoal/45">{label}</span>
                <strong>{value}</strong>
              </div>
            ))}
            <div className="mt-6 rounded-xl bg-marketing-primary px-5 py-3 text-center text-sm font-bold text-white">
              Start practice
            </div>
          </div>
        </div>
      </section>

      <section
        data-detail-reveal
        className="mt-16 grid gap-px overflow-hidden rounded-[2rem] bg-marketing-primary/10 lg:grid-cols-3"
      >
        {[
          [
            Target,
            "Target new material",
            "Choose sections and categories instead of accepting a random queue.",
          ],
          [
            RotateCcw,
            "Revisit mistakes",
            "Build a session from questions you previously answered incorrectly.",
          ],
          [
            Clock3,
            "Control the pressure",
            "Use exam pace, a custom timer or untimed mode while the method settles.",
          ],
        ].map(([Icon, title, copy]) => {
          const CardIcon = Icon as typeof Target;
          return (
            <div
              key={title as string}
              className="bg-marketing-cream p-8 sm:p-10"
            >
              <CardIcon className="h-5 w-5 text-marketing-primary" />
              <h3 className={`mt-5 text-xl font-bold ${typo.headingSans}`}>
                {title as string}
              </h3>
              <p
                className={`mt-3 text-sm leading-6 text-marketing-charcoal/55 ${typo.secondarySans}`}
              >
                {copy as string}
              </p>
            </div>
          );
        })}
      </section>
      <p
        data-detail-reveal
        className={`mx-auto mt-14 max-w-4xl text-center text-2xl font-semibold leading-snug sm:text-4xl ${typo.headingSans}`}
      >
        Every answer becomes evidence for the next session—not a result that
        disappears when you click Next.
      </p>
    </div>
  );
}
