import { findUndeliveredPracticeQuestionIds } from "@/lib/ucat/practice-sessions/authorize-delivered-questions";

describe("findUndeliveredPracticeQuestionIds", () => {
  it("authorizes rich snapshots without querying canonical questions", async () => {
    const from = jest.fn();

    await expect(
      findUndeliveredPracticeQuestionIds(
        { from } as never,
        [
          {
            id: "stem-1",
            questions: [{ id: "question-1" }, { id: "question-2" }],
          },
        ],
        ["question-1", "question-2"],
      ),
    ).resolves.toEqual([]);
    expect(from).not.toHaveBeenCalled();
  });

  it("authorizes a question by canonical membership in a delivered stem", async () => {
    const query = {
      select: jest.fn(),
      in: jest.fn(),
      is: jest.fn(),
    };
    query.select.mockReturnValue(query);
    query.in.mockReturnValue(query);
    query.is.mockResolvedValue({
      data: [{ id: "question-1", question_stem_id: "stem-1" }],
      error: null,
    });
    const from = jest.fn().mockReturnValue(query);

    await expect(
      findUndeliveredPracticeQuestionIds(
        { from } as never,
        [{ id: "stem-1" }],
        ["question-1"],
      ),
    ).resolves.toEqual([]);
    expect(from).toHaveBeenCalledWith("ucat_questions");
    expect(query.in).toHaveBeenCalledWith("id", ["question-1"]);
    expect(query.is).toHaveBeenCalledWith("deleted_at", null);
  });

  it("rejects questions whose canonical stem was not delivered", async () => {
    const query = {
      select: jest.fn(),
      in: jest.fn(),
      is: jest.fn(),
    };
    query.select.mockReturnValue(query);
    query.in.mockReturnValue(query);
    query.is.mockResolvedValue({
      data: [{ id: "question-2", question_stem_id: "stem-2" }],
      error: null,
    });

    await expect(
      findUndeliveredPracticeQuestionIds(
        { from: jest.fn().mockReturnValue(query) } as never,
        [{ id: "stem-1", questions: [] }],
        ["question-2", "missing-question"],
      ),
    ).resolves.toEqual(["question-2", "missing-question"]);
  });

  it("rejects every question when no stem has been delivered", async () => {
    const from = jest.fn();

    await expect(
      findUndeliveredPracticeQuestionIds(
        { from } as never,
        [],
        ["question-1"],
      ),
    ).resolves.toEqual(["question-1"]);
    expect(from).not.toHaveBeenCalled();
  });
});
