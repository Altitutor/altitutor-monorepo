"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { gsap } from "gsap";
import {
  BookOpen,
  BrainCircuit,
  CalendarDays,
  Clock3,
  Gauge,
  RotateCcw,
  Sparkles,
  Target,
  type LucideIcon,
} from "lucide-react";
import {
  DemoCursor,
  DemoStage,
  demoContainerVariants,
  demoItemVariants,
} from "./demo-stage";

const TODAY = "2026-07-16";
const TEST_DATE = "2026-07-27";
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
const DEMO_DAYS = ["2026-07-14", "2026-07-16", "2026-07-18"] as const;

type TaskType = "practice" | "review" | "learn" | "trainer";

type PreviewTask = {
  id: string;
  title: string;
  description: string;
  minutes: number;
  type: TaskType;
};

const tasksByDate: Record<string, PreviewTask[]> = {
  "2026-07-14": [
    {
      id: "mon-learn",
      title: "QR foundations · ratios",
      description: "Complete the short ratios module before timed work.",
      minutes: 14,
      type: "learn",
    },
    {
      id: "mon-practice",
      title: "QR ratios · untimed set",
      description: "Apply the method across 10 questions with feedback.",
      minutes: 18,
      type: "practice",
    },
  ],
  "2026-07-16": [
    {
      id: "wed-trainer",
      title: "Syllogism speed warm-up",
      description: "Build accuracy before the timed set.",
      minutes: 6,
      type: "trainer",
    },
    {
      id: "wed-practice",
      title: "Reading Comprehension · 0.75×",
      description: "Complete 16 targeted questions.",
      minutes: 22,
      type: "practice",
    },
    {
      id: "wed-review",
      title: "Review today’s VR attempt",
      description: "Work through every missed or slow question.",
      minutes: 7,
      type: "review",
    },
  ],
  "2026-07-18": [
    {
      id: "fri-learn",
      title: "Decision Making foundations",
      description: "Complete the short arguments module.",
      minutes: 12,
      type: "learn",
    },
    {
      id: "fri-practice",
      title: "Arguments mini-set · untimed",
      description: "Complete 8 questions with immediate feedback.",
      minutes: 15,
      type: "practice",
    },
  ],
};

const practiceMinutesByDate: Record<string, number> = {
  "2026-07-14": 32,
  "2026-07-15": 18,
  "2026-07-16": 35,
  "2026-07-17": 12,
  "2026-07-18": 27,
  "2026-07-20": 22,
  "2026-07-21": 40,
  "2026-07-22": 15,
  "2026-07-23": 28,
};

function intensityClass(level: 0 | 1 | 2 | 3 | 4): string {
  switch (level) {
    case 0:
      return "bg-black/[0.04]";
    case 1:
      return "bg-[#c5dce5]";
    case 2:
      return "bg-[#92b9c6]";
    case 3:
      return "bg-[#355d72] text-white";
    case 4:
      return "bg-[#0a2941] text-white";
    default: {
      const _exhaustive: never = level;
      return _exhaustive;
    }
  }
}

function minutesToLevel(
  minutes: number,
  maxMinutes: number,
): 0 | 1 | 2 | 3 | 4 {
  if (minutes <= 0 || maxMinutes <= 0) return 0;
  const ratio = minutes / maxMinutes;
  if (ratio < 0.25) return 1;
  if (ratio < 0.5) return 2;
  if (ratio < 0.75) return 3;
  return 4;
}

function taskIcon(type: TaskType): LucideIcon {
  switch (type) {
    case "trainer":
      return Sparkles;
    case "review":
      return RotateCcw;
    case "learn":
      return BookOpen;
    case "practice":
      return BrainCircuit;
    default: {
      const _exhaustive: never = type;
      return _exhaustive;
    }
  }
}

