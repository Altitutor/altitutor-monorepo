import type { JSONContent } from "@altitutor/ui";
import { interviewText } from "@altitutor/shared";
import { parseStationImport } from "../parse-station-import";

const p = (text: string): JSONContent => ({
  type: "paragraph",
  content: text ? [{ type: "text", text }] : [],
});
const cell = (...content: JSONContent[]): JSONContent => ({
  type: "tableCell",
  content,
});
const row = (...content: JSONContent[]): JSONContent => ({
  type: "tableRow",
  content,
});
const doc = (...content: JSONContent[]): JSONContent => ({
  type: "doc",
  content,
});

describe("pasted interview station documents", () => {
  it("keeps guidance following a standalone Rubric heading attached to its question", () => {
    const result = parseStationImport(
      doc(p("A scenario.")),
      doc(
        p("1. What would you do?"),
        p("Rubric:"),
        p("Explain the trade-off."),
        p("Consider the patient."),
        p("2. Why?"),
      ),
    );
    expect(
      result.questions.map((q) => [
        interviewText(q.question),
        interviewText(q.rubric),
      ]),
    ).toEqual([
      ["What would you do?", "Explain the trade-off. Consider the patient."],
      ["Why?", ""],
    ]);
  });
  it("handles Word clipboard tables padded with whitespace-only rows and cells", () => {
    const empty = () => cell(p("\n    "));
    const padded = (question: string, rubric: string) =>
      row(
        empty(),
        cell(p("")),
        empty(),
        cell(p("\n  "), p(question), p("\n  ")),
        empty(),
        cell(p(rubric)),
        empty(),
      );
    const result = parseStationImport(
      doc(p("Prompt"), p("A scenario."), {
        type: "table",
        content: [
          row(empty(), empty(), empty(), empty(), empty(), empty(), empty()),
          padded("Question", "Rubric"),
          row(empty(), empty()),
          padded("What would you do?", "Explain why."),
        ],
      }),
    );
    expect(interviewText(result.prompt)).toBe("A scenario.");
    expect(result.questions).toHaveLength(1);
    expect(interviewText(result.questions[0].rubric)).toBe("Explain why.");
  });
  it("detects plain-text tab-separated question/rubric tables in a full document", () => {
    const result = parseStationImport(
      doc(
        p(
          "MMI 1 Station 3\nPrompt\nA friend needs help.\nQuestion\tRubric\nWhat would you do?\tExplain your reasoning.\nWhy?\tConsider the consequences.",
        ),
      ),
    );
    expect(interviewText(result.prompt)).toBe("A friend needs help.");
    expect(
      result.questions.map((q) => [
        interviewText(q.question),
        interviewText(q.rubric),
      ]),
    ).toEqual([
      ["What would you do?", "Explain your reasoning."],
      ["Why?", "Consider the consequences."],
    ]);
  });
  it("extracts a whole Word station without administrative feedback or duplicate text-box prompts", () => {
    const input = doc(
      p("MMI 1 Station 2"),
      {
        type: "table",
        content: [
          row(cell(p("Interviewee name")), cell(p("General feedback"))),
        ],
      },
      p("Prompt"),
      p("A patient misunderstood the hospital instructions."),
      p("What would you do?"),
      p("Prompt"),
      p("A patient misunderstood the hospital instructions."),
      p("What would you do?"),
      {
        type: "table",
        content: [
          row(cell(p("")), cell(p("Question")), cell(p("Feedback"))),
          row(cell(p("1")), cell(p("What are the issues here?")), cell(p(""))),
          row(
            cell(p("2")),
            cell(p("How could this be prevented?")),
            cell(p("Personal feedback is not a rubric.")),
          ),
        ],
      },
    );
    const result = parseStationImport(input);
    expect(result.name).toBe("MMI 1 Station 2");
    expect(interviewText(result.prompt)).toBe(
      "A patient misunderstood the hospital instructions. What would you do?",
    );
    expect(result.questions.map((q) => interviewText(q.question))).toEqual([
      "What are the issues here?",
      "How could this be prevented?",
    ]);
    expect(result.questions.map((q) => interviewText(q.rubric))).toEqual([
      "",
      "",
    ]);
    expect(result.warnings.join(" ")).toMatch(/Feedback/);
    expect(
      result.questionDocument.content?.[0].content?.[0].content,
    ).toHaveLength(2);
    expect(
      parseStationImport(result.prompt, result.questionDocument).questions,
    ).toEqual(result.questions);
  });
  it("pairs rich rubric cells with their question, preserving lists and inline marks", () => {
    const rubric: JSONContent = {
      type: "bulletList",
      content: [{ type: "listItem", content: [p("Check understanding")] }],
    };
    const question: JSONContent = {
      type: "paragraph",
      content: [
        {
          type: "text",
          text: "Explain your reasoning.",
          marks: [{ type: "bold" }],
        },
      ],
    };
    const result = parseStationImport(
      doc(p("Read this scenario.")),
      doc({
        type: "table",
        content: [
          row(cell(p("Question")), cell(p("Rubric"))),
          row(cell(question), cell(rubric)),
        ],
      }),
    );
    expect(result.questions).toEqual([
      { question: doc(question), rubric: doc(rubric) },
    ]);
  });
  it("supports separate numbered questions with multiline rubric guidance", () => {
    const result = parseStationImport(
      doc(p("Read this scenario.")),
      doc(
        p("1. What would you do?"),
        p("Rubric: Explain the trade-off."),
        {
          type: "bulletList",
          content: [
            { type: "listItem", content: [p("Consider the patient.")] },
          ],
        },
        p("2. Why?"),
        p("Rubric: Give a clear reason."),
      ),
    );
    expect(result.questions.map((q) => interviewText(q.question))).toEqual([
      "What would you do?",
      "Why?",
    ]);
    expect(result.questions.map((q) => interviewText(q.rubric))).toEqual([
      "Explain the trade-off. Consider the patient.",
      "Give a clear reason.",
    ]);
  });
});
