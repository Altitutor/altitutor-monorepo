'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@altitutor/ui';
import { Button } from '@altitutor/ui';
import { Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import { useUnenrollFlow } from '../hooks';
import {
  UnenrollStep1DateAndReason,
  UnenrollStep2Summary,
} from './steps';
import type { UnenrollStudentModalProps } from '../types/enrollment';

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
  const [step, setStep] = useState<1 | 2>(1);
  const [unenrollmentDate, setUnenrollmentDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [reason, setReason] = useState('');

  // Flow management
  const { isUnenrolling, handleConfirm } = useUnenrollFlow({
    isOpen,
    student,
    classData,
    unenrollmentDate,
    reason,
    onUnenroll,
    currentStaffId,
    onClose,
  });

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setUnenrollmentDate(new Date().toISOString().split('T')[0]);
      setReason('');
    }
  }, [isOpen]);

  const handleNext = () => {
    if (step === 1) {
      setStep(2);
    }
  };

  const handleBack = () => {
    if (step === 2) {
      setStep(1);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-full md:max-w-4xl h-[90vh] flex flex-col p-0">
        <DialogHeader className="flex-shrink-0 px-6 py-4 border-b">
          <DialogTitle>Unenroll Student from Class</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto min-h-0 px-6 py-4">
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
              reason={reason}
            />
          )}
        </div>

        <DialogFooter className="flex-shrink-0 flex justify-between sm:justify-between px-6 py-4 border-t">
          <div className="flex gap-2">
            {step === 2 && (
              <Button variant="outline" onClick={handleBack} disabled={isUnenrolling}>
                <ChevronLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
            )}
          </div>
          
          <div className="flex gap-2">
            {step === 1 ? (
              <Button onClick={handleNext}>
                Next
                <ChevronRight className="h-4 w-4 ml-2" />
              </Button>
            ) : (
              <Button onClick={handleConfirm} disabled={isUnenrolling} variant="destructive">
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
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

