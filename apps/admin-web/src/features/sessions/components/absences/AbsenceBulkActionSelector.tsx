'use client';

import { useState, useMemo, useEffect } from 'react';
import { RadioGroup, RadioGroupItem, Label, Button } from '@altitutor/ui';
import type { AbsenceAction, RescheduleSession, StudentSession } from '../../types/absence';
import { useAvailableRescheduleSessions } from '../../hooks';
import { ArrowRight, X } from 'lucide-react';
import { WeekViewCalendar } from '../WeekViewCalendar';
import { SessionsCard } from '../SessionsCard';
import type { Tables } from '@altitutor/shared';

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
  onConfirm: () => void;
  canProceed: boolean;
  excludeSessionIds?: string[]; // Session IDs already selected for other absences
}

export function AbsenceBulkActionSelector({
  sessions,
  studentId,
  onDecisionsChange,
  onBack: _onBack,
  onConfirm: _onConfirm,
  canProceed: _canProceed,
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
  
  // Week view state for reschedule session selection (Monday-based)
  const [rescheduleWeekStart, setRescheduleWeekStart] = useState<Date>(() => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const currentWeekStart = new Date(today);
    const diff = currentWeekStart.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
    currentWeekStart.setDate(diff);
    currentWeekStart.setHours(0, 0, 0, 0);
    return currentWeekStart;
  });

  const minDate = useMemo(() => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const min = new Date(today);
    const diff = min.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
    min.setDate(diff);
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
        // Clear rescheduled session from map if switching
        if (decision.targetSessionId) {
          setRescheduledSessionsMap((prev) => {
            const newMap = new Map(prev);
            newMap.delete(decision.targetSessionId!);
            return newMap;
          });
        }
      } else {
        newMap.set(sessionId, {
          ...decision,
          action: 'credit',
          targetSessionId: null,
        });
        if (activeRescheduleSessionId === sessionId) {
          setActiveRescheduleSessionId(null);
        }
        // Clear rescheduled session from map
        if (decision.targetSessionId) {
          setRescheduledSessionsMap((prev) => {
            const newMap = new Map(prev);
            newMap.delete(decision.targetSessionId!);
            return newMap;
          });
        }
      }
      return newMap;
    });
  };

  const handleResetAction = (sessionId: string) => {
    setDecisions((prev) => {
      const newMap = new Map(prev);
      const decision = newMap.get(sessionId);
      if (decision?.targetSessionId) {
        setRescheduledSessionsMap((prev) => {
          const newMap = new Map(prev);
          newMap.delete(decision.targetSessionId!);
          return newMap;
        });
      }
      newMap.set(sessionId, {
        sessionId,
        action: null,
        targetSessionId: null,
      });
      if (activeRescheduleSessionId === sessionId) {
        setActiveRescheduleSessionId(null);
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

  // Update parent when decisions change - use useMemo to avoid infinite loops
  const completedDecisions = useMemo(() => {
    return Array.from(decisions.values())
      .filter((d) => d.action !== null)
      .map((d) => ({
        sessionId: d.sessionId,
        action: d.action!,
        targetSessionId: d.targetSessionId || undefined,
        targetSession: d.targetSessionId ? rescheduledSessionsMap.get(d.targetSessionId) : undefined,
      }));
  }, [decisions, rescheduledSessionsMap]);

  // Only call onDecisionsChange when completedDecisions actually change
  useEffect(() => {
    onDecisionsChange(completedDecisions);
  }, [completedDecisions]); // eslint-disable-line react-hooks/exhaustive-deps

  const renderSessionCard = (session: StudentSession) => {
    const decision = decisions.get(session.id);
    const isRescheduleActive = activeRescheduleSessionId === session.id;
    const selectedTargetSessionId = decision?.targetSessionId || null;
    const selectedTargetSession = selectedTargetSessionId 
      ? rescheduledSessionsMap.get(selectedTargetSessionId) 
      : null;

    // Convert to Tables<'sessions'> for SessionsCard
    const sessionForCard: Tables<'sessions'> = {
      id: session.id,
      start_at: session.start_at,
      end_at: session.end_at,
      class_id: session.class_id,
      type: session.type,
      billing_type: null,
      status: 'SCHEDULED',
      subject_id: session.class?.subject_id || null,
      created_at: null,
      updated_at: null,
    } as Tables<'sessions'>;

    // Convert reschedule session to Tables<'sessions'> if selected
    const rescheduleSessionForCard: Tables<'sessions'> | null = selectedTargetSession ? {
      id: selectedTargetSession.id,
      start_at: selectedTargetSession.start_at,
      end_at: selectedTargetSession.end_at,
      class_id: selectedTargetSession.class_id,
      type: selectedTargetSession.type,
      billing_type: null,
      status: 'SCHEDULED',
      subject_id: selectedTargetSession.class?.subject_id || null,
      created_at: null,
      updated_at: null,
    } as Tables<'sessions'> : null;

    return (
      <div key={session.id} className="space-y-4">
        {/* Row: Session Card -> Arrow -> Action Selection */}
        <div className="flex items-start gap-4">
          {/* Left: Session Card */}
          <div className="flex-1 min-w-0">
            <SessionsCard
              session={sessionForCard}
              classData={session.class || undefined}
              subject={session.subject || undefined}
              staff={[]}
              students={[]}
              compact={false}
            />
          </div>

          {/* Middle: Arrow */}
          <div className="flex items-center px-2 pt-3">
            <ArrowRight className="h-5 w-5 text-muted-foreground" />
          </div>

          {/* Right: Action Selection or Selected Reschedule/Credit Session */}
          <div className="flex-1 min-w-0">
            {decision?.action === 'reschedule' && selectedTargetSession && rescheduleSessionForCard ? (
              // Show selected reschedule session card with X button
              <div className="relative">
                <SessionsCard
                  session={rescheduleSessionForCard}
                  classData={selectedTargetSession.class || undefined}
                  subject={selectedTargetSession.subject || undefined}
                  staff={[]}
                  students={[]}
                  compact={false}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleResetAction(session.id)}
                  className="absolute top-2 right-2 h-6 w-6 p-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : decision?.action === 'credit' ? (
              // Show credit session card with X button (match height of reschedule card)
              <div className="relative">
                <div className="rounded-lg border-2 border-red-500 bg-red-50 dark:bg-red-950/20">
                  <SessionsCard
                    session={sessionForCard}
                    classData={session.class || undefined}
                    subject={session.subject || undefined}
                    staff={[]}
                    students={[]}
                    compact={false}
                  />
                  <div className="absolute inset-0 pointer-events-none flex items-center justify-center bg-red-50/90 dark:bg-red-950/80 rounded-lg">
                    <div className="text-center pointer-events-auto">
                      <div className="font-semibold text-red-700 dark:text-red-300">Credit Session</div>
                      <div className="text-xs text-red-600 dark:text-red-400 mt-1">No charge for this session</div>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleResetAction(session.id)}
                    className="absolute top-2 right-2 h-6 w-6 p-0 z-10"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ) : (
              // Show radio buttons for action selection
              <div className="pt-3">
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
              </div>
            )}
          </div>
        </div>

        {/* Reschedule Calendar - Full Width Below Row */}
        {decision?.action === 'reschedule' && isRescheduleActive && !selectedTargetSessionId && (
          <div className="pt-4 border-t">
            {loadingRescheduleSessions ? (
              <div className="text-xs text-muted-foreground py-2">Loading sessions...</div>
            ) : rescheduleSessions && rescheduleSessions.length > 0 ? (
              <WeekViewCalendar
                sessions={rescheduleSessions.filter((s) => !excludeSessionIds.includes(s.id))}
                selectedSessionIds={new Set()}
                onToggleSession={(targetId) => {
                  handleRescheduleSessionSelect(session.id, targetId);
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
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="space-y-6 max-h-[500px] overflow-y-auto">
        {sessions.map((session) => renderSessionCard(session))}
      </div>
    </div>
  );
}

