"use client";

import { AlertTriangle, FlagOff } from "lucide-react";
import {
  Button,
  Popover,
  PopoverContent,
  PopoverTrigger,
  useToast,
} from "@altitutor/ui";
import { useAlertNotes, useSetNoteAlert } from "@/shared/hooks/useNotes";
import { extractTextFromNoteContent } from "@/shared/utils/noteContentUtils";
import { NoteContentDisplay } from "./NoteContentDisplay";

export function NoteAlertPills({
  entityType,
  entityId,
  enabled = true,
  className,
}: {
  entityType: "student" | "parent" | "staff";
  entityId: string | null;
  enabled?: boolean;
  className?: string;
}) {
  const { data: notes = [] } = useAlertNotes(entityType, entityId, enabled);
  const setAlert = useSetNoteAlert();
  const { toast } = useToast();
  if (!enabled || !entityId || !notes.length) return null;

  return (
    <div
      className={`flex min-w-0 flex-wrap items-center gap-2 ${className ?? ""}`}
      aria-label="Note alerts"
    >
      {notes.map((note) => {
        const label = extractTextFromNoteContent(note.note) || "Alert note";
        return (
          <Popover key={note.id}>
            <PopoverTrigger asChild>
              <button
                type="button"
                title={label}
                aria-label={`Read alert: ${label}`}
                className="inline-flex max-w-[180px] min-w-0 items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-900 hover:bg-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200 dark:hover:bg-amber-900"
              >
                <AlertTriangle className="h-3 w-3 shrink-0" />
                <span className="truncate">{label}</span>
              </button>
            </PopoverTrigger>
            <PopoverContent
              align="start"
              className="w-80 max-w-[calc(100vw-2rem)]"
            >
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                Alert note
              </div>
              <div className="max-h-64 overflow-auto">
                <NoteContentDisplay content={note.note} />
              </div>
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                disabled={setAlert.isPending}
                onClick={async () => {
                  try {
                    await setAlert.mutateAsync({
                      noteId: note.id,
                      isAlert: false,
                      revision: note.admin_revision,
                    });
                    toast({ title: "Alert removed" });
                  } catch (error) {
                    toast({
                      title: "Could not remove alert",
                      description:
                        error instanceof Error
                          ? error.message
                          : "Please try again.",
                      variant: "destructive",
                    });
                  }
                }}
              >
                <FlagOff className="mr-2 h-4 w-4" />
                Remove alert flag
              </Button>
            </PopoverContent>
          </Popover>
        );
      })}
    </div>
  );
}
