import { useState, useEffect, useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useToast } from '@altitutor/ui';
import { format } from 'date-fns';
import type { UseFormReturn } from 'react-hook-form';
import type { Tables } from '@altitutor/shared';
import { studentsApi } from '@/features/students/api/students';
import { subjectsApi } from '@/features/subjects/api/subjects';
import { useCreateStudent } from '@/features/students/hooks/useStudentsQuery';
import { useCreateBooking } from './useCreateBooking';
import { useSessionsWithDetails } from '@/features/sessions/hooks/useSessionsQuery';
import { useStudentSubjects } from './useStudentSubjects';
import { useStaffById } from '@/features/staff/hooks/useStaffQuery';
import type { AdminTrialContactFormValues } from '../components/AdminTrialContactForm';
import { getBookingSteps, canProceedToNextStep, getSessionTypeLabel } from '../utils/bookingHelpers';
import { isSlotInPast } from '../utils/dateTimeHelpers';

export interface BookSessionFlowState {
  currentStep: number;
  studentSearch: string;
  selectedStudentId: string;
  selectedSubjectId: string;
  selectedSlot: { startAt: string; endAt: string; availableStaffIds: string[] } | null;
  selectedStaffId: string;
  trialContactData: AdminTrialContactFormValues | null;
  trialContactFormRef: UseFormReturn<AdminTrialContactFormValues> | null;
  trialFormValid: boolean;
  showPastDateWarning: boolean;
  pendingNextStep: boolean;
  isSubmitting: boolean;
}

export interface UseBookSessionFlowProps {
  isOpen: boolean;
  sessionType: 'DRAFTING' | 'TRIAL_SESSION' | 'SUBSIDY_INTERVIEW';
  initialStudentId?: string;
  originalSessionId?: string | null;
  originalSubjectId?: string | null;
  onBookingCreated?: (sessionId: string) => void;
  onClose: () => void;
}

