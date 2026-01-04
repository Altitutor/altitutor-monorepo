'use client';

import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@altitutor/ui';
import { Button } from '@altitutor/ui';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@altitutor/ui';
import { Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import type { Tables, ClassWithExpandedSubject } from '@altitutor/shared';
import { formatSubjectDisplay } from '@/shared/utils';
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
} from './steps';
import type { EnrollStudentModalProps, EnrollmentWarningState, StudentWithEnrollmentInfo } from '../types/enrollment';

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
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [enrollmentDate, setEnrollmentDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  
  // Warning state for greyed out student selection
  const [warningState, setWarningState] = useState<EnrollmentWarningState>({
    showEnrolledWarning: false,
    warningStudent: null,
  });

  // Fetch data
  const { students, classes, isFetching } = useEnrollmentData({
    isOpen,
    step,
    context,
    onFetchStudents,
    onFetchClasses,
  });

  // Get selected data for display
  const selectedStudent = context === 'student' 
    ? student 
    : students.find(s => s.id === selectedStudentId);
  
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
      return classes.find(c => c.id === selectedClassId);
    }
  }, [context, classData, classSubject, classStaff, classes, selectedClassId]);

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
  const { isEnrolling, handleConfirm } = useEnrollmentFlow({
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

  // Reset state when modal opens/closes
  useEffect(() => {
    if (!isOpen) return;
    
    setStep(1);
    setSelectedStudentId(null);
    setSelectedClassId(null);
    setEnrollmentDate(new Date().toISOString().split('T')[0]);
    resetFilters(defaultSubjectFilters);
    setWarningState({ showEnrolledWarning: false, warningStudent: null });
  }, [isOpen, resetFilters, defaultSubjectFilters]);

  const handleNext = () => {
    if (step === 1 && (selectedStudentId || selectedClassId)) {
      setStep(2);
    } else if (step === 2) {
      setStep(3);
    }
  };

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

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="w-full md:max-w-4xl h-[90vh] flex flex-col p-0">
          <DialogHeader className="flex-shrink-0 px-6 py-4 border-b">
            <DialogTitle>
              {context === 'class' ? 'Enroll Student in Class' : 'Enroll Student in Class'}
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto min-h-0 px-6 py-4">
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
                classData={classData}
                classSubject={classSubject}
                classStaff={classStaff}
                selectedStudent={selectedStudent}
                student={student}
                studentSubjects={studentSubjects}
                selectedClass={selectedClass}
              />
            )}

            {/* Step 3: Summary & Confirm */}
            {step === 3 && (
              <Step3SummaryAndConfirm
                context={context}
                selectedStudent={selectedStudent}
                selectedClass={selectedClass}
                studentSubjects={studentSubjects}
                enrollmentDate={enrollmentDate}
                conflicts={conflicts}
              />
            )}
          </div>

          <DialogFooter className="flex-shrink-0 flex justify-between sm:justify-between px-6 py-4 border-t">
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
                  disabled={step === 1 && !selectedStudentId && !selectedClassId}
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
                  This student is already enrolled in a class for {formatSubjectDisplay(warningState.warningStudent.subject)}. Do you want to proceed?
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

