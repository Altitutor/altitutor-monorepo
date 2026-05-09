'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { Tables } from '@altitutor/shared';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@altitutor/ui';
import { Button, SearchableSelect } from '@altitutor/ui';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import {
  ExpandButton,
  EXPANDABLE_DIALOG_TRANSITION,
  EXPANDED_DIALOG_CONTENT_CLASS,
} from '@/shared/components/expandable-dialog';
import { cn } from '@/shared/utils';
import {
  tutorBtnIconOutline,
  tutorBtnOutline,
  tutorBtnPrimary,
  tutorDialogContentClass,
  tutorDialogFooterStrip,
  tutorDialogHeaderStrip,
} from '@/shared/lib/tutor-visual';
import type { TutorLogFormData } from '../types';
import { useCreateTutorLog } from '../hooks';
import { sessionsApi } from '@/features/sessions/api/sessions';
import { staffApi } from '@/features/staff/api/staff';
import { StaffCard } from '@/shared/components/StaffCard';

// Import step components
import { Step1SessionPicker } from './steps/Step1SessionPicker';
import { Step2StaffAttendance } from './steps/Step2StaffAttendance';
import { Step3StudentAttendance } from './steps/Step3StudentAttendance';
import { Step4Topics } from './steps/Step4Topics';
import { Step5TopicStudents } from './steps/Step5TopicStudents';
import { Step6Files } from './steps/Step6Files';
import { Step7FileStudents } from './steps/Step7FileStudents';
import { Step8Notes } from './steps/Step8Notes';
import { Step9Confirmation } from './steps/Step9Confirmation';

type LogSessionModalProps = {
  isOpen: boolean;
  onClose: () => void;
  currentStaffId: string;
  adminMode?: boolean;
  preselectedSessionId?: string; // If provided, skip Step 1 (session selection)
};

