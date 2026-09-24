"use client";

import { useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@altitutor/ui";
import { MARKETING_TOKENS } from "@altitutor/shared";
import { UCAT_BODY_DESCRIPTION_CLASS } from "./ucat-landing-section-eyebrow";
import { ArrowRight } from "lucide-react";
import { UcatInterestForm } from "./ucat-interest-form";
import type { UcatInterestKind } from "./ucat-interest-kind";

const { typography: typo } = MARKETING_TOKENS;
const BOTTOM_SHEET_DISMISS_DRAG_PX = 96;

type UcatInterestDialogProps = {
  kind: UcatInterestKind;
  triggerLabel: string;
  title: string;
  description: string;
  triggerClassName?: string;
  hideTriggerIcon?: boolean;
};

export function UcatInterestDialog({
  kind,
  triggerLabel,
  title,
  description,
  triggerClassName,
  hideTriggerIcon = false,
}: UcatInterestDialogProps) {
  const [open, setOpen] = useState(false);

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
        <button
          type="button"
          className={
            triggerClassName ??
            "inline-flex items-center justify-center gap-2 rounded-full bg-marketing-primary px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-marketing-charcoal"
          }
        >
          {triggerLabel}
          {hideTriggerIcon ? null : (
            <ArrowRight className="size-4" aria-hidden />
          )}
        </button>
      </DialogTrigger>
      <DialogContent
        mobilePresentation="bottom-sheet"
        className={`flex h-[90vh] max-h-[min(90vh,calc(100dvh-2rem))] w-full flex-col gap-0 overflow-hidden border-marketing-charcoal/10 bg-marketing-cream p-0 text-marketing-charcoal shadow-[0_12px_48px_rgb(0,0,0,0.12)] ring-1 ring-black/[0.08] md:h-auto md:max-h-[min(90vh,calc(100dvh-2rem))] md:max-w-xl md:rounded-[1.75rem] ${
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
              <DialogTitle
                className={`text-2xl font-semibold tracking-tight text-marketing-charcoal sm:text-3xl ${typo.headingSans}`}
              >
                {title}
              </DialogTitle>
              <DialogDescription
                className={`mt-4 ${UCAT_BODY_DESCRIPTION_CLASS} ${typo.secondarySans}`}
              >
                {description}
              </DialogDescription>
            </DialogHeader>

            <div className="mt-8">
              <UcatInterestForm kind={kind} />
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
