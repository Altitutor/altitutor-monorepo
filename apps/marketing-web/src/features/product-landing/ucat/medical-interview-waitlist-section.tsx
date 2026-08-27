import { MARKETING_TOKENS } from "@altitutor/shared";
import {
  UCAT_BODY_DESCRIPTION_CLASS,
  UCAT_SECTION_HEADING_CLASS,
} from "./ucat-landing-section-eyebrow";
import { UcatInterestForm } from "./ucat-interest-form";

const { typography: typo } = MARKETING_TOKENS;

export function MedicalInterviewWaitlistSection() {
  return (
    <section
      id="get-started"
      className="bg-marketing-cream px-4 py-16 sm:px-8 sm:py-20"
    >
      <div className="mx-auto max-w-xl">
        <h2
          className={`${UCAT_SECTION_HEADING_CLASS} ${typo.headingSans}`}
        >
          How to get started
        </h2>
        <p
          className={`mt-5 ${UCAT_BODY_DESCRIPTION_CLASS} ${typo.secondarySans}`}
        >
          Join the waitlist and we will contact you to schedule a trial session.
        </p>
        <div className="mt-8">
          <UcatInterestForm
            kind="interview_training_waitlist"
            successBody="Thank you. We will contact you to schedule a trial session."
          />
        </div>
      </div>
    </section>
  );
}
