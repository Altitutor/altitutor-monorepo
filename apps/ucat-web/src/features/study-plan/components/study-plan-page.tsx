"use client";

import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Skeleton,
} from "@altitutor/ui";
import { AlertTriangle, CalendarClock, ChevronDown, ChevronUp, Settings2, Sparkles } from "lucide-react";
import { UcatPageHeader } from "@/features/layout";
import { saveStudyPlan } from "@/features/study-plan/api/study-plan";
import { StudyPlanTaskList } from "@/features/study-plan/components/study-plan-task-list";
import { useStudyPlan } from "@/features/study-plan/hooks/use-study-plan";
import type {
  StudyPlanAvailability,
  StudyPlanProfileInput,
  StudyPlanTask,
  StudyPlanWeekday,
} from "@/features/study-plan/model/types";
import { UCAT_CARD_CHROME } from "@/lib/ucat-surface-motion";
import { cn } from "@/lib/utils";

const DAYS: Array<{ value: StudyPlanWeekday; label: string; short: string }> = [
  { value: 1, label: "Monday", short: "Mon" },
  { value: 2, label: "Tuesday", short: "Tue" },
  { value: 3, label: "Wednesday", short: "Wed" },
  { value: 4, label: "Thursday", short: "Thu" },
  { value: 5, label: "Friday", short: "Fri" },
  { value: 6, label: "Saturday", short: "Sat" },
  { value: 0, label: "Sunday", short: "Sun" },
];

function PreferencesForm({ initial, onSaved }: { initial: StudyPlanProfileInput | null; onSaved: () => void }) {
  const currentYear = new Date().getFullYear();
  const [targetScore, setTargetScore] = useState(initial?.targetScore ?? 2100);
  const [testYear, setTestYear] = useState(initial?.testYear ?? currentYear);
  const [testDate, setTestDate] = useState(initial?.testDate ?? "");
  const [availability, setAvailability] = useState<StudyPlanAvailability[]>(initial?.availableDays ?? [
    { weekday: 1, maxMinutes: 60 }, { weekday: 3, maxMinutes: 60 }, { weekday: 6, maxMinutes: 120 },
  ]);
  const [mockDay, setMockDay] = useState<StudyPlanWeekday>(initial?.preferredMockWeekday ?? 6);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const selected = new Set(availability.map((day) => day.weekday));
  function toggle(day: StudyPlanWeekday) {
    setAvailability((current) => {
      if (current.some((item) => item.weekday === day)) {
        const next = current.filter((item) => item.weekday !== day);
        if (mockDay === day && next[0]) setMockDay(next[0].weekday);
        return next;
      }
      return [...current, { weekday: day, maxMinutes: 60 }];
    });
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      await saveStudyPlan({ targetScore, testYear, testDate: testDate || null, availableDays: availability, preferredMockWeekday: mockDay });
      onSaved();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not update your plan.");
    } finally {
      setPending(false);
    }
  }
  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2"><Label htmlFor="study-target">Target score</Label><Input id="study-target" type="number" min={900} max={2700} step={10} value={targetScore} onChange={(event) => setTargetScore(Number(event.target.value))} /></div>
        <div className="space-y-2"><Label htmlFor="study-year">Test year</Label><Input id="study-year" type="number" min={currentYear} max={currentYear + 3} value={testYear} onChange={(event) => setTestYear(Number(event.target.value))} /></div>
        <div className="space-y-2"><Label htmlFor="study-date">Exact date (optional)</Label><Input id="study-date" type="date" value={testDate} onChange={(event) => { setTestDate(event.target.value); if (event.target.value) setTestYear(Number(event.target.value.slice(0, 4))); }} /></div>
      </div>
      <div className="space-y-2">
        <Label>Available study days</Label>
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
          {DAYS.map((day) => <Button key={day.value} type="button" size="sm" variant={selected.has(day.value) ? "default" : "outline"} onClick={() => toggle(day.value)}>{day.short}</Button>)}
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {availability.map((available) => (
          <div key={available.weekday} className="flex items-center justify-between gap-3 rounded-xl border px-3 py-2">
            <span className="text-sm">{DAYS.find((day) => day.value === available.weekday)?.label}</span>
            <div className="flex items-center gap-2"><Input className="h-8 w-20" type="number" min={15} max={360} step={15} value={available.maxMinutes} onChange={(event) => setAvailability((current) => current.map((item) => item.weekday === available.weekday ? { ...item, maxMinutes: Number(event.target.value) } : item))} /><span className="text-xs text-muted-foreground">min</span></div>
          </div>
        ))}
      </div>
      {availability.length ? (
        <div className="max-w-xs space-y-2"><Label htmlFor="study-mock-day">Preferred mock day</Label><select id="study-mock-day" value={mockDay} onChange={(event) => setMockDay(Number(event.target.value) as StudyPlanWeekday)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">{DAYS.filter((day) => selected.has(day.value)).map((day) => <option key={day.value} value={day.value}>{day.label}</option>)}</select></div>
      ) : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button type="submit" disabled={pending || !availability.length}>{pending ? "Regenerating…" : initial ? "Save and regenerate" : "Create my Study plan"}</Button>
    </form>
  );
}

