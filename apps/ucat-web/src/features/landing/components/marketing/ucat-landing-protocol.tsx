"use client";

import { MARKETING_TOKENS } from "@altitutor/shared";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import {
  ArrowUpRight,
  BookOpen,
  CheckCircle2,
  Clock3,
  LineChart,
  Sparkles,
  Target,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
} from "react";
import {
  LearnCardPreview,
  MockSimulationCardPreview,
  PracticeToolsCardPreview,
  ProgressTrackingCardPreview,
} from "./protocol-card-previews";
import {
  ProtocolFeatureDetailModal,
  type ProtocolFeatureKey,
} from "./ucat-protocol-detail-overlay";

gsap.registerPlugin(ScrollTrigger);

const { typography: typo } = MARKETING_TOKENS;

type ShowcaseCardProps = {
  index: string;
  eyebrow: string;
  title: string;
  description: string;
  detail: string;
  icon: ReactNode;
  theme: "light" | "accent" | "dark";
  reverse?: boolean;
  demo: ProtocolFeatureKey;
  flushDemo?: boolean;
  onLearnMore: (event: MouseEvent<HTMLButtonElement>) => void;
  children: ReactNode;
};

const themeClasses = {
  light: {
    card: "border-black/5 bg-white text-marketing-charcoal",
    icon: "text-marketing-primary",
    eyebrow: "text-marketing-primary",
    description: "text-marketing-charcoal/72",
    detail: "border-black/10 text-marketing-charcoal/50",
    demo: "border-marketing-primary/10 bg-marketing-cream text-marketing-charcoal",
  },
  accent: {
    card: "border-marketing-primary/10 bg-marketing-accent text-marketing-charcoal",
    icon: "text-marketing-primary",
    eyebrow: "text-marketing-primary",
    description: "text-marketing-charcoal/72",
    detail: "border-marketing-primary/15 text-marketing-charcoal/52",
    demo: "border-marketing-primary/10 bg-marketing-cream text-marketing-charcoal",
  },
  dark: {
    card: "border-white/10 bg-marketing-charcoal text-marketing-cream",
    icon: "text-marketing-accent",
    eyebrow: "text-marketing-accent",
    description: "text-marketing-cream/72",
    detail: "border-white/15 text-marketing-cream/50",
    demo: "border-white/15 bg-marketing-cream text-marketing-charcoal",
  },
} as const;

function ShowcaseCard({
  index,
  eyebrow,
  title,
  description,
  detail,
  icon,
  theme,
  reverse = false,
  demo,
  flushDemo = false,
  onLearnMore,
  children,
}: ShowcaseCardProps) {
  const classes = themeClasses[theme];

  return (
    <article
      data-protocol-card
      data-demo={demo}
      className={`relative isolate mb-20 h-auto min-h-[640px] w-full origin-top overflow-hidden rounded-[2rem] border shadow-[0_24px_80px_rgba(10,41,65,0.1)] last:mb-0 sm:mb-24 lg:sticky lg:top-[max(6rem,calc(50dvh-17.25rem))] lg:mb-[30vh] lg:h-[640px] lg:min-h-[640px] lg:rounded-[3rem] ${classes.card}`}
      style={{ zIndex: Number(index) }}
    >
      <div className="relative h-full min-h-[640px] p-7 sm:p-11 lg:p-16">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-marketing-accent/10 blur-3xl"
        />
        <div
          data-protocol-card-content
          className={`relative grid h-full items-center gap-14 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-20 ${reverse ? "lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]" : ""}`}
        >
          <div className={reverse ? "lg:order-2" : ""}>
            <div className="flex items-center gap-3">
              <span className={classes.icon}>{icon}</span>
              <span
                className={`text-[11px] font-bold uppercase tracking-[0.18em] ${classes.eyebrow} ${typo.dataMono}`}
              >
                {index} / {eyebrow}
              </span>
            </div>
            <h3
              className={`mt-8 text-3xl font-bold tracking-[-0.04em] sm:text-4xl lg:text-[2.75rem] lg:leading-[1.08] ${typo.headingSans}`}
            >
              {title}
            </h3>
            <p
              className={`mt-5 max-w-xl text-[15px] leading-7 sm:text-base ${classes.description} ${typo.secondarySans}`}
            >
              {description}
            </p>
            <p
              className={`mt-8 flex max-w-xl items-start gap-3 border-t pt-6 text-[13px] leading-6 ${classes.detail} ${typo.secondarySans}`}
            >
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0" />
              {detail}
            </p>
            <button
              type="button"
              onClick={onLearnMore}
              className={`mt-8 inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition-transform hover:scale-[1.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-marketing-accent ${theme === "light" || theme === "accent" ? "border-marketing-primary/20 text-marketing-primary" : "border-marketing-cream/25 text-marketing-cream"} ${typo.secondarySans}`}
            >
              Learn more <ArrowUpRight className="h-4 w-4" />
            </button>
          </div>

          <div
            aria-hidden="true"
            className={`relative min-w-0 overflow-hidden rounded-[1.5rem] border shadow-[0_20px_55px_rgba(10,41,65,0.14)] sm:rounded-[2rem] ${classes.demo} ${reverse ? "lg:order-1" : ""}`}
          >
            {flushDemo ? null : (
              <div className="flex h-9 items-center gap-2 border-b border-marketing-primary/10 bg-white px-4">
                <span className="h-2 w-2 rounded-full bg-marketing-accent" />
                <span className="text-[9px] font-semibold uppercase tracking-[0.16em] text-marketing-primary/45">
                  Alti UCAT
                </span>
              </div>
            )}
            <div className="min-h-[310px] sm:min-h-[360px]">{children}</div>
          </div>
        </div>
      </div>
    </article>
  );
}

