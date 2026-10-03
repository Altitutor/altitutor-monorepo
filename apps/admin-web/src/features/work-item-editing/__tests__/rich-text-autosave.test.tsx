import { act, render, waitFor } from "@testing-library/react";
import type { Editor } from "@tiptap/react";
import { RichTextEditor } from "@altitutor/ui/components/rich-text-editor";

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
