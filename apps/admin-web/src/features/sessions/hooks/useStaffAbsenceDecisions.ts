import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import type { StaffAbsenceAction, StaffSession, ReplacementStaff } from '../types/staff-absence';

interface SessionDecision {
  sessionId: string;
  action: StaffAbsenceAction | null;
  replacementStaffId: string | null;
}

export interface CompletedDecision {
  sessionId: string;
  action: StaffAbsenceAction;
  replacementStaffId?: string;
  replacementStaff?: ReplacementStaff;
}

export interface UseStaffAbsenceDecisionsProps {
  sessions: StaffSession[];
  onDecisionsChange: (decisions: CompletedDecision[]) => void;
}

export interface UseStaffAbsenceDecisionsReturn {
  // State
  decisions: Map<string, SessionDecision>;
  replacementStaffMap: Map<string, ReplacementStaff>;
  
  // Actions
  handleActionChange: (sessionId: string, action: StaffAbsenceAction) => void;
  handleResetAction: (sessionId: string) => void;
  handleReplacementStaffSelect: (sessionId: string, staffId: string, staff: ReplacementStaff) => void;
  
  // Computed
  getDecision: (sessionId: string) => SessionDecision | undefined;
  getReplacementStaff: (staffId: string) => ReplacementStaff | undefined;
}

/**
 * Hook for managing staff absence decisions in bulk action selector
 * Handles state for swap/log decisions and replacement staff selection
 */
export function useStaffAbsenceDecisions({
  sessions,
  onDecisionsChange,
}: UseStaffAbsenceDecisionsProps): UseStaffAbsenceDecisionsReturn {
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

  const handleActionChange = useCallback((sessionId: string, action: StaffAbsenceAction) => {
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
          setReplacementStaffMap((prevMap) => {
            const newMap = new Map(prevMap);
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
          setReplacementStaffMap((prevMap) => {
            const newMap = new Map(prevMap);
            newMap.delete(decision.replacementStaffId!);
            return newMap;
          });
        }
      }
      return newMap;
    });
  }, []);

  const handleResetAction = useCallback((sessionId: string) => {
    setDecisions((prev) => {
      const newMap = new Map(prev);
      const decision = newMap.get(sessionId);
      if (decision?.replacementStaffId) {
        setReplacementStaffMap((prevMap) => {
          const newMap = new Map(prevMap);
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
  }, []);

  const handleReplacementStaffSelect = useCallback((sessionId: string, staffId: string, staff: ReplacementStaff) => {
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
  }, []);

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
  // Use a ref to store the callback to avoid infinite loops
  const onDecisionsChangeRef = useRef(onDecisionsChange);
  
  useEffect(() => {
    onDecisionsChangeRef.current = onDecisionsChange;
  }, [onDecisionsChange]);

  useEffect(() => {
    onDecisionsChangeRef.current(completedDecisions);
  }, [completedDecisions]);

  const getDecision = useCallback((sessionId: string) => {
    return decisions.get(sessionId);
  }, [decisions]);

  const getReplacementStaff = useCallback((staffId: string) => {
    return replacementStaffMap.get(staffId);
  }, [replacementStaffMap]);

  return {
    decisions,
    replacementStaffMap,
    handleActionChange,
    handleResetAction,
    handleReplacementStaffSelect,
    getDecision,
    getReplacementStaff,
  };
}
