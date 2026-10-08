import { randomUUID } from "crypto";
import { act, render, screen, waitFor } from "@testing-library/react";
import { Controller, useForm, type FieldValues } from "react-hook-form";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { Editor } from "@tiptap/react";
import type { JSONContent } from "@altitutor/ui";
import { AdminRichTextEditorWithImages } from "@/features/rich-text-images/components/AdminRichTextEditorWithImages";
import { useWorkItemEditor } from "../useWorkItemEditor";
import { EditorStatus, WorkItemEditableContext } from "../EditorControls";
import {
  patchWorkItem,
  readWorkItem,
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
jest.mock("@/shared/hooks/useSlashCommandSuggestions", () => ({
  useSlashCommandSuggestions: () => [],
}));
jest.mock(
  "@/features/rich-text-images/hooks/useAdminRichTextImageUpload",
  () => ({
    useAdminRichTextImageUpload: () => ({
      handlePasteImages: jest.fn(),
      handleDrop: jest.fn(),
    }),
  }),
);

const jsonb = <T,>(value: T): T =>
  JSON.parse(
    JSON.stringify(value, (_key, item: unknown) =>
      item && typeof item === "object" && !Array.isArray(item)
        ? Object.fromEntries(Object.entries(item).reverse())
        : item,
    ),
  ) as T;
const mappings = {
  task: { fromRecord: taskFromRecord, toRecord: taskToRecord },
  issue: { fromRecord: issueFromRecord, toRecord: issueToRecord },
  project: { fromRecord: projectFromRecord, toRecord: projectToRecord },
  document: { fromRecord: documentFromRecord, toRecord: documentToRecord },
};
beforeAll(() => {
  Object.defineProperty(globalThis.crypto, "randomUUID", {
    value: randomUUID,
    configurable: true,
  });
});
beforeEach(() => {
  jest.clearAllMocks();
  sessionStorage.clear();
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      signedUrls: [
        "https://example.supabase.co/storage/v1/object/sign/admin-rich-text-images/tasks/image.png?token=fresh",
      ],
    }),
  });
});

it.each([false, true])(
  "the real wrapper preserves selection for a save echo without refreshing images (images: %s)",
  async (withImages) => {
    let editor: Editor | undefined;
    const onChange = jest.fn();
    const props = {
      onChange,
      context: "tasks" as const,
      onChangeDebounceMs: 0,
      onEditorReady: (next: Editor) => {
        editor = next;
      },
    };
    const content: JSONContent = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "Start middle end" }],
        },
        ...(withImages
          ? [
              {
                type: "image",
                attrs: {
                  src: "https://example.supabase.co/storage/v1/object/sign/admin-rich-text-images/tasks/image.png?token=expired",
                },
              },
            ]
          : []),
      ],
    };
    const { rerender } = render(
      <AdminRichTextEditorWithImages {...props} content={content} />,
    );
    await waitFor(() => {
      expect(editor?.getText().trim()).toBe("Start middle end");
      expect(editor?.isDestroyed).toBe(false);
      expect(
        screen.queryByLabelText("Loading editor images"),
      ).not.toBeInTheDocument();
      if (withImages) {
        expect(
          editor?.getJSON().content?.find((node) => node.type === "image")
            ?.attrs?.src,
        ).toContain("token=fresh");
      }
    });
    act(() => {
      editor?.commands.setTextSelection(7);
      editor?.commands.insertContent("X");
      editor?.commands.setTextSelection({ from: 8, to: 14 });
    });
    const editorBefore = editor;
    const echoed = jsonb(onChange.mock.calls[0][0] as JSONContent);
    const replacements: string[] = [];
    editor!.on("transaction", ({ transaction }) => {
      if (transaction.docChanged) replacements.push(editor!.getText());
    });
    rerender(<AdminRichTextEditorWithImages {...props} content={echoed} />);
    expect(editor).toBe(editorBefore);
    expect(editor!.state.selection.from).toBe(8);
    expect(editor!.state.selection.to).toBe(14);
    expect(replacements).toEqual([]);
    expect(fetch).toHaveBeenCalledTimes(withImages ? 1 : 0);
    expect(onChange).toHaveBeenCalledTimes(1);
    act(() => {
      editor?.commands.insertContent("Y");
    });
    expect(editor!.getText().trim()).toBe("Start XY end");
  },
);

it.each<EditKind>(["task", "issue", "project", "document"])(
  "%s preserves the caret when the production wrapper goes from Saving to Saved after debounce",
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
    let completeSave: (value: WorkItemSnapshot) => void = () => undefined;
    jest.mocked(readWorkItem).mockImplementation(async () => ({
      record: server,
      user_id: "user",
      conflicts: [],
    }));
    jest.mocked(patchWorkItem).mockImplementation((_kind, _id, changes) => {
      server = jsonb({
        ...server,
        ...changes,
        admin_revision: Number(server.admin_revision) + 1,
      });
      return new Promise((resolve) => {
        completeSave = resolve;
      });
    });
    const mapping = mappings[kind] as unknown as {
      fromRecord: (record: EditRecord) => FieldValues;
      toRecord: (values: FieldValues) => EditRecord;
    };
    let editor: Editor | undefined;
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
      return (
        <WorkItemEditableContext.Provider value={controller.editable}>
          <EditorStatus editor={controller} />
          <Controller
            control={form.control}
            name={kind === "document" ? "content" : "description"}
            render={({ field }) => (
              <AdminRichTextEditorWithImages
                content={field.value || ""}
                onChange={field.onChange}
                onChangeDebounceMs={0}
                context={kind === "document" ? "notes" : `${kind}s`}
                onEditorReady={(next) => {
                  editor = next;
                }}
              />
            )}
          />
        </WorkItemEditableContext.Provider>
      );
    }
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={client}>
        <Harness />
      </QueryClientProvider>,
    );
    await waitFor(() => expect(editor?.getText()).toBe("Start middle end"));
    expect(screen.getByRole("status")).toHaveTextContent("Saved");
    act(() => {
      editor?.commands.setTextSelection(7);
      editor?.commands.insertContent("X");
    });
    const position = editor!.state.selection.from;
    expect(screen.getByRole("status")).toHaveTextContent("Saving");
    await waitFor(() => expect(patchWorkItem).toHaveBeenCalledTimes(1), {
      timeout: 2000,
    });
    expect(editor!.state.selection.from).toBe(position);
    const acknowledgementDocs: string[] = [];
    editor!.on("transaction", ({ transaction }) => {
      if (transaction.docChanged) acknowledgementDocs.push(editor!.getText());
    });
    await act(async () => {
      completeSave({ record: server, user_id: "user", conflicts: [] });
    });
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent("Saved"),
    );
    expect(editor!.state.selection.from).toBe(position);
    expect(acknowledgementDocs).toEqual([]);
    act(() => {
      editor?.commands.insertContent("Y");
    });
    expect(editor!.getText()).toBe("Start XYmiddle end");
  },
);