export function StudyPlanPage() {
  const query = useStudyPlan();
  const queryClient = useQueryClient();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const tasks = query.data?.tasks;
  const grouped = useMemo(() => {
    const groups = new Map<string, StudyPlanTask[]>();
    for (const task of tasks ?? []) {
      groups.set(task.scheduledDate, [...(groups.get(task.scheduledDate) ?? []), task]);
    }
    return [...groups.entries()];
  }, [tasks]);
  return (
    <div className="space-y-6">
      <UcatPageHeader title="Study plan" description="Your adaptive route from today to test day" />
      {query.isLoading ? <Skeleton className="h-96 w-full rounded-2xl" /> : null}
      {query.isError ? <Alert variant="destructive"><AlertTitle>Could not load your Study plan</AlertTitle><AlertDescription>{query.error.message}</AlertDescription></Alert> : null}
      {query.data ? (
        <>
          <Card className={UCAT_CARD_CHROME}>
            <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
              <div><CardTitle className="flex items-center gap-2"><Settings2 className="h-5 w-5 text-primary" /> Plan settings</CardTitle><p className="mt-1 text-sm text-muted-foreground">Your availability is a maximum, not a quota. The plan ramps up toward your test.</p></div>
              <Button variant="outline" size="sm" onClick={() => setSettingsOpen((open) => !open)}>{settingsOpen ? "Close" : query.data.profile ? "Edit" : "Set up"}{settingsOpen ? <ChevronUp className="ml-1.5 h-4 w-4" /> : <ChevronDown className="ml-1.5 h-4 w-4" />}</Button>
            </CardHeader>
            <CardContent>
              {settingsOpen || !query.data.profile ? (
                <PreferencesForm initial={query.data.profile} onSaved={() => { setSettingsOpen(false); void queryClient.invalidateQueries({ queryKey: ["ucat-study-plan"] }); }} />
              ) : (
                <div className="grid gap-3 text-sm sm:grid-cols-3"><div><span className="text-muted-foreground">Target</span><p className="mt-1 text-lg font-semibold">{query.data.profile.targetScore}</p></div><div><span className="text-muted-foreground">Planning date</span><p className="mt-1 font-medium">{new Date(`${query.data.profile.planningDate}T00:00:00`).toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" })}{query.data.profile.planningDateIsProvisional ? <Badge className="ml-2" variant="secondary">Provisional</Badge> : null}</p></div><div><span className="text-muted-foreground">Study days</span><p className="mt-1 font-medium">{query.data.profile.availableDays.map((item) => DAYS.find((day) => day.value === item.weekday)?.short).join(", ")}</p></div></div>
              )}
            </CardContent>
          </Card>
          {query.data.generation?.capacityRisk.level === "warning" ? <Alert className="border-amber-500/30 bg-amber-500/10"><AlertTriangle className="h-4 w-4 text-amber-600" /><AlertTitle>There is a capacity gap</AlertTitle><AlertDescription>{query.data.generation.capacityRisk.message} This is guidance, not a block.</AlertDescription></Alert> : null}
          {query.data.profile && query.data.generation ? (
            <div className="grid gap-4 sm:grid-cols-3"><Card className={UCAT_CARD_CHROME}><CardContent className="pt-6"><span className="text-sm text-muted-foreground">Progress to date</span><p className="mt-1 text-3xl font-semibold">{query.data.completion.percent}%</p></CardContent></Card><Card className={UCAT_CARD_CHROME}><CardContent className="pt-6"><span className="text-sm text-muted-foreground">Plan horizon</span><p className="mt-1 text-lg font-semibold">Through {new Date(`${query.data.generation.endsOn}T00:00:00`).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}</p></CardContent></Card><Card className={UCAT_CARD_CHROME}><CardContent className="pt-6"><span className="text-sm text-muted-foreground">Next adaptation</span><p className="mt-1 text-lg font-semibold">{query.data.profile.nextWeeklyReplanOn ? new Date(`${query.data.profile.nextWeeklyReplanOn}T00:00:00`).toLocaleDateString("en-AU", { day: "numeric", month: "short" }) : "After your next result"}</p></CardContent></Card></div>
          ) : null}
          {query.data.profile && !grouped.length ? <Card className={UCAT_CARD_CHROME}><CardContent className="flex flex-col items-center py-12 text-center"><Sparkles className="h-8 w-8 text-primary" /><h2 className="mt-4 font-semibold">Your plan has no remaining study days</h2><p className="mt-1 text-sm text-muted-foreground">Update your test date or available days to regenerate it.</p></CardContent></Card> : null}
          {grouped.length ? (
            <section className="space-y-4"><div className="flex items-center gap-2"><CalendarClock className="h-5 w-5 text-primary" /><h2 className="text-lg font-semibold">Your plan to test day</h2><Badge variant="outline">Future tasks adapt weekly</Badge></div>{grouped.map(([date, tasks]) => { const isToday = date === query.data.today; const future = date > query.data.today; return <Card key={date} className={cn(UCAT_CARD_CHROME, isToday && "ring-1 ring-primary/35")}><CardHeader className="pb-3"><CardTitle className="flex flex-wrap items-center gap-2 text-base">{new Date(`${date}T00:00:00`).toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long" })}{isToday ? <Badge>Today</Badge> : null}{future ? <span className="text-xs font-normal text-muted-foreground">Provisional</span> : null}<span className="ml-auto text-sm font-normal text-muted-foreground">{tasks.reduce((sum, task) => sum + task.estimatedMinutes, 0)} min</span></CardTitle></CardHeader><CardContent><StudyPlanTaskList tasks={tasks} /></CardContent></Card>; })}</section>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
