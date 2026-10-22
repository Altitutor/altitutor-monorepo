import React, { type ReactNode } from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useOnboardingJourneys } from "../api/queries";
import { journey } from "./fixtures";

let mockFallback = false;
let mockStatusError = false;
let mockJourneys = [
  journey("trial"),
  journey("discontinued"),
  journey("family", null),
];
let mockStudents = [
  { id: "trial", status: "TRIAL" },
  { id: "discontinued", status: "DISCONTINUED" },
];

jest.mock("@/shared/lib/supabase/client", () => ({
  getSupabaseClient: () => ({
    rpc: async () =>
      mockFallback
        ? { data: null, error: { code: "PGRST202" } }
        : { data: mockJourneys, error: null },
    from: (table: string) => {
      let ids: string[] = [];
      let offset = 0;
      let end = 199;
      const query = {
        select: () => query,
        order: () => query,
        in: (_column: string, values: string[]) => {
          ids = values;
          return query;
        },
        range: (start: number, last: number) => {
          offset = start;
          end = last;
          return query;
        },
        then: (resolve: (value: unknown) => unknown) =>
          Promise.resolve(
            table === "students"
              ? {
                  data: mockStudents.filter((student) =>
                    ids.includes(student.id),
                  ),
                  error: mockStatusError
                    ? new Error("Status unavailable")
                    : null,
                }
              : {
                  data: mockJourneys.slice(offset, end + 1).map((item) => ({
                    ...item,
                    closed_evidence: item.evidence,
                    onboarding_action_preferences: [],
                  })),
                  error: null,
                },
          ).then(resolve),
      };
      return query;
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

it("loads current in-person status with RPC journeys and keeps family enquiries", async () => {
  const { result } = renderHook(() => useOnboardingJourneys(), { wrapper });
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(
    result.current.data?.map((item) => [item.id, item.student_status]),
  ).toEqual([
    ["trial", "TRIAL"],
    ["discontinued", "DISCONTINUED"],
    ["family", null],
  ]);
});

it("reads student statuses beyond a single bounded request", async () => {
  mockJourneys = Array.from({ length: 401 }, (_, index) =>
    journey(`student-${index}`),
  );
  mockStudents = mockJourneys.map((item) => ({
    id: item.id,
    status: item.id === "student-400" ? "DISCONTINUED" : "ACTIVE",
  }));
  const { result } = renderHook(() => useOnboardingJourneys(), { wrapper });
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(result.current.data).toHaveLength(401);
  expect(result.current.data?.[400].student_status).toBe("DISCONTINUED");
});

it("reports a status-read failure instead of treating everyone as current", async () => {
  mockStatusError = true;
  const { result } = renderHook(() => useOnboardingJourneys(), { wrapper });
  await waitFor(() => expect(result.current.isError).toBe(true));
  expect(result.current.error?.message).toBe("Status unavailable");
  mockStatusError = false;
});

it("also enriches fallback journeys when the board RPC is unavailable", async () => {
  mockFallback = true;
  mockJourneys = [journey("discontinued"), journey("family", null)];
  mockStudents = [{ id: "discontinued", status: "DISCONTINUED" }];
  const { result } = renderHook(() => useOnboardingJourneys(), { wrapper });
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(
    result.current.data?.map((item) => [item.id, item.student_status]),
  ).toEqual([
    ["discontinued", "DISCONTINUED"],
    ["family", null],
  ]);
});
