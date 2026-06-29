"use client";

import clsx from "clsx";
import { useEffect, useMemo, useRef, useState } from "react";
import { PRODUCT_LINKS } from "@/lib/site";
import { MarketingButton, MarketingCard, MarketingHeading } from "./MarketingUI";
import styles from "./HomeExperience.module.css";

const diagnosticLabels = [
  "Small-group weekly classes",
  "Catch-up 1:1 transition sessions",
  "Learn-ahead SACE curriculum",
];

const telemetryMessages = [
  "UCAT prep: recognise question type -> choose strategy -> preserve timing.",
  "Interview prep: answer structure -> feedback loop -> confident delivery.",
  "Exam prep: topic diagnosis -> timed practice -> mark-scheme refinement.",
];

const scheduleDays = ["S", "M", "T", "W", "T", "F", "S"];

const manifestoWords =
  "We are a not-for-profit tutoring company built to make excellent education more accessible.".split(" ");

const missionStats = [
  {
    value: "94%",
    description: "Of our graduating year 12s receive a university offer for their top preference.",
  },
  {
    value: "96%",
    description: "Of our students improve their grade by at least one grade band within one term.",
  },
  {
    value: "100+",
    description: "5 star reviews",
  },
];

const protocolCards = [
  {
    number: "01",
    title: "Free homework help class",
    description:
      "All of our students may come to our 3 hour homework help class at no extra cost, where they can ask our knowledgable tutors questions or get help writing your assignments. We'll even draft your assignments in person for free.",
    motif: "helix",
  },
  {
    number: "02",
    title: "Tutors you can trust with your learning",
    description:
      "As top achieving students studying at universities around Adelaide, we know the SACE courses back to front, and have strategies and techniques for approaching assessments which are not found in textbooks.",
    motif: "scan",
  },
  {
    number: "03",
    title: "24/7 guidance and resource access",
    description:
      "Our students get unlimited access to our question helpline, where they can ask tutors any questions they have. Students also get free access to our online resources, which include notes, practice questions, video lessons and full length exams.",
    motif: "wave",
  },
  {
    number: "04",
    title: "A personalised learning experience",
    description:
      "Students are sorted into small classes based on learning ability, meaning all students in a class are at the same level. Group learning allows student to not only learn from their own mistakes, but also other students'.",
    motif: "orbit",
  },
];

const steps = [
  "You use the link above to book a trial session with one of our tutors. During the trial session, our tutors explain how our programmes work and we organise availability.",
  "You study 1-on-1 with our tutors for a few sessions to catch up to the level of one of our classes. After these sessions, you get integrated into an appropriate class, with other students at your learning ability.",
  "In class each week, your tutor teaches you content ahead of your school, using notes, practice questions and practice exams.",
  "At any time, you can access our online resources for free, which include notes, practice questions, tests and exams for every topic.",
  "The money you pay for each session is used to pay for tuition for our students in our subsidy programme.",
];

const testimonials = [
  {
    quote:
      "I had gone through several tutors for my medicine interview prep with little to no progress, and Matt was by far the best.",
    name: "Vyvian",
    meta: "Student, Medicine interview course",
  },
  {
    quote:
      "The weekly lessons with Sarah really improved my understanding of the subject and definitely helped me to succeed in achieving great marks.",
    name: "Neha",
    meta: "Student, Stage 2 Mathematical Methods",
  },
  {
    quote:
      "All of my biology lessons with Josh were enjoyable. Josh focuses on getting through theory so more time is able to spent doing practice questions.",
    name: "James",
    meta: "Student, Stage 2 Biology",
  },
  {
    quote:
      "The tutors explain concepts clearly and make difficult content feel manageable. I always left class knowing exactly what to work on next.",
    name: "Darshil",
    meta: "Student, SACE tutoring",
  },
  {
    quote:
      "Altitutor gave me structure, resources and feedback when school felt overwhelming. The homework help sessions were especially useful before assessments.",
    name: "Maddie",
    meta: "Student, weekly classes",
  },
  {
    quote:
      "The interview preparation helped me understand what assessors were looking for and how to communicate my experiences with confidence.",
    name: "Josh",
    meta: "Student, Medicine interview course",
  },
];

const testimonialRows = [
  testimonials,
  [...testimonials].reverse(),
  testimonials.slice(2).concat(testimonials.slice(0, 2)),
];

