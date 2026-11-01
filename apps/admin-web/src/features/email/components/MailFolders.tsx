"use client";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import {
  Archive,
  Check,
  Clock,
  File,
  Folder,
  Inbox,
  Mail,
  Send,
  ShieldAlert,
  Trash2,
} from "lucide-react";
import { Skeleton } from "@altitutor/ui";
import { useEmailCommand } from "../api/client";
import type { EmailFolder } from "../types";
import { rememberEmailFolder } from "./EmailActions";
export const emailDragType = "application/x-altitutor-email-message-ids";
export function MailFolders({
  folders,
  loading,
  selected,
  onSelect,
}: {
  folders: EmailFolder[];
  loading: boolean;
  selected?: string;
  onSelect: (id: string) => void;
}) {
  const command = useEmailCommand();
  const [over, setOver] = useState<string>();
  const [moved, setMoved] = useState<string>();
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const pinned = ["inbox", "drafts", "sentitems"].flatMap((role) =>
    folders.filter((folder) => folder.role === role),
  );
  function item(folder: EmailFolder) {
    const Icon =
      folder.role === "inbox"
        ? Inbox
        : folder.role === "drafts"
          ? File
          : folder.role === "sentitems"
            ? Send
            : folder.role === "archive"
              ? Archive
              : folder.role === "deleteditems"
                ? Trash2
                : folder.role === "junkemail"
                  ? ShieldAlert
                  : Folder;
    return (
      <button
        key={folder.id}
        title={folder.name}
        type="button"
        aria-current={selected === folder.id ? "page" : undefined}
        className={`flex w-auto shrink-0 items-center gap-2 rounded-lg min-[480px]:w-full px-3 py-2 text-left text-sm transition-colors ${over === folder.id ? "bg-primary/15 ring-1 ring-inset ring-primary/30" : moved === folder.id ? "bg-primary/10 motion-safe:animate-pulse" : selected === folder.id ? "bg-muted" : "hover:bg-muted/50"}`}
        onClick={() => onSelect(folder.id)}
        onDragOver={(event) => {
          if (event.dataTransfer.types.includes(emailDragType)) {
            event.preventDefault();
            event.dataTransfer.dropEffect = "move";
            setOver(folder.id);
          }
        }}
        onDragLeave={(event) => {
          if (
            !(event.relatedTarget instanceof Node) ||
            !event.currentTarget.contains(event.relatedTarget)
          )
            setOver(undefined);
        }}
        onDrop={(event) => {
          event.preventDefault();
          setOver(undefined);
          try {
            const ids = z
              .array(z.string().min(1))
              .min(1)
              .max(10000)
              .parse(JSON.parse(event.dataTransfer.getData(emailDragType)));
            command.mutate(
              { action: "move", ids, folderId: folder.id },
              {
                onSuccess: () => {
                  rememberEmailFolder(folder.id);
                  setMoved(folder.id);
                  clearTimeout(timer.current);
                  timer.current = setTimeout(() => setMoved(undefined), 900);
                },
              },
            );
          } catch {
            /* Foreign drags have no mailbox command. */
          }
        }}
      >
        <Icon className="h-4 w-4 shrink-0" />
        <span className="truncate">
          {folder.role === "sentitems" ? "Sent" : folder.name}
        </span>
        {moved === folder.id && (
          <Check aria-label="Moved" className="ml-auto h-3.5 w-3.5" />
        )}
      </button>
    );
  }
  return (
    <aside
      aria-label="Microsoft email folders"
      className="flex max-h-28 shrink-0 items-center gap-1 overflow-auto min-[480px]:block border-b p-2 min-[480px]:max-h-none min-[480px]:w-44 min-[480px]:border-b-0 min-[480px]:border-r min-[480px]:p-3"
    >
      {loading ? (
        <div aria-label="Loading folders" className="space-y-2">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-8 w-full" />
          ))}
        </div>
      ) : (
        <>
          <div className="flex w-max items-center gap-1 min-[480px]:w-auto min-[480px]:flex-col min-[480px]:items-stretch">
            {pinned.map(item)}
            <button
              type="button"
              aria-current={selected === "@scheduled" ? "page" : undefined}
              onClick={() => onSelect("@scheduled")}
              className={`flex w-auto shrink-0 items-center gap-2 rounded-lg min-[480px]:w-full px-3 py-2 text-sm ${selected === "@scheduled" ? "bg-muted" : "hover:bg-muted/50"}`}
            >
              <Clock className="h-4 w-4" />
              Scheduled
            </button>
          </div>
          <h2 className="mb-2 mt-6 hidden px-3 text-xs font-medium text-muted-foreground min-[480px]:block">
            Folders
          </h2>
          <div className="flex w-max items-center gap-1 min-[480px]:w-auto min-[480px]:flex-col min-[480px]:items-stretch">
            <button
              type="button"
              onClick={() => onSelect("")}
              className={`flex w-auto shrink-0 items-center gap-2 rounded-lg min-[480px]:w-full px-3 py-2 text-sm ${selected === "" ? "bg-muted" : "hover:bg-muted/50"}`}
            >
              <Mail className="h-4 w-4" />
              All mail
            </button>
            {folders
              .filter((folder) => !pinned.some((pin) => pin.id === folder.id))
              .map(item)}
          </div>
        </>
      )}
      {command.error && (
        <p role="alert" className="p-2 text-xs text-destructive">
          {command.error.message}
        </p>
      )}
    </aside>
  );
}
