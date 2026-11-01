"use client";

import { useMemo, useState } from "react";
import {
  ScrollArea,
} from "@altitutor/ui";
import { Plus } from "lucide-react";
import { AdminPageActionButton } from "@/shared/components";
import { AdminPageActions } from "@/shared/components/AdminPageActions";
import { DataTableToolbar } from "@altitutor/ui";
import { useAdminPageViewParam } from "@/shared/hooks/useAdminPageViewParam";
import { clickableCardInteractiveCn, cn } from "@/shared/utils";
import {
  useOnboardingJourneys,
  useOnboardingSettings,
} from "../api/queries";
import {
  defaultDeadlines,
  isOpen,
  lifecycle,
  nextActions,
  stages,
  type Journey,
} from "../lib/model";
import { NewJourney } from "./NewJourney";
import { ActionBadges, JourneyDetail } from "./JourneyDetail";


const QUEUE_VIEWS = ["board", "worklist"] as const;
const QUEUE_FILTERS = [
  ["open", "All open"],
  ["ours", "Our action"],
  ["waiting", "Waiting"],
  ["overdue", "Overdue"],
  ["closed", "Completed / closed"],
] as const;

export function TrialStudentsPage() {
  const [view, setView] = useAdminPageViewParam(QUEUE_VIEWS, "board");
  const { data: journeys = [], isLoading, error } = useOnboardingJourneys();
  const { data: settings } = useOnboardingSettings();
  const [filter, setFilter] = useState<(typeof QUEUE_FILTERS)[number][0]>("open");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string>();
  const [create, setCreate] = useState(false);
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
  const worklistRows = [...rows].sort(
    (left, right) =>
      Number(actions(right).some((action) => action.overdue)) -
      Number(actions(left).some((action) => action.overdue)),
  );
  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <AdminPageActions><AdminPageActionButton icon={<Plus className="h-4 w-4" />} label="New enquiry" onClick={() => setCreate(true)} /></AdminPageActions>
      {error && (
        <p
          role="alert"
          className="mx-6 mb-4 rounded border border-destructive p-4 text-destructive"
        >
          Could not load onboarding: {error.message}
        </p>
      )}
      {(
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <DataTableToolbar
            state={{ search, filters: { queue: [filter] }, sortBy: null, sortDirection: 'asc', groupBy: null, page: 1, pageSize: 50, visibleColumns: [] }}
            onSearchChange={setSearch}
            onFiltersChange={next => { const value = next.queue?.at(-1); setFilter(QUEUE_FILTERS.find(([key]) => key === value)?.[0] ?? 'open'); }}
            onSortChange={() => {}} onGroupByChange={() => {}} onVisibleColumnsChange={() => {}} onQuickFilterApply={() => {}}
            onReset={() => { setSearch(''); setFilter('open'); setView('board'); }}
            filterDefinitions={[{ key: 'queue', label: 'Queue', options: QUEUE_FILTERS.map(([value, label]) => ({ value, label: `${label} ${searched.filter(journey => matches(journey, value)).length}` })) }]}
            view={{ value: view, options: [{ value: 'board', label: 'Board' }, { value: 'worklist', label: 'Worklist' }], onChange: next => { if (next === 'board' || next === 'worklist') setView(next); } }}
            searchPlaceholder="Search student or subject" hideViews
          />
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
    </div>
  );
}