const sectionIndicators = [
  { id: "alti-home", label: "Altitutor" },
  { id: "overview", label: "Overview" },
  { id: "methodology", label: "Mission" },
  { id: "support", label: "Why choose us?" },
  { id: "how-it-works", label: "How it works" },
  { id: "pricing", label: "Get started" },
];

export function HomeExperience() {
  return (
    <>
      <HomeSectionIndicator />
      <FeaturesSection />
      <ManifestoSection />
      <ProtocolSection />
      <HowItWorksSection />
      <MembershipSection />
    </>
  );
}

function HomeSectionIndicator() {
  const [active, setActive] = useState(sectionIndicators[0].id);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      const probeY = window.innerHeight * 0.4;
      const overview = document.getElementById("overview");
      setVisible(overview ? overview.getBoundingClientRect().top <= window.innerHeight * 0.5 : window.scrollY > window.innerHeight * 0.5);
      const current = sectionIndicators.find(({ id }) => {
        const element = document.getElementById(id);
        if (!element) return false;
        const rect = element.getBoundingClientRect();
        return rect.top <= probeY && rect.bottom >= probeY;
      });
      if (current) setActive(current.id);
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav className={clsx(styles.sectionIndicator, visible && styles.sectionIndicatorVisible)} aria-label="Home page sections">
      {sectionIndicators.map((section) => (
        <a
          className={active === section.id ? styles.sectionIndicatorActive : undefined}
          href={`#${section.id}`}
          key={section.id}
          aria-label={`Scroll to ${section.label}`}
        >
          <span>{section.label}</span>
        </a>
      ))}
    </nav>
  );
}

function FeaturesSection() {
  return (
    <section id="overview" className={styles.section} data-reveal>
      <div className={styles.sectionHeader}>
        <p className="marketing-kicker">Interactive functional artifacts</p>
        <MarketingHeading>
          Want to achieve
          <span> better results?</span>
        </MarketingHeading>
      </div>
      <div className={styles.featureGrid}>
        <DiagnosticShuffler />
        <TelemetryTypewriter />
        <SchedulerCard />
      </div>
    </section>
  );
}

function DiagnosticShuffler() {
  const [labels, setLabels] = useState(diagnosticLabels);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setLabels((current) => {
        const next = [...current];
        next.unshift(next.pop() ?? "");
        return next;
      });
    }, 3000);
    return () => window.clearInterval(interval);
  }, []);

  return (
    <MarketingCard className={styles.artifactCard}>
      <div>
        <p className={styles.artifactLabel}>Weekly classes</p>
        <MarketingHeading as="h3" variant="card">Weekly tuition</MarketingHeading>
        <p>
          Whether you&apos;re struggling to pass or want to achieve top scores, our weekly classes ensure students not only improve their results, but find the content they&apos;re learning easy.
        </p>
        <MarketingButton href="/classes/weekly-classes/">
          Explore weekly classes
        </MarketingButton>
      </div>
      <div className={styles.diagnosticStack} aria-hidden>
        {labels.map((label, index) => (
          <div className={styles.diagnosticStackItem} data-index={index} key={label}>
            <span>0{index + 1}</span>
            {label}
          </div>
        ))}
      </div>
    </MarketingCard>
  );
}

function TelemetryTypewriter() {
  const [messageIndex, setMessageIndex] = useState(0);
  const [charCount, setCharCount] = useState(0);
  const message = telemetryMessages[messageIndex];

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      if (charCount < message.length) {
        setCharCount((count) => count + 1);
      } else {
        window.setTimeout(() => {
          setMessageIndex((index) => (index + 1) % telemetryMessages.length);
          setCharCount(0);
        }, 900);
      }
    }, charCount < message.length ? 32 : 900);
    return () => window.clearTimeout(timeout);
  }, [charCount, message.length]);

  return (
    <MarketingCard className={clsx(styles.artifactCard, styles.telemetryCard)}>
      <div>
        <div className={styles.liveFeedLabel}>
          <span />
          Live Feed
        </div>
        <MarketingHeading as="h3" variant="card">UCAT prep</MarketingHeading>
        <p>
          Whatever stage you&apos;re at in your preparation, we&apos;ve got you covered. Our UCAT course starts with us teaching you strategies to recognise and solve question types.
        </p>
        <MarketingButton href="/classes/ucatprep/">
          Explore UCAT prep
        </MarketingButton>
      </div>
      <pre aria-label="Live text feed">
        {message.slice(0, charCount)}
        <span className={styles.typeCursor}>|</span>
      </pre>
    </MarketingCard>
  );
}

