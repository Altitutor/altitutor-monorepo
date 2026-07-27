"use client";

import { useEffect, useRef } from "react";
import { MARKETING_TOKENS } from "@altitutor/shared";
import {
  ArrowRight,
  BarChart3,
  CalendarCheck,
  Check,
  ClipboardCheck,
} from "lucide-react";
import { AnalyticsLink } from "../analytics-link";
import { PRODUCT_LINKS } from "@/lib/site";

const { typography: typo } = MARKETING_TOKENS;

const steps = [
  {
    number: "01",
    title: "Start free",
    body: "Create your account and set your target score.",
  },
  {
    number: "02",
    title: "Build your baseline",
    body: "Complete a short benchmark and our system will build you an adaptive study plan.",
  },
  {
    number: "03",
    title: "Follow your plan",
    body: "Work through learning, practice questions, and mocks selected around your gaps and the time left before test day.",
  },
] as const;

function StartVisual() {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/[0.06]">
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="rounded-xl bg-[#f2f3f4] p-3"><p className="text-[9px] uppercase tracking-wider text-black/38">Target score</p><p className="mt-1 text-lg font-bold text-[#0a2941]">2,350</p></div>
        <div className="rounded-xl bg-[#f2f3f4] p-3"><p className="text-[9px] uppercase tracking-wider text-black/38">Weekly time</p><p className="mt-1 text-lg font-bold text-[#0a2941]">4 hours</p></div>
      </div>
      <div className="mt-3 flex items-center justify-between rounded-xl bg-[#0a2941] px-3 py-2.5 text-[10px] font-semibold text-white"><span>Account ready</span><Check className="size-3.5 text-[#92b9c6]" aria-hidden /></div>
    </div>
  );
}

function BaselineVisual() {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/[0.06]">
      <div className="flex items-center gap-2 text-[10px] font-semibold"><ClipboardCheck className="size-4 text-[#0a2941]" aria-hidden /> Baseline progress</div>
      <div className="mt-4 space-y-3">
        {[["Verbal Reasoning", 100], ["Decision Making", 100], ["Quantitative Reasoning", 64]].map(([label, width]) => (
          <div key={String(label)}><div className="flex justify-between text-[9px] text-black/45"><span>{label}</span><span>{width === 100 ? "Complete" : "In progress"}</span></div><div className="mt-1.5 h-1.5 rounded-full bg-[#e8eaed]"><div className="h-full rounded-full bg-[#0a2941]" style={{ width: `${width}%` }} /></div></div>
        ))}
      </div>
    </div>
  );
}

function PlanVisual() {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/[0.06]">
      <div className="flex items-center justify-between gap-2"><span className="flex items-center gap-2 text-[10px] font-semibold"><CalendarCheck className="size-4 text-[#0a2941]" aria-hidden /> Today&apos;s plan</span><span className="text-[9px] text-black/40">35 min</span></div>
      <div className="mt-3 space-y-2">
        {["Syllogism warm-up", "Targeted VR practice", "Review missed questions"].map((task, index) => (
          <div key={task} className={`flex items-center gap-2 rounded-xl px-3 py-2.5 text-[10px] ${index === 1 ? "bg-[#0a2941] font-semibold text-white" : "bg-[#f2f3f4]"}`}><span className={`grid size-5 place-items-center rounded-full ${index === 1 ? "bg-white/15" : "bg-white"}`}>{index + 1}</span><span className="flex-1">{task}</span><ArrowRight className="size-3" aria-hidden /></div>
        ))}
      </div>
    </div>
  );
}

export function UcatHowItWorks() {
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    let cancelled = false;
    let context: { revert: () => void } | undefined;
    void Promise.all([import("gsap"), import("gsap/ScrollTrigger")]).then(([gsapModule, scrollTriggerModule]) => {
      if (cancelled || !sectionRef.current) return;
      const gsap = gsapModule.default;
      gsap.registerPlugin(scrollTriggerModule.ScrollTrigger);
      context = gsap.context(() => {
        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
        gsap.from("[data-how-step]", {
          opacity: 0,
          y: 48,
          stagger: 0.12,
          duration: 0.75,
          ease: "power3.out",
          scrollTrigger: { trigger: sectionRef.current, start: "top 76%", once: true },
        });
      }, sectionRef);
    });
    return () => { cancelled = true; context?.revert(); };
  }, []);

  return (
    <section ref={sectionRef} id="how-it-works" className="bg-marketing-cream px-4 py-24 sm:px-8 sm:py-32">
      <div className="mx-auto max-w-7xl">
        <div className="mx-auto max-w-3xl text-center">
          <p className={`text-xs font-semibold uppercase tracking-[0.18em] text-marketing-primary/60 ${typo.dataMono}`}>How it works</p>
          <h2 className={`mt-4 text-4xl font-semibold tracking-[-0.04em] text-marketing-charcoal sm:text-6xl ${typo.headingSans}`}>From your first benchmark to a clearer path forward.</h2>
          <p className={`mx-auto mt-6 max-w-2xl text-base leading-relaxed text-marketing-charcoal/58 sm:text-lg ${typo.secondarySans}`}>Start with enough evidence to make the direction useful. Then let each attempt refine what comes next.</p>
        </div>

        <div className="mt-16 grid gap-5 lg:grid-cols-3">
          {steps.map((step, index) => (
            <article key={step.number} data-how-step className="flex flex-col rounded-[2rem] border border-marketing-charcoal/10 bg-white p-5 shadow-sm sm:p-7">
              <div className="flex items-center justify-between"><span className={`text-xs font-semibold tracking-[0.16em] text-marketing-primary/50 ${typo.dataMono}`}>{step.number}</span>{index === 1 ? <BarChart3 className="size-5 text-marketing-primary" aria-hidden /> : null}</div>
              <h3 className={`mt-6 text-2xl font-semibold text-marketing-charcoal ${typo.headingSans}`}>{step.title}</h3>
              <p className={`mt-3 min-h-[5.25rem] text-sm leading-relaxed text-marketing-charcoal/58 ${typo.secondarySans}`}>{step.body}</p>
              <div className="mt-6">{index === 0 ? <StartVisual /> : index === 1 ? <BaselineVisual /> : <PlanVisual />}</div>
            </article>
          ))}
        </div>

        <div className="mt-10 text-center">
          <AnalyticsLink href={PRODUCT_LINKS.ucatSignup} analytics={{ product: "ucat", placement: "how_it_works", action: "start_free" }} className={`inline-flex items-center gap-2 rounded-full bg-marketing-primary px-6 py-3.5 text-sm font-semibold text-white ${typo.secondarySans}`}>Start preparing free <ArrowRight className="size-4" aria-hidden /></AnalyticsLink>
        </div>
      </div>
    </section>
  );
}
