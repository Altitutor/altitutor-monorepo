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
    name: "Brian J.",
    photo: "/assets/ucat/brian-j.jpeg",
    detail: "Scored 2610 · UCAT ANZ 2025",
    outcome: "Accepted into Dentistry at Adelaide University",
    comment: "I really valued the 2025 Altitutor UCAT course due to its unique combination of friendly, relatable tutors, abundant and open resources, and online mock test system. Each teaching session was also highly flexible, which enabled me to learn at the pattern and pace that I knew would work best for me."
  },
  {
    name: "Josh L.",
    photo: "/assets/ucat/josh-l.png",
    detail: "Scored 2470 · UCAT ANZ 2025",
    outcome: "Accepted into Medicine at Adelaide University",
    comment: "I found it invaluable practice which helped me get an offer to study Medicine at Adelaide Uni."
  },
  {
    name: "Melshuel G.",
    photo: "/assets/ucat/melshuel-g.jpeg",
    detail: "Altitutor student · 2024",
    outcome: "Accepted into Medicine at Adelaide University",
    comment: "Tutors were really knowledgeable about their subjects and ensured that I felt comfortable with the course content!! I really loved the interview course as it helped me to perform extremely well and get an offer to study medicine in 2025!"
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
              Altitutor is a non-profit company, whose primary mission make education accessible for all.
              All revenue from paid plans will go directly towards
              provide free and subsidised education to students in financial need.
            </p>
            <p
              className={`mt-5 border-l-2 border-marketing-accent pl-5 text-base font-medium leading-relaxed text-marketing-primary ${typo.secondarySans}`}
            >
              Better educational support should be available because a student
              needs it—not only because their family can afford it.
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
