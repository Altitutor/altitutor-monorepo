"use client";

import { useEffect, useRef, useState, type TouchEvent } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@altitutor/ui";
import { ArrowRight, HeartHandshake, type LucideIcon } from "lucide-react";
import { Copy } from "./primitives";
import { MagneticButton } from "./magnetic-button";
import { MARKETING_BODY_DESCRIPTION_CLASS } from "../section-styles";
import { MARKETING_TYPOGRAPHY as typo } from "../theme";

const BOTTOM_SHEET_DISMISS_DRAG_PX = 96;

function plainText(html: string) {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

type SubsidyLearnMoreDialogProps = {
  eyebrow: string;
  title: string;
  paragraphs: readonly string[];
  icon?: LucideIcon;
};

export function SubsidyLearnMoreDialog({
  eyebrow,
  title,
  paragraphs,
  icon: Icon = HeartHandshake,
}: SubsidyLearnMoreDialogProps) {
  const [open, setOpen] = useState(false);
  const dragStartY = useRef<number | null>(null);
  const dragOffsetRef = useRef(0);
  const [dragOffset, setDragOffset] = useState(0);
  const [isDraggingSheet, setIsDraggingSheet] = useState(false);

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

  const description = paragraphs.map(plainText).join(" ");

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
        className={`flex h-[90vh] max-h-[min(90vh,calc(100dvh-2rem))] w-full flex-col gap-0 overflow-hidden border-marketing-charcoal/10 bg-marketing-cream p-0 text-marketing-charcoal shadow-[0_12px_48px_rgb(0,0,0,0.12)] ring-1 ring-black/[0.08] md:h-auto md:max-h-[min(90vh,calc(100dvh-2rem))] md:max-w-2xl md:rounded-[1.75rem] ${
          isDraggingSheet ? "max-md:[animation:none]" : ""
        }`}
        style={
          dragOffset > 0 ? { transform: `translateY(${dragOffset}px)` } : undefined
        }
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
                  {eyebrow}
                </p>
                <DialogTitle
                  className={`mt-1 text-2xl font-semibold tracking-tight text-marketing-charcoal sm:text-3xl ${typo.headingSans}`}
                >
                  {title}
                </DialogTitle>
              </div>
            </div>
            <DialogDescription className="sr-only">{description}</DialogDescription>
          </DialogHeader>
          <div
            className={`mt-5 space-y-4 ${MARKETING_BODY_DESCRIPTION_CLASS} ${typo.secondarySans}`}
          >
            {paragraphs.map((html, index) => (
              <Copy key={index} html={html} />
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
