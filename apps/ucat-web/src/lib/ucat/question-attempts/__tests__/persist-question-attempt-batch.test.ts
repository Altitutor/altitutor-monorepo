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
  it("persists practice attempts with one atomic RPC", async () => {
    const rpc = jest.fn().mockResolvedValue({ data: 2, error: null });

    await persistQuestionAttemptBatch(
      { rpc } as never,
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

    expect(rpc).toHaveBeenCalledWith(
      "upsert_ucat_question_attempt_batch",
      expect.objectContaining({
        p_student_id: "student-1",
        p_student_question_set_attempt_id: null,
        p_student_practice_session_id: "session-1",
        p_attempts: [
          expect.objectContaining({
            question_id: "question-1",
            question_answer_option_id: "option-1",
            is_submitted: true,
            score: 1,
            has_score: true,
          }),
          expect.objectContaining({
            question_id: "question-2",
            is_flagged: true,
            has_is_flagged: true,
            is_submitted: true,
            score: 0,
          }),
        ],
      }),
    );
  });

  it("persists set attempts with the parent/question UPSERT key", async () => {
    const rpc = jest.fn().mockResolvedValue({ data: 1, error: null });

    await persistQuestionAttemptBatch(
      { rpc } as never,
      "student-1",
      {
        studentQuestionSetAttemptId: "set-attempt-1",
        studentPracticeSessionId: null,
        learningModuleBlockId: null,
      },
      [
        {
          questionId: "question-1",
          questionAnswerOptionId: "option-1",
          submittedByStem: true,
        },
      ],
    );

    expect(rpc).toHaveBeenCalledWith(
      "upsert_ucat_question_attempt_batch",
      expect.objectContaining({
        p_student_question_set_attempt_id: "set-attempt-1",
        p_student_practice_session_id: null,
        p_attempts: [
          expect.objectContaining({
            question_id: "question-1",
            is_submitted: true,
          }),
        ],
      }),
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

  it("uses client timing as a completion fallback without reducing server timing", async () => {
    const rpc = jest.fn().mockResolvedValue({ data: 2, error: null });

    await persistQuestionAttemptBatch(
      { rpc } as never,
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
          timeSpentMilliseconds: 3900,
        },
        {
          questionId: "question-2",
          questionAnswerOptionId: "option-2",
          timeSpentMilliseconds: 1000,
        },
      ],
    );

    expect(rpc).toHaveBeenCalledWith(
      "upsert_ucat_question_attempt_batch",
      expect.objectContaining({
        p_attempts: [
          expect.objectContaining({
            question_id: "question-1",
            time_spent_milliseconds: 3900,
            has_time_spent_milliseconds: true,
          }),
          expect.objectContaining({
            question_id: "question-2",
            time_spent_milliseconds: 1000,
            has_time_spent_milliseconds: true,
          }),
        ],
      }),
    );
  });
});
