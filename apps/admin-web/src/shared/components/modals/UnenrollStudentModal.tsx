'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@altitutor/ui';
import { Button } from '@altitutor/ui';
import { Input } from '@altitutor/ui';
import { Label } from '@altitutor/ui';
import { Textarea } from '@altitutor/ui';
import { Loader2, Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import type { Tables } from '@altitutor/shared';
import { StudentCard } from '../StudentCard';
import { ClassCard } from '../ClassCard';
import { calculateLastSessionDate, formatSessionDateTime } from '@/shared/utils/schedule';
import { getMidnightAdelaide } from '@/shared/utils/enrollment';

interface UnenrollStudentModalProps {
  isOpen: boolean;
  onClose: () => void;
  
  // Enrollment details
  student: Tables<'students'>;
  studentSubjects?: Tables<'subjects'>[];
  class: Tables<'classes'>;
  classSubject?: Tables<'subjects'>;
  classStaff?: Tables<'staff'>[];
  
  // Unenrollment handler
  onUnenroll: (params: {
    studentId: string;
    classId: string;
    unenrolledAt: Date;
    reason: string;
    staffId: string;
  }) => Promise<void>;
  
  currentStaffId: string;
}

export function UnenrollStudentModal({
  isOpen,
  onClose,
  student,
  studentSubjects = [],
  class: classData,
  classSubject,
  classStaff = [],
  onUnenroll,
  currentStaffId
}: UnenrollStudentModalProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [unenrollmentDate, setUnenrollmentDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [reason, setReason] = useState('');
  const [isUnenrolling, setIsUnenrolling] = useState(false);

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

  const handleConfirm = async () => {
    setIsUnenrolling(true);
    try {
      await onUnenroll({
        studentId: student.id,
        classId: classData.id,
        unenrolledAt: getMidnightAdelaide(new Date(unenrollmentDate)),
        reason,
        staffId: currentStaffId
      });
      onClose();
    } catch (error) {
      console.error('Error unenrolling student:', error);
    } finally {
      setIsUnenrolling(false);
    }
  };

  // Calculate last session date
  const lastSessionDate = classData && unenrollmentDate
    ? calculateLastSessionDate(classData, getMidnightAdelaide(new Date(unenrollmentDate)))
    : null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Unenroll Student from Class</DialogTitle>
          <DialogDescription>
            Remove the student from this class. They will be removed from all future sessions.
          </DialogDescription>
        </DialogHeader>

        {/* Step 1: Select Unenrollment Date & Reason */}
        {step === 1 && (
          <div className="space-y-4">
            <div>
              <Label className="text-xs text-muted-foreground">Student</Label>
              <StudentCard
                student={student}
                subjects={studentSubjects}
              />
            </div>

            <div>
              <Label className="text-xs text-muted-foreground">Class</Label>
              <ClassCard
                class={classData}
                subject={classSubject}
                staff={classStaff}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="unenrollment-date">Unenrollment Date</Label>
              <div className="relative">
                <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="unenrollment-date"
                  type="date"
                  value={unenrollmentDate}
                  onChange={(e) => setUnenrollmentDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className="pl-9"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Student will be removed from all sessions after this date
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="reason">Reason for Unenrollment</Label>
              <Textarea
                id="reason"
                placeholder="Enter reason for unenrolling this student..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={4}
              />
              <p className="text-xs text-muted-foreground">
                This will be saved as a note for record-keeping
              </p>
            </div>
          </div>
        )}

        {/* Step 2: Summary & Confirm */}
        {step === 2 && (
          <div className="space-y-4">
            <div>
              <Label className="text-xs text-muted-foreground">Student</Label>
              <StudentCard
                student={student}
                subjects={studentSubjects}
              />
            </div>

            <div>
              <Label className="text-xs text-muted-foreground">Class</Label>
              <ClassCard
                class={classData}
                subject={classSubject}
                staff={classStaff}
              />
            </div>

            {lastSessionDate && (
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-sm font-medium">Last Session</p>
                <p className="text-sm text-muted-foreground">
                  {formatSessionDateTime(lastSessionDate)}
                </p>
              </div>
            )}

            {reason && (
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-sm font-medium mb-1">Reason</p>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {reason}
                </p>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="flex justify-between sm:justify-between">
          <div className="flex gap-2">
            {step === 2 && (
              <Button variant="outline" onClick={handleBack} disabled={isUnenrolling}>
                <ChevronLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
            )}
          </div>
          
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} disabled={isUnenrolling}>
              Cancel
            </Button>
            
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