export function LogSessionModal({ 
  isOpen, 
  onClose, 
  currentStaffId, 
  adminMode = false,
  preselectedSessionId 
}: LogSessionModalProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedStaffId, setSelectedStaffId] = useState<string>(currentStaffId);
  const [formData, setFormData] = useState<Partial<TutorLogFormData>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionState, setSubmissionState] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [adminSelectedStaff, setAdminSelectedStaff] = useState<Tables<'staff'> | null>(null);
  const [adminStaffResults, setAdminStaffResults] = useState<Tables<'staff'>[]>([]);
  const [adminStaffSearchLoading, setAdminStaffSearchLoading] = useState(false);
  const wasOpenRef = useRef(false);

  const createMutation = useCreateTutorLog();

  const handleAdminStaffSearch = useCallback(async (search: string) => {
    if (!search.trim()) {
      setAdminStaffResults([]);
      return;
    }
    setAdminStaffSearchLoading(true);
    try {
      const { staff } = await staffApi.search({ search, limit: 25 });
      setAdminStaffResults(staff);
    } catch (error) {
      console.error('Error searching staff:', error);
      setAdminStaffResults([]);
    } finally {
      setAdminStaffSearchLoading(false);
    }
  }, []);

  // Set preselected session when modal opens
  useEffect(() => {
    if (isOpen && preselectedSessionId) {
      setFormData({ sessionId: preselectedSessionId });
      // Skip Step 0 (session selection) if session is preselected - start at Step 1
      setCurrentStep(0); // Will be treated as Step 1 (Staff Attendance) in renderStep
    }
  }, [isOpen, preselectedSessionId]);

  // Reset expanded when modal closes
  useEffect(() => {
    if (!isOpen) setExpanded(false)
  }, [isOpen])

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setCurrentStep(0);
      setSelectedStaffId(currentStaffId);
      setFormData({});
      setIsSubmitting(false);
      setSubmissionState('idle');
      setSubmissionError(null);
      setAdminSelectedStaff(null);
      setAdminStaffResults([]);
    }
  }, [isOpen, currentStaffId]);

  // When opening in admin mode, require a fresh staff selection for this log
  useEffect(() => {
    if (isOpen && !wasOpenRef.current && adminMode) {
      setSelectedStaffId('');
      setAdminSelectedStaff(null);
      setAdminStaffResults([]);
    }
    wasOpenRef.current = isOpen;
  }, [isOpen, adminMode]);

  // Calculate total steps: if session is preselected, skip Step 1 (session selection)
  const skipSessionStep = !!preselectedSessionId;
  const totalSteps = adminMode ? 10 : (skipSessionStep ? 8 : 9); // Extra step for staff selection in admin mode

  const handleNext = () => {
    if (currentStep < totalSteps - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = async () => {
    if (!formData.sessionId) return;

    setSubmissionState('submitting');
    setSubmissionError(null);
    setIsSubmitting(true);
    try {
      await createMutation.mutateAsync({
        data: formData as TutorLogFormData,
      });
      setSubmissionState('success');
    } catch (error) {
      console.error('Failed to create tutor log:', error);
      setSubmissionState('error');
      setSubmissionError(error instanceof Error ? error.message : 'Failed to submit log. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (submissionState === 'success') {
      onClose();
    }
  };

  const updateFormData = (updates: Partial<TutorLogFormData>) => {
    setFormData((prev) => ({ ...prev, ...updates }));
  };

  const getStepTitle = () => {
    if (adminMode && currentStep === 0) return 'Select Staff Member';
    const stepIndex = adminMode ? currentStep - 1 : currentStep;
    
    // If session is preselected, skip Step 0 (Select Session)
    // So stepIndex 0 becomes Staff Attendance (index 1 in titles array)
    const adjustedStepIndex = skipSessionStep ? stepIndex + 1 : stepIndex;
    
    const titles = [
      'Select Session',
      'Staff Attendance',
      'Student Attendance',
      'Topics',
      'Topic Students',
      'Files',
      'File Students',
      'Notes',
      'Confirmation',
    ];
    return titles[adjustedStepIndex] || 'Log Session';
  };

  const renderStep = () => {
    // Success state
    if (submissionState === 'success') {
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
          <div className="text-lg font-semibold">Tutor Log Submitted Successfully!</div>
          <div className="text-sm text-muted-foreground">
            The session has been logged and saved.
          </div>
        </div>
      );
    }

    // Error state
    if (submissionState === 'error') {
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
          <div className="text-lg font-semibold">Failed to Submit Tutor Log</div>
          <div className="text-sm text-muted-foreground">
            {submissionError || 'An error occurred while submitting the log.'}
          </div>
        </div>
      );
    }

    if (adminMode && currentStep === 0) {
      return (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Select which staff member you&apos;re logging this session for.
          </p>
          <SearchableSelect<Tables<'staff'>>
            items={adminStaffResults}
            value={adminSelectedStaff}
            onValueChange={(staff) => {
              setAdminSelectedStaff(staff);
              setSelectedStaffId(staff?.id ?? '');
            }}
            allowClear
            clearLabel="Clear selection"
            getItemId={(s) => s.id}
            getItemLabel={(s) =>
              `${s.first_name ?? ''} ${s.last_name ?? ''}`.trim() || 'Staff'
            }
            getItemValue={(s) =>
              `${s.first_name ?? ''} ${s.last_name ?? ''} ${s.email ?? ''}`.toLowerCase()
            }
            onSearchChange={handleAdminStaffSearch}
            loading={adminStaffSearchLoading}
            searchPlaceholder="Search staff by name..."
            emptyMessage="Type to search for a staff member"
            placeholder="Choose staff member..."
            align="start"
            contentWidth="min(400px, 92vw)"
            renderItem={(staffMember) => (
              <div className="w-full">
                <StaffCard staff={staffMember} showSubjects={false} />
              </div>
            )}
          />
        </div>
      );
    }

    const stepIndex = adminMode ? currentStep - 1 : currentStep;
    
    // If session is preselected, skip Step 0 (session selection)
    // Map stepIndex 0 -> Staff Attendance (case 1), stepIndex 1 -> Student Attendance (case 2), etc.
    const actualStepIndex = skipSessionStep ? stepIndex + 1 : stepIndex;

    switch (actualStepIndex) {
      case 0:
        // Only show session picker if session is not preselected
        return (
          <Step1SessionPicker
            staffId={selectedStaffId}
            selectedSessionId={formData.sessionId}
            onSelectSession={(sessionId) => updateFormData({ sessionId })}
          />
        );
      case 1:
        return (
          <Step2StaffAttendance
            sessionId={formData.sessionId!}
            currentStaffId={selectedStaffId}
            staffAttendance={formData.staffAttendance || []}
            onUpdate={(staffAttendance) => updateFormData({ staffAttendance })}
            onAddStaffToSession={async (staffId: string) => {
              await sessionsApi.assignStaffToSession(formData.sessionId!, staffId);
            }}
          />
        );
      case 2:
        return (
          <Step3StudentAttendance
            sessionId={formData.sessionId!}
            studentAttendance={formData.studentAttendance || []}
            onUpdate={(studentAttendance) => updateFormData({ studentAttendance })}
          />
        );
      case 3:
        return (
          <Step4Topics
            sessionId={formData.sessionId!}
            topics={formData.topics || []}
            onUpdate={(topics) => updateFormData({ topics })}
          />
        );
      case 4:
        return (
          <Step5TopicStudents
            topics={formData.topics || []}
            attendedStudentIds={(formData.studentAttendance || [])
              .filter((sa) => sa.attended)
              .map((sa) => sa.studentId)}
            onUpdate={(topics) => updateFormData({ topics })}
          />
        );
      case 5:
        return (
          <Step6Files
            topics={formData.topics || []}
            topicFiles={formData.topicFiles || []}
            onUpdate={(topicFiles) => updateFormData({ topicFiles })}
          />
        );
      case 6:
        return (
          <Step7FileStudents
            topics={formData.topics || []}
            topicFiles={formData.topicFiles || []}
            onUpdate={(topicFiles) => updateFormData({ topicFiles })}
          />
        );
      case 7:
        return (
          <Step8Notes
            notes={formData.notes || []}
            onUpdate={(notes) => updateFormData({ notes })}
          />
        );
      case 8:
        return (
          <Step9Confirmation
            formData={formData}
            onSubmit={handleSubmit}
            isSubmitting={isSubmitting}
          />
        );
      default:
        return null;
    }
  };

  const canGoNext = () => {
    if (adminMode && currentStep === 0) return !!adminSelectedStaff?.id;
    const stepIndex = adminMode ? currentStep - 1 : currentStep;
    
    // If session is preselected, skip Step 0 (session selection)
    const actualStepIndex = skipSessionStep ? stepIndex + 1 : stepIndex;

    switch (actualStepIndex) {
      case 0:
        // Session selection step - only check if not preselected
        return skipSessionStep || !!formData.sessionId;
      case 1:
        return (formData.staffAttendance || []).length > 0;
      case 2:
        return (formData.studentAttendance || []).length > 0;
      case 3:
        return (formData.topics || []).length > 0;
      case 4:
        return true; // Can proceed even with no student assignments
      case 5:
        return true; // Allow proceeding with no files selected
      case 6:
        return true;
      case 7:
        return true; // Notes step
      case 8:
        return true; // Confirmation step - always allow submission
      default:
        return false;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={submissionState === 'success' ? handleClose : onClose}>
      <DialogContent
        className={cn(
          'flex h-[90vh] w-full flex-col gap-0 p-0 md:max-w-4xl [&>button]:hidden',
          tutorDialogContentClass,
          EXPANDABLE_DIALOG_TRANSITION,
          expanded && EXPANDED_DIALOG_CONTENT_CLASS,
        )}
      >
        {/* Header */}
        <div className={cn('flex-shrink-0', tutorDialogHeaderStrip)}>
          <DialogHeader className="px-6 pb-4 pt-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3 flex-1">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={submissionState === 'success' ? handleClose : onClose}
                  className={tutorBtnIconOutline}
                >
                  <X className="h-4 w-4" />
                </Button>
                <div className="flex-1 min-w-0">
                  <DialogTitle>Tutor log</DialogTitle>
                  <DialogDescription>
                    Step {currentStep + 1} of {totalSteps}: {getStepTitle()}
                  </DialogDescription>
                </div>
              </div>
              <ExpandButton expanded={expanded} onToggle={() => setExpanded((e) => !e)} />
            </div>
          </DialogHeader>

          {/* Progress Indicator */}
          {submissionState !== 'success' && submissionState !== 'error' && (
            <div className="px-6 pb-4">
              <div className="flex items-center gap-2">
                {Array.from({ length: totalSteps }).map((_, index) => (
                  <div
                    key={index}
                    className={cn(
                      'h-2 flex-1 rounded-full transition-colors duration-300',
                      index < currentStep && 'bg-primary',
                      index === currentStep && 'bg-primary/50',
                      index > currentStep && 'bg-muted',
                    )}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden min-h-0">
          <div className="h-full overflow-y-auto">
            <div className="p-6">
              {renderStep()}
            </div>
          </div>
        </div>

        <div className={cn('flex justify-between px-6 py-4', tutorDialogFooterStrip)}>
          {submissionState === 'success' ? (
            <>
              <div></div>
              <Button className={tutorBtnPrimary} onClick={handleClose}>
                Close
              </Button>
            </>
          ) : submissionState === 'error' ? (
            <>
              <Button variant="outline" className={tutorBtnOutline} onClick={() => setSubmissionState('idle')}>
                Try Again
              </Button>
              <Button className={tutorBtnPrimary} onClick={onClose}>
                Close
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                className={tutorBtnOutline}
                onClick={handlePrevious}
                disabled={currentStep === 0}
              >
                <ChevronLeft className="mr-2 h-4 w-4" />
                Previous
              </Button>

              {currentStep < totalSteps - 1 ? (
                <Button className={tutorBtnPrimary} onClick={handleNext} disabled={!canGoNext()}>
                  Next
                  <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              ) : (
                <Button
                  className={tutorBtnPrimary}
                  onClick={handleSubmit}
                  disabled={submissionState === 'submitting' || !canGoNext()}
                >
                  {submissionState === 'submitting' ? 'Submitting...' : 'Submit Log'}
                </Button>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}


