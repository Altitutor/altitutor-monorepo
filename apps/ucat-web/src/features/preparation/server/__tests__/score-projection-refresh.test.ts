import { refreshStudentScoreProjection } from "@/features/preparation/server/score-projection-refresh";
import { persistPreparationProjectionSnapshot } from "@/features/preparation/server/preparation-snapshot";

const mockFrom = jest.fn();
const mockRpc = jest.fn();

jest.mock("server-only", () => ({}));
jest.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: {
    from: (...args: unknown[]) => mockFrom(...args),
    rpc: (...args: unknown[]) => mockRpc(...args),
  },
}));
jest.mock("@/features/preparation/server/preparation-snapshot", () => ({
  persistPreparationProjectionSnapshot: jest.fn(),
}));

const mockPersistPreparationProjectionSnapshot = jest.mocked(
  persistPreparationProjectionSnapshot,
);

describe("refreshStudentScoreProjection", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date("2026-08-25T12:00:00.000Z"));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("loads only bounded score evidence and snapshot history before persisting", async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === "students") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: { timezone: "Australia/Adelaide" },
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === "ucat_sections") {
        return {
          select: () => ({
            order: async () => ({
              data: [
                ["section-vr", "Verbal Reasoning", 1, 44, 47],
                ["section-dm", "Decision Making", 2, 47, 64],
                ["section-qr", "Quantitative Reasoning", 3, 36, 42],
              ].map(([id, name, sectionNumber, questions, seconds]) => ({
                id,
                name,
                section_number: sectionNumber,
                number_of_questions: questions,
                time_per_question: seconds,
              })),
              error: null,
            }),
          }),
        };
      }
      if (table === "ucat_preparation_snapshots") {
        return {
          select: () => ({
            eq: () => ({
              order: () => ({
                limit: async () => ({ data: [], error: null }),
              }),
            }),
          }),
        };
      }
      throw new Error(`Unexpected table read: ${table}`);
    });
    mockRpc.mockResolvedValue({
      data: [
        ["vr", 1, 44],
        ["dm", 2, 47],
        ["qr", 3, 36],
      ].map(([key, sectionNumber, questionCount]) => ({
        evidence_session_id: `set-${key}`,
        source: "set",
        section_id: `section-${key}`,
        section_number: sectionNumber,
        completed_at: "2026-08-24T12:00:00.000Z",
        score_points: Number(questionCount) * 0.75,
        total_points: questionCount,
        question_count: questionCount,
        section_question_count: questionCount,
        section_category_count: 4,
        was_timed: true,
        prescribed_pace: 1,
        observed_pace: 1,
        breadth: "broad",
        category_ids: [`category-${key}`],
        feedback_withheld: true,
        is_student_generated: false,
      })),
      error: null,
    });

    await refreshStudentScoreProjection("student-1");

    expect(mockFrom.mock.calls.map(([table]) => table)).toEqual([
      "students",
      "ucat_sections",
      "ucat_preparation_snapshots",
    ]);
    expect(mockRpc).toHaveBeenCalledWith(
      "get_student_ucat_score_projection_evidence",
      { p_student_id: "student-1" },
    );
    expect(mockPersistPreparationProjectionSnapshot).toHaveBeenCalledWith(
      "student-1",
      "2026-08-25",
      expect.objectContaining({
        currentScore: expect.objectContaining({ status: "available" }),
        trajectory: expect.objectContaining({
          status: "available",
          doseSource: "recent_behavior",
          plannedCoreSectionEquivalentsPerWeek: 0,
          expectedPlanUptake: 0,
        }),
      }),
    );
  });
});
