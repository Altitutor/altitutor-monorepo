/** @jest-environment jsdom */
import React from "react";
import { render, screen } from "@testing-library/react";
import { InterviewRejoinBanner } from "../interview-rejoin-banner";

it("offers a direct rejoin link for each active interview", () => {
  render(<InterviewRejoinBanner rounds={[{ id: "round", name: "Medicine mock", href: "/interviews/rounds/round/live" }]} />);
  expect(screen.getByRole("link", { name: "Rejoin interview" }).getAttribute("href")).toBe("/interviews/rounds/round/live");
  expect(screen.getByText("Medicine mock")).toBeTruthy();
});
it("renders no banner when no interviews are active", () => {
  const { container } = render(<InterviewRejoinBanner rounds={[]} />);
  expect(container.textContent).toBe("");
});
