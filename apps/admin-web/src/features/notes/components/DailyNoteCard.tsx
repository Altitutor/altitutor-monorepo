"use client";
import { useCallback, useEffect, useRef, useState } from "react";
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
  const lastSubmittedContentRef = useRef<string>("");
  const latestContentRef = useRef<JSONContent | string>("");
  const saveContextRef = useRef({
    noteId: note?.id,
    date,
    updatedBy: currentStaff?.id ?? null,
    mutate: updateDailyNote.mutate,
  });
  saveContextRef.current = {
    noteId: note?.id,
    date,
    updatedBy: currentStaff?.id ?? null,
    mutate: updateDailyNote.mutate,
  };

  useEffect(() => {
    if (!note) return;
    if (currentNoteIdRef.current === note.id) return;

    currentNoteIdRef.current = note.id;
    const nextContent = (note.content as JSONContent | string | null) ?? "";
    setContent(nextContent);
    latestContentRef.current = nextContent;
    const contentJson = JSON.stringify(nextContent);
    lastSavedContentRef.current = contentJson;
    lastSubmittedContentRef.current = contentJson;
    setIsInitialized(true);
  }, [note]);

  const debouncedContentTrigger = useDebounce(content, 1000);

  const saveContent = useCallback((nextContent: JSONContent | string) => {
    const context = saveContextRef.current;
    if (!context.noteId) return;

    const contentJson = JSON.stringify(nextContent);
    if (contentJson === lastSubmittedContentRef.current) return;
    lastSubmittedContentRef.current = contentJson;

    context.mutate(
      {
        id: context.noteId,
        date: context.date,
        updates: { content: nextContent },
        silent: true,
        updatedBy: context.updatedBy,
      },
      {
        onSuccess: () => {
          lastSavedContentRef.current = contentJson;
        },
        onError: () => {
          if (lastSubmittedContentRef.current === contentJson) {
            lastSubmittedContentRef.current = lastSavedContentRef.current;
          }
        },
      },
    );
  }, []);

  useEffect(() => {
    if (!isInitialized || !note) return;
    saveContent(debouncedContentTrigger);
  }, [debouncedContentTrigger, isInitialized, note, saveContent]);

  useEffect(
    () => () => {
      saveContent(latestContentRef.current);
    },
    [saveContent],
  );

  const handleContentChange = useCallback((nextContent: JSONContent) => {
    latestContentRef.current = nextContent;
    setContent(nextContent);
  }, []);

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
              onChange={handleContentChange}
              onChangeDebounceMs={0}
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
