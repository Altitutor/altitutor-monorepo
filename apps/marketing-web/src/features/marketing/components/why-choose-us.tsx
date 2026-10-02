"use client";

import { useEffect, useRef, useState, type TouchEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@altitutor/ui";
import {
  ArrowRight,
  BookOpen,
  Check,
  GraduationCap,
  MessagesSquare,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Copy } from "./primitives";
import { MagneticButton } from "./magnetic-button";
import { StudentPortalPreview } from "./student-portal-preview";
import {
  MARKETING_BODY_DESCRIPTION_CLASS,
  MARKETING_CARD_TITLE_CLASS,
  MARKETING_CONTENT_WIDTH_CLASS,
} from "../section-styles";
import { MARKETING_TYPOGRAPHY as typo } from "../theme";
import styles from "../marketing.module.css";

const BOTTOM_SHEET_DISMISS_DRAG_PX = 96;

type Reason = {
  id: string;
  eyebrow: string;
  title: string;
  points: readonly string[];
  html: string;
  icon: LucideIcon;
  visual: "photo" | "portal";
  photo?: { src: string; alt: string };
};

const REASONS: readonly Omit<Reason, "html">[] = [
  {
    id: "4909d86",
    eyebrow: "Homework help",
    title: "Free homework help class",
    points: [
      "A 3 hour homework help class at no extra cost",
      "Ask tutors questions while you work",
      "In person assignment drafting included",
    ],
    icon: BookOpen,
    visual: "photo",
    photo: {
      src: "/images/marketing/homework-help.jpg",
      alt: "Homework help room with study tables, chairs, and a round table",
    },
  },
  {
    id: "bbc3db2",
    eyebrow: "Your tutors",
    title: "Tutors you can trust with your learning",
    points: [
      "Tutors who were top achieving students",
      "SACE courses known back to front",
      "Assessment strategies you will not find in a textbook",
    ],
    icon: GraduationCap,
    visual: "photo",
    photo: {
      src: "/images/marketing/tutors-you-can-trust.jpg",
      alt: "Students working together at a table in a tutoring session",
    },
  },
  {
    id: "88e7edc",
    eyebrow: "Online",
    title: "24/7 guidance and resource access",
    points: [
      "Unlimited question helpline",
      "Notes, practice questions, and video lessons",
      "Full length exams included",
    ],
    icon: MessagesSquare,
    visual: "portal",
  },
  {
    id: "bd33a23",
    eyebrow: "Your class",
    title: "A personalised learning experience",
    points: [
      "Small classes sorted by learning ability",
      "Everyone in the class is at the same level",
      "Learn from your own mistakes and each other’s",
    ],
    icon: Users,
    visual: "photo",
    photo: {
      src: "/images/marketing/personalised-learning.jpg",
      alt: "A tutor and student working one to one at a desk",
    },
  },
];

function plainText(html: string) {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function PhotoSlot({ src, alt }: { src: string; alt: string }) {
  return (
    <div className="relative h-full min-h-[240px] flex-1 overflow-hidden rounded-2xl ring-1 ring-black/[0.06]">
      <Image
        src={src}
        alt={alt}
        fill
        sizes="(min-width: 1024px) 36rem, 100vw"
        className="object-cover object-[center_45%]"
      />
    </div>
  );
}


function ReasonDialog({ reason }: { reason: Reason }) {
  const [open, setOpen] = useState(false);
  const dragStartY = useRef<number | null>(null);
  const dragOffsetRef = useRef(0);
  const [dragOffset, setDragOffset] = useState(0);
  const [isDraggingSheet, setIsDraggingSheet] = useState(false);
  const Icon = reason.icon;

  useEffect(() => {
    if (!open) {
      dragStartY.current = null;
      dragOffsetRef.current = 0;
      setDragOffset(0);
      setIsDraggingSheet(false);
    }
  }, [open]);

  function onTouchStart(event: TouchEvent<HTMLDivElement>) {
    dragStartY.current = event.touches[0]?.clientY ?? null;
    dragOffsetRef.current = 0;
    setDragOffset(0);
    setIsDraggingSheet(true);
  }

  function onTouchMove(event: TouchEvent<HTMLDivElement>) {
    if (dragStartY.current == null) return;
    const next = Math.max(
      0,
      (event.touches[0]?.clientY ?? dragStartY.current) - dragStartY.current,
    );
    dragOffsetRef.current = next;
    setDragOffset(next);
  }

  function onTouchEnd() {
    if (dragOffsetRef.current > BOTTOM_SHEET_DISMISS_DRAG_PX) setOpen(false);
    dragStartY.current = null;
    dragOffsetRef.current = 0;
    setDragOffset(0);
    setIsDraggingSheet(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button type="button" className="inline-flex">
          <MagneticButton
            className={`border border-marketing-charcoal/12 bg-white px-4 py-2 text-sm font-semibold text-marketing-charcoal shadow-sm hover:border-marketing-charcoal/20 ${typo.secondarySans}`}
          >
            Learn more <ArrowRight className="size-4" aria-hidden />
          </MagneticButton>
        </button>
      </DialogTrigger>
      <DialogContent
        mobilePresentation="bottom-sheet"
        className={`flex h-[90vh] max-h-[min(90vh,calc(100dvh-2rem))] w-full flex-col gap-0 overflow-hidden border-marketing-charcoal/10 bg-marketing-cream p-0 text-marketing-charcoal shadow-[0_12px_48px_rgb(0,0,0,0.12)] ring-1 ring-black/[0.08] md:h-auto md:max-h-[min(90vh,calc(100dvh-2rem))] md:max-w-2xl md:rounded-[1.75rem] ${
          isDraggingSheet ? "max-md:[animation:none]" : ""
        }`}
        style={dragOffset > 0 ? { transform: `translateY(${dragOffset}px)` } : undefined}
      >
        <div
          className="flex h-11 shrink-0 touch-pan-y items-center justify-center md:hidden"
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          onTouchCancel={onTouchEnd}
          aria-hidden
        >
          <span className="h-1 w-10 rounded-full bg-marketing-charcoal/15" />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-6 pt-2 sm:p-8 sm:pt-8">
          <DialogHeader className="pr-6 text-left">
            <div className="flex items-center gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-marketing-primary/10 text-marketing-primary">
                <Icon className="size-5" aria-hidden />
              </span>
              <div>
                <p
                  className={`text-xs font-semibold uppercase tracking-[0.14em] text-marketing-primary ${typo.dataMono}`}
                >
                  {reason.eyebrow}
                </p>
                <DialogTitle
                  className={`mt-1 text-2xl font-semibold tracking-tight text-marketing-charcoal sm:text-3xl ${typo.headingSans}`}
                >
                  {reason.title}
                </DialogTitle>
              </div>
            </div>
            <DialogDescription className="sr-only">
              {plainText(reason.html)}
            </DialogDescription>
          </DialogHeader>
          <Copy
            html={reason.html}
            className={`mt-5 ${MARKETING_BODY_DESCRIPTION_CLASS} ${typo.secondarySans}`}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function WhyChooseUs({ copy }: { copy: Record<string, string> }) {
  const reasons: Reason[] = REASONS.map((reason) => ({
    ...reason,
    html: copy[reason.id] ?? "",
  }));

  return (
    <section
      className="bg-marketing-cream px-4 pt-16 pb-28 sm:px-8 sm:pt-20 sm:pb-36"
      data-nav-label="Why choose us"
    >
      <div className={MARKETING_CONTENT_WIDTH_CLASS}>
        <h2 className="sr-only">Why choose us</h2>
        <div className={`${styles.homeStats} ${styles.homeStatsInSection}`}>
          <div>
            <strong>
              94<span>%</span>
            </strong>
            <p>
              Of our graduating year 12s receive a university offer for their top
              preference.
            </p>
          </div>
          <div>
            <strong>
              96<span>%</span>
            </strong>
            <p>
              Of our students improve their grade by at least one grade band
              within one term.
            </p>
          </div>
          <div>
            <strong>
              100<span>+</span>
            </strong>
            <p>5 star reviews</p>
            <Link href="/about/testimonials/">
              Read our student stories <ArrowRight size={15} aria-hidden="true" />
            </Link>
          </div>
        </div>
        <div className="grid min-w-0 gap-5 min-[801px]:grid-cols-2">
          {reasons.map((reason) => {
            const Icon = reason.icon;
            return (
              <article
                key={reason.id}
                className="flex min-w-0 flex-col overflow-hidden rounded-[30px] bg-white p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] ring-1 ring-black/[0.05] sm:p-8"
              >
                <div className="flex items-center gap-2.5">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-marketing-primary/10 text-marketing-primary">
                    <Icon className="size-4" aria-hidden />
                  </span>
                  <p
                    className={`text-base font-semibold text-marketing-primary ${typo.secondarySans}`}
                  >
                    {reason.eyebrow}
                  </p>
                </div>
                <h3 className={`mt-5 ${MARKETING_CARD_TITLE_CLASS} ${typo.headingSans}`}>
                  {reason.title}
                </h3>
                <ul
                  className={`mt-5 space-y-2.5 ${MARKETING_BODY_DESCRIPTION_CLASS} ${typo.secondarySans}`}
                >
                  {reason.points.map((point) => (
                    <li key={point} className="flex items-start gap-3">
                      <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-marketing-primary/10 text-marketing-primary">
                        <Check className="size-3" aria-hidden />
                      </span>
                      <span className="min-w-0">{point}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-6">
                  <ReasonDialog reason={reason} />
                </div>
                <div className="mt-6 flex min-h-[240px] min-w-0 flex-1 flex-col">
                  {reason.visual === "portal" ? (
                    <StudentPortalPreview />
                  ) : reason.photo ? (
                    <PhotoSlot src={reason.photo.src} alt={reason.photo.alt} />
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
