"use client";

import { useState } from "react";
import {
  Button,
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  SegmentedControl,
} from "@altitutor/ui";
import type { useWorkItemEditor } from "./useWorkItemEditor";
import type { EditRecord } from "./api";
import { ExpandButton } from "@/shared/components/expandable-dialog";
import { useAdminDialogExpand } from "@/shared/components/dialog-shell";
import type { ReactNode } from "react";

export { WorkItemEditableContext } from "./context";
type Controller = ReturnType<typeof useWorkItemEditor>;
function textContent(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(textContent).join("");
  if (!value || typeof value !== "object") return "";
  const node = value as { text?: string; content?: unknown; type?: string };
  return (
    (node.text ?? textContent(node.content)) +
    (["paragraph", "heading", "listItem"].includes(node.type ?? "") ? "\n" : "")
  );
}
function Recovery({
  values,
  onDismiss,
}: {
  values: EditRecord;
  onDismiss?: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const text = [
    values.title ?? values.name,
    textContent(values.description ?? values.content),
  ]
    .filter(Boolean)
    .join("\n\n");
  return (
    <details className="text-sm border rounded p-2">
      <summary>
        Preserved draft — copy it before starting a fresh editing session
      </summary>
      <textarea
        aria-label="Preserved draft"
        readOnly
        value={text}
        className="mt-2 w-full min-h-32 border rounded p-2"
      />
      <div className="flex gap-2 mt-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            void navigator.clipboard
              .writeText(text)
              .then(() => setCopied(true));
          }}
        >
          {copied ? "Copied" : "Copy text"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            const url = URL.createObjectURL(
              new Blob([JSON.stringify(values, null, 2)], {
                type: "application/json",
              }),
            );
            const link = document.createElement("a");
            link.href = url;
            link.download = "preserved-draft.json";
            link.click();
            URL.revokeObjectURL(url);
          }}
        >
          Download formatted draft
        </Button>
        {onDismiss && (
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              if (window.confirm("Permanently discard this preserved draft?"))
                onDismiss();
            }}
          >
            Discard preserved draft
          </Button>
        )}
      </div>
    </details>
  );
}
function editorStatusLabel(editor: Controller): string {
  if (editor.saving) return "Saving…";
  if (editor.lost) return "Editing session ended";
  if (editor.dirty) return "Unsaved changes";
  if (editor.session?.can_edit) return "Saved";
  if (editor.session?.owner) return `${editor.session.owner} is editing`;
  if (editor.session) return "Read only";
  return "Opening…";
}

export function EditorStatus({
  editor,
  className,
}: {
  editor: Controller;
  className?: string;
}) {
  return (
    <span className={className ?? "text-sm text-muted-foreground"} role="status">
      {editorStatusLabel(editor)}
    </span>
  );
}

export function EditorHeaderActions({ editor }: { editor: Controller }) {
  if (!(editor.session?.can_edit && !editor.lost)) return null;

  return (
    <>
      <Button
        type="button"
        disabled={editor.saving || !editor.dirty}
        onClick={() => {
          void editor.save();
        }}
      >
        Save
      </Button>
      <Button
        type="button"
        variant="outline"
        disabled={editor.saving || !editor.dirty}
        onClick={() => {
          if (window.confirm("Discard your unsaved changes?"))
            void editor.discard();
        }}
      >
        Cancel changes
      </Button>
    </>
  );
}

