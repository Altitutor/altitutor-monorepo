import { MARKETING_TOKENS } from "@altitutor/shared";
import { ChevronDown } from "lucide-react";

const { typography: typo } = MARKETING_TOKENS;

const faqs = [
  {
    question: "Is Altitutor UCAT Free really free forever?",
    answer:
      "Yes. Free is ongoing access, not a short trial. It includes real question practice and other learning activities with allowances that reset. You can choose Unlimited to remove the waiting periods, but you do not have to pay to keep using the platform.",
  },
  {
    question: "What does Unlimited add?",
    answer:
      "Unlimited removes the Free plan's usage limits across questions, sets, mocks, skill trainers, learning modules, review, progress tracking, and score estimation. Tutoring is a separate optional service.",
  },
  {
    question: "How does the score estimate work?",
    answer:
      "It uses evidence from your own attempts to estimate current performance and show a plausible range. Early estimates carry lower confidence; the range becomes more informative as you complete varied, representative practice. It is guidance, not a guaranteed UCAT result.",
  },
  {
    question: "Does the study plan change as I improve?",
    answer:
      "Yes. The plan uses your target, test date, availability, completed work, and performance evidence to choose useful next steps. It can rebalance learning, focused practice, review, timed sets, and mocks as your needs change.",
  },
  {
    question: "Is this built for students sitting the UCAT in 2027?",
    answer:
      "Yes. Altitutor UCAT is being launched for the 2027 UCAT ANZ cohort. Starting early gives you time to learn the methods first, then build speed, stamina, and exam performance progressively.",
  },
  {
    question: "Is Altitutor UCAT a not-for-profit?",
    answer:
      "Yes. It is a not-for-profit initiative by Altitutor. Revenue from paid access helps us provide free and subsidised education to students who could not otherwise afford support, and sustain the platform that serves them.",
  },
  {
    question: "Can I apply for free or subsidised Unlimited access?",
    answer:
      "Yes. Anyone can apply. We assess applications on the student or family's financial position and circumstances, followed by a short online interview. Support depends on need and the funding available at the time.",
  },
  {
    question: "Is online tutoring included?",
    answer:
      "No. Online one-to-one tutoring will be an optional add-on. Your tutor will be able to see your progress and attempts, then make personalised recommendations during live video sessions. You can join the waitlist now.",
  },
] as const;

export function UcatLandingFaq() {
  return (
    <section id="faq" className="bg-white px-4 py-24 sm:px-8 sm:py-32">
      <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[0.72fr_1.28fr] lg:gap-20">
        <div>
          <p className={`text-xs font-semibold uppercase tracking-[0.18em] text-marketing-primary/60 ${typo.dataMono}`}>
            Frequently asked questions
          </p>
          <h2 className={`mt-4 text-4xl font-semibold tracking-[-0.04em] text-marketing-charcoal sm:text-5xl ${typo.headingSans}`}>
            Clear answers before you start.
          </h2>
          <p className={`mt-5 max-w-md text-base leading-relaxed text-marketing-charcoal/58 ${typo.secondarySans}`}>
            If your question is not here, email admin@altitutor.com and a member
            of the Altitutor team will help.
          </p>
        </div>
        <div className="divide-y divide-marketing-charcoal/10 border-y border-marketing-charcoal/10">
          {faqs.map((faq) => (
            <details key={faq.question} className="group py-1">
              <summary className={`flex cursor-pointer list-none items-center justify-between gap-6 py-5 text-base font-semibold text-marketing-charcoal sm:text-lg [&::-webkit-details-marker]:hidden ${typo.headingSans}`}>
                {faq.question}
                <ChevronDown className="size-5 shrink-0 text-marketing-primary transition-transform group-open:rotate-180" aria-hidden />
              </summary>
              <p className={`max-w-2xl pb-6 pr-10 text-sm leading-relaxed text-marketing-charcoal/62 sm:text-base ${typo.secondarySans}`}>
                {faq.answer}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
