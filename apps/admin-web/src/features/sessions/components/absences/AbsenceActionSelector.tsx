'use client';

import { useState, useEffect, useMemo } from 'react';
import { RadioGroup, RadioGroupItem, Label, Button, SearchableSelect } from '@altitutor/ui';
import { formatDate, formatTimeHHMM } from '@/shared/utils/datetime';
import type { AbsenceAction, RescheduleSession } from '../../types/absence';
import { useAvailableRescheduleSessions } from '../../hooks';
import { Calendar, Users, ArrowRight, BookOpen, Minus, Plus } from 'lucide-react';

function getSessionDisplay(session: RescheduleSession): string {
  const subject = session.subject;
  const parts: string[] = [];
  if (subject?.curriculum) parts.push(subject.curriculum);
  if (subject?.year_level) parts.push(`Year ${subject.year_level}`);
  if (subject?.name) parts.push(subject.name);
  if (subject?.level) parts.push(subject.level);
  const subjectDisplay = parts.join(' ') || 'Unknown';
  const sessionDate = session.start_at ? new Date(session.start_at) : null;
  const dateTimeDisplay = sessionDate
    ? `${formatDate(sessionDate)} ${formatTimeHHMM(session.start_at)}${
        session.end_at ? ` - ${formatTimeHHMM(session.end_at)}` : ''
      }`
    : 'TBD';
  return `${subjectDisplay} • ${dateTimeDisplay}`;
}

function SessionSelect({
  sessions,
  value,
  onValueChange,
}: {
  sessions: RescheduleSession[];
  value: string | null;
  onValueChange: (sessionId: string | null) => void;
}) {
  const selectedSession = useMemo(
    () => sessions.find((s) => s.id === value) ?? null,
    [sessions, value]
  );
  return (
    <SearchableSelect<RescheduleSession>
      items={sessions}
      value={selectedSession}
      onValueChange={(s) => onValueChange(s?.id ?? null)}
      getItemId={(s) => s.id}
      getItemLabel={getSessionDisplay}
      getItemValue={(s) =>
        `${getSessionDisplay(s)} ${s.subject?.name ?? ''} ${s.subject?.curriculum ?? ''}`.trim()
      }
      placeholder="Select session to reschedule to..."
      searchPlaceholder="Search sessions..."
      emptyMessage="No sessions match"
      trigger={
        <Button variant="outline" className="w-full justify-start">
          {selectedSession ? getSessionDisplay(selectedSession) : 'Select session to reschedule to...'}
        </Button>
      }
      contentWidth="100%"
      align="start"
      renderItem={(session, isSelected) => (
        <div className="flex items-center justify-between w-full">
          <div className="flex-1 min-w-0">
            <div className="font-medium text-sm flex items-center gap-2">
              <BookOpen className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
              <span className="truncate">
                {session.subject
                  ? [
                      session.subject.curriculum,
                      session.subject.year_level ? `Year ${session.subject.year_level}` : '',
                      session.subject.name,
                      session.subject.level,
                    ]
                      .filter(Boolean)
                      .join(' ')
                  : 'Unknown'}
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
              <Calendar className="h-3 w-3 flex-shrink-0" />
              <span>
                {session.start_at
                  ? `${formatDate(new Date(session.start_at))} ${formatTimeHHMM(session.start_at)}${
                      session.end_at ? ` - ${formatTimeHHMM(session.end_at)}` : ''
                    }`
                  : 'TBD'}
              </span>
              {session.studentCount !== undefined && (
                <>
                  <span className="mx-1">•</span>
                  <Users className="h-3 w-3 flex-shrink-0" />
                  <span>{session.studentCount} students</span>
                </>
              )}
            </div>
          </div>
          {isSelected && <ArrowRight className="h-5 w-5 text-primary flex-shrink-0 ml-2" />}
        </div>
      )}
    />
  );
}

interface AbsenceActionSelectorProps {
  studentId: string;
  sessionId: string;
  sessionDetails: {
    date: string;
    time: string;
    subject: string;
    class: string;
    curriculum?: string;
    yearLevel?: string;
    subjectName?: string;
    level?: string;
  };
  onActionSelected: (action: AbsenceAction, targetSessionId?: string, targetSession?: RescheduleSession) => void;
  onBack: () => void;
  resetAction?: boolean; // New prop to trigger action reset
  excludeSessionIds?: string[]; // Session IDs already selected for other absences
}

