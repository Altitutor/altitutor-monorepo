import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { SignupCompletePlanStep } from "../plan-step";

it("iOS account setup returns to the app without offering a website checkout", () => {
  const complete = jest.fn();
  render(
    <QueryClientProvider client={new QueryClient()}>
      <SignupCompletePlanStep
        returnTo="/mobile-auth?store=apple&callback=altitutor-ucat%3A%2F%2Fauth-return&state=proof&challenge=challenge"
        onComplete={complete}
        onContinueCurrentPlan={jest.fn()}
      />
    </QueryClientProvider>,
  );
  expect(screen.getByText(/free daily practice/)).toBeInTheDocument();
  expect(
    screen.queryByText(/checkout|pay with|weekly|monthly/i),
  ).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Continue to app" }));
  expect(complete).toHaveBeenCalledTimes(1);
});
