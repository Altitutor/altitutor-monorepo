'use client';

import {
  Button,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@altitutor/ui';
import { Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import { AdminDialogShell } from '@/shared/components/dialog-shell';
import { TimeSlotPicker } from './TimeSlotPicker';
import { StaffSelector } from './StaffSelector';
import { useBookSessionFlow } from '../hooks/useBookSessionFlow';
import { useSessionDurationMinutes } from '../hooks/useBookingSettings';
import { getSessionTypeLabel } from '../utils/bookingHelpers';
import { formatSlotDateTime, getCurrentAdelaideTime } from '../utils/dateTimeHelpers';
import { StudentSelectionStep } from './steps/StudentSelectionStep';
import { TrialStudentSelectionStep } from './steps/TrialStudentSelectionStep';
import { SubjectSelectionStep } from './steps/SubjectSelectionStep';
import { ConfirmationStep } from './steps/ConfirmationStep';
import { BookSessionNotifyStep } from './BookSessionNotifyStep';
import { useDialogHotkeys } from '@/shared/hooks';

export interface BookSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessionType: 'DRAFTING' | 'TRIAL_SESSION' | 'SUBSIDY_INTERVIEW';
  onBookingCreated?: (sessionId: string) => void;
  initialStudentId?: string;
  originalSessionId?: string | null;
  originalSubjectId?: string | null;
}

export function BookSessionModal({
  isOpen,
  onClose,
  sessionType,
  onBookingCreated,
  initialStudentId,
  originalSessionId = null,
  originalSubjectId = null,
}: BookSessionModalProps) {
  const { data: durationMinutes = 60 } = useSessionDurationMinutes(sessionType);

  const {
    // State
    currentStep,
    studentSearch,
    selectedStudentId,
    selectedSubjectId,
    selectedSlot,
    selectedStaffId,
    isCreatingTrialStudent,
    trialContactData,
    showPastDateWarning,
    isSubmitting,
    studentsLoading,
    
    // Data
    steps,
    currentStepData,
    currentStepId,
    studentsData,
    subjects,
    studentSubjects,
    sessionsData,
    selectedStaff,
    selectedStudent,
    
    // Actions
    setStudentSearch,
    setSelectedStudentId,
    setSelectedSubjectId,
    setSelectedStaffId,
    setTrialContactFormRef,
    setTrialFormValid,
    handleStartCreatingTrialStudent,
    handleCancelCreatingTrialStudent,
    handleSelectExistingTrialStudent,
    handleSlotSelect,
    handleTrialContactSubmit,
    handleNext,
    handleBack,
    handleConfirmBooking,
    handleClose,
    handlePastDateWarningConfirm,
    handlePastDateWarningCancel,
    canGoNext,
    createdSessionId,
    handleDoneNotifyStep,
  } = useBookSessionFlow({
    isOpen,
    sessionType,
    initialStudentId,
    originalSessionId,
    originalSubjectId,
    onBookingCreated,
    onClose,
  });

  const isNotifyStep = !!createdSessionId;
  const hasNextStep = !isNotifyStep && currentStep < steps.length - 1;
  const isFinalStep = !isNotifyStep && currentStep === steps.length - 1;

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
        <BookSessionNotifyStep
          sessionId={createdSessionId}
          sessionType={sessionType}
          successMessage={`${getSessionTypeLabel(sessionType)} has been booked successfully`}
        />
      );
    }
    switch (currentStepId) {
      case 'student':
        return (
          <StudentSelectionStep
            studentSearch={studentSearch}
            onSearchChange={setStudentSearch}
            students={studentsData}
            isLoading={studentsLoading}
            selectedStudentId={selectedStudentId}
            onSelectStudent={setSelectedStudentId}
          />
        );

      case 'trial-contact':
        return (
          <TrialStudentSelectionStep
            studentSearch={studentSearch}
            onSearchChange={setStudentSearch}
            students={studentsData}
            isLoading={studentsLoading}
            selectedStudentId={selectedStudentId}
            onSelectStudent={handleSelectExistingTrialStudent}
            isCreatingStudent={isCreatingTrialStudent}
            onStartCreatingStudent={handleStartCreatingTrialStudent}
            onCancelCreatingStudent={handleCancelCreatingTrialStudent}
            trialContactData={trialContactData}
            onFormSubmit={handleTrialContactSubmit}
            onFormReady={setTrialContactFormRef}
            onValidityChange={setTrialFormValid}
          />
        );

      case 'subject':
        return (
          <SubjectSelectionStep
            sessionType={sessionType}
            selectedSubjectId={selectedSubjectId}
            onSelectSubject={setSelectedSubjectId}
            onClearSubject={() => setSelectedSubjectId('')}
            studentSubjects={studentSubjects}
            allSubjects={subjects}
          />
        );

      case 'time':
        return (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Choose an available time slot
            </p>
            <TimeSlotPicker
              sessionType={sessionType}
              subjectId={selectedSubjectId || undefined}
              durationMinutes={durationMinutes}
              onSlotSelect={handleSlotSelect}
              selectedSlot={selectedSlot ? { startAt: selectedSlot.startAt, endAt: selectedSlot.endAt } : null}
            />
          </div>
        );

      case 'staff':
        return (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Select a staff member for this session
            </p>
            {selectedSlot && selectedSlot.availableStaffIds.length > 0 ? (
              <StaffSelector
                availableStaffIds={selectedSlot.availableStaffIds}
                selectedStaffId={selectedStaffId}
                onSelect={setSelectedStaffId}
                disabled={isSubmitting}
              />
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <p>Please select a time slot first</p>
              </div>
            )}
          </div>
        );

      case 'confirm':
        return (
          <ConfirmationStep
            sessionType={sessionType}
            selectedSlot={selectedSlot!}
            selectedStudentId={selectedStudentId}
            selectedSubjectId={selectedSubjectId}
            trialContactData={trialContactData}
            studentsData={studentsData}
            subjects={subjects}
            studentSubjects={studentSubjects}
            durationMinutes={durationMinutes}
            sessionsData={sessionsData}
            selectedStaff={selectedStaff}
            selectedStudent={selectedStudent}
          />
        );

      default:
        return <div>Unknown step</div>;
    }
  };

  const dialogTitle = originalSessionId
    ? `Reschedule ${getSessionTypeLabel(sessionType)}`
    : `Book ${getSessionTypeLabel(sessionType)}`;

  const dialogSubtitle = createdSessionId
    ? 'Notify the student/parent or staff about the booking'
    : `Step ${currentStep + 1} of ${steps.length}: ${currentStepData?.title}`;

  return (
    <>
      <AdminDialogShell
        open={isOpen}
        onClose={handleClose}
        fillHeight
        title={dialogTitle}
        subtitle={dialogSubtitle}
        contentClassName="md:max-w-4xl"
        bodyClassName="min-h-0 flex-1 overflow-hidden flex flex-col p-0"
        headerExtra={
          createdSessionId ? null : (
            <div className="px-6 pb-4">
              <div className="flex items-center gap-2">
                {Array.from({ length: steps.length }).map((_, index) => (
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
              {!createdSessionId && currentStep > 0 && !originalSessionId && (
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
                <Button onClick={() => handleDoneNotifyStep(createdSessionId)}>
                  Done
                </Button>
              ) : currentStep < steps.length - 1 ? (
                <Button onClick={handleNext} disabled={!canGoNext() || isSubmitting}>
                  Next
                  <ChevronRight className="h-4 w-4 ml-2" />
                </Button>
              ) : (
                <Button onClick={handleConfirmBooking} disabled={isSubmitting || !canGoNext()}>
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
        {isNotifyStep ? (
          <div className="flex-1 min-h-0 flex flex-col p-6">
            {renderStepContent()}
          </div>
        ) : (
          <div className="h-full overflow-y-auto">
            <div className="p-6">
              {renderStepContent()}
            </div>
          </div>
        )}
      </AdminDialogShell>

      {/* Past Date Warning Dialog */}
      <AlertDialog 
        open={showPastDateWarning} 
        onOpenChange={(open) => {
          if (!open) {
            handlePastDateWarningCancel();
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Warning: Booking in the Past</AlertDialogTitle>
            <AlertDialogDescription>
              You are about to book a session for a time that has already passed in Adelaide time.
              <br />
              <br />
              <strong>Selected time:</strong> {selectedSlot ? formatSlotDateTime(selectedSlot.startAt) : ''}
              <br />
              <strong>Current time:</strong> {getCurrentAdelaideTime()}
              <br />
              <br />
              Are you sure you want to proceed with booking this past session?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handlePastDateWarningCancel}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handlePastDateWarningConfirm}>Proceed Anyway</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
