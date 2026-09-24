import { getQuestionEngineExam } from "../question-engine-api";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

jest.mock("@/lib/supabase/client", () => ({
  getSupabaseBrowserClient: jest.fn(),
}));

const mockedClient = jest.mocked(getSupabaseBrowserClient);

describe("getQuestionEngineExam", () => {
  it("loads mock metadata once and bounded set payloads independently", async () => {
    const rpc = jest.fn(
      async (_functionName: string, input: { p_set_id: string }) => {
        const index = Number(input.p_set_id.replace("set-", ""));
        return {
          data: {
            source_type: "set",
            set_detail: {
              id: input.p_set_id,
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
          },
          error: null,
        };
      },
    );
    const mockQuery = {
      select: jest.fn(),
      eq: jest.fn(),
      maybeSingle: jest.fn(async () => ({
        data: {
          id: "mock-1",
          name: "Mock 1",
          instructions_text: null,
          sets: [1, 2, 3, 4].map((index) => ({ id: `set-${index}` })),
        },
        error: null,
      })),
    };
    mockQuery.select.mockReturnValue(mockQuery);
    mockQuery.eq.mockReturnValue(mockQuery);
    const from = jest.fn(() => mockQuery);
    mockedClient.mockReturnValue({ from, rpc } as never);

    const exam = await getQuestionEngineExam({
      mode: "mock",
      mockId: "mock-1",
    });

    expect(exam.mockSetSummaries).toHaveLength(4);
    expect(from).toHaveBeenCalledWith("vstudent_ucat_mock_detail");
    expect(rpc).toHaveBeenCalledTimes(4);
    expect(rpc).not.toHaveBeenCalledWith(
      "get_student_ucat_question_engine_payload",
      { p_source_type: "mock", p_source_id: "mock-1" },
    );
    expect(rpc).toHaveBeenCalledWith(
      "get_student_ucat_question_set_engine_payload",
      { p_set_id: "set-1" },
    );
  });
});
