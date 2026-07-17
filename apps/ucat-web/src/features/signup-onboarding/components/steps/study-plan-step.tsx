"use client";

import { useMemo, useState } from "react";
import { MARKETING_TOKENS } from "@altitutor/shared";
import {
  SearchableSelect,
  SmartDatePickerField,
  Switch,
} from "@altitutor/ui";
import { CalendarDays, Clock3, Target } from "lucide-react";
import { saveStudyPlan } from "@/features/study-plan/api/study-plan";
import type {
  StudyPlanAvailability,
  StudyPlanWeekday,
} from "@/features/study-plan/model/types";
import { UCAT_ACCENT_FILL_RISE } from "@/lib/ucat-surface-motion";
import { cn } from "@/lib/utils";

const { typography: typo } = MARKETING_TOKENS;
const WEEKDAYS: Array<{ value: StudyPlanWeekday; label: string }> = [
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
  { value: 0, label: "Sunday" },
];

const DEFAULT_AVAILABILITY: StudyPlanAvailability[] = [
  { weekday: 1, maxMinutes: 60 },
  { weekday: 3, maxMinutes: 60 },
  { weekday: 5, maxMinutes: 60 },
  { weekday: 6, maxMinutes: 120 },
];

type YearOption = { year: number };
type WeekdayOption = (typeof WEEKDAYS)[number];

type StudyPlanStepProps = {
  onComplete: () => void;
};

function defaultMinutesForDay(day: StudyPlanWeekday): number {
  return day === 0 || day === 6 ? 120 : 60;
}

