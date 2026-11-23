import React, { type ReactNode } from "react";
import { render, renderHook, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useOnboardingJourneys } from "../api/queries";
import { journey } from "./fixtures";
import { ConversionInsights } from "../components/ConversionInsights";

// JSDOM has no layout observer; keep the real UI and stub only this browser API.
Object.defineProperty(window, "ResizeObserver", {
  value: class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
});

const mockReads: string[] = [];
const mockScopes: unknown[] = [];
let mockReaderMissing = false;
let mockHeldStudent: string | undefined;
let mockResumeRead: (() => void) | undefined;
const mockJourneys = [
  journey("wanted"),
  { ...journey("unrelated"), is_returning: true },
  journey("family", null),
];
jest.mock("@/shared/lib/supabase/client", () => ({
  getSupabaseClient: () => ({
    rpc: async (
      name: string,
      args?: {
        p_student_id?: string;
        p_cohort?: string;
        p_from?: string;
        p_to?: string;
      },
    ) => {
      mockReads.push(name);
      mockScopes.push(args);
      if (args?.p_student_id === mockHeldStudent && mockHeldStudent) {
        await new Promise<void>((resolve) => {
          mockResumeRead = resolve;
        });
      }
      if (name === "onboarding_journeys_read" && mockReaderMissing)
        return { data: null, error: { code: "PGRST202" } };
      return {
        data: args?.p_student_id
          ? mockJourneys.filter((item) => item.student_id === args.p_student_id)
          : args?.p_cohort === "new"
            ? mockJourneys.filter(
                (item) => !item.historical && !item.is_returning,
              )
            : mockJourneys,
        error: null,
      };
    },
    from: () => {
      let ids: string[] = [];
      const request = {
        select: () => request,
        in: (_column: string, values: string[]) => {
          ids = values;
          return request;
        },
        then: (resolve: (value: unknown) => unknown) =>
          Promise.resolve({
            data: ids.map((id) => ({ id, status: "TRIAL", deleted_at: null })),
            error: null,
          }).then(resolve),
      };
      return request;
    },
  }),
}));

function wrapper({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      {children}
    </QueryClientProvider>
  );
}

it("loads only the current student's onboarding without requesting the whole board", async () => {
  const { result } = renderHook(
    () => useOnboardingJourneys({ studentId: "wanted" }),
    { wrapper },
  );
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(result.current.data?.map((item) => item.id)).toEqual(["wanted"]);
  expect(mockReads).not.toContain("onboarding_journeys_board");
});

it("requests only the visible conversion cohort instead of rebuilding all onboarding journeys", async () => {
  mockReads.length = 0;
  mockScopes.length = 0;
  render(<ConversionInsights from="2026-09-01" to="2026-09-30" />, { wrapper });
  await waitFor(() =>
    expect(
      screen.getByText("Identified enquiries").nextSibling,
    ).toHaveTextContent("1"),
  );
  expect(mockReads).not.toContain("onboarding_journeys_board");
  expect(mockScopes).toContainEqual({
    p_from: "2026-09-01",
    p_to: "2026-09-30",
    p_cohort: "new",
  });
});

it("keeps a Student profile available while the new database reader is not deployed yet", async () => {
  mockReaderMissing = true;
  const { result } = renderHook(
    () => useOnboardingJourneys({ studentId: "wanted" }),
    { wrapper },
  );
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(result.current.data?.map((item) => item.id)).toEqual(["wanted"]);
  mockReaderMissing = false;
});

it("does not show another Student's journey while a scoped navigation is loading", async () => {
  const { result, rerender, unmount } = renderHook(
    ({ id }) => useOnboardingJourneys({ studentId: id }),
    {
      wrapper,
      initialProps: { id: "wanted" },
    },
  );
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  mockHeldStudent = "unrelated";
  rerender({ id: "unrelated" });
  await waitFor(() => expect(mockResumeRead).toBeDefined());
  try {
    expect(result.current.data).toBeUndefined();
  } finally {
    mockResumeRead?.();
    mockHeldStudent = undefined;
    unmount();
  }
});
