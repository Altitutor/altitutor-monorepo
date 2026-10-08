import { randomUUID } from "crypto";
import { StrictMode } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useForm, type FieldValues } from "react-hook-form";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useWorkItemEditor } from "../useWorkItemEditor";
import {
  patchWorkItem,
  readWorkItem,
  deleteWorkItem,
  type EditKind,
  type EditRecord,
  type WorkItemSnapshot,
} from "../api";
import {
  taskFromRecord,
  taskToRecord,
  issueFromRecord,
  issueToRecord,
  projectFromRecord,
  projectToRecord,
  documentFromRecord,
  documentToRecord,
} from "../fields";

jest.mock("../api", () => ({
  patchWorkItem: jest.fn(),
  readWorkItem: jest.fn(),
  deleteWorkItem: jest.fn(),
}));
const patch = jest.mocked(patchWorkItem);
const read = jest.mocked(readWorkItem);
const remove = jest.mocked(deleteWorkItem);
const richText = (text: string) => ({
  type: "doc",
  content: [
    { type: "paragraph", content: text ? [{ type: "text", text }] : [] },
  ],
});
const original: EditRecord = {
  title: "Existing",
  name: "Existing",
  description: richText("Important work"),
  content: richText("Important work"),
  status: "backlog",
  priority: 0,
  admin_revision: 1,
};
const changed = richText("New writing");
const empty = richText("");
const snapshot = (record: EditRecord = original): WorkItemSnapshot => ({
  record,
  user_id: "user",
  conflicts: [],
});
let server: EditRecord;
const converters = {
  task: { fromRecord: taskFromRecord, toRecord: taskToRecord },
  issue: { fromRecord: issueFromRecord, toRecord: issueToRecord },
  project: { fromRecord: projectFromRecord, toRecord: projectToRecord },
  document: { fromRecord: documentFromRecord, toRecord: documentToRecord },
};
function setup(kind: EditKind = "task", strict = false, initialId = "one") {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const close = jest.fn();
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>
      {strict ? <StrictMode>{children}</StrictMode> : children}
    </QueryClientProvider>
  );
  const mapping = converters[kind] as unknown as {
    fromRecord: (record: EditRecord) => FieldValues;
    toRecord: (values: FieldValues) => EditRecord;
  };
  return {
    close,
    ...renderHook(
      ({ id }) => {
        const form = useForm<FieldValues>({
          defaultValues: {
            title: "",
            description: null,
            name: "",
            content: "",
          },
        });
        const editor = useWorkItemEditor({
          kind,
          id,
          form,
          ...mapping,
          onClose: close,
        });
        return { form, editor };
      },
      { wrapper, initialProps: { id: initialId } },
    ),
  };
}
const ready = async (result: ReturnType<typeof setup>["result"]) => {
  await waitFor(() => expect(result.current.editor.editable).toBe(true));
};
const tick = async (ms: number) => {
  await act(async () => {
    jest.advanceTimersByTime(ms);
  });
};
const edit = (
  result: ReturnType<typeof setup>["result"],
  name: string,
  value: unknown,
) => {
  act(() =>
    result.current.form.setValue(name, value, {
      shouldDirty: true,
      shouldTouch: true,
    }),
  );
};
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

beforeAll(() => {
  Object.defineProperty(globalThis.crypto, "randomUUID", {
    value: randomUUID,
    configurable: true,
  });
});
beforeEach(() => {
  jest.useFakeTimers();
  sessionStorage.clear();
  patch.mockReset();
  read.mockReset();
  remove.mockReset();
  server = { ...original };
  read.mockImplementation(async () => snapshot(server));
  patch.mockImplementation(async (_kind, _id, changes) => {
    server = {
      ...server,
      ...changes,
      admin_revision: Number(server.admin_revision) + 1,
    };
    return snapshot(server);
  });
});
afterEach(() => {
  jest.useRealTimers();
});

