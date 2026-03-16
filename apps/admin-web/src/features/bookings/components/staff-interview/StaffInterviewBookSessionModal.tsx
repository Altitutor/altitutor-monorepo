'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  Button,
} from '@altitutor/ui';
import { Loader2, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useStaffInterviewBookingFlow } from '../../hooks/useStaffInterviewBookingFlow';
import { StaffIntervieweeStep } from './StaffIntervieweeStep';
import { StaffInterviewTimeStep } from './StaffInterviewTimeStep';
import { StaffInterviewInterviewerStep } from './StaffInterviewInterviewerStep';
import { StaffInterviewConfirmStep } from './StaffInterviewConfirmStep';
import { StaffInterviewMessageStep } from './StaffInterviewMessageStep';
import { useDialogHotkeys } from '@/shared/hooks';

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
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="w-full md:max-w-4xl h-[90vh] flex flex-col p-0 [&>button]:hidden">
        <div className="flex-shrink-0 border-b bg-background">
          <DialogHeader className="px-6 pt-6 pb-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3 flex-1">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleClose}
                  className="shrink-0"
                >
                  <X className="h-4 w-4" />
                </Button>
                <div className="flex-1">
                  <DialogTitle>Book Staff Interview</DialogTitle>
                  <DialogDescription>
                    {createdSessionId
                      ? 'Send message to staff'
                      : `Step ${currentStep + 1} of ${steps.length}: ${currentStepData?.title}`}
                  </DialogDescription>
                </div>
              </div>
            </div>
          </DialogHeader>

          <div className="px-6 pb-4">
            <div className="flex gap-2">
              {createdSessionId
                ? null
                : steps.map((_, index) => (
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
        </div>

        <div className="flex-1 overflow-hidden min-h-0">
          <div className="h-full overflow-y-auto">
            <div className="p-6">{renderStepContent()}</div>
          </div>
        </div>

        <div className="flex justify-between px-6 py-4 border-t bg-background">
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
      </DialogContent>
    </Dialog>
  );
}
