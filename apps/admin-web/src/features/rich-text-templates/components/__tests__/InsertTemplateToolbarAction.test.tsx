import { Dialog, DialogContent, DialogTitle, RichTextEditor } from "@altitutor/ui";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { InsertTemplateToolbarAction } from "../InsertTemplateToolbarAction";

beforeAll(() => {
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  Element.prototype.scrollIntoView = jest.fn();
});

it.each(["page", "dialog"])("opens the floating template picker and inserts the selected template in a %s", async (surface) => {
  const user = userEvent.setup();
  const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity } } });
  client.setQueryData(["rich-text-templates", "list"], [{
    id: "greeting",
    name: "Greeting",
    content: {
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "Dear student" }] }],
    },
  }]);
  const editorView = (
    <RichTextEditor
      content={{ type: "doc", content: [{ type: "paragraph" }] }}
      onChange={() => undefined}
      floatingToolbar
      renderFloatingToolbarActions={(editor, onOpenChange) => (
        <InsertTemplateToolbarAction editor={editor} onOpenChange={onOpenChange} />
      )}
    />
  );
  render(
    <QueryClientProvider client={client}>
      {surface === "dialog" ? (
        <Dialog open>
          <DialogContent aria-describedby={undefined} onOpenAutoFocus={(event) => event.preventDefault()}>
            <DialogTitle>Create project</DialogTitle>
            {editorView}
          </DialogContent>
        </Dialog>
      ) : editorView}
    </QueryClientProvider>,
  );
  const region = surface === "dialog" ? screen.getByRole("dialog") : document.body;
  expect(screen.queryByRole("button", { name: "Insert template" })).toBeNull();
  const editor = region.querySelector<HTMLElement>("[contenteditable=true]");
  if (!editor) throw new Error("Expected a rich text editor");
  act(() => editor.focus());
  await user.click(await within(region).findByRole("button", { name: "Insert template" }));
  const search = await within(region).findByPlaceholderText("Search templates...");
  await user.type(search, "greet");
  expect(search).toHaveValue("greet");
  await user.click(screen.getByRole("option", { name: "Greeting" }));
  expect(await screen.findByText("Dear student")).toBeVisible();
  client.clear();
});
