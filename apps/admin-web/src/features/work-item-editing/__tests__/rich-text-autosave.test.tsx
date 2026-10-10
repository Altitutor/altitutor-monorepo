import { act, render, waitFor } from "@testing-library/react";
import type { Editor } from "@tiptap/react";
import { RichTextEditor } from "@altitutor/ui/components/rich-text-editor";
import { randomUUID } from "crypto";
import { Controller, useForm, type FieldValues } from "react-hook-form";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useWorkItemEditor } from "../useWorkItemEditor";
import {
  patchWorkItem,
  readWorkItem,
  type EditKind,
  type EditRecord,
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
beforeAll(() => {
  Object.defineProperty(globalThis.crypto, "randomUUID", {
    value: randomUUID,
    configurable: true,
  });
});
beforeEach(() => {
  jest.clearAllMocks();
  sessionStorage.clear();
});

// jsonb save responses can serialize the same document with a different key order.
const savedJson = <T,>(value: T): T =>
  JSON.parse(
    JSON.stringify(value, (_key, item: unknown) =>
      item && typeof item === "object" && !Array.isArray(item)
        ? Object.fromEntries(Object.entries(item).reverse())
        : item,
    ),
  ) as T;

it.each([false, true])(
  "keeps the typing position for a saved JSON echo (serialized: %s)",
  async (serialized) => {
    let editor: Editor | undefined;
    const onChange = jest.fn();
    const props = {
      editable: true,
      onChange,
      onChangeDebounceMs: 0,
      onEditorReady: (next: Editor) => {
        editor = next;
      },
    };
    const content = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "Start middle end" }],
        },
      ],
    };
    const { rerender } = render(
      <RichTextEditor {...props} content={content} />,
    );
    await waitFor(() => expect(editor).toBeDefined());
    act(() => {
      editor?.commands.setTextSelection(7);
      editor?.commands.insertContent("X");
    });
    const position = editor!.state.selection.from;
    const saved = savedJson(editor!.getJSON());
    rerender(
      <RichTextEditor
        {...props}
        content={serialized ? JSON.stringify(saved) : saved}
      />,
    );
    expect(editor!.state.selection.from).toBe(position);
    act(() => {
      editor?.commands.insertContent("Y");
    });
    expect(editor!.getText()).toBe("Start XYmiddle end");
    expect(onChange).toHaveBeenCalledTimes(2);
  },
);

it("keeps a text selection when unchanged saved content refreshes before typing", async () => {
  let editor: Editor | undefined;
  const onChange = jest.fn();
  const props = {
    editable: true,
    onChange,
    onEditorReady: (next: Editor) => {
      editor = next;
    },
  };
  const content = {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [{ type: "text", text: "Start middle end" }],
      },
    ],
  };
  const { rerender } = render(<RichTextEditor {...props} content={content} />);
  await waitFor(() => expect(editor).toBeDefined());
  act(() => {
    editor?.commands.setTextSelection({ from: 7, to: 13 });
  });
  rerender(
    <RichTextEditor {...props} content={savedJson(editor!.getJSON())} />,
  );
  expect(editor!.state.selection.from).toBe(7);
  expect(editor!.state.selection.to).toBe(13);
  expect(onChange).not.toHaveBeenCalled();
});

it.each<EditKind>(["task", "issue", "project", "document"])(
  "%s autosave keeps the caret and continuing edits in the real editor",
  async (kind) => {
    const text = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "Start middle end" }],
        },
      ],
    };
    let server: EditRecord = {
      title: "Item",
      name: "Item",
      description: text,
      content: text,
      status: "backlog",
      priority: 0,
      admin_revision: 1,
    };
    jest
      .mocked(readWorkItem)
      .mockImplementation(async () => ({
        record: server,
        user_id: "user",
        conflicts: [],
      }));
    jest
      .mocked(patchWorkItem)
      .mockImplementation(async (_kind, _id, changes) => {
        server = savedJson({
          ...server,
          ...changes,
          admin_revision: Number(server.admin_revision) + 1,
        });
        return { record: server, user_id: "user", conflicts: [] };
      });
    const mappings = {
      task: { fromRecord: taskFromRecord, toRecord: taskToRecord },
      issue: { fromRecord: issueFromRecord, toRecord: issueToRecord },
      project: { fromRecord: projectFromRecord, toRecord: projectToRecord },
      document: { fromRecord: documentFromRecord, toRecord: documentToRecord },
    };
    const mapping = mappings[kind] as unknown as {
      fromRecord: (record: EditRecord) => FieldValues;
      toRecord: (values: FieldValues) => EditRecord;
    };
    let editor: Editor | undefined;
    let flush = async () => false;
    function Harness() {
      const form = useForm<FieldValues>({
        defaultValues: { description: null, content: "" },
      });
      const controller = useWorkItemEditor({
        kind,
        id: "one",
        form,
        ...mapping,
        onClose: () => undefined,
      });
      flush = controller.save;
      return (
        <Controller
          control={form.control}
          name={kind === "document" ? "content" : "description"}
          render={({ field }) => (
            <RichTextEditor
              content={field.value || ""}
              onChange={field.onChange}
              onChangeDebounceMs={0}
              editable={controller.editable}
              onEditorReady={(next) => {
                editor = next;
              }}
            />
          )}
        />
      );
    }
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const { unmount } = render(
      <QueryClientProvider client={client}>
        <Harness />
      </QueryClientProvider>,
    );
    await waitFor(() => expect(editor?.getText()).toBe("Start middle end"));
    expect(patchWorkItem).not.toHaveBeenCalled();
    act(() => {
      editor?.commands.setTextSelection(7);
      editor?.commands.insertContent("X");
    });
    const position = editor!.state.selection.from;
    await act(async () => {
      expect(await flush()).toBe(true);
    });
    expect(editor!.state.selection.from).toBe(position);
    act(() => {
      editor?.commands.insertContent("Y");
    });
    expect(editor!.getText()).toBe("Start XYmiddle end");
    await act(async () => {
      expect(await flush()).toBe(true);
    });
    expect(server[kind === "document" ? "content" : "description"]).toEqual(
      editor!.getJSON(),
    );
    expect(patchWorkItem).toHaveBeenCalledTimes(2);
    unmount();
  },
);

it("rich-text hydration and editability changes never emit edits; typing and clearing do", async () => {
  const onChange = jest.fn();
  let editor: Editor | undefined;
  const props = {
    onChange,
    onChangeDebounceMs: 0,
    onEditorReady: (next: Editor) => {
      editor = next;
    },
  };
  const initial = {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [{ type: "text", text: "Important description" }],
      },
    ],
  };
  const { rerender } = render(
    <RichTextEditor {...props} content={initial} editable />,
  );
  await waitFor(() => expect(editor).toBeDefined());
  expect(onChange).not.toHaveBeenCalled();
  rerender(<RichTextEditor {...props} content={initial} editable={false} />);
  rerender(<RichTextEditor {...props} content={initial} editable />);
  expect(onChange).not.toHaveBeenCalled();
  const refreshed = {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [{ type: "text", text: "Refreshed description" }],
      },
    ],
  };
  rerender(<RichTextEditor {...props} content={refreshed} editable />);
  expect(onChange).not.toHaveBeenCalled();
  expect(editor?.getText()).toBe("Refreshed description");
  act(() => {
    editor?.commands.insertContent("A real edit");
  });
  expect(onChange).toHaveBeenCalledTimes(1);
  act(() => {
    editor?.commands.clearContent();
  });
  expect(onChange).toHaveBeenCalledTimes(2);
});