/** Two weeks (Mon 13 – Sun 26) so tasks peek on all breakpoints. */
function buildTwoWeekDays() {
  const days: Array<{ dateKey: string; day: number }> = [];
  for (let day = 13; day <= 26; day += 1) {
    days.push({
      dateKey: `2026-07-${String(day).padStart(2, "0")}`,
      day,
    });
  }
  return days;
}

function formatSelectedDay(dateKey: string): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-AU", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function moveCursorTo(
  timeline: gsap.core.Timeline,
  stage: HTMLElement,
  cursor: HTMLElement,
  target: HTMLElement,
) {
  const stageRect = stage.getBoundingClientRect();
  const targetRect = target.getBoundingClientRect();
  timeline.to(cursor, {
    left: targetRect.left - stageRect.left + targetRect.width / 2 - 4,
    top: targetRect.top - stageRect.top + targetRect.height / 2 - 2,
    opacity: 1,
    duration: 0.55,
    ease: "power2.inOut",
  });
}

export function UcatStudyPlanPreview() {
  const reduceMotion = useReducedMotion();
  const stageRef = useRef<HTMLDivElement>(null);
  const cursorRef = useRef<HTMLDivElement>(null);
  const [selectedDate, setSelectedDate] = useState<string>(TODAY);
  const calendarDays = useMemo(() => buildTwoWeekDays(), []);
  const maxPractice = Math.max(...Object.values(practiceMinutesByDate), 1);
  const selectedTasks = tasksByDate[selectedDate] ?? [];
  const totalMinutes = selectedTasks.reduce(
    (sum, task) => sum + task.minutes,
    0,
  );

  useEffect(() => {
    if (reduceMotion) return;
    const stage = stageRef.current;
    const cursor = cursorRef.current;
    if (!stage || !cursor) return;

    const context = gsap.context(() => {
      const timeline = gsap.timeline({
        repeat: -1,
        defaults: { ease: "power2.inOut" },
      });
      timeline.set(cursor, { opacity: 0, left: 40, top: 80 });

      for (const dateKey of DEMO_DAYS) {
        const target = stage.querySelector<HTMLElement>(
          `[data-demo-day="${dateKey}"]`,
        );
        if (!target) continue;
        moveCursorTo(timeline, stage, cursor, target);
        const ripple = cursor.querySelector<HTMLElement>(
          "[data-demo-cursor-ripple]",
        );
        if (ripple) {
          timeline
            .set(ripple, { opacity: 0.85, scale: 0.35 })
            .to(ripple, {
              opacity: 0,
              scale: 2.2,
              duration: 0.35,
              ease: "power2.out",
            });
        }
        timeline.call(() => setSelectedDate(dateKey));
        timeline.to({}, { duration: 2.4 });
      }

      timeline.to(cursor, { opacity: 0, duration: 0.3 });
    }, stage);

    return () => context.revert();
  }, [reduceMotion]);

  return (
    <DemoStage>
      <div ref={stageRef} className="relative space-y-5 p-4 sm:p-5">
        <DemoCursor cursorRef={cursorRef} />

        <div className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
          <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/[0.055] sm:p-5">
            <div className="mb-4">
              <h2 className="text-base font-semibold">Study plan</h2>
              <p className="mt-0.5 text-sm text-black/45">July</p>
            </div>

            <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
              {WEEKDAYS.map((weekday) => (
                <div
                  key={weekday}
                  className="pb-0.5 text-center text-[9px] font-medium uppercase tracking-[0.1em] text-black/40 sm:text-[10px]"
                >
                  {weekday}
                </div>
              ))}
              {calendarDays.map((day) => {
                const minutes = practiceMinutesByDate[day.dateKey] ?? 0;
                const level = minutesToLevel(minutes, maxPractice);
                const selectable = Boolean(tasksByDate[day.dateKey]);
                const selected = selectedDate === day.dateKey;
                const isToday = day.dateKey === TODAY;
                const isTest = day.dateKey === TEST_DATE;

                return (
                  <div
                    key={day.dateKey}
                    data-demo-day={selectable ? day.dateKey : undefined}
                    className={[
                      "relative flex aspect-square items-center justify-center rounded-lg text-[11px] font-semibold sm:text-xs",
                      intensityClass(level),
                      selected ? "ring-2 ring-[#0a2941] ring-offset-1" : "",
                      isToday && !selected ? "ring-1 ring-[#0a2941]/45" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    {day.day}
                    {isTest ? (
                      <Target
                        className="absolute bottom-0.5 size-2.5 text-[#0a2941]"
                        aria-hidden
                      />
                    ) : null}
                  </div>
                );
              })}
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-black/45">
              <span className="flex items-center gap-1.5">
                <span className="size-2.5 rounded bg-[#92b9c6]" /> Planned study
              </span>
              <span className="flex items-center gap-1.5">
                <Target className="size-3.5" aria-hidden /> Test date
              </span>
            </div>
          </section>

          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
            {[
              { icon: Target, label: "Target score", value: "2,350" },
              {
                icon: CalendarDays,
                label: "UCAT test",
                value: "27 July 2026",
                detail: "11 days until your test",
              },
              {
                icon: Gauge,
                label: "Study plan phase",
                value: "Building pace",
                detail: "VR 0.8× · DM learn · QR 0.9×",
              },
            ].map(({ icon: Icon, label, value, detail }) => (
              <div
                key={label}
                className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/[0.055] sm:p-5"
              >
                <span className="flex size-10 items-center justify-center rounded-lg bg-black/[0.04] text-black/45">
                  <Icon className="size-5" aria-hidden />
                </span>
                <p className="mt-3 text-xs font-medium uppercase tracking-[0.12em] text-black/45">
                  {label}
                </p>
                <p className="mt-1 text-xl font-semibold">{value}</p>
                {detail ? (
                  <p className="mt-0.5 text-sm text-black/45">{detail}</p>
                ) : null}
              </div>
            ))}
          </div>
        </div>

        <section className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-sm text-black/45">Selected day</p>
              <div className="mt-0.5 flex flex-wrap items-center gap-2">
                <h3 className="text-xl font-semibold">
                  {formatSelectedDay(selectedDate)}
                </h3>
                {selectedDate === TODAY ? (
                  <span className="rounded-full bg-[#0a2941] px-2.5 py-0.5 text-xs font-medium text-white">
                    Today
                  </span>
                ) : null}
              </div>
            </div>
            <span className="rounded-full bg-white px-3 py-1 text-sm font-medium text-black/55 shadow-sm ring-1 ring-black/[0.05]">
              {totalMinutes} min planned
            </span>
          </div>

          <motion.ul
            key={selectedDate}
            className="space-y-3"
            variants={demoContainerVariants}
            initial={reduceMotion ? false : "hidden"}
            animate="show"
          >
            {selectedTasks.map((task) => {
              const Icon = taskIcon(task.type);
              return (
                <motion.li
                  key={task.id}
                  variants={demoItemVariants}
                  className="flex items-start gap-3 rounded-[1.1rem] bg-white p-4 shadow-sm ring-1 ring-black/[0.055]"
                >
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#e8eaed] text-[#0a2941]">
                    <Icon className="size-4" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold sm:text-base">
                      {task.title}
                    </p>
                    <p className="mt-1 text-sm leading-relaxed text-black/50">
                      {task.description}
                    </p>
                    <p className="mt-2 flex items-center gap-1.5 text-xs text-black/42">
                      <Clock3 className="size-3.5" aria-hidden /> About{" "}
                      {task.minutes} min
                    </p>
                  </div>
                  <span className="shrink-0 rounded-lg bg-[#0a2941] px-3 py-2 text-sm font-semibold text-white">
                    Start
                  </span>
                </motion.li>
              );
            })}
          </motion.ul>
        </section>
      </div>
    </DemoStage>
  );
}
