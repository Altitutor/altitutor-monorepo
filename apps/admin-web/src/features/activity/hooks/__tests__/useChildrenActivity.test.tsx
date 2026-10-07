import type { ReactNode } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { activityApi } from "../../api";
import { childActivitySourceId } from "../../lib/entityCommunication";
import { useChildrenActivity } from "../useChildrenActivity";

jest.mock("../../api", () => ({
  activityApi: { getStudentActivity: jest.fn() },
}));

it("loads only selected children and paginates their feeds independently", async () => {
  jest
    .mocked(activityApi.getStudentActivity)
    .mockImplementation(async (_id, _limit, offset) => ({
      events: [],
      relatedEntities: {},
      total: 0,
      hasMore: offset === 0,
    }));
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const children = [
    { id: "alex", label: "Alex" },
    { id: "sam", label: "Sam" },
  ];
  const { result, rerender } = renderHook(
    ({ sources }) => useChildrenActivity(children, sources, true),
    {
      wrapper,
      initialProps: { sources: [childActivitySourceId("alex")] },
    },
  );
  await waitFor(() => expect(result.current.hasMore).toBe(true));
  expect(activityApi.getStudentActivity).toHaveBeenCalledWith("alex", 50, 0);
  expect(activityApi.getStudentActivity).not.toHaveBeenCalledWith("sam", 50, 0);
  act(() => result.current.loadMore());
  await waitFor(() => expect(result.current.hasMore).toBe(false));
  expect(activityApi.getStudentActivity).toHaveBeenCalledWith("alex", 50, 50);
  rerender({ sources: [childActivitySourceId("sam")] });
  await waitFor(() => expect(result.current.hasMore).toBe(true));
  expect(result.current.feeds.map((feed) => feed.child.id)).toEqual(["sam"]);
  expect(activityApi.getStudentActivity).toHaveBeenCalledWith("sam", 50, 0);
});
