"use client";

import React, { useDeferredValue, useMemo, useState } from "react";
import { Badge } from "@altitutor/ui";
import { Button } from "@/components/ui/button";
import {
  comparePreparationSandboxCase,
  exportPreparationSandboxCase,
  exportPreparationSandboxComparison,
  PREPARATION_SANDBOX_JOURNEYS,
  PREPARATION_SANDBOX_PERSONAS,
  replayPreparationSandboxCase,
  runPreparationSandboxCase,
  type PreparationSandboxCase,
  type PreparationSandboxPolicy,
  type PreparationSandboxRun,
} from "@/features/preparation/testing/sandbox";
import type { GeneratedStudyPlanTask } from "@/features/study-plan/model/types";
import { studyPlanActivityTypeLabel } from "@/features/study-plan/lib/activity-type-label";

type JourneyOption = {
  key: string;
  label: string;
  description: string;
  checkpoints: Array<{
    fixtureKey: string;
    label: string;
    description: string;
  }>;
};

const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

function policyText(fixture: PreparationSandboxCase, policySuffix = "") {
  return JSON.stringify(
    {
      versions: {
        ...fixture.input.versions,
        policy: `${fixture.input.versions.policy}${policySuffix}`,
      },
      timingProfile: fixture.input.timingProfile,
    } satisfies PreparationSandboxPolicy,
    null,
    2,
  );
}

