import { getQuestionSetLabel } from "@/lib/ucat/exam-attempt/question-set-label";

describe("getQuestionSetLabel", () => {
  it("extracts the actual set name from stored rich text", () => {
    expect(
      getQuestionSetLabel({
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: "VR Practice Set 1" }],
          },
        ],
      }),
    ).toBe("VR Practice Set 1");
  });
});
