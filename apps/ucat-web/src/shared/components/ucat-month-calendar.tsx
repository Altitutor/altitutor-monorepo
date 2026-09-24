"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Card, CardContent, CardHeader } from "@altitutor/ui";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  ACTIVITY_INTENSITY_CLASS,
  type UcatCalendarDay,
  type UcatCalendarMonth,
} from "@/shared/lib/ucat-month-calendar";
import { UCAT_CARD_CHROME } from "@/lib/ucat-surface-motion";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const EASE_OUT = [0.32, 0.72, 0, 1] as const;
const MONTH_SLIDE_OFFSET = 36;
/** Two compact months need roughly this width before collapsing to one. */
const DUAL_MONTH_MIN_WIDTH_PX = 560;

const monthPresenceVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? MONTH_SLIDE_OFFSET : -MONTH_SLIDE_OFFSET,
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
  },
  exit: (direction: number) => ({
    x: direction > 0 ? -MONTH_SLIDE_OFFSET : MONTH_SLIDE_OFFSET,
    opacity: 0,
  }),
};

export type UcatMonthCalendarDayContext = {
  visibleMonthKeys: readonly string[];
};

export type UcatMonthCalendarProps = {
  months: UcatCalendarMonth[];
  /** YYYY-MM — defaults to first month */
  initialMonthKey?: string;
  ariaLabel: string;
  className?: string;
  /** Optional section title above the month navigator */
  title?: ReactNode;
  description?: ReactNode;
  headerAction?: ReactNode;
  /** Shown under the month title (e.g. intensity legend) */
  legend?: ReactNode;
  /**
   * How many months to show at once. Dual-month view still advances one month
   * at a time so the overlapping month stays in frame. Collapses to one month
   * when the calendar container is too narrow.
   */
  monthsVisible?: 1 | 2;
  /** Tighter day cells and padding for denser layouts */
  density?: "default" | "compact";
  renderDay: (
    day: UcatCalendarDay,
    context: UcatMonthCalendarDayContext,
  ) => ReactNode;
  onVisibleMonthsChange?: (monthKeys: readonly string[]) => void;
};

