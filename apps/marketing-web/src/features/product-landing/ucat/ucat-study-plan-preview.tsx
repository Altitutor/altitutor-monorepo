"use client";

import { useState } from "react";
import {
  BookOpen,
  BrainCircuit,
  CalendarDays,
  Check,
  ChevronDown,
  Clock3,
  Gauge,
  RotateCcw,
  Sparkles,
  Target,
} from "lucide-react";

const tasksByDay = {
  16: [
    { id: "warmup", title: "Syllogism speed warm-up", description: "Build accuracy before the timed set.", rationale: "Decision Making accuracy has improved; today the focus is applying it at speed.", minutes: 6, type: "trainer" },
    { id: "practice", title: "Reading Comprehension · 0.75× speed", description: "Complete 16 targeted questions.", rationale: "Reading Comprehension is currently furthest from your VR target.", minutes: 22, type: "practice" },
    { id: "review", title: "Review today’s Reading Comprehension attempt", description: "Work through every missed or slow question.", rationale: "Review turns the attempt into evidence for your next plan update.", minutes: 7, type: "review" },
  ],
  18: [
    { id: "learn", title: "Decision Making foundations", description: "Complete the short arguments module.", rationale: "The plan introduces the technique before asking you to apply it under time pressure.", minutes: 12, type: "learn" },
    { id: "dm", title: "Arguments mini-set · untimed", description: "Complete 8 questions with immediate feedback.", rationale: "A short feedback loop will confirm whether the technique is ready for timed work.", minutes: 15, type: "practice" },
  ],
  20: [
    { id: "qr", title: "QR problem solving · timed", description: "Complete a focused timed block.", rationale: "QR has the largest gap to your section target this week.", minutes: 28, type: "practice" },
  ],
} as const;

type PlanDay = keyof typeof tasksByDay;

function taskIcon(type: string) {
  if (type === "trainer") return Sparkles;
  if (type === "review") return RotateCcw;
  if (type === "learn") return BookOpen;
  if (type === "set") return Gauge;
  return BrainCircuit;
}

