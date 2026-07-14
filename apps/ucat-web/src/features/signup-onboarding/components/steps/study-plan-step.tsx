"use client";

import { useMemo, useState } from "react";
import { MARKETING_TOKENS } from "@altitutor/shared";
import { CalendarDays, ChevronLeft, Clock3, Target } from "lucide-react";
import { saveStudyPlan } from "@/features/study-plan/api/study-plan";
import type {
  StudyPlanAvailability,
  StudyPlanWeekday,
} from "@/features/study-plan/model/types";
import { UCAT_ACCENT_FILL_RISE } from "@/lib/ucat-surface-motion";
import { cn } from "@/lib/utils";

const { typography: typo } = MARKETING_TOKENS;
const WEEKDAYS: Array<{ value: StudyPlanWeekday; short: string; label: string }> = [
  { value: 1, short: "Mon", label: "Monday" },
  { value: 2, short: "Tue", label: "Tuesday" },
  { value: 3, short: "Wed", label: "Wednesday" },
  { value: 4, short: "Thu", label: "Thursday" },
  { value: 5, short: "Fri", label: "Friday" },
  { value: 6, short: "Sat", label: "Saturday" },
  { value: 0, short: "Sun", label: "Sunday" },
];

type StudyPlanStepProps = {
  onComplete: () => void;
  onBack: () => void;
};

