import Image from "next/image";
import { MARKETING_TOKENS } from "@altitutor/shared";
import {
  GraduationCap,
  HandHeart,
  HeartHandshake,
  Stethoscope,
} from "lucide-react";
import { UcatInterestDialog } from "./ucat-interest-dialog";
import {
  UCAT_SECTION_EYEBROW_CLASS,
  UCAT_CONTENT_WIDTH_CLASS,
  UCAT_SECTION_PADDING_CLASS,
  UCAT_SECTION_DESCRIPTION_CLASS,
  UCAT_BODY_DESCRIPTION_CLASS,
  UCAT_SECTION_HEADING_CLASS,
  UCAT_SECTION_HEADING_DARK_CLASS,
  UCAT_CARD_TITLE_CLASS,
  UCAT_CARD_TITLE_DARK_CLASS,
  UCAT_DARK_BODY_DESCRIPTION_CLASS,
  UCAT_STUDENT_QUOTE_CLASS,
  UCAT_STUDENT_METADATA_CLASS,
} from "./ucat-landing-section-eyebrow";

const { typography: typo } = MARKETING_TOKENS;

const MATT_SIGNATURE_MASK = {
  WebkitMaskImage: "url(/assets/ucat/matt-signature.png)",
  maskImage: "url(/assets/ucat/matt-signature.png)",
  WebkitMaskRepeat: "no-repeat",
  maskRepeat: "no-repeat",
  WebkitMaskSize: "contain",
  maskSize: "contain",
  WebkitMaskPosition: "left center",
  maskPosition: "left center",
} as const;

const outcomes = [
  {
    name: "Brian J.",
    photo: "/assets/ucat/brian-j.jpeg",
    detail: "Scored 2610 · UCAT ANZ 2025",
    outcome: "Accepted into Bachelor of Dental Surgery",
    comment: "I really valued the 2025 Altitutor UCAT course due to its unique combination of friendly, relatable tutors, abundant and open resources, and online mock test system."
  },
  {
    name: "Josh L.",
    photo: "/assets/ucat/josh-l.png",
    detail: "Scored 2470 · UCAT ANZ 2025",
    outcome: "Accepted into Bachelor of Medical Studies / Doctor of Medicine",
    comment: "I found it invaluable practice which helped me get an offer to study Medicine at Adelaide Uni."
  },
  {
    name: "Melshuel G.",
    photo: "/assets/ucat/melshuel-g.jpeg",
    detail: "Altitutor student · 2024",
    outcome: "Accepted into Bachelor of Medical Studies / Doctor of Medicine",
    comment: "[The course] helped me to perform extremely well and get an offer to study medicine in 2025!"
  },
] as const;

