import {
  hasExactDuplicateContent,
  suggestMergeDirection,
} from "../duplicate-stem-comparison";

const richText = (text: string) => ({
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text }] }],
});

const question = (text: string, options = ["Yes", "No"]) => ({
  question_text: richText(text),
  index: 0,
  answer_options: options.map((answer, index) => ({
    answer_text: richText(answer),
    index,
    is_answer: index === 0,
  })),
});

describe("hasExactDuplicateContent", () => {
  it("identifies identical stems, questions, and answer options", () => {
    expect(
      hasExactDuplicateContent(
        richText("Shared stem"),
        [question("Shared question")],
        richText("Shared stem"),
        [question("Shared question")],
      ),
    ).toBe(true);
  });

  it("recommends a merge when a repeated stem has different questions", () => {
    expect(
      hasExactDuplicateContent(
        richText("Shared stem"),
        [question("Question A")],
        richText("Shared stem"),
        [question("Question B")],
      ),
    ).toBe(false);
  });

  it("recommends a merge when one stem contains an extra instruction", () => {
    expect(
      hasExactDuplicateContent(
        richText("Shared stem. Extra instruction."),
        [question("Shared question")],
        richText("Shared stem."),
        [question("Shared question")],
      ),
    ).toBe(false);
    expect(
      suggestMergeDirection(
        richText("Shared stem. Extra instruction."),
        richText("Shared stem."),
      ),
    ).toBe("A-into-B");
  });
});