it.each<EditKind>(["task", "issue", "project", "document"])(
  "%s loads and refreshes existing text without saving",
  async (kind) => {
    const { result } = setup(kind);
    await ready(result);
    expect(
      result.current.form.getValues(
        kind === "document" ? "content" : "description",
      ),
    ).toEqual(original.description);
    await tick(20000);
    expect(patch).not.toHaveBeenCalled();
    expect(result.current.editor.dirty).toBe(false);
  },
);
it("Strict Mode and programmatic initialization never save an empty description", async () => {
  const { result } = setup("task", true);
  await ready(result);
  act(() => result.current.form.setValue("description", empty));
  await tick(2000);
  expect(patch).not.toHaveBeenCalled();
});
it("debounces typing but saves metadata alone immediately", async () => {
  const { result } = setup();
  await ready(result);
  edit(result, "description", changed);
  await tick(300);
  edit(result, "priority", 2);
  await tick(0);
  expect(patch.mock.calls[0][2]).toEqual({ priority: 2 });
  expect(patch.mock.calls[0][3]).toEqual({ priority: 0 });
  expect(result.current.form.getValues("description")).toEqual(changed);
  await tick(300);
  expect(patch.mock.calls[1][2]).toEqual({ description: changed });
  expect(result.current.editor.dirty).toBe(false);
});
it.each<EditKind>(["task", "issue", "project", "document"])(
  "%s acknowledges a save without replacing the unchanged form content",
  async (kind) => {
    patch.mockImplementation(async (_kind, _id, changes) => {
      server = JSON.parse(
        JSON.stringify({
          ...server,
          ...changes,
          admin_revision: Number(server.admin_revision) + 1,
        }),
      ) as EditRecord;
      return snapshot(server);
    });
    const { result } = setup(kind);
    await ready(result);
    const field = kind === "document" ? "content" : "description";
    edit(result, field, changed);
    const localContent = result.current.form.getValues(field);
    await tick(600);
    expect(result.current.editor.dirty).toBe(false);
    expect(result.current.form.getValues(field)).toBe(localContent);
  },
);
it("saves intentional clearing and ignores JSON key order", async () => {
  const { result } = setup();
  await ready(result);
  edit(result, "description", {
    content: [
      {
        content: [{ text: "Important work", type: "text" }],
        type: "paragraph",
      },
    ],
    type: "doc",
  });
  await tick(1000);
  expect(patch).not.toHaveBeenCalled();
  edit(result, "description", empty);
  await tick(600);
  expect(patch.mock.calls[0][2]).toEqual({ description: empty });
});
it("serializes saves and keeps newer typing while a request is in flight", async () => {
  const first = deferred<WorkItemSnapshot>();
  patch.mockImplementationOnce(() => first.promise);
  const { result } = setup();
  await ready(result);
  edit(result, "description", changed);
  await tick(600);
  expect(result.current.editor.editable).toBe(true);
  const newer = richText("Even newer writing");
  edit(result, "description", newer);
  await tick(600);
  expect(patch).toHaveBeenCalledTimes(1);
  await act(async () => {
    server = { ...server, description: changed, admin_revision: 2 };
    first.resolve(snapshot(server));
  });
  await tick(0);
  expect(patch.mock.calls[1][2]).toEqual({ description: newer });
  expect(patch.mock.calls[1][3]).toEqual({ description: changed });
  expect(result.current.form.getValues("description")).toEqual(newer);
});
it("saves an intentional undo made while the previous value is saving", async () => {
  const first = deferred<WorkItemSnapshot>();
  patch.mockImplementationOnce(() => first.promise);
  const { result } = setup();
  await ready(result);
  edit(result, "description", changed);
  await tick(600);
  edit(result, "description", original.description);
  await act(async () => {
    server = { ...server, description: changed, admin_revision: 2 };
    first.resolve(snapshot(server));
  });
  await tick(600);
  expect(patch.mock.calls[1][2]).toEqual({ description: original.description });
  expect(server.description).toEqual(original.description);
});
it("a same-field conflict never overwrites local text; unrelated properties can still save", async () => {
  const latest = richText("Someone else’s work");
  patch.mockImplementationOnce(async () => {
    server = { ...server, description: latest, admin_revision: 2 };
    return { ...snapshot(server), conflicts: ["description"] };
  });
  const { result } = setup();
  await ready(result);
  edit(result, "description", changed);
  await tick(600);
  expect(result.current.editor.conflicts).toEqual(["description"]);
  expect(result.current.form.getValues("description")).toEqual(changed);
  await tick(10000);
  expect(patch).toHaveBeenCalledTimes(1);
  edit(result, "priority", 3);
  await tick(0);
  expect(patch.mock.calls[1][2]).toEqual({ priority: 3 });
  act(() => result.current.editor.resolveConflict("description", true));
  await tick(0);
  expect(patch.mock.calls[2][3]).toEqual({ description: latest });
  expect(result.current.editor.conflicts).toEqual([]);
});
it("Use latest replaces only the conflicting field without writing it", async () => {
  const latest = richText("Latest");
  patch.mockResolvedValueOnce({
    ...snapshot({ ...original, description: latest, admin_revision: 2 }),
    conflicts: ["description"],
  });
  const { result } = setup();
  await ready(result);
  edit(result, "description", changed);
  await tick(600);
  act(() => result.current.editor.resolveConflict("description", false));
  await tick(1000);
  expect(result.current.form.getValues("description")).toEqual(latest);
  expect(patch).toHaveBeenCalledTimes(1);
  expect(result.current.editor.dirty).toBe(false);
});
it("retries an uncertain request with the same key before sending newer edits", async () => {
  patch.mockRejectedValueOnce(new Error("Offline"));
  const { result } = setup();
  await ready(result);
  edit(result, "description", changed);
  await tick(600);
  const first = patch.mock.calls[0];
  edit(result, "description", richText("Newer"));
  await act(async () => {
    await result.current.editor.save();
  });
  expect(patch.mock.calls[1]).toEqual(first);
  expect(patch.mock.calls[2][2]).toEqual({ description: richText("Newer") });
  expect(sessionStorage.length).toBe(0);
});
it("restores one automatic recovery copy with its original expectations", async () => {
  patch.mockRejectedValueOnce(new Error("Offline"));
  const first = setup();
  await ready(first.result);
  edit(first.result, "description", changed);
  await tick(600);
  const firstCall = patch.mock.calls[0];
  first.unmount();
  expect(sessionStorage.length).toBe(1);
  const next = setup();
  await ready(next.result);
  await tick(0);
  expect(patch.mock.calls[1]).toEqual(firstCall);
  expect(next.result.current.form.getValues("description")).toEqual(changed);
  expect(sessionStorage.length).toBe(0);
});
it("closing flushes pending typing and only asks if saving fails", async () => {
  const { result, close } = setup();
  await ready(result);
  edit(result, "description", changed);
  await act(async () => {
    await result.current.editor.requestClose();
  });
  expect(close).toHaveBeenCalledTimes(1);
  expect(result.current.editor.closeRequested).toBe(false);
  patch.mockRejectedValueOnce(new Error("Offline"));
  edit(result, "description", empty);
  await act(async () => {
    await result.current.editor.requestClose();
  });
  expect(close).toHaveBeenCalledTimes(1);
  expect(result.current.editor.closeRequested).toBe(true);
});
it("switching records ignores a late load from the previous record", async () => {
  const old = deferred<WorkItemSnapshot>();
  read.mockImplementationOnce(() => old.promise);
  const { result, rerender } = setup();
  rerender({ id: "two" });
  await ready(result);
  await act(async () => {
    old.resolve(snapshot({ ...original, title: "Old record" }));
  });
  expect(result.current.form.getValues("title")).toBe("Existing");
  expect(patch).not.toHaveBeenCalled();
});
it("deleting uses a short transaction rather than a persistent editor lease", async () => {
  const { result, close } = setup();
  await ready(result);
  await act(async () => {
    await result.current.editor.remove();
  });
  expect(remove).toHaveBeenCalledWith("task", "one");
  expect(close).toHaveBeenCalled();
});