function MonthGrid({
  month,
  density,
  dayContext,
  renderDay,
}: {
  month: UcatCalendarMonth;
  density: "default" | "compact";
  dayContext: UcatMonthCalendarDayContext;
  renderDay: UcatMonthCalendarProps["renderDay"];
}) {
  const isCompact = density === "compact";

  return (
    <div className="min-w-0">
      <h3
        className={cn(
          "font-semibold",
          isCompact ? "mb-2 text-sm" : "mb-3 text-base",
        )}
      >
        {month.label}
      </h3>
      <div className={cn("grid grid-cols-7", isCompact ? "gap-1" : "gap-1.5")}>
        {WEEKDAYS.map((weekday) => (
          <div
            key={`${month.key}-${weekday}`}
            className={cn(
              "pb-0.5 text-center font-medium uppercase tracking-[0.1em] text-muted-foreground",
              isCompact ? "text-[9px]" : "text-[10px]",
            )}
          >
            {weekday}
          </div>
        ))}

        {month.days.map((day, index) => {
          if (!day) {
            return (
              <span
                key={`${month.key}-blank-${index}`}
                className="aspect-square"
                aria-hidden
              />
            );
          }
          return (
            <div key={day.dateKey} className="aspect-square">
              {renderDay(day, dayContext)}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function UcatMonthCalendar({
  months,
  initialMonthKey,
  ariaLabel,
  className,
  title,
  description,
  headerAction,
  legend,
  monthsVisible = 1,
  density = "default",
  renderDay,
  onVisibleMonthsChange,
}: UcatMonthCalendarProps) {
  const reduceMotion = useReducedMotion();
  const animate = !reduceMotion;
  const containerRef = useRef<HTMLDivElement>(null);
  const [dualFits, setDualFits] = useState(false);
  const effectiveMonthsVisible: 1 | 2 =
    monthsVisible === 2 && dualFits ? 2 : 1;

  useLayoutEffect(() => {
    if (monthsVisible !== 2) {
      setDualFits(false);
      return;
    }
    const node = containerRef.current;
    if (!node || typeof ResizeObserver === "undefined") {
      setDualFits(true);
      return;
    }
    const update = (width: number) => {
      setDualFits(width >= DUAL_MONTH_MIN_WIDTH_PX);
    };
    update(node.getBoundingClientRect().width);
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      update(entry.contentRect.width);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [monthsVisible]);

  const resolvedInitialIndex = initialMonthKey
    ? months.findIndex((month) => month.key === initialMonthKey)
    : 0;
  const maxStartIndex = Math.max(0, months.length - effectiveMonthsVisible);
  const clampedInitial = Math.min(
    Math.max(resolvedInitialIndex >= 0 ? resolvedInitialIndex : 0, 0),
    maxStartIndex,
  );
  // Prefer showing the previous month alongside the initial month in dual view.
  const [visibleStartIndex, setVisibleStartIndex] = useState(clampedInitial);
  const [direction, setDirection] = useState(0);
  const dualPreferAppliedRef = useRef(false);

  useLayoutEffect(() => {
    setVisibleStartIndex((current) => {
      const max = Math.max(0, months.length - effectiveMonthsVisible);
      if (
        effectiveMonthsVisible === 2 &&
        !dualPreferAppliedRef.current &&
        current > 0
      ) {
        dualPreferAppliedRef.current = true;
        return Math.min(current - 1, max);
      }
      return Math.min(current, max);
    });
  }, [effectiveMonthsVisible, months.length]);

  const visibleMonths = months.slice(
    visibleStartIndex,
    visibleStartIndex + effectiveMonthsVisible,
  );
  const visibleMonthKeys = visibleMonths.map((month) => month.key);
  const dayContext: UcatMonthCalendarDayContext = { visibleMonthKeys };

  useEffect(() => {
    onVisibleMonthsChange?.(visibleMonthKeys);
    // Keys only — avoid firing when parent passes a new callback identity each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- visibleMonthKeys joined below
  }, [visibleMonthKeys.join("|")]);

  function showMonth(index: number) {
    if (index < 0 || index > maxStartIndex) return;
    setDirection(index > visibleStartIndex ? 1 : -1);
    setVisibleStartIndex(index);
  }

  if (visibleMonths.length === 0) return null;

  const isCompact = density === "compact";
  const canGoPrev = visibleStartIndex > 0;
  const canGoNext = visibleStartIndex < maxStartIndex;
  const monthTransition = {
    duration: animate ? 0.32 : 0,
    ease: EASE_OUT,
  };
  const showDualChrome = effectiveMonthsVisible === 2;

  return (
    <Card
      ref={containerRef}
      className={cn(
        UCAT_CARD_CHROME,
        "flex flex-col overflow-hidden",
        className,
      )}
      role="region"
      aria-label={ariaLabel}
      data-visible-month={visibleMonths[0]?.key}
      data-months-visible={effectiveMonthsVisible}
    >
      <CardHeader
        className={cn("space-y-3", isCompact ? "p-4 pb-2" : "p-5 pb-3")}
      >
        {title ? (
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <h2 className="text-base font-medium text-muted-foreground">
                {title}
              </h2>
              {description ? (
                <p className="text-muted-foreground text-sm font-normal">
                  {description}
                </p>
              ) : null}
            </div>
            {headerAction}
          </div>
        ) : null}

        {!showDualChrome ? (
          <div className="flex items-center justify-between gap-3">
            <h3
              className={cn(
                "font-semibold",
                title ? "text-base" : "text-lg",
              )}
            >
              {visibleMonths[0]?.label}
            </h3>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="icon"
                variant="outline"
                className={isCompact ? "size-8" : "size-9"}
                disabled={!canGoPrev}
                onClick={() => showMonth(visibleStartIndex - 1)}
                aria-label="Previous month"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                size="icon"
                variant="outline"
                className={isCompact ? "size-8" : "size-9"}
                disabled={!canGoNext}
                onClick={() => showMonth(visibleStartIndex + 1)}
                aria-label="Next month"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
            {legend ? (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px] text-muted-foreground">
                {legend}
              </div>
            ) : (
              <span className="sr-only">
                Showing{" "}
                {visibleMonths.map((month) => month.label).join(" and ")}
              </span>
            )}
            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="icon"
                variant="outline"
                className={isCompact ? "size-8" : "size-9"}
                disabled={!canGoPrev}
                onClick={() => showMonth(visibleStartIndex - 1)}
                aria-label="Previous month"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                size="icon"
                variant="outline"
                className={isCompact ? "size-8" : "size-9"}
                disabled={!canGoNext}
                onClick={() => showMonth(visibleStartIndex + 1)}
                aria-label="Next month"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {!showDualChrome && legend ? (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px] text-muted-foreground">
            {legend}
          </div>
        ) : null}
      </CardHeader>

      <CardContent
        className={cn(
          "flex flex-1 flex-col justify-center",
          isCompact ? "p-4 pt-0" : "p-5 pt-0",
        )}
      >
        {!showDualChrome ? (
          <div className="relative overflow-hidden">
            <AnimatePresence mode="wait" initial={false} custom={direction}>
              <motion.div
                key={visibleMonths[0]?.key}
                custom={direction}
                variants={monthPresenceVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={monthTransition}
              >
                <div
                  className={cn(
                    "grid grid-cols-7",
                    isCompact ? "gap-1" : "gap-1.5",
                  )}
                >
                  {WEEKDAYS.map((weekday) => (
                    <div
                      key={weekday}
                      className={cn(
                        "pb-0.5 text-center font-medium uppercase tracking-[0.1em] text-muted-foreground",
                        isCompact ? "text-[9px]" : "text-[10px]",
                      )}
                    >
                      {weekday}
                    </div>
                  ))}

                  {(visibleMonths[0]?.days ?? []).map((day, index) => {
                    if (!day) {
                      return (
                        <span
                          key={`blank-${index}`}
                          className="aspect-square"
                          aria-hidden
                        />
                      );
                    }
                    return (
                      <div key={day.dateKey} className="aspect-square">
                        {renderDay(day, dayContext)}
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        ) : (
          // Continuous strip: advancing by 1 keeps the overlapping month on-screen
          // and slides it into the other column instead of remounting the pair.
          <div className="overflow-hidden">
            <motion.div
              className="grid"
              style={{
                width: `${(months.length / effectiveMonthsVisible) * 100}%`,
                gridTemplateColumns: `repeat(${months.length}, minmax(0, 1fr))`,
              }}
              initial={false}
              animate={{
                x: `${(-visibleStartIndex / months.length) * 100}%`,
              }}
              transition={monthTransition}
            >
              {months.map((month, index) => (
                <div
                  key={month.key}
                  className={cn(index < months.length - 1 && "pr-4")}
                >
                  <MonthGrid
                    month={month}
                    density={density}
                    dayContext={dayContext}
                    renderDay={renderDay}
                  />
                </div>
              ))}
            </motion.div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function UcatActivityIntensityLegend() {
  return (
    <span className="flex items-center gap-2">
      <span>Less practice</span>
      <span
        className="flex gap-1"
        aria-label="Less practice to more practice"
      >
        {([0, 1, 2, 3, 4] as const).map((level) => (
          <span
            key={level}
            className={cn(
              "h-2.5 w-2.5 rounded-[3px]",
              ACTIVITY_INTENSITY_CLASS[level],
            )}
            aria-hidden
          />
        ))}
      </span>
      <span>More practice</span>
    </span>
  );
}
