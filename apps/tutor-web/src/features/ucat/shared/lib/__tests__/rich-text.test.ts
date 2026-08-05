import type { Json } from "@altitutor/shared";
import {
  aiTextToProseMirror,
  findRichTextSyntaxLeaks,
  proseMirrorHasOuterTable,
  proseMirrorToPlainText,
  stripOuterTablesFromProseMirrorDoc,
} from "@/features/ucat/shared/lib/rich-text";

describe("aiTextToProseMirror", () => {
  it("converts a Markdown pipe table into a rich-text table", () => {
    const result = aiTextToProseMirror(`Pension details:

| Saver | Investment (GBP) | Retirement length (years) |
|---|---:|---:|
| Mary | 25,000 | 3 |
| James | 15,000 | 12 |`);

    expect(result).toMatchObject({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "Pension details:" }],
        },
        {
          type: "table",
          content: [
            {
              type: "tableRow",
              content: [
                {
                  type: "tableHeader",
                  content: [
                    {
                      type: "paragraph",
                      content: [{ type: "text", text: "Saver" }],
                    },
                  ],
                },
                {
                  type: "tableHeader",
                  content: [
                    {
                      type: "paragraph",
                      content: [{ type: "text", text: "Investment (GBP)" }],
                    },
                  ],
                },
                {
                  type: "tableHeader",
                  content: [
                    {
                      type: "paragraph",
                      content: [
                        { type: "text", text: "Retirement length (years)" },
                      ],
                    },
                  ],
                },
              ],
            },
            { type: "tableRow" },
            { type: "tableRow" },
          ],
        },
      ],
    });
  });

  it("converts common Markdown blocks and inline marks", () => {
    expect(aiTextToProseMirror([
      "> Check the wording carefully.",
      "",
      "Use `estimation`, read the [guide](https://example.test/guide), and avoid ~~guessing~~.",
      "",
      "```",
      "const answer = 42",
      "```",
      "",
      "---",
    ].join("\n"))).toEqual({
      type: "doc",
      content: [
        {
          type: "blockquote",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "Check the wording carefully." }],
            },
          ],
        },
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Use " },
            { type: "text", text: "estimation", marks: [{ type: "code" }] },
            { type: "text", text: ", read the " },
            {
              type: "text",
              text: "guide",
              marks: [{ type: "link", attrs: { href: "https://example.test/guide" } }],
            },
            { type: "text", text: ", and avoid " },
            { type: "text", text: "guessing", marks: [{ type: "strike" }] },
            { type: "text", text: "." },
          ],
        },
        {
          type: "codeBlock",
          content: [{ type: "text", text: "const answer = 42" }],
        },
        { type: "horizontalRule" },
      ],
    });
  });

  it("converts inline and display LaTeX delimiters into mathematics nodes", () => {
    const result = aiTextToProseMirror([
      "Use \\(30 \\div 30 = 1\\) before selecting the answer.",
      "",
      "\\[",
      "\\frac{30 - 30}{30} \\times 100 = 0\\%",
      "\\]",
    ].join("\n"));

    expect(result).toEqual({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Use " },
            {
              type: "inlineMath",
              attrs: { latex: "30 \\div 30 = 1" },
            },
            { type: "text", text: " before selecting the answer." },
          ],
        },
        {
          type: "blockMath",
          attrs: {
            latex: "\\frac{30 - 30}{30} \\times 100 = 0\\%",
          },
        },
      ],
    });
  });

  it("normalizes bare maths commands while preserving currency and delimited maths", () => {
    const result = aiTextToProseMirror([
      "Use the calculator:",
      "",
      "$4.2 \\div 1.05 = $4.0",
      "",
      "Check with \\(4.2 \\div 1.05 = 4\\).",
    ].join("\n"));

    expect(result).toEqual({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "Use the calculator:" }],
        },
        {
          type: "paragraph",
          content: [{ type: "text", text: "$4.2 ÷ 1.05 = $4.0" }],
        },
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Check with " },
            { type: "inlineMath", attrs: { latex: "4.2 \\div 1.05 = 4" } },
            { type: "text", text: "." },
          ],
        },
      ],
    });
  });

  it("preserves mathematics when extracting assessment plain text", () => {
    expect(proseMirrorToPlainText({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Calculate " },
            { type: "inlineMath", attrs: { latex: "a^2+b^2=c^2" } },
            { type: "text", text: "." },
          ],
        },
        {
          type: "blockMath",
          attrs: { latex: "\\frac{1}{2}" },
        },
      ],
    })).toBe("Calculate \\(a^2+b^2=c^2\\).\n\\[\\frac{1}{2}\\]");
  });

  it("distinguishes rendered math nodes from literal formatting source", () => {
    expect(findRichTextSyntaxLeaks({
      type: "doc",
      content: [
        { type: "inlineMath", attrs: { latex: "\\frac{1}{2}" } },
        {
          type: "paragraph",
          content: [{ type: "text", text: "Visible **source** and \\(x^2\\)." }],
        },
      ],
    })).toEqual([
      {
        kind: "markdown_emphasis",
        text: "Visible **source** and \\(x^2\\).",
      },
      {
        kind: "latex_delimiter",
        text: "Visible **source** and \\(x^2\\).",
      },
    ]);
  });

  it("preserves inline formatting inside lists and tables", () => {
    expect(aiTextToProseMirror([
      "- Use **elimination** and read the [guide](https://example.test/guide).",
      "",
      "| Method | Reminder |",
      "|---|---|",
      "| **Estimate** | Avoid `exact arithmetic` first |",
    ].join("\n"))).toMatchObject({
      content: [
        {
          type: "bulletList",
          content: [
            {
              type: "listItem",
              content: [
                {
                  content: expect.arrayContaining([
                    { type: "text", text: "elimination", marks: [{ type: "bold" }] },
                    {
                      type: "text",
                      text: "guide",
                      marks: [{ type: "link", attrs: { href: "https://example.test/guide" } }],
                    },
                  ]),
                },
              ],
            },
          ],
        },
        {
          type: "table",
          content: [
            { type: "tableRow" },
            {
              type: "tableRow",
              content: [
                {
                  content: [
                    {
                      content: [
                        { type: "text", text: "Estimate", marks: [{ type: "bold" }] },
                      ],
                    },
                  ],
                },
                {
                  content: [
                    {
                      content: [
                        { type: "text", text: "Avoid " },
                        { type: "text", text: "exact arithmetic", marks: [{ type: "code" }] },
                        { type: "text", text: " first" },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    });
  });

  it("continues ordered working across blank lines and a displayed calculation", () => {
    const result = aiTextToProseMirror([
      "1. Find the relevant values.",
      "",
      "1. Calculate the proportion.",
      "\\[18 \\div 56 \\approx 32\\%\\]",
      "1. Compare it with one third.",
    ].join("\n")) as { content?: Array<{ type?: string; attrs?: { start?: number } }> };

    expect(result.content
      ?.filter((node) => node.type === "orderedList")
      .map((node) => node.attrs?.start)).toEqual([1, 2, 3]);
  });

});

describe("stripOuterTablesFromProseMirrorDoc", () => {
  const paragraph = (text: string): Json => ({
    type: "paragraph",
    content: [{ type: "text", text }],
  });

  const cell = (children: Json[], header = false): Json => ({
    type: header ? "tableHeader" : "tableCell",
    attrs: { colspan: 1, rowspan: 1, colwidth: null },
    content: children,
  });

  it("flattens outermost tables into cell contents", () => {
    const doc: Json = {
      type: "doc",
      content: [
        {
          type: "table",
          content: [
            {
              type: "tableRow",
              content: [cell([paragraph("A")]), cell([paragraph("B")])],
            },
          ],
        },
      ],
    };

    expect(stripOuterTablesFromProseMirrorDoc(doc)).toEqual({
      type: "doc",
      content: [paragraph("A"), paragraph("B")],
    });
    expect(proseMirrorHasOuterTable(doc)).toBe(true);
  });

  it("preserves nested tables inside cells", () => {
    const nestedTable: Json = {
      type: "table",
      content: [
        {
          type: "tableRow",
          content: [cell([paragraph("inner")])],
        },
      ],
    };
    const doc: Json = {
      type: "doc",
      content: [
        {
          type: "table",
          content: [
            {
              type: "tableRow",
              content: [cell([paragraph("intro"), nestedTable])],
            },
          ],
        },
      ],
    };

    expect(stripOuterTablesFromProseMirrorDoc(doc)).toEqual({
      type: "doc",
      content: [paragraph("intro"), nestedTable],
    });
  });

  it("leaves docs without tables unchanged", () => {
    const doc: Json = {
      type: "doc",
      content: [paragraph("plain")],
    };
    expect(stripOuterTablesFromProseMirrorDoc(doc)).toEqual(doc);
    expect(proseMirrorHasOuterTable(doc)).toBe(false);
  });
});