export function SignupCompleteStudyPlanStep({
  onComplete,
  onBack,
}: StudyPlanStepProps) {
  const currentYear = new Date().getFullYear();
  const [targetScore, setTargetScore] = useState(2100);
  const [testYear, setTestYear] = useState(currentYear);
  const [knowsTestDate, setKnowsTestDate] = useState(false);
  const [testDate, setTestDate] = useState("");
  const [availability, setAvailability] = useState<StudyPlanAvailability[]>([
    { weekday: 1, maxMinutes: 60 },
    { weekday: 3, maxMinutes: 60 },
    { weekday: 6, maxMinutes: 120 },
  ]);
  const [preferredMockWeekday, setPreferredMockWeekday] =
    useState<StudyPlanWeekday>(6);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedWeekdays = useMemo(
    () => new Set(availability.map((day) => day.weekday)),
    [availability],
  );

  function toggleDay(day: StudyPlanWeekday) {
    setAvailability((current) => {
      if (current.some((item) => item.weekday === day)) {
        const next = current.filter((item) => item.weekday !== day);
        if (preferredMockWeekday === day && next[0]) {
          setPreferredMockWeekday(next[0].weekday);
        }
        return next;
      }
      return [...current, { weekday: day, maxMinutes: day === 0 || day === 6 ? 120 : 60 }];
    });
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!availability.length) {
      setError("Choose at least one day you can usually study.");
      return;
    }
    if (knowsTestDate && !testDate) {
      setError("Choose your UCAT test date, or select that you only know the year.");
      return;
    }
    setIsSubmitting(true);
    try {
      await saveStudyPlan({
        targetScore,
        testYear,
        testDate: knowsTestDate ? testDate : null,
        availableDays: availability,
        preferredMockWeekday,
      });
      onComplete();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "We could not create your Study plan.");
      setIsSubmitting(false);
    }
  }

  const fieldClass = `w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-marketing-cream outline-none transition-[border-color,box-shadow] focus:border-marketing-accent/50 focus:ring-2 focus:ring-marketing-accent/20 disabled:opacity-50 ${typo.secondarySans}`;

  return (
    <form onSubmit={handleSubmit} className="space-y-6 rounded-3xl bg-white/5 p-6 ring-1 ring-white/10 backdrop-blur-sm sm:p-8">
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="space-y-4 rounded-2xl bg-black/10 p-5 ring-1 ring-white/5">
          <div className="flex items-center gap-2 text-marketing-cream">
            <Target className="h-4 w-4 text-marketing-accent" aria-hidden />
            <h2 className={`font-semibold ${typo.headingSans}`}>Your goal</h2>
          </div>
          <label className={`block space-y-2 text-sm text-marketing-cream/70 ${typo.secondarySans}`}>
            <span>Target cognitive score</span>
            <input
              type="number"
              min={900}
              max={2700}
              step={10}
              required
              value={targetScore}
              onChange={(event) => setTargetScore(Number(event.target.value))}
              disabled={isSubmitting}
              className={fieldClass}
            />
            <span className="block text-xs text-marketing-cream/40">
              We will adapt the VR, DM and QR balance for you. SJT is planned separately.
            </span>
          </label>

          <div className={`space-y-2 text-sm text-marketing-cream/70 ${typo.secondarySans}`}>
            <span className="block">Do you know your exact test date?</span>
            <div className="grid grid-cols-2 gap-2">
              {[
                { value: false, label: "Year only" },
                { value: true, label: "Exact date" },
              ].map((option) => (
                <button
                  key={option.label}
                  type="button"
                  onClick={() => setKnowsTestDate(option.value)}
                  className={cn(
                    "rounded-xl px-3 py-2.5 text-sm ring-1 transition-colors",
                    knowsTestDate === option.value
                      ? "bg-marketing-accent/15 text-marketing-accent ring-marketing-accent/40"
                      : "bg-white/5 text-marketing-cream/60 ring-white/10 hover:bg-white/10",
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {knowsTestDate ? (
            <label className={`block space-y-2 text-sm text-marketing-cream/70 ${typo.secondarySans}`}>
              <span>UCAT test date</span>
              <input
                type="date"
                required
                value={testDate}
                min={`${testYear}-01-01`}
                max={`${testYear}-12-31`}
                onChange={(event) => {
                  setTestDate(event.target.value);
                  if (event.target.value) setTestYear(Number(event.target.value.slice(0, 4)));
                }}
                className={fieldClass}
              />
            </label>
          ) : (
            <label className={`block space-y-2 text-sm text-marketing-cream/70 ${typo.secondarySans}`}>
              <span>UCAT year</span>
              <select
                value={testYear}
                onChange={(event) => setTestYear(Number(event.target.value))}
                className={fieldClass}
              >
                {[currentYear, currentYear + 1, currentYear + 2].map((year) => (
                  <option key={year} value={year} className="bg-marketing-charcoal">{year}</option>
                ))}
              </select>
              <span className="block text-xs text-marketing-cream/40">
                We will use the middle of that year’s testing window until bookings open. You can add the real date later.
              </span>
            </label>
          )}
        </section>

        <section className="space-y-4 rounded-2xl bg-black/10 p-5 ring-1 ring-white/5">
          <div className="flex items-center gap-2 text-marketing-cream">
            <Clock3 className="h-4 w-4 text-marketing-accent" aria-hidden />
            <h2 className={`font-semibold ${typo.headingSans}`}>Your availability</h2>
          </div>
          <p className={`text-sm text-marketing-cream/50 ${typo.secondarySans}`}>
            These are ceilings. Early plans may use less time, then ramp up as your test approaches.
          </p>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
            {WEEKDAYS.map((day) => (
              <button
                key={day.value}
                type="button"
                aria-pressed={selectedWeekdays.has(day.value)}
                onClick={() => toggleDay(day.value)}
                className={cn(
                  "rounded-xl px-2 py-2.5 text-xs font-semibold ring-1 transition-colors",
                  selectedWeekdays.has(day.value)
                    ? "bg-marketing-accent text-marketing-charcoal ring-marketing-accent"
                    : "bg-white/5 text-marketing-cream/50 ring-white/10 hover:bg-white/10",
                )}
              >
                {day.short}
              </button>
            ))}
          </div>
          <div className="space-y-2">
            {availability
              .slice()
              .sort((a, b) => WEEKDAYS.findIndex((day) => day.value === a.weekday) - WEEKDAYS.findIndex((day) => day.value === b.weekday))
              .map((available) => (
                <label key={available.weekday} className="flex items-center justify-between gap-4 rounded-xl bg-white/5 px-4 py-3">
                  <span className={`text-sm text-marketing-cream/70 ${typo.secondarySans}`}>
                    {WEEKDAYS.find((day) => day.value === available.weekday)?.label}
                  </span>
                  <span className="flex items-center gap-2">
                    <input
                      type="number"
                      min={15}
                      max={360}
                      step={15}
                      value={available.maxMinutes}
                      onChange={(event) => setAvailability((current) => current.map((item) =>
                        item.weekday === available.weekday
                          ? { ...item, maxMinutes: Number(event.target.value) }
                          : item,
                      ))}
                      className="w-20 rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-right text-sm text-marketing-cream outline-none focus:border-marketing-accent/50"
                    />
                    <span className="text-xs text-marketing-cream/40">min max</span>
                  </span>
                </label>
              ))}
          </div>
          {availability.length ? (
            <label className={`block space-y-2 text-sm text-marketing-cream/70 ${typo.secondarySans}`}>
              <span className="flex items-center gap-2"><CalendarDays className="h-4 w-4" /> Best mock day</span>
              <select
                value={preferredMockWeekday}
                onChange={(event) => setPreferredMockWeekday(Number(event.target.value) as StudyPlanWeekday)}
                className={fieldClass}
              >
                {WEEKDAYS.filter((day) => selectedWeekdays.has(day.value)).map((day) => (
                  <option key={day.value} value={day.value} className="bg-marketing-charcoal">{day.label}</option>
                ))}
              </select>
            </label>
          ) : null}
        </section>
      </div>

      {error ? (
        <p className={`rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-400 ${typo.secondarySans}`}>{error}</p>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row-reverse">
        <button
          type="submit"
          disabled={isSubmitting}
          className={cn(
            UCAT_ACCENT_FILL_RISE,
            "rounded-full bg-marketing-accent px-8 py-3.5 text-base font-semibold text-marketing-charcoal disabled:cursor-not-allowed disabled:opacity-50 sm:flex-1",
            typo.headingSans,
          )}
        >
          {isSubmitting ? "Building your plan…" : "Create my Study plan"}
        </button>
        <button
          type="button"
          onClick={onBack}
          disabled={isSubmitting}
          className={`inline-flex items-center justify-center gap-1 rounded-full px-6 py-3 text-sm text-marketing-cream/40 transition-colors hover:text-marketing-cream/70 ${typo.secondarySans}`}
        >
          <ChevronLeft className="h-4 w-4" aria-hidden /> Back
        </button>
      </div>
    </form>
  );
}
