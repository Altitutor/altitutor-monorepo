'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { addDays, format, isValid, parse } from 'date-fns';
import type { JSONContent } from '@altitutor/ui';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  SegmentedControl,
} from '@altitutor/ui';
import { Check, ChevronLeft, ChevronRight, CloudOff, ExternalLink, Loader2 } from 'lucide-react';
import { TodaySessionsView } from '@/features/sessions/components/TodaySessionsView';
import { SessionModal } from '@/features/sessions/components/SessionModal';
import { useSessionsWithDetails } from '@/features/sessions/hooks/useSessionsQuery';
import { TasksList } from '@/features/tasks/components/TasksList';
import { IssuesList } from '@/features/issues/components/IssuesList';
import { ProjectsList } from '@/features/projects/components/ProjectsList';
import { NoteEditor } from '@/features/notes/components/NoteEditor';
import { DashboardReconciliationCard } from '@/features/reconciliation/components/DashboardReconciliationCard';
import { useDailyNote, useUpdateDailyNote } from '@/features/notes/api/dailyQueries';
import { useDebounce, useCurrentStaff } from '@/shared/hooks';
import { useMentionSuggestions } from '@/shared/hooks/useMentionSuggestions';
import { clickableCardFocusRingCn, clickableCardHoverCn, cn } from '@/shared/utils';

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

