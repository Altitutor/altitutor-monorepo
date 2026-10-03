"use client";

import {
  Button,
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  RichTextEditor,
  type JSONContent,
} from "@altitutor/ui";
import type { ReactNode } from "react";
import type { EditRecord } from "./api";
import type { useWorkItemEditor } from "./useWorkItemEditor";
import { ExpandButton } from "@/shared/components/expandable-dialog";
import { useAdminDialogExpand } from "@/shared/components/dialog-shell";

export { WorkItemEditableContext } from "./context";
type Controller = ReturnType<typeof useWorkItemEditor>;
const labels: Record<string, string> = {
  description: "Description",
  content: "Document content",
  title: "Title",
  name: "Name",
  assigned_to: "Assignee",
  project_lead_id: "Project lead",
  member_ids: "Members",
  issue_id: "Issue",
  project_id: "Project",
  folder_id: "Folder",
  due_date: "Due date",
  start_date: "Start date",
  target_date: "Target date",
  is_tutor_documentation: "Tutor documentation",
};
function editorStatusLabel(editor: Controller): string {
  if (!editor.session) return editor.error ? "Couldn’t load" : "Loading…";
  if (editor.conflicts.length) return "Changes need review";
  if (editor.error) return "Couldn’t save";
  if (editor.saving || editor.dirty) return "Saving…";
  return "Saved";
}
export function EditorStatus({
  editor,
  className,
}: {
  editor: Controller;
  className?: string;
}) {
  return (
    <span
      className={className ?? "text-sm text-muted-foreground"}
      role="status"
    >
      {editorStatusLabel(editor)}
    </span>
  );
}
export function WorkItemDialogHeaderActions({
  editor,
  actions,
}: {
  editor: Controller;
  actions: ReactNode;
}) {
  const expand = useAdminDialogExpand();
  return (
    <div className="flex items-center gap-2">
      <EditorStatus editor={editor} />
      {expand ? (
        <ExpandButton
          expanded={expand.expanded}
          onToggle={() => expand.setExpanded(!expand.expanded)}
        />
      ) : null}
      {actions}
    </div>
  );
}
export function EditorFooterActions({ editor }: { editor: Controller }) {
  return (
    <div className="flex w-full items-center gap-2">
      <EditorStatus
        editor={editor}
        className="mr-auto text-sm text-muted-foreground"
      />
      <Button
        type="button"
        variant="outline"
        disabled={editor.deleting}
        onClick={() => {
          void editor.requestClose();
        }}
      >
        Close
      </Button>
    </div>
  );
}
export function EditorCloseConfirmDialog({ editor }: { editor: Controller }) {
  return (
    <AlertDialog
      open={editor.closeRequested}
      onOpenChange={editor.setCloseRequested}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Some changes haven’t saved</AlertDialogTitle>
          <AlertDialogDescription>
            Keep this record open to resolve the problem. If you close it,
            unsaved changes are{" "}
            {editor.storageError
              ? "only available here; copy them before leaving"
              : "kept in this browser tab for when you reopen it"}
            .
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <Button
            variant="outline"
            onClick={() => editor.setCloseRequested(false)}
          >
            Keep open
          </Button>
          <Button
            variant="outline"
            disabled={editor.saving}
            onClick={editor.finishClose}
          >
            Close without saving
          </Button>
          {!editor.conflicts.length && (
            <Button
              disabled={editor.saving}
              onClick={() => {
                void editor.save().then((saved) => {
                  if (saved) editor.finishClose();
                });
              }}
            >
              Retry
            </Button>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
export function EditorControls({ editor }: { editor: Controller }) {
  return <EditorStatus editor={editor} />;
}
function LatestValue({
  field,
  value,
}: {
  field: string;
  value: EditRecord[string];
}) {
  if (field === "description" || field === "content") {
    return (
      <RichTextEditor
        content={(value ?? "") as JSONContent | string}
        editable={false}
        minHeight="80px"
      />
    );
  }
  return (
    <p className="whitespace-pre-wrap break-words">
      {typeof value === "string" ? value : JSON.stringify(value ?? null)}
    </p>
  );
}
export function EditorNotices({ editor }: { editor: Controller }) {
  return (
    <div className="space-y-2 px-6 text-sm shrink-0 max-h-[40vh] overflow-y-auto">
      {editor.error && (
        <div role="alert" className="py-2 flex flex-wrap items-center gap-2">
          <p className="text-destructive">{editor.error}</p>
          {editor.session && !editor.conflicts.length && (
            <Button
              type="button"
              variant="outline"
              disabled={editor.saving}
              onClick={() => {
                void editor.save();
              }}
            >
              Retry
            </Button>
          )}
        </div>
      )}
      {editor.storageError && editor.dirty && (
        <p role="alert" className="text-destructive">
          Browser recovery storage is unavailable. Keep this record open until
          changes save.
        </p>
      )}
      {editor.conflicts.map((field) => (
        <div
          key={field}
          role="alert"
          className="my-2 space-y-2 rounded border p-3"
        >
          <p>
            {labels[field] ?? field} changed elsewhere. Your changes are still
            in the editor below.
          </p>
          <details>
            <summary className="cursor-pointer">
              Review latest saved {labels[field]?.toLowerCase() ?? field}
            </summary>
            <LatestValue field={field} value={editor.session?.record[field]} />
          </details>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={editor.saving}
              onClick={() => editor.resolveConflict(field, false)}
            >
              Use latest
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={editor.saving}
              onClick={() => {
                if (
                  window.confirm(
                    "Replace the latest saved value with your changes?",
                  )
                )
                  editor.resolveConflict(field, true);
              }}
            >
              Save my changes
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