function SchedulerCard() {
  const cells = useMemo(() => scheduleDays.map((day, index) => ({ day, active: index === 3 })), []);

  return (
    <MarketingCard className={styles.artifactCard}>
      <div>
        <p className={styles.artifactLabel}>English drafting</p>
        <MarketingHeading as="h3" variant="card">English drafting</MarketingHeading>
        <p>
          Our English tutors provide comprehensive feedback on the structure, readability, fluency and analysis of your assignment.
        </p>
        <MarketingButton href="/classes/english-assignment-drafting/">
          Explore drafting
        </MarketingButton>
      </div>
      <div className={styles.schedulerUi} aria-hidden>
        <div className={styles.schedulerGrid}>
          {cells.map((cell, index) => (
            <span className={cell.active ? styles.activeCell : undefined} key={`${cell.day}-${index}`}>
              {cell.day}
            </span>
          ))}
        </div>
        <MarketingButton href="#" onClick={(event) => event.preventDefault()}>
          Save
        </MarketingButton>
        <svg className={styles.schedulerCursor} viewBox="0 0 40 40">
          <path d="M8 4 31 24 19 26 14 37Z" />
        </svg>
      </div>
    </MarketingCard>
  );
}

function ManifestoSection() {
  return (
    <section id="methodology" className={styles.manifesto}>
      <div className={styles.manifestoTexture} aria-hidden />
      <div className={styles.manifestoInner}>
        <p>
          Most tutoring focuses on: <span>private advantage, expensive hours, and access for families who can already afford it.</span>
        </p>
        <MarketingHeading as="h2" variant="display" aria-label="We are a not-for-profit tutoring company built to make excellent education more accessible.">
          {manifestoWords.map((word, index) => (
            <span data-manifesto-word key={`${word}-${index}`}>
              {word}{" "}
            </span>
          ))}
        </MarketingHeading>
        <p>
          Every paid session helps fund subsidised tuition for students who would otherwise be priced out. Better teaching matters, but our mission is bigger: build a system where strong academic support is not reserved for the few.
        </p>
        <div className={styles.manifestoStats} aria-label="Altitutor outcomes">
          {missionStats.map((stat) => (
            <AnimatedMissionStat key={stat.value} stat={stat} />
          ))}
        </div>
      </div>
    </section>
  );
}

function AnimatedMissionStat({ stat }: { stat: (typeof missionStats)[number] }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const target = Number.parseInt(stat.value, 10);
  const suffix = stat.value.replace(String(target), "");
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    const element = rootRef.current;
    if (!element || !Number.isFinite(target)) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion || !("IntersectionObserver" in window)) {
      setDisplayValue(target);
      return;
    }

    let frame = 0;
    let hasAnimated = false;
    const durationMs = 1200;

    const animate = () => {
      const startedAt = performance.now();
      const tick = (now: number) => {
        const progress = Math.min(1, (now - startedAt) / durationMs);
        const eased = 1 - Math.pow(1 - progress, 3);
        setDisplayValue(Math.round(target * eased));
        if (progress < 1) {
          frame = window.requestAnimationFrame(tick);
        }
      };
      frame = window.requestAnimationFrame(tick);
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting || hasAnimated) return;
        hasAnimated = true;
        animate();
        observer.disconnect();
      },
      { threshold: 0.35 },
    );

    observer.observe(element);
    return () => {
      observer.disconnect();
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [target]);

  return (
    <div ref={rootRef}>
      <strong>
        {displayValue}
        {suffix}
      </strong>
      <span>{stat.description}</span>
    </div>
  );
}

function ProtocolSection() {
  return (
    <section id="support" className={clsx(styles.section, styles.support)} aria-label="Altitutor support systems" data-reveal>
      <div className={styles.sectionHeader}>
        <p className="marketing-kicker">Why choose us?</p>
        <MarketingHeading>
          Better support,
          <span> wider access.</span>
        </MarketingHeading>
      </div>
      <div className={styles.supportGrid}>
      {protocolCards.map((card) => (
        <MarketingCard className={styles.supportCard} key={card.number}>
          <div className={styles.supportCopy}>
            <span>{card.number}</span>
            <MarketingHeading as="h3" variant="card">{card.title}</MarketingHeading>
            <p>{card.description}</p>
          </div>
          <ProtocolMotif motif={card.motif} />
        </MarketingCard>
      ))}
      </div>
    </section>
  );
}

