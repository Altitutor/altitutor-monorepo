"use client";

import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Input,
  SearchableSelect,
  Switch,
  useToast,
} from "@altitutor/ui";
import { motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { AppShellBottomFloatingDock, UcatPageHeader } from "@/features/layout";
import { AppPageSkeleton } from "@/features/layout/components/app-page-skeleton";
import { SettingsRow } from "@/features/settings/components/settings-row";
import { saveStudyPlan } from "@/features/study-plan/api/study-plan";
import { useStudyPlan } from "@/features/study-plan/hooks/use-study-plan";
import type {
  StudyPlanAvailability,
  StudyPlanProfileInput,
  StudyPlanWeekday,
} from "@/features/study-plan/model/types";
import {
  UCAT_SURFACE_CARD,
  UCAT_SURFACE_MOTION,
} from "@/lib/ucat-surface-motion";
import { cn } from "@/lib/utils";
import { useLeaveGuard } from "@/shared/hooks/use-leave-guard";
import { useUcatStaggerMotion } from "@/shared/hooks/use-ucat-stagger-motion";

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
  { weekday: 2, maxMinutes: 60 },
  { weekday: 4, maxMinutes: 60 },
  { weekday: 5, maxMinutes: 60 },
  { weekday: 6, maxMinutes: 120 },
];

const SELECT_TRIGGER =
  "h-10 w-full justify-between font-normal sm:w-auto sm:min-w-[14rem] sm:max-w-md";
const SELECT_CONTENT_WIDTH = "min(100vw - 2rem, 22rem)";

const SETTINGS_LEAVE_MESSAGE =
  "You have unsaved settings. Leave this page without saving?";

type YearOption = { year: number };
type WeekdayOption = (typeof WEEKDAYS)[number];

function defaultMinutesForDay(day: StudyPlanWeekday): number {
  return day === 0 || day === 6 ? 120 : 60;
}

function sortAvailability(
  days: StudyPlanAvailability[],
): StudyPlanAvailability[] {
  const order = new Map(WEEKDAYS.map((day, index) => [day.value, index]));
  return [...days].sort(
    (a, b) => (order.get(a.weekday) ?? 0) - (order.get(b.weekday) ?? 0),
  );
}

function availabilityEqual(
  a: StudyPlanAvailability[],
  b: StudyPlanAvailability[],
): boolean {
  if (a.length !== b.length) return false;
  const sortedA = sortAvailability(a);
  const sortedB = sortAvailability(b);
  return sortedA.every((day, index) => day.weekday === sortedB[index]?.weekday);
}

function snapshotFromProfile(profile: StudyPlanProfileInput) {
  return {
    studyPlanEnabled: profile.studyPlanEnabled,
    studySuggestionsEnabled: profile.studySuggestionsEnabled,
    targetScore: profile.targetScore,
    testYear: profile.testYear,
    testDate: profile.testDate ?? "",
    availability: sortAvailability(profile.availableDays),
    mockDay: profile.preferredMockWeekday,
  };
}

