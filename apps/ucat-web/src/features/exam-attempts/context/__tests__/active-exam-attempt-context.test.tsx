import React from "react";
import { act, render, waitFor } from "@testing-library/react";
import { focusManager, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fetchActiveExamAttempt } from "@/features/exam-attempts/api/exam-attempts-api";
import { ActiveExamAttemptProvider } from "@/features/exam-attempts/context/active-exam-attempt-context";

jest.mock("@/features/exam-attempts/api/exam-attempts-api", () => ({
  fetchActiveExamAttempt: jest.fn(),
}));

const mockFetchActiveExamAttempt = jest.mocked(fetchActiveExamAttempt);

Object.assign(globalThis, { React });

describe("ActiveExamAttemptProvider", () => {
  afterEach(() => {
    focusManager.setFocused(undefined);
  });

  it("does not repeat the active-attempt request whenever the window regains focus", async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    mockFetchActiveExamAttempt.mockResolvedValue(null);

    render(
      <QueryClientProvider client={client}>
        <ActiveExamAttemptProvider>
          <div>child</div>
        </ActiveExamAttemptProvider>
      </QueryClientProvider>,
    );

    await waitFor(() => expect(mockFetchActiveExamAttempt).toHaveBeenCalledTimes(1));

    await act(async () => {
      focusManager.setFocused(false);
      focusManager.setFocused(true);
    });
    await act(async () => {
      focusManager.setFocused(false);
      focusManager.setFocused(true);
    });

    expect(mockFetchActiveExamAttempt).toHaveBeenCalledTimes(1);
  });
});
