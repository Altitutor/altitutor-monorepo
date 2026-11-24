"use client";

import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import { Input, Popover, PopoverContent, PopoverTrigger } from "@altitutor/ui";
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
  const [query, setQuery] = useState("");
  const [over, setOver] = useState<string>();
  useEffect(() => {
    if (dragging) setQuery("");
    else setOver(undefined);
  }, [dragging]);
  const items = [
    ...pinnedRoles.flatMap((role) => folders.filter((folder) => folder.role === role)),
    { id: "@scheduled" },
    { id: "" },
    ...folders
      .filter((folder) => !pinnedRoles.includes(folder.role ?? ""))
      .sort((a, b) => a.name.localeCompare(b.name)),
  ].filter(({ id }) => mailFolderLabel(folders, id).toLowerCase().includes(query.trim().toLowerCase()));
  const label = mailFolderLabel(folders, selected);

  return (
    <Popover open={open || dragging} onOpenChange={(next) => {
      setOpen(next);
      if (!next) setQuery("");
    }}>
      <PopoverTrigger asChild>
        <button type="button" title={label} className="flex min-w-0 items-center gap-1 text-left hover:text-foreground">
          <span className="truncate">{label}</span>
          <ChevronDown className="size-3.5 shrink-0" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        aria-label="Email folders"
        className="w-72 space-y-2 p-2"
        onOpenAutoFocus={(event) => { if (dragging) event.preventDefault(); }}
        onCloseAutoFocus={(event) => { if (dragging) event.preventDefault(); }}
      >
        <Input
          aria-label="Search folders"
          placeholder="Search folders…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <div className="max-h-[min(20rem,calc(var(--radix-popover-content-available-height)-4rem))] overflow-y-auto">
          {items.map(({ id }) => {
            const canMove = id !== "" && id !== "@scheduled" && id !== selected;
            return (
              <button
                key={id}
                type="button"
                aria-current={selected === id ? "page" : undefined}
                className={`block w-full truncate rounded-md px-3 py-2 text-left text-sm hover:bg-muted ${over === id || selected === id ? "bg-muted" : ""}`}
                onClick={() => { onSelect(id); setOpen(false); setQuery(""); }}
                onDragOver={(event) => {
                  if (!canMove || !event.dataTransfer.types.includes(emailDragType)) return;
                  event.preventDefault();
                  event.dataTransfer.dropEffect = "move";
                  setOver(id);
                }}
                onDragLeave={() => setOver(undefined)}
                onDrop={(event) => {
                  if (!canMove || !event.dataTransfer.types.includes(emailDragType)) return;
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
                    // An invalid drag has no mailbox command.
                  }
                }}
              >
                {mailFolderLabel(folders, id)}
              </button>
            );
          })}
          {!items.length && <p className="p-2 text-sm text-muted-foreground">No folders found</p>}
        </div>
      </PopoverContent>
    </Popover>
  );
}