function ProtocolMotif({ motif }: { motif: string }) {
  if (motif === "scan") {
    return (
      <svg className={clsx(styles.protocolMotif, styles.scan)} viewBox="0 0 420 420" aria-hidden>
        {Array.from({ length: 64 }).map((_, index) => (
          <circle key={index} cx={42 + (index % 8) * 48} cy={42 + Math.floor(index / 8) * 48} r="4" />
        ))}
        <rect x="22" y="0" width="376" height="18" />
      </svg>
    );
  }
  if (motif === "wave") {
    return (
      <svg className={clsx(styles.protocolMotif, styles.wave)} viewBox="0 0 420 420" aria-hidden>
        <path d="M22 230h76l22-72 52 152 42-190 42 110h142" />
      </svg>
    );
  }
  return (
    <svg className={clsx(styles.protocolMotif, styles.orbit)} viewBox="0 0 420 420" aria-hidden>
      <circle cx="210" cy="210" r="104" />
      <circle cx="210" cy="210" r="154" />
      <path d="M118 118c80 34 144 34 184 0M118 302c80-34 144-34 184 0" />
      <circle cx="304" cy="116" r="14" />
    </svg>
  );
}

function HowItWorksSection() {
  return (
    <section id="how-it-works" className={styles.process}>
      <div className={styles.processHeader} data-reveal>
        <p className="marketing-kicker">How it works</p>
        <MarketingHeading>The Protocol</MarketingHeading>
        <p>A clear pathway from trial session to integrated class.</p>
      </div>
      <div className={styles.processStack}>
        {steps.map((step, index) => (
          <MarketingCard className={styles.processCard} key={step}>
            <span>0{index + 1}</span>
            <MarketingHeading as="h3" variant="display">{["Trial", "Catch up", "Learn ahead", "Use resources", "Support access"][index]}</MarketingHeading>
            <p>{step}</p>
          </MarketingCard>
        ))}
      </div>
      <div className={styles.testimonialRail}>
        <MarketingHeading as="h3" variant="section">See what our students have to say</MarketingHeading>
        <div className={styles.testimonialMarquee} aria-label="Rotating student testimonials">
          {testimonialRows.map((row, rowIndex) => (
            <div className={styles.testimonialRow} data-direction={rowIndex === 1 ? "right" : "left"} key={rowIndex}>
              <div className={styles.testimonialTrack}>
                {[...row, ...row].map((testimonial, index) => (
                  <MarketingCard as="figure" key={`${rowIndex}-${testimonial.name}-${index}`}>
                    <blockquote>{testimonial.quote}</blockquote>
                    <figcaption>
                      <strong>{testimonial.name}</strong>
                      <span>{testimonial.meta}</span>
                    </figcaption>
                  </MarketingCard>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function MembershipSection() {
  return (
    <section id="pricing" className={styles.membershipSection} data-reveal>
      <div className={styles.sectionHeader}>
        <p className="marketing-kicker">Get started</p>
        <MarketingHeading>Get started</MarketingHeading>
        <p>Start with the pathway that matches how you want to study.</p>
      </div>
      <div className={styles.membershipGrid}>
        <MarketingCard>
          <p>In-person pathway</p>
          <MarketingHeading as="h3" variant="display">Book a trial session</MarketingHeading>
          <span>Free 1 hour trial</span>
          <p>
            Meet with one of our tutors to discuss availability, logistics and whether you would like to continue with us.
          </p>
          <MarketingButton href={PRODUCT_LINKS.trialBooking}>
            Book a trial session
          </MarketingButton>
        </MarketingCard>
        <MarketingCard tone="dark">
          <p>Online resources</p>
          <MarketingHeading as="h3" variant="display">Register as an online student</MarketingHeading>
          <span>Student portal access</span>
          <p>
            Access online resources, ask questions in subject help groups and contact tutors for at-home support.
          </p>
          <MarketingButton href={PRODUCT_LINKS.student}>
            Register online
          </MarketingButton>
        </MarketingCard>
      </div>
    </section>
  );
}
