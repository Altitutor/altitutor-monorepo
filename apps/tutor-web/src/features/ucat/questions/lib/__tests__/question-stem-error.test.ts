import { humanizeQuestionStemError } from "@/features/ucat/questions/lib/question-stem-error";

describe("humanizeQuestionStemError", () => {
  it("shows the validation message without database metadata", () => {
    const raw =
      'published_content_invalid:[{"code":"missing_category","message":"Choose a stem category.","entity_id":"18335405-e160-4248-9404-34809a8b140e","entity_type":"stem"}]';

    const message = humanizeQuestionStemError(raw);

    expect(message).toBe(
      "This published question stem still needs changes: Choose a stem category.",
    );
    expect(message).not.toContain("missing_category");
    expect(message).not.toContain("18335405-e160-4248-9404-34809a8b140e");
  });

  it("combines and deduplicates multiple validation messages", () => {
    const raw =
      'published_content_invalid:[{"code":"missing_category","message":"Choose a stem category."},{"code":"missing_explanations","message":"Complete every required answer explanation."},{"code":"duplicate","message":"Choose a stem category."}]';

    expect(humanizeQuestionStemError(raw)).toBe(
      "This published question stem still needs changes: Choose a stem category. Complete every required answer explanation.",
    );
  });

  it("uses a safe message for an invalid validation payload", () => {
    expect(
      humanizeQuestionStemError("published_content_invalid:not-json"),
    ).toBe(
      "This published question stem still needs changes before it can be saved.",
    );
  });

  it("preserves unrelated API errors", () => {
    const message =
      "Cannot change to private while this stem belongs to a public set.";
    expect(humanizeQuestionStemError(message)).toBe(message);
  });

  it("names the published set when a full-section question count is wrong", () => {
    expect(
      humanizeQuestionStemError(
        'published_content_invalid:[{"code":"full_section_question_count_mismatch","message":"A full section set requires exactly 35 questions for its reference blueprint; found 34.","entity_id":"9c4d8767-fdc9-4ed7-a6e7-e8ba70b40885","entity_type":"set"}]',
      ),
    ).toBe(
      "This published set still needs changes: A full section set requires exactly 35 questions for its reference blueprint; found 34.",
    );
  });
});