function downloadFixture(contents: string, key: string) {
  const blob = new Blob([contents], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${key}.preparation-comparison.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat("en-AU", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00.000Z`));
}

function taskTypeLabel(task: GeneratedStudyPlanTask) {
  return studyPlanActivityTypeLabel(task);
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function StudyPlanJourney({ run }: { run: PreparationSandboxRun }) {
  const { fixture, result } = run;
  const sectionById = new Map(
    fixture.input.content.sections.map((section) => [section.id, section]),
  );
  const categoryById = new Map(
    fixture.input.content.categories.map((category) => [category.id, category]),
  );
  const moduleById = new Map(
    fixture.input.content.learningModules.map((module) => [module.id, module]),
  );
  const tasksByDate = Map.groupBy(
    result.plan.tasks,
    (task) => task.scheduledDate,
  );
  const plannedDays = run.dailyWork.filter(
    (day) => (tasksByDate.get(day.date)?.length ?? 0) > 0,
  );
  const availableDays = fixture.input.goal.profile.availableDays
    .map(({ weekday }) => WEEKDAYS[weekday])
    .join(", ");

  return (
    <div className="space-y-6" data-testid="journey-preview">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border bg-background p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Student situation
          </p>
          <p className="mt-2 font-semibold">{fixture.label}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {fixture.description}
          </p>
        </div>
        <div className="rounded-2xl border bg-background p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Test timing
          </p>
          <p className="mt-2 text-xl font-semibold">
            {result.assessment.daysUntilExam} days
          </p>
          <p className="text-sm text-muted-foreground">
            Target {fixture.input.goal.profile.targetScore}
          </p>
        </div>
        <div className="rounded-2xl border bg-background p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Study days
          </p>
          <p className="mt-2 text-sm font-semibold">
            {availableDays || "None"}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {fixture.input.goal.profile.availableDays.length} days each week
          </p>
        </div>
        <div className="rounded-2xl border bg-background p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Current estimate
          </p>
          <p className="mt-2 text-xl font-semibold">
            {result.currentScore.currentEstimate ?? "Pending"}
          </p>
          <p className="text-sm text-muted-foreground">
            {result.currentScore.plausibleRange
              ? `${result.currentScore.plausibleRange.min}–${result.currentScore.plausibleRange.max} plausible range`
              : "Waiting for representative evidence"}
          </p>
        </div>
      </section>

      <section aria-labelledby="section-progress-heading">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 id="section-progress-heading" className="text-xl font-semibold">
              Section progress
            </h2>
            <p className="text-sm text-muted-foreground">
              What the engine believes each section needs next.
            </p>
          </div>
          <Badge variant="secondary">
            Overall {result.plan.readiness.mode} phase
          </Badge>
        </div>
        <div className="mt-3 grid gap-3 lg:grid-cols-3">
          {result.assessment.sections.map((assessment) => {
            const section = sectionById.get(assessment.sectionId);
            return (
              <article
                key={assessment.sectionId}
                className="rounded-2xl border bg-background p-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-semibold">
                    {section?.name ??
                      assessment.sectionKey.replaceAll("_", " ")}
                  </h3>
                  <Badge variant="outline">
                    {assessment.mode === "learning"
                      ? "Learning"
                      : assessment.mode === "timing"
                        ? "Timing"
                        : "Exam"}
                  </Badge>
                </div>
                {assessment.mode === "learning" ? null : (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Working pace {assessment.paceMultiplier.toFixed(1)}× exam
                    pace
                  </p>
                )}
                <p className="mt-3 text-sm">Next: {assessment.nextMilestone}</p>
              </article>
            );
          })}
        </div>
      </section>

      {result.plan.capacityRisk.message ? (
        <section className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4">
          <h2 className="font-semibold">Plan prioritisation</h2>
          <p className="mt-1 text-sm">{result.plan.capacityRisk.message}</p>
        </section>
      ) : null}

      {result.plan.contentGaps.length > 0 ? (
        <section className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4">
          <h2 className="font-semibold">Development catalog gaps</h2>
          <ul className="mt-2 space-y-2 text-sm">
            {result.plan.contentGaps.map((gap, index) => {
              const section = gap.sectionId
                ? sectionById.get(gap.sectionId)
                : null;
              const learningModule = gap.moduleId
                ? moduleById.get(gap.moduleId)
                : null;
              const explanation =
                gap.reason === "no_eligible_set"
                  ? "No suitable predefined Set is available."
                  : gap.reason === "no_eligible_mock"
                    ? "No suitable unseen Mock is available."
                    : gap.reason === "tag_fallback_required"
                      ? "Matching tags will be exhausted before broader category questions are used."
                      : `Only ${gap.availableQuestionCount ?? 0} of ${gap.requestedQuestionCount ?? 0} strictly matched questions are available.`;
              return (
                <li key={`${gap.kind}:${gap.sectionId}:${index}`}>
                  <span className="font-medium">
                    {section?.shortName ?? "Whole exam"}
                    {learningModule ? ` · ${learningModule.title}` : ""}:
                  </span>{" "}
                  {explanation}
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="generated-plan-heading">
        <h2 id="generated-plan-heading" className="text-xl font-semibold">
          Generated 21-day plan
        </h2>
        <p className="text-sm text-muted-foreground">
          Rest days are hidden. Activities appear in the order the Student would
          complete them.
        </p>
        <div className="mt-4 space-y-4">
          {plannedDays.map((day) => {
            const tasks = [...(tasksByDate.get(day.date) ?? [])].sort(
              (left, right) => left.sortOrder - right.sortOrder,
            );
            return (
              <article
                key={day.date}
                className="rounded-2xl border bg-background"
              >
                <header className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
                  <h3 className="font-semibold">{formatDate(day.date)}</h3>
                  <span className="text-sm text-muted-foreground">
                    {day.practiceMinutes + day.reviewMinutes} min planned
                  </span>
                </header>
                <ol className="divide-y">
                  {tasks.map((task, index) => {
                    const section = task.sectionId
                      ? sectionById.get(task.sectionId)
                      : null;
                    const configuredCategoryIds = stringArray(
                      task.launchConfig.categoryIds,
                    );
                    const categoryIds = [
                      ...configuredCategoryIds,
                      ...(task.questionStemCategoryId
                        ? [task.questionStemCategoryId]
                        : []),
                    ];
                    const categoryNames = [...new Set(categoryIds)]
                      .flatMap((id) => {
                        const category = categoryById.get(id);
                        return category ? [category.name] : [];
                      })
                      .join(", ");
                    const usesModuleTags =
                      stringArray(task.launchConfig.questionTagIds).length > 0;
                    return (
                      <li
                        key={`${task.scheduledDate}:${task.sortOrder}`}
                        className="p-4"
                      >
                        <div className="flex gap-3">
                          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                            {index + 1}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant="outline">
                                {taskTypeLabel(task)}
                              </Badge>
                              {section ? (
                                <span className="text-xs font-medium">
                                  {section.shortName}
                                </span>
                              ) : null}
                              {task.questionSetId ? (
                                <Badge variant="secondary">
                                  Predefined Set
                                </Badge>
                              ) : null}
                              {task.mockId ? (
                                <Badge variant="secondary">
                                  Predefined Mock
                                </Badge>
                              ) : null}
                            </div>
                            <p className="mt-2 font-semibold">{task.title}</p>
                            <p className="mt-1 text-sm text-muted-foreground">
                              {task.description}
                            </p>
                            {categoryNames || usesModuleTags ? (
                              <p className="mt-2 text-xs text-muted-foreground">
                                {categoryNames
                                  ? `Categories: ${categoryNames}.`
                                  : ""}
                                {usesModuleTags
                                  ? " Module-linked tags are preferred before broader category questions."
                                  : ""}
                              </p>
                            ) : null}
                            <p className="mt-2 text-xs">
                              <span className="font-medium">Why:</span>{" "}
                              {task.rationale}
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {task.estimatedMinutes} min
                            </p>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function AdvancedTools({
  comparison,
  fixtureText,
  leftPolicyText,
  rightPolicyText,
  setFixtureText,
  setLeftPolicyText,
  setRightPolicyText,
  validateFixture,
}: {
  comparison: ReturnType<typeof comparePreparationSandboxCase> & {
    fixture: PreparationSandboxCase;
    policies: {
      left: PreparationSandboxPolicy;
      right: PreparationSandboxPolicy;
    };
  };
  fixtureText: string;
  leftPolicyText: string;
  rightPolicyText: string;
  setFixtureText: (value: string) => void;
  setLeftPolicyText: (value: string) => void;
  setRightPolicyText: (value: string) => void;
  validateFixture: () => void;
}) {
  const selectedModules =
    comparison.left.fixture.input.content.learningModules.filter(
      (module) =>
        (module.targetedPracticeInventory?.selectedStemIds?.length ?? 0) > 0,
    );
  return (
    <details className="rounded-2xl border bg-muted/20">
      <summary className="cursor-pointer px-4 py-3 font-semibold">
        Advanced JSON, diagnostics and policy comparison
      </summary>
      <div className="space-y-5 border-t p-4">
        <div className="grid gap-4 xl:grid-cols-2">
          <label className="block text-sm font-medium">
            Control policy JSON
            <textarea
              className="mt-1 min-h-44 w-full rounded-lg border bg-background p-2 font-mono text-[10px]"
              spellCheck={false}
              value={leftPolicyText}
              onChange={(event) => setLeftPolicyText(event.target.value)}
            />
          </label>
          <label className="block text-sm font-medium">
            Candidate policy JSON
            <textarea
              className="mt-1 min-h-44 w-full rounded-lg border bg-background p-2 font-mono text-[10px]"
              spellCheck={false}
              value={rightPolicyText}
              onChange={(event) => setRightPolicyText(event.target.value)}
            />
          </label>
        </div>
        <label className="block text-sm font-medium">
          Replayable case JSON
          <textarea
            className="mt-1 min-h-[360px] w-full rounded-xl border bg-background p-3 font-mono text-xs"
            spellCheck={false}
            value={fixtureText}
            onChange={(event) => setFixtureText(event.target.value)}
          />
        </label>
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={validateFixture}>
            Run edited case
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              downloadFixture(
                exportPreparationSandboxComparison({
                  fixture: comparison.fixture,
                  policies: comparison.policies,
                }),
                comparison.fixture.key,
              )
            }
          >
            Export comparison JSON
          </Button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {(["left", "right"] as const).map((side) => {
            const run = comparison[side];
            return (
              <div
                key={side}
                className="rounded-xl border bg-background p-3 text-sm"
              >
                <p className="font-semibold">
                  {side === "left" ? "Control" : "Candidate"}
                </p>
                <p className="mt-1 text-muted-foreground">
                  {run.result.plan.tasks.length} tasks ·{" "}
                  {run.result.plan.readiness.mode} phase · estimate{" "}
                  {run.result.currentScore.currentEstimate ?? "pending"}
                </p>
              </div>
            );
          })}
        </div>
        {selectedModules.length > 0 ? (
          <details>
            <summary className="cursor-pointer text-sm font-semibold">
              Raw targeted-selection trace
            </summary>
            <pre className="mt-2 max-h-96 overflow-auto rounded-xl bg-background p-3 text-xs">
              {JSON.stringify(
                selectedModules.map((module) => ({
                  moduleId: module.id,
                  moduleTitle: module.title,
                  selectedStemIds:
                    module.targetedPracticeInventory?.selectedStemIds,
                  selectionTrace:
                    module.targetedPracticeInventory?.selectionTrace,
                })),
                null,
                2,
              )}
            </pre>
          </details>
        ) : null}
        <details>
          <summary className="cursor-pointer text-sm font-semibold">
            Full policy reason trace (
            {comparison.left.result.explanationTrace.length})
          </summary>
          <pre className="mt-2 max-h-96 overflow-auto rounded-xl bg-background p-3 text-xs">
            {JSON.stringify(comparison.left.result.explanationTrace, null, 2)}
          </pre>
        </details>
      </div>
    </details>
  );
}

export function PreparationSandboxPage({
  catalogCase,
}: {
  catalogCase?: PreparationSandboxCase | null;
}) {
  const personas = catalogCase
    ? [...Object.values(PREPARATION_SANDBOX_PERSONAS), catalogCase]
    : Object.values(PREPARATION_SANDBOX_PERSONAS);
  const journeys: JourneyOption[] = catalogCase
    ? [
        ...PREPARATION_SANDBOX_JOURNEYS,
        {
          key: "development-catalog",
          label: "Real development catalog",
          description:
            "Use synthetic evidence with the deployed modules, questions, Sets and Mocks.",
          checkpoints: [
            {
              fixtureKey: catalogCase.key,
              label: "Current catalog",
              description: "Uses the signed-in tester's Practice history.",
            },
          ],
        },
      ]
    : PREPARATION_SANDBOX_JOURNEYS;
  const initial = catalogCase ?? PREPARATION_SANDBOX_PERSONAS["new-student"];
  const [fixtureText, setFixtureText] = useState(
    exportPreparationSandboxCase(initial),
  );
  const [leftPolicyText, setLeftPolicyText] = useState(policyText(initial));
  const [rightPolicyText, setRightPolicyText] = useState(
    policyText(initial, "-candidate"),
  );
  const [error, setError] = useState<string | null>(null);
  const deferredFixtureText = useDeferredValue(fixtureText);
  const deferredLeftPolicyText = useDeferredValue(leftPolicyText);
  const deferredRightPolicyText = useDeferredValue(rightPolicyText);

  const comparison = useMemo(() => {
    try {
      const replayed = replayPreparationSandboxCase(deferredFixtureText);
      const fixture = replayed.fixture;
      const policies = {
        left: JSON.parse(deferredLeftPolicyText) as PreparationSandboxPolicy,
        right: JSON.parse(deferredRightPolicyText) as PreparationSandboxPolicy,
      };
      return {
        fixture,
        policies,
        ...comparePreparationSandboxCase(fixture, policies),
      };
    } catch {
      return null;
    }
  }, [deferredFixtureText, deferredLeftPolicyText, deferredRightPolicyText]);

  const selectedJourney = journeys.find((journey) =>
    journey.checkpoints.some(
      (checkpoint) => checkpoint.fixtureKey === comparison?.fixture.key,
    ),
  );
  const selectedCheckpoint = selectedJourney?.checkpoints.find(
    (checkpoint) => checkpoint.fixtureKey === comparison?.fixture.key,
  );

  function chooseFixture(key: string) {
    const fixture = personas.find((persona) => persona.key === key);
    if (!fixture) return;
    setFixtureText(exportPreparationSandboxCase(fixture));
    setLeftPolicyText(policyText(fixture));
    setRightPolicyText(policyText(fixture, "-candidate"));
    setError(null);
  }

  function validateFixture() {
    try {
      runPreparationSandboxCase(
        replayPreparationSandboxCase(fixtureText).fixture,
      );
      JSON.parse(leftPolicyText) as PreparationSandboxPolicy;
      JSON.parse(rightPolicyText) as PreparationSandboxPolicy;
      setError(null);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Fixture is not valid JSON.",
      );
    }
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl space-y-6 p-4 sm:p-6 lg:p-8">
      <header className="space-y-2">
        <Badge>Development only · no Student writes</Badge>
        <h1 className="text-3xl font-semibold">Study plan journey preview</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Choose a Student journey and checkpoint to see the plan they would
          receive. The canonical engine remains deterministic and the technical
          replay tools are available under Advanced.
        </p>
      </header>

      <section className="rounded-2xl border bg-muted/20 p-4">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block text-sm font-medium">
            Journey
            <select
              className="mt-1 w-full rounded-lg border bg-background px-3 py-2"
              value={selectedJourney?.key ?? "custom"}
              onChange={(event) => {
                const journey = journeys.find(
                  (candidate) => candidate.key === event.target.value,
                );
                const checkpoint = journey?.checkpoints[0];
                if (checkpoint) chooseFixture(checkpoint.fixtureKey);
              }}
            >
              {selectedJourney ? null : (
                <option value="custom">Edited case</option>
              )}
              {journeys.map((journey) => (
                <option key={journey.key} value={journey.key}>
                  {journey.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-medium">
            Journey checkpoint
            <select
              className="mt-1 w-full rounded-lg border bg-background px-3 py-2"
              value={selectedCheckpoint?.fixtureKey ?? "custom"}
              onChange={(event) => chooseFixture(event.target.value)}
              disabled={!selectedJourney}
            >
              {selectedCheckpoint ? null : (
                <option value="custom">Edited case</option>
              )}
              {selectedJourney?.checkpoints.map((checkpoint) => (
                <option
                  key={checkpoint.fixtureKey}
                  value={checkpoint.fixtureKey}
                >
                  {checkpoint.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="mt-3 grid gap-1 text-sm">
          <p className="font-medium">{selectedJourney?.description}</p>
          <p className="text-muted-foreground">
            {selectedCheckpoint?.description}
          </p>
        </div>
      </section>

      {error ? (
        <p
          role="alert"
          className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive"
        >
          {error}
        </p>
      ) : null}

      {comparison ? (
        <>
          <StudyPlanJourney run={comparison.left} />
          <AdvancedTools
            comparison={comparison}
            fixtureText={fixtureText}
            leftPolicyText={leftPolicyText}
            rightPolicyText={rightPolicyText}
            setFixtureText={setFixtureText}
            setLeftPolicyText={setLeftPolicyText}
            setRightPolicyText={setRightPolicyText}
            validateFixture={validateFixture}
          />
        </>
      ) : (
        <p className="rounded-xl border p-4 text-sm text-muted-foreground">
          Correct the Advanced case JSON to run the preview.
        </p>
      )}
    </main>
  );
}
