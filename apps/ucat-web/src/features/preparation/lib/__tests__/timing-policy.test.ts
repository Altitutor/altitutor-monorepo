import { assessTimingPolicy } from "@/features/preparation/lib/timing-policy";
import type {
  StudyPlanProfileInput,
  StudyPlanSection,
  StudyPlanSectionSignal,
  StudyPlanTimingBreadth,
  StudyPlanTimingEvidenceSession,
} from "@/features/study-plan/model/types";

const section: StudyPlanSection = {
  id: "dm",
  key: "decision_making",
  name: "Decision Making",
  shortName: "DM",
  sectionNumber: 2,
  questionCount: 35,
  timePerQuestionSeconds: 64,
};

const profile: StudyPlanProfileInput = {
  studyPlanEnabled: true,
  targetScore: 2200,
  testYear: 2026,
  testDate: "2026-08-05",
  availableDays: [
    { weekday: 1, maxMinutes: 60 },
    { weekday: 3, maxMinutes: 60 },
    { weekday: 6, maxMinutes: 60 },
  ],
  preferredMockWeekday: 6,
};

function signal(
  overrides: Partial<StudyPlanSectionSignal> = {},
): StudyPlanSectionSignal {
  return {
    sectionId: section.id,
    currentEstimate: 650,
    evidenceCount: 5,
    completedFullSets: 1,
    recentAccuracy: 0.76,
    observedPace: 0.5,
    learningGraduatedAt: "2026-01-01T00:00:00.000Z",
    learningGraduationRoute: "accuracy",
    prescribedPace: 0.5,
    prescribedPaceSetAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function session(
  id: string,
  overrides: Partial<StudyPlanTimingEvidenceSession> = {},
): StudyPlanTimingEvidenceSession {
  return {
    id,
    sectionId: section.id,
    source: "practice",
    completedAt: `2026-01-${String(Number(id.replace(/\D/g, "")) + 2).padStart(2, "0")}T00:00:00.000Z`,
    prescribedPace: 0.5,
    observedPace: 0.5,
    accuracy: 0.75,
    sectionEquivalents: 0.34,
    breadth: "broad",
    categoryIds: ["a", "b"],
    ...overrides,
  };
}

function assess(input: {
  signal?: StudyPlanSectionSignal;
  sessions?: StudyPlanTimingEvidenceSession[];
  availableDays?: StudyPlanProfileInput["availableDays"];
  today?: string;
  planningDate?: string;
}) {
  return assessTimingPolicy({
    today: input.today ?? "2026-02-01",
    planningDate: input.planningDate ?? "2026-08-05",
    profile: {
      ...profile,
      availableDays: input.availableDays ?? profile.availableDays,
    },
    section,
    signal: input.signal ?? signal(),
    sessions: input.sessions ?? [],
    canPersistPace: true,
  });
}

describe("Timing policy", () => {
  it("places fast but inaccurate natural work below 1.0x", () => {
    const result = assess({
      signal: signal({
        prescribedPace: null,
        prescribedPaceSetAt: null,
        observedPace: 1.3,
        recentAccuracy: 0.42,
      }),
    });

    expect(result.prescribedPace).toBe(0.8);
    expect(result.decisionCode).toBe("timing.initial_placement");
  });

  it("advances one rung from repeated broad evidence with preserved accuracy", () => {
    const result = assess({
      sessions: [session("1"), session("2"), session("3")],
    });

    expect(result).toMatchObject({
      prescribedPace: 0.6,
      decisionCode: "timing.advance_normal",
      broadSectionEquivalents: 1.02,
    });
  });

  it("does not let narrow strength carry a section rung", () => {
    const narrow = (id: string) =>
      session(id, {
        breadth: "narrow" as StudyPlanTimingBreadth,
        accuracy: 0.95,
        sectionEquivalents: 0.5,
        categoryIds: ["strong-category"],
      });
    const result = assess({
      sessions: [narrow("1"), narrow("2"), narrow("3"), narrow("4")],
    });

    expect(result.prescribedPace).toBe(0.5);
    expect(result.broadSectionEquivalents).toBe(0);
    expect(result.effectiveSectionEquivalents).toBe(0.25);
  });

  it("holds rather than demoting after inaccurate sessions", () => {
    const result = assess({
      signal: signal({ prescribedPace: 0.7, recentAccuracy: 0.78 }),
      sessions: [
        session("1", { prescribedPace: 0.7, accuracy: 0.5 }),
        session("2", { prescribedPace: 0.7, accuracy: 0.52 }),
        session("3", { prescribedPace: 0.7, accuracy: 0.48 }),
      ],
    });

    expect(result).toMatchObject({
      prescribedPace: 0.7,
      decisionCode: "timing.hold_accuracy",
    });
  });

  it("accelerates to 1.0x after two consistent strong representative results", () => {
    const result = assess({
      sessions: [
        session("1", {
          source: "set",
          prescribedPace: 1,
          observedPace: 1,
          accuracy: 0.82,
          sectionEquivalents: 0.5,
        }),
        session("2", {
          source: "mock",
          prescribedPace: 1,
          observedPace: 1,
          accuracy: 0.78,
          sectionEquivalents: 0.5,
        }),
      ],
    });

    expect(result).toMatchObject({
      prescribedPace: 1,
      decisionCode: "timing.advance_accelerated_1x",
      overspeedEligible: true,
      overspeedPace: 1.1,
    });
  });

  it("allows up to 1.3x targeted overspeed after repeated strong 1.0x work", () => {
    const result = assess({
      signal: signal({ prescribedPace: 1 }),
      sessions: Array.from({ length: 6 }, (_, index) =>
        session(String(index + 1), {
          source: "set",
          prescribedPace: 1,
          observedPace: 1,
          accuracy: 0.8,
          sectionEquivalents: 0.2,
        }),
      ),
    });

    expect(result).toMatchObject({
      prescribedPace: 1,
      overspeedEligible: true,
      overspeedPace: 1.3,
    });
  });

  it("uses deadline pressure for one gradual rung and reports constrained capacity", () => {
    const result = assess({
      signal: signal({ prescribedPaceSetAt: "2026-01-01T00:00:00.000Z" }),
      sessions: [],
      availableDays: [{ weekday: 6, maxMinutes: 60 }],
      today: "2026-05-01",
      planningDate: "2026-08-05",
    });

    expect(result).toMatchObject({
      prescribedPace: 0.6,
      decisionCode: "timing.advance_deadline",
      capacityConstrained: true,
    });
  });

  it("requires intervening targeted dose before stale calibration becomes due", () => {
    const representative = session("1", {
      source: "set",
      completedAt: "2026-01-01T00:00:00.000Z",
      sectionEquivalents: 1,
    });
    const staleOnly = assess({ sessions: [representative] });
    const staleWithDose = assess({
      sessions: [
        representative,
        session("2", {
          completedAt: "2026-01-20T00:00:00.000Z",
          breadth: "narrow",
          sectionEquivalents: 0.5,
        }),
      ],
    });

    expect(staleOnly.calibrationDue).toBe(false);
    expect(staleWithDose.calibrationDue).toBe(true);
  });
});
