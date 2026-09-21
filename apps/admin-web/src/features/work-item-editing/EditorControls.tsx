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
} from "@altitutor/ui";
import type { useWorkItemEditor } from "./useWorkItemEditor";
import type { EditRecord } from "./api";

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
export function EditorControls({ editor }: { editor: Controller }) {
  return (
    <>
      <div className="flex items-center gap-2 text-sm" role="status">
        <span>
          {editor.saving
            ? "Saving…"
            : editor.lost
              ? "Editing session ended"
              : editor.dirty
                ? "Unsaved changes"
                : editor.session?.can_edit
                  ? "Saved"
                  : editor.session?.owner
                    ? `${editor.session.owner} is editing`
                    : editor.session
                      ? "Read only"
                      : "Opening…"}
        </span>
        {editor.session?.can_edit && !editor.lost ? (
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
        ) : (
          editor.session &&
          !editor.dirty && (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                void editor.acquire();
              }}
            >
              Edit
            </Button>
          )
        )}
      </div>
      <AlertDialog
        open={editor.closeRequested}
        onOpenChange={editor.setCloseRequested}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Save your changes before closing?
            </AlertDialogTitle>
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
