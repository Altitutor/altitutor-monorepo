import type { Json } from "@altitutor/shared";
import {
  backfillRichTextFormatting,
  extractedSemanticTextAfterBackfill,
  extractedSemanticTextBeforeBackfill,
  literalFormattingLeaks,
} from "../rich-text-formatting";
import {
  planStemRichTextBackfill,
  validateTipTapDocument,
} from "../rich-text-formatting-plan";

function doc(...content: Json[]): Json {
  return { type: "doc", content };
}

function paragraph(...content: Json[]): Json {
  return { type: "paragraph", content };
}

describe("UCAT leaked rich-text formatting backfill", () => {
  it("merges bold into existing nested marks and handles multiple spans", () => {
    const before = doc(
      paragraph({
        type: "text",
        text: "**first** and **second**",
        marks: [
          { type: "italic" },
          { type: "link", attrs: { href: "https://altitutor.com" } },
        ],
      }),
    );

    const result = backfillRichTextFormatting(before);

    expect(result.issues).toEqual([]);
    expect(result.stats.boldSpans).toBe(2);
    expect(result.value).toEqual(
      doc(
        paragraph(
          {
            type: "text",
            text: "first",
            marks: [
              { type: "italic" },
              { type: "link", attrs: { href: "https://altitutor.com" } },
              { type: "bold" },
            ],
          },
          {
            type: "text",
            text: " and ",
            marks: [
              { type: "italic" },
              { type: "link", attrs: { href: "https://altitutor.com" } },
            ],
          },
          {
            type: "text",
            text: "second",
            marks: [
              { type: "italic" },
              { type: "link", attrs: { href: "https://altitutor.com" } },
              { type: "bold" },
            ],
          },
        ),
      ),
    );
  });

  it("converts inline math, including math nested inside leaked bold", () => {
    const before = doc(
      paragraph({
        type: "text",
        text: "Use \\(x+1\\), then **\\(y^2\\)**.",
      }),
    );

    const result = backfillRichTextFormatting(before);

    expect(result.issues).toEqual([]);
    expect(result.stats.inlineMathNodes).toBe(2);
    expect(result.value).toEqual(
      doc(
        paragraph(
          { type: "text", text: "Use " },
          { type: "inlineMath", attrs: { latex: "x+1" } },
          { type: "text", text: ", then " },
          {
            type: "inlineMath",
            attrs: { latex: "y^2" },
            marks: [{ type: "bold" }],
          },
          { type: "text", text: "." },
        ),
      ),
    );
  });

  it("converts a complete display-math paragraph but reports mixed display math", () => {
    const complete = backfillRichTextFormatting(
      doc(
        paragraph(
          { type: "text", text: "  \\[" },
          { type: "text", text: "\\frac{a}{b}" },
          { type: "text", text: "\\]  " },
        ),
      ),
    );
    expect(complete.issues).toEqual([]);
    expect(complete.value).toEqual(
      doc({
        type: "blockMath",
        attrs: { latex: "\\frac{a}{b}" },
      }),
    );

    const mixed = backfillRichTextFormatting(
      doc(paragraph({ type: "text", text: "Therefore \\[x=1\\] is true." })),
    );
    expect(mixed.issues).toEqual([
      expect.objectContaining({ code: "mixed_display_math" }),
    ]);
    expect(mixed.changed).toBe(false);
  });

  it("validates complete display math split across marked text nodes", () => {
    const displayExplanation = doc(
      paragraph(
        { type: "text", text: "\\[P" },
        {
          type: "text",
          text: "_{\\text{new}}=1.25^3P",
          marks: [{ type: "italic" }],
        },
        { type: "text", text: "_{\\text{old}}.\\]" },
      ),
    );
    const aggregate: Record<string, unknown> = {
      id: "00000000-0000-0000-0000-000000000001",
      stem_text: doc(paragraph({ type: "text", text: "Stem" })),
      questions: [
        {
          id: "00000000-0000-0000-0000-000000000002",
          index: 1,
          question_text: doc(paragraph({ type: "text", text: "Question" })),
          answer_explanation: displayExplanation,
          answer_options: [],
        },
      ],
    };

    const plan = planStemRichTextBackfill(aggregate);

    expect(plan.issues).toEqual([]);
    expect(plan.operations).toEqual([
      {
        type: "update_question",
        questionId: "00000000-0000-0000-0000-000000000002",
        changes: {
          answerExplanation: doc({
            type: "blockMath",
            attrs: {
              latex: "P_{\\text{new}}=1.25^3P_{\\text{old}}.",
            },
          }),
        },
      },
    ]);
  });

  it("applies the reviewed, revision-pinned subscript repair", () => {
    const aggregate: Record<string, unknown> = {
      id: "30134c9b-fd68-409c-b3f3-ff818ca6dccb",
      revision:
        "eyJpZCI6IjMwMTM0YzliLWZkNjgtNDA5Yy1iM2YzLWZmODE4Y2E2ZGNjYiIsInVwZGF0ZWRBdCI6IjIwMjYtMDctMjdUMTM6MTY6NDAuNTY5NzU4KzAwOjAwIn0",
      stem_text: doc(paragraph({ type: "text", text: "Stem" })),
      questions: [
        {
          id: "43b03d90-f139-4c82-aafd-a1ac4876d330",
          index: 1,
          question_text: doc(paragraph({ type: "text", text: "Question" })),
          answer_explanation: doc(
            paragraph({
              type: "text",
              text: "A 25% increase makes the new velocity \\(1.25v\\). Substitute this into the formula:",
            }),
            paragraph(
              { type: "text", text: "\\[P" },
              {
                type: "text",
                text: "{\\text{new}}=A(1.25v)^3=1.25^3Av^3=1.953125P",
                marks: [{ type: "italic" }],
              },
              { type: "text", text: "{\\text{old}}.\\]" },
            ),
            paragraph(
              {
                type: "text",
                text: "The new power is about 1.95 times the old power, so the ",
              },
              {
                type: "text",
                text: "increase",
                marks: [{ type: "bold" }],
              },
              {
                type: "text",
                text: " is \\((1.953125-1)\\times100\\%\\approx95\\%\\).",
              },
            ),
          ),
          answer_options: [],
        },
      ],
    };

    const plan = planStemRichTextBackfill(aggregate);
    const serializedOperations = JSON.stringify(plan.operations);

    expect(plan.issues).toEqual([]);
    expect(plan.reviewedCorrections).toEqual([
      "$.questions[0].answer_explanation:restore_latex_subscripts",
    ]);
    expect(serializedOperations).toContain(
      "P_{\\\\text{new}}=A(1.25v)^3=1.25^3Av^3=1.953125P_{\\\\text{old}}.",
    );
    expect(serializedOperations).not.toContain(
      "P{\\\\text{new}}=A(1.25v)^3=1.25^3Av^3=1.953125P{\\\\text{old}}.",
    );

    const revisionMismatch = planStemRichTextBackfill({
      ...aggregate,
      revision: "different-revision",
    });
    expect(revisionMismatch.issues).toEqual([
      expect.objectContaining({
        code: "invalid_rich_text",
        message: expect.stringContaining("pinned revision"),
      }),
    ]);
  });

  it("recurses through tables while preserving their structure", () => {
    const before = doc({
      type: "table",
      content: [
        {
          type: "tableRow",
          content: [
            {
              type: "tableCell",
              attrs: { colspan: 1, rowspan: 1, colwidth: null },
              content: [paragraph({ type: "text", text: "**cell** \\(x\\)" })],
            },
          ],
        },
      ],
    });

    const result = backfillRichTextFormatting(before);

    expect(result.issues).toEqual([]);
    expect((result.value as { content: Json[] }).content[0]).toMatchObject({
      type: "table",
      content: [
        {
          type: "tableRow",
          content: [
            {
              type: "tableCell",
              attrs: { colspan: 1, rowspan: 1, colwidth: null },
            },
          ],
        },
      ],
    });
    expect(validateTipTapDocument(result.value)).toBeNull();
  });

  it("preserves unrelated empty marked text nodes without proposing a change", () => {
    const before = doc({
      type: "table",
      content: [
        {
          type: "tableRow",
          content: [
            {
              type: "tableCell",
              attrs: { colspan: 1, rowspan: 1, colwidth: null },
              content: [
                paragraph({
                  type: "text",
                  text: "",
                  marks: [{ type: "bold" }],
                }),
              ],
            },
          ],
        },
      ],
    });

    const result = backfillRichTextFormatting(before);

    expect(result.value).toEqual(before);
    expect(result.changed).toBe(false);
    expect(result.stats).toEqual({
      boldSpans: 0,
      inlineMathNodes: 0,
      blockMathNodes: 0,
    });
  });

  it("does not interpret literal list markers or blockquote prefixes", () => {
    const before = doc(
      paragraph({ type: "text", text: "- **item**" }),
      paragraph({ type: "text", text: "> quoted prefix" }),
    );
    const result = backfillRichTextFormatting(before);

    expect(extractedSemanticTextAfterBackfill(result.value)).toContain(
      "- item",
    );
    expect(extractedSemanticTextAfterBackfill(result.value)).toContain(
      "> quoted prefix",
    );
    expect(result.value).not.toEqual(
      expect.objectContaining({ type: "bulletList" }),
    );
    expect(result.value).not.toEqual(
      expect.objectContaining({ type: "blockquote" }),
    );
  });

  it("preserves images, their file references, and surrounding document metadata", () => {
    const before = {
      type: "doc",
      content: [
        {
          type: "image",
          attrs: {
            src: "https://example.com/diagram.png",
            fileId: "file-1",
            visualType: "diagram",
            visualSpec: { kind: "number-line" },
          },
        },
        paragraph({ type: "text", text: "**caption**" }),
      ],
    } satisfies Json;

    const result = backfillRichTextFormatting(before);

    expect((result.value as { content: Json[] }).content[0]).toEqual(
      (before as { content: Json[] }).content[0],
    );
    expect(validateTipTapDocument(result.value)).toBeNull();
  });

  it("reports malformed delimiters and is idempotent after a safe transformation", () => {
    const malformed = backfillRichTextFormatting(
      doc(
        paragraph({ type: "text", text: "**not closed" }),
        paragraph({ type: "text", text: "\\(x+1" }),
        paragraph({ type: "text", text: "\\[x=1" }),
      ),
    );
    expect(malformed.issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining([
        "malformed_bold",
        "malformed_inline_math",
        "malformed_display_math",
      ]),
    );

    const first = backfillRichTextFormatting(
      doc(paragraph({ type: "text", text: "**bold** and \\(x\\)" })),
    );
    const second = backfillRichTextFormatting(first.value);
    expect(first.changed).toBe(true);
    expect(second.changed).toBe(false);
    expect(second.stats).toEqual({
      boldSpans: 0,
      inlineMathNodes: 0,
      blockMathNodes: 0,
    });
    expect(literalFormattingLeaks(second.value)).toEqual([]);
    expect(extractedSemanticTextBeforeBackfill(first.value)).toBe(
      extractedSemanticTextAfterBackfill(first.value),
    );
  });

  it("plans only rich-text field operations and preserves answer/file invariants", () => {
    const rich = (text: string) => doc(paragraph({ type: "text", text }));
    const aggregate: Record<string, unknown> = {
      id: "00000000-0000-0000-0000-000000000001",
      stem_text: rich("**Stem**"),
      questions: [
        {
          id: "00000000-0000-0000-0000-000000000002",
          index: 1,
          question_text: rich("Question \\(x\\)"),
          answer_explanation: rich("**Why**"),
          answer_options: [
            {
              id: "00000000-0000-0000-0000-000000000003",
              index: 1,
              answer_key_value: 'correct',
              answer_text: doc(
                {
                  type: "image",
                  attrs: { src: "https://example.com/a.png", fileId: "file-1" },
                },
                paragraph({ type: "text", text: "**A**" }),
              ),
              answer_explanation: rich("\\[x=1\\]"),
            },
            {
              id: "00000000-0000-0000-0000-000000000004",
              index: 2,
              answer_key_value: null,
              answer_text: rich("B"),
              answer_explanation: null,
            },
          ],
        },
      ],
    };

    const plan = planStemRichTextBackfill(aggregate);

    expect(plan.issues).toEqual([]);
    expect(plan.operations).toHaveLength(3);
    expect(
      plan.operations.every(
        (operation) =>
          operation.type === "set_metadata" ||
          operation.type === "update_question" ||
          operation.type === "update_answer_option",
      ),
    ).toBe(true);
    expect(JSON.stringify(plan.operations)).not.toContain('"isAnswer"');
    expect(JSON.stringify(plan.operations)).not.toContain('"fileId":"file-2"');
  });
});