export function UcatLandingStories() {
  return (
    <section
      id="mission"
      className={`overflow-hidden bg-white ${UCAT_SECTION_PADDING_CLASS}`}
    >
      <div className={UCAT_CONTENT_WIDTH_CLASS}>
        <div className="grid gap-12 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
          <div>
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-marketing-primary/10 text-marketing-primary">
              <HeartHandshake className="h-6 w-6" aria-hidden />
            </div>
            <p
              className={`mt-7 ${UCAT_SECTION_EYEBROW_CLASS} ${typo.dataMono}`}
            >
              Our mission
            </p>
            <h2
              className={`mt-4 ${UCAT_SECTION_HEADING_CLASS} ${typo.headingSans}`}
            >
              Your preparation can help another student access theirs.
            </h2>
            <p
              className={`mt-6 ${UCAT_SECTION_DESCRIPTION_CLASS} ${typo.secondarySans}`}
            >
              Altitutor runs as a not-for-profit education company. Revenue from
              paid plans helps us provide free and subsidised educational
              support to students who otherwise would not be able to afford it.
            </p>
            <div className="mt-6">
              <UcatInterestDialog
                kind="supported_access"
                triggerLabel="Apply for supported access"
                title="Apply for supported access"
                description="Tell us how cost is affecting your access to UCAT preparation. The Altitutor team will review your application and contact suitable applicants to arrange a short online conversation."
                triggerClassName={`inline-flex items-center gap-1.5 text-base font-semibold text-marketing-primary underline decoration-marketing-primary/30 underline-offset-4 transition hover:decoration-marketing-primary ${typo.secondarySans}`}
              />
            </div>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <article className="rounded-[2rem] bg-marketing-primary p-7 text-marketing-cream sm:p-8">
              <Stethoscope
                className="h-6 w-6 text-marketing-accent"
                aria-hidden
              />
              <p className={`mt-8 text-4xl font-semibold ${typo.headingSans}`}>
                2017
              </p>
              <h3 className={`mt-2 ${UCAT_CARD_TITLE_DARK_CLASS} ${typo.headingSans}`}>
                Where teaching began
              </h3>
              <p
                className={`mt-3 ${UCAT_DARK_BODY_DESCRIPTION_CLASS} ${typo.secondarySans}`}
              >
                Our first Year 12 cohort has now finished university, with
                former students working as doctors, dentists, and other
                professionals.
              </p>
            </article>
            <article className="rounded-[2rem] border border-marketing-charcoal/10 bg-marketing-cream p-7 sm:p-8">
              <HandHeart
                className="h-6 w-6 text-marketing-primary"
                aria-hidden
              />
              <p
                className={`mt-8 text-4xl font-semibold text-marketing-primary ${typo.headingSans}`}
              >
                Hundreds
              </p>
              <h3
                className={`mt-2 ${UCAT_CARD_TITLE_CLASS} ${typo.headingSans}`}
              >
                of students supported
              </h3>
              <p
                className={`mt-3 ${UCAT_BODY_DESCRIPTION_CLASS} ${typo.secondarySans}`}
              >
                Through free and subsidised education provided by Altitutor over
                more than seven years.
              </p>
            </article>
          </div>
        </div>

        <div className="mt-24">
          <div className="mx-auto max-w-3xl text-center">
            <p
              className={`${UCAT_SECTION_EYEBROW_CLASS} ${typo.dataMono}`}
            >
              Altitutor students
            </p>
            <h2
              className={`mt-4 ${UCAT_SECTION_HEADING_CLASS} ${typo.headingSans}`}
            >
              Students have trusted us with the path into medicine since 2017.
            </h2>
          </div>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {outcomes.map((student) => (
              <article
                key={student.name}
                className="rounded-[1.75rem] border border-marketing-charcoal/10 bg-white p-6 shadow-sm"
              >
                <div className="flex items-center gap-4">
                  <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full bg-marketing-accent/35 ring-1 ring-marketing-charcoal/10">
                    <Image
                      src={student.photo}
                      alt={student.name}
                      fill
                      sizes="48px"
                      className="object-cover object-top"
                    />
                  </div>
                  <div>
                    <h3
                      className={`text-lg font-semibold text-marketing-charcoal ${typo.headingSans}`}
                    >
                      {student.name}
                    </h3>
                    <p
                      className={`mt-0.5 ${UCAT_STUDENT_METADATA_CLASS} ${typo.dataMono}`}
                    >
                      {student.detail}
                    </p>
                  </div>
                </div>
                <div className="mt-6 flex gap-3 border-t border-marketing-charcoal/10 pt-5">
                  <GraduationCap
                    className="mt-0.5 h-4 w-4 shrink-0 text-marketing-primary"
                    aria-hidden
                  />
                  <p
                    className={`${UCAT_BODY_DESCRIPTION_CLASS} ${typo.secondarySans}`}
                  >
                    {student.outcome}
                  </p>
                </div>
                <p className={`mt-4 ${UCAT_STUDENT_QUOTE_CLASS} ${typo.secondarySans}`}>
                  {student.comment}
                </p>
              </article>
            ))}
          </div>
        </div>

        <div className="mt-24 grid overflow-hidden rounded-[2.5rem] bg-marketing-charcoal text-marketing-cream lg:grid-cols-[0.64fr_1.36fr]">
          <div className="relative min-h-[26rem] overflow-hidden border-b border-white/10 lg:min-h-0 lg:border-b-0 lg:border-r">
            <Image
              src="/assets/ucat/matt-chua-founder.jpeg"
              alt="Matt, founder of Altitutor"
              fill
              sizes="(min-width: 1024px) 36vw, 100vw"
              className="object-cover object-[50%_34%]"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-marketing-charcoal/55 via-transparent to-transparent" />
            <p className={`absolute bottom-6 left-6 rounded-full bg-marketing-charcoal/70 px-4 py-2 text-xs uppercase tracking-[0.14em] text-marketing-cream backdrop-blur sm:text-sm ${typo.dataMono}`}>
              Matt · Founder
            </p>
          </div>
          <div className="p-8 sm:p-12 lg:p-16">
            <h2
              className={`mt-4 ${UCAT_SECTION_HEADING_DARK_CLASS} ${typo.headingSans}`}
            >
              Built by people who have travelled the path.
            </h2>
            <div
              className={`mt-6 space-y-4 ${UCAT_DARK_BODY_DESCRIPTION_CLASS} ${typo.secondarySans}`}
            >
              <p>
                Hi, I&apos;m Matt - I&apos;m a doctor working across a few hospitals in South
                Australia. I founded Altitutor with the mission of providing accessible education to those who 
                can&apos;t afford it. Over the years, Altitutor has provided free or subsidised education to 
                hundreds of students, and I&apos;m proud to say that our first cohort of students are now 
                fully qualified doctors, dentists and other working professionals! 
              </p>
              <p>
              With the launch of Altitutor UCAT, we want to now extend the not-for-profit mission of Altitutor 
              to reach more students who have the motivation to get into medicine, but don&apos;t have the money to pay 
              for online preparation tools. By purchasing access to UCAT Unlimited, 
              you&apos;re supporting the education of the next generation of doctors and working professionals.
              </p>
            </div>
            <div className="mt-7 text-marketing-cream/72">
              <p className={`text-lg italic text-marketing-cream ${typo.dramaSerif}`}>
                Thank you for your support ♥︎
              </p>
              <div
                role="img"
                aria-label="Matt"
                className="mt-4 h-[90px] w-[180px] bg-current"
                style={MATT_SIGNATURE_MASK}
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
