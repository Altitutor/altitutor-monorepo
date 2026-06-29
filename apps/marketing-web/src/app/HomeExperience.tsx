"use client";

import clsx from "clsx";
import { useEffect, useMemo, useRef, useState } from "react";
import { PRODUCT_LINKS } from "@/lib/site";
import {
  diagnosticLabels,
  manifestoWords,
  missionStats,
  protocolCards,
  scheduleDays,
  sectionIndicators,
  steps,
  telemetryMessages,
  testimonialRows,
} from "./HomeExperience.data";
import { MarketingActionButton, MarketingButton, MarketingCard, MarketingHeading } from "./MarketingUI";
import styles from "./HomeExperience.module.css";

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
        <MarketingActionButton>
          Save
        </MarketingActionButton>
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
