import { MARKETING_TOKENS } from "@altitutor/shared";
import { BarChart3, Lightbulb, Send, Target, Video } from "lucide-react";

const { typography: typo } = MARKETING_TOKENS;

export function LiveDetailStory() {
  return (
    <div className="mx-auto max-w-7xl px-5 pb-24 pt-12 sm:px-8 sm:pt-16 lg:px-12 lg:pt-20">
      <section className="grid items-center gap-12 lg:grid-cols-[0.85fr_1.15fr] lg:gap-20">
        <div data-detail-reveal>
          <span className="inline-flex rounded-full border border-marketing-primary/15 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-marketing-primary">
            Coming soon
          </span>
          <h2
            id="protocol-detail-live"
            className={`mt-6 text-4xl font-bold tracking-[-0.05em] sm:text-6xl ${typo.headingSans}`}
          >
            A tutor who can see the work—not just hear about it.
          </h2>
          <p
            className={`mt-7 text-lg leading-8 text-marketing-charcoal/62 ${typo.secondarySans}`}
          >
            The video call, question workspace and progress record live
            together. Your tutor can assign a question during the call, watch
            how you approach it and respond with evidence-based advice.
          </p>
        </div>
        <div
          data-detail-reveal
          aria-hidden
          className="overflow-hidden rounded-[2rem] border border-marketing-primary/10 bg-white shadow-[0_24px_70px_rgba(10,41,65,0.12)]"
        >
          <div className="flex items-center justify-between border-b border-marketing-primary/10 px-5 py-4">
            <div className="flex items-center gap-2 text-xs font-bold text-marketing-primary">
              <span className="h-2 w-2 rounded-full bg-red-500" />
              Live tutorial
            </div>
            <span className="text-xs font-semibold">42:18</span>
          </div>
          <div className="grid lg:grid-cols-[1.05fr_0.95fr]">
            <div className="flex min-h-72 items-center justify-center bg-marketing-primary p-8 text-marketing-cream">
              <div className="text-center">
                <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-marketing-accent text-2xl font-bold text-marketing-charcoal">
                  JT
                </div>
                <p className="mt-4 font-semibold">James · UCAT tutor</p>
                <p className="mt-1 text-xs text-marketing-cream/55">
                  Reviewing your approach
                </p>
              </div>
            </div>
            <div className="p-6">
              <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-marketing-primary">
                Shared question
              </p>
              <p className="mt-4 text-sm font-bold">
                Which conclusion follows from the statements?
              </p>
              <div className="mt-5 space-y-2">
                {["Conclusion A", "Conclusion B", "Neither conclusion"].map(
                  (answer, index) => (
                    <div
                      key={answer}
                      className={`rounded-lg border p-3 text-xs ${index === 1 ? "border-marketing-accent bg-marketing-accent/15" : "border-marketing-primary/10"}`}
                    >
                      {answer}
                    </div>
                  ),
                )}
              </div>
              <div className="mt-5 flex items-center gap-2 text-xs font-semibold text-marketing-primary">
                <Send className="h-3.5 w-3.5" />
                Tutor sent this question live
              </div>
            </div>
          </div>
        </div>
      </section>

      <section data-detail-reveal className="mt-20">
        <p
          className={`text-xs font-bold uppercase tracking-[0.2em] text-marketing-primary ${typo.dataMono}`}
        >
          One continuous teaching loop
        </p>
        <div className="mt-6 grid gap-px overflow-hidden rounded-[2rem] bg-marketing-primary/10 lg:grid-cols-4">
          {[
            [
              Video,
              "Observe",
              "See the student’s working and timing in context.",
            ],
            [
              Target,
              "Assign",
              "Send the right question without leaving the call.",
            ],
            [
              BarChart3,
              "Diagnose",
              "Compare the live attempt with their wider progress.",
            ],
            [
              Lightbulb,
              "Recommend",
              "Leave clear tips and the next focus area in Alti.",
            ],
          ].map(([Icon, title, copy]) => {
            const StepIcon = Icon as typeof Video;
            return (
              <div key={title as string} className="bg-marketing-cream p-8">
                <StepIcon className="h-5 w-5 text-marketing-primary" />
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
        </div>
      </section>
      <p
        data-detail-reveal
        className={`mx-auto mt-16 max-w-4xl text-center text-2xl font-semibold leading-snug sm:text-4xl ${typo.headingSans}`}
      >
        Advice is connected to what the student actually did, and the next task
        is ready before the call ends.
      </p>
    </div>
  );
}
