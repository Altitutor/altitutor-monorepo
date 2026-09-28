"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@altitutor/ui";
import { ArrowUpRight } from "lucide-react";
import { Copy } from "./primitives";
import styles from "../marketing.module.css";

type TeachingDetail = {
  title: string;
  originalTitle: string;
  description: string;
  html: string;
};

type TeachingMethodSectionProps = {
  lessonSteps: readonly TeachingDetail[];
  weekSupport: readonly TeachingDetail[];
};

function LearnMore({ item }: { item: TeachingDetail }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button type="button" className={styles.teachingLearnMore}>
          Learn more <ArrowUpRight size={16} aria-hidden="true" />
        </button>
      </DialogTrigger>
      <DialogContent
        mobilePresentation="bottom-sheet"
        className="max-h-[min(90vh,calc(100dvh-2rem))] overflow-y-auto border-marketing-charcoal/10 bg-marketing-cream p-6 text-marketing-charcoal shadow-[0_12px_48px_rgb(0,0,0,0.12)] sm:max-w-xl sm:rounded-[1.75rem] sm:p-8"
      >
        <DialogHeader className="pr-6 text-left">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-marketing-primary">
            Our teaching method
          </p>
          <DialogTitle className="text-2xl font-semibold tracking-tight text-marketing-charcoal sm:text-3xl">
            {item.originalTitle}
          </DialogTitle>
          <DialogDescription className="sr-only">
            More about {item.title.toLowerCase()} at Altitutor.
          </DialogDescription>
        </DialogHeader>
        <Copy html={item.html} className="mt-3 text-marketing-charcoal/75" />
      </DialogContent>
    </Dialog>
  );
}

export function TeachingMethodSection({
  lessonSteps,
  weekSupport,
}: TeachingMethodSectionProps) {
  return (
    <section
      id="teaching"
      className={`${styles.processSection} ${styles.section}`}
    >
      <div className={styles.container}>
        <p className="text-xs font-semibold uppercase tracking-[0.15em] text-marketing-primary">
          Our teaching method
        </p>
        <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1fr)_19rem] lg:items-end">
          <h2 className="max-w-3xl text-4xl font-semibold tracking-tight text-marketing-charcoal sm:text-5xl">
            One lesson.{" "}
            <span className="font-serif italic">Support all week.</span>
          </h2>
          <p className="text-base leading-relaxed text-marketing-charcoal/70">
            A 1.5-hour small-group lesson builds your understanding. The support
            around it helps you put that learning to work.
          </p>
        </div>
        <div className="mt-12 grid gap-10 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <ol
            className="space-y-0 border-l border-marketing-primary/25 pl-6 sm:pl-9"
            data-scroll-stagger
          >
            {lessonSteps.map((step, index) => (
              <li key={step.originalTitle} className="relative pb-10 last:pb-0">
                <span
                  className="absolute -left-[2.15rem] grid size-5 place-items-center rounded-full border-4 border-[#e9e7df] bg-marketing-primary sm:-left-[2.9rem]"
                  aria-hidden="true"
                />
                <span className="text-xs font-semibold tracking-[0.14em] text-marketing-primary">
                  IN CLASS / {String(index + 1).padStart(2, "0")}
                </span>
                <h3 className="mt-2 text-2xl font-semibold text-marketing-charcoal">
                  {step.title}
                </h3>
                <p className="mt-2 max-w-xl leading-relaxed text-marketing-charcoal/70">
                  {step.description}
                </p>
                <LearnMore item={step} />
              </li>
            ))}
          </ol>
          <aside
            className="self-start rounded-[28px] bg-white p-6 shadow-sm ring-1 ring-black/[0.05]"
            data-scroll-stagger
          >
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-marketing-primary">
              Between lessons
            </p>
            <h3 className="mt-3 text-2xl font-semibold text-marketing-charcoal">
              Help stays close.
            </h3>
            <ul className="mt-5 space-y-5">
              {weekSupport.map((item) => (
                <li key={item.originalTitle}>
                  <strong className="text-marketing-charcoal">
                    {item.title}
                  </strong>
                  <p className="mt-1 text-sm leading-relaxed text-marketing-charcoal/65">
                    {item.description}
                  </p>
                  <LearnMore item={item} />
                </li>
              ))}
            </ul>
          </aside>
        </div>
      </div>
    </section>
  );
}
