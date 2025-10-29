'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@altitutor/ui';
import { Button } from '@altitutor/ui';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { Tables } from '@altitutor/shared';
import type { TutorLogFormData } from '../types';
import { useCreateTutorLog } from '../hooks';
import { usePrecreateSessions } from '@/features/sessions';
import { format } from 'date-fns';

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
};

export function LogSessionModal({ isOpen, onClose, currentStaffId, adminMode = false }: LogSessionModalProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedStaffId, setSelectedStaffId] = useState<string>(currentStaffId);
  const [formData, setFormData] = useState<Partial<TutorLogFormData>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const createMutation = useCreateTutorLog();
  const { mutate: precreate } = usePrecreateSessions();

  // Precreate sessions for today when modal opens
  useEffect(() => {
    if (isOpen) {
      const today = format(new Date(), 'yyyy-MM-dd');
      precreate({ 
        start_date: today, 
        end_date: today,
      });
    }
  }, [isOpen, precreate]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setCurrentStep(0);
      setSelectedStaffId(currentStaffId);
      setFormData({});
      setIsSubmitting(false);
    }
  }, [isOpen, currentStaffId]);

  const totalSteps = adminMode ? 10 : 9; // Extra step for staff selection in admin mode

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

    setIsSubmitting(true);
    try {
      await createMutation.mutateAsync({
        data: formData as TutorLogFormData,
        createdBy: selectedStaffId,
      });
      onClose();
    } catch (error) {
      console.error('Failed to create tutor log:', error);
      alert('Failed to submit log. Please try again.');
    } finally {
      setIsSubmitting(false);
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
    if (adminMode && currentStep === 0) {
      return (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Select which staff member you're logging this session for.
          </p>
          {/* Staff selector would go here - for now just show current */}
          <div className="p-4 border rounded-md">
            <p className="font-medium">Staff ID: {selectedStaffId}</p>
            <p className="text-sm text-muted-foreground">Staff selector to be implemented</p>
          </div>
        </div>
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
        return (formData.topics || []).length > 0;
      case 4:
        return true; // Can proceed even with no student assignments
      case 5:
        return (formData.topicFiles || []).length > 0;
      case 6:
        return true;
      case 7:
        return true;
      default:
        return false;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {getStepTitle()} ({currentStep + 1}/{totalSteps})
          </DialogTitle>
        </DialogHeader>

        <div className="mt-4 min-h-[400px]">{renderStep()}</div>

        <div className="flex justify-between mt-6 pt-4 border-t">
          <Button
            variant="outline"
            onClick={handlePrevious}
            disabled={currentStep === 0}
          >
            <ChevronLeft className="h-4 w-4 mr-2" />
            Previous
          </Button>

          {currentStep < totalSteps - 1 ? (
            <Button onClick={handleNext} disabled={!canGoNext()}>
              Next
              <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          ) : (
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || !canGoNext()}
            >
              {isSubmitting ? 'Submitting...' : 'Submit Log'}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}


