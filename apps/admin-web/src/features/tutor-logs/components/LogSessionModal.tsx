'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@altitutor/ui';
import { Button } from '@altitutor/ui';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useLogSessionFlow } from '../hooks/useLogSessionFlow';
import { getLogSessionStepTitle } from '../utils/logSessionHelpers';
import { getAttendedStudentIds } from '../utils/logSessionHelpers';
import { StaffCard } from '@/shared/components/StaffCard';
import { SessionsCard } from '@/features/sessions/components/SessionsCard';
import {
  ExpandButton,
  EXPANDABLE_DIALOG_TRANSITION,
  EXPANDED_DIALOG_CONTENT_CLASS,
} from '@/shared/components/expandable-dialog';
import { cn } from '@/shared/utils';

// Import step components
import { Step0StaffSelector } from './steps/Step0StaffSelector';
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
  initialSessionId?: string;
  initialStaffId?: string;
};

export function LogSessionModal({
  isOpen,
  onClose,
  currentStaffId,
  adminMode = false,
  initialSessionId,
  initialStaffId,
}: LogSessionModalProps) {
  const {
    // State
    currentStep,
    selectedStaffId,
    formData,
    submissionState,
    submissionError,
    totalSteps,

    // Data
    selectedStaff,
    selectedSession,
    sessionClassData,
    sessionSubject,
    sessionStaff,
    sessionStudents,

    // Actions
    setSelectedStaffId,
    updateFormData,
    handleNext,
    handlePrevious,
    handleSubmit,
    handleClose,
    handleTryAgain,
    handleAddStaffToSession,
    canGoNext,
  } = useLogSessionFlow({
    isOpen,
    onClose,
    currentStaffId,
    adminMode,
    initialSessionId,
    initialStaffId,
  });

  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!isOpen) setExpanded(false);
  }, [isOpen]);

  const getStepTitle = () => {
    return getLogSessionStepTitle(currentStep, adminMode);
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
        <Step0StaffSelector
          title={getStepTitle()}
          selectedStaffId={selectedStaffId || undefined}
          onSelectStaff={setSelectedStaffId}
        />
      );
    }

    const stepIndex = adminMode ? currentStep - 1 : currentStep;

    switch (stepIndex) {
      case 0:
        return (
          <Step1SessionPicker
            title={getStepTitle()}
            staffId={selectedStaffId}
            selectedSessionId={formData.sessionId}
            onSelectSession={(sessionId) => updateFormData({ sessionId })}
          />
        );
      case 1:
        return (
          <Step2StaffAttendance
            title={getStepTitle()}
            sessionId={formData.sessionId!}
            currentStaffId={selectedStaffId}
            staffAttendance={formData.staffAttendance || []}
            onUpdate={(staffAttendance) => updateFormData({ staffAttendance })}
            onAddStaffToSession={handleAddStaffToSession}
          />
        );
      case 2:
        return (
          <Step3StudentAttendance
            title={getStepTitle()}
            sessionId={formData.sessionId!}
            studentAttendance={formData.studentAttendance || []}
            onUpdate={(studentAttendance) => updateFormData({ studentAttendance })}
          />
        );
      case 3:
        return (
          <Step4Topics
            title={getStepTitle()}
            sessionId={formData.sessionId!}
            topics={formData.topics || []}
            onUpdate={(topics) => updateFormData({ topics })}
          />
        );
      case 4:
        return (
          <Step5TopicStudents
            title={getStepTitle()}
            topics={formData.topics || []}
            attendedStudentIds={getAttendedStudentIds(formData)}
            onUpdate={(topics) => updateFormData({ topics })}
          />
        );
      case 5:
        return (
          <Step6Files
            title={getStepTitle()}
            topics={formData.topics || []}
            topicFiles={formData.topicFiles || []}
            onUpdate={(topicFiles) => updateFormData({ topicFiles })}
          />
        );
      case 6:
        return (
          <Step7FileStudents
            title={getStepTitle()}
            topics={formData.topics || []}
            topicFiles={formData.topicFiles || []}
            onUpdate={(topicFiles) => updateFormData({ topicFiles })}
          />
        );
      case 7:
        return (
          <Step8Notes
            title={getStepTitle()}
            notes={formData.notes || []}
            onUpdate={(notes) => updateFormData({ notes })}
          />
        );
      case 8:
        return (
          <Step9Confirmation
            title={getStepTitle()}
            formData={formData}
          />
        );
      default:
        return null;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && (submissionState === 'success' ? handleClose() : onClose())}>
      <DialogContent
        className={cn(
          'w-full md:max-w-4xl h-[90vh] flex flex-col p-0 [&>button]:hidden',
          EXPANDABLE_DIALOG_TRANSITION,
          expanded && EXPANDED_DIALOG_CONTENT_CLASS
        )}
      >
        {/* Header */}
        <div className="flex-shrink-0 border-b bg-background">
          <DialogHeader className="px-6 pt-6 pb-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3 flex-1">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={submissionState === 'success' ? handleClose : onClose}
                  className="shrink-0"
                >
                  <X className="h-4 w-4" />
                </Button>
                <div className="flex-1 min-w-0">
                  <DialogTitle>Tutor log</DialogTitle>
                  <DialogDescription>
                    Step {currentStep + 1} of {totalSteps}: {getStepTitle()}
                  </DialogDescription>
                </div>
                <ExpandButton expanded={expanded} onToggle={() => setExpanded((e) => !e)} />
                {(selectedStaff || selectedSession) && (
                  <div className="flex items-center gap-3 flex-wrap flex-shrink-0">
                    {selectedStaff && (
                      <div className="flex-shrink-0 h-[60px]">
                        <StaffCard
                          staff={selectedStaff}
                          showSubjects={false}
                          showActions={false}
                        />
                      </div>
                    )}
                    {selectedSession && (
                      <div className="flex-shrink-0 w-fit max-w-md h-[60px]">
                        <SessionsCard
                          session={selectedSession}
                          classData={sessionClassData || undefined}
                          subject={sessionSubject || undefined}
                          staff={sessionStaff}
                          students={sessionStudents}
                          compact={true}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </DialogHeader>

          {/* Progress Indicator */}
          {submissionState !== 'success' && submissionState !== 'error' && (
            <div className="px-6 pb-4">
              <div className="flex items-center gap-2">
                {Array.from({ length: totalSteps }).map((_, index) => (
                  <div
                    key={index}
                    className={`flex-1 h-2 rounded-full transition-colors ${
                      index < currentStep
                        ? 'bg-primary'
                        : index === currentStep
                        ? 'bg-primary/50'
                        : 'bg-muted'
                    }`}
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

        <div className="flex justify-between px-6 py-4 border-t bg-background">
          {submissionState === 'success' ? (
            <>
              <div></div>
              <Button onClick={handleClose}>
                Close
              </Button>
            </>
          ) : submissionState === 'error' ? (
            <>
              <Button
                variant="outline"
                onClick={handleTryAgain}
              >
                Try Again
              </Button>
              <Button onClick={onClose}>
                Close
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={handlePrevious}
                disabled={currentStep === 0}
              >
                <ChevronLeft className="h-4 w-4 mr-2" />
                Previous
              </Button>

              {currentStep < totalSteps - 1 ? (
                <Button onClick={handleNext} disabled={!canGoNext}>
                  Next
                  <ChevronRight className="h-4 w-4 ml-2" />
                </Button>
              ) : (
                <Button
                  onClick={handleSubmit}
                  disabled={submissionState === 'submitting' || !canGoNext}
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


