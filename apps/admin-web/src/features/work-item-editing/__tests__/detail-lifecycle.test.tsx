import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createClient } from "@supabase/supabase-js";
import { useForm } from "react-hook-form";
import { useTaskDetailEditor } from "../useTaskDetailEditor";
import { taskFromRecord } from "../fields";
import type { TaskFormData } from "@/features/tasks/types";
import { useWorkItemDetail } from "../useWorkItemDetail";
import type { EditKind } from "../api";

jest.mock("@/shared/lib/supabase/client", () => ({ getSupabaseClient: () => client }));
let release: (() => void) | undefined;
let delayedId: string | undefined;
let missing = false;
let writes: string[];
const client = createClient("http://localhost:9999", "synthetic-key", {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { fetch: async (input, init) => {
    const url = new URL(String(input));
    if (url.pathname.endsWith("/tasks")) {
      const id = url.searchParams.get("id")?.replace("eq.", "") ?? "one";
      return { ok: true, status: 200, statusText: "OK", headers: new Headers(), text: async () => JSON.stringify({
        id, title: `Task ${id}`, assigned_to: "staff-one", project_id: "project-one",
        assignee: { id: "staff-one", first_name: "Admin", last_name: "User" },
        project: { id: "project-one", name: "Initial project" },
      }) } as Response;
    }
    const body = JSON.parse(String(init?.body)) as { p_id: string; p_action?: string };
    if (body.p_id === delayedId) await new Promise<void>((resolve) => { release = resolve; });
    if (body.p_action !== "read") writes.push(body.p_action ?? "patch");
    return {
      ok: !missing, status: missing ? 500 : 200, statusText: "OK", headers: new Headers(),
      text: async () => JSON.stringify(missing ? { code: "P0002", message: "Work item not found" } : {
        record: { id: body.p_id, name: `Saved ${body.p_id}`, admin_revision: 1 },
        user_id: "user", conflicts: [],
      }),
    } as Response;
  } },
});
const fromRecord = (r: Record<string, unknown>) => ({ name: String(r.name ?? "") });
const toRecord = (v: { name: string }) => ({ name: v.name });
type Detail = { id: string; label: string };
type Props = { id: string; data: Detail | null; enabled: boolean; kind: EditKind };
function setup(kind: EditKind) {
  const cache = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={cache}>{children}</QueryClientProvider>;
  return renderHook(({ id, data, enabled, kind }: Props) => {
    const form = useForm({ defaultValues: { name: "" } });
    const detail = useWorkItemDetail({ kind, id, enabled, form, fromRecord, toRecord,
      onClose: () => undefined, detail: { data, isLoading: false }, title: form.watch("name") });
    return { ...detail, form };
  }, { wrapper, initialProps: { id: "one", data: { id: "one", label: "Joined metadata" }, enabled: true, kind } as Props });
}
beforeEach(() => { writes = []; missing = false; delayedId = undefined; release = undefined; });

it.each(["task", "issue", "project"] as const)("%s retains metadata and local text when its detail disappears", async (kind) => {
  const { result, rerender } = setup(kind);
  await waitFor(() => expect(result.current.editor.editable).toBe(true));
  act(() => result.current.form.setValue("name", "Unsaved text", { shouldDirty: true, shouldTouch: true }));
  rerender({ id: "one", data: null, enabled: true, kind });
  expect(result.current.record?.label).toBe("Joined metadata");
  expect(result.current.title).toBe("Unsaved text");
  expect(result.current.isLoading).toBe(false);
  expect(writes).toEqual([]);
});

it("hides old text and metadata while the next record session is delayed", async () => {
  const { result, rerender } = setup("issue");
  await waitFor(() => expect(result.current.editor.editable).toBe(true));
  delayedId = "two";
  rerender({ id: "two", data: { id: "two", label: "Next metadata" }, enabled: true, kind: "issue" });
  expect(result.current.title).toBeUndefined();
  expect(result.current.editor.editable).toBe(false);
  expect(result.current.isLoading).toBe(true);
  await waitFor(() => expect(release).toBeDefined());
  await act(async () => { release?.(); });
  await waitFor(() => expect(result.current.title).toBe("Saved two"));
  expect(result.current.record?.label).toBe("Next metadata");
  expect(writes).toEqual([]);
});

it("does not reuse retained metadata after disable and re-enable", async () => {
  const { result, rerender } = setup("task");
  await waitFor(() => expect(result.current.editor.editable).toBe(true));
  rerender({ id: "one", data: null, enabled: false, kind: "task" });
  expect(result.current.record).toBeNull();
  expect(result.current.editor.editable).toBe(false);
  rerender({ id: "one", data: null, enabled: true, kind: "task" });
  await waitFor(() => expect(result.current.editor.editable).toBe(true));
  expect(result.current.record).toBeNull();
});

it("finishes loading when a record is unavailable on the first read", async () => {
  missing = true;
  const { result, rerender } = setup("project");
  rerender({ id: "one", data: null, enabled: true, kind: "project" });
  await waitFor(() => expect(result.current.editor.unavailable).toBe(true));
  expect(result.current.isLoading).toBe(false);
  expect(result.current.record).toBeNull();
  expect(result.current.editor.editable).toBe(false);
});


it("task selectors initialize once, preserve user selection on refresh and reset for another record", async () => {
  const cache = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={cache}>{children}</QueryClientProvider>;
  const { result, rerender } = renderHook(({ id, enabled }: { id: string; enabled: boolean }) => {
    const form = useForm<TaskFormData>({ defaultValues: taskFromRecord({}) });
    return useTaskDetailEditor({ id, enabled, form, onClose: () => undefined });
  }, { wrapper, initialProps: { id: "one", enabled: true } });
  await waitFor(() => expect(result.current.selectedAssignee?.first_name).toBe("Admin"));
  expect(result.current.selectedProject?.name).toBe("Initial project");
  act(() => {
    result.current.setSelectedAssignee(null);
    result.current.setSelectedProject({ id: "my-project", name: "My selection" });
  });
  await act(async () => { await cache.invalidateQueries({ queryKey: ["tasks"] }); });
  expect(result.current.selectedAssignee).toBeNull();
  expect(result.current.selectedProject?.name).toBe("My selection");
  rerender({ id: "two", enabled: true });
  await waitFor(() => expect(result.current.selectedAssignee?.first_name).toBe("Admin"));
  expect(result.current.selectedProject?.name).toBe("Initial project");
  rerender({ id: "two", enabled: false });
  expect(result.current.selectedAssignee).toBeNull();
  expect(result.current.selectedProject).toBeNull();
  rerender({ id: "two", enabled: true });
  await waitFor(() => expect(result.current.selectedAssignee?.first_name).toBe("Admin"));
  expect(writes).toEqual([]);
});
