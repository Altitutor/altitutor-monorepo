/** @jest-environment jsdom */

import { fireEvent, render, screen } from "@testing-library/react";
import type { InterviewReviewMock } from "@altitutor/shared";
import { InterviewReviewMockHistory } from "../interview-review-mock-history";

jest.mock("@tiptap/markdown", () => {
  const { Extension } = jest.requireActual<typeof import("@tiptap/core")>("@tiptap/core");
  return { Markdown: Extension.create({ name: "markdown" }) };
});

const mock: InterviewReviewMock = {
  id: "mock",
  title: "Practice mock",
  date: "2026-11-06",
  released: true,
  score: 4,
  maximumPoints: 6,
  stations: [{
    id: "station",
    name: "Ethics",
    score: 4,
    maximumPoints: 6,
    notAssessedReason: null,
    feedback: {
      type: "doc",
      content: [
        { type: "image", attrs: { src: "https://images.example.test/feedback.png", alt: "Embedded feedback image" } },
        { type: "paragraph", content: [{ type: "text", text: "Clear opening", marks: [{ type: "bold" }] }] },
        { type: "paragraph", content: [{ type: "text", text: "Explain the trade-off next." }] },
        {
          type: "paragraph",
          content: [{
            type: "text",
            text: "Further reading",
            marks: [{
              type: "link",
              attrs: {
                href: "https://example.test/feedback",
                target: "_blank",
                rel: "noopener noreferrer nofollow",
                class: "text-primary underline cursor-pointer",
                title: null,
              },
            }],
          }],
        },
      ],
    },
    questions: [
      { id: "question-1", title: "What would you do?", feedback: "  First line\nSecond line", score: 0 },
      { id: "question-2", title: "Why?", feedback: null },
    ],
  }],
};

test("preserves the formatting of mock feedback", async () => {
  const { container } = render(<InterviewReviewMockHistory round={mock} />);

  fireEvent.click(screen.getByRole("button", { name: /Practice mock/ }));
  fireEvent.click(screen.getByRole("button", { name: /Ethics/ }));

  expect((await screen.findByText("Clear opening")).tagName).toBe("STRONG");
  expect(screen.getByText("Explain the trade-off next.").tagName).toBe("P");
  expect(screen.getByRole("link", { name: "Further reading" }).getAttribute("href")).toBe("https://example.test/feedback");
  expect(container.querySelector('img[src="https://images.example.test/feedback.png"]')).toBeNull();
});

test("shows a zero question score while accepting old snapshots without question scores", () => {
  render(<InterviewReviewMockHistory round={mock} />);

  fireEvent.click(screen.getByRole("button", { name: /Practice mock/ }));
  fireEvent.click(screen.getByRole("button", { name: /Ethics/ }));

  fireEvent.click(screen.getByRole("button", { name: /What would you do\?.*0 \/ 6/ }));
  expect(screen.getByText("First line Second line").textContent).toBe("First line\nSecond line");
  expect(screen.getByRole("button", { name: "Q2 · Why?" })).toBeTruthy();
});
