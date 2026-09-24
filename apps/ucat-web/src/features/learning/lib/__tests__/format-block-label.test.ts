import { formatBlockLabel } from "@/features/learning/lib/format-block-label";
import type { LearningModuleBlockRow } from "@/features/learning/types";

function block(
  blockType: LearningModuleBlockRow["block_type"],
  content: LearningModuleBlockRow["content"] = {},
): LearningModuleBlockRow {
  return { block_type: blockType, content } as LearningModuleBlockRow;
}

describe("formatBlockLabel", () => {
  it("uses the first heading in a text block", () => {
    expect(
      formatBlockLabel(
        block("text", {
          body: {
            type: "doc",
            content: [
              { type: "paragraph", content: [{ type: "text", text: "Intro" }] },
              {
                type: "heading",
                attrs: { level: 2 },
                content: [{ type: "text", text: "Reading efficiently" }],
              },
            ],
          },
        }),
      ),
    ).toBe("Reading efficiently");
  });

  it("capitalises block type labels without numbering them", () => {
    expect(formatBlockLabel(block("question_stem"))).toBe("Question stem");
    expect(formatBlockLabel(block("video"))).toBe("Video");
  });
});
