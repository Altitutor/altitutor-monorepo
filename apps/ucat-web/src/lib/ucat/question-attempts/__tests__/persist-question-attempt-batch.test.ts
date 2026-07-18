import { persistQuestionAttemptBatch } from "@/lib/ucat/question-attempts/persist-question-attempt-batch";

function thenableQuery(result: unknown) {
  const query: Record<
    string,
    jest.Mock | ((resolve: (value: unknown) => void) => void)
  > = {
    select: jest.fn(() => query),
    eq: jest.fn(() => query),
    in: jest.fn(() => query),
    is: jest.fn(() => query),
    then: (resolve: (value: unknown) => void) => resolve(result),
  };
  return query;
}

describe("persistQuestionAttemptBatch", () => {
  it("updates existing attempts and inserts new attempts in two bulk writes", async () => {
    const selectQuery = thenableQuery({
      data: [{ id: "attempt-1", question_id: "question-1" }],
      error: null,
    });
    const updateUpsert = jest.fn().mockResolvedValue({ error: null });
    const insertUpsert = jest.fn().mockResolvedValue({ error: null });
    const from = jest
      .fn()
      .mockReturnValueOnce(selectQuery)
      .mockReturnValueOnce({ upsert: updateUpsert })
      .mockReturnValueOnce({ upsert: insertUpsert });

    await persistQuestionAttemptBatch(
      { from } as never,
      "student-1",
      {
        studentQuestionSetAttemptId: null,
        studentPracticeSessionId: "session-1",
        learningModuleBlockId: null,
      },
      [
        {
          questionId: "question-1",
          questionAnswerOptionId: "option-1",
          submittedByStem: true,
          score: 1,
        },
        {
          questionId: "question-2",
          questionAnswerOptionId: null,
          answerSnapshot: { type: "syllogism_v1", answers: [] },
          isFlagged: true,
          submittedByStem: true,
          score: 0,
        },
      ],
    );

    expect(from).toHaveBeenCalledTimes(3);
    expect(updateUpsert).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          id: "attempt-1",
          question_id: "question-1",
          question_answer_option_id: "option-1",
          is_submitted: true,
          score: 1,
        }),
      ],
      { onConflict: "id" },
    );
    expect(insertUpsert).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          student_id: "student-1",
          student_question_set_attempt_id: null,
          student_practice_session_id: "session-1",
          question_id: "question-2",
          is_flagged: true,
          is_submitted: true,
          score: 0,
        }),
      ],
      { onConflict: "student_practice_session_id,question_id" },
    );
  });

  it("keeps only the latest value for duplicate question inputs", async () => {
    const selectQuery = thenableQuery({ data: [], error: null });
    const upsert = jest.fn().mockResolvedValue({ error: null });
    const from = jest
      .fn()
      .mockReturnValueOnce(selectQuery)
      .mockReturnValueOnce({ upsert });

    await persistQuestionAttemptBatch(
      { from } as never,
      "student-1",
      {
        studentQuestionSetAttemptId: null,
        studentPracticeSessionId: null,
        learningModuleBlockId: null,
      },
      [
        { questionId: "question-1", questionAnswerOptionId: "old" },
        { questionId: "question-1", questionAnswerOptionId: "new" },
      ],
    );

    expect(upsert).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          question_id: "question-1",
          question_answer_option_id: "new",
        }),
      ],
      { onConflict: "id" },
    );
  });
});
