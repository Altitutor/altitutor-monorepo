'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  Button,
} from '@altitutor/ui';
import { useStudentFutureSessions, useLogAbsences } from '../hooks';
import { studentsApi } from '@/features/students/api';
import { AbsenceSessionSelector } from './AbsenceSessionSelector';
import { AbsenceBulkActionSelector } from './AbsenceBulkActionSelector';
import { AbsenceSummary } from './AbsenceSummary';
import type {
  AbsenceDecision,
  AbsenceOperation,
  StudentSession,
  RescheduleSession,
} from '../types/absence';
import { formatDate, formatTimeHHMM } from '@/shared/utils/datetime';
import { Search, Loader2 } from 'lucide-react';
import { Input } from '@altitutor/ui';
import { useQuery } from '@tanstack/react-query';
import type { Tables, Database } from '@altitutor/shared';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import type { SupabaseClient } from '@supabase/supabase-js';

type WizardStep = 'select-student' | 'select-sessions' | 'process-sessions' | 'review' | 'confirm' | 'success' | 'error';

interface LogAbsenceDialogProps {
  isOpen: boolean;
  onClose: () => void;
  staffId: string;
}

export function LogAbsenceDialog({ isOpen, onClose, staffId }: LogAbsenceDialogProps) {
  const [step, setStep] = useState<WizardStep>('select-student');
  const [selectedStudent, setSelectedStudent] = useState<Tables<'students'> | null>(null);
  const [selectedSessionIds, setSelectedSessionIds] = useState<Set<string>>(new Set());
  const [decisions, setDecisions] = useState<AbsenceDecision[]>([]);
  const [currentSessionIndex, setCurrentSessionIndex] = useState(0);
  const [rescheduledSessionsMap, setRescheduledSessionsMap] = useState<
    Map<string, RescheduleSession>
  >(new Map());
  const [errorMessage, setErrorMessage] = useState<string>('');
  
  // Student search - use server-side search to avoid pagination limits
  const [searchQuery, setSearchQuery] = useState('');
  const { data: searchResults, isLoading: loadingStudents } = useQuery({
    queryKey: ['students', 'search', searchQuery.trim()],
    queryFn: async () => {
      const trimmed = searchQuery.trim();
      if (!trimmed) return { students: [], total: 0 };
      
      // Use server-side search function for better performance and to avoid pagination limits
      const supabase = getSupabaseClient() as SupabaseClient<Database>;
      const { data: rpcResult, error: rpcError } = await supabase.rpc('search_students_admin', {
        p_search: trimmed,
        p_statuses: ['ACTIVE'], // Only ACTIVE students for absence logging
        p_include_relationships: false, // We don't need relationships here
        p_limit: 50, // Show up to 50 results
        p_offset: 0,
        p_order_by: 'last_name',
        p_ascending: true,
      });

      if (rpcError) throw rpcError;
      if (!rpcResult) return { students: [], total: 0 };

      const rpcData = rpcResult as { students: any[]; total: number };
      // Transform RPC response to match Tables<'students'> format
      // The RPC function returns: id, first_name, last_name, status, curriculum, year_level, school
      const students = (rpcData.students || []).map((s: any) => ({
        id: s.id,
        first_name: s.first_name,
        last_name: s.last_name,
        status: s.status,
        curriculum: s.curriculum || null,
        year_level: s.year_level || null,
        school: s.school || null,
        // These fields may not be in the RPC response, but we'll include them as null
        // The component only needs basic fields for display
        email: s.email || null,
        phone: s.phone || null,
        created_at: s.created_at || null,
        updated_at: s.updated_at || null,
      })) as Tables<'students'>[];
      
      return {
        students,
        total: rpcData.total || 0,
      };
    },
    enabled: searchQuery.trim().length > 0, // Only search when there's a query
    staleTime: 1000 * 30, // 30 seconds stale time for search results
  });

  const filteredStudents = useMemo(() => {
    if (!searchQuery.trim()) return [];
    return (searchResults?.students || []).slice(0, 10); // Limit to 10 results for display
  }, [searchResults, searchQuery]);

  // Get student's future sessions (8 weeks ahead by default)
  const { data: futureSessions, isLoading: loadingSessions } = useStudentFutureSessions(
    selectedStudent?.id || null
  );

  // Log absences mutation
  const logAbsencesMutation = useLogAbsences();

  // Reset state when dialog closes
  useEffect(() => {
    if (!isOpen) {
      setStep('select-student');
      setSelectedStudent(null);
      setSelectedSessionIds(new Set());
      setDecisions([]);
      setCurrentSessionIndex(0);
      setRescheduledSessionsMap(new Map());
      setSearchQuery('');
      setErrorMessage('');
    }
  }, [isOpen]);

  const selectedSessionsArray = useMemo(() => {
    if (!futureSessions) return [];
    return futureSessions.filter((s) => selectedSessionIds.has(s.id));
  }, [futureSessions, selectedSessionIds]);

  const currentSession = selectedSessionsArray[currentSessionIndex];

  const sessionsMap = useMemo(() => {
    const map = new Map<string, StudentSession>();
    futureSessions?.forEach((session) => {
      map.set(session.id, session);
    });
    return map;
  }, [futureSessions]);

  const handleStudentSelect = (student: Tables<'students'>) => {
    setSelectedStudent(student);
    setStep('select-sessions');
  };

  const handleToggleSession = (sessionId: string) => {
    const newSet = new Set(selectedSessionIds);
    if (newSet.has(sessionId)) {
      newSet.delete(sessionId);
    } else {
      newSet.add(sessionId);
    }
    setSelectedSessionIds(newSet);
  };

  const handleProceedToProcess = () => {
    if (selectedSessionIds.size === 0) {
      alert('Please select at least one session');
      return;
    }
    setStep('process-sessions');
  };

  const handleBulkDecisionsChange = (bulkDecisions: Array<{ sessionId: string; action: AbsenceAction; targetSessionId?: string; targetSession?: RescheduleSession }>) => {
    if (!selectedStudent) return;

    // Convert bulk decisions to AbsenceDecision format
    const newDecisions: AbsenceDecision[] = bulkDecisions.map((bulkDecision) => {
      const session = selectedSessionsArray.find((s) => s.id === bulkDecision.sessionId);
      if (!session) {
        throw new Error(`Session ${bulkDecision.sessionId} not found`);
      }

      // Store target session in map for later display
      if (bulkDecision.action === 'reschedule' && bulkDecision.targetSession && bulkDecision.targetSessionId) {
        setRescheduledSessionsMap((prev) => new Map(prev).set(bulkDecision.targetSessionId!, bulkDecision.targetSession!));
      }

      return {
        sessionId: session.id,
        sessionsStudentsId: session.sessionsStudentsId,
        action: bulkDecision.action,
        targetSessionId: bulkDecision.targetSessionId,
      };
    });

    setDecisions(newDecisions);
    setStep('review');
  };

  const handleFinalConfirm = async () => {
    if (!selectedStudent) return;

    // Convert decisions to operations
    const operations: AbsenceOperation[] = decisions.map((decision) => ({
      student_id: selectedStudent.id,
      original_sessions_students_id: decision.sessionsStudentsId,
      action: decision.action!,
      target_session_id: decision.targetSessionId,
    }));

    setStep('confirm');

    try {
      // Submit to API
      const result = await logAbsencesMutation.mutateAsync({
        operations,
        staffId,
      });

      if (result.success) {
        // Success - show success screen
        setStep('success');
      } else {
        setErrorMessage(result.error || 'Unknown error occurred');
        setStep('error');
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'An unexpected error occurred');
      setStep('error');
    }
  };

  const renderStepContent = () => {
    switch (step) {
      case 'select-student':
        return (
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search students by name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            {loadingStudents ? (
              <div className="py-8 text-center text-muted-foreground">Loading students...</div>
            ) : searchQuery.trim() && filteredStudents.length > 0 ? (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {filteredStudents.map((student) => (
                  <div
                    key={student.id}
                    className="p-3 rounded-lg border-2 border-border hover:border-primary/50 hover:bg-primary/5 cursor-pointer transition-all"
                    onClick={() => handleStudentSelect(student)}
                  >
                    <div className="font-medium">
                      {student.first_name} {student.last_name}
                    </div>
                    {student.school && (
                      <div className="text-sm text-muted-foreground">{student.school}</div>
                    )}
                    {student.year_level && (
                      <div className="text-xs text-muted-foreground">Year {student.year_level}</div>
                    )}
                  </div>
                ))}
              </div>
            ) : searchQuery.trim() ? (
              <div className="py-8 text-center text-muted-foreground">No students found</div>
            ) : (
              <div className="py-8 text-center text-muted-foreground">
                Start typing to search for students
              </div>
            )}
          </div>
        );

      case 'select-sessions':
        return (
          <div className="space-y-4">
            <div className="p-3 bg-muted rounded-lg">
              <div className="font-semibold">
                {selectedStudent?.first_name} {selectedStudent?.last_name}
              </div>
              {selectedStudent?.school && (
                <div className="text-sm text-muted-foreground">{selectedStudent.school}</div>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold">Select Sessions to Log Absence</h4>
                <div className="text-sm text-muted-foreground">
                  {selectedSessionIds.size} selected
                </div>
              </div>
              <AbsenceSessionSelector
                sessions={futureSessions || []}
                selectedSessionIds={selectedSessionIds}
                onToggleSession={handleToggleSession}
                isLoading={loadingSessions}
              />
            </div>

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => {
                // Clear all saved decisions when going back
                setDecisions([]);
                setRescheduledSessionsMap(new Map());
                setCurrentSessionIndex(0);
                setStep('select-student');
              }} className="flex-1">
                Back
              </Button>
              <Button
                onClick={handleProceedToProcess}
                disabled={selectedSessionIds.size === 0}
                className="flex-1"
              >
                Next ({selectedSessionIds.size} session{selectedSessionIds.size !== 1 ? 's' : ''})
              </Button>
            </div>
          </div>
        );

      case 'process-sessions':
        return (
          <div className="space-y-4">
            <div className="p-3 bg-muted rounded-lg">
              <div className="font-semibold">
                {selectedStudent?.first_name} {selectedStudent?.last_name}
              </div>
              <div className="text-sm text-muted-foreground">
                Select action for {selectedSessionsArray.length} session{selectedSessionsArray.length !== 1 ? 's' : ''}
              </div>
            </div>

            <AbsenceBulkActionSelector
              sessions={selectedSessionsArray}
              studentId={selectedStudent!.id}
              onDecisionsChange={handleBulkDecisionsChange}
              onBack={() => {
                setDecisions([]);
                setRescheduledSessionsMap(new Map());
                setStep('select-sessions');
              }}
              excludeSessionIds={decisions
                .filter((d) => d.action === 'reschedule' && d.targetSessionId)
                .map((d) => d.targetSessionId!)} // Exclude already selected reschedule targets
            />
          </div>
        );

      case 'review':
        return (
          <div className="space-y-4">
            <div className="p-3 bg-muted rounded-lg">
              <div className="font-semibold">
                {selectedStudent?.first_name} {selectedStudent?.last_name}
              </div>
              <div className="text-sm text-muted-foreground">Review all absence actions</div>
            </div>

            <AbsenceSummary
              decisions={decisions}
              sessionsMap={sessionsMap}
              rescheduledSessionsMap={rescheduledSessionsMap}
            />

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setStep('process-sessions');
                }}
                className="flex-1"
              >
                Back
              </Button>
              <Button onClick={handleFinalConfirm} className="flex-1">
                Confirm All Changes
              </Button>
            </div>
          </div>
        );

      case 'confirm':
        return (
          <div className="py-12 text-center space-y-4">
            <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
            <div className="text-lg font-semibold">Processing absences...</div>
            <div className="text-sm text-muted-foreground">
              Please wait while we log the absences
            </div>
          </div>
        );

      case 'success':
        return (
          <div className="py-12 text-center space-y-4">
            <div className="h-16 w-16 rounded-full bg-green-100 dark:bg-green-900/20 mx-auto flex items-center justify-center">
              <svg
                className="h-8 w-8 text-green-600 dark:text-green-400"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path d="M5 13l4 4L19 7"></path>
              </svg>
            </div>
            <div className="text-lg font-semibold">Absences Logged Successfully!</div>
            <div className="text-sm text-muted-foreground">
              {decisions.length} session{decisions.length !== 1 ? 's' : ''} processed
            </div>
            <div className="pt-4">
              <Button onClick={onClose} className="w-full">
                Close
              </Button>
            </div>
          </div>
        );

      case 'error':
        return (
          <div className="py-12 text-center space-y-4">
            <div className="h-16 w-16 rounded-full bg-red-100 dark:bg-red-900/20 mx-auto flex items-center justify-center">
              <svg
                className="h-8 w-8 text-red-600 dark:text-red-400"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path d="M6 18L18 6M6 6l12 12"></path>
              </svg>
            </div>
            <div className="text-lg font-semibold">Error Logging Absences</div>
            <div className="text-sm text-muted-foreground max-w-md mx-auto">
              {errorMessage}
            </div>
            <div className="pt-4 flex gap-3">
              <Button variant="outline" onClick={() => setStep('review')} className="flex-1">
                Go Back
              </Button>
              <Button onClick={onClose} className="flex-1">
                Close
              </Button>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  const getStepTitle = () => {
    switch (step) {
      case 'select-student':
        return 'Select Student';
      case 'select-sessions':
        return 'Select Sessions';
      case 'process-sessions':
        return 'Process Absences';
      case 'review':
        return 'Review Summary';
      case 'confirm':
        return 'Confirming...';
      default:
        return 'Log Absence';
    }
  };

  const getStepDescription = () => {
    switch (step) {
      case 'select-student':
        return 'Search and select the student to log absences for';
      case 'select-sessions':
        return 'Select which future sessions the student will be absent from';
      case 'process-sessions':
        return 'Choose whether to reschedule or credit each session';
      case 'review':
        return 'Review all changes before confirming';
      case 'confirm':
        return 'Submitting your changes...';
      default:
        return '';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{getStepTitle()}</DialogTitle>
          <DialogDescription>{getStepDescription()}</DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-4">{renderStepContent()}</div>
      </DialogContent>
    </Dialog>
  );
}

