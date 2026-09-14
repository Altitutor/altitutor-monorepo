import { renderHook, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useWorkItemRevision } from "../operations";
jest.mock("@/shared/lib/supabase/client", () => ({
  getSupabaseClient: jest.fn(),
}));

test("a persistently mounted dialog accepts the current baseline only after closing and reopening", async () => {
  const cache = new QueryClient();
  cache.setQueryData(["templates"], [{ id: "template", admin_revision: 1 }]);
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={cache}>{children}</QueryClientProvider>
  );
  const { result, rerender } = renderHook(
    ({ open }) => useWorkItemRevision(open),
    { wrapper, initialProps: { open: true } },
  );
  act(() => {
    cache.setQueryData(["templates"], [{ id: "template", admin_revision: 2 }]);
  });
  const staleSave = jest.fn().mockRejectedValue(new Error("Conflict"));
  await expect(result.current("template", staleSave)).rejects.toThrow(
    "Conflict",
  );
  expect(staleSave).toHaveBeenCalledWith(1);
  rerender({ open: false });
  rerender({ open: true });
  const save = jest
    .fn()
    .mockResolvedValue({ id: "template", admin_revision: 3 });
  await result.current("template", save);
  expect(save).toHaveBeenCalledWith(2);
});