function buildPreviewTimeline(card: HTMLElement) {
  const demo = card.dataset.demo;
  const timeline = gsap.timeline({
    paused: true,
    repeat: -1,
    repeatDelay: 1.1,
  });

  if (demo === "learning") {
    timeline
      .from(card.querySelectorAll("[data-learn-preview-row]"), {
        y: 10,
        opacity: 0,
        stagger: 0.09,
        duration: 0.38,
        ease: "power2.out",
      })
      .fromTo(
        card.querySelector("[data-learn-preview-progress]"),
        { scaleX: 0.2 },
        { scaleX: 1, duration: 1, ease: "power2.inOut" },
        "-=0.1",
      )
      .to({}, { duration: 1 });
  }

  if (demo === "practice") {
    const score = { value: 7 };
    const scoreElement = card.querySelector<HTMLElement>(
      "[data-practice-preview-score]",
    );
    timeline
      .from(card.querySelectorAll("[data-practice-preview-option]"), {
        x: 12,
        opacity: 0,
        stagger: 0.1,
        duration: 0.4,
      })
      .to(
        card.querySelector("[data-practice-preview-answer]"),
        {
          backgroundColor: "#92b9c6",
          borderColor: "#92b9c6",
          scale: 1.03,
          duration: 0.25,
        },
        "+=0.35",
      )
      .to(
        score,
        {
          value: 8,
          duration: 0.45,
          onUpdate: () => {
            if (scoreElement)
              scoreElement.textContent = String(Math.round(score.value));
          },
        },
        "<",
      )
      .to({}, { duration: 0.9 })
      .call(() => {
        score.value = 7;
        if (scoreElement) scoreElement.textContent = "7";
      });
  }

  if (demo === "mocks") {
    const timer = { seconds: 1214 };
    const timerElement = card.querySelector<HTMLElement>(
      "[data-mock-preview-timer]",
    );
    timeline
      .to(
        timer,
        {
          seconds: 1209,
          duration: 5,
          ease: "none",
          onUpdate: () => {
            if (!timerElement) return;
            const seconds = Math.ceil(timer.seconds);
            timerElement.textContent = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
          },
        },
        0,
      )
      .to(
        card.querySelector("[data-mock-preview-answer]"),
        { backgroundColor: "#e6f0f4", borderColor: "#0b6ca2" },
        0.75,
      )
      .to(
        card.querySelector("[data-mock-preview-next]"),
        { backgroundColor: "#1b4c7d", duration: 0.15, yoyo: true, repeat: 1 },
        1.6,
      )
      .to({}, { duration: 1.2 })
      .call(() => {
        timer.seconds = 1214;
        if (timerElement) timerElement.textContent = "20:14";
      });
  }

  if (demo === "progress") {
    const score = { value: 2180 };
    const scoreElement = card.querySelector<HTMLElement>(
      "[data-progress-preview-score]",
    );
    timeline
      .fromTo(
        card.querySelector("[data-progress-preview-line]"),
        { strokeDasharray: 700, strokeDashoffset: 700 },
        { strokeDashoffset: 0, duration: 1.5, ease: "power2.inOut" },
      )
      .fromTo(
        card.querySelector("[data-progress-preview-area]"),
        { opacity: 0 },
        { opacity: 1, duration: 0.65 },
        "-=0.75",
      )
      .to(
        score,
        {
          value: 2310,
          duration: 1.15,
          onUpdate: () => {
            if (scoreElement)
              scoreElement.textContent = String(
                Math.round(score.value / 10) * 10,
              );
          },
        },
        0.1,
      )
      .from(
        card.querySelectorAll("[data-progress-preview-metric]"),
        { y: 8, opacity: 0, stagger: 0.1, duration: 0.35 },
        "-=0.4",
      )
      .to({}, { duration: 1 })
      .call(() => {
        score.value = 2180;
        if (scoreElement) scoreElement.textContent = "2180";
      });
  }

  return timeline;
}

