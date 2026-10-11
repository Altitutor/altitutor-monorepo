import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import React, { type PropsWithChildren } from "react";
import { useLearningLesson } from "@/features/learning/hooks/use-learning";

jest.mock("@/lib/supabase/client", () => ({
  getSupabaseBrowserClient: jest.fn(),
}));

describe("lesson launch recovery", () => {
  it("leaves loading when the server rejects the submitted Study-plan task", async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: "invalid_study_plan_learning_task" }),
      clone() {
        return this;
      },
    });
    const originalFetch = global.fetch;
    global.fetch = fetchMock;
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 } },
    });
    const wrapper = ({ children }: PropsWithChildren) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    try {
      const { result, unmount } = renderHook(
        () => useLearningLesson("lesson-1", "task-1"),
        { wrapper },
      );
      await waitFor(() =>
        expect(result.current.error?.message).toBe(
          "This Study-plan task is no longer available.",
        ),
      );
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.data).toBeUndefined();
      unmount();
    } finally {
      client.clear();
      global.fetch = originalFetch;
    }
  });
});
