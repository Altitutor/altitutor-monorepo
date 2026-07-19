import type { Json } from "@altitutor/shared";
import type { UcatQuestionStemFormValues } from "@/features/ucat/questions/types/schema";
import { lintBulkImportFormatting } from "@/features/ucat/questions/components/bulk-import/bulkImportFormattingLint";

function paragraph(text: string): Json {
  return { type: "paragraph", content: [{ type: "text", text }] };
}

function doc(content: Json[]): Json {
  return { type: "doc", content };
}

function table(rows: string[][]): Json {
  return {
    type: "table",
    content: rows.map((row) => ({
      type: "tableRow",
      content: row.map((text) => ({
        type: "tableCell",
        attrs: { colspan: 1, rowspan: 1 },
        content: [paragraph(text)],
      })),
    })),
  };
}

function form(stemText: Json): UcatQuestionStemFormValues {
  return {
    sectionId: "00000000-0000-4000-8000-000000000001",
    categoryId: null,
    stemText,
    accessScope: "public",
    questions: [
      {
        questionText: doc([paragraph("What is the answer?")]),
        questionType: "multiple_choice",
        answerExplanation: null,
        difficulty: null,
        timeBurdenSeconds: "",
        tagIds: [],
        options: [
          {
            answerText: doc([paragraph("A")]),
            answerExplanation: null,
            isAnswer: true,
          },
          {
            answerText: doc([paragraph("B")]),
            answerExplanation: null,
            isAnswer: false,
          },
        ],
      },
    ],
  };
}

describe("lintBulkImportFormatting", () => {
  it("flags a likely table flattened into short paragraphs", () => {
    const flattened = doc([
      paragraph("The table below shows results."),
      paragraph("Name"),
      paragraph("Score"),
      paragraph("Amy"),
      paragraph("12"),
      paragraph("Ben"),
      paragraph("14"),
    ]);

    const issues = lintBulkImportFormatting({
      sourceDocuments: [{ label: "Pasted document", value: flattened }],
      stems: [],
    });

    expect(issues).toEqual([
      expect.objectContaining({
        code: "flattened_table",
        location: "Pasted document",
      }),
    ]);
  });

  it("does not call an image-backed table flattened", () => {
    const imageBacked = doc([
      paragraph("The table below shows results."),
      {
        type: "paragraph",
        content: [
          { type: "image", attrs: { src: "https://example.com/a.png" } },
        ],
      },
      paragraph("One"),
      paragraph("Two"),
      paragraph("Three"),
      paragraph("Four"),
    ]);

    expect(
      lintBulkImportFormatting({
        sourceDocuments: [{ label: "Pasted document", value: imageBacked }],
        stems: [],
      }).some((issue) => issue.code === "flattened_table"),
    ).toBe(false);
  });

  it("flags tables lost between pasted input and parsed stems", () => {
    const source = doc([
      paragraph("Results"),
      table([
        ["Name", "Score"],
        ["Amy", "12"],
      ]),
    ]);
    const issues = lintBulkImportFormatting({
      sourceDocuments: [{ label: "Pasted document", value: source }],
      stems: [
        form(
          doc([paragraph("Results"), paragraph("Name"), paragraph("Score")]),
        ),
      ],
      compareParsedOutput: true,
    });

    expect(issues).toEqual([
      expect.objectContaining({
        code: "lost_table",
        location: "Parsed import",
      }),
    ]);
  });

  it("does not count answer-layout tables as lost content", () => {
    const answerGrid = doc([
      table([
        ["Question", "Answer"],
        ["1", "A"],
      ]),
    ]);

    expect(
      lintBulkImportFormatting({
        sourceDocuments: [
          {
            label: "Pasted answers document",
            value: answerGrid,
            compareTableCount: false,
          },
        ],
        stems: [form(doc([paragraph("A text-only stem")]))],
        compareParsedOutput: true,
      }).some((issue) => issue.code === "lost_table"),
    ).toBe(false);
  });

  it("flags unresolved table placeholders", () => {
    const issues = lintBulkImportFormatting({
      sourceDocuments: [],
      stems: [form(doc([paragraph("Results"), paragraph("[[TABLE:t1]]")]))],
    });

    expect(issues).toEqual([
      expect.objectContaining({
        code: "unresolved_table_placeholder",
        location: "Stem 1 · stem text",
      }),
    ]);
  });

  it("flags malformed tables and accepts healthy tables", () => {
    const malformed = doc([table([["Only one cell"], ["Still one cell"]])]);
    const healthy = doc([
      table([
        ["Name", "Score"],
        ["Amy", "12"],
      ]),
    ]);

    expect(
      lintBulkImportFormatting({
        sourceDocuments: [{ label: "Malformed", value: malformed }],
        stems: [],
      }).some((issue) => issue.code === "invalid_table_shape"),
    ).toBe(true);
    expect(
      lintBulkImportFormatting({
        sourceDocuments: [{ label: "Healthy", value: healthy }],
        stems: [form(healthy)],
        compareParsedOutput: true,
      }),
    ).toEqual([]);
  });
});
