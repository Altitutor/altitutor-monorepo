"use client";

import Link from "next/link";
import { ArrowRight, Monitor, School } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@altitutor/ui";
import { Eyebrow } from "./primitives";
import styles from "../marketing.module.css";

const HASH = "#find-your-course";
/** Set when this tab opened the popup, so closing it can use history.back(). */
const ENTRY_KEY = "find-your-course-entry";
const BOTTOM_SHEET_DISMISS_DRAG_PX = 96;
const DIALOG_EASE = [0.32, 0.72, 0, 1] as const;

const choices: {
  href: string;
  title: string;
  description: string;
  action: string;
  icon: LucideIcon;
}[] = [
  {
    href: "/classes/",
    title: "In person tutoring",
    description:
      "Weekly classes in Adelaide for school subjects, exams, assignments, UCAT, and medical interviews. In person students also get the online resources.",
    action: "See in person courses",
    icon: School,
  },
  {
    href: "/online-courses/",
    title: "Online tutoring",
    description:
      "Learn from anywhere with online SACE and IB study resources, and a personalised plan for UCAT preparation.",
    action: "See online courses",
    icon: Monitor,
  },
];

function hashOpen() {
  return window.location.hash === HASH;
}

function readPushed() {
  try {
    return sessionStorage.getItem(ENTRY_KEY) === "1";
  } catch {
    return false;
  }
}

function markPushed() {
  try {
    sessionStorage.setItem(ENTRY_KEY, "1");
  } catch {
    /* sessionStorage can be blocked in private browsing */
  }
}

function clearPushed() {
  try {
    sessionStorage.removeItem(ENTRY_KEY);
  } catch {
    /* sessionStorage can be blocked in private browsing */
  }
}

export function FindYourCourseDialog() {
  const [open, setOpen] = useState(false);
  const reduceMotion = useReducedMotion();

  const dragStartYRef = useRef<number | null>(null);
  const dragOffsetRef = useRef(0);
  const [dragOffset, setDragOffset] = useState(0);
  const [isDraggingSheet, setIsDraggingSheet] = useState(false);

  useEffect(() => {
    const sync = () => {
      const visible = hashOpen();
      setOpen(visible);
      if (!visible) clearPushed();
    };
    const markSamePageHash = (event: MouseEvent) => {
      if (
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      )
        return;
      const anchor = (event.target as Element | null)?.closest("a[href]");
      if (!(anchor instanceof HTMLAnchorElement)) return;
      const url = new URL(anchor.href, window.location.href);
      if (url.hash !== HASH || url.pathname !== window.location.pathname) return;
      markPushed();
      // Let the browser record the hash. Next.js links would otherwise swallow it.
      event.stopPropagation();
    };
    sync();
    window.addEventListener("hashchange", sync);
    window.addEventListener("popstate", sync);
    document.addEventListener("click", markSamePageHash, true);
    return () => {
      window.removeEventListener("hashchange", sync);
      window.removeEventListener("popstate", sync);
      document.removeEventListener("click", markSamePageHash, true);
    };
  }, []);

  useEffect(() => {
    if (!open) {
      dragStartYRef.current = null;
      dragOffsetRef.current = 0;
      setDragOffset(0);
      setIsDraggingSheet(false);
    }
  }, [open]);

  function close() {
    if (!hashOpen()) {
      setOpen(false);
      return;
    }
    if (readPushed()) {
      window.history.back();
      return;
    }
    window.history.replaceState(
      window.history.state,
      "",
      window.location.pathname + window.location.search,
    );
    clearPushed();
    setOpen(false);
  }

  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen) {
      setOpen(true);
      return;
    }
    close();
  }

  const handleSheetTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    dragStartYRef.current = event.touches[0]?.clientY ?? null;
    dragOffsetRef.current = 0;
    setDragOffset(0);
    setIsDraggingSheet(true);
  };

  const handleSheetTouchMove = (event: React.TouchEvent<HTMLDivElement>) => {
    if (dragStartYRef.current == null) return;
    const nextOffset = Math.max(
      0,
      (event.touches[0]?.clientY ?? dragStartYRef.current) - dragStartYRef.current,
    );
    dragOffsetRef.current = nextOffset;
    setDragOffset(nextOffset);
  };

  const handleSheetTouchEnd = () => {
    if (dragOffsetRef.current > BOTTOM_SHEET_DISMISS_DRAG_PX) {
      close();
    }
    dragStartYRef.current = null;
    dragOffsetRef.current = 0;
    setDragOffset(0);
    setIsDraggingSheet(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        mobilePresentation="bottom-sheet"
        overlayClassName={styles.courseDialogOverlay}
        className={`flex h-auto max-h-[min(90vh,calc(100dvh-2rem))] w-full flex-col gap-0 overflow-hidden border-marketing-charcoal/10 bg-marketing-cream p-0 text-marketing-charcoal shadow-[0_12px_48px_rgb(0,0,0,0.12)] ring-1 ring-black/[0.08] max-md:h-auto max-md:max-h-[min(88dvh,calc(100dvh-2rem))] md:max-h-[min(90vh,calc(100dvh-2rem))] md:max-w-3xl md:rounded-[1.75rem] ${
          isDraggingSheet ? "max-md:[animation:none]" : ""
        }`}
        style={
          dragOffset > 0
            ? { transform: `translateY(${dragOffset}px)` }
            : undefined
        }
      >
        <div
          className="flex h-11 shrink-0 touch-pan-y items-center justify-center md:hidden"
          onTouchStart={handleSheetTouchStart}
          onTouchMove={handleSheetTouchMove}
          onTouchEnd={handleSheetTouchEnd}
          onTouchCancel={handleSheetTouchEnd}
          aria-hidden
        >
          <span className="h-1 w-10 rounded-full bg-marketing-charcoal/15" />
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-6 pt-2 sm:p-8 sm:pt-8">
            <div className={styles.courseDialogInner}>
              <DialogHeader className={`${styles.courseDialogHeading} text-left`}>
                <Eyebrow>Find your course</Eyebrow>
                <DialogTitle asChild>
                  <h2>
                    In person
                    <em> or online?</em>
                  </h2>
                </DialogTitle>
                <DialogDescription asChild>
                  <p className={styles.lede}>
                    Choose how you want to learn, and we’ll take you to the right
                    courses.
                  </p>
                </DialogDescription>
              </DialogHeader>

              <motion.div
                className={styles.formatChoices}
                initial={reduceMotion || !open ? false : "hidden"}
                animate={open ? "show" : "hidden"}
                variants={{
                  hidden: {},
                  show: {
                    transition: {
                      staggerChildren: reduceMotion ? 0 : 0.08,
                      delayChildren: reduceMotion ? 0 : 0.12,
                    },
                  },
                }}
              >
                {choices.map(({ href, title, description, action, icon: Icon }) => (
                  <motion.div
                    key={href}
                    variants={{
                      hidden: reduceMotion
                        ? { opacity: 1, y: 0 }
                        : { opacity: 0, y: 14 },
                      show: {
                        opacity: 1,
                        y: 0,
                        transition: { duration: 0.28, ease: DIALOG_EASE },
                      },
                    }}
                  >
                    <Link href={href} className={styles.formatChoice}>
                      <Icon size={28} aria-hidden="true" />
                      <h3>{title}</h3>
                      <p>{description}</p>
                      <span className={styles.textLink}>
                        {action}
                        <ArrowRight size={16} aria-hidden="true" />
                      </span>
                    </Link>
                  </motion.div>
                ))}
              </motion.div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