export function AbsenceActionSelector({
  studentId,
  sessionId,
  sessionDetails,
  onActionSelected,
  onBack,
  resetAction,
  excludeSessionIds = [],
}: AbsenceActionSelectorProps) {
  const [action, setAction] = useState<AbsenceAction | null>(null);
  const [selectedTargetSessionId, setSelectedTargetSessionId] = useState<string | null>(null);
  const [dateRangeDays, setDateRangeDays] = useState(7); // Default +/- 1 week

  // Reset action when resetAction prop changes
  useEffect(() => {
    if (resetAction) {
      setAction(null);
      setSelectedTargetSessionId(null);
    }
  }, [resetAction]);

  const { data: rescheduleSessions, isLoading } = useAvailableRescheduleSessions(
    action === 'reschedule'
      ? {
          originalSessionId: sessionId,
          studentId,
          dateRangeDays,
        }
      : null
  );

  const handleConfirm = () => {
    if (!action) return;
    
    if (action === 'reschedule') {
      if (!selectedTargetSessionId) {
        alert('Please select a session to reschedule to');
        return;
      }
      // Find the selected target session to pass back
      const targetSession = rescheduleSessions?.find(s => s.id === selectedTargetSessionId);
      onActionSelected('reschedule', selectedTargetSessionId, targetSession);
    } else {
      onActionSelected('credit');
    }
  };

  const canConfirm =
    action === 'credit' || (action === 'reschedule' && selectedTargetSessionId);

  // Build subject display
  const subjectParts = [];
  if (sessionDetails.curriculum) subjectParts.push(sessionDetails.curriculum);
  if (sessionDetails.yearLevel) subjectParts.push(`Year ${sessionDetails.yearLevel}`);
  if (sessionDetails.subjectName) subjectParts.push(sessionDetails.subjectName);
  if (sessionDetails.level) subjectParts.push(sessionDetails.level);
  const subjectDisplay = subjectParts.join(' ') || sessionDetails.subject;

  return (
    <div className="space-y-6">
      {/* Original Session - New Format */}
      <div className="p-4 rounded-lg border-2 border-border bg-card">
        <h4 className="font-semibold text-sm mb-3">Original Session</h4>
        <div className="space-y-2">
          {/* Subject */}
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <span className="text-sm font-medium">{subjectDisplay}</span>
          </div>
          {/* Date and Time */}
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <span className="text-sm text-muted-foreground">{sessionDetails.date} {sessionDetails.time}</span>
          </div>
        </div>
      </div>

      {/* Action Selection */}
      <div className="space-y-4">
        <h4 className="font-semibold">Select Action</h4>
        <RadioGroup value={action || ''} onValueChange={(value) => setAction(value as AbsenceAction)}>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="reschedule" id="reschedule" />
            <Label htmlFor="reschedule" className="cursor-pointer">
              Reschedule to another session
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="credit" id="credit" />
            <Label htmlFor="credit" className="cursor-pointer">
              Credit the session
            </Label>
          </div>
        </RadioGroup>
      </div>

      {/* Reschedule Options */}
      {action === 'reschedule' && (
        <div className="space-y-4">
          {/* Available Sessions with Date Range Controls */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Available Sessions</Label>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setDateRangeDays(Math.max(1, dateRangeDays - 1))}
                  disabled={dateRangeDays <= 1}
                >
                  <Minus className="h-3 w-3" />
                </Button>
                <span className="text-sm text-muted-foreground min-w-[80px] text-center">
                  ±{dateRangeDays} day{dateRangeDays !== 1 ? 's' : ''}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setDateRangeDays(Math.min(28, dateRangeDays + 1))}
                  disabled={dateRangeDays >= 28}
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
            </div>
            {isLoading ? (
              <div className="py-8 text-center text-muted-foreground">Loading sessions...</div>
            ) : !rescheduleSessions || rescheduleSessions.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                No available sessions found. Try adjusting the date range.
              </div>
            ) : rescheduleSessions.filter((s) => !excludeSessionIds.includes(s.id)).length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                All available sessions have been selected for other absences. Try adjusting the date range for more options.
              </div>
            ) : (
              <div className="pt-2">
                <SessionSelect
                  sessions={rescheduleSessions.filter((s) => !excludeSessionIds.includes(s.id))}
                  value={selectedTargetSessionId}
                  onValueChange={setSelectedTargetSessionId}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Credit Info */}
      {action === 'credit' && (
        <div className="p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
          <p className="text-sm text-blue-900 dark:text-blue-100">
            The session will be marked as credited. The student will not be charged for this
            session.
          </p>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        <Button variant="outline" onClick={onBack} className="flex-1">
          Back
        </Button>
        <Button onClick={handleConfirm} disabled={!canConfirm} className="flex-1">
          Confirm Action
        </Button>
      </div>
    </div>
  );
}
