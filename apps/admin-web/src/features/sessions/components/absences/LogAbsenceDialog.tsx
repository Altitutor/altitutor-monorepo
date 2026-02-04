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
import { useStudentFutureSessions, useLogAbsences } from '../../hooks';
import { AbsenceSessionSelector } from './AbsenceSessionSelector';
import { AbsenceBulkActionSelector } from './AbsenceBulkActionSelector';
import { StudentCard } from '@/shared/components/StudentCard';
import type {
  AbsenceDecision,
  AbsenceOperation,
  AbsenceAction,
  StudentSession,
  RescheduleSession,
} from '../../types/absence';
import { Search, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { Input } from '@altitutor/ui';
import { useStudentsSearchForAbsence } from '@/features/students/hooks';
import type { Tables, Database } from '@altitutor/shared';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import type { SupabaseClient } from '@supabase/supabase-js';

type WizardStep = 'select-student' | 'select-sessions' | 'process-sessions' | 'success' | 'error';

interface LogAbsenceDialogProps {
  isOpen: boolean;
  onClose: () => void;
  staffId: string;
  initialStudentId?: string | null;
  initialSessionId?: string | null;
  allowPastSessions?: boolean;
}

export function LogAbsenceDialog({ isOpen, onClose, staffId, initialStudentId, initialSessionId, allowPastSessions = false }: LogAbsenceDialogProps) {
  const [step, setStep] = useState<WizardStep>('select-student');
  const [selectedStudent, setSelectedStudent] = useState<Tables<'students'> | null>(null);
  const [selectedSessionIds, setSelectedSessionIds] = useState<Set<string>>(new Set());
  const [decisions, setDecisions] = useState<AbsenceDecision[]>([]);
  const [, setCurrentSessionIndex] = useState(0);
  const [, setRescheduledSessionsMap] = useState<
    Map<string, RescheduleSession>
  >(new Map());
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [hasInitialized, setHasInitialized] = useState(false);
  
  // Student search and pagination
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(0);
  const pageSize = 20;
  
  const { data: studentResults, isLoading: loadingStudents } = useStudentsSearchForAbsence({
    search: searchQuery,
    page,
    pageSize,
  });

  // Reset page when search query changes
  useEffect(() => {
    setPage(0);
  }, [searchQuery]);

  // Get student's sessions (8 weeks ahead by default, optionally include past sessions)
  const { data: futureSessions, isLoading: loadingSessions } = useStudentFutureSessions(
    selectedStudent?.id || initialStudentId || null,
    8,
    allowPastSessions,
    4 // weeks back when allowing past sessions
  );

  // Fetch the specific session if it's not in futureSessions but initialSessionId is provided
  const [missingSession, setMissingSession] = useState<StudentSession | null>(null);
  useEffect(() => {
    const fetchMissingSession = async () => {
      if (!isOpen || !initialSessionId || !initialStudentId || !futureSessions) return;
      
      const sessionExists = futureSessions.some(s => s.id === initialSessionId);
      if (sessionExists) {
        setMissingSession(null);
        return;
      }

      // Session is missing, fetch it directly
      try {
        const supabase = getSupabaseClient() as SupabaseClient<Database>;
        const { data, error } = await supabase
          .from('sessions_students')
          .select(`
            id,
            session_id,
            planned_absence,
            session:sessions!inner(
              *,
              class:classes(
                *,
                subject:subjects(*)
              )
            )
          `)
          .eq('student_id', initialStudentId)
          .eq('session_id', initialSessionId)
          .maybeSingle();

        if (!error && data && data.session) {
          const session: StudentSession = {
            ...data.session,
            class: data.session.class || null,
            subject: data.session.class?.subject || null,
            sessionsStudentsId: data.id,
          };
          setMissingSession(session);
        } else {
          setMissingSession(null);
        }
      } catch (error) {
        console.error('Error fetching missing session:', error);
        setMissingSession(null);
      }
    };

    fetchMissingSession();
  }, [isOpen, initialSessionId, initialStudentId, futureSessions]);

  // Combine futureSessions with missingSession
  const allSessions = useMemo(() => {
    if (!futureSessions) return missingSession ? [missingSession] : [];
    if (!missingSession) return futureSessions;
    // Check if missingSession is already in futureSessions
    if (futureSessions.some(s => s.id === missingSession.id)) {
      return futureSessions;
    }
    return [...futureSessions, missingSession];
  }, [futureSessions, missingSession]);

  // Log absences mutation
  const logAbsencesMutation = useLogAbsences();

  // Initialize with pre-filled values
  useEffect(() => {
    if (isOpen && initialStudentId && !selectedStudent && !hasInitialized) {
      // Fetch the initial student
      const fetchInitialStudent = async () => {
        const supabase = getSupabaseClient() as SupabaseClient<Database>;
        const { data, error } = await supabase
          .from('students')
          .select('*')
          .eq('id', initialStudentId)
          .single();
        
        if (!error && data) {
          setSelectedStudent(data as Tables<'students'>);
          // If initialSessionId is also provided, select it
          if (initialSessionId) {
            setSelectedSessionIds(new Set([initialSessionId]));
          }
          setHasInitialized(true);
        }
      };
      fetchInitialStudent();
    }
  }, [isOpen, initialStudentId, initialSessionId, selectedStudent, hasInitialized]);

  // Auto-advance to select-sessions when student is loaded and we have initial values
  useEffect(() => {
    if (isOpen && selectedStudent && initialStudentId && hasInitialized && step === 'select-student') {
      setStep('select-sessions');
    }
  }, [isOpen, selectedStudent, initialStudentId, hasInitialized, step]);

  // Auto-advance to process-sessions when session is selected and both initial values are provided
  useEffect(() => {
    if (isOpen && selectedStudent && initialSessionId && selectedSessionIds.has(initialSessionId) && step === 'select-sessions' && hasInitialized) {
      // Auto-advance to process step since we have everything pre-filled
      setStep('process-sessions');
    }
  }, [isOpen, selectedStudent, initialSessionId, selectedSessionIds, step, hasInitialized]);

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
      setPage(0);
      setErrorMessage('');
      setHasInitialized(false);
      setMissingSession(null);
    }
  }, [isOpen]);

  const selectedSessionsArray = useMemo(() => {
    if (!allSessions || allSessions.length === 0) {
      return [];
    }
    return allSessions.filter((s) => selectedSessionIds.has(s.id));
  }, [allSessions, selectedSessionIds]);

  const handleStudentSelect = (student: Tables<'students'>) => {
    setSelectedStudent(student);
    // Don't auto-advance - user must click Next button
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
  };

  const handleConfirmAndSubmit = () => {
    if (!selectedStudent) return;
    
    // Check if all decisions are complete
    const allComplete = decisions.every((d) => {
      if (!d.action) return false;
      if (d.action === 'reschedule' && !d.targetSessionId) return false;
      return true;
    });

    if (!allComplete || decisions.length === 0) return;

    // Submit the decisions
    handleFinalConfirm(decisions);
  };

  const handleFinalConfirm = async (decisionsToSubmit: AbsenceDecision[]) => {
    if (!selectedStudent) return;

    // Convert decisions to operations
    const operations: AbsenceOperation[] = decisionsToSubmit.map((decision) => ({
      student_id: selectedStudent.id,
      original_sessions_students_id: decision.sessionsStudentsId,
      action: decision.action!,
      target_session_id: decision.targetSessionId,
    }));

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
          <div className="flex flex-col h-full">
            <div className="relative mb-4">
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
            ) : studentResults && studentResults.students && studentResults.students.length > 0 ? (
              <div className="flex-1 overflow-y-auto space-y-2 min-h-0">
                {studentResults.students.map((student) => (
                  <div
                    key={student.id}
                    className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${
                      selectedStudent?.id === student.id
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50 hover:bg-primary/5'
                    }`}
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
                {/* Pagination controls */}
                {studentResults && studentResults.total > pageSize && (
                  <div className="flex items-center justify-between pt-4 border-t mt-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.max(0, p - 1))}
                      disabled={page === 0}
                    >
                      Previous
                    </Button>
                    <span className="text-sm text-muted-foreground">
                      Page {page + 1} of {Math.ceil(studentResults.total / pageSize)}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => p + 1)}
                      disabled={(page + 1) * pageSize >= studentResults.total}
                    >
                      Next
                    </Button>
                  </div>
                )}
              </div>
            ) : searchQuery.trim() ? (
              <div className="py-8 text-center text-muted-foreground">No students found</div>
            ) : (
              <div className="py-8 text-center text-muted-foreground">
                Loading students...
              </div>
            )}
          </div>
        );

      case 'select-sessions':
        return (
          <div className="flex flex-col h-full">
            {/* Sticky Header */}
            {selectedStudent && (
              <div className="sticky top-0 bg-background z-10 pb-4 border-b mb-4">
                <StudentCard
                  student={selectedStudent}
                  subjects={[]}
                  showSubjects={false}
                  showActions={false}
                />
                <div className="flex items-center justify-between mt-4">
                  <h4 className="font-semibold">Select Sessions to Log Absence</h4>
                  <div className="text-sm text-muted-foreground">
                    {selectedSessionIds.size} selected
                  </div>
                </div>
              </div>
            )}

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto space-y-4">
              <AbsenceSessionSelector
                sessions={allSessions || []}
                selectedSessionIds={selectedSessionIds}
                onToggleSession={handleToggleSession}
                isLoading={loadingSessions && !missingSession}
              />
            </div>
          </div>
        );

      case 'process-sessions':
        return (
          <div className="flex flex-col h-full">
            {/* Sticky Header */}
            {selectedStudent && (
              <div className="sticky top-0 bg-background z-10 pb-4 border-b mb-4">
                <StudentCard
                  student={selectedStudent}
                  subjects={[]}
                  showSubjects={false}
                  showActions={false}
                />
                <div className="text-sm text-muted-foreground mt-2">
                  Select action for {selectedSessionsArray.length} session{selectedSessionsArray.length !== 1 ? 's' : ''}
                </div>
              </div>
            )}

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto">
              <AbsenceBulkActionSelector
                sessions={selectedSessionsArray}
                studentId={selectedStudent!.id}
                onDecisionsChange={handleBulkDecisionsChange}
                onBack={() => {
                  setDecisions([]);
                  setRescheduledSessionsMap(new Map());
                  setStep('select-sessions');
                }}
                onConfirm={() => {
                  // Decisions are already updated via onDecisionsChange
                  // This will trigger handleBulkDecisionsChange which submits
                }}
                canProceed={decisions.every((d) => {
                  if (!d.action) return false;
                  if (d.action === 'reschedule' && !d.targetSessionId) return false;
                  return true;
                })}
                excludeSessionIds={decisions
                  .filter((d) => d.action === 'reschedule' && d.targetSessionId)
                  .map((d) => d.targetSessionId!)} // Exclude already selected reschedule targets
              />
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
      default:
        return '';
    }
  };

  const renderFooter = () => {
    switch (step) {
      case 'select-student':
        return (
          <div className="flex justify-between px-4 py-3 border-t bg-background">
            <div></div>
            <Button
              onClick={() => {
                if (selectedStudent) {
                  setStep('select-sessions');
                }
              }}
              disabled={!selectedStudent}
            >
              Next
              <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        );
      case 'select-sessions':
        return (
          <div className="flex justify-between px-4 py-3 border-t bg-background">
            <Button
              variant="outline"
              onClick={() => {
                setDecisions([]);
                setRescheduledSessionsMap(new Map());
                setCurrentSessionIndex(0);
                setStep('select-student');
              }}
            >
              <ChevronLeft className="h-4 w-4 mr-2" />
              Previous
            </Button>
            <Button
              onClick={handleProceedToProcess}
              disabled={selectedSessionIds.size === 0}
            >
              Next
              <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        );
      case 'process-sessions':
        return (
          <div className="flex justify-between px-4 py-3 border-t bg-background">
            <Button
              variant="outline"
              onClick={() => {
                setDecisions([]);
                setRescheduledSessionsMap(new Map());
                setStep('select-sessions');
              }}
            >
              <ChevronLeft className="h-4 w-4 mr-2" />
              Previous
            </Button>
            <Button
              onClick={handleConfirmAndSubmit}
              disabled={!decisions.every((d) => {
                if (!d.action) return false;
                if (d.action === 'reschedule' && !d.targetSessionId) return false;
                return true;
              }) || decisions.length === 0}
            >
              Confirm All Actions
              <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        );
      case 'success':
        return (
          <div className="flex justify-between px-4 py-3 border-t bg-background">
            <div></div>
            <Button onClick={onClose}>
              Close
            </Button>
          </div>
        );
      case 'error':
        return (
          <div className="flex justify-between px-4 py-3 border-t bg-background">
            <Button variant="outline" onClick={() => setStep('process-sessions')}>
              <ChevronLeft className="h-4 w-4 mr-2" />
              Go Back
            </Button>
            <Button onClick={onClose}>
              Close
            </Button>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-full md:max-w-4xl h-[90vh] flex flex-col p-0 [&>button]:hidden">
        <DialogHeader className="flex-shrink-0 px-6 py-4 border-b">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3 flex-1">
              <Button
                variant="outline"
                size="icon"
                onClick={onClose}
                className="shrink-0"
              >
                <X className="h-4 w-4" />
              </Button>
              <div className="flex-1">
                <DialogTitle>{getStepTitle()}</DialogTitle>
                <DialogDescription>{getStepDescription()}</DialogDescription>
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-hidden min-h-0 px-6 py-4">{renderStepContent()}</div>
        
        {renderFooter()}
      </DialogContent>
    </Dialog>
  );
}

