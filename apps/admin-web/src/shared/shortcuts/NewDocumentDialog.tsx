"use client";
import { useState } from "react";
import { Button, Input } from "@altitutor/ui";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@altitutor/ui";
import { useCreateNote } from "@/features/notes/hooks/useNoteMutations";
import { useAccessoryPanel } from "@/shared/contexts/AccessoryPanelContext";
export function NewDocumentDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [title, setTitle] = useState("");
  const create = useCreateNote();
  const panel = useAccessoryPanel();
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!value && !create.isPending) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New document</DialogTitle>
          <DialogDescription>
            Enter a title to create a document.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            if (!title.trim() || create.isPending) return;
            try {
              const note = await create.mutateAsync({
                title: title.trim(),
                content: "",
                folder_id: null,
              });
              panel?.openTab({
                kind: "document",
                id: note.id,
                title: note.title,
              });
              setTitle("");
              onClose();
            } catch {
              /* The mutation displays the error and preserves the draft. */
            }
          }}
          className="space-y-4"
        >
          <Input
            aria-label="Document title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            disabled={create.isPending}
          />
          <Button type="submit" disabled={!title.trim() || create.isPending}>
            {create.isPending ? "Creating…" : "Create document"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
