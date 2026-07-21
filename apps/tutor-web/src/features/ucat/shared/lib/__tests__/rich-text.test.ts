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
});