export function SettingsStudyPlanPage() {
  const query = useStudyPlan();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { containerVariants, itemVariants } = useUcatStaggerMotion();
  const currentYear = new Date().getFullYear();

  const yearOptions = useMemo<YearOption[]>(
    () =>
      [currentYear, currentYear + 1, currentYear + 2, currentYear + 3].map(
        (year) => ({ year }),
      ),
    [currentYear],
  );

  const [targetScore, setTargetScore] = useState(2100);
  const [studyPlanEnabled, setStudyPlanEnabled] = useState(true);
  const [studySuggestionsEnabled, setStudySuggestionsEnabled] = useState(true);
  const [testYear, setTestYear] = useState(currentYear);
  const [testDate, setTestDate] = useState("");
  const [availability, setAvailability] =
    useState<StudyPlanAvailability[]>(DEFAULT_AVAILABILITY);
  const [mockDay, setMockDay] = useState<StudyPlanWeekday>(6);
  const [saved, setSaved] = useState<ReturnType<
    typeof snapshotFromProfile
  > | null>(null);
  const [saving, setSaving] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (!query.data?.profile || hydrated) return;
    const snap = snapshotFromProfile(query.data.profile);
    setStudyPlanEnabled(snap.studyPlanEnabled);
    setStudySuggestionsEnabled(snap.studySuggestionsEnabled);
    setTargetScore(snap.targetScore);
    setTestYear(snap.testYear);
    setTestDate(snap.testDate);
    setAvailability(snap.availability);
    setMockDay(snap.mockDay);
    setSaved(snap);
    setHydrated(true);
  }, [query.data, hydrated]);

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
    yearOptions.find((option) => option.year === testYear) ??
    yearOptions[0] ??
    null;
  const selectedMockDay =
    mockDayOptions.find((day) => day.value === mockDay) ??
    mockDayOptions[0] ??
    null;

  const isDirty =
    saved !== null &&
    (targetScore !== saved.targetScore ||
      studyPlanEnabled !== saved.studyPlanEnabled ||
      studySuggestionsEnabled !== saved.studySuggestionsEnabled ||
      testYear !== saved.testYear ||
      testDate !== saved.testDate ||
      mockDay !== saved.mockDay ||
      !availabilityEqual(availability, saved.availability));
  useLeaveGuard(isDirty, SETTINGS_LEAVE_MESSAGE);

  function setDayEnabled(day: StudyPlanWeekday, enabled: boolean) {
    setAvailability((current) => {
      if (enabled) {
        if (current.some((item) => item.weekday === day)) return current;
        return sortAvailability([
          ...current,
          { weekday: day, maxMinutes: defaultMinutesForDay(day) },
        ]);
      }
      const next = current.filter((item) => item.weekday !== day);
      if (mockDay === day && next[0]) {
        setMockDay(next[0].weekday);
      }
      return next;
    });
  }

  function handleCancel() {
    if (!saved) return;
    setTargetScore(saved.targetScore);
    setStudyPlanEnabled(saved.studyPlanEnabled);
    setStudySuggestionsEnabled(saved.studySuggestionsEnabled);
    setTestYear(saved.testYear);
    setTestDate(saved.testDate);
    setAvailability(saved.availability);
    setMockDay(saved.mockDay);
  }

  async function handleSave() {
    if (studyPlanEnabled && !availability.length) {
      toast({
        title: "Choose study days",
        description: "Choose at least one available study day.",
        variant: "destructive",
      });
      return;
    }
    const preferredMockWeekday =
      studyPlanEnabled && availability.some((day) => day.weekday === mockDay)
        ? mockDay
        : (availability[0]?.weekday ?? 6);

    setSaving(true);
    try {
      const next: StudyPlanProfileInput = {
        studyPlanEnabled,
        studySuggestionsEnabled,
        targetScore,
        testYear,
        testDate: testDate || null,
        availableDays: studyPlanEnabled ? availability : [],
        preferredMockWeekday,
      };
      await saveStudyPlan(next);
      const snap = snapshotFromProfile(next);
      setMockDay(preferredMockWeekday);
      setSaved(snap);
      await queryClient.invalidateQueries({ queryKey: ["ucat-study-plan"] });
    } catch (caught) {
      toast({
        title: "Could not save Study plan",
        description:
          caught instanceof Error
            ? caught.message
            : "Could not update your plan.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  if (query.isLoading || (!hydrated && !query.isError)) {
    return <AppPageSkeleton variant="detail" />;
  }

  if (query.isError) {
    return (
      <div className="space-y-6">
        <UcatPageHeader
          title="Study plan settings"
          description="Target score, test date, and weekly availability"
          backHref="/settings"
          backLabel="All settings"
        />
        <Alert variant="destructive">
          <AlertTitle>Could not load your Study plan</AlertTitle>
          <AlertDescription>{query.error.message}</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <motion.div
      className={cn(
        "space-y-6",
        isDirty &&
          "pb-[max(6.5rem,calc(env(safe-area-inset-bottom,0px)+5rem))]",
      )}
      variants={containerVariants}
      initial="hidden"
      animate="show"
    >
      <motion.div variants={itemVariants}>
        <UcatPageHeader
          title="Study plan settings"
          description="Target score, test date, and weekly availability"
          backHref="/settings"
          backLabel="All settings"
        />
      </motion.div>

      <motion.div
        variants={itemVariants}
        className={cn(
          "rounded-ucatShell p-6 sm:p-8",
          UCAT_SURFACE_CARD,
          UCAT_SURFACE_MOTION,
        )}
      >
        <SettingsRow
          title="Study plan"
          description="Altitutor makes a daily plan for what to study, which adapts as you progress."
          control={
            <Switch
              checked={studyPlanEnabled}
              onCheckedChange={(checked) => {
                setStudyPlanEnabled(checked);
                if (checked && availability.length === 0) {
                  setAvailability(DEFAULT_AVAILABILITY);
                  setMockDay(DEFAULT_AVAILABILITY[0]!.weekday);
                }
              }}
              aria-label="Use a Study plan"
            />
          }
        />
        <SettingsRow
          title="Study suggestions"
          description="Show the floating study assistant with a suggested next task as you move through Altitutor. Turning this off hides the orb, while suggestions remain available on your dashboard."
          control={
            <Switch
              checked={studySuggestionsEnabled}
              onCheckedChange={setStudySuggestionsEnabled}
              aria-label="Show Study suggestions"
            />
          }
        />
        {saved?.studyPlanEnabled && !studyPlanEnabled ? (
          <p className="mt-4 rounded-xl bg-muted/60 px-4 py-3 text-sm text-muted-foreground">
            Turning the Study plan off keeps your goal, results and plan
            history, but removes future scheduled tasks. Turning it on later
            builds a fresh plan from your latest progress.
          </p>
        ) : null}
      </motion.div>

      <motion.div
        variants={itemVariants}
        className={cn(
          "rounded-ucatShell p-6 sm:p-8",
          UCAT_SURFACE_CARD,
          UCAT_SURFACE_MOTION,
        )}
      >
        <SettingsRow
          title="Target score"
          description="The overall UCAT score you're aiming for. This goal stays active with or without a Study plan."
          control={
            <Input
              id="study-target"
              type="number"
              min={900}
              max={2700}
              step={10}
              value={targetScore}
              onChange={(event) => setTargetScore(Number(event.target.value))}
              className="h-10 w-full sm:w-40"
            />
          }
        />
      </motion.div>

      <motion.div
        variants={itemVariants}
        className={cn(
          "rounded-ucatShell p-6 sm:p-8",
          UCAT_SURFACE_CARD,
          UCAT_SURFACE_MOTION,
        )}
      >
        <SettingsRow
          title="Test year"
          description="The UCAT sitting year you're preparing for."
          control={
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
              triggerClassName={SELECT_TRIGGER}
              contentWidth={SELECT_CONTENT_WIDTH}
            />
          }
        />
        <SettingsRow
          title="Exact date"
          description="Optional. If you know your test day, add it so we can pace the plan to the end."
          control={
            <Input
              id="study-date"
              type="date"
              value={testDate}
              onChange={(event) => {
                setTestDate(event.target.value);
                if (event.target.value) {
                  setTestYear(Number(event.target.value.slice(0, 4)));
                }
              }}
              className="h-10 w-full sm:w-auto sm:min-w-[14rem]"
            />
          }
        />
      </motion.div>

      {studyPlanEnabled ? (
        <motion.div
          variants={itemVariants}
          className={cn(
            "rounded-ucatShell p-6 sm:p-8",
            UCAT_SURFACE_CARD,
            UCAT_SURFACE_MOTION,
          )}
        >
          <div className="mb-2 space-y-1">
            <h3 className="text-base font-semibold tracking-tight">
              Available study days
            </h3>
            <p className="text-sm text-muted-foreground">
              Turn on the days you can usually study. The plan changes session
              length and practice volume as your readiness and exam date change.
            </p>
          </div>

          <div className="divide-y divide-border/60">
            {WEEKDAYS.map((day) => {
              const enabled = availabilityByDay.get(day.value);
              const isOn = Boolean(enabled);
              return (
                <div
                  key={day.value}
                  className="flex min-h-10 items-center justify-between gap-4 py-4 first:pt-2 last:pb-0"
                >
                  <span className="min-w-0 text-sm font-medium">
                    {day.label}
                  </span>
                  <Switch
                    checked={isOn}
                    onCheckedChange={(checked) =>
                      setDayEnabled(day.value, checked)
                    }
                    aria-label={`${day.label} available`}
                  />
                </div>
              );
            })}
          </div>

          <div className="mt-2 border-t border-border/60 pt-2">
            <SettingsRow
              title="Preferred mock day"
              description="A soft preference for full mocks. The planner may use another available day when the cadence needs it."
              control={
                <SearchableSelect<WeekdayOption>
                  items={mockDayOptions.length ? mockDayOptions : WEEKDAYS}
                  value={selectedMockDay}
                  onValueChange={(option) => {
                    if (option) setMockDay(option.value);
                  }}
                  getItemLabel={(item) => item.label}
                  getItemId={(item) => String(item.value)}
                  placeholder="Select day"
                  searchPlaceholder="Search days…"
                  emptyMessage="No matching day."
                  disabled={!mockDayOptions.length}
                  triggerClassName={SELECT_TRIGGER}
                  contentWidth={SELECT_CONTENT_WIDTH}
                />
              }
            />
          </div>
        </motion.div>
      ) : null}

      <AppShellBottomFloatingDock visible={isDirty}>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleCancel}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving}
          >
            {saving
              ? "Saving…"
              : studyPlanEnabled
                ? "Save and regenerate"
                : "Save changes"}
          </Button>
        </div>
      </AppShellBottomFloatingDock>
    </motion.div>
  );
}