function DashboardCardHeader({
  title,
  href,
  linkLabel,
  action,
  headerExtra,
}: {
  title: string;
  href?: string;
  linkLabel?: string;
  action?: ReactNode;
  headerExtra?: ReactNode;
}) {
  return (
    <CardHeader className="flex flex-row items-center justify-between gap-4 px-4 pb-2 pt-3">
      <CardTitle className="text-lg font-semibold">{title}</CardTitle>
      <div className="flex items-center gap-2">
        {headerExtra}
        {action}
        {href ? (
          <Button variant="outline" size="sm" asChild>
            <Link href={href} className="gap-1.5">
              <ExternalLink className="h-3.5 w-3.5" />
              {linkLabel ?? title}
            </Link>
          </Button>
        ) : null}
      </div>
    </CardHeader>
  );
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

const DASHBOARD_TASK_DEFAULT_STATUSES = ['todo', 'in_progress'] as const;
const DASHBOARD_ISSUE_DEFAULT_STATUS = ['open'] as const;
const ADMIN_MEETINGS_HREF = '/sessions?view=table&type=ADMIN_MEETING';

function formatMeetingDateTime(startAt: string | null, endAt: string | null) {
  if (!startAt) return 'Time not set';

  const start = new Date(startAt);
  const end = endAt ? new Date(endAt) : null;
  const dateLabel = format(start, 'EEE d MMM');
  const timeLabel = end
    ? `${format(start, 'h:mm a')} - ${format(end, 'h:mm a')}`
    : format(start, 'h:mm a');

  return `${dateLabel}, ${timeLabel}`;
}

function AdminMeetingItem({
  session,
  staff,
  label,
  onOpenSession,
}: {
  session: NonNullable<ReturnType<typeof useSessionsWithDetails>['data']>['sessions'][number];
  staff: NonNullable<ReturnType<typeof useSessionsWithDetails>['data']>['sessionStaff'][string];
  label?: string;
  onOpenSession: (sessionId: string) => void;
}) {
  const staffLabel =
    staff && staff.length > 0
      ? staff.map((s) => `${s.first_name} ${s.last_name}`.trim()).join(', ')
      : 'No staff assigned';

  return (
    <button
      type="button"
      onClick={() => onOpenSession(session.id)}
      className={cn(
        'group relative flex w-full flex-col rounded-lg border bg-card p-4 text-left transition-colors hover:bg-muted/40',
        clickableCardHoverCn,
        clickableCardFocusRingCn,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-base font-semibold leading-tight">
            {formatMeetingDateTime(session.start_at, session.end_at)}
          </div>
        </div>
        {label ? (
          <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
            {label}
          </span>
        ) : null}
      </div>
      <div className="mt-2 truncate text-sm leading-5 text-muted-foreground">{staffLabel}</div>
    </button>
  );
}

function AdminMeetingsCard({ onOpenSession }: { onOpenSession: (sessionId: string) => void }) {
  const { data, isLoading, error } = useSessionsWithDetails({
    includeInactive: false,
    types: ['ADMIN_MEETING'],
    orderBy: 'start_at',
    ascending: true,
  });

  const now = Date.now();
  const sessions = data?.sessions ?? [];
  const pastMeetings = sessions.filter((session) => {
    if (!session.start_at) return false;
    return new Date(session.start_at).getTime() < now;
  });
  const upcomingMeetings = sessions
    .filter((session) => {
      if (!session.start_at) return false;
      return new Date(session.start_at).getTime() >= now;
    })
    .slice(0, 4);
  const lastPastMeeting = pastMeetings[pastMeetings.length - 1] ?? null;

  return (
    <Card className="flex h-full flex-col overflow-hidden">
      <DashboardCardHeader title="Admin Meetings" href={ADMIN_MEETINGS_HREF} linkLabel="Sessions" />
      <CardContent className="flex flex-1 flex-col gap-3 overflow-hidden border-t bg-background p-4">
        {isLoading ? (
          <div className="flex flex-1 items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            Could not load admin meetings.
          </div>
        ) : (
          <>
            <div className="space-y-2">
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Last meeting</div>
              {lastPastMeeting ? (
                <AdminMeetingItem
                  session={lastPastMeeting}
                  staff={data?.sessionStaff[lastPastMeeting.id] ?? []}
                  label="Past"
                  onOpenSession={onOpenSession}
                />
              ) : (
                <div className="rounded-md border border-dashed px-3 py-3 text-sm text-muted-foreground">
                  No past admin meetings.
                </div>
              )}
            </div>

            <div className="min-h-0 space-y-2">
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Upcoming</div>
              {upcomingMeetings.length > 0 ? (
                <div className="space-y-2">
                  {upcomingMeetings.map((session) => (
                    <AdminMeetingItem
                      key={session.id}
                      session={session}
                      staff={data?.sessionStaff[session.id] ?? []}
                      onOpenSession={onOpenSession}
                    />
                  ))}
                </div>
              ) : (
                <div className="rounded-md border border-dashed px-3 py-3 text-sm text-muted-foreground">
                  No upcoming admin meetings.
                </div>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

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
  const dashboardProjectFilters = useMemo(
    () => ({
      status: ['backlog', 'planned', 'in_progress'],
      ...(currentStaff?.id ? { project_lead_id: [currentStaff.id] } : {}),
    }),
    [currentStaff?.id]
  );

  const sessionsPageHref = useMemo(() => {
    const params = new URLSearchParams();
    params.set('view', sessionsViewMode);
    if (sessionsViewMode === 'table') {
      params.set('from', dateStr ?? todayDateStr);
      params.set('to', dateStr ?? todayDateStr);
    } else {
      params.set('date', dateStr ?? todayDateStr);
      params.set('calendarMode', 'day');
    }
    return `/sessions?${params.toString()}`;
  }, [dateStr, sessionsViewMode, todayDateStr]);

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

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
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

      <Card className="flex flex-col overflow-hidden">
        <DashboardCardHeader
          title="Sessions"
          href={sessionsPageHref}
          linkLabel="Sessions"
          action={
            <SegmentedControl
              value={sessionsViewMode}
              onValueChange={(v) => setSessionsViewMode(v as ViewMode)}
              options={[
                { value: 'table', label: 'Table' },
                { value: 'calendar', label: 'Calendar' },
              ]}
            />
          }
        />
        <CardContent className="overflow-auto p-0">
          <TodaySessionsView
            date={dateStr}
            viewMode={sessionsViewMode}
            onOpenSession={handleSessionClick}
            embedTable
          />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 items-stretch gap-6 md:grid-cols-2 xl:grid-cols-3">
        <DailyNoteCard date={dateStr} />
        <DashboardReconciliationCard />
        <AdminMeetingsCard onOpenSession={handleSessionClick} />
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
        <Card className="flex max-h-[520px] flex-col overflow-hidden">
          <DashboardCardHeader title="Tasks" href="/tasks" />
          <CardContent className="min-h-0 flex-1 p-0">
            <TasksList
              key={currentStaff?.id ?? 'staff-loading'}
              defaultFilters={dashboardTaskFilters}
              hideToolbar
              embedView={{ groupBy: 'status', sortBy: 'priority', sortDirection: 'asc' }}
              showAssigneePill={false}
              showIssuePill={false}
              showProjectPill={false}
              showLinkPill={false}
              compact
            />
          </CardContent>
        </Card>

        <Card className="flex max-h-[520px] flex-col overflow-hidden">
          <DashboardCardHeader title="Issues" href="/issues" />
          <CardContent className="min-h-0 flex-1 p-0">
            <IssuesList
              defaultFilters={dashboardIssueFilters}
              hideToolbar
              embedView={{ sortBy: 'due_date', sortDirection: 'asc' }}
            />
          </CardContent>
        </Card>

        <Card className="flex max-h-[520px] flex-col overflow-hidden">
          <DashboardCardHeader title="Projects" href="/projects" />
          <CardContent className="min-h-0 flex-1 p-0">
            <ProjectsList
              key={currentStaff?.id ?? 'staff-loading'}
              defaultFilters={dashboardProjectFilters}
              hideToolbar
              embedView={{ sortBy: 'priority', sortDirection: 'asc', secondarySortBy: 'target_date' }}
            />
          </CardContent>
        </Card>
      </div>

      <SessionModal
        isOpen={isSessionModalOpen}
        sessionId={selectedSessionId}
        onClose={handleCloseSessionModal}
      />
    </div>
  );
}
