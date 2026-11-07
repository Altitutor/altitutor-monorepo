import { isInterviewReviewDocument } from "../performance-review-document";

describe("interview performance review documents", () => {
  it("accepts headings and links in the review editor format", () => {
    expect(isInterviewReviewDocument({ type: "doc", content: [
      { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Practice plan" }] },
      { type: "paragraph", content: [{ type: "text", text: "Read the guidance", marks: [
        { type: "link", attrs: { href: "https://example.com/guide", target: "_blank" } },
      ] }] },
    ] })).toBe(true);
  });

  it.each([
    { type: "table", content: [{ type: "tableRow", content: [
      { type: "tableCell", attrs: { colspan: 1_000_000_000 }, content: [{ type: "paragraph" }] },
    ] }] },
    { type: "paragraph", content: [{ type: "text", text: "Unsafe", marks: [
      { type: "link", attrs: { href: "https://example.com", rel: "opener", class: "fixed inset-0" } },
    ] }] },
    { type: "externalVideo", attrs: { embedUrl: "https://example.com/embed" } },
    { type: "unknown", content: [{ type: "text", text: "Hidden feedback" }] },
    { type: "text", text: "Text outside a paragraph" },
    { type: "paragraph", content: [{ type: "text", text: "Unsafe", marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }] }] },
  ])("rejects unsupported or unsafe nodes in shared reviews", (node) => {
    expect(isInterviewReviewDocument({ type: "doc", content: [node] })).toBe(false);
  });
});
