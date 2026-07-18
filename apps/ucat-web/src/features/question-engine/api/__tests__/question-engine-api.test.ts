import { getQuestionEngineExam } from "../question-engine-api";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

jest.mock("@/lib/supabase/client", () => ({
  getSupabaseBrowserClient: jest.fn(),
}));

const mockedClient = jest.mocked(getSupabaseBrowserClient);

describe("getQuestionEngineExam", () => {
  it("loads a complete mock in one RPC", async () => {
    const rpc = jest.fn(async () => ({
      data: {
        source_type: "mock",
        mock_detail: {
          id: "mock-1",
          name: "Mock 1",
          instructions_text: null,
          sets: [1, 2, 3, 4].map((index) => ({ id: `set-${index}` })),
        },
        sets: [1, 2, 3, 4].map((index) => ({
          set_detail: {
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
          },
          stem_details: [
            {
              id: `stem-${index}`,
              section_name: "Verbal Reasoning",
              display_columns: 1,
              section_instructions_text: null,
              section_instructions_time_limit_seconds: null,
              section_time_limit_seconds: null,
              stem_text: null,
              questions: [],
            },
          ],
        })),
      },
      error: null,
    }));
    mockedClient.mockReturnValue({ rpc } as never);

    const exam = await getQuestionEngineExam({
      mode: "mock",
      mockId: "mock-1",
    });

    expect(exam.mockSetSummaries).toHaveLength(4);
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith(
      "get_student_ucat_question_engine_payload",
      { p_source_type: "mock", p_source_id: "mock-1" },
    );
  });
});
