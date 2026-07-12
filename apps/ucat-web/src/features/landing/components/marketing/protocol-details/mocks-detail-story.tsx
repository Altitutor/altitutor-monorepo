import { MARKETING_TOKENS } from "@altitutor/shared";
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Clock3,
  Flag,
  Navigation,
} from "lucide-react";

const { typography: typo } = MARKETING_TOKENS;

export function MocksDetailStory() {
  return (
    <div className="mx-auto max-w-7xl px-5 pb-24 pt-12 sm:px-8 sm:pt-16 lg:px-12 lg:pt-20">
      <section className="text-center" data-detail-reveal>
        <p
          className={`text-xs font-bold uppercase tracking-[0.2em] text-marketing-primary ${typo.dataMono}`}
        >
          Exam-day rehearsal
        </p>
        <h2
          id="protocol-detail-mocks"
          className={`mx-auto mt-5 max-w-5xl text-4xl font-bold tracking-[-0.05em] sm:text-6xl ${typo.headingSans}`}
        >
          Make the real interface feel routine.
        </h2>
        <p
          className={`mx-auto mt-7 max-w-3xl text-lg leading-8 text-marketing-charcoal/62 ${typo.secondarySans}`}
        >
          Mocks use Alti’s UCAT question engine—the same controls, shortcuts,
          section timing and review flow used throughout your preparation.
        </p>
      </section>

      <section
        data-detail-reveal
        aria-hidden
        className="mt-14 overflow-hidden rounded-[1.5rem] border border-[#1b4c7d] bg-white font-[Arial,sans-serif] shadow-[0_24px_80px_rgba(10,41,65,0.16)]"
      >
        <div className="flex items-center justify-between bg-[#0b6ca2] px-4 py-2.5 text-xs text-white">
          <strong>Verbal Reasoning</strong>
          <span>Time Remaining 20:14 · Question 7 of 44</span>
        </div>
        <div className="flex items-center justify-between bg-[#4f7ec1] px-4 py-2 text-[11px] text-white">
          <span>Calculator</span>
          <span className="flex items-center gap-1">
            <Flag className="h-3 w-3" />
            Flag for Review
          </span>
        </div>
        <div className="grid min-h-[330px] grid-cols-1 divide-y divide-slate-300 sm:grid-cols-2 sm:divide-x sm:divide-y-0">
          <div className="bg-slate-50 p-6">
            <strong className="text-xs">Scientific reporting</strong>
            <p className="mt-4 text-[11px] leading-5 text-slate-600">
              Independent review allows researchers to test whether results can
              be repeated. Transparency about uncertainty is central to public
              trust in new findings.
            </p>
          </div>
          <div className="p-6">
            <p className="text-xs font-bold">
              The passage suggests that public confidence is most likely to
              improve when...
            </p>
            <div className="mt-5 space-y-2">
              {[
                "results are independently verified",
                "research is completed rapidly",
                "all uncertainty is removed",
                "findings are never revised",
              ].map((answer, index) => (
                <div
                  key={answer}
                  className={`flex items-start gap-2 border p-3 text-[11px] ${index === 0 ? "border-[#0b6ca2] bg-[#e6f0f4]" : "border-slate-300"}`}
                >
                  <span
                    className={`mt-px h-3 w-3 rounded-full border ${index === 0 ? "border-[#0b6ca2] bg-[#0b6ca2]" : "border-slate-400"}`}
                  />
                  {answer}
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="flex h-11 items-stretch justify-between bg-[#0b6ca2] text-[11px] text-white">
          <span className="flex items-center gap-1 border-r border-white/40 px-4">
            <ArrowLeft className="h-3 w-3" />
            <span>
              <u>P</u>revious
            </span>
          </span>
          <div className="flex">
            <span className="flex items-center gap-1 border-l border-white/40 px-4">
              <Navigation className="h-3 w-3" />
              <span>
                Na<u>v</u>igator
              </span>
            </span>
            <span className="flex items-center gap-1 border-l border-white/40 bg-[#4f7ec1] px-4">
              <span>
                <u>N</u>ext
              </span>
              <ArrowRight className="h-3 w-3" />
            </span>
          </div>
        </div>
      </section>

      <section data-detail-reveal className="mt-16 grid gap-4 lg:grid-cols-3">
        {[
          [
            Clock3,
            "Rehearse pacing",
            "The section clock keeps moving while you answer, flag and navigate.",
          ],
          [
            Navigation,
            "Build interface fluency",
            "Keyboard shortcuts and familiar controls reduce cognitive load on test day.",
          ],
          [
            BarChart3,
            "Review the evidence",
            "After the mock, inspect score, timing and every question—not only the total.",
          ],
        ].map(([Icon, title, copy]) => {
          const CardIcon = Icon as typeof Clock3;
          return (
            <div
              key={title as string}
              className="rounded-[1.75rem] border border-marketing-primary/10 bg-white p-8"
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
      <section
        data-detail-reveal
        className="mt-12 flex items-start gap-4 rounded-[2rem] bg-marketing-accent p-8 sm:p-10"
      >
        <CheckCircle2 className="mt-1 h-5 w-5 shrink-0 text-marketing-primary" />
        <p
          className={`max-w-4xl text-2xl font-semibold leading-snug sm:text-3xl ${typo.headingSans}`}
        >
          By test day, the interface is no longer another problem to solve. Your
          attention stays on the question.
        </p>
      </section>
    </div>
  );
}
