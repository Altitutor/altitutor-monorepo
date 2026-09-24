"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@altitutor/ui";
import { MARKETING_TOKENS } from "@altitutor/shared";
import { ArrowRight } from "lucide-react";
import type { UcatFeature } from "./ucat-feature-data";
import { UcatFeatureDetailPreview } from "./ucat-feature-micro-ui";
import { MagneticButton } from "./magnetic-button";
import { UCAT_BODY_DESCRIPTION_CLASS } from "./ucat-landing-section-eyebrow";

const { typography: typo } = MARKETING_TOKENS;

const DIALOG_EASE = [0.32, 0.72, 0, 1] as const;
const BOTTOM_SHEET_DISMISS_DRAG_PX = 96;

type UcatFeatureDetailDialogProps = {
  feature: UcatFeature;
};

export function UcatFeatureDetailDialog({ feature }: UcatFeatureDetailDialogProps) {
  const [open, setOpen] = useState(false);
  const reduceMotion = useReducedMotion();
  const Icon = feature.icon;

  const dragStartYRef = useRef<number | null>(null);
  const dragOffsetRef = useRef(0);
  const [dragOffset, setDragOffset] = useState(0);
  const [isDraggingSheet, setIsDraggingSheet] = useState(false);

  useEffect(() => {
    if (!open) {
      dragStartYRef.current = null;
      dragOffsetRef.current = 0;
      setDragOffset(0);
      setIsDraggingSheet(false);
    }
  }, [open]);

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
      setOpen(false);
    }
    dragStartYRef.current = null;
    dragOffsetRef.current = 0;
    setDragOffset(0);
    setIsDraggingSheet(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button type="button" className="inline-flex">
          <MagneticButton
            className={`border border-marketing-charcoal/12 bg-white px-4 py-2 text-sm font-semibold text-marketing-charcoal shadow-sm hover:border-marketing-charcoal/20 hover:bg-marketing-cream ${typo.secondarySans}`}
          >
            Learn more <ArrowRight className="size-4" aria-hidden />
          </MagneticButton>
        </button>
      </DialogTrigger>
      <DialogContent
        mobilePresentation="bottom-sheet"
        className={`flex h-[90vh] max-h-[min(90vh,calc(100dvh-2rem))] w-full flex-col gap-0 overflow-hidden border-marketing-charcoal/10 bg-marketing-cream p-0 text-marketing-charcoal shadow-[0_12px_48px_rgb(0,0,0,0.12)] ring-1 ring-black/[0.08] md:h-[90vh] md:max-h-[min(90vh,calc(100dvh-2rem))] md:max-w-4xl md:rounded-[1.75rem] ${
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
            <DialogHeader className="pr-6 text-left">
              <div className="flex items-center gap-3">
                <span
                  className={`flex size-10 shrink-0 items-center justify-center rounded-full ${feature.theme.iconBg}`}
                >
                  <Icon className="size-5" aria-hidden />
                </span>
                <div>
                  <p
                    className={`text-xs font-semibold uppercase tracking-[0.14em] text-marketing-primary ${typo.dataMono}`}
                  >
                    {feature.eyebrow}
                  </p>
                  <DialogTitle
                    className={`mt-1 text-2xl font-semibold tracking-tight text-marketing-charcoal sm:text-3xl ${typo.headingSans}`}
                  >
                    {feature.title}
                  </DialogTitle>
                </div>
              </div>
              <DialogDescription
                className={`mt-4 ${UCAT_BODY_DESCRIPTION_CLASS} ${typo.secondarySans}`}
              >
                {feature.body}
              </DialogDescription>
            </DialogHeader>

            <motion.div
              className="mt-8 space-y-10"
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
              {feature.details.map((detail) => (
                <motion.article
                  key={detail.title}
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
                  <h3
                    className={`text-lg font-semibold tracking-tight text-marketing-charcoal ${typo.headingSans}`}
                  >
                    {detail.title}
                  </h3>
                  <p
                    className={`mt-2 ${UCAT_BODY_DESCRIPTION_CLASS} ${typo.secondarySans}`}
                  >
                    {detail.body}
                  </p>
                  <div className="mt-4">
                    <UcatFeatureDetailPreview id={detail.previewId} />
                  </div>
                </motion.article>
              ))}
            </motion.div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
