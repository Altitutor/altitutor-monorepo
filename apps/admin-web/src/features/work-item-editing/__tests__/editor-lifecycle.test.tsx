import { randomUUID } from "crypto";
import { StrictMode } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useForm } from "react-hook-form";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useWorkItemEditor } from "../useWorkItemEditor";
import { editOperation, type EditSession } from "../api";
import { taskFromRecord, taskToRecord } from "../fields";
import type { TaskFormData } from "@/features/tasks/types";
jest.mock("../api", () => ({ editOperation: jest.fn() }));
const rpc = jest.mocked(editOperation);
const original = {
  title: "Existing",
  description: {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [{ type: "text", text: "Important work" }],
      },
    ],
  },
  status: "todo",
  priority: 0,
};
const changed = {
  type: "doc",
  content: [
    { type: "paragraph", content: [{ type: "text", text: "New writing" }] },
  ],
};
const owned: EditSession = {
  record: original,
  preview: null,
  user_id: "user",
  owner: "Alice",
  token: "token",
  can_edit: true,
  expires_at: "2099-01-01",
};
function setup(strict = false) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const close = jest.fn();
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>
      {strict ? <StrictMode>{children}</StrictMode> : children}
    </QueryClientProvider>
  );
  return {
    close,
    ...renderHook(
      () => {
        const form = useForm<TaskFormData>({
          defaultValues: { title: "", description: null },
        });
        const editor = useWorkItemEditor({
          kind: "task",
          id: "one",
          form,
          fromRecord: taskFromRecord,
          toRecord: taskToRecord,
          onClose: close,
        });
        return { form, editor };
      },
      { wrapper },
    ),
  };
}
beforeAll(() => {
  Object.defineProperty(globalThis.crypto, "randomUUID", {
    value: randomUUID,
    configurable: true,
  });
  globalThis.structuredClone = (value) => JSON.parse(JSON.stringify(value));
});
beforeEach(() => {
  localStorage.clear();
  rpc.mockReset();
  rpc.mockResolvedValue(owned);
});
it("opens directly for editing without writing an empty description", async () => {
  const { result } = setup();
  await waitFor(() => expect(result.current.editor.editable).toBe(true));
  expect(result.current.form.getValues("description")).toEqual(
    original.description,
  );
  expect(rpc.mock.calls.map((call) => call[2])).toEqual(["acquire"]);
  expect(result.current.editor.dirty).toBe(false);
});
it("releases an abandoned acquisition before Strict Mode opens the editor again", async () => {
  let held = false;
  rpc.mockImplementation(async (_kind, _id, action) => {
    if (action === "release") held = false;
    if (action === "acquire") {
      if (held) return { ...owned, token: null, can_edit: false };
      held = true;
    }
    return owned;
  });
  const { result } = setup(true);
  await waitFor(() => expect(result.current.editor.editable).toBe(true));
  expect(rpc.mock.calls.map(call => call[2])).toEqual([
    "acquire", "release", "acquire",
  ]);
});
it("does not treat rich-text JSON key ordering as a user edit", async () => {
  const { result } = setup();
  await waitFor(() => expect(result.current.editor.editable).toBe(true));
  act(() => result.current.form.setValue("description", {
    content: [{ content: [{ text: "Important work", type: "text" }], type: "paragraph" }],
    type: "doc",
  }));
  expect(result.current.editor.dirty).toBe(false);
  expect(localStorage.length).toBe(0);
});
it("typing stays a draft until explicit save, and close asks before discarding it", async () => {
  const { result, close } = setup();
  await waitFor(() => expect(result.current.editor.editable).toBe(true));
  act(() => result.current.form.setValue("description", changed));
  act(() => result.current.editor.requestClose());
  expect(close).not.toHaveBeenCalled();
  expect(result.current.editor.closeRequested).toBe(true);
  expect(localStorage.length).toBe(1);
  expect(rpc.mock.calls.some((call) => call[2] === "save")).toBe(false);
  rpc.mockImplementation(async (_kind, _id, action, _token, changes) =>
    action === "save"
      ? { ...owned, record: { ...original, ...changes } }
      : owned,
  );
  await act(async () => {
    expect(await result.current.editor.save()).toBe(true);
  });
  expect(rpc).toHaveBeenCalledWith(
    "task",
    "one",
    "save",
    "token",
    expect.objectContaining({ description: changed }),
    expect.any(String),
  );
  expect(result.current.editor.dirty).toBe(false);
  expect(localStorage.length).toBe(0);
});
it("a failed save preserves text and the recoverable draft across unmount", async () => {
  const { result, unmount } = setup();
  await waitFor(() => expect(result.current.editor.editable).toBe(true));
  act(() => result.current.form.setValue("description", changed));
  rpc.mockRejectedValueOnce(new Error("Offline"));
  await act(async () => {
    expect(await result.current.editor.save()).toBe(false);
  });
  expect(result.current.form.getValues("description")).toEqual(changed);
  expect(result.current.editor.dirty).toBe(true);
  unmount();
  expect(localStorage.length).toBe(1);
  const reopened = setup();
  await waitFor(() =>
    expect(reopened.result.current.editor.recovery).toHaveLength(1),
  );
  expect(reopened.result.current.form.getValues("description")).toEqual(
    original.description,
  );
});
it("an expired lease cannot publish or automatically reacquire against newer content", async () => {
  const { result } = setup();
  await waitFor(() => expect(result.current.editor.editable).toBe(true));
  act(() => result.current.form.setValue("description", changed));
  rpc.mockRejectedValueOnce(
    Object.assign(new Error("Expired"), { code: "55P03" }),
  );
  await act(async () => {
    await result.current.editor.save();
  });
  expect(result.current.editor.editable).toBe(false);
  expect(result.current.form.getValues("description")).toEqual(changed);
  const calls = rpc.mock.calls.length;
  await act(async () => {
    await result.current.editor.acquire();
    await result.current.editor.save();
  });
  expect(rpc.mock.calls.length).toBe(calls);
  expect(localStorage.length).toBe(1);
});
it("another editor opens read-only and sees the unsaved preview without publishing it", async () => {
  rpc.mockResolvedValue({
    ...owned,
    can_edit: false,
    token: null,
    preview: { description: changed },
  });
  const { result } = setup();
  await waitFor(() => expect(result.current.editor.session).not.toBeNull());
  expect(result.current.editor.editable).toBe(false);
  expect(result.current.form.getValues("description")).toEqual(changed);
  expect(result.current.editor.dirty).toBe(false);
  expect(rpc.mock.calls.map((call) => call[2])).toEqual(["acquire"]);
});
