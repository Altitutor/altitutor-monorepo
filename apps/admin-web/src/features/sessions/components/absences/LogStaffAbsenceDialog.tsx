'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  Button,
} from '@altitutor/ui';
import { useStaffFutureSessions, useLogStaffAbsences } from '../../hooks';
import { StaffAbsenceSessionSelector } from './StaffAbsenceSessionSelector';
import { StaffAbsenceBulkActionSelector } from './StaffAbsenceBulkActionSelector';
import { StaffCard } from '@/shared/components/StaffCard';
import type {
  StaffAbsenceDecision,
  StaffAbsenceOperation,
  StaffAbsenceAction,
  StaffSession,
  ReplacementStaff,
} from '../../types/staff-absence';
import { Search, Loader2, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { Input } from '@altitutor/ui';
import { useStaffSearchForAbsence } from '@/features/staff/hooks';
import { staffApi } from '@/features/staff/api/staff';
import type { Tables } from '@altitutor/shared';

type WizardStep = 'select-staff' | 'select-sessions' | 'process-sessions' | 'confirm' | 'success' | 'error';

interface LogStaffAbsenceDialogProps {
  isOpen: boolean;
  onClose: () => void;
  staffId: string;
  initialStaffId?: string | null;
  initialSessionId?: string | null;
  allowPastSessions?: boolean;
}

export function LogStaffAbsenceDialog({ isOpen, onClose, staffId, initialStaffId, initialSessionId, allowPastSessions = false }: LogStaffAbsenceDialogProps) {
  const [step, setStep] = useState<WizardStep>('select-staff');
  const [selectedStaff, setSelectedStaff] = useState<Tables<'staff'> | null>(null);
  const [selectedSessionIds, setSelectedSessionIds] = useState<Set<string>>(new Set());
  const [decisions, setDecisions] = useState<StaffAbsenceDecision[]>([]);
  const [replacementStaffMap, setReplacementStaffMap] = useState<
    Map<string, ReplacementStaff>
  >(new Map());
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [hasInitialized, setHasInitialized] = useState(false);
  
  // Staff search and pagination
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(0);
  const pageSize = 20;
  
  const { data: staffResults, isLoading: loadingStaff } = useStaffSearchForAbsence({
    search: searchQuery,
    page,
    pageSize,
  });

  // Reset page when search query changes
  useEffect(() => {
    setPage(0);
  }, [searchQuery]);

  // Get staff's sessions (8 weeks ahead by default, optionally include past sessions)
  const { data: futureSessions, isLoading: loadingSessions } = useStaffFutureSessions(
    selectedStaff?.id || initialStaffId || null,
    8,
    allowPastSessions,
    4 // weeks back when allowing past sessions
  );

  // Log absences mutation
  const logStaffAbsencesMutation = useLogStaffAbsences();

  // Initialize with pre-filled values
  useEffect(() => {
    if (isOpen && initialStaffId && !selectedStaff && !hasInitialized) {
      // Fetch the initial staff
      const fetchInitialStaff = async () => {
        const staff = await staffApi.getById(initialStaffId);
        
        if (staff) {
          setSelectedStaff(staff);
          // If initialSessionId is also provided, select it
          if (initialSessionId) {
            setSelectedSessionIds(new Set([initialSessionId]));
          }
          setHasInitialized(true);
        }
      };
      fetchInitialStaff();
    }
  }, [isOpen, initialStaffId, initialSessionId, selectedStaff, hasInitialized]);

  // Auto-advance to select-sessions when staff is loaded and we have initial values
  useEffect(() => {
    if (isOpen && selectedStaff && initialStaffId && hasInitialized && step === 'select-staff') {
      setStep('select-sessions');
    }
  }, [isOpen, selectedStaff, initialStaffId, hasInitialized, step]);

  // Auto-advance to process-sessions when session is selected and both initial values are provided
  // Track selectedSessionIds size and whether it contains initialSessionId for stable comparison
  const selectedSessionIdsSize = selectedSessionIds.size;
  const hasInitialSessionSelected = initialSessionId ? selectedSessionIds.has(initialSessionId) : false;

  useEffect(() => {
    if (isOpen && selectedStaff && initialSessionId && hasInitialSessionSelected && step === 'select-sessions' && hasInitialized) {
      // Auto-advance to process step since we have everything pre-filled
      setStep('process-sessions');
    }
  }, [isOpen, selectedStaff, initialSessionId, hasInitialSessionSelected, selectedSessionIdsSize, step, hasInitialized]);

  // Reset state when dialog closes
  useEffect(() => {
    if (!isOpen) {
      setStep('select-staff');
      setSelectedStaff(null);
      setSelectedSessionIds(new Set());
      setDecisions([]);
      setReplacementStaffMap(new Map());
      setSearchQuery('');
      setPage(0);
      setErrorMessage('');
      setHasInitialized(false);
    }
  }, [isOpen]);

  const selectedSessionsArray = useMemo(() => {
    if (!futureSessions) return [];
    return futureSessions.filter((s) => selectedSessionIds.has(s.id));
  }, [futureSessions, selectedSessionIds]);

  const handleStaffSelect = (staff: Tables<'staff'>) => {
    setSelectedStaff(staff);
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

  const handleBulkDecisionsChange = useCallback((bulkDecisions: Array<{ sessionId: string; action: StaffAbsenceAction; replacementStaffId?: string; replacementStaff?: ReplacementStaff }>) => {
    if (!selectedStaff) return;

    // Convert bulk decisions to StaffAbsenceDecision format
    const newDecisions: StaffAbsenceDecision[] = bulkDecisions.map((bulkDecision) => {
      const session = selectedSessionsArray.find((s) => s.id === bulkDecision.sessionId);
      if (!session) {
        throw new Error(`Session ${bulkDecision.sessionId} not found`);
      }

      // Store replacement staff in map for later display
      if (bulkDecision.action === 'swap' && bulkDecision.replacementStaff && bulkDecision.replacementStaffId) {
        setReplacementStaffMap((prev) => new Map(prev).set(bulkDecision.replacementStaffId!, bulkDecision.replacementStaff!));
      }

      return {
        sessionId: session.id,
        sessionsStaffId: session.sessionsStaffId,
        action: bulkDecision.action,
        replacementStaffId: bulkDecision.replacementStaffId,
      };
    });

    setDecisions(newDecisions);
  }, [selectedStaff, selectedSessionsArray]);

  const handleConfirmAndSubmit = () => {
    if (!selectedStaff) return;
    
    // Check if all decisions are complete
    const allComplete = decisions.every((d) => {
      if (!d.action) return false;
      if (d.action === 'swap' && !d.replacementStaffId) return false;
      return true;
    });

    if (!allComplete || decisions.length === 0) return;

    // Submit the decisions
    handleFinalConfirm(decisions);
  };

  const handleFinalConfirm = async (decisionsToSubmit: StaffAbsenceDecision[]) => {
    if (!selectedStaff) return;

    setStep('confirm');

    // Convert decisions to operations
    // Only include replacement_staff_id for 'swap' actions
    const operations: StaffAbsenceOperation[] = decisionsToSubmit.map((decision) => {
      const base = {
        staff_id: selectedStaff.id,
        original_sessions_staff_id: decision.sessionsStaffId,
        action: decision.action!,
      };
      
      if (decision.action === 'swap' && decision.replacementStaffId) {
        return {
          ...base,
          replacement_staff_id: decision.replacementStaffId,
        };
      }
      
      return base;
    });

    try {
      // Submit to API
      const result = await logStaffAbsencesMutation.mutateAsync({
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
      case 'select-staff':
        return (
          <div className="flex flex-col h-full">
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search staff by name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            {loadingStaff ? (
              <div className="py-8 text-center text-muted-foreground">Loading staff...</div>
            ) : staffResults && staffResults.staff && staffResults.staff.length > 0 ? (
              <div className="flex-1 overflow-y-auto space-y-2 min-h-0">
                {staffResults.staff.map((staffMember) => (
                  <div
                    key={staffMember.id}
                    onClick={() => handleStaffSelect(staffMember)}
                    className="cursor-pointer"
                  >
                    <StaffCard
                      staff={staffMember}
                      isSelecting={true}
                      isSelected={selectedStaff?.id === staffMember.id}
                      showActions={false}
                    />
                  </div>
                ))}
                {/* Pagination controls */}
                {staffResults && staffResults.total > pageSize && (
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
                      Page {page + 1} of {Math.ceil(staffResults.total / pageSize)}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => p + 1)}
                      disabled={(page + 1) * pageSize >= staffResults.total}
                    >
                      Next
                    </Button>
                  </div>
                )}
              </div>
            ) : searchQuery.trim() ? (
              <div className="py-8 text-center text-muted-foreground">No staff found</div>
            ) : (
              <div className="py-8 text-center text-muted-foreground">
                Start typing to search for staff
              </div>
            )}
          </div>
        );

      case 'select-sessions':
        return (
          <div className="flex flex-col h-full">
            {/* Sticky Header */}
            {selectedStaff && (
              <div className="sticky top-0 bg-background z-10 pb-4 border-b mb-4">
                <StaffCard
                  staff={selectedStaff}
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
              <StaffAbsenceSessionSelector
                sessions={futureSessions || []}
                selectedSessionIds={selectedSessionIds}
                onToggleSession={handleToggleSession}
                isLoading={loadingSessions}
              />
            </div>
          </div>
        );

      case 'process-sessions':
        return (
          <div className="flex flex-col h-full">
            {/* Sticky Header */}
            {selectedStaff && (
              <div className="sticky top-0 bg-background z-10 pb-4 border-b mb-4">
                <StaffCard
                  staff={selectedStaff}
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
              <StaffAbsenceBulkActionSelector
                sessions={selectedSessionsArray}
                staffId={selectedStaff!.id}
                onDecisionsChange={handleBulkDecisionsChange}
              />
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
      case 'select-staff':
        return 'Select Staff';
      case 'select-sessions':
        return 'Select Sessions';
      case 'process-sessions':
        return 'Process Absences';
      case 'confirm':
        return 'Confirming...';
      default:
        return 'Log Staff Absence';
    }
  };

  const getStepDescription = () => {
    switch (step) {
      case 'select-staff':
        return 'Search and select the staff member to log absences for';
      case 'select-sessions':
        return 'Select which future sessions the staff member will be absent from';
      case 'process-sessions':
        return 'Choose whether to swap staff or log absence for each session';
      case 'confirm':
        return 'Submitting your changes...';
      default:
        return '';
    }
  };

  const renderFooter = () => {
    switch (step) {
      case 'select-staff':
        return (
          <div className="flex justify-between px-4 py-3 border-t bg-background">
            <div></div>
            <Button
              onClick={() => {
                if (selectedStaff) {
                  setStep('select-sessions');
                }
              }}
              disabled={!selectedStaff}
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
                setReplacementStaffMap(new Map());
                setStep('select-staff');
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
                setReplacementStaffMap(new Map());
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
                if (d.action === 'swap' && !d.replacementStaffId) return false;
                return true;
              }) || decisions.length === 0}
            >
              Confirm All Actions
              <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        );
      case 'confirm':
        return null;
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

