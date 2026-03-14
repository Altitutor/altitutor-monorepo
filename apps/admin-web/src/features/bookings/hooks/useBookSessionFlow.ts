import { useState, useEffect, useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useToast } from '@altitutor/ui';
import { format } from 'date-fns';
import type { UseFormReturn } from 'react-hook-form';
import type { Tables } from '@altitutor/shared';
import { subjectsApi } from '@/features/subjects/api/subjects';
import { studentsApi } from '@/features/students/api/students';
import { useCreateBooking } from './useCreateBooking';
import { useSessionsWithDetails } from '@/features/sessions/hooks/useSessionsQuery';
import { useStudentSubjects } from './useStudentSubjects';
import { useStaffById } from '@/features/staff/hooks/useStaffQuery';
import type { AdminTrialContactFormValues } from '../components/AdminTrialContactForm';
import { getBookingSteps, canProceedToNextStep, getSessionTypeLabel } from '../utils/bookingHelpers';
import { getErrorMessage } from '@/shared/utils';
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

  // Initialize with initialStudentId if provided (for rescheduling)
  useEffect(() => {
    if (!isOpen) {
      // Reset state when modal closes
      return;
    }

    if (originalSessionId && initialStudentId) {
      // When rescheduling, pre-fill student and skip to appropriate step
      setSelectedStudentId(initialStudentId);
      
      // Calculate starting step based on session type and what's pre-filled
      let startingStep = 0;
      
      if (sessionType === 'TRIAL_SESSION') {
        // For trial sessions, skip trial-contact form and go straight to time selection
        // Steps: trial-contact (0) -> time (1) -> staff (2) -> confirm (3)
        startingStep = 1; // Skip to time selection
      } else if (sessionType === 'DRAFTING') {
        // For drafting, skip student (0) and subject (1), go to time (2)
        // Steps: student (0) -> subject (1) -> time (2) -> staff (3) -> confirm (4)
        if (originalSubjectId) {
          setSelectedSubjectId(originalSubjectId);
          startingStep = 2; // Skip to time selection (student and subject are pre-filled)
        } else {
          startingStep = 1; // Skip to subject selection (student is pre-filled)
        }
      } else if (sessionType === 'SUBSIDY_INTERVIEW') {
        // For subsidy interview, skip student (0), go to time (1)
        // Steps: student (0) -> time (1) -> staff (2) -> confirm (3)
        startingStep = 1; // Skip to time selection
      }
      
      setCurrentStep(startingStep);
    } else if (initialStudentId && !originalSessionId) {
      // Regular booking flow (not rescheduling)
      setSelectedStudentId(initialStudentId);
      // For DRAFTING sessions, advance to step 1 (subject selection) since student is pre-selected
      if (sessionType === 'DRAFTING') {
        setCurrentStep(1);
      }
    }
  }, [isOpen, initialStudentId, originalSessionId, sessionType, originalSubjectId]);

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

  // Auto-select subject from original session when rescheduling (handled in the main useEffect above)

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
      return studentsData.find((s: Tables<'students'>) => s.id === selectedStudentId);
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

    // For trial sessions with new student, use database function (handles everything atomically)
    if (sessionType === 'TRIAL_SESSION' && !selectedStudentId && trialContactData) {
      if (!trialContactData.student_first_name || !trialContactData.student_last_name || !trialContactData.student_phone) {
        toast({
          title: 'Missing Information',
          description: 'Please fill in all required student fields',
          variant: 'destructive',
        });
        setIsSubmitting(false);
        return;
      }

      try {
        setIsSubmitting(true);
        
        const yearLevel = trialContactData.year_level 
          ? (trialContactData.year_level === 'Reception' ? 0 : parseInt(trialContactData.year_level, 10))
          : null;

        const sessionId = await createBooking.mutateAsync({
          session_type: sessionType,
          start_at: selectedSlot.startAt,
          end_at: selectedSlot.endAt,
          staff_id: selectedStaffId,
          trial_student_data: {
            student_first_name: trialContactData.student_first_name,
            student_last_name: trialContactData.student_last_name,
            student_phone: trialContactData.student_phone,
            student_email: trialContactData.student_email || undefined,
            curriculum: trialContactData.curriculum || undefined,
            year_level: yearLevel || undefined,
            subject_ids: trialContactData.subject_ids || undefined,
          },
          trial_parent_data: {
            skip_parent_details: trialContactData.skip_parent_details,
            parent_first_name: trialContactData.parent_first_name || undefined,
            parent_last_name: trialContactData.parent_last_name || undefined,
            parent_email: trialContactData.parent_email || undefined,
            parent_phone: trialContactData.parent_phone || undefined,
          },
        });

        toast({
          title: 'Booking Created',
          description: `${getSessionTypeLabel(sessionType)} has been booked successfully`,
        });

        onBookingCreated?.(sessionId);
        handleClose();
      } catch (error: unknown) {
        toast({
          title: 'Booking Failed',
          description: getErrorMessage(error),
          variant: 'destructive',
        });
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    // For existing students or other session types, use regular flow
    if (!selectedStudentId) {
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
      setIsSubmitting(true);
      const sessionId = await createBooking.mutateAsync({
        session_type: sessionType,
        student_id: selectedStudentId,
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
        description: getErrorMessage(error),
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
