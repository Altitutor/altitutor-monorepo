'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@altitutor/ui';
import { Button } from '@altitutor/ui';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@altitutor/ui';
import { Loader2, ChevronLeft, ChevronRight, X } from 'lucide-react';
import {
  ExpandButton,
  EXPANDABLE_DIALOG_TRANSITION,
  EXPANDED_DIALOG_CONTENT_CLASS,
} from '@/shared/components/expandable-dialog';
import { cn } from '@/shared/utils';
import type { Tables, ClassWithExpandedSubject } from '@altitutor/shared';
import {
  useEnrollmentFilters,
  useEnrollmentConflicts,
  useEnrollmentData,
  useEnrollmentFlow,
  useClassConflicts,
} from '../hooks';
import {
  Step1SelectStudentOrClass,
  Step2SelectEnrollmentDate,
  Step3SummaryAndConfirm,
  Step4MessageScreen,
} from './steps';
import type { EnrollStudentModalProps, EnrollmentWarningState, StudentWithEnrollmentInfo } from '../types/enrollment';
import { useDialogHotkeys } from '@/shared/hooks';

export function EnrollStudentModal({
  isOpen,
  onClose,
  context,
  classData,
  classSubject,
  classStaff = [],
  enrolledStudentIds = [],
  student,
  studentSubjects = [],
  enrolledClassIds = [],
  subjectId,
  onFetchStudents,
  onFetchClasses,
  onEnroll,
  currentStaffId,
}: EnrollStudentModalProps) {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [selectedClassData, setSelectedClassData] = useState<ClassWithExpandedSubject | undefined>(undefined);
  const [selectedStudentData, setSelectedStudentData] = useState<Tables<'students'> | undefined>(undefined);
  const [enrollmentDate, setEnrollmentDate] = useState<string>('');
  
  // Warning state for greyed out student selection
  const [warningState, setWarningState] = useState<EnrollmentWarningState>({
    showEnrolledWarning: false,
    warningStudent: null,
  });
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!isOpen) setExpanded(false);
  }, [isOpen]);

  // Fetch data
  const { students, classes, isFetching } = useEnrollmentData({
    isOpen,
    step,
    context,
    onFetchStudents,
    onFetchClasses,
    subjectId,
  });

  // Get selected data for display
  const selectedStudent = context === 'student' 
    ? student 
    : (selectedStudentData || students.find(s => s.id === selectedStudentId));
  
  // Update selectedClassData when classes are available and selectedClassId is set
  useEffect(() => {
    if (context === 'student' && selectedClassId && classes.length > 0) {
      const found = classes.find(c => c.id === selectedClassId);
      if (found) {
        setSelectedClassData(found);
      }
    }
  }, [context, selectedClassId, classes]);
  
  // Update selectedStudentData when students are available and selectedStudentId is set (class context)
  useEffect(() => {
    if (context === 'class' && selectedStudentId && students.length > 0) {
      const found = students.find(s => s.id === selectedStudentId);
      if (found) {
        setSelectedStudentData(found);
      }
    }
  }, [context, selectedStudentId, students]);
  
  // Reset selectedStudentData when modal closes or context changes
  useEffect(() => {
    if (!isOpen) {
      setSelectedStudentData(undefined);
    }
  }, [isOpen]);
  
  const selectedClass: ClassWithExpandedSubject | undefined = useMemo(() => {
    if (context === 'class') {
      return classData ? {
        ...classData,
        subject: classSubject,
        staff: classStaff,
        students: []
      } as ClassWithExpandedSubject
      : undefined;
    } else {
      // Use stored selectedClassData if available, otherwise try to find from classes array
      return selectedClassData || classes.find(c => c.id === selectedClassId);
    }
  }, [context, classData, classSubject, classStaff, classes, selectedClassId, selectedClassData]);

  // Get the subject to display in the student card (only the selected subject)
  const displaySubject = useMemo(() => {
    if (context === 'class') {
      return classSubject ? [classSubject] : [];
    } else {
      // For student context, prefer subjectId if provided, otherwise use selectedClass subject
      if (subjectId && studentSubjects.length > 0) {
        const subject = studentSubjects.find(s => s.id === subjectId);
        if (subject) {
          return [subject];
        }
      }
      // Fall back to selectedClass subject if available
      return selectedClass?.subject ? [selectedClass.subject] : [];
    }
  }, [context, classSubject, selectedClass, subjectId, studentSubjects]);


  // Filters
  const defaultSubjectFilters = useMemo(() => {
    if (context === 'class' && classSubject) {
      return [classSubject.id];
    }
    return [];
  }, [context, classSubject]);

  const {
    filters,
    filteredStudents,
    filteredClasses,
    availableDays,
    setSearchQuery,
    toggleDay,
    clearFilters,
    resetFilters,
  } = useEnrollmentFilters({
    context,
    students,
    classes,
    enrolledStudentIds,
    enrolledClassIds,
    subjectId,
    defaultSubjectFilters,
  });

  // Conflicts for step 3 (selected class)
  const conflicts = useEnrollmentConflicts({
    step,
    context,
    selectedStudentId,
    selectedClassId,
    enrollmentDate,
    student,
    classData,
    selectedClass,
  });

  // Conflicts for step 1 (all classes in student context)
  const classConflicts = useClassConflicts({
    studentId: context === 'student' ? student?.id : null,
    classes: filteredClasses,
    enabled: context === 'student' && step === 1 && !!student?.id,
  });

  // Flow management
  const { isEnrolling, handleConfirm, enrollmentSuccess } = useEnrollmentFlow({
    isOpen,
    context,
    classSubject,
    onEnroll,
    currentStaffId,
    student,
    classData,
    selectedStudentId,
    selectedClassId,
    enrollmentDate,
    onClose,
  });

  const hasNextStep = useMemo(() => step === 1 || step === 2, [step]);
  const isFinalStep = useMemo(() => step === 3, [step]);

  // Move to step 4 when enrollment succeeds
  useEffect(() => {
    if (enrollmentSuccess && step === 3) {
      setStep(4);
    }
  }, [enrollmentSuccess, step]);

  // Reset state when modal opens/closes or subjectId changes
  useEffect(() => {
    if (!isOpen) return;
    
    setStep(1);
    setSelectedStudentId(null);
    setSelectedClassId(null);
    setSelectedClassData(undefined);
    setEnrollmentDate('');
    resetFilters(defaultSubjectFilters);
    setWarningState({ showEnrolledWarning: false, warningStudent: null });
  }, [isOpen, resetFilters, defaultSubjectFilters, subjectId]);

  const handleNext = useCallback(() => {
    if (step === 1 && (selectedStudentId || selectedClassId)) {
      setStep(2);
    } else if (step === 2 && enrollmentDate && enrollmentDate.trim() !== '') {
      setStep(3);
    }
  }, [step, selectedStudentId, selectedClassId, enrollmentDate]);

  const handleBack = () => {
    if (step > 1) {
      setStep((step - 1) as 1 | 2);
    }
  };

  // Handle student selection with warning for already enrolled students
  const handleStudentClick = (student: StudentWithEnrollmentInfo) => {
    if (student.isAlreadyEnrolled && student.existingClassSubject) {
      setWarningState({
        showEnrolledWarning: true,
        warningStudent: { student, subject: student.existingClassSubject },
      });
    } else {
      setSelectedStudentId(student.id);
    }
  };

  // Handle warning confirmation
  const handleWarningConfirm = () => {
    if (warningState.warningStudent) {
      setSelectedStudentId(warningState.warningStudent.student.id);
      setWarningState({ showEnrolledWarning: false, warningStudent: null });
    }
  };

  const handleWarningCancel = () => {
    setWarningState({ showEnrolledWarning: false, warningStudent: null });
  };

  useDialogHotkeys({
    isOpen,
    onNextStep: handleNext,
    hasNextStep,
    onPrimaryAction: isFinalStep ? handleConfirm : undefined,
    isActionDisabled: isEnrolling,
  });

  return (
    <>
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
                    <DialogTitle>
                      {context === 'class' ? 'Enroll Student in Class' : 'Enroll Student in Class'}
                    </DialogTitle>
                    <DialogDescription>
                      Step {step} of 4: {step === 1 ? 'Select Student or Class' : step === 2 ? 'Select Enrollment Date' : step === 3 ? 'Summary & Confirm' : 'Send Message'}
                    </DialogDescription>
                  </div>
                </div>
                <ExpandButton expanded={expanded} onToggle={() => setExpanded((e) => !e)} />
              </div>
            </DialogHeader>

            {/* Progress Indicator */}
            <div className="px-6 pb-4">
              <div className="flex items-center gap-2">
                {Array.from({ length: 4 }).map((_, index) => (
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
          <div className="flex-1 overflow-hidden min-h-0">
            <div className="h-full overflow-y-auto">
              <div className="p-6">
            {/* Step 1: Select Student or Class */}
            {step === 1 && (
              <Step1SelectStudentOrClass
                context={context}
                isFetching={isFetching}
                classData={classData}
                classSubject={classSubject}
                classStaff={classStaff}
                student={student}
                studentSubjects={studentSubjects}
                filteredStudents={filteredStudents}
                filteredClasses={filteredClasses}
                availableDays={availableDays}
                selectedStudentId={selectedStudentId}
                selectedClassId={selectedClassId}
                onSelectStudent={setSelectedStudentId}
                onSelectClass={setSelectedClassId}
                searchQuery={filters.searchQuery}
                dayFilters={filters.dayFilters}
                onSearchChange={setSearchQuery}
                onToggleDay={toggleDay}
                onClearFilters={clearFilters}
                onStudentClick={handleStudentClick}
                classConflicts={classConflicts}
              />
            )}

            {/* Step 2: Select Enrollment Date */}
            {step === 2 && (
              <Step2SelectEnrollmentDate
                context={context}
                enrollmentDate={enrollmentDate}
                onDateChange={setEnrollmentDate}
                studentId={selectedStudent?.id || null}
                selectedStudent={selectedStudent}
                classData={classData}
                classSubject={classSubject}
                classStaff={classStaff}
                selectedClass={selectedClass}
              />
            )}

            {/* Step 3: Summary & Confirm */}
            {step === 3 && (
              <Step3SummaryAndConfirm
                context={context}
                selectedStudent={selectedStudent}
                selectedClass={selectedClass}
                studentSubjects={displaySubject}
                enrollmentDate={enrollmentDate}
                conflicts={conflicts}
              />
            )}

            {/* Step 4: Message Screen */}
            {step === 4 && (
              <Step4MessageScreen
                selectedStudent={selectedStudent}
                selectedClass={selectedClass}
                enrollmentDate={enrollmentDate}
              />
            )}
              </div>
            </div>
          </div>

          {/* Footer */}
          <DialogFooter className="flex-shrink-0 flex justify-between sm:justify-between px-6 py-4 border-t">
            {step === 4 ? (
              <div className="flex gap-2 ml-auto">
                <Button onClick={onClose}>
                  Done
                </Button>
              </div>
            ) : (
              <>
                <div className="flex gap-2">
                  {step > 1 && (
                    <Button variant="outline" onClick={handleBack} disabled={isEnrolling}>
                      <ChevronLeft className="h-4 w-4 mr-2" />
                      Back
                    </Button>
                  )}
                </div>
                
                <div className="flex gap-2">
                  {step < 3 ? (
                    <Button 
                      onClick={handleNext}
                      disabled={
                        (step === 1 && !selectedStudentId && !selectedClassId) ||
                        (step === 2 && (!enrollmentDate || enrollmentDate.trim() === ''))
                      }
                    >
                      Next
                      <ChevronRight className="h-4 w-4 ml-2" />
                    </Button>
                  ) : (
                    <Button onClick={handleConfirm} disabled={isEnrolling}>
                      {isEnrolling ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Enrolling...
                        </>
                      ) : (
                        'Confirm Enrollment'
                      )}
                    </Button>
                  )}
                </div>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Warning Dialog for Already Enrolled Student */}
      <AlertDialog open={warningState.showEnrolledWarning} onOpenChange={(open) => {
        if (!open) handleWarningCancel();
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Student Already Enrolled</AlertDialogTitle>
            <AlertDialogDescription>
              {warningState.warningStudent && (
                <p>
                  This student is already enrolled in a class for {warningState.warningStudent.subject?.long_name ?? ''}. Do you want to proceed?
                </p>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleWarningCancel}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleWarningConfirm}>Proceed</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

