import Image from "next/image";
import { MARKETING_TOKENS } from "@altitutor/shared";
import {
  GraduationCap,
  HandHeart,
  HeartHandshake,
  Stethoscope,
} from "lucide-react";
import { UcatInterestDialog } from "./ucat-interest-dialog";

const { typography: typo } = MARKETING_TOKENS;

const outcomes = [
  {
    initials: "BJ",
    name: "Brian J.",
    detail: "99th percentile · UCAT ANZ 2025",
    outcome: "Accepted into Dentistry at Adelaide University",
  },
  {
    initials: "JL",
    name: "Josh L.",
    detail: "96th percentile · UCAT ANZ 2025",
    outcome: "Accepted into Medicine at Adelaide University",
  },
  {
    initials: "MG",
    name: "Melshuel G.",
    detail: "Altitutor student · 2024",
    outcome: "Accepted into Medicine at Adelaide University",
  },
] as const;

export function UcatLandingStories() {
  return (
    <section
      id="mission"
      className="overflow-hidden bg-white px-4 py-24 sm:px-8 sm:py-32"
    >
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-12 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
          <div>
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-marketing-primary/10 text-marketing-primary">
              <HeartHandshake className="h-6 w-6" aria-hidden />
            </div>
            <p
              className={`mt-7 text-xs font-semibold uppercase tracking-[0.18em] text-marketing-primary/60 ${typo.dataMono}`}
            >
              A not-for-profit initiative
            </p>
            <h2
              className={`mt-4 text-4xl font-semibold tracking-[-0.035em] text-marketing-charcoal sm:text-5xl ${typo.headingSans}`}
            >
              Your preparation can help another student access theirs.
            </h2>
            <p
              className={`mt-6 text-base leading-relaxed text-marketing-charcoal/60 sm:text-lg ${typo.secondarySans}`}
            >
              Altitutor began helping students in 2017 and was formally
              established as a company in 2019. Revenue from paid plans helps us
              provide free and subsidised education to students facing financial
              barriers, alongside continued improvement of Altitutor UCAT.
            </p>
            <p
              className={`mt-5 border-l-2 border-marketing-accent pl-5 text-base font-medium leading-relaxed text-marketing-primary ${typo.secondarySans}`}
            >
              Better educational support should be available because a student
              needs it—not only because their family can afford it.
            </p>
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
              <h3 className={`mt-2 text-lg font-semibold ${typo.headingSans}`}>
                Where teaching began
              </h3>
              <p
                className={`mt-3 text-sm leading-relaxed text-white/65 ${typo.secondarySans}`}
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
                className={`mt-2 text-lg font-semibold text-marketing-charcoal ${typo.headingSans}`}
              >
                of students supported
              </h3>
              <p
                className={`mt-3 text-sm leading-relaxed text-marketing-charcoal/60 ${typo.secondarySans}`}
              >
                Through free and subsidised education provided by Altitutor over
                more than seven years.
              </p>
            </article>
          </div>
        </div>

        <div className="mt-20 grid gap-8 rounded-[2.25rem] border border-marketing-charcoal/10 bg-marketing-cream/55 p-7 sm:p-10 lg:grid-cols-[1fr_auto] lg:items-center lg:gap-14">
          <div>
            <p
              className={`text-xs font-semibold uppercase tracking-[0.18em] text-marketing-primary/60 ${typo.dataMono}`}
            >
              Supported access
            </p>
            <h3
              className={`mt-3 text-2xl font-semibold text-marketing-charcoal sm:text-3xl ${typo.headingSans}`}
            >
              If cost is standing in your way, apply for help.
            </h3>
            <p
              className={`mt-4 text-sm leading-relaxed text-marketing-charcoal/60 sm:text-base ${typo.secondarySans}`}
            >
              Anyone can apply for free or subsidised Unlimited access. We
              review your financial position and circumstances, then arrange a
              short online conversation. Support depends on need and the funding
              available at the time.
            </p>
            <p className={`mt-4 text-xs leading-relaxed text-marketing-charcoal/48 ${typo.secondarySans}`}>
              Applications are assessed only on financial position and
              circumstances. We will invite suitable applicants to a short
              online interview before making a decision.
            </p>
          </div>
          <div className="lg:text-right">
            <UcatInterestDialog
              kind="supported_access"
              triggerLabel="Apply for supported access"
              title="Apply for supported access"
              description="Tell us how cost is affecting your access to UCAT preparation. The Altitutor team will review your application and contact suitable applicants to arrange a short online conversation."
            />
            <p className={`mt-3 max-w-sm text-xs leading-relaxed text-marketing-charcoal/45 lg:ml-auto ${typo.secondarySans}`}>
              Applying does not guarantee free or subsidised access. Support
              depends on your circumstances and the funding available.
            </p>
          </div>
        </div>

        <div className="mt-24">
          <div className="mx-auto max-w-3xl text-center">
            <p
              className={`text-xs font-semibold uppercase tracking-[0.18em] text-marketing-primary/60 ${typo.dataMono}`}
            >
              Altitutor students
            </p>
            <h2
              className={`mt-4 text-3xl font-semibold tracking-tight text-marketing-charcoal sm:text-4xl ${typo.headingSans}`}
            >
              Students have trusted us with the path into medicine since 2017.
            </h2>
            <p
              className={`mt-4 text-sm leading-relaxed text-marketing-charcoal/55 ${typo.secondarySans}`}
            >
              These verified outcomes come from Altitutor&apos;s wider teaching
              programs. Altitutor UCAT is new, so platform-specific student
              comments will be added here before launch.
            </p>
          </div>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {outcomes.map((student) => (
              <article
                key={student.name}
                className="rounded-[1.75rem] border border-marketing-charcoal/10 bg-white p-6 shadow-sm"
              >
                <div className="flex items-center gap-4">
                  <div
                    className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-marketing-accent/35 text-sm font-bold text-marketing-primary ${typo.headingSans}`}
                    aria-label={`${student.name} initials`}
                  >
                    {student.initials}
                  </div>
                  <div>
                    <h3
                      className={`font-semibold text-marketing-charcoal ${typo.headingSans}`}
                    >
                      {student.name}
                    </h3>
                    <p
                      className={`mt-0.5 text-[10px] uppercase tracking-[0.1em] text-marketing-charcoal/45 ${typo.dataMono}`}
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
                    className={`text-sm leading-relaxed text-marketing-charcoal/65 ${typo.secondarySans}`}
                  >
                    {student.outcome}
                  </p>
                </div>
                <p className={`mt-4 text-xs italic leading-relaxed text-marketing-charcoal/42 ${typo.secondarySans}`}>
                  Platform-specific student comment coming before launch.
                </p>
              </article>
            ))}
          </div>
        </div>

        <div className="mt-24 grid overflow-hidden rounded-[2.5rem] bg-marketing-charcoal text-marketing-cream lg:grid-cols-[0.64fr_1.36fr]">
          <div className="relative min-h-[26rem] overflow-hidden border-b border-white/10 lg:min-h-0 lg:border-b-0 lg:border-r">
            <Image
              src="/assets/ucat/matt-chua-founder.jpeg"
              alt="Matt Chua, founder of Altitutor and doctor"
              fill
              sizes="(min-width: 1024px) 36vw, 100vw"
              className="object-cover object-[50%_34%]"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-marketing-charcoal/55 via-transparent to-transparent" />
            <p className={`absolute bottom-6 left-6 rounded-full bg-marketing-charcoal/70 px-4 py-2 text-[10px] uppercase tracking-[0.14em] text-white backdrop-blur ${typo.dataMono}`}>
              Matt Chua · Founder &amp; doctor
            </p>
          </div>
          <div className="p-8 sm:p-12 lg:p-16">
            <p
              className={`text-xs font-semibold uppercase tracking-[0.18em] text-marketing-accent ${typo.dataMono}`}
            >
              A note from Matt
            </p>
            <h2
              className={`mt-4 text-3xl font-semibold tracking-tight sm:text-4xl ${typo.headingSans}`}
            >
              Built by people who have travelled the path.
            </h2>
            <div
              className={`mt-6 space-y-4 text-base leading-relaxed text-white/68 ${typo.secondarySans}`}
            >
              <p>
                Hi, I&apos;m Matt—a doctor working across hospitals in South
                Australia. I started Altitutor with friends while I was in
                medical school because good education should not be limited by
                what someone can afford.
              </p>
              <p>
                I remember how overwhelming UCAT preparation felt when I did not
                know where to start. Altitutor UCAT is the tool I would have
                wanted beside me: one that finds the weak points, explains the
                evidence, and makes the next step clear.
              </p>
              <p>
                When you choose Unlimited or work with an Altitutor tutor, you
                are also helping us extend free and subsidised education to more
                students.
              </p>
            </div>
            <p
              className={`mt-7 text-lg italic text-marketing-accent ${typo.dramaSerif}`}
            >
              Thank you for your support, Matt
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
