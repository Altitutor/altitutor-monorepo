'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@altitutor/ui';
import { Button } from '@altitutor/ui';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { Tables } from '@altitutor/shared';
import type { TutorLogFormData } from '../types';
import { useCreateTutorLog } from '../hooks';
import { StaffCard } from '@/shared/components/StaffCard';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import type { Database } from '@altitutor/shared';
import type { SupabaseClient } from '@supabase/supabase-js';

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
};

type SubmissionState = 'idle' | 'submitting' | 'success' | 'error';

export function LogSessionModal({ isOpen, onClose, currentStaffId, adminMode = false }: LogSessionModalProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedStaffId, setSelectedStaffId] = useState<string>(currentStaffId);
  const [formData, setFormData] = useState<Partial<TutorLogFormData>>({});
  const [submissionState, setSubmissionState] = useState<SubmissionState>('idle');
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [selectedStaff, setSelectedStaff] = useState<Tables<'staff'> | null>(null);

  const createMutation = useCreateTutorLog();

  // Fetch selected staff data
  useEffect(() => {
    const fetchStaff = async () => {
      if (!selectedStaffId) return;
      const supabase = getSupabaseClient() as SupabaseClient<Database>;
      const { data } = await supabase
        .from('staff')
        .select('*')
        .eq('id', selectedStaffId)
        .single();
      setSelectedStaff(data || null);
    };
    fetchStaff();
  }, [selectedStaffId]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setCurrentStep(0);
      setSelectedStaffId(currentStaffId);
      setFormData({});
      setSubmissionState('idle');
      setSubmissionError(null);
    }
  }, [isOpen, currentStaffId]);

  const actualTotalSteps = adminMode ? 10 : 9;

  const handleNext = () => {
    if (currentStep < actualTotalSteps - 1) {
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
    try {
      await createMutation.mutateAsync({
        data: formData as TutorLogFormData,
        createdBy: selectedStaffId,
      });
      setSubmissionState('success');
    } catch (error) {
      console.error('Failed to create tutor log:', error);
      setSubmissionState('error');
      setSubmissionError(error instanceof Error ? error.message : 'Failed to submit log. Please try again.');
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
    return titles[stepIndex] || 'Log Session';
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
          selectedStaffId={selectedStaffId || undefined}
          onSelectStaff={(staffId) => {
            setSelectedStaffId(staffId);
          }}
        />
      );
    }

    const stepIndex = adminMode ? currentStep - 1 : currentStep;

    switch (stepIndex) {
      case 0:
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
              const supabase = getSupabaseClient() as SupabaseClient<Database>;
              const { error } = await supabase
                .from('sessions_staff')
                .insert({
                  session_id: formData.sessionId!,
                  staff_id: staffId,
                  planned_absence: false,
                });
              if (error) throw error;
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
          />
        );
      default:
        return null;
    }
  };

  const canGoNext = () => {
    if (adminMode && currentStep === 0) return !!selectedStaffId;
    const stepIndex = adminMode ? currentStep - 1 : currentStep;

    switch (stepIndex) {
      case 0:
        return !!formData.sessionId;
      case 1:
        return (formData.staffAttendance || []).length > 0;
      case 2:
        return (formData.studentAttendance || []).length > 0;
      case 3:
        return true; // Allow proceeding with no topics selected
      case 4:
        return true; // Can proceed even with no student assignments
      case 5:
        return true; // Allow proceeding with no files selected
      case 6:
        return true; // Allow proceeding with no file assignments
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
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-6 py-4 border-b">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <DialogTitle>{getStepTitle() || 'Tutor Log'}</DialogTitle>
              <DialogDescription className="sr-only">
                Tutor log form step {currentStep + 1} of {actualTotalSteps}
              </DialogDescription>
              {selectedStaff && (
                <div className="mt-3">
                  <StaffCard
                    staff={selectedStaff}
                    showSubjects={false}
                    showActions={false}
                  />
                </div>
              )}
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4 min-h-[400px]">
          {renderStep()}
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
                onClick={() => setSubmissionState('idle')}
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

              {currentStep < actualTotalSteps - 1 ? (
                <Button onClick={handleNext} disabled={!canGoNext()}>
                  Next
                  <ChevronRight className="h-4 w-4 ml-2" />
                </Button>
              ) : (
                <Button
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


