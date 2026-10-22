import * as React from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useTasks } from "@/features/tasks/api/queries";
import { tasksApi } from "@/features/tasks/api/tasks";

jest.mock("@/shared/hooks/useSupabaseRealtimeInvalidation", () => ({
  useSupabaseRealtimeInvalidation: jest.fn(),
}));
jest.mock("@/features/tasks/api/tasks", () => ({
  tasksApi: { list: jest.fn(async () => []) },
}));

it("keeps loaded task data when list and board represent an empty search differently", async () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const list = renderHook(() => useTasks({ status: ["todo"], search: "" }), {
    wrapper,
  });
  await waitFor(() => expect(list.result.current.isSuccess).toBe(true));
  list.unmount();
  const board = renderHook(
    () => useTasks({ status: ["todo"], search: undefined }),
    { wrapper },
  );
  expect(board.result.current.isLoading).toBe(false);
  expect(tasksApi.list).toHaveBeenCalledTimes(1);
  client.clear();
});
