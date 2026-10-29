"use client";

import { useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { usePaneNavigation } from "@/shared/hooks/usePaneNavigation";
import { useQueryClient } from "@tanstack/react-query";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
  Input,
  ScrollArea,
  SegmentedControl,
} from "@altitutor/ui";
import { Filter, Mail, MoreHorizontal, Plus, Search, Settings2, X } from "lucide-react";
import { AdminDialogShell } from "@/shared/components/dialog-shell";
import { AdminPageActionButton } from "@/shared/components";
import { useAdminPageViewParam } from "@/shared/hooks/useAdminPageViewParam";
import { clickableCardInteractiveCn, cn } from "@/shared/utils";
import { getSupabaseClient } from "@/shared/lib/supabase/client";
import {
  useOnboardingJourneys,
  useOnboardingSettings,
  onboardingKey,
} from "../api/queries";
import {
  defaultDeadlines,
  isOpen,
  lifecycle,
  nextActions,
  stages,
  type Journey,
} from "../lib/model";
import { ConversionInsights } from "./ConversionInsights";
import { NewJourney } from "./NewJourney";
import { ActionBadges, JourneyDetail } from "./JourneyDetail";


function Settings({ onClose }: { onClose: () => void }) {
  const { data } = useOnboardingSettings();
  const qc = useQueryClient();
  const [cadence, setCadence] = useState(
    data?.followup_business_days.join(", ") ?? "2, 5, 10",
  );
  const [days, setDays] = useState<Record<string, number>>({
    ...defaultDeadlines,
    ...((data?.action_business_days as Record<string, number>) ?? {}),
  });
  const [error, setError] = useState("");
  async function save() {
    const values = cadence.split(",").map(Number);
    if (
      values.some(
        (v, i) =>
          !Number.isInteger(v) || v < 1 || (i > 0 && v <= values[i - 1]),
      )
    ) {
      setError("Follow-up days must be positive and increasing.");
      return;
    }
    const { error } = await getSupabaseClient()
      .from("onboarding_settings")
      .update({ followup_business_days: values, action_business_days: days })
      .eq("id", true);
    if (error) {
      setError(error.message);
      return;
    }
    await qc.invalidateQueries({ queryKey: onboardingKey });
    onClose();
  }
  return (
    <AdminDialogShell
      open
      onClose={onClose}
      title="Queue settings"
      footer={<Button onClick={() => void save()}>Save settings</Button>}
    >
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Business days. These settings create queue deadlines; they do not send
          automated texts.
        </p>
        <label className="block text-sm">
          Family follow-up cadence
          <Input value={cadence} onChange={(e) => setCadence(e.target.value)} />
        </label>
        {Object.keys(defaultDeadlines).map((key) => (
          <label key={key} className="block text-sm">
            {key.replaceAll("_", " ")}
            <Input
              type="number"
              min={0}
              value={days[key]}
              onChange={(e) =>
                setDays((s) => ({
                  ...s,
                  [key]: Math.max(0, Number(e.target.value)),
                }))
              }
            />
          </label>
        ))}
        {error && (
          <p role="alert" className="text-destructive">
            {error}
          </p>
        )}
      </div>
    </AdminDialogShell>
  );
}
const QUEUE_VIEWS = ["board", "worklist"] as const;
const QUEUE_FILTERS = [
  ["open", "All open"],
  ["ours", "Our action"],
  ["waiting", "Waiting"],
  ["overdue", "Overdue"],
  ["closed", "Completed / closed"],
] as const;

