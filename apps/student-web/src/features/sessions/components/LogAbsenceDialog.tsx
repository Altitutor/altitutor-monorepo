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
import { useStudentFutureSessions, useLogAbsences } from '../hooks/useAbsences';
import { AbsenceSessionSelector } from './AbsenceSessionSelector';
import { RescheduleSessionSelector } from './RescheduleSessionSelector';
import { ConfirmationView } from './ConfirmationView';
import type {
  AbsenceOperation,
  StudentSession,
  RescheduleSession,
} from '../types/absence';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { getSupabaseClient } from '@/shared/lib/supabase/client';

type WizardStep = 'select-session' | 'reschedule' | 'confirmation' | 'success' | 'error';

interface LogAbsenceDialogProps {
  isOpen: boolean;
  onClose: () => void;
  initialSession?: StudentSession | null; // Optional session to skip to step 2
}

export function LogAbsenceDialog({ isOpen, onClose, initialSession }: LogAbsenceDialogProps) {
  const [step, setStep] = useState<WizardStep>('select-session');
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [selectedTargetSessionId, setSelectedTargetSessionId] = useState<string | null>(null);
  const [targetSession, setTargetSession] = useState<RescheduleSession | null>(null);
  const [studentId, setStudentId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [hasInitialized, setHasInitialized] = useState(false);

  // Get current student ID
  useEffect(() => {
    const loadStudentId = async () => {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase.rpc('current_student_id');
      if (!error && data) {
        setStudentId(data);
      }
    };
    loadStudentId();
  }, []);

  // Get student's future sessions
  const { data: futureSessions, isLoading: loadingSessions } = useStudentFutureSessions(8);

  // Log absences mutation
  const logAbsencesMutation = useLogAbsences();

  // Initialize step only when dialog first opens
  useEffect(() => {
    if (isOpen && !hasInitialized) {
      // Set initial step based on whether initialSession is provided
      if (initialSession) {
        setStep('reschedule');
        setSelectedSessionId(initialSession.id);
      } else {
        setStep('select-session');
      }
      setHasInitialized(true);
    } else if (!isOpen) {
      // Reset when dialog closes
      setHasInitialized(false);
      setStep(initialSession ? 'reschedule' : 'select-session');
      setSelectedSessionId(initialSession?.id || null);
      setSelectedTargetSessionId(null);
      setTargetSession(null);
      setErrorMessage('');
    }
  }, [isOpen, initialSession, hasInitialized]);

  // Store the initial session data to use as fallback after reschedule
  const [storedSessionData, setStoredSessionData] = useState<StudentSession | null>(null);

  // Update stored session data when initialSession changes
  useEffect(() => {
    if (initialSession) {
      setStoredSessionData(initialSession);
    }
  }, [initialSession]);

  const selectedSession = useMemo(() => {
    if (!futureSessions) {
      // If futureSessions hasn't loaded yet, use stored data or initialSession
      return storedSessionData || initialSession || null;
    }
    const found = futureSessions.find((s) => s.id === selectedSessionId);
    if (found) return found;
    // Fallback to stored data if session is no longer in futureSessions (e.g., after reschedule)
    if (selectedSessionId && storedSessionData?.id === selectedSessionId) {
      return storedSessionData;
    }
    return initialSession || null;
  }, [futureSessions, selectedSessionId, storedSessionData, initialSession]);

  const handleSelectSession = (sessionId: string) => {
    setSelectedSessionId(sessionId);
  };

  const handleSelectTargetSession = (sessionId: string, session: RescheduleSession) => {
    setSelectedTargetSessionId(sessionId);
    setTargetSession(session);
  };

  const handleClearTargetSession = () => {
    setSelectedTargetSessionId(null);
    setTargetSession(null);
  };

  const handleProceedToReschedule = () => {
    if (!selectedSessionId) {
      alert('Please select a session');
      return;
    }
    setStep('reschedule');
  };

  const handleProceedToConfirmation = () => {
    if (!selectedSessionId || !selectedTargetSessionId) {
      alert('Please select a target session');
      return;
    }
    // Find target session from future sessions or reschedule sessions
    // For now, we'll get it from the reschedule sessions query
    setStep('confirmation');
  };

  const handleConfirmAndSubmit = async () => {
    if (!selectedSessionId || !selectedTargetSessionId || !studentId || !selectedSession) {
      return;
    }

    if (!selectedSession.sessionsStudentsId) {
      setErrorMessage('Missing session enrollment ID. Please refresh and try again.');
      setStep('error');
      return;
    }

    // Create operation
    const operation: AbsenceOperation = {
      student_id: studentId,
      original_sessions_students_id: selectedSession.sessionsStudentsId,
      action: 'reschedule',
      target_session_id: selectedTargetSessionId,
    };

    try {
      // Submit to API
      const result = await logAbsencesMutation.mutateAsync({
        operations: [operation],
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
      case 'select-session':
        return (
          <div className="flex flex-col h-full">
            <div className="mb-4">
              <h4 className="font-semibold">Select Session to Reschedule</h4>
              <p className="text-sm text-muted-foreground mt-1">
                Select the session you will be absent from
              </p>
            </div>
            <div className="flex-1 overflow-y-auto">
              <AbsenceSessionSelector
                sessions={futureSessions || []}
                selectedSessionId={selectedSessionId}
                onSelectSession={handleSelectSession}
                isLoading={loadingSessions}
              />
            </div>
          </div>
        );

      case 'reschedule':
        // Show loading state while sessions are being fetched
        if (loadingSessions && !selectedSession) {
          return (
            <div className="py-8 text-center text-muted-foreground">
              Loading sessions...
            </div>
          );
        }
        // If we don't have a session after loading, show error
        // selectedSession should have fallback to storedSessionData or initialSession
        if (!selectedSession) {
          return (
            <div className="py-8 text-center text-muted-foreground">
              Session not found. Please go back and select a session.
            </div>
          );
        }
        return (
          <div className="flex flex-col h-full">
            <div className="mb-4">
              <h4 className="font-semibold">Reschedule Session</h4>
              <p className="text-sm text-muted-foreground mt-1">
                Select a new session to reschedule to
              </p>
            </div>
            <div className="flex-1 overflow-y-auto">
              <RescheduleSessionSelector
                originalSession={selectedSession}
                selectedTargetSessionId={selectedTargetSessionId}
                onSelectTargetSession={(sessionId, session) => {
                  handleSelectTargetSession(sessionId, session);
                }}
                onClearTargetSession={handleClearTargetSession}
              />
            </div>
          </div>
        );

      case 'confirmation':
        if (!selectedSession || !selectedTargetSessionId || !targetSession) {
          return (
            <div className="py-8 text-center text-muted-foreground">
              Missing session information. Please go back.
            </div>
          );
        }
        return (
          <div className="flex flex-col h-full">
            <div className="mb-4">
              <h4 className="font-semibold">Confirm Absence</h4>
              <p className="text-sm text-muted-foreground mt-1">
                Review your changes before confirming
              </p>
            </div>
            <div className="flex-1 overflow-y-auto">
              <ConfirmationView
                originalSession={selectedSession}
                targetSession={targetSession}
                allSessions={futureSessions || []}
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
            <div className="text-lg font-semibold">Absence Logged Successfully!</div>
            <div className="text-sm text-muted-foreground">
              Your session has been rescheduled
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
            <div className="text-lg font-semibold">Error Logging Absence</div>
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
      case 'select-session':
        return 'Select Session';
      case 'reschedule':
        return 'Reschedule Session';
      case 'confirmation':
        return 'Confirm Absence';
      default:
        return 'Log Absence';
    }
  };

  const getStepDescription = () => {
    switch (step) {
      case 'select-session':
        return 'Select the session you will be absent from';
      case 'reschedule':
        return 'Choose a new session to reschedule to';
      case 'confirmation':
        return 'Review your changes before confirming';
      default:
        return '';
    }
  };

  const renderFooter = () => {
    switch (step) {
      case 'select-session':
        return (
          <div className="flex justify-between px-4 py-3 border-t bg-background">
            <div></div>
            <Button
              onClick={handleProceedToReschedule}
              disabled={!selectedSessionId}
            >
              Next
              <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        );
      case 'reschedule':
        return (
          <div className="flex justify-between px-4 py-3 border-t bg-background">
            <Button
              variant="outline"
              onClick={() => {
                if (initialSession) {
                  onClose();
                } else {
                  setStep('select-session');
                }
              }}
            >
              <ChevronLeft className="h-4 w-4 mr-2" />
              Previous
            </Button>
            <Button
              onClick={handleProceedToConfirmation}
              disabled={!selectedTargetSessionId || logAbsencesMutation.isPending}
            >
              {logAbsencesMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  Next
                  <ChevronRight className="h-4 w-4 ml-2" />
                </>
              )}
            </Button>
          </div>
        );
      case 'confirmation':
        return (
          <div className="flex justify-between px-4 py-3 border-t bg-background">
            <Button
              variant="outline"
              onClick={() => setStep('reschedule')}
            >
              <ChevronLeft className="h-4 w-4 mr-2" />
              Previous
            </Button>
            <Button
              onClick={handleConfirmAndSubmit}
              disabled={logAbsencesMutation.isPending}
            >
              {logAbsencesMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                'Confirm Absence'
              )}
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
            <Button variant="outline" onClick={() => setStep('confirmation')}>
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
      <DialogContent className="w-full md:max-w-4xl h-[90vh] flex flex-col p-0">
        <DialogHeader className="flex-shrink-0 px-6 py-4 border-b">
          <DialogTitle>{getStepTitle()}</DialogTitle>
          <DialogDescription>{getStepDescription()}</DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden min-h-0 px-6 py-4">{renderStepContent()}</div>
        
        {renderFooter()}
      </DialogContent>
    </Dialog>
  );
}
