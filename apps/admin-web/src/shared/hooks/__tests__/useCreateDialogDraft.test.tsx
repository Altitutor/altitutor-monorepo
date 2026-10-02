import { act, renderHook } from "@testing-library/react";
import { useForm } from "react-hook-form";
import { useCreateDialogDraft } from "../useCreateDialogDraft";

jest.mock("@/shared/lib/supabase/auth", () => ({
  useAuthStore: (selector: (state: { user: { id: string } }) => unknown) =>
    selector({ user: { id: "draft-test" } }),
}));
type Draft = {
  title: string;
  description: { type: string; content: string[] } | null;
  assignee: string | null;
};
function useDraft(key: string) {
  const form = useForm<Draft>({
    defaultValues: { title: "", description: null, assignee: null },
  });
  return { form, ...useCreateDialogDraft(form, true, key) };
}
beforeEach(() => sessionStorage.clear());
test("dismissed drafts restore all fields after the dialog unmounts", () => {
  const first = renderHook(() => useDraft("task:parent-one"));
  act(() => {
    first.result.current.form.setValue("title", "Follow up");
    first.result.current.form.setValue("description", {
      type: "doc",
      content: ["Unfinished description"],
    });
    first.result.current.form.setValue("assignee", "staff-one");
    first.result.current.saveDraft();
  });
  first.unmount();
  const reopened = renderHook(() => useDraft("task:parent-one"));
  expect(reopened.result.current.readDraft()).toEqual({
    title: "Follow up",
    description: { type: "doc", content: ["Unfinished description"] },
    assignee: "staff-one",
  });
});
test("drafts are separate per dialog and parent context, and successful creation clears the draft", () => {
  const task = renderHook(() => useDraft("task:parent-two"));
  act(() => {
    task.result.current.form.setValue("title", "Scoped draft");
  });
  const other = renderHook(() => useDraft("project"));
  expect(other.result.current.readDraft()).toBeUndefined();
  const otherParent = renderHook(() => useDraft("task:parent-three"));
  expect(otherParent.result.current.readDraft()).toBeUndefined();
  act(() => {
    task.result.current.form.reset();
    task.result.current.clearDraft();
  });
  expect(task.result.current.readDraft()).toBeUndefined();
  expect(sessionStorage.getItem(task.result.current.storageKey)).toBeNull();
});