export function TrialStudentsPage() {
  const pathname = usePathname();
  const section = pathname.startsWith("/trial-students/insights")
    ? "insights"
    : "queue";
  const [view, setView] = useAdminPageViewParam(QUEUE_VIEWS, "board");
  const { data: journeys = [], isLoading, error } = useOnboardingJourneys();
  const { data: settings } = useOnboardingSettings();
  const [filter, setFilter] = useState<(typeof QUEUE_FILTERS)[number][0]>("open");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string>();
  const [create, setCreate] = useState(false);
  const { router } = usePaneNavigation();
  const [configure, setConfigure] = useState(false);
  const deadlines = useMemo(
    () => ({
      ...defaultDeadlines,
      ...((settings?.action_business_days as Record<string, number>) ?? {}),
    }),
    [settings],
  );
  const actions = (j: Journey) =>
    nextActions(j, deadlines, new Date(), settings?.followup_business_days);
  const matches = (j: Journey, key: string) =>
    key === "closed"
      ? !isOpen(j)
      : isOpen(j) &&
        (key === "open" ||
          actions(j).some((a) =>
            key === "ours"
              ? !a.waiting
              : key === "waiting"
                ? a.waiting
                : a.overdue,
          ));
  const searched = journeys.filter((j) =>
    j.student_status !== "DISCONTINUED" &&
    `${j.label} ${j.evidence.subjects.map((s) => s.name).join(" ")}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  const rows = searched.filter((j) => matches(j, filter));
  const current = journeys.find(
    (j) => j.id === selected && j.student_status !== "DISCONTINUED",
  );
  const filterCounts = Object.fromEntries(
    QUEUE_FILTERS.map(([value]) => [
      value,
      searched.filter((journey) => matches(journey, value)).length,
    ]),
  ) as Record<(typeof QUEUE_FILTERS)[number][0], number>;
  const worklistRows = [...rows].sort(
    (left, right) =>
      Number(actions(right).some((action) => action.overdue)) -
      Number(actions(left).some((action) => action.overdue)),
  );
  return (
    <div className="flex h-[calc(100dvh-var(--navbar-height)-64px)] flex-col overflow-hidden">
      <div className="flex flex-shrink-0 items-center justify-between px-6 py-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Trial students</h1>
          <p className="text-sm text-muted-foreground">
            Enquiries, onboarding and first check-ins
          </p>
        </div>
        <div className="flex items-center gap-4">
          {section === "queue" && (
            <SegmentedControl
              aria-label="Queue view"
              value={view}
              onValueChange={(next) =>
                setView(next as (typeof QUEUE_VIEWS)[number])
              }
              options={[
                { value: "board", label: "Board" },
                { value: "worklist", label: "Worklist" },
              ]}
            />
          )}
          <AdminPageActionButton
            icon={<Plus className="h-4 w-4" />}
            label="New enquiry"
            onClick={() => {
              setCreate(true);
            }}
          />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                aria-label="More actions"
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setConfigure(true)}>
                <Settings2 className="mr-2 h-4 w-4" />
                Settings
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push("/email")}>
                <Mail className="mr-2 h-4 w-4" />
                Open mail
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      {error && (
        <p
          role="alert"
          className="mx-6 mb-4 rounded border border-destructive p-4 text-destructive"
        >
          Could not load onboarding: {error.message}
        </p>
      )}
      {section === "queue" ? (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="flex w-full min-w-0 flex-shrink-0 flex-wrap items-center gap-2 overflow-hidden border-b p-2">
            <div className="flex h-10 min-w-[220px] flex-1 items-center rounded-md border border-input bg-background px-2 ring-offset-background transition-colors focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
              <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <Search className="h-3.5 w-3.5" />
              </span>
              <Input
                aria-label="Search journeys"
                placeholder="Search student or subject"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="h-full min-w-0 flex-1 border-0 bg-transparent px-2 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
              />
              {search ? (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="shrink-0 text-muted-foreground hover:text-foreground"
                  aria-label="Clear search"
                >
                  <X className="h-4 w-4" />
                </button>
              ) : null}
            </div>
            <div className="relative ml-auto flex shrink-0 items-center">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="size-9 p-0 md:h-10 md:w-auto md:px-3"
                  >
                    <Filter className="h-4 w-4 md:mr-2" />
                    <span
                      className={cn(
                        "hidden md:inline",
                        filter === "open" && "opacity-50",
                      )}
                    >
                      Filter
                    </span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-[240px]">
                  <DropdownMenuLabel>Filters</DropdownMenuLabel>
                  <DropdownMenuRadioGroup
                    value={filter}
                    onValueChange={(value) =>
                      setFilter(value as (typeof QUEUE_FILTERS)[number][0])
                    }
                  >
                    {QUEUE_FILTERS.map(([value, label]) => (
                      <DropdownMenuRadioItem key={value} value={value} className="w-full">
                        {label}
                        <span className="ml-auto pl-3 text-xs text-muted-foreground">
                          {filterCounts[value]}
                        </span>
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>
              {filter !== "open" ? (
                <button
                  type="button"
                  aria-label="Clear filter"
                  className="absolute -right-1.5 -top-1.5 z-10 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-semibold leading-none text-primary-foreground shadow-sm ring-2 ring-background"
                  onClick={() => setFilter("open")}
                >
                  1
                </button>
              ) : null}
            </div>
          </div>
          {view === "board" ? (
            <div className="relative min-h-0 flex-1">
              {isLoading && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/50">
                  <span role="status" className="text-sm text-muted-foreground">
                    Loading journeys…
                  </span>
                </div>
              )}
              <div className="h-full w-full overflow-x-auto overflow-y-hidden">
                <div className="flex h-full min-w-max gap-4 px-6 pt-2">
                  {stages.map((stage, index) => {
                    const columnJourneys = rows.filter(
                      (journey) => lifecycle(journey) === index,
                    );
                    return (
                      <section
                        key={stage}
                        className="flex h-full min-h-0 w-[300px] min-w-[300px] flex-col overflow-hidden rounded-[var(--radius)] bg-muted/30"
                      >
                        <div className="flex flex-shrink-0 items-center justify-between p-3">
                          <div className="flex items-center gap-2">
                            <h2 className="text-sm font-semibold">{stage}</h2>
                            <span className="rounded border bg-background px-1.5 py-0.5 text-xs text-muted-foreground">
                              {columnJourneys.length}
                            </span>
                          </div>
                        </div>
                        <ScrollArea className="min-h-0 flex-1">
                          <div className="p-2 pt-0">
                            {columnJourneys.map((journey) => {
                              const journeyActions = actions(journey);
                              const subjects = journey.evidence.subjects
                                .map((subject) => subject.name)
                                .join(" · ");
                              return (
                                <div key={journey.id} className="pb-2">
                                  <button
                                    type="button"
                                    onClick={() => setSelected(journey.id)}
                                    className={cn(
                                      "group flex w-full cursor-pointer flex-col gap-2 rounded-lg border bg-card p-3 text-left transition-all",
                                      clickableCardInteractiveCn,
                                    )}
                                  >
                                    <h3 className="line-clamp-2 text-sm font-medium">
                                      {journey.label}
                                    </h3>
                                    {subjects ? (
                                      <span className="text-xs text-muted-foreground">
                                        {subjects}
                                      </span>
                                    ) : null}
                                    <ActionBadges actions={journeyActions} />
                                    <span className="text-sm">
                                      {journeyActions[0]?.label ??
                                        journey.closure_reason ??
                                        "Completed"}
                                    </span>
                                  </button>
                                </div>
                              );
                            })}
                            {columnJourneys.length === 0 && !isLoading && (
                              <div className="py-8 text-center text-xs text-muted-foreground">
                                No journeys
                              </div>
                            )}
                          </div>
                        </ScrollArea>
                      </section>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div className="relative min-h-0 flex-1 overflow-auto px-6 pb-6 pt-2">
              {isLoading && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/50">
                  <span role="status" className="text-sm text-muted-foreground">
                    Loading journeys…
                  </span>
                </div>
              )}
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="p-3">Student / family</th>
                      <th className="p-3">Stage</th>
                      <th className="p-3">Next action</th>
                      <th className="p-3">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {worklistRows.map((journey) => {
                      const journeyActions = actions(journey);
                      return (
                        <tr
                          key={journey.id}
                          className="cursor-pointer border-b hover:bg-muted/50"
                          onClick={() => setSelected(journey.id)}
                        >
                          <td className="p-3 font-medium">{journey.label}</td>
                          <td className="p-3">{stages[lifecycle(journey)]}</td>
                          <td className="p-3">
                            {journeyActions[0]?.label ??
                              journey.closure_reason ??
                              "Completed"}
                          </td>
                          <td className="p-3">
                            <ActionBadges actions={journeyActions} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {!rows.length && !isLoading && !error && (
                <p className="py-6 text-muted-foreground">
                  No journeys match this view. Create an enquiry to start
                  tracking a student.
                </p>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-auto px-6 pb-6">
          {isLoading && journeys.length === 0 ? (
            <p role="status" className="text-sm text-muted-foreground">
              Loading journeys…
            </p>
          ) : (
            <ConversionInsights
              journeys={journeys}
              deadlines={deadlines}
              cadence={settings?.followup_business_days ?? [2, 5, 10]}
            />
          )}
        </div>
      )}
      {current && (
        <JourneyDetail
          key={current.id}
          journey={current}
          deadlines={deadlines}
          onClose={() => setSelected(undefined)}
        />
      )}{" "}
      {create && (
        <NewJourney
          onClose={() => setCreate(false)}
        />
      )}{" "}
      {configure && <Settings onClose={() => setConfigure(false)} />}
    </div>
  );
}
