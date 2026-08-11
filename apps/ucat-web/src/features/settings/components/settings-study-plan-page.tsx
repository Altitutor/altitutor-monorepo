"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import {
  Alert,
  AlertDescription,
  AlertTitle,
  SearchableSelect,
  SmartDatePickerField,
  Switch,
  useToast,
} from "@altitutor/ui";
import { motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { AppShellBottomFloatingDock, UcatPageHeader } from "@/features/layout";
import { AppPageSkeleton } from "@/features/layout/components/app-page-skeleton";
import { SidebarExpandablePanel } from "@/features/layout/components/sidebar-expandable-panel";
import { useOnboardingProgress } from "@/features/onboarding/hooks/use-onboarding-progress";
import { UCAT_STUDY_PLAN_DECIDED } from "@/features/onboarding/lib/activation-milestones";
import { SettingsRow } from "@/features/settings/components/settings-row";
import {
  STUDY_PLAN_TEST_DATE_INPUT_PLACEHOLDER,
  STUDY_PLAN_TEST_DATE_PLACEHOLDER,
} from "@/features/study-plan/components/study-plan-setup-ui";
import {
  StudyPlanTargetScoreField,
  type StudyPlanTargetScoreFieldHandle,
} from "@/features/study-plan/components/study-plan-target-score-field";
import { saveStudyPlan } from "@/features/study-plan/api/study-plan";
import { useStudyPlan } from "@/features/study-plan/hooks/use-study-plan";
import { defaultSkippedGoalProfileInput } from "@/features/study-plan/lib/default-study-profile";
import {
  isTestDateInBounds,
  testDateBounds,
} from "@/features/study-plan/lib/test-date-bounds";
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

const STUDY_PLAN_SETUP_FROM_SETTINGS =
  "/study-plan/setup?section=plan&from=settings";

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
    targetScore: profile.targetScore,
    testYear: profile.testYear,
    testDate: profile.testDate ?? "",
    availability: sortAvailability(profile.availableDays ?? []),
    mockDay: profile.preferredMockWeekday,
  };
}