export function UcatLandingProtocol() {
  const containerRef = useRef<HTMLElement>(null);
  const detailTriggerRef = useRef<HTMLButtonElement | null>(null);
  const detailCloseButtonRef = useRef<HTMLButtonElement>(null);
  const detailTimelineRef = useRef<gsap.core.Timeline | null>(null);
  const detailClosingRef = useRef(false);
  const [activeDetail, setActiveDetail] = useState<ProtocolFeatureKey | null>(
    null,
  );

  const openDetail = useCallback(
    (feature: ProtocolFeatureKey, event: MouseEvent<HTMLButtonElement>) => {
      if (activeDetail) return;
      detailTriggerRef.current = event.currentTarget;
      setActiveDetail(feature);
    },
    [activeDetail],
  );

  const closeDetail = useCallback(() => {
    if (!activeDetail || detailClosingRef.current) return;
    detailClosingRef.current = true;
    detailTimelineRef.current?.kill();
    const modal = document.querySelector<HTMLElement>(
      "[data-protocol-detail-modal]",
    );
    const backdrop = document.querySelector<HTMLElement>(
      "[data-protocol-detail-backdrop]",
    );
    const trigger = detailTriggerRef.current;

    const finish = () => {
      detailTimelineRef.current = null;
      setActiveDetail(null);
      window.requestAnimationFrame(() => trigger?.focus());
    };

    if (
      !modal ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      finish();
      return;
    }

    detailTimelineRef.current = gsap
      .timeline({ onComplete: finish })
      .to(modal, {
        y: 16,
        scale: 0.985,
        opacity: 0,
        duration: 0.2,
        ease: "power2.in",
      })
      .to(backdrop, { opacity: 0, duration: 0.18 }, 0);
  }, [activeDetail]);

  useLayoutEffect(() => {
    if (!activeDetail) return;

    detailClosingRef.current = false;
    const modal = document.querySelector<HTMLElement>(
      "[data-protocol-detail-modal]",
    );
    const backdrop = document.querySelector<HTMLElement>(
      "[data-protocol-detail-backdrop]",
    );
    const scroll = document.querySelector<HTMLElement>("[data-detail-scroll]");
    if (!modal || !backdrop || !scroll) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    scroll.scrollTop = 0;
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const revealTriggers: ScrollTrigger[] = [];

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeDetail();
      if (event.key === "Tab") {
        event.preventDefault();
        detailCloseButtonRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);

    if (reduceMotion) {
      gsap.set([modal, backdrop], { opacity: 1 });
      gsap.set("[data-detail-reveal], [data-ui-animate]", {
        opacity: 1,
        y: 0,
      });
      detailCloseButtonRef.current?.focus();
    } else {
      gsap.set(backdrop, { opacity: 0 });
      gsap.set(modal, { opacity: 0, y: 24, scale: 0.975 });
      detailTimelineRef.current = gsap
        .timeline()
        .to(backdrop, { opacity: 1, duration: 0.22 }, 0)
        .to(
          modal,
          {
            opacity: 1,
            y: 0,
            scale: 1,
            duration: 0.34,
            ease: "power3.out",
          },
          0.03,
        )
        .call(() => detailCloseButtonRef.current?.focus(), [], 0.28);

      const reveals = Array.from(
        modal.querySelectorAll<HTMLElement>("[data-detail-reveal]"),
      );
      reveals.forEach((section) => {
        const ui = section.querySelectorAll<HTMLElement>("[data-ui-animate]");
        gsap.set(section, { opacity: 0, y: 24 });
        gsap.set(ui, { opacity: 0, y: 12 });
        revealTriggers.push(
          ScrollTrigger.create({
            trigger: section,
            scroller: scroll,
            start: "top 88%",
            once: true,
            onEnter: () => {
              gsap
                .timeline()
                .to(section, {
                  opacity: 1,
                  y: 0,
                  duration: 0.48,
                  ease: "power3.out",
                })
                .to(
                  ui,
                  {
                    opacity: 1,
                    y: 0,
                    stagger: 0.06,
                    duration: 0.38,
                    ease: "power2.out",
                  },
                  "-=0.28",
                );
            },
          }),
        );
      });
      window.requestAnimationFrame(() => ScrollTrigger.refresh());
    }

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
      revealTriggers.forEach((trigger) => trigger.kill());
      detailTimelineRef.current?.kill();
    };
  }, [activeDetail, closeDetail]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const demoObservers: IntersectionObserver[] = [];

    const context = gsap.context(() => {
      const cards = Array.from(
        container.querySelectorAll<HTMLElement>("[data-protocol-card]"),
      );
      const reduceMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;

      gsap.set(cards, { transformOrigin: "top center" });
      gsap.from("[data-protocol-heading] > *", {
        scrollTrigger: {
          trigger: "[data-protocol-heading]",
          start: "top 78%",
          once: true,
        },
        y: 28,
        opacity: 0,
        stagger: 0.1,
        duration: reduceMotion ? 0 : 0.7,
        ease: "power3.out",
      });

      cards.forEach((card) => {
        gsap.from(card.querySelector("[data-protocol-card-content]"), {
          scrollTrigger: {
            trigger: card,
            start: "top 90%",
            once: true,
          },
          y: reduceMotion ? 0 : 48,
          opacity: 0,
          duration: reduceMotion ? 0 : 0.78,
          ease: "power3.out",
        });

        if (reduceMotion) return;
        const timeline = buildPreviewTimeline(card);
        const observer = new IntersectionObserver(
          ([entry]) => {
            if (entry?.isIntersecting) timeline.restart();
            else timeline.pause(0);
          },
          { threshold: 0.05 },
        );
        observer.observe(card);
        demoObservers.push(observer);
      });

      if (!reduceMotion && window.matchMedia("(min-width: 1024px)").matches) {
        cards.slice(0, -1).forEach((card, index) => {
          gsap.fromTo(
            card,
            { scale: 1, filter: "blur(0px)", opacity: 1 },
            {
              scrollTrigger: {
                trigger: cards[index + 1],
                start: "top center",
                end: "top top+=10%",
                scrub: true,
                invalidateOnRefresh: true,
              },
              scale: 0.9,
              filter: "blur(20px)",
              opacity: 0.5,
              transformOrigin: "top center",
              ease: "none",
              immediateRender: false,
            },
          );
        });
      }
    }, container);

    return () => {
      demoObservers.forEach((observer) => observer.disconnect());
      context.revert();
    };
  }, []);

  return (
    <section
      ref={containerRef}
      id="how-it-works"
      className="relative w-full overflow-x-clip bg-marketing-cream px-4 py-24 sm:px-6 sm:py-32 lg:px-8 lg:pb-[40vh] lg:pt-40"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-0 h-[540px] w-[900px] -translate-x-1/2 rounded-full bg-marketing-primary/[0.06] blur-[120px]"
      />
      <div
        data-protocol-heading
        className="relative mx-auto mb-14 max-w-4xl text-center text-marketing-charcoal sm:mb-20"
      >
        <p
          className={`text-xs font-bold uppercase tracking-[0.2em] text-marketing-primary ${typo.dataMono}`}
        >
          Inside Alti UCAT
        </p>
        <h2
          className={`mt-5 text-4xl font-bold tracking-[-0.05em] sm:text-6xl lg:text-7xl ${typo.headingSans}`}
        >
          Four connected parts of your preparation.
        </h2>
        <p
          className={`mx-auto mt-6 max-w-2xl text-base leading-relaxed text-marketing-charcoal/60 sm:text-xl ${typo.secondarySans}`}
        >
          Learn each section, practise targeted skills, rehearse the exam and
          use your results to decide what to work on next.
        </p>
      </div>

      <div className="relative mx-auto w-full max-w-7xl">
        <ShowcaseCard
          index="01"
          eyebrow="Learn"
          title="Structured learning for every UCAT section."
          description="Start with introductory modules, then work through simple techniques, worked examples and embedded questions covering Verbal Reasoning, Decision Making, Quantitative Reasoning and Situational Judgement."
          detail="Lesson progress is saved automatically. Video explanations and walkthroughs are planned for a future release."
          icon={<BookOpen className="h-5 w-5" />}
          theme="light"
          demo="learning"
          onLearnMore={(event) => openDetail("learning", event)}
        >
          <LearnCardPreview />
        </ShowcaseCard>

        <ShowcaseCard
          index="02"
          eyebrow="Practice tools"
          title="Target a specific skill or build a custom session."
          description="Use short skill trainers for repeated drills, or configure a practice session by UCAT section, question type, length and pacing. Every attempt is available for detailed review."
          detail="Mobile practice is planned so the same tools and progress record can be used away from your computer."
          icon={<Target className="h-5 w-5" />}
          theme="accent"
          reverse
          demo="practice"
          onLearnMore={(event) => openDetail("practice", event)}
        >
          <PracticeToolsCardPreview />
        </ShowcaseCard>

        <ShowcaseCard
          index="03"
          eyebrow="Mock exam simulation"
          title="Move from curated sets into full mock exams."
          description="Build section stamina with curated question sets, then complete full mocks in the UCAT-style question engine with real timing, flagging, navigation and keyboard controls."
          detail="After each set or mock, review accuracy, pacing and individual answers on the attempt analysis page."
          icon={<Clock3 className="h-5 w-5" />}
          theme="dark"
          demo="mocks"
          flushDemo
          onLearnMore={(event) => openDetail("mocks", event)}
        >
          <MockSimulationCardPreview />
        </ShowcaseCard>

        <ShowcaseCard
          index="04"
          eyebrow="Progress tracking"
          title="Review performance and plan what to do next."
          description="Bring practice, set and mock results into one view. Follow score estimates, compare performance, analyse speed and see how each UCAT section changes over time."
          detail="Score projections, study planning and consistency incentives turn the progress record into a practical next step."
          icon={<LineChart className="h-5 w-5" />}
          theme="light"
          reverse
          demo="progress"
          onLearnMore={(event) => openDetail("progress", event)}
        >
          <ProgressTrackingCardPreview />
        </ShowcaseCard>
      </div>

      {activeDetail ? (
        <ProtocolFeatureDetailModal
          feature={activeDetail}
          closeButtonRef={detailCloseButtonRef}
          onDismiss={closeDetail}
        />
      ) : null}

      <div className="relative mx-auto mt-12 flex max-w-7xl items-center justify-center gap-3 text-center text-sm text-marketing-charcoal/45 sm:mt-16">
        <CheckCircle2 className="h-4 w-4 text-marketing-primary" />
        <span className={typo.secondarySans}>
          One progress record connects learning, practice and exam simulation.
        </span>
      </div>
    </section>
  );
}
