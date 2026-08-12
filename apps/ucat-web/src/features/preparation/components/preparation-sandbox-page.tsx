"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { Badge } from "@altitutor/ui";
import { Button } from "@/components/ui/button";
import {
  comparePreparationSandboxCase,
  exportPreparationSandboxCase,
  exportPreparationSandboxComparison,
  PREPARATION_SANDBOX_PERSONAS,
  replayPreparationSandboxCase,
  runPreparationSandboxCase,
  type PreparationSandboxCase,
  type PreparationSandboxPolicy,
  type PreparationSandboxRun,
} from "@/features/preparation/testing/sandbox";

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
  const blob = new Blob([contents], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${key}.preparation-comparison.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function Summary({ run, label }: { run: PreparationSandboxRun; label: string }) {
  const result = run.result;
  return (
    <section className="space-y-4 rounded-2xl border bg-background p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">{label}</h2>
        <Badge variant="secondary">{result.versions.policy}</Badge>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl bg-muted/50 p-3">
          <p className="text-xs text-muted-foreground">Current estimate</p>
          <p className="mt-1 text-2xl font-semibold">
            {result.currentScore.currentEstimate ?? "Pending"}
          </p>
          <p className="text-xs text-muted-foreground">
            {result.currentScore.plausibleRange
              ? `${result.currentScore.plausibleRange.min}–${result.currentScore.plausibleRange.max}`
              : "Insufficient representative evidence"}
          </p>
        </div>
        <div className="rounded-xl bg-muted/50 p-3">
          <p className="text-xs text-muted-foreground">Trajectory</p>
          <p className="mt-1 text-sm font-semibold">
            {result.trajectory.status === "available"
              ? `${result.trajectory.points.at(-1)?.middle ?? "—"} central path`
              : "Withheld"}
          </p>
          <p className="text-xs text-muted-foreground">
            {result.trajectory.status === "available"
              ? `${result.trajectory.coreSectionEquivalentsPerWeek} section-equivalents/week`
              : result.trajectory.reason.replaceAll("_", " ")}
          </p>
        </div>
        <div className="rounded-xl bg-muted/50 p-3">
          <p className="text-xs text-muted-foreground">Capacity</p>
          <p className="mt-1 text-sm font-semibold">
            {result.plan.capacityRisk.level === "warning"
              ? "Risk identified"
              : "Plan fits"}
          </p>
          <p className="text-xs text-muted-foreground">
            {result.plan.capacityRisk.message ?? "No capacity warning."}
          </p>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold">Section assessment</h3>
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          {result.assessment.sections.map((section) => (
            <div key={section.sectionId} className="rounded-xl border p-3 text-sm">
              <div className="flex justify-between gap-2">
                <strong>{section.sectionKey.replaceAll("_", " ")}</strong>
                <span>{section.mode}</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Prescribed pace {section.paceMultiplier.toFixed(1)}× · observed{" "}
                {section.observedPace?.toFixed(1) ?? "—"}×
              </p>
              <p className="mt-2 text-xs">Next: {section.nextMilestone}</p>
            </div>
          ))}
        </div>
      </div>

      {result.plan.contentGaps.length > 0 ? (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3">
          <h3 className="text-sm font-semibold">Development catalog gaps</h3>
          <ul className="mt-2 list-disc pl-5 text-xs">
            {result.plan.contentGaps.map((gap, index) => (
              <li key={`${gap.kind}:${gap.sectionId}:${index}`}>
                {gap.kind} · {gap.sectionId ?? "whole exam"}
                {gap.moduleId ? ` · module ${gap.moduleId}` : ""} · {gap.reason}
                {gap.availableQuestionCount != null
                  ? ` · ${gap.availableQuestionCount}/${gap.requestedQuestionCount} questions available`
                  : ""}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {run.fixture.input.content.learningModules.some(
        (module) =>
          (module.targetedPracticeInventory?.selectedStemIds?.length ?? 0) > 0,
      ) ? (
        <div className="rounded-xl border p-3">
          <h3 className="text-sm font-semibold">Targeted selection diagnostics</h3>
          <ul className="mt-2 space-y-2 text-xs">
            {run.fixture.input.content.learningModules.flatMap((module) => {
              const inventory = module.targetedPracticeInventory;
              if (!inventory?.selectedStemIds?.length) return [];
              return [
                <li key={module.id}>
                  <span className="font-semibold">{module.title}</span> · stems{" "}
                  <span className="font-mono">
                    {inventory.selectedStemIds.join(", ")}
                  </span>
                  {inventory.selectionTrace?.map((item) =>
                    ` · ${item.stemId}: tier ${item.fallbackTier}, ${item.questionCount}q, tags ${item.matchedTagIds.join(",") || "none"}`,
                  )}
                </li>,
              ];
            })}
          </ul>
        </div>
      ) : null}

      <div>
        <h3 className="text-sm font-semibold">21-day plan</h3>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-xs">
            <thead className="text-muted-foreground">
              <tr>
                <th className="pb-2">Date</th>
                <th className="pb-2">Activity</th>
                <th className="pb-2">Practice</th>
                <th className="pb-2">Review</th>
                <th className="pb-2">Bound content</th>
                <th className="pb-2">Reason</th>
              </tr>
            </thead>
            <tbody>
              {run.dailyWork.map((day) => {
                const tasks = result.plan.tasks.filter(
                  (task) => task.scheduledDate === day.date,
                );
                return (
                  <tr key={day.date} className="border-t align-top">
                    <td className="py-2 pr-3 font-mono">{day.date}</td>
                    <td className="py-2 pr-3">
                      {tasks.map((task) => task.title).join(" · ") || "Rest"}
                    </td>
                    <td className="py-2 pr-3">{day.practiceMinutes} min</td>
                    <td className="py-2 pr-3">{day.reviewMinutes} min</td>
                    <td className="py-2 pr-3 font-mono">
                      {tasks
                        .flatMap((task) => task.questionSetId ?? task.mockId ?? [])
                        .join(" · ") || "—"}
                    </td>
                    <td className="max-w-sm py-2 text-muted-foreground">
                      {tasks[0]?.rationale ?? "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <details>
        <summary className="cursor-pointer text-sm font-semibold">
          Full policy and reason trace ({result.explanationTrace.length})
        </summary>
        <pre className="mt-2 max-h-96 overflow-auto rounded-xl bg-muted/50 p-3 text-xs">
          {JSON.stringify(result.explanationTrace, null, 2)}
        </pre>
      </details>
    </section>
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
      const result = comparePreparationSandboxCase(fixture, policies);
      return { fixture, policies, ...result };
    } catch {
      return null;
    }
  }, [deferredFixtureText, deferredLeftPolicyText, deferredRightPolicyText]);

  function choosePersona(key: string) {
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
    <main className="mx-auto min-h-screen w-full max-w-[1600px] space-y-6 p-4 sm:p-6 lg:p-8">
      <header className="space-y-2">
        <Badge>Development only · no Student writes</Badge>
        <h1 className="text-3xl font-semibold">UCAT Preparation policy laboratory</h1>
        <p className="max-w-4xl text-sm text-muted-foreground">
          Edit a versioned canonical engine case, compare the same evidence and seed,
          inspect every output, then export the exact case as a replayable regression fixture.
        </p>
      </header>

      <section className="grid gap-4 rounded-2xl border bg-muted/20 p-4 lg:grid-cols-[240px_minmax(0,1fr)]">
        <div className="space-y-4">
          <label className="block text-sm font-medium">
            Persona
            <select
              className="mt-1 w-full rounded-lg border bg-background px-3 py-2"
              value={comparison?.fixture.key ?? ""}
              onChange={(event) => choosePersona(event.target.value)}
            >
              {personas.map((persona) => (
                <option key={persona.key} value={persona.key}>
                  {persona.label}
                </option>
              ))}
            </select>
          </label>
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
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={validateFixture}>Run case</Button>
            <Button
              type="button"
              variant="outline"
              disabled={!comparison}
              onClick={() =>
                comparison &&
                downloadFixture(
                  exportPreparationSandboxComparison({
                    fixture: comparison.fixture,
                    policies: comparison.policies,
                  }),
                  comparison.fixture.key,
                )
              }
            >
              Export JSON
            </Button>
          </div>
        </div>

        <label className="block text-sm font-medium">
          Replayable case JSON
          <textarea
            className="mt-1 min-h-[360px] w-full rounded-xl border bg-background p-3 font-mono text-xs"
            spellCheck={false}
            value={fixtureText}
            onChange={(event) => setFixtureText(event.target.value)}
          />
          <span className="mt-1 block text-xs text-muted-foreground">
            Dates, availability, targets, SJT, section evidence, pace, adherence,
            timing profile, seed and all model/policy versions are editable here.
          </span>
        </label>
      </section>

      {error ? (
        <p role="alert" className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {comparison ? (
        <div className="grid gap-6 2xl:grid-cols-2">
          <Summary run={comparison.left} label="Control" />
          <Summary run={comparison.right} label="Candidate" />
        </div>
      ) : (
        <p className="rounded-xl border p-4 text-sm text-muted-foreground">
          Correct the case JSON to run the comparison.
        </p>
      )}
    </main>
  );
}