export function SettingsStudyPlanPage() {
  const router = useRouter();
  const query = useStudyPlan();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const onboarding = useOnboardingProgress();
  const { containerVariants, itemVariants } = useUcatStaggerMotion();
  const currentYear = new Date().getFullYear();

  const studyPlanDecided = onboarding.isCompleted(UCAT_STUDY_PLAN_DECIDED);

  useEffect(() => {
    if (onboarding.isLoading) return;
    if (!studyPlanDecided) {
      router.replace(STUDY_PLAN_SETUP_FROM_SETTINGS);
    }
  }, [onboarding.isLoading, router, studyPlanDecided]);

  const yearOptions = useMemo<YearOption[]>(
    () =>
      [currentYear, currentYear + 1, currentYear + 2, currentYear + 3].map(
        (year) => ({ year }),
      ),
    [currentYear],
  );

  const [targetScore, setTargetScore] = useState(2100);
  const [studyPlanEnabled, setStudyPlanEnabled] = useState(true);
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
  const [targetScoreError, setTargetScoreError] = useState<string | null>(null);
  const targetScoreFieldRef = useRef<StudyPlanTargetScoreFieldHandle>(null);

  useEffect(() => {
    // Old gate (`!hydrated && !isError`) stayed on the skeleton forever when the
    // API returned success with `profile: null`. Hydrate from profile or defaults.
    if (!query.isFetched || query.isError || hydrated) return;

    try {
      const profile = query.data?.profile;
      const snap = profile
        ? snapshotFromProfile(profile)
        : snapshotFromProfile({
            ...defaultSkippedGoalProfileInput(currentYear),
            availableDays: DEFAULT_AVAILABILITY,
          });

      setStudyPlanEnabled(snap.studyPlanEnabled);
      setTargetScore(snap.targetScore);
      setTestYear(snap.testYear);
      setTestDate(snap.testDate);
      setAvailability(snap.availability);
      setMockDay(snap.mockDay);
      setSaved(snap);
    } finally {
      setHydrated(true);
    }
  }, [query.isFetched, query.isError, query.data, hydrated, currentYear]);

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
  const testDateBoundsForYear = useMemo(
    () => testDateBounds(testYear),
    [testYear],
  );

  const isDirty =
    saved !== null &&
    (targetScore !== saved.targetScore ||
      studyPlanEnabled !== saved.studyPlanEnabled ||
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
    setTargetScoreError(null);
    setStudyPlanEnabled(saved.studyPlanEnabled);
    setTestYear(saved.testYear);
    setTestDate(saved.testDate);
    setAvailability(saved.availability);
    setMockDay(saved.mockDay);
  }

  async function handleSave() {
    const targetScoreValidationError =
      targetScoreFieldRef.current?.validate() ?? targetScoreError;
    if (targetScoreValidationError) {
      toast({
        title: "Fix target score",
        description: targetScoreValidationError,
        variant: "destructive",
      });
      return;
    }

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

  if (onboarding.isLoading || !studyPlanDecided || !query.isFetched || !hydrated) {
    return <AppPageSkeleton variant="detail" />;
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
        <div className="border-b border-border/60 py-6 last:border-b-0 last:pb-0">
          <div
            className={cn(
              "flex flex-col gap-4",
              "sm:flex-row sm:items-start sm:justify-between sm:gap-8",
            )}
          >
            <div className="min-w-0 flex-1 space-y-1">
              <h3 className="text-base font-semibold tracking-tight">
                Study plan
              </h3>
              <p className="text-sm text-muted-foreground">
                Altitutor makes a daily plan for what to study, which adapts as
                you progress.
              </p>
            </div>
            <div className="w-full shrink-0 sm:flex sm:max-w-xs sm:justify-end">
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
            </div>
          </div>

          <SidebarExpandablePanel expanded={studyPlanEnabled}>
            <div className="mt-5 border-l-2 border-border/60 pl-4 sm:pl-5">
              <div className="mb-1 space-y-1">
                <h4 className="text-sm font-semibold tracking-tight">
                  Available study days
                </h4>
                <p className="text-sm text-muted-foreground">
                  Turn on the days you can usually study. The plan changes
                  session length and practice volume as your readiness and exam
                  date change.
                </p>
              </div>

              <div className="divide-y divide-border/60">
                {WEEKDAYS.map((day) => {
                  const isOn = Boolean(availabilityByDay.get(day.value));
                  return (
                    <div
                      key={day.value}
                      className="flex min-h-10 items-center justify-between gap-4 py-3 first:pt-2 last:pb-0"
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

              <div className="mt-1 border-t border-border/60 pt-1">
                <SettingsRow
                  title="Preferred mock day"
                  description="A soft preference for full mocks. The planner may use another available day when the cadence needs it."
                  control={
                    <SearchableSelect<WeekdayOption>
                      items={
                        mockDayOptions.length ? mockDayOptions : WEEKDAYS
                      }
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
            </div>
          </SidebarExpandablePanel>
        </div>

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
          controlClassName="sm:max-w-sm"
          control={
            <StudyPlanTargetScoreField
              ref={targetScoreFieldRef}
              value={targetScore}
              onChange={setTargetScore}
              onValidationChange={setTargetScoreError}
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
                if (!option) return;
                setTestYear(option.year);
                setTestDate((current) =>
                  current && isTestDateInBounds(current, option.year)
                    ? current
                    : "",
                );
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
            <SmartDatePickerField
              value={testDate || null}
              onChange={(value) => setTestDate(value ?? "")}
              valueFormat="date"
              showPresets={false}
              anchorYear={testYear}
              minDate={testDateBoundsForYear.minDate}
              maxDate={testDateBoundsForYear.maxDate}
              placeholder={STUDY_PLAN_TEST_DATE_PLACEHOLDER}
              inputPlaceholder={STUDY_PLAN_TEST_DATE_INPUT_PLACEHOLDER}
              className="h-10 w-full sm:w-auto sm:min-w-[14rem]"
            />
          }
        />
      </motion.div>

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
            disabled={saving || Boolean(targetScoreError)}
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
