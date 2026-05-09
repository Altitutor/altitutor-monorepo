'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import type { JSONContent } from '@tiptap/core';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@altitutor/ui';
import { Button } from '@altitutor/ui';
import { Loader2, ChevronLeft, ChevronRight, X } from 'lucide-react';
import {
  ExpandButton,
  EXPANDABLE_DIALOG_TRANSITION,
  EXPANDED_DIALOG_CONTENT_CLASS,
} from '@/shared/components/expandable-dialog';
import { cn } from '@/shared/utils';
import { useUnenrollFlow } from '../hooks';
import {
  UnenrollStep1DateAndReason,
  UnenrollStep2Summary,
  UnenrollStep3MessageScreen,
} from './steps';
import { isTiptapContentEmpty } from '@/shared/utils/plainTextToTiptapJson';
import type { UnenrollStudentModalProps } from '../types/enrollment';
import { useDialogHotkeys } from '@/shared/hooks';

export function UnenrollStudentModal({
  isOpen,
  onClose,
  student,
  studentSubjects = [],
  class: classData,
  classSubject,
  classStaff = [],
  onUnenroll,
  currentStaffId,
}: UnenrollStudentModalProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [unenrollmentDate, setUnenrollmentDate] = useState<string>('');
  const [reason, setReason] = useState<JSONContent | undefined>(undefined);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!isOpen) setExpanded(false);
  }, [isOpen]);

  // Flow management
  const { isUnenrolling, handleConfirm, unenrollmentSuccess } = useUnenrollFlow({
    isOpen,
    student,
    classData,
    unenrollmentDate,
    reason,
    onUnenroll,
    currentStaffId,
    onClose,
  });

  // Move to step 3 when unenrollment succeeds
  useEffect(() => {
    if (unenrollmentSuccess && step === 2) {
      setStep(3);
    }
  }, [unenrollmentSuccess, step]);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setUnenrollmentDate('');
      setReason(undefined);
    }
  }, [isOpen]);

  const handleNext = useCallback(() => {
    if (step === 1 && unenrollmentDate && unenrollmentDate.trim() !== '') {
      setStep(2);
    }
  }, [step, unenrollmentDate]);

  const getStepTitle = (step: 1 | 2 | 3): string => {
    switch (step) {
      case 1:
        return 'Select Final Session';
      case 2:
        return 'Reason & Confirm';
      case 3:
        return 'Send Message';
      default:
        return '';
    }
  };

  const handleBack = () => {
    if (step === 2) {
      setStep(1);
    }
  };

  const hasNextStep = useMemo(() => step === 1, [step]);
  const isFinalStep = useMemo(() => step === 2, [step]);

  useDialogHotkeys({
    isOpen,
    onNextStep: handleNext,
    hasNextStep,
    onPrimaryAction: isFinalStep ? handleConfirm : undefined,
    isActionDisabled: isUnenrolling || isTiptapContentEmpty(reason),
  });

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
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
                  onClick={onClose}
                  className="shrink-0"
                >
                  <X className="h-4 w-4" />
                </Button>
                <div className="flex-1 min-w-0">
                  <DialogTitle>Unenroll Student from Class</DialogTitle>
                  <DialogDescription>
                    Step {step} of 3: {getStepTitle(step)}
                  </DialogDescription>
                </div>
              </div>
              <ExpandButton expanded={expanded} onToggle={() => setExpanded((e) => !e)} />
            </div>
          </DialogHeader>

          {/* Progress Indicator */}
          <div className="px-6 pb-4">
            <div className="flex items-center gap-2">
              {Array.from({ length: 3 }).map((_, index) => (
                <div
                  key={index}
                  className={`flex-1 h-2 rounded-full transition-colors ${
                    index < step - 1
                      ? 'bg-primary'
                      : index === step - 1
                      ? 'bg-primary/50'
                      : 'bg-muted'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden min-h-0 flex flex-col">
          {step === 3 ? (
            <UnenrollStep3MessageScreen
              student={student}
              classData={classData}
              classSubject={classSubject}
              unenrollmentDate={unenrollmentDate}
            />
          ) : (
            <div className="h-full overflow-y-auto">
              <div className="p-6">
                {/* Step 1: Select Unenrollment Date & Reason */}
                {step === 1 && (
                  <UnenrollStep1DateAndReason
                    student={student}
                    studentSubjects={studentSubjects}
                    classData={classData}
                    classSubject={classSubject}
                    classStaff={classStaff}
                    unenrollmentDate={unenrollmentDate}
                    reason={reason}
                    onDateChange={setUnenrollmentDate}
                    onReasonChange={setReason}
                  />
                )}

                {/* Step 2: Summary & Confirm */}
                {step === 2 && (
                  <UnenrollStep2Summary
                    student={student}
                    studentSubjects={studentSubjects}
                    classData={classData}
                    classSubject={classSubject}
                    classStaff={classStaff}
                    unenrollmentDate={unenrollmentDate}
                    reason={reason ?? { type: 'doc', content: [{ type: 'paragraph', content: [] }] }}
                    onReasonChange={setReason}
                  />
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <DialogFooter className="flex-shrink-0 flex justify-between sm:justify-between px-6 py-4 border-t">
          {step === 3 ? (
            <div className="flex gap-2 ml-auto">
              <Button onClick={onClose}>
                Done
              </Button>
            </div>
          ) : (
            <>
              <div className="flex gap-2">
                {step > 1 && (
                  <Button variant="outline" onClick={handleBack} disabled={isUnenrolling}>
                    <ChevronLeft className="h-4 w-4 mr-2" />
                    Back
                  </Button>
                )}
              </div>
              
              <div className="flex gap-2">
                {step < 2 ? (
                  <Button 
                    onClick={handleNext}
                    disabled={!unenrollmentDate || unenrollmentDate.trim() === ''}
                  >
                    Next
                    <ChevronRight className="h-4 w-4 ml-2" />
                  </Button>
                ) : (
                  <Button 
                    onClick={handleConfirm} 
                    disabled={isUnenrolling || isTiptapContentEmpty(reason)} 
                    variant="destructive"
                  >
                    {isUnenrolling ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Unenrolling...
                      </>
                    ) : (
                      'Confirm Unenrollment'
                    )}
                  </Button>
                )}
              </div>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