export function SignupCompleteStudyPlanStep({
  onComplete,
}: StudyPlanStepProps) {
  const currentYear = new Date().getFullYear();
  const yearOptions = useMemo<YearOption[]>(
    () =>
      [currentYear, currentYear + 1, currentYear + 2].map((year) => ({ year })),
    [currentYear],
  );
  const [targetScore, setTargetScore] = useState(2100);
  const [testYear, setTestYear] = useState(currentYear);
  const [knowsTestDate, setKnowsTestDate] = useState(false);
  const [testDate, setTestDate] = useState<string | null>(null);
  const [availability, setAvailability] =
    useState<StudyPlanAvailability[]>(DEFAULT_AVAILABILITY);
  const [preferredMockWeekday, setPreferredMockWeekday] =
    useState<StudyPlanWeekday>(6);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const availabilityByDay = useMemo(() => {
    const map = new Map<StudyPlanWeekday, StudyPlanAvailability>();
    for (const day of availability) map.set(day.weekday, day);
    return map;
  }, [availability]);

  const mockDayOptions = useMemo(
    () => WEEKDAYS.filter((day) => availabilityByDay.has(day.value)),
    [availabilityByDay],
  );

  const selectedYear =
    yearOptions.find((option) => option.year === testYear) ?? yearOptions[0] ?? null;
  const selectedMockDay =
    mockDayOptions.find((day) => day.value === preferredMockWeekday) ??
    mockDayOptions[0] ??
    null;

  function setDayEnabled(day: StudyPlanWeekday, enabled: boolean) {
    setAvailability((current) => {
      if (enabled) {
        if (current.some((item) => item.weekday === day)) return current;
        return [...current, { weekday: day, maxMinutes: defaultMinutesForDay(day) }];
      }
      const next = current.filter((item) => item.weekday !== day);
      if (preferredMockWeekday === day && next[0]) {
        setPreferredMockWeekday(next[0].weekday);
      }
      return next;
    });
  }

  function setDayMinutes(day: StudyPlanWeekday, maxMinutes: number) {
    setAvailability((current) =>
      current.map((item) =>
        item.weekday === day ? { ...item, maxMinutes } : item,
      ),
    );
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
  const selectTriggerClass = cn(
    fieldClass,
    "h-auto justify-between font-normal hover:bg-white/10 [&_svg]:text-marketing-cream/50",
  );

  const cardClass =
    "space-y-4 rounded-3xl bg-white/5 p-5 ring-1 ring-white/10 backdrop-blur-sm sm:p-6";

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <section className={cardClass}>
          <div className="flex items-center gap-2 text-marketing-cream">
            <Target className="h-4 w-4 text-marketing-accent" aria-hidden />
            <h2 className={`font-semibold ${typo.headingSans}`}>Your goal</h2>
          </div>
          <label className={`block space-y-2 text-sm text-marketing-cream/70 ${typo.secondarySans}`}>
            <span>Target score</span>
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
            <div className={`space-y-2 text-sm text-marketing-cream/70 ${typo.secondarySans}`}>
              <span className="block">UCAT test date</span>
              <SmartDatePickerField
                value={testDate}
                onChange={(value) => {
                  setTestDate(value);
                  if (value) setTestYear(Number(value.slice(0, 4)));
                }}
                placeholder="Type or pick a date"
                showPresets={false}
                className={cn(
                  selectTriggerClass,
                  "hover:bg-white/10 dark:hover:bg-white/10 dark:hover:text-marketing-cream",
                )}
              />
            </div>
          ) : (
            <div className={`space-y-2 text-sm text-marketing-cream/70 ${typo.secondarySans}`}>
              <span className="block">UCAT year</span>
              <SearchableSelect<YearOption>
                items={yearOptions}
                value={selectedYear}
                onValueChange={(option) => {
                  if (option) setTestYear(option.year);
                }}
                getItemLabel={(item) => String(item.year)}
                getItemId={(item) => String(item.year)}
                placeholder="Select year"
                searchPlaceholder="Search years…"
                emptyMessage="No matching year."
                disabled={isSubmitting}
                triggerClassName={selectTriggerClass}
                contentWidth="var(--radix-popover-trigger-width)"
              />
              <span className="block text-xs text-marketing-cream/40">
                You can add the real date later.
              </span>
            </div>
          )}
        </section>

        <section className={cardClass}>
          <div className="flex items-center gap-2 text-marketing-cream">
            <Clock3 className="h-4 w-4 text-marketing-accent" aria-hidden />
            <h2 className={`font-semibold ${typo.headingSans}`}>Your availability</h2>
          </div>
          <p className={`text-sm text-marketing-cream/50 ${typo.secondarySans}`}>
            This is the maximum time you would like to dedicate to study, not necessarily the time we will allocate for you every week.
          </p>
          <div className="space-y-2">
            {WEEKDAYS.map((day) => {
              const enabled = availabilityByDay.get(day.value);
              const isOn = Boolean(enabled);
              return (
                <div
                  key={day.value}
                  className="flex items-center justify-between gap-4 rounded-xl bg-white/5 px-4 py-3"
                >
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <Switch
                      checked={isOn}
                      disabled={isSubmitting}
                      onCheckedChange={(checked) => setDayEnabled(day.value, checked)}
                      className="data-[state=checked]:bg-marketing-accent data-[state=unchecked]:bg-white/20"
                    />
                    <span className={`text-sm text-marketing-cream/70 ${typo.secondarySans}`}>
                      {day.label}
                    </span>
                  </div>
                  <span
                    className={cn(
                      "flex items-center gap-2",
                      !isOn && "invisible pointer-events-none",
                    )}
                    aria-hidden={!isOn}
                  >
                    <input
                      type="number"
                      min={15}
                      max={360}
                      step={15}
                      tabIndex={isOn ? 0 : -1}
                      value={enabled?.maxMinutes ?? defaultMinutesForDay(day.value)}
                      disabled={isSubmitting || !isOn}
                      onChange={(event) =>
                        setDayMinutes(day.value, Number(event.target.value))
                      }
                      className="w-20 rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-right text-sm text-marketing-cream outline-none focus:border-marketing-accent/50"
                    />
                    <span className="text-xs text-marketing-cream/40">min max</span>
                  </span>
                </div>
              );
            })}
          </div>
          <div
            className={cn(
              `space-y-2 text-sm text-marketing-cream/70 ${typo.secondarySans}`,
              !mockDayOptions.length && "invisible pointer-events-none",
            )}
            aria-hidden={!mockDayOptions.length}
          >
            <span className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4" /> Best mock day
            </span>
            <SearchableSelect<WeekdayOption>
              items={mockDayOptions.length ? mockDayOptions : WEEKDAYS}
              value={selectedMockDay}
              onValueChange={(option) => {
                if (option) setPreferredMockWeekday(option.value);
              }}
              getItemLabel={(item) => item.label}
              getItemId={(item) => String(item.value)}
              placeholder="Select day"
              searchPlaceholder="Search days…"
              emptyMessage="No matching day."
              disabled={isSubmitting || !mockDayOptions.length}
              triggerClassName={selectTriggerClass}
              contentWidth="var(--radix-popover-trigger-width)"
            />
          </div>
        </section>
      </div>

      {error ? (
        <p className={`rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-400 ${typo.secondarySans}`}>{error}</p>
      ) : null}

      <button
        type="submit"
        disabled={isSubmitting}
        className={cn(
          UCAT_ACCENT_FILL_RISE,
          "w-full rounded-full bg-marketing-accent px-8 py-3.5 text-base font-semibold text-marketing-charcoal disabled:cursor-not-allowed disabled:opacity-50",
          typo.headingSans,
        )}
      >
        {isSubmitting ? "Building your plan…" : "Create my Study plan"}
      </button>
    </form>
  );
}
