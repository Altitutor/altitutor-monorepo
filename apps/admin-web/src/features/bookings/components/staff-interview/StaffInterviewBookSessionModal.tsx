'use client';

import { Button } from '@altitutor/ui';
import { Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import { useStaffInterviewBookingFlow } from '../../hooks/useStaffInterviewBookingFlow';
import { StaffIntervieweeStep } from './StaffIntervieweeStep';
import { StaffInterviewTimeStep } from './StaffInterviewTimeStep';
import { StaffInterviewInterviewerStep } from './StaffInterviewInterviewerStep';
import { StaffInterviewConfirmStep } from './StaffInterviewConfirmStep';
import { StaffInterviewMessageStep } from './StaffInterviewMessageStep';
import { useDialogHotkeys } from '@/shared/hooks';
import { AdminDialogShell } from '@/shared/components/dialog-shell';

export interface StaffInterviewBookSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBookingCreated?: (sessionId: string) => void;
}

export function StaffInterviewBookSessionModal({
  isOpen,
  onClose,
  onBookingCreated,
}: StaffInterviewBookSessionModalProps) {
  const {
    currentStep,
    steps,
    currentStepData,
    currentStepId,
    staffSearch,
    setStaffSearch,
    selectedIntervieweeId,
    setSelectedIntervieweeId,
    isCreatingStaff,
    setIsCreatingStaff,
    startAt,
    endAt,
    handleStartAtChange,
    handleEndAtChange,
    interviewerSearch,
    setInterviewerSearch,
    selectedInterviewerId,
    setSelectedInterviewerId,
    isSubmitting,
    canGoNext,
    handleNext,
    handleBack,
    handleConfirmBooking,
    handleClose,
    handleIntervieweeCreated,
    createdSessionId,
    handleDoneMessageStep,
  } = useStaffInterviewBookingFlow({
    isOpen,
    onBookingCreated,
    onClose,
  });

  const isMessageStep = !!createdSessionId;
  const hasNextStep = !isMessageStep && currentStep < steps.length - 1;
  const isFinalStep = !isMessageStep && currentStep === steps.length - 1;

  useDialogHotkeys({
    isOpen,
    onNextStep: handleNext,
    hasNextStep,
    onPrimaryAction: isFinalStep ? handleConfirmBooking : undefined,
    isActionDisabled: isSubmitting,
  });

  const renderStepContent = () => {
    if (createdSessionId) {
      return (
        <StaffInterviewMessageStep sessionId={createdSessionId} />
      );
    }
    switch (currentStepId) {
      case 'interviewee':
        return (
          <StaffIntervieweeStep
            staffSearch={staffSearch}
            onStaffSearchChange={setStaffSearch}
            selectedIntervieweeId={selectedIntervieweeId}
            onSelectInterviewee={setSelectedIntervieweeId}
            isCreatingStaff={isCreatingStaff}
            onToggleCreateStaff={() => setIsCreatingStaff((v) => !v)}
            onIntervieweeCreated={handleIntervieweeCreated}
          />
        );
      case 'time':
        return (
          <StaffInterviewTimeStep
            startAt={startAt}
            endAt={endAt}
            onStartAtChange={handleStartAtChange}
            onEndAtChange={handleEndAtChange}
          />
        );
      case 'interviewer':
        return (
          <StaffInterviewInterviewerStep
            interviewerSearch={interviewerSearch}
            onInterviewerSearchChange={setInterviewerSearch}
            selectedInterviewerId={selectedInterviewerId}
            onSelectInterviewer={setSelectedInterviewerId}
            intervieweeStaffId={selectedIntervieweeId}
          />
        );
      case 'confirm':
        return (
          <StaffInterviewConfirmStep
            intervieweeStaffId={selectedIntervieweeId}
            interviewerStaffId={selectedInterviewerId}
            startAt={startAt}
            endAt={endAt}
          />
        );
      default:
        return <div>Unknown step</div>;
    }
  };

  return (
    <AdminDialogShell
      open={isOpen}
      onClose={handleClose}
      fillHeight
      title="Book Staff Interview"
      subtitle={
        createdSessionId
          ? 'Send message to staff'
          : `Step ${currentStep + 1} of ${steps.length}: ${currentStepData?.title}`
      }
      contentClassName="md:max-w-4xl"
      bodyClassName="min-h-0 flex-1 overflow-hidden flex flex-col p-0"
      headerExtra={
        createdSessionId ? null : (
          <div className="px-6 pb-4">
            <div className="flex items-center gap-2">
              {steps.map((_, index) => (
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
        )
      }
      footer={
        <div className="flex w-full justify-between sm:justify-between">
          <div className="flex gap-2">
            {!createdSessionId && currentStep > 0 && (
              <Button
                variant="outline"
                onClick={handleBack}
                disabled={isSubmitting}
              >
                <ChevronLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
            )}
          </div>

          <div className="flex gap-2">
            {createdSessionId ? (
              <Button onClick={() => handleDoneMessageStep(createdSessionId)}>
                Done
              </Button>
            ) : hasNextStep ? (
              <Button
                onClick={handleNext}
                disabled={!canGoNext() || isSubmitting}
              >
                Next
                <ChevronRight className="h-4 w-4 ml-2" />
              </Button>
            ) : (
              <Button
                onClick={handleConfirmBooking}
                disabled={isSubmitting || !canGoNext()}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  'Create Booking'
                )}
              </Button>
            )}
          </div>
        </div>
      }
    >
      <div className="h-full overflow-y-auto">
        <div className="p-6">{renderStepContent()}</div>
      </div>
    </AdminDialogShell>
  );
}
