'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { addDays, format, isValid, parse } from 'date-fns';
import type { JSONContent } from '@altitutor/ui';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Tabs,
  TabsList,
  TabsTrigger,
} from '@altitutor/ui';
import { Check, ChevronLeft, ChevronRight, CloudOff, Loader2 } from 'lucide-react';
import type { Editor } from '@tiptap/react';
import { TodaySessionsView } from '@/features/sessions/components/TodaySessionsView';
import { SessionModal } from '@/features/sessions/components/SessionModal';
import { TasksList } from '@/features/tasks/components/TasksList';
import { IssuesList } from '@/features/issues/components/IssuesList';
import { NoteEditor } from '@/features/notes/components/NoteEditor';
import { NoteEditorBottomToolbar } from '@/features/notes/components/NoteEditorBottomToolbar';
import { useDailyNote, useUpdateDailyNote } from '@/features/notes/api/dailyQueries';
import { useDebounce, useCurrentStaff } from '@/shared/hooks';
import { useMentionSuggestions } from '@/shared/hooks/useMentionSuggestions';

type ViewMode = 'calendar' | 'table';

const DATE_FORMAT = 'yyyy-MM-dd';
const NOTE_MENTION_TYPES = ['issues', 'tasks', 'students', 'staff', 'parents', 'classes', 'subjects'] as const;

function getValidDateString(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = parse(value, DATE_FORMAT, new Date());
  if (!isValid(parsed)) return null;
  if (format(parsed, DATE_FORMAT) !== value) return null;
  return value;
}

function DailyNoteCard({ date }: { date: string }) {
  const { data: note, isLoading } = useDailyNote(date);
  const updateDailyNote = useUpdateDailyNote();
  const { data: currentStaff } = useCurrentStaff();
  const mentionSuggestions = useMentionSuggestions({ types: NOTE_MENTION_TYPES });

  const [content, setContent] = useState<JSONContent | string>('');
  const [isInitialized, setIsInitialized] = useState(false);
  const currentNoteIdRef = useRef<string | null>(null);
  const lastSavedContentRef = useRef<string>('');
  const [editor, setEditor] = useState<Editor | null>(null);

  useEffect(() => {
    if (!note) return;
    if (currentNoteIdRef.current === note.id) return;

    currentNoteIdRef.current = note.id;
    const nextContent = (note.content as JSONContent | string | null) ?? '';
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
  }, [content, date, debouncedContentTrigger, isInitialized, note, updateDailyNote, currentStaff?.id]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>Daily Note</CardTitle>
          <CardDescription>Notes for {date}</CardDescription>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium">
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
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <div className="min-h-[320px] rounded-md border p-4">
              <NoteEditor
                content={content}
                onChange={setContent}
                placeholder="Write daily notes..."
                onEditorReady={setEditor}
                mentionSuggestions={mentionSuggestions}
              />
            </div>
            <NoteEditorBottomToolbar editor={editor} />
          </>
        )}
      </CardContent>
    </Card>
  );
}

const DASHBOARD_TASK_DEFAULT_STATUSES = ['backlog', 'todo', 'in_progress'] as const;
const DASHBOARD_ISSUE_DEFAULT_STATUS = ['open'] as const;

export default function DashboardDatePage({ params }: { params: { date: string } }) {
  const router = useRouter();
  const { data: currentStaff } = useCurrentStaff();
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [isSessionModalOpen, setIsSessionModalOpen] = useState(false);
  const [sessionsViewMode, setSessionsViewMode] = useState<ViewMode>('calendar');

  const todayDateStr = useMemo(() => format(new Date(), DATE_FORMAT), []);
  const dateStr = useMemo(() => getValidDateString(params.date), [params.date]);

  const dashboardTaskFilters = useMemo(
    () => ({
      status: [...DASHBOARD_TASK_DEFAULT_STATUSES],
      ...(currentStaff?.id ? { assignee: [currentStaff.id] } : {}),
    }),
    [currentStaff?.id]
  );
  const dashboardIssueFilters = useMemo(
    () => ({ status: [...DASHBOARD_ISSUE_DEFAULT_STATUS] }),
    []
  );

  useEffect(() => {
    if (!dateStr) {
      router.replace(`/dashboard/${todayDateStr}`);
    }
  }, [dateStr, router, todayDateStr]);

  const selectedDate = useMemo(
    () => (dateStr ? parse(dateStr, DATE_FORMAT, new Date()) : null),
    [dateStr]
  );

  const previousDateStr = useMemo(
    () => (selectedDate ? format(addDays(selectedDate, -1), DATE_FORMAT) : ''),
    [selectedDate]
  );
  const nextDateStr = useMemo(
    () => (selectedDate ? format(addDays(selectedDate, 1), DATE_FORMAT) : ''),
    [selectedDate]
  );
  const handleSessionClick = useCallback((sessionId: string) => {
    setSelectedSessionId(sessionId);
    setIsSessionModalOpen(true);
  }, []);

  const handleCloseSessionModal = useCallback(() => {
    setIsSessionModalOpen(false);
    setSelectedSessionId(null);
  }, []);

  if (!dateStr || !selectedDate) return null;

  const dayName = selectedDate.toLocaleDateString('en-US', { weekday: 'long' });
  const dateLabel = selectedDate.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-1">{dayName}, {dateLabel}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => router.push(`/dashboard/${previousDateStr}`)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant={'outline'}
            size="sm"
            onClick={() => router.push(`/dashboard/${todayDateStr}`)}
          >
            Today
          </Button>
          <Button variant="outline" size="sm" onClick={() => router.push(`/dashboard/${nextDateStr}`)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle>Sessions</CardTitle>
          <Tabs value={sessionsViewMode} onValueChange={(v) => setSessionsViewMode(v as ViewMode)}>
            <TabsList>
              <TabsTrigger value="table">Table</TabsTrigger>
              <TabsTrigger value="calendar">Calendar</TabsTrigger>
            </TabsList>
          </Tabs>
        </CardHeader>
        <CardContent>
          <TodaySessionsView date={dateStr} viewMode={sessionsViewMode} onOpenSession={handleSessionClick} />
        </CardContent>
      </Card>

      <DailyNoteCard date={dateStr} />

      <Card>
        <CardHeader className="pb-2">
          <CardTitle>Tasks</CardTitle>
          <CardDescription>Tasks in progress or to do</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <TasksList defaultFilters={dashboardTaskFilters} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle>Issues</CardTitle>
          <CardDescription>Track and update active issues</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <IssuesList defaultFilters={dashboardIssueFilters} />
        </CardContent>
      </Card>

      <SessionModal
        isOpen={isSessionModalOpen}
        sessionId={selectedSessionId}
        onClose={handleCloseSessionModal}
      />
    </div>
  );
}
