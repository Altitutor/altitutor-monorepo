'use client';

import { Button } from '@altitutor/ui';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useLogSessionFlow } from '../hooks/useLogSessionFlow';
import { getLogSessionStepTitle, getAttendedStudentIds, type LogSessionWizardFlow } from '../utils/logSessionHelpers';
import { getShortSessionName } from '@/features/sessions/utils/session-helpers';
import { AdminDialogShell } from '@/shared/components';
import { cn } from '@/shared/utils';

import { Step1SessionPicker } from './steps/Step1SessionPicker';
import { Step2StaffAttendance } from './steps/Step2StaffAttendance';
import { Step3StudentAttendance } from './steps/Step3StudentAttendance';
import { Step4Topics } from './steps/Step4Topics';
import { Step5TopicStudents } from './steps/Step5TopicStudents';
import { Step6Files } from './steps/Step6Files';
import { Step7FileStudents } from './steps/Step7FileStudents';
import { Step8Notes } from './steps/Step8Notes';
import { Step9Confirmation } from './steps/Step9Confirmation';
import { MeetingAdminStaffSessionStep } from './steps/MeetingAdminStaffSessionStep';
import { MeetingCombinedAttendanceStep } from './steps/MeetingCombinedAttendanceStep';

type LogSessionModalProps = {
  isOpen: boolean;
  onClose: () => void;
  currentStaffId: string;
  adminMode?: boolean;
  initialSessionId?: string;
  initialStaffId?: string;
  initialSessionKind?: LogSessionWizardFlow;
};

