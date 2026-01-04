import { useState, useEffect } from 'react';
import type { Tables, ClassWithExpandedSubject } from '@altitutor/shared';
import { getEnrollmentConflicts, getMidnightAdelaide } from '@/shared/utils/enrollment';
import { formatSubjectDisplay } from '@/shared/utils';
import { studentsApi } from '@/features/students/api';
import type { EnrollmentContext, EnrollmentConflicts } from '../types/enrollment';

interface UseEnrollmentConflictsProps {
  step: 1 | 2 | 3;
  context: EnrollmentContext;
  selectedStudentId: string | null;
  selectedClassId: string | null;
  enrollmentDate: string;
  student: Tables<'students'> | undefined;
  classData: Tables<'classes'> | undefined;
  selectedClass: ClassWithExpandedSubject | undefined;
}

export function useEnrollmentConflicts({
  step,
  context,
  selectedStudentId,
  selectedClassId,
  enrollmentDate,
  student,
  classData,
  selectedClass,
}: UseEnrollmentConflictsProps) {
  const [conflicts, setConflicts] = useState<EnrollmentConflicts>({
    sameSubjectWarning: null,
    timeOverlapWarnings: [],
  });

  useEffect(() => {
    if (step === 3 && selectedStudentId && selectedClassId && selectedClass) {
      const finalStudentId = context === 'student' ? student!.id : selectedStudentId;
      const finalClassId = context === 'class' ? classData!.id : selectedClassId;
      
      let duplicateSubjectWarning: string | null = null;
      let cancelled = false;
      
      // Check for duplicate subject enrollment (student context)
      const checkDuplicateSubject = async () => {
        if (cancelled) return;
        
        if (context === 'student' && selectedClass && student) {
          const selectedClassSubjectId = selectedClass.subject_id;
          if (selectedClassSubjectId && selectedClass.subject) {
            try {
              const { studentClasses } = await studentsApi.getDetailsForStudentIds([student.id]);
              const enrolledClasses = studentClasses[student.id] || [];
              const hasClassWithSameSubject = enrolledClasses.some(c => c.subject_id === selectedClassSubjectId);
              
              if (hasClassWithSameSubject && !cancelled) {
                const existingClass = enrolledClasses.find(c => c.subject_id === selectedClassSubjectId);
                if (existingClass?.subject) {
                  const subjectDisplay = formatSubjectDisplay(existingClass.subject);
                  duplicateSubjectWarning = `${student.first_name} ${student.last_name} is already enrolled in a ${subjectDisplay} class. Do you want to proceed?`;
                }
              }
            } catch (error) {
              if (!cancelled) {
                console.error('Error checking duplicate subject enrollment:', error);
              }
            }
          }
        }
        
        if (cancelled) return;
        
        // Check for other conflicts
        const conflictData = await getEnrollmentConflicts(
          finalStudentId,
          finalClassId,
          getMidnightAdelaide(new Date(enrollmentDate))
        );
        
        if (!cancelled) {
          // Merge all warnings
          setConflicts({
            sameSubjectWarning: duplicateSubjectWarning || conflictData.sameSubjectWarning,
            timeOverlapWarnings: conflictData.timeOverlapWarnings || [],
          });
        }
      };
      
      checkDuplicateSubject();
      
      return () => {
        cancelled = true;
      };
    } else if (step !== 3) {
      // Reset conflicts when not on step 3
      setConflicts({ sameSubjectWarning: null, timeOverlapWarnings: [] });
    }
  }, [step, selectedStudentId, selectedClassId, enrollmentDate, context, student, classData, selectedClass]);

  return conflicts;
}

