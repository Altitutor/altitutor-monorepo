'use client';

import { useState, useMemo, useEffect } from 'react';
import { RadioGroup, RadioGroupItem, Label, Button } from '@altitutor/ui';
import type { StaffAbsenceAction, StaffSession, ReplacementStaff } from '../types/staff-absence';
import { ArrowRight, X } from 'lucide-react';
import { SessionsCard } from './SessionsCard';
import { ReplacementStaffDropdown } from './ReplacementStaffDropdown';
import { StaffCard } from '@/shared/components/StaffCard';
import type { Tables } from '@altitutor/shared';

interface SessionDecision {
  sessionId: string;
  action: StaffAbsenceAction | null;
  replacementStaffId: string | null;
}

interface StaffAbsenceBulkActionSelectorProps {
  sessions: StaffSession[];
  staffId: string;
  onDecisionsChange: (decisions: Array<{ sessionId: string; action: StaffAbsenceAction; replacementStaffId?: string; replacementStaff?: ReplacementStaff }>) => void;
  excludeStaffIds?: string[]; // Staff IDs already selected for other swaps
}

export function StaffAbsenceBulkActionSelector({
  sessions,
  staffId,
  onDecisionsChange,
  excludeStaffIds = [],
}: StaffAbsenceBulkActionSelectorProps) {
  const [decisions, setDecisions] = useState<Map<string, SessionDecision>>(() => {
    const map = new Map();
    sessions.forEach((session) => {
      map.set(session.id, {
        sessionId: session.id,
        action: null,
        replacementStaffId: null,
      });
    });
    return map;
  });

  // Store replacement staff map
  const [replacementStaffMap, setReplacementStaffMap] = useState<Map<string, ReplacementStaff>>(new Map());

  const handleActionChange = (sessionId: string, action: StaffAbsenceAction) => {
    setDecisions((prev) => {
      const newMap = new Map(prev);
      const decision = newMap.get(sessionId) || {
        sessionId,
        action: null,
        replacementStaffId: null,
      };
      
      if (action === 'swap') {
        newMap.set(sessionId, {
          ...decision,
          action: 'swap',
          replacementStaffId: null, // Reset replacement when switching to swap
        });
        // Clear replacement staff from map if switching
        if (decision.replacementStaffId) {
          setReplacementStaffMap((prev) => {
            const newMap = new Map(prev);
            newMap.delete(decision.replacementStaffId!);
            return newMap;
          });
        }
      } else {
        newMap.set(sessionId, {
          ...decision,
          action: 'log',
          replacementStaffId: null,
        });
        // Clear replacement staff from map
        if (decision.replacementStaffId) {
          setReplacementStaffMap((prev) => {
            const newMap = new Map(prev);
            newMap.delete(decision.replacementStaffId!);
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
      if (decision?.replacementStaffId) {
        setReplacementStaffMap((prev) => {
          const newMap = new Map(prev);
          newMap.delete(decision.replacementStaffId!);
          return newMap;
        });
      }
      newMap.set(sessionId, {
        sessionId,
        action: null,
        replacementStaffId: null,
      });
      return newMap;
    });
  };

  const handleReplacementStaffSelect = (sessionId: string, staffId: string, staff: ReplacementStaff) => {
    setReplacementStaffMap((prev) => new Map(prev).set(staffId, staff));
    
    setDecisions((prev) => {
      const newMap = new Map(prev);
      const decision = newMap.get(sessionId);
      if (decision) {
        newMap.set(sessionId, {
          ...decision,
          replacementStaffId: staffId,
        });
      }
      return newMap;
    });
  };

  // Update parent when decisions change - use useMemo to avoid infinite loops
  const completedDecisions = useMemo(() => {
    return Array.from(decisions.values())
      .filter((d) => d.action !== null)
      .map((d) => ({
        sessionId: d.sessionId,
        action: d.action!,
        replacementStaffId: d.replacementStaffId || undefined,
        replacementStaff: d.replacementStaffId ? replacementStaffMap.get(d.replacementStaffId) : undefined,
      }));
  }, [decisions, replacementStaffMap]);

  // Only call onDecisionsChange when completedDecisions actually change
  useEffect(() => {
    onDecisionsChange(completedDecisions);
  }, [completedDecisions]); // eslint-disable-line react-hooks/exhaustive-deps

  const renderSessionCard = (session: StaffSession) => {
    const decision = decisions.get(session.id);
    const selectedReplacementStaffId = decision?.replacementStaffId || null;
    const selectedReplacementStaff = selectedReplacementStaffId 
      ? replacementStaffMap.get(selectedReplacementStaffId) 
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

          {/* Right: Action Selection or Selected Replacement/Log Absence */}
          <div className="flex-1 min-w-0">
            {decision?.action === 'swap' && selectedReplacementStaff ? (
              // Show selected replacement staff card with X button
              <div className="relative">
                <StaffCard
                  staff={selectedReplacementStaff}
                  subjects={selectedReplacementStaff.subjects}
                  showActions={false}
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
            ) : decision?.action === 'log' ? (
              // Show "No staff swap" card with X button
              <div className="relative">
                <div className="rounded-lg border-2 border-red-500 bg-red-50 dark:bg-red-950/20 p-4 flex items-center justify-center min-h-[100px]">
                  <div className="text-center">
                    <div className="font-semibold text-red-700 dark:text-red-300">No Staff Swap</div>
                    <div className="text-xs text-red-600 dark:text-red-400 mt-1">Absence logged without replacement</div>
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
            ) : (
              // Show radio buttons for action selection
              <div className="pt-3 space-y-4">
                <RadioGroup
                  value={decision?.action || ''}
                  onValueChange={(value) => handleActionChange(session.id, value as StaffAbsenceAction)}
                >
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="swap" id={`swap-${session.id}`} />
                      <Label htmlFor={`swap-${session.id}`} className="cursor-pointer text-sm">
                        Swap staff
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="log" id={`log-${session.id}`} />
                      <Label htmlFor={`log-${session.id}`} className="cursor-pointer text-sm">
                        Log absence
                      </Label>
                    </div>
                  </div>
                </RadioGroup>

                {/* Replacement Staff Dropdown - Show when swap is selected but no replacement chosen */}
                {decision?.action === 'swap' && !selectedReplacementStaffId && session.subject?.id && (
                  <div className="pt-2">
                    <ReplacementStaffDropdown
                      sessionId={session.id}
                      subjectId={session.subject.id}
                      excludeStaffIds={[staffId, ...excludeStaffIds]}
                      onSelect={(replacementStaffId, replacementStaff) => {
                        handleReplacementStaffSelect(session.id, replacementStaffId, replacementStaff);
                      }}
                      selectedStaffId={selectedReplacementStaffId || undefined}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
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