export function UcatStudyPlanPreview() {
  const [selectedDay, setSelectedDay] = useState<PlanDay>(16);
  const [expandedTask, setExpandedTask] = useState<string | null>("practice");
  const [completedTask, setCompletedTask] = useState<string | null>("warmup");
  const tasks = tasksByDay[selectedDay];

  return (
    <div className="ucat-product-ui min-h-[34rem] rounded-[1.25rem] bg-[#e8eaed] p-3 text-[#1a1a1a] shadow-[0_22px_70px_rgba(10,41,65,0.15)] ring-1 ring-black/[0.08] sm:p-5">
      <div className="grid gap-3 lg:grid-cols-[0.92fr_1.08fr]">
        <section className="rounded-[1.1rem] bg-white p-4 shadow-sm ring-1 ring-black/[0.055]">
          <div className="flex items-start justify-between gap-3">
            <div><p className="text-xs font-semibold">Study plan</p><p className="mt-1 text-[10px] text-black/44">July 2026</p></div>
            <span className="flex items-center gap-1 rounded-full bg-[#e8eaed] px-2.5 py-1 text-[10px] font-semibold"><Target className="size-3" aria-hidden /> Target 2,350</span>
          </div>

          <div className="mt-4 grid grid-cols-7 gap-1 text-center text-[9px] font-semibold text-black/35">
            {['M','T','W','T','F','S','S'].map((day, index) => <span key={`${day}-${index}`}>{day}</span>)}
          </div>
          <div className="mt-2 grid grid-cols-7 gap-1.5">
            {Array.from({ length: 28 }, (_, index) => index + 1).map((day) => {
              const available = day === 16 || day === 18 || day === 20;
              const selected = day === selectedDay;
              return (
                <button
                  key={day}
                  type="button"
                  disabled={!available}
                  onClick={() => available && setSelectedDay(day as PlanDay)}
                  aria-pressed={selected}
                  className={`relative aspect-square rounded-lg text-[10px] font-semibold transition-all ${
                    selected
                      ? "bg-[#0a2941] text-white ring-2 ring-[#0a2941] ring-offset-1"
                      : available
                        ? "bg-[#92b9c6]/65 text-[#0a2941] hover:-translate-y-0.5 hover:shadow-sm"
                        : "bg-[#f0f1f2] text-black/35"
                  }`}
                >
                  {day}
                  {day === 27 ? <span className="absolute bottom-1 left-1/2 size-1 -translate-x-1/2 rounded-full bg-[#0a2941]" /> : null}
                </button>
              );
            })}
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3 text-[9px] text-black/45">
            <span className="flex items-center gap-1"><span className="size-2.5 rounded bg-[#92b9c6]/65" /> Planned study</span>
            <span className="flex items-center gap-1"><Target className="size-3" aria-hidden /> Test date</span>
          </div>

          <div className="mt-4 rounded-xl bg-[#f2f3f4] p-3">
            <div className="flex items-center gap-2 text-[10px] font-semibold"><CalendarDays className="size-3.5 text-[#0a2941]" aria-hidden /> Your plan adapts weekly</div>
            <p className="mt-1 text-[10px] leading-relaxed text-black/46">Tasks may change as new attempts reveal stronger evidence about your priorities.</p>
          </div>
        </section>

        <section>
          <div className="mb-3 flex items-end justify-between gap-3 px-1">
            <div><p className="text-[10px] text-black/42">Selected day</p><h3 className="mt-0.5 text-lg font-semibold">{selectedDay} July · Today&apos;s tasks</h3></div>
            <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-semibold shadow-sm ring-1 ring-black/[0.05]">{tasks.reduce((total, task) => total + task.minutes, 0)} min</span>
          </div>
          <ul className="space-y-2.5">
            {tasks.map((task) => {
              const Icon = taskIcon(task.type);
              const expanded = expandedTask === task.id;
              const completed = completedTask === task.id;
              return (
                <li key={task.id} className={`rounded-[1.05rem] bg-white p-3.5 shadow-sm ring-1 ring-black/[0.055] transition-opacity ${completed ? "opacity-65" : ""}`}>
                  <div className="flex items-start gap-3">
                    <button type="button" onClick={() => setCompletedTask(completed ? null : task.id)} aria-label={completed ? `Mark ${task.title} incomplete` : `Mark ${task.title} complete`} className={`mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl ${completed ? "bg-[#e8eaed] text-black/45" : "bg-[#e8eaed] text-[#0a2941]"}`}>
                      {completed ? <Check className="size-4" aria-hidden /> : <Icon className="size-4" aria-hidden />}
                    </button>
                    <button type="button" onClick={() => setExpandedTask(expanded ? null : task.id)} aria-expanded={expanded} className="min-w-0 flex-1 text-left">
                      <span className="flex items-start justify-between gap-3">
                        <span className={`text-sm font-semibold ${completed ? "line-through" : ""}`}>{task.title}</span>
                        <ChevronDown className={`mt-0.5 size-4 shrink-0 text-black/35 transition-transform ${expanded ? "rotate-180" : ""}`} aria-hidden />
                      </span>
                      <span className="mt-1 block text-[11px] leading-relaxed text-black/48">{task.description}</span>
                      <span className="mt-2 flex items-center gap-1 text-[10px] text-black/42"><Clock3 className="size-3" aria-hidden /> About {task.minutes} min</span>
                    </button>
                  </div>
                  {expanded ? (
                    <div className="ml-12 mt-3 border-t border-black/[0.06] pt-3">
                      <p className="text-[10px] leading-relaxed text-black/48"><strong className="font-semibold text-black/65">Why this:</strong> {task.rationale}</p>
                      {!completed ? <button type="button" className="mt-3 rounded-lg bg-[#0a2941] px-3 py-2 text-[11px] font-semibold text-white hover:-translate-y-0.5">Start task</button> : null}
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </div>
  );
}
