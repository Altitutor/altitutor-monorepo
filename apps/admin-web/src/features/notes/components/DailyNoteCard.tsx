"use client";
import { useEffect, useRef, useState } from "react";
import { Card, CardContent, type JSONContent } from "@altitutor/ui";
import { Check, CloudOff, Loader2 } from "lucide-react";
import { useDailyNote, useUpdateDailyNote } from "../api/dailyQueries";
import { NoteEditor } from "./NoteEditor";
import { useDebounce, useCurrentStaff } from "@/shared/hooks";
import { useMentionSuggestions } from "@/shared/hooks/useMentionSuggestions";
import { DashboardCardHeader } from "@/shared/components/DashboardCardHeader";

const NOTE_MENTION_TYPES = [
  "issues",
  "tasks",
  "students",
  "staff",
  "parents",
  "classes",
  "subjects",
] as const;

export function DailyNoteCard({ date }: { date: string }) {
  const { data: note, isLoading } = useDailyNote(date);
  const updateDailyNote = useUpdateDailyNote();
  const { data: currentStaff } = useCurrentStaff();
  const mentionSuggestions = useMentionSuggestions({
    types: NOTE_MENTION_TYPES,
  });

  const [content, setContent] = useState<JSONContent | string>("");
  const [isInitialized, setIsInitialized] = useState(false);
  const currentNoteIdRef = useRef<string | null>(null);
  const lastSavedContentRef = useRef<string>("");

  useEffect(() => {
    if (!note) return;
    if (currentNoteIdRef.current === note.id) return;

    currentNoteIdRef.current = note.id;
    const nextContent = (note.content as JSONContent | string | null) ?? "";
    setContent(nextContent);
    lastSavedContentRef.current = JSON.stringify(nextContent);
    setIsInitialized(true);
  }, [note]);

  const debouncedContentTrigger = useDebounce(content, 1000);

  useEffect(() => {
    if (!isInitialized || !note) return;

    const contentJson = JSON.stringify(content);
    if (contentJson === lastSavedContentRef.current) return;

    lastSavedContentRef.current = contentJson;
    updateDailyNote.mutate({
      id: note.id,
      date,
      updates: { content },
      silent: true,
      updatedBy: currentStaff?.id ?? null,
    });
  }, [
    content,
    date,
    debouncedContentTrigger,
    isInitialized,
    note,
    updateDailyNote,
    currentStaff?.id,
  ]);

  return (
    <Card className="flex h-full min-h-0 flex-col overflow-hidden">
      <DashboardCardHeader
        title="Daily Note"
        href="/documents"
        linkLabel="Documents"
        headerExtra={
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            {updateDailyNote.isPending ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin" />
                <span>Saving...</span>
              </>
            ) : updateDailyNote.isError ? (
              <>
                <CloudOff className="h-3 w-3 text-destructive" />
                <span className="text-destructive">Changes not saved</span>
              </>
            ) : (
              <>
                <Check className="h-3 w-3 text-emerald-500" />
                <span>Saved</span>
              </>
            )}
          </div>
        }
      />
      <CardContent className="flex min-h-0 flex-1 flex-col p-0">
        {isLoading ? (
          <div className="flex flex-1 items-center justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col border-t px-4 pt-3 pb-3">
            <NoteEditor
              content={content}
              onChange={setContent}
              placeholder="Write daily notes..."
              mentionSuggestions={mentionSuggestions}
              fillContainer
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
