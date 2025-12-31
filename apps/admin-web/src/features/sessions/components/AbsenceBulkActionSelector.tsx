'use client';

import { useState, useMemo, useEffect } from 'react';
import { RadioGroup, RadioGroupItem, Label, Button } from '@altitutor/ui';
import { formatDate, formatTimeHHMM } from '@/shared/utils/datetime';
import type { AbsenceAction, RescheduleSession, StudentSession } from '../types/absence';
import { useAvailableRescheduleSessions } from '../hooks';
import { Calendar, ArrowRight, BookOpen } from 'lucide-react';
import { WeekViewCalendar } from './WeekViewCalendar';

interface SessionDecision {
  sessionId: string;
  action: AbsenceAction | null;
  targetSessionId: string | null;
}

interface AbsenceBulkActionSelectorProps {
  sessions: StudentSession[];
  studentId: string;
  onDecisionsChange: (decisions: Array<{ sessionId: string; action: AbsenceAction; targetSessionId?: string; targetSession?: RescheduleSession }>) => void;
  onBack: () => void;
  excludeSessionIds?: string[]; // Session IDs already selected for other absences
}

export function AbsenceBulkActionSelector({
  sessions,
  studentId,
  onDecisionsChange,
  onBack,
  excludeSessionIds = [],
}: AbsenceBulkActionSelectorProps) {
  const [decisions, setDecisions] = useState<Map<string, SessionDecision>>(() => {
    const map = new Map();
    sessions.forEach((session) => {
      map.set(session.id, {
        sessionId: session.id,
        action: null,
        targetSessionId: null,
      });
    });
    return map;
  });

  // Track which session is currently showing reschedule options
  const [activeRescheduleSessionId, setActiveRescheduleSessionId] = useState<string | null>(null);
  
  // Week view state for reschedule session selection
  const [rescheduleWeekStart, setRescheduleWeekStart] = useState<Date>(() => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const currentWeekStart = new Date(today);
    currentWeekStart.setDate(today.getDate() - dayOfWeek);
    currentWeekStart.setHours(0, 0, 0, 0);
    return currentWeekStart;
  });

  const minDate = useMemo(() => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const min = new Date(today);
    min.setDate(today.getDate() - dayOfWeek);
    min.setHours(0, 0, 0, 0);
    return min;
  }, []);

  // Get reschedule sessions for the active session
  const activeSession = sessions.find((s) => s.id === activeRescheduleSessionId);
  const { data: rescheduleSessions, isLoading: loadingRescheduleSessions } = useAvailableRescheduleSessions(
    activeRescheduleSessionId && activeSession
      ? {
          originalSessionId: activeRescheduleSessionId,
          studentId,
          dateRangeDays: 7,
        }
      : null
  );

  // Store rescheduled sessions map
  const [rescheduledSessionsMap, setRescheduledSessionsMap] = useState<Map<string, RescheduleSession>>(new Map());

  const handleActionChange = (sessionId: string, action: AbsenceAction) => {
    setDecisions((prev) => {
      const newMap = new Map(prev);
      const decision = newMap.get(sessionId) || {
        sessionId,
        action: null,
        targetSessionId: null,
      };
      
      if (action === 'reschedule') {
        newMap.set(sessionId, {
          ...decision,
          action: 'reschedule',
          targetSessionId: null, // Reset target when switching to reschedule
        });
        setActiveRescheduleSessionId(sessionId);
      } else {
        newMap.set(sessionId, {
          ...decision,
          action: 'credit',
          targetSessionId: null,
        });
        if (activeRescheduleSessionId === sessionId) {
          setActiveRescheduleSessionId(null);
        }
      }
      return newMap;
    });
  };

  const handleRescheduleSessionSelect = (sessionId: string, targetSessionId: string) => {
    const targetSession = rescheduleSessions?.find((s) => s.id === targetSessionId);
    if (targetSession) {
      setRescheduledSessionsMap((prev) => new Map(prev).set(targetSessionId, targetSession));
    }
    
    setDecisions((prev) => {
      const newMap = new Map(prev);
      const decision = newMap.get(sessionId);
      if (decision) {
        newMap.set(sessionId, {
          ...decision,
          targetSessionId,
        });
      }
      return newMap;
    });
    setActiveRescheduleSessionId(null); // Close reschedule selector
  };

  const canProceed = useMemo(() => {
    return Array.from(decisions.values()).every((d) => {
      if (!d.action) return false;
      if (d.action === 'reschedule' && !d.targetSessionId) return false;
      return true;
    });
  }, [decisions]);

  const handleConfirm = () => {
    if (!canProceed) return;
    const completedDecisions = Array.from(decisions.values())
      .filter((d) => d.action !== null)
      .map((d) => ({
        sessionId: d.sessionId,
        action: d.action!,
        targetSessionId: d.targetSessionId || undefined,
        targetSession: d.targetSessionId ? rescheduledSessionsMap.get(d.targetSessionId) : undefined,
      }));
    onDecisionsChange(completedDecisions);
  };

  const renderSessionCard = (session: StudentSession) => {
    const decision = decisions.get(session.id);
    const sessionDate = session.start_at ? new Date(session.start_at) : null;
    
    // Build subject display
    const subject = session.subject;
    const subjectParts = [];
    if (subject?.curriculum) subjectParts.push(subject.curriculum);
    if (subject?.year_level) subjectParts.push(`Year ${subject.year_level}`);
    if (subject?.name) subjectParts.push(subject.name);
    if (subject?.level) subjectParts.push(subject.level);
    const subjectDisplay = subjectParts.join(' ') || 'Unknown Subject';

    const dateTimeDisplay = sessionDate
      ? `${formatDate(sessionDate)} ${formatTimeHHMM(session.start_at)}${
          session.end_at ? ` - ${formatTimeHHMM(session.end_at)}` : ''
        }`
      : 'TBD';

    const isRescheduleActive = activeRescheduleSessionId === session.id;
    const selectedTargetSessionId = decision?.targetSessionId || null;

    return (
      <div key={session.id} className="flex items-start gap-4 p-4 border rounded-lg">
        {/* Left: Session Info */}
        <div className="flex-1 min-w-0">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <span className="font-medium text-sm">{subjectDisplay}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="h-3.5 w-3.5 flex-shrink-0" />
              <span>{dateTimeDisplay}</span>
            </div>
          </div>
        </div>

        {/* Middle: Arrow */}
        <div className="flex items-center px-2">
          <ArrowRight className="h-5 w-5 text-muted-foreground" />
        </div>

        {/* Right: Action Selection */}
        <div className="flex-1 min-w-0">
          <RadioGroup
            value={decision?.action || ''}
            onValueChange={(value) => handleActionChange(session.id, value as AbsenceAction)}
          >
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="reschedule" id={`reschedule-${session.id}`} />
                <Label htmlFor={`reschedule-${session.id}`} className="cursor-pointer text-sm">
                  Reschedule
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="credit" id={`credit-${session.id}`} />
                <Label htmlFor={`credit-${session.id}`} className="cursor-pointer text-sm">
                  Credit
                </Label>
              </div>
            </div>
          </RadioGroup>

          {/* Reschedule Session Selector */}
          {decision?.action === 'reschedule' && (
            <div className="mt-4 pt-4 border-t">
              {isRescheduleActive ? (
                <div className="space-y-2">
                  <div className="text-xs font-medium mb-2">Select Reschedule Session:</div>
                  {loadingRescheduleSessions ? (
                    <div className="text-xs text-muted-foreground py-2">Loading sessions...</div>
                  ) : rescheduleSessions && rescheduleSessions.length > 0 ? (
                    <WeekViewCalendar
                      sessions={rescheduleSessions.filter((s) => !excludeSessionIds.includes(s.id))}
                      selectedSessionIds={selectedTargetSessionId ? new Set([selectedTargetSessionId]) : new Set()}
                      onToggleSession={(targetId) => {
                        // If clicking the already selected session, deselect it
                        if (selectedTargetSessionId === targetId) {
                          setDecisions((prev) => {
                            const newMap = new Map(prev);
                            const decision = newMap.get(session.id);
                            if (decision) {
                              newMap.set(session.id, {
                                ...decision,
                                targetSessionId: null,
                              });
                            }
                            return newMap;
                          });
                        } else {
                          // Select a new session
                          handleRescheduleSessionSelect(session.id, targetId);
                        }
                      }}
                      currentWeekStart={rescheduleWeekStart}
                      onWeekChange={setRescheduleWeekStart}
                      minDate={minDate}
                    />
                  ) : (
                    <div className="text-xs text-muted-foreground py-2">
                      No available sessions found. Try adjusting the week.
                    </div>
                  )}
                </div>
              ) : selectedTargetSessionId ? (
                <div className="space-y-2">
                  <div className="text-xs text-muted-foreground mb-2">
                    Reschedule session selected.
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setActiveRescheduleSessionId(session.id)}
                    className="text-xs"
                  >
                    Change Selection
                  </Button>
                </div>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setActiveRescheduleSessionId(session.id)}
                  className="text-xs"
                >
                  Select Session
                </Button>
              )}
            </div>
          )}

          {/* Credit Info */}
          {decision?.action === 'credit' && (
            <div className="mt-2 p-2 bg-blue-50 dark:bg-blue-950/20 rounded text-xs text-blue-900 dark:text-blue-100">
              Session will be credited
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="space-y-3 max-h-[500px] overflow-y-auto">
        {sessions.map((session) => renderSessionCard(session))}
      </div>

      <div className="flex gap-3 pt-4 border-t">
        <Button variant="outline" onClick={onBack} className="flex-1">
          Back
        </Button>
        <Button onClick={handleConfirm} disabled={!canProceed} className="flex-1">
          Confirm All Actions
        </Button>
      </div>
    </div>
  );
}

