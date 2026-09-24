'use client';

import {
  cloneElement,
  isValidElement,
  useEffect,
  useRef,
  useState,
} from 'react';
import type { CardComponentProps } from 'nextstepjs';
import { Button } from '@altitutor/ui';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { studentSurfaceCard } from '@/shared/lib/student-visual';
import { cn } from '@/shared/utils';

/**
 * Themed onboarding card used by `<NextStep cardComponent={...}>`.
 *
 * For `side: top/bottom` anchored to narrow sidebar nav rows, nextstepjs
 * centers the card on the row — we cap width so it stays on-screen.
 */
const SIDEBAR_NAV_SELECTOR_PATTERN = /^\[data-tour='nav-/;

export function OnboardingCard({
  step,
  currentStep,
  totalSteps,
  nextStep,
  prevStep,
  skipTour,
  arrow,
}: CardComponentProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [viewportOffset, setViewportOffset] = useState({ x: 0, y: 0 });
  // nextstepjs types `step` as always defined, but it passes
  // `currentTourSteps?.[currentStep]`, which is undefined during tour
  // close/route races (stale overlay with a missing step index).
  const safeStep = step as CardComponentProps['step'] | undefined;

  useEffect(() => {
    if (!safeStep) return;
    setViewportOffset({ x: 0, y: 0 });
    const timer = window.setTimeout(() => {
      const card = cardRef.current;
      if (!card) return;
      const rect = card.getBoundingClientRect();
      const padding = 12;
      let x = 0;
      let y = 0;

      if (rect.left < padding) x = padding - rect.left;
      else if (rect.right > window.innerWidth - padding) {
        x = window.innerWidth - padding - rect.right;
      }
      if (rect.top < padding) y = padding - rect.top;
      else if (rect.bottom > window.innerHeight - padding) {
        y = window.innerHeight - padding - rect.bottom;
      }

      setViewportOffset({ x, y });
    }, 280);

    return () => window.clearTimeout(timer);
  }, [currentStep, safeStep]);

  if (!safeStep) return null;

  const isFirst = currentStep === 0;
  const isLast = currentStep === totalSteps - 1;
  const progressPct = Math.round(((currentStep + 1) / totalSteps) * 100);

  const isSidebarTopOrBottom =
    !!safeStep.selector &&
    SIDEBAR_NAV_SELECTOR_PATTERN.test(safeStep.selector) &&
    (safeStep.side === 'top' || safeStep.side === 'bottom');

  const adjustedArrow = isValidElement<{ style?: React.CSSProperties }>(arrow)
    ? cloneElement(arrow, {
        style: {
          ...arrow.props.style,
          ...(safeStep.side === 'top' || safeStep.side === 'bottom'
            ? {
                left: `calc(50% - ${viewportOffset.x}px)`,
                right: 'auto',
              }
            : {}),
          ...(safeStep.side === 'left' || safeStep.side === 'right'
            ? {
                top: `calc(50% - ${viewportOffset.y}px)`,
                bottom: 'auto',
              }
            : {}),
        },
      })
    : arrow;

  return (
    <div
      ref={cardRef}
      style={
        {
          transform: `translate(${viewportOffset.x}px, ${viewportOffset.y}px)`,
          '--tour-arrow-left': `calc(50% - ${viewportOffset.x}px)`,
          '--tour-arrow-top': `calc(50% - ${viewportOffset.y}px)`,
        } as React.CSSProperties
      }
      className={cn(
        'relative p-5 text-card-foreground shadow-xl',
        studentSurfaceCard,
        (safeStep.side === 'top' || safeStep.side === 'bottom') &&
          "[&_[data-name='nextstep-arrow']]:!left-[var(--tour-arrow-left)] [&_[data-name='nextstep-arrow']]:!right-auto",
        (safeStep.side === 'left' || safeStep.side === 'right') &&
          "[&_[data-name='nextstep-arrow']]:!top-[var(--tour-arrow-top)] [&_[data-name='nextstep-arrow']]:!bottom-auto",
        isSidebarTopOrBottom
          ? 'w-[min(14rem,calc(100vw-2rem))] max-w-none'
          : !safeStep.selector
            ? 'w-[min(32rem,calc(100vw-2rem))] max-w-none'
            : 'w-[min(20rem,calc(100vw-2rem))] max-w-sm',
      )}
      role="dialog"
      aria-labelledby="student-onboarding-title"
    >
      {adjustedArrow}

      <div className="flex items-start gap-3">
        {safeStep.icon ? (
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground"
            aria-hidden
          >
            {safeStep.icon}
          </span>
        ) : null}
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Step {currentStep + 1} of {totalSteps}
          </p>
          <h3
            id="student-onboarding-title"
            className="mt-0.5 text-base font-semibold leading-snug"
          >
            {safeStep.title}
          </h3>
        </div>
        {safeStep.showSkip && skipTour ? (
          <button
            type="button"
            onClick={skipTour}
            aria-label="Skip tour"
            className={cn(
              '-mr-1 -mt-1 shrink-0 rounded-md p-1 text-muted-foreground transition-colors',
              'hover:bg-muted hover:text-foreground',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/25 focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:focus-visible:ring-white/35',
            )}
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      <div className="mt-3 text-sm leading-relaxed text-card-foreground/90">
        {safeStep.content}
      </div>

      <div
        className="mt-4 h-1 w-full overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={totalSteps}
        aria-valuenow={currentStep + 1}
      >
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-300 ease-out"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      {safeStep.showControls ? (
        <div className="mt-4 flex items-center justify-between gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={prevStep}
            disabled={isFirst}
            className="gap-1"
          >
            <ChevronLeft className="h-4 w-4" />
            Back
          </Button>
          <Button type="button" size="sm" onClick={nextStep} className="gap-1">
            {isLast ? 'Finish' : 'Next'}
            {isLast ? null : <ChevronRight className="h-4 w-4" />}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