it("an older retry receipt reconciles the saved field without reverting a newer server refresh", async () => {
  const saved = snapshot({
    ...original,
    description: changed,
    admin_revision: 2,
  });
  patch.mockRejectedValueOnce(new Error("Response lost"));
  patch.mockResolvedValueOnce(saved);
  const { result } = setup();
  await ready(result);
  edit(result, "description", changed);
  await tick(600);
  server = {
    ...original,
    description: changed,
    priority: 3,
    admin_revision: 3,
  };
  await tick(10000);
  await act(async () => {
    await result.current.editor.save();
  });
  expect(patch).toHaveBeenCalledTimes(2);
  expect(result.current.form.getValues("priority")).toBe(3);
  expect(result.current.editor.dirty).toBe(false);
});

it("a delayed refresh cannot overwrite a newer save", async () => {
  const stale = deferred<WorkItemSnapshot>();
  const { result } = setup();
  await ready(result);
  read.mockImplementationOnce(() => stale.promise);
  await tick(10000);
  edit(result, "description", changed);
  await tick(600);
  await act(async () => {
    stale.resolve(snapshot(original));
  });
  expect(result.current.form.getValues("description")).toEqual(changed);
  expect(result.current.editor.dirty).toBe(false);
});

it("a custom selector can return to its initial form default after an earlier save", async () => {
  const { result } = setup();
  await ready(result);
  edit(result, "projectId", "11111111-1111-4111-8111-111111111111");
  await tick(0);
  edit(result, "projectId", null);
  await tick(0);
  expect(patch.mock.calls[1][2]).toEqual({ project_id: null });
  expect(patch.mock.calls[1][3]).toEqual({
    project_id: "11111111-1111-4111-8111-111111111111",
  });
});