export function useBookSessionFlow({
  isOpen,
  sessionType,
  initialStudentId,
  originalSessionId,
  originalSubjectId,
  onBookingCreated,
  onClose,
}: UseBookSessionFlowProps) {
  const { toast } = useToast();
  const createBooking = useCreateBooking();
  const createStudent = useCreateStudent();

  // State management
  const [currentStep, setCurrentStep] = useState(0);
  const [studentSearch, setStudentSearch] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');
  const [selectedSlot, setSelectedSlot] = useState<{ startAt: string; endAt: string; availableStaffIds: string[] } | null>(null);
  const [selectedStaffId, setSelectedStaffId] = useState<string>('');
  const [trialContactData, setTrialContactData] = useState<AdminTrialContactFormValues | null>(null);
  const [trialContactFormRef, setTrialContactFormRef] = useState<UseFormReturn<AdminTrialContactFormValues> | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [trialFormValid, setTrialFormValid] = useState(false);
  const [showPastDateWarning, setShowPastDateWarning] = useState(false);
  const [pendingNextStep, setPendingNextStep] = useState(false);

  // Calculate steps
  const steps = useMemo(() => getBookingSteps(sessionType, originalSessionId), [sessionType, originalSessionId]);
  const currentStepData = steps[currentStep];
  const currentStepId = currentStepData?.id;

  // Initialize with initialStudentId if provided
  useEffect(() => {
    if (isOpen && initialStudentId && !selectedStudentId) {
      setSelectedStudentId(initialStudentId);
      // For DRAFTING sessions, advance to step 1 (time slot selection) since student is pre-selected
      if (sessionType === 'DRAFTING') {
        setCurrentStep(1);
      }
    }
  }, [isOpen, initialStudentId, sessionType, selectedStudentId]);

  // Search students - filter by status for drafting sessions (only active students)
  const { data: studentsData, isLoading: studentsLoading } = useQuery({
    queryKey: ['students', 'search', studentSearch, sessionType],
    queryFn: async () => {
      // For drafting sessions, only show active students (status = 'ACTIVE')
      const statuses = sessionType === 'DRAFTING' ? (['ACTIVE'] as Tables<'students'>['status'][]) : undefined;
      const result = await studentsApi.searchStudents(studentSearch, statuses);
      return result;
    },
    enabled: isOpen && studentSearch.length >= 2,
  });

  // Get all subjects
  const { data: subjects } = useQuery({
    queryKey: ['subjects'],
    queryFn: () => subjectsApi.getAllSubjects(),
    enabled: isOpen,
  });

  // Auto-select subject from original session when rescheduling
  useEffect(() => {
    if (isOpen && originalSubjectId && subjects && sessionType === 'DRAFTING' && !selectedSubjectId) {
      // Verify the subject exists in available subjects
      const subjectExists = subjects.some(s => s.id === originalSubjectId);
      if (subjectExists) {
        setSelectedSubjectId(originalSubjectId);
        // Auto-advance to time selection step if subject is pre-selected
        if (selectedStudentId) {
          setCurrentStep(1);
        }
      }
    }
  }, [isOpen, originalSubjectId, subjects, sessionType, selectedSubjectId, selectedStudentId]);

  // Get student's subjects if student selected
  const { data: studentSubjects } = useStudentSubjects(
    selectedStudentId,
    isOpen && !!selectedStudentId && sessionType === 'DRAFTING'
  );

  // Get sessions for calendar view (single day of selected slot)
  const sessionDate = useMemo(() => {
    if (!selectedSlot) return new Date();
    const date = new Date(selectedSlot.startAt);
    // Set to start of day
    date.setHours(0, 0, 0, 0);
    return date;
  }, [selectedSlot]);

  const dayStart = useMemo(() => sessionDate, [sessionDate]);

  const dayEnd = useMemo(() => {
    const end = new Date(sessionDate);
    end.setHours(23, 59, 59, 999);
    return end;
  }, [sessionDate]);

  const { data: sessionsData } = useSessionsWithDetails({
    rangeStart: format(dayStart, 'yyyy-MM-dd'),
    rangeEnd: format(dayEnd, 'yyyy-MM-dd'),
    includeInactive: false,
  });

  // Get selected staff data for new session preview
  const { data: selectedStaff } = useStaffById(selectedStaffId || '');

  // Get selected student data for new session preview
  const selectedStudent = useMemo(() => {
    if (selectedStudentId && studentsData) {
      return studentsData.find((s) => s.id === selectedStudentId);
    }
    if (trialContactData) {
      // Return a mock student object for preview
      return {
        id: 'new-student-preview',
        first_name: trialContactData.student_first_name,
        last_name: trialContactData.student_last_name,
        email: trialContactData.student_email,
        phone: trialContactData.student_phone,
        curriculum: trialContactData.curriculum,
        year_level: trialContactData.year_level ? (trialContactData.year_level === 'Reception' ? 0 : parseInt(trialContactData.year_level, 10)) : null,
        status: 'TRIAL' as const,
        created_at: null,
        created_by: null,
        invite_token: null,
        updated_at: null,
        user_id: null,
        school: null,
      } as Tables<'students'>;
    }
    return null;
  }, [selectedStudentId, studentsData, trialContactData]);

  // Reset state when modal closes
  const handleClose = useCallback(() => {
    if (!isSubmitting) {
      setCurrentStep(0);
      setStudentSearch('');
      setSelectedStudentId('');
      setSelectedSubjectId('');
      setSelectedSlot(null);
      setSelectedStaffId('');
      setTrialContactData(null);
      setTrialContactFormRef(null);
      setTrialFormValid(false);
      setShowPastDateWarning(false);
      setPendingNextStep(false);
      onClose();
    }
  }, [isSubmitting, onClose]);

  const handleSlotSelect = useCallback((startAt: string, endAt: string, availableStaffIds: string[]) => {
    setSelectedSlot({ startAt, endAt, availableStaffIds });
    // Auto-select staff if only one available
    if (availableStaffIds.length === 1) {
      setSelectedStaffId(availableStaffIds[0]);
    }
  }, []);

  const handleTrialContactSubmit = useCallback((data: AdminTrialContactFormValues) => {
    setTrialContactData(data);
  }, []);

  const canGoNext = useCallback(() => {
    return canProceedToNextStep(currentStepId || '', sessionType, {
      selectedStudentId,
      selectedSubjectId,
      selectedSlot,
      selectedStaffId,
      trialFormValid,
    });
  }, [currentStepId, sessionType, selectedStudentId, selectedSubjectId, selectedSlot, selectedStaffId, trialFormValid]);

  const handleNext = useCallback(async () => {
    // For trial-contact step, validate form and show errors if invalid
    if (currentStepId === 'trial-contact' && trialContactFormRef) {
      // Trigger validation only on required fields
      const isValid = await trialContactFormRef.trigger(['student_first_name', 'student_last_name', 'student_phone']);
      if (!isValid) {
        // Form is invalid - errors will be shown on individual fields via FormMessage
        // Also show a toast with summary
        const errors = trialContactFormRef.formState.errors;
        const errorMessages: string[] = [];
        
        if (errors.student_first_name) {
          errorMessages.push('Student first name is required');
        }
        if (errors.student_last_name) {
          errorMessages.push('Student last name is required');
        }
        if (errors.student_phone) {
          errorMessages.push('Student phone number is required');
        }
        
        if (errorMessages.length > 0) {
          toast({
            title: 'Please fix the following errors',
            description: errorMessages.join(', '),
            variant: 'destructive',
          });
        }
        return; // Don't proceed if form is invalid
      }
      // Form is valid, save data
      const formValues = trialContactFormRef.getValues();
      setTrialContactData(formValues);
    }

    // Check if we can proceed
    if (!canGoNext()) {
      // Show validation errors for current step
      if (currentStepId === 'student') {
        toast({
          title: 'Validation Error',
          description: 'Please select a student',
          variant: 'destructive',
        });
      } else if (currentStepId === 'subject' && sessionType === 'DRAFTING') {
        toast({
          title: 'Validation Error',
          description: 'Please select a subject for drafting sessions',
          variant: 'destructive',
        });
      } else if (currentStepId === 'time') {
        toast({
          title: 'Validation Error',
          description: 'Please select a time slot',
          variant: 'destructive',
        });
      } else if (currentStepId === 'staff') {
        toast({
          title: 'Validation Error',
          description: 'Please select a staff member',
          variant: 'destructive',
        });
      }
      return;
    }

    // Check if moving from 'time' step and slot is in the past
    if (currentStepId === 'time' && selectedSlot && isSlotInPast(selectedSlot.startAt)) {
      setShowPastDateWarning(true);
      setPendingNextStep(true);
      return;
    }

    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  }, [currentStepId, trialContactFormRef, canGoNext, currentStep, steps.length, selectedSlot, sessionType, toast]);

  const handleBack = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  }, [currentStep]);

  const proceedWithBooking = useCallback(async () => {
    if (!selectedSlot || !selectedStaffId) {
      return;
    }

    let finalStudentId = selectedStudentId;

    // For trial sessions, create student if needed
    if (sessionType === 'TRIAL_SESSION' && !selectedStudentId && trialContactData) {
      try {
        setIsSubmitting(true);
        // Create student - using explicit type for Supabase insert
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const studentData: any = {
          id: crypto.randomUUID(),
          first_name: trialContactData.student_first_name,
          last_name: trialContactData.student_last_name,
          email: trialContactData.student_email || null,
          phone: trialContactData.student_phone,
          curriculum: trialContactData.curriculum || null,
          year_level: trialContactData.year_level ? (trialContactData.year_level === 'Reception' ? 0 : parseInt(trialContactData.year_level, 10)) : null,
          status: 'TRIAL',
          created_at: null,
          created_by: null,
          invite_token: null,
          updated_at: null,
          user_id: null,
          school: null,
        };

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const createdStudent = await createStudent.mutateAsync(studentData as any);

        // Assign subjects if provided
        if (trialContactData.subject_ids && trialContactData.subject_ids.length > 0) {
          await Promise.all(
            trialContactData.subject_ids.map((subjectId) =>
              studentsApi.assignSubjectToStudent(createdStudent.id, subjectId)
            )
          );
        }

        finalStudentId = createdStudent.id;
      } catch (error: unknown) {
        toast({
          title: 'Failed to Create Student',
          description: error instanceof Error ? error.message : 'Failed to create student. Please try again.',
          variant: 'destructive',
        });
        setIsSubmitting(false);
        return;
      }
    }

    if (!finalStudentId) {
      toast({
        title: 'Missing Information',
        description: 'Please select a student',
        variant: 'destructive',
      });
      setIsSubmitting(false);
      return;
    }

    if (sessionType === 'DRAFTING' && !selectedSubjectId) {
      toast({
        title: 'Missing Information',
        description: 'Please select a subject for drafting sessions',
        variant: 'destructive',
      });
      setIsSubmitting(false);
      return;
    }

    try {
      const sessionId = await createBooking.mutateAsync({
        session_type: sessionType,
        student_id: finalStudentId,
        start_at: selectedSlot.startAt,
        end_at: selectedSlot.endAt,
        subject_id: selectedSubjectId || undefined,
        staff_id: selectedStaffId,
        original_session_id: originalSessionId || undefined,
      });

      toast({
        title: originalSessionId ? 'Session Rescheduled' : 'Booking Created',
        description: `${originalSessionId ? 'Session has been rescheduled' : `${getSessionTypeLabel(sessionType)} has been booked successfully`}`,
      });

      onBookingCreated?.(sessionId);
      handleClose();
    } catch (error: unknown) {
      toast({
        title: 'Booking Failed',
        description: error instanceof Error ? error.message : 'Failed to create booking. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [
    selectedSlot,
    selectedStaffId,
    selectedStudentId,
    sessionType,
    trialContactData,
    selectedSubjectId,
    originalSessionId,
    createStudent,
    createBooking,
    onBookingCreated,
    handleClose,
    toast,
  ]);

  const handlePastDateWarningConfirm = useCallback(async () => {
    setShowPastDateWarning(false);
    if (pendingNextStep && currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
      setPendingNextStep(false);
    } else {
      // This was triggered from final confirmation, proceed with booking
      setPendingNextStep(false);
      await proceedWithBooking();
    }
  }, [pendingNextStep, currentStep, steps.length, proceedWithBooking]);

  const handlePastDateWarningCancel = useCallback(() => {
    setShowPastDateWarning(false);
    setPendingNextStep(false);
  }, []);

  const handleConfirmBooking = useCallback(async () => {
    if (!selectedSlot || !selectedStaffId) {
      toast({
        title: 'Missing Information',
        description: 'Please select a time slot and staff member',
        variant: 'destructive',
      });
      return;
    }

    // Check if slot is in the past and show warning
    if (isSlotInPast(selectedSlot.startAt)) {
      setShowPastDateWarning(true);
      setPendingNextStep(false); // This is final confirmation, not next step
      return;
    }

    // Proceed with booking if not in past or after warning confirmation
    await proceedWithBooking();
  }, [selectedSlot, selectedStaffId, proceedWithBooking, toast]);

  return {
    // State
    currentStep,
    studentSearch,
    selectedStudentId,
    selectedSubjectId,
    selectedSlot,
    selectedStaffId,
    trialContactData,
    trialContactFormRef,
    trialFormValid,
    showPastDateWarning,
    pendingNextStep,
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
    handleSlotSelect,
    handleTrialContactSubmit,
    handleNext,
    handleBack,
    handleConfirmBooking,
    handleClose,
    handlePastDateWarningConfirm,
    handlePastDateWarningCancel,
    canGoNext,
  };
}
