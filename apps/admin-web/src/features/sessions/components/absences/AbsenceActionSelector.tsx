'use client';

import { useState, useEffect } from 'react';
import { RadioGroup, RadioGroupItem, Label, Button } from '@altitutor/ui';
import { formatDate, formatTimeHHMM } from '@/shared/utils/datetime';
import type { AbsenceAction, RescheduleSession } from '../../types/absence';
import { useAvailableRescheduleSessions } from '../../hooks';
import { Calendar, Users, ArrowRight, BookOpen, Minus, Plus } from 'lucide-react';

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
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {rescheduleSessions
                  .filter((session) => !excludeSessionIds.includes(session.id)) // Filter out already selected sessions
                  .map((session) => {
                  const isSelected = selectedTargetSessionId === session.id;
                  const sessionDate = session.start_at ? new Date(session.start_at) : null;
                  
                  // Build subject display
                  const subject = session.subject;
                  const subjectPartsSession = [];
                  if (subject?.curriculum) subjectPartsSession.push(subject.curriculum);
                  if (subject?.year_level) subjectPartsSession.push(`Year ${subject.year_level}`);
                  if (subject?.name) subjectPartsSession.push(subject.name);
                  if (subject?.level) subjectPartsSession.push(subject.level);
                  const subjectDisplaySession = subjectPartsSession.join(' ') || 'Unknown';

                  const dateTimeDisplay = sessionDate
                    ? `${formatDate(sessionDate)} ${formatTimeHHMM(session.start_at)}${
                        session.end_at ? ` - ${formatTimeHHMM(session.end_at)}` : ''
                      }`
                    : 'TBD';

                  return (
                    <div
                      key={session.id}
                      className={`
                        p-3 rounded-lg border-2 transition-all cursor-pointer
                        ${
                          isSelected
                            ? 'border-primary bg-primary/5'
                            : 'border-border hover:border-primary/50 hover:bg-primary/5'
                        }
                      `}
                      onClick={() => setSelectedTargetSessionId(session.id)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="font-medium text-sm mb-1 flex items-center gap-2">
                            <BookOpen className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                            <span>{subjectDisplaySession}</span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Calendar className="h-3 w-3 flex-shrink-0" />
                            <span>{dateTimeDisplay}</span>
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
                    </div>
                  );
                })}
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