export function LogSessionModal({
  isOpen,
  onClose,
  currentStaffId,
  adminMode = false,
  initialSessionId,
  initialStaffId,
  initialSessionKind,
}: LogSessionModalProps) {
  const {
    currentStep,
    selectedStaffId,
    formData,
    submissionState,
    submissionError,
    totalSteps,
    wizardFlow,
    selectedStaff,
    selectedSession,
    sessionParents,
    setSelectedStaffId,
    updateFormData,
    handleNext,
    handlePrevious,
    handleSubmit,
    handleClose,
    handleTryAgain,
    handleAddStaffToSession,
    handleAddStudentToSession,
    handleAddParentToSession,
    handleRemoveStaffFromSession,
    handleRemoveStudentFromSession,
    canGoNext,
  } = useLogSessionFlow({
    isOpen,
    onClose,
    currentStaffId,
    adminMode,
    initialSessionId,
    initialStaffId,
    initialSessionKind,
  });

  const getStepTitle = () => getLogSessionStepTitle(currentStep, !!adminMode, wizardFlow);

  const handleDialogClose = () => {
    if (submissionState === 'success') {
      handleClose();
    } else {
      onClose();
    }
  };

  const staffSummaryName = selectedStaff
    ? `${selectedStaff.first_name ?? ''} ${selectedStaff.last_name ?? ''}`.trim() || 'Staff'
    : 'choose staff member';

  const sessionSummaryName = selectedSession
    ? selectedSession.long_name?.trim() || getShortSessionName(selectedSession)
    : 'choose session';

  const renderSummary = () => (
    <div className="p-4 bg-muted rounded-lg mb-4">
      <p className="text-sm font-medium">
        Log a session for{' '}
        <span
          className={cn(
            'inline-flex items-center px-2 py-1 rounded-md font-semibold border',
            selectedStaff
              ? 'bg-primary/10 text-primary border-primary/20'
              : 'bg-muted-foreground/10 text-muted-foreground border-muted-foreground/20',
          )}
        >
          {staffSummaryName}
        </span>
        :{' '}
        <span
          className={cn(
            'inline-flex items-center px-2 py-1 rounded-md font-semibold border',
            selectedSession
              ? 'bg-primary/10 text-primary border-primary/20'
              : 'bg-muted-foreground/10 text-muted-foreground border-muted-foreground/20',
          )}
        >
          {sessionSummaryName}
        </span>
      </p>
    </div>
  );

  const renderStep = () => {
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
          <div className="text-lg font-semibold">Tutor log submitted successfully</div>
          <div className="text-sm text-muted-foreground">The session has been logged and saved.</div>
        </div>
      );
    }

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
          <div className="text-lg font-semibold">Failed to submit tutor log</div>
          <div className="text-sm text-muted-foreground">
            {submissionError || 'An error occurred while submitting the log.'}
          </div>
        </div>
      );
    }

    if (wizardFlow === 'meeting' && adminMode) {
      switch (currentStep) {
        case 0:
          return (
            <MeetingAdminStaffSessionStep
              selectedStaffId={selectedStaffId}
              onStaffChange={setSelectedStaffId}
              selectedSessionId={formData.sessionId}
              onSessionChange={(sessionId) => updateFormData({ sessionId })}
            />
          );
        case 1:
          return formData.sessionId ? (
            <MeetingCombinedAttendanceStep
              sessionId={formData.sessionId}
              currentStaffId={selectedStaffId}
              sessionType={selectedSession?.type}
              sessionParents={sessionParents}
              staffAttendance={formData.staffAttendance || []}
              studentAttendance={formData.studentAttendance || []}
              parentAttendance={formData.parentAttendance ?? []}
              onStaffAttendanceUpdate={(staffAttendance) => updateFormData({ staffAttendance })}
              onStudentAttendanceUpdate={(studentAttendance) => updateFormData({ studentAttendance })}
              onParentAttendanceUpdate={(parentAttendance) => updateFormData({ parentAttendance })}
              onAddStaffToSession={handleAddStaffToSession}
              onAddStudentToSession={handleAddStudentToSession}
              onAddParentToSession={handleAddParentToSession}
              onRemoveStaffFromSession={async (staffId) => {
                await handleRemoveStaffFromSession(staffId);
                updateFormData({
                  staffAttendance: (formData.staffAttendance || []).filter((a) => a.staffId !== staffId),
                });
              }}
              onRemoveStudentFromSession={async (studentId) => {
                await handleRemoveStudentFromSession(studentId);
                updateFormData({
                  studentAttendance: (formData.studentAttendance || []).filter((a) => a.studentId !== studentId),
                });
              }}
            />
          ) : null;
        case 2:
          return (
            <Step8Notes
              title={getStepTitle()}
              notes={formData.notes || []}
              onUpdate={(notes) => updateFormData({ notes })}
            />
          );
        case 3:
          return <Step9Confirmation title={getStepTitle()} formData={formData} />;
        default:
          return null;
      }
    }

    if (wizardFlow === 'meeting' && !adminMode) {
      switch (currentStep) {
        case 0:
          return (
            <Step1SessionPicker
              title={getStepTitle()}
              staffId={selectedStaffId}
              selectedSessionId={formData.sessionId}
              onSelectSession={(sessionId) => updateFormData({ sessionId })}
              variant="compactList"
            />
          );
        case 1:
          return formData.sessionId ? (
            <MeetingCombinedAttendanceStep
              sessionId={formData.sessionId}
              currentStaffId={selectedStaffId}
              sessionType={selectedSession?.type}
              sessionParents={sessionParents}
              staffAttendance={formData.staffAttendance || []}
              studentAttendance={formData.studentAttendance || []}
              parentAttendance={formData.parentAttendance ?? []}
              onStaffAttendanceUpdate={(staffAttendance) => updateFormData({ staffAttendance })}
              onStudentAttendanceUpdate={(studentAttendance) => updateFormData({ studentAttendance })}
              onParentAttendanceUpdate={(parentAttendance) => updateFormData({ parentAttendance })}
              onAddStaffToSession={handleAddStaffToSession}
              onAddStudentToSession={handleAddStudentToSession}
              onAddParentToSession={handleAddParentToSession}
              onRemoveStaffFromSession={async (staffId) => {
                await handleRemoveStaffFromSession(staffId);
                updateFormData({
                  staffAttendance: (formData.staffAttendance || []).filter((a) => a.staffId !== staffId),
                });
              }}
              onRemoveStudentFromSession={async (studentId) => {
                await handleRemoveStudentFromSession(studentId);
                updateFormData({
                  studentAttendance: (formData.studentAttendance || []).filter((a) => a.studentId !== studentId),
                });
              }}
            />
          ) : null;
        case 2:
          return (
            <Step8Notes
              title={getStepTitle()}
              notes={formData.notes || []}
              onUpdate={(notes) => updateFormData({ notes })}
            />
          );
        case 3:
          return <Step9Confirmation title={getStepTitle()} formData={formData} />;
        default:
          return null;
      }
    }

    if (wizardFlow === 'class' && adminMode && currentStep === 0) {
      return (
        <MeetingAdminStaffSessionStep
          selectedStaffId={selectedStaffId}
          onStaffChange={setSelectedStaffId}
          selectedSessionId={formData.sessionId}
          onSessionChange={(sessionId) => updateFormData({ sessionId })}
        />
      );
    }

    const legacyStepIndex =
      adminMode && wizardFlow === 'class' ? currentStep : adminMode ? currentStep - 1 : currentStep;

    switch (legacyStepIndex) {
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
            onRemoveStaffFromSession={async (staffId) => {
              await handleRemoveStaffFromSession(staffId);
              updateFormData({
                staffAttendance: (formData.staffAttendance || []).filter((a) => a.staffId !== staffId),
              });
            }}
            addStaffVariant="search"
          />
        );
      case 2:
        return (
          <Step3StudentAttendance
            title={getStepTitle()}
            sessionId={formData.sessionId!}
            sessionType={selectedSession?.type}
            sessionParents={sessionParents}
            studentAttendance={formData.studentAttendance || []}
            parentAttendance={formData.parentAttendance ?? []}
            onUpdate={(studentAttendance) => updateFormData({ studentAttendance })}
            onParentAttendanceUpdate={(parentAttendance) => updateFormData({ parentAttendance })}
            addStudentVariant="search"
            onAddStudentToSession={handleAddStudentToSession}
            onAddParentToSession={handleAddParentToSession}
            onRemoveStudentFromSession={async (studentId) => {
              await handleRemoveStudentFromSession(studentId);
              updateFormData({
                studentAttendance: (formData.studentAttendance || []).filter((a) => a.studentId !== studentId),
              });
            }}
            showBillingConsequences={adminMode}
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
        return <Step9Confirmation title={getStepTitle()} formData={formData} />;
      default:
        return null;
    }
  };

  return (
    <AdminDialogShell
      fillHeight
      open={isOpen}
      onClose={handleDialogClose}
      title="Log session"
      subtitle={`Step ${currentStep + 1} of ${totalSteps}: ${getStepTitle()}`}
      contentClassName="md:max-w-4xl"
      bodyClassName="min-h-0"
      headerExtra={
        submissionState !== 'success' && submissionState !== 'error' ? (
          <div className="px-6 pb-4">
            <div className="flex items-center gap-2">
              {Array.from({ length: totalSteps }).map((_, index) => (
                <div
                  key={index}
                  className={cn(
                    'flex-1 h-2 rounded-full transition-colors',
                    index < currentStep ? 'bg-primary' : index === currentStep ? 'bg-primary/50' : 'bg-muted',
                  )}
                />
              ))}
            </div>
          </div>
        ) : undefined
      }
      footer={
        submissionState === 'success' ? (
          <div className="flex w-full justify-end">
            <Button onClick={handleClose}>Close</Button>
          </div>
        ) : submissionState === 'error' ? (
          <div className="flex w-full justify-between">
            <Button variant="outline" onClick={handleTryAgain}>
              Try Again
            </Button>
            <Button onClick={onClose}>Close</Button>
          </div>
        ) : (
          <div className="flex w-full justify-between">
            <Button variant="outline" onClick={handlePrevious} disabled={currentStep === 0}>
              <ChevronLeft className="h-4 w-4 mr-2" />
              Previous
            </Button>

            {currentStep < totalSteps - 1 ? (
              <Button onClick={handleNext} disabled={!canGoNext}>
                Next
                <ChevronRight className="h-4 w-4 ml-2" />
              </Button>
            ) : (
              <Button onClick={handleSubmit} disabled={submissionState === 'submitting' || !canGoNext}>
                {submissionState === 'submitting' ? 'Submitting...' : 'Submit log'}
              </Button>
            )}
          </div>
        )
      }
    >
      {submissionState !== 'success' && submissionState !== 'error' && renderSummary()}
      {renderStep()}
    </AdminDialogShell>
  );
}
