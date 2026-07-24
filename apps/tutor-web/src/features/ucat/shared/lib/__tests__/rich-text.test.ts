import { aiTextToProseMirror } from "@/features/ucat/shared/lib/rich-text";

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
});
