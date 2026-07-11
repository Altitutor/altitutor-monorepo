import { getQuestionEngineExam } from "../question-engine-api";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

jest.mock("@/lib/supabase/client", () => ({
  getSupabaseBrowserClient: jest.fn(),
}));

const mockedClient = jest.mocked(getSupabaseBrowserClient);

describe("getQuestionEngineExam", () => {
  it("bulk loads mock sets and stems", async () => {
    const from = jest.fn((table: string) => ({
      select: jest.fn(() => {
        if (table === "vstudent_ucat_mock_detail") {
          return {
            eq: jest.fn(() => ({
              maybeSingle: jest.fn(async () => ({
                data: {
                  id: "mock-1",
                  name: "Mock 1",
                  instructions_text: null,
                  sets: [
                    { id: "set-1" },
                    { id: "set-2" },
                    { id: "set-3" },
                    { id: "set-4" },
                  ],
                },
                error: null,
              })),
            })),
          };
        }
        if (table === "vstudent_ucat_question_set_detail") {
          return {
            in: jest.fn(async () => ({
              data: [1, 2, 3, 4].map((index) => ({
                id: `set-${index}`,
                name: `Set ${index}`,
                description: null,
                time_limit_seconds: 120,
                stems: [
                  {
                    stem_id: `stem-${index}`,
                    stem_text: null,
                    questions_meta: [],
                  },
                ],
              })),
              error: null,
            })),
          };
        }
        return {
          in: jest.fn(async () => ({
            data: [1, 2, 3, 4].map((index) => ({
              id: `stem-${index}`,
              section_name: "Verbal Reasoning",
              display_columns: 1,
              section_instructions_text: null,
              section_instructions_time_limit_seconds: null,
              section_time_limit_seconds: null,
              stem_text: null,
              questions: [],
            })),
            error: null,
          })),
        };
      }),
    }));
    mockedClient.mockReturnValue({ from } as never);

    const exam = await getQuestionEngineExam({
      mode: "mock",
      mockId: "mock-1",
    });

    expect(exam.mockSetSummaries).toHaveLength(4);
    expect(from).toHaveBeenCalledTimes(3);
    expect(from.mock.calls.map(([table]) => table)).toEqual([
      "vstudent_ucat_mock_detail",
      "vstudent_ucat_question_set_detail",
      "vstudent_ucat_question_stem_detail",
    ]);
  });
});
