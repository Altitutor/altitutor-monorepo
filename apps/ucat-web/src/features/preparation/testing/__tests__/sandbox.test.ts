import {
  comparePreparationSandboxCase,
  exportPreparationSandboxCase,
  exportPreparationSandboxComparison,
  PREPARATION_SANDBOX_PERSONAS,
  PREPARATION_SANDBOX_JOURNEYS,
  replayPreparationSandboxCase,
  replayPreparationSandboxComparison,
  runPreparationSandboxCase,
  type PreparationSandboxCase,
} from "@/features/preparation/testing/sandbox";

const REQUIRED_PERSONAS = [
  "new-student",
  "learning-progressing",
  "benchmark-ready",
  "recommended-learning",
  "experienced-high-performing",
  "accurate-slow",
  "fast-inaccurate",
  "uneven-sections",
  "calibration-due",
  "low-availability",
  "imminent-exam",
] as const;

describe("Preparation policy sandbox", () => {
  it("groups every release persona into a human-readable journey checkpoint", () => {
    const checkpointKeys = PREPARATION_SANDBOX_JOURNEYS.flatMap((journey) =>
      journey.checkpoints.map((checkpoint) => checkpoint.fixtureKey),
    );

    expect(checkpointKeys.sort()).toEqual([...REQUIRED_PERSONAS].sort());
    expect(
      PREPARATION_SANDBOX_JOURNEYS.find(
        (journey) => journey.key === "foundations",
      )?.checkpoints.map((checkpoint) => checkpoint.fixtureKey),
    ).toEqual([
      "new-student",
      "learning-progressing",
      "benchmark-ready",
      "recommended-learning",
    ]);
  });

  it("ships every release persona as a complete canonical regression fixture", () => {
    expect(Object.keys(PREPARATION_SANDBOX_PERSONAS).sort()).toEqual(
      [...REQUIRED_PERSONAS].sort(),
    );

    for (const key of REQUIRED_PERSONAS) {
      const fixture = PREPARATION_SANDBOX_PERSONAS[key];
      const run = runPreparationSandboxCase(fixture);

      expect(run.result.seed).toBe(fixture.input.seed);
      expect(run.result.plan.tasks.length).toBeGreaterThan(0);
      expect(run.result.assessment.sections).toHaveLength(3);
      expect(run.dailyWork).toHaveLength(21);
      expect(run.dailyWork.every((day) => day.practiceMinutes >= 0)).toBe(true);
      expect(run.dailyWork.every((day) => day.reviewMinutes >= 0)).toBe(true);
      expect(run.result.explanationTrace.length).toBeGreaterThan(4);
      expect(
        run.result.explanationTrace.filter(
          (trace) => typeof trace.details.candidateId === "string",
        ),
      ).toHaveLength(run.result.activityCandidates.length);
    }
  });

  it("exports stable JSON that replays to the identical canonical result", () => {
    const fixture = PREPARATION_SANDBOX_PERSONAS["uneven-sections"];
    const exported = exportPreparationSandboxCase(fixture);
    const replayed = replayPreparationSandboxCase(exported);

    expect(exported).toBe(exportPreparationSandboxCase(fixture));
    expect(replayed.fixture).toEqual(fixture);
    expect(replayed.result).toEqual(runPreparationSandboxCase(fixture).result);
  });

  it("compares policy versions with identical evidence, clock and seed", () => {
    const fixture = PREPARATION_SANDBOX_PERSONAS["accurate-slow"];
    const policies = {
      left: {
        versions: {
          ...fixture.input.versions,
          policy: "preparation-policy-control-v1",
        },
        timingProfile: fixture.input.timingProfile,
      },
      right: {
        versions: {
          ...fixture.input.versions,
          policy: "preparation-policy-candidate-v2",
        },
        timingProfile: {
          ...fixture.input.timingProfile,
          id: "candidate-accessible-timing",
          version: "candidate-accessible-timing-v1",
          defaultTimeMultiplier: 1.5,
        },
      },
    };
    const comparison = comparePreparationSandboxCase(fixture, policies);

    expect(comparison.left.fixture.input.seed).toBe(
      comparison.right.fixture.input.seed,
    );
    expect(comparison.left.fixture.input.clock).toEqual(
      comparison.right.fixture.input.clock,
    );
    expect(comparison.left.fixture.input.content).toEqual(
      comparison.right.fixture.input.content,
    );
    expect(comparison.left.fixture.input.evidence).toEqual(
      comparison.right.fixture.input.evidence,
    );
    expect(comparison.left.result.versions.policy).toBe(
      "preparation-policy-control-v1",
    );
    expect(comparison.right.result.versions.policy).toBe(
      "preparation-policy-candidate-v2",
    );
    expect(comparison.left.fixture.input.timingProfile).not.toEqual(
      comparison.right.fixture.input.timingProfile,
    );
    expect(comparison.left.result.timingProfile).not.toEqual(
      comparison.right.result.timingProfile,
    );

    const exported = exportPreparationSandboxComparison({
      fixture,
      policies,
    });
    const replayed = replayPreparationSandboxComparison(exported);
    expect(replayed.left.result).toEqual(comparison.left.result);
    expect(replayed.right.result).toEqual(comparison.right.result);
  });

  it("reports canonical practice and review duration splits for mock days", () => {
    const run = runPreparationSandboxCase(
      PREPARATION_SANDBOX_PERSONAS["imminent-exam"],
    );

    expect(
      run.dailyWork.some(
        (day) =>
          day.practiceMinutes === 120 &&
          day.reviewMinutes >= 10 &&
          day.reviewMinutes <= 20,
      ),
    ).toBe(true);
  });

  it("counts derived non-mock review work exactly once", () => {
    const run = runPreparationSandboxCase(
      PREPARATION_SANDBOX_PERSONAS["new-student"],
    );
    const date = run.result.plan.tasks.find(
      (task) => task.taskType === "review",
    )?.scheduledDate;
    expect(date).toBeDefined();
    const reviewTasks = run.result.plan.tasks.filter(
      (task) => task.scheduledDate === date && task.taskType === "review",
    );
    const displayed = run.dailyWork.find((day) => day.date === date);

    expect(displayed?.reviewMinutes).toBe(
      reviewTasks.reduce((sum, task) => sum + task.estimatedMinutes, 0),
    );
  });

  it("gives a new student coherent Learning loops instead of isolated lessons", () => {
    const run = runPreparationSandboxCase(
      PREPARATION_SANDBOX_PERSONAS["new-student"],
    );
    const tasksByDate = Map.groupBy(
      run.result.plan.tasks,
      (task) => task.scheduledDate,
    );

    for (const lesson of run.result.plan.tasks.filter(
      (task) => task.taskType === "learn",
    )) {
      const tasks = tasksByDate.get(lesson.scheduledDate) ?? [];
      expect(
        tasks.some(
          (task) =>
            task.taskType === "practice" && task.sectionId === lesson.sectionId,
        ),
      ).toBe(true);
      expect(
        tasks.some(
          (task) =>
            task.taskType === "review" && task.sectionId === lesson.sectionId,
        ),
      ).toBe(true);
    }
    expect(
      run.result.plan.tasks
        .filter((task) => task.taskType === "learn")
        .every((task) => task.estimatedMinutes <= 20),
    ).toBe(true);
  });

  it("shows ordered daily Learning loops followed by predefined section diagnostics", () => {
    const run = runPreparationSandboxCase(
      PREPARATION_SANDBOX_PERSONAS["new-student"],
    );
    const learningTasks = run.result.plan.tasks.filter(
      (task) => task.taskType === "learn",
    );

    expect(
      learningTasks.slice(0, 3).map((task) => ({
        date: task.scheduledDate,
        moduleId: task.learningModuleId,
      })),
    ).toEqual([
      { date: "2026-01-05", moduleId: "module-vr-1" },
      { date: "2026-01-07", moduleId: "module-dm-1" },
      { date: "2026-01-10", moduleId: "module-qr-1" },
    ]);
    expect(
      run.result.plan.tasks
        .filter(
          (task) =>
            task.taskType === "practice" &&
            task.launchConfig.linkedLearningPractice === true,
        )
        .slice(0, 3)
        .map((task) => task.targetUnits),
    ).toEqual([27, 21, 22]);
    expect(
      run.result.plan.tasks.some(
        (task) =>
          task.taskType === "section_benchmark" && task.questionSetId != null,
      ),
    ).toBe(true);
  });

  it("warns only the release persona with too few selected study days", () => {
    for (const key of REQUIRED_PERSONAS) {
      const run = runPreparationSandboxCase(PREPARATION_SANDBOX_PERSONAS[key]);
      expect(run.result.plan.capacityRisk.level).toBe(
        key === "low-availability" ? "warning" : "none",
      );
    }
  });

  it("does not prescribe lessons to experienced release personas", () => {
    for (const key of [
      "experienced-high-performing",
      "accurate-slow",
      "fast-inaccurate",
      "uneven-sections",
      "imminent-exam",
      "calibration-due",
    ] as const) {
      const run = runPreparationSandboxCase(PREPARATION_SANDBOX_PERSONAS[key]);
      expect(
        run.result.plan.tasks.some((task) => task.taskType === "learn"),
      ).toBe(false);
    }
  });

  it("shows both recommended-learning and evidence-triggered calibration branches", () => {
    const recommended = runPreparationSandboxCase(
      PREPARATION_SANDBOX_PERSONAS["recommended-learning"],
    );
    expect(
      recommended.result.plan.tasks.some(
        (task) =>
          task.taskType === "learn" &&
          task.learningModuleId?.endsWith("-4") === true,
      ),
    ).toBe(true);

    const calibration = runPreparationSandboxCase(
      PREPARATION_SANDBOX_PERSONAS["calibration-due"],
    );
    expect(
      calibration.result.plan.tasks.some(
        (task) => task.taskType === "section_benchmark",
      ),
    ).toBe(true);
  });

  it("accepts editable dates, availability, target, SJT, evidence, pace, adherence and versions", () => {
    const base = PREPARATION_SANDBOX_PERSONAS["new-student"];
    const fixture = JSON.parse(
      exportPreparationSandboxCase(base),
    ) as PreparationSandboxCase;
    fixture.input.clock = {
      today: "2026-05-04",
      now: "2026-05-04T00:00:00.000Z",
    };
    fixture.input.goal.planningDate = "2026-07-06";
    fixture.input.goal.profile = {
      ...fixture.input.goal.profile,
      targetScore: 2500,
      testDate: "2026-07-06",
      availableDays: [{ weekday: 6 }],
      preferredMockWeekday: 6,
      sjtPreference: "not_at_all",
    };
    fixture.input.evidence.sectionSignals[0] = {
      ...fixture.input.evidence.sectionSignals[0]!,
      attemptedQuestionCount: 44,
      recentAccuracy: 0.8,
      observedPace: 1.1,
      prescribedPace: 0.9,
    };
    fixture.input.evidence.forecast = {
      expectedAdherence: 0.55,
      adherenceUncertainty: 0.3,
    };
    fixture.input.versions = {
      ...fixture.input.versions,
      policy: "editable-policy-v7",
    };

    const run = runPreparationSandboxCase(fixture);

    expect(run.result.versions.policy).toBe("editable-policy-v7");
    expect(run.result.assessment.daysUntilExam).toBe(63);
    expect(run.result.assessment.sections[0]).toMatchObject({
      observedPace: 1.1,
    });
    expect(run.result.plan.tasks.some((task) => task.sectionId === "sjt")).toBe(
      false,
    );
  });
});
