"use client";

import { MARKETING_TOKENS } from "@altitutor/shared";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@altitutor/ui";
import {
  UCAT_SECTION_EYEBROW_CLASS,
  UCAT_SECTION_PADDING_CLASS,
  UCAT_SECTION_DESCRIPTION_CLASS,
  UCAT_SUPPORTING_TEXT_CLASS,
  UCAT_SECTION_HEADING_CLASS,
} from "./ucat-landing-section-eyebrow";
import { UcatInterestDialog } from "./ucat-interest-dialog";

const { typography: typo } = MARKETING_TOKENS;

const faqLinkClassName = `inline font-semibold text-marketing-primary underline decoration-marketing-primary/30 underline-offset-4 transition hover:decoration-marketing-primary ${typo.secondarySans}`;

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
    answer: (
      <>
        Yes. Anyone can apply. We assess applications on the student or family&apos;s
        financial position and circumstances, followed by a short online interview.
        Support depends on need and the funding available at the time. You can{" "}
        <UcatInterestDialog
          kind="supported_access"
          triggerLabel="apply for supported access"
          title="Apply for supported access"
          description="Tell us how cost is affecting your access to UCAT preparation. The Altitutor team will review your application and contact suitable applicants to arrange a short online conversation."
          triggerClassName={faqLinkClassName}
          hideTriggerIcon
        />
        .
      </>
    ),
  },
  {
    question: "Is online tutoring included?",
    answer: (
      <>
        No. Online one-to-one tutoring will be an optional add-on. Your tutor will be
        able to see your progress and attempts, then make personalised recommendations
        during live video sessions. You can{" "}
        <UcatInterestDialog
          kind="online_tutoring_waitlist"
          triggerLabel="join the waitlist"
          title="Join the online tutoring waitlist"
          description="Leave your contact details and Matt will follow up as plans for one-to-one online UCAT tutoring develop. Joining the waitlist is not a booking or guarantee of availability."
          triggerClassName={faqLinkClassName}
          hideTriggerIcon
        />{" "}
        now.
      </>
    ),
  },
  {
    question: "Do you offer interview training?",
    answer: (
      <>
        Yes. We offer medical interview preparation and will release course places when
        university offers come out. You can{" "}
        <UcatInterestDialog
          kind="interview_training_waitlist"
          triggerLabel="join the waitlist"
          title="Join the interview training waitlist"
          description="Leave your contact details and we will follow up when medical interview course places are released."
          triggerClassName={faqLinkClassName}
          hideTriggerIcon
        />{" "}
        and we will contact you when places open.
      </>
    ),
  },
] as const;

export function UcatLandingFaq() {
  return (
    <section id="faq" className={`bg-white ${UCAT_SECTION_PADDING_CLASS}`}>
      <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[0.72fr_1.28fr] lg:gap-20">
        <div>
          <p className={`${UCAT_SECTION_EYEBROW_CLASS} ${typo.dataMono}`}>
            Frequently asked questions
          </p>
          <h2
            className={`mt-4 ${UCAT_SECTION_HEADING_CLASS} ${typo.headingSans}`}
          >
            Clear answers before you start.
          </h2>
          <p
            className={`mt-5 max-w-md ${UCAT_SECTION_DESCRIPTION_CLASS} ${typo.secondarySans}`}
          >
            If your question is not here, email admin@altitutor.com and a member
            of the Altitutor team will help.
          </p>
        </div>
        <Accordion
          type="single"
          collapsible
          className="divide-y divide-marketing-charcoal/10 border-y border-marketing-charcoal/10"
        >
          {faqs.map((faq, index) => (
            <AccordionItem
              key={faq.question}
              value={`faq-${index}`}
              className="border-none"
            >
              <AccordionTrigger
                className={`gap-6 py-5 text-left text-base font-semibold text-marketing-charcoal hover:no-underline sm:text-lg [&>svg]:size-5 [&>svg]:text-marketing-primary ${typo.headingSans}`}
              >
                {faq.question}
              </AccordionTrigger>
              <AccordionContent
                className={`motion-reduce:animate-none ${typo.secondarySans}`}
              >
                <div
                  className={`max-w-2xl pb-6 pr-10 ${UCAT_SUPPORTING_TEXT_CLASS} ${typo.secondarySans}`}
                >
                  {faq.answer}
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}