export function EditorViewEditToggle({ editor }: { editor: Controller }) {
  const mode =
    editor.session?.can_edit && !editor.lost ? ("edit" as const) : ("view" as const);

  return (
    <SegmentedControl
      value={mode}
      onValueChange={(value) => {
        if (value === "edit") void editor.acquire();
        else editor.requestViewMode();
      }}
      options={[
        { value: "view", label: "View" },
        { value: "edit", label: "Edit" },
      ]}
      size="sm"
      aria-label="View or edit"
    />
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
      <EditorViewEditToggle editor={editor} />
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
  const isEditing = editor.session?.can_edit && !editor.lost;

  return (
    <div className="flex w-full items-center gap-2">
      <EditorStatus editor={editor} className="mr-auto text-sm text-muted-foreground" />
      <Button type="button" variant="outline" onClick={() => editor.requestClose()}>
        Cancel
      </Button>
      {isEditing ? (
        <Button
          type="button"
          disabled={editor.saving || !editor.dirty}
          onClick={() => {
            void editor.save().then((saved) => {
              if (saved) void editor.finishClose();
            });
          }}
        >
          {editor.saving ? "Saving..." : "Save"}
        </Button>
      ) : null}
    </div>
  );
}

export function EditorViewSwitchConfirmDialog({
  editor,
}: {
  editor: Controller;
}) {
  return (
    <AlertDialog
      open={editor.viewSwitchRequested}
      onOpenChange={editor.setViewSwitchRequested}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Save your changes before viewing?</AlertDialogTitle>
          <AlertDialogDescription>
            Your changes have not been saved to this record.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <Button
            variant="outline"
            onClick={() => editor.setViewSwitchRequested(false)}
          >
            Keep editing
          </Button>
          <Button
            variant="outline"
            disabled={editor.saving}
            onClick={() => {
              void editor.discard().then(editor.finishViewSwitch);
            }}
          >
            Discard and view
          </Button>
          <Button
            disabled={
              !editor.session?.can_edit || editor.lost || editor.saving
            }
            onClick={() => {
              void editor.save().then((saved) => {
                if (saved) void editor.finishViewSwitch();
              });
            }}
          >
            Save and view
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
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
          <AlertDialogTitle>Save your changes before closing?</AlertDialogTitle>
          <AlertDialogDescription>
            Your changes have not been saved to this record.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <Button
            variant="outline"
            onClick={() => editor.setCloseRequested(false)}
          >
            Keep editing
          </Button>
          <Button
            variant="outline"
            disabled={editor.saving}
            onClick={() => {
              void editor.discard().then(editor.finishClose);
            }}
          >
            Discard and close
          </Button>
          <Button
            disabled={
              !editor.session?.can_edit || editor.lost || editor.saving
            }
            onClick={() => {
              void editor.save().then((saved) => {
                if (saved) void editor.finishClose();
              });
            }}
          >
            Save and close
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function EditorControls({ editor }: { editor: Controller }) {
  return (
    <>
      <div className="flex items-center gap-2 text-sm" role="status">
        <EditorViewEditToggle editor={editor} />
        <EditorStatus editor={editor} />
        <EditorHeaderActions editor={editor} />
      </div>
      <EditorCloseConfirmDialog editor={editor} />
      <EditorViewSwitchConfirmDialog editor={editor} />
    </>
  );
}
export function EditorNotices({ editor }: { editor: Controller }) {
  return (
    <div className="space-y-2 px-6 text-sm shrink-0">
      {editor.error && (
        <p role="alert" className="text-destructive py-2">
          {editor.error}
        </p>
      )}
      {editor.storageError && (
        <p role="alert" className="text-destructive">
          Draft recovery storage is unavailable. Keep this editor open and copy
          your text before leaving.
        </p>
      )}
      {!editor.session?.can_edit && editor.session?.preview && !editor.lost && (
        <p className="py-2">
          Live preview — these changes have not been saved.
        </p>
      )}
      {editor.lost && (
        <>
          <Recovery values={editor.draft} />
          <Button
            variant="outline"
            onClick={() => {
              void editor.restart();
            }}
          >
            Open latest in a fresh session (keep this draft)
          </Button>
        </>
      )}
      {editor.recovery.map((draft) => (
        <Recovery
          key={draft.key}
          values={draft.values}
          onDismiss={() => editor.dismissRecovery(draft.key)}
        />
      ))}
    </div>
  );
}
