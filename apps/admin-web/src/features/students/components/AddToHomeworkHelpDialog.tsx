'use client';

import { useRef, useState } from 'react';
import { format } from 'date-fns';
import { Alert, AlertDescription, Button, useToast } from '@altitutor/ui';
import type { Tables } from '@altitutor/shared';
import { Loader2, X } from 'lucide-react';
import { AdminDialogShell } from '@/shared/components/dialog-shell';
import { StudentCard } from '@/shared/components/StudentCard';
import { WeekViewCalendar } from '@/features/sessions/components/WeekViewCalendar';
import { SessionsCard } from '@/features/sessions/components/SessionsCard';
import { useAddStudentToSession, useSessionsWithDetails } from '@/features/sessions/hooks/useSessionsQuery';
import { sessionsApi } from '@/features/sessions/api/sessions';
import { formatDate } from '@/shared/utils/datetime';

interface AddToHomeworkHelpDialogProps {
  isOpen: boolean;
  onClose: () => void;
  student: Tables<'students'>;
}

function startOfWeek() {
  const date = new Date();
  date.setDate(date.getDate() - ((date.getDay() + 6) % 7));
  date.setHours(0, 0, 0, 0);
  return date;
}

export function AddToHomeworkHelpDialog(props: AddToHomeworkHelpDialogProps) {
  // Unmount the wizard on close so each opening starts with a fresh selection.
  return props.isOpen ? <HomeworkHelpWizard {...props} /> : null;
}

function HomeworkHelpWizard({ onClose, student }: AddToHomeworkHelpDialogProps) {
  const [weekStart, setWeekStart] = useState(startOfWeek);
  const [firstWeek] = useState(startOfWeek);
  const [selected, setSelected] = useState<Map<string, Tables<'sessions'>>>(new Map());
  const [step, setStep] = useState<'select' | 'review'>('select');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const inFlight = useRef(false);
  const { toast } = useToast();
  const addStudent = useAddStudentToSession();
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  const query = useSessionsWithDetails({
    types: ['HOMEWORK_HELP'],
    rangeStart: format(weekStart, 'yyyy-MM-dd'),
    rangeEnd: format(weekEnd, 'yyyy-MM-dd'),
    orderBy: 'start_at',
    ascending: true,
  });
  const available = (query.data?.sessions ?? []).filter(session =>
    session.type === 'HOMEWORK_HELP' && session.start_at &&
    new Date(session.start_at) >= new Date() &&
    !query.data?.tutorLogs[session.id] &&
    !query.data?.sessionStudents[session.id]?.some(row => row.id === student.id)
  );
  const selectedSessions = [...selected.values()].sort((a, b) =>
    (a.start_at ?? '').localeCompare(b.start_at ?? '')
  );

  const toggle = (id: string) => {
    setError('');
    setSelected(previous => {
      const next = new Map(previous);
      if (next.has(id)) next.delete(id);
      else {
        const session = available.find(row => row.id === id);
        if (session) next.set(id, session);
      }
      return next;
    });
  };

  const confirm = async () => {
    if (inFlight.current || selectedSessions.length === 0) return;
    inFlight.current = true;
    setIsSaving(true);
    setError('');
    try {
      // Recheck availability before adding, including changes made since review.
      const first = format(new Date(selectedSessions[0].start_at!), 'yyyy-MM-dd');
      const last = new Date(selectedSessions[selectedSessions.length - 1].start_at!);
      const fresh = await sessionsApi.getAllSessionsWithDetails({
        types: ['HOMEWORK_HELP'], rangeStart: first, rangeEnd: format(last, 'yyyy-MM-dd'),
      });
      const completed = new Set<string>();
      const failures: string[] = [];
      for (const session of selectedSessions) {
        try {
          // Another administrator may have added this student since selection.
          if (fresh.sessionStudents[session.id]?.some(row => row.id === student.id)) {
            completed.add(session.id);
            continue;
          }
          const current = fresh.sessions.find(row => row.id === session.id);
          if (!current || current.type !== 'HOMEWORK_HELP' || !current.start_at ||
              new Date(current.start_at) < new Date() || fresh.tutorLogs[session.id]) {
            throw new Error('This session is no longer available.');
          }
          await addStudent.mutateAsync({ sessionId: session.id, studentId: student.id });
          completed.add(session.id);
        } catch (cause) {
          failures.push(`${formatDate(new Date(session.start_at!))}: ${cause instanceof Error ? cause.message : 'Unable to add student.'}`);
        }
      }
      if (failures.length === 0) {
        toast({ title: 'Homework help sessions added', description: `${student.first_name} is added to ${completed.size} session${completed.size === 1 ? '' : 's'}.` });
        onClose();
      } else {
        setSelected(previous => new Map([...previous].filter(([id]) => !completed.has(id))));
        setError(`${completed.size} session${completed.size === 1 ? '' : 's'} added. ${failures.join(' ')} Only remaining sessions will be retried.`);
        await query.refetch();
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load sessions. Please try again.');
    } finally {
      inFlight.current = false;
      setIsSaving(false);
    }
  };

  return (
    <AdminDialogShell
      open
      onClose={() => { if (!inFlight.current) onClose(); }}
      title={step === 'select' ? 'Add to homework help' : 'Review homework help sessions'}
      subtitle={step === 'select' ? 'Choose one or more upcoming sessions.' : 'Confirm the sessions to add this student to.'}
      contentClassName="md:max-w-5xl"
      fillHeight
      footer={<>
        <Button variant="outline" disabled={isSaving} onClick={step === 'review' ? () => { setStep('select'); setError(''); } : onClose}>
          {step === 'review' ? 'Back' : 'Cancel'}
        </Button>
        <Button disabled={isSaving || selected.size === 0} onClick={step === 'select' ? () => { setStep('review'); setError(''); } : () => void confirm()}>
          {isSaving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Adding…</> : step === 'select' ? `Add (${selected.size})` : `Confirm add (${selected.size})`}
        </Button>
      </>}
    >
      <div className="space-y-4">
        <StudentCard student={student} showActions={false} />
        {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
        {step === 'select' && (
          <>
            {query.isLoading ? <p role="status">Loading homework help sessions…</p> : query.isError ? (
              <Alert variant="destructive"><AlertDescription>Unable to load sessions. <Button variant="link" onClick={() => void query.refetch()}>Retry</Button></AlertDescription></Alert>
            ) : (
              <>
                <div className="overflow-x-auto"><div className="min-w-[700px]">
                  <WeekViewCalendar
                    sessions={available}
                    selectedSessionIds={new Set(selected.keys())}
                    onToggleSession={toggle}
                    currentWeekStart={weekStart}
                    onWeekChange={date => { if (date >= firstWeek) setWeekStart(date); }}
                    minDate={firstWeek}
                  />
                </div></div>
                {available.length === 0 && <p className="text-sm text-muted-foreground">No available homework help sessions this week. Try another week.</p>}
              </>
            )}
          </>
        )}
        {selectedSessions.length > 0 && (
          <div className="space-y-2">
            <h3 className="font-semibold">Selected sessions ({selected.size})</h3>
            {selectedSessions.map(session => (
              <div key={session.id} className="flex items-center gap-2">
                <div className="min-w-0 flex-1"><SessionsCard session={session} staff={[]} /></div>
                <Button variant="ghost" size="icon" disabled={isSaving} aria-label={`Remove session on ${formatDate(new Date(session.start_at!))}`} onClick={() => toggle(session.id)}><X className="h-4 w-4" /></Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </AdminDialogShell>
  );
}
