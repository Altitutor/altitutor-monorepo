"use client";

import { useEffect, useState, type DragEvent } from "react";
import { ChevronDown } from "lucide-react";
import { SearchableSelect } from "@altitutor/ui";
import { toast } from "sonner";
import { z } from "zod";
import { useEmailCommand } from "../api/client";
import type { EmailFolder } from "../types";
import { rememberEmailFolder } from "./EmailActions";

export const emailDragType = "application/x-altitutor-email-message-ids";
const messageIds = z.array(z.string().min(1)).min(1).max(10000);
const pinnedRoles = ["inbox", "drafts", "sentitems"];

export function mailFolderLabel(folders: EmailFolder[], id?: string) {
  if (id === "@scheduled") return "Scheduled";
  if (id === "") return "All mail";
  const folder = folders.find((item) => item.id === id);
  return folder?.role === "sentitems" ? "Sent" : folder?.name ?? folders.find((item) => item.role === "inbox")?.name ?? "All mail";
}

export function MailFolders({ folders, selected, onSelect, dragging = false, onDragComplete }: {
  folders: EmailFolder[];
  selected?: string;
  onSelect: (id: string) => void;
  dragging?: boolean;
  onDragComplete?: () => void;
}) {
  const command = useEmailCommand();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [over, setOver] = useState<string>();
  useEffect(() => {
    if (!dragging) setOver(undefined);
  }, [dragging]);
  const items = [
    ...pinnedRoles.flatMap((role) => folders.filter((folder) => folder.role === role)),
    { id: "@scheduled" },
    { id: "" },
    ...folders
      .filter((folder) => !pinnedRoles.includes(folder.role ?? ""))
      .sort((a, b) => a.name.localeCompare(b.name)),
  ].map(({ id }) => ({ id, label: mailFolderLabel(folders, id) }));
  const label = mailFolderLabel(folders, selected);
  const term = search.trim().toLowerCase();

  function canDrop(event: DragEvent, id: string) {
    return id !== "" && id !== "@scheduled" && id !== selected &&
      event.dataTransfer.types.includes(emailDragType);
  }

  return (
    <SearchableSelect
      key={dragging ? "dragging" : "browsing"}
      items={items.filter((item) => item.label.toLowerCase().includes(term))}
      onSearchChange={setSearch}
      value={items.find((item) => item.id === selected) ?? null}
      getItemId={(item) => item.id}
      getItemLabel={(item) => item.label}
      popoverLabel="Email folders"
      searchPlaceholder="Search folders…"
      emptyMessage="No folders found"
      open={open || dragging}
      onOpenChange={setOpen}
      autoFocus={!dragging}
      onValueChange={(item) => { if (item) onSelect(item.id); }}
      trigger={
        <button type="button" title={label} className="flex min-w-0 items-center gap-1 text-left hover:text-foreground">
          <span className="truncate">{label}</span>
          <ChevronDown className="size-3.5 shrink-0" aria-hidden />
        </button>
      }
      getItemDragProps={({ id }) => ({
        className: dragging && over === id ? "bg-accent" : undefined,
        onDragOver: (event) => {
          if (!canDrop(event, id)) return;
          event.preventDefault();
          event.dataTransfer.dropEffect = "move";
          setOver(id);
        },
        onDragLeave: (event) => {
          if (event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget)) return;
          setOver(undefined);
        },
        onDrop: (event) => {
          if (!canDrop(event, id)) return;
          event.preventDefault();
          setOver(undefined);
          setOpen(false);
          onDragComplete?.();
          try {
            const ids = messageIds.parse(JSON.parse(event.dataTransfer.getData(emailDragType)));
            command.mutate({ action: "move", ids, folderId: id }, {
              onSuccess: () => rememberEmailFolder(id),
              onError: (error) => toast.error("Could not move email", { description: error.message }),
            });
          } catch {
            // Ignore invalid data from a drag.
          }
        },
      })}
    />
  );
}
