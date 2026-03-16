import { useState, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@altitutor/ui';
import { createStaffInterview } from '../api/staff-interview';
import { sessionsKeys } from '@/features/sessions/hooks/useSessionsQuery';
import { staffKeys } from '@/features/staff/hooks/useStaffQuery';
import { getErrorMessage } from '@/shared/utils';
import { showSessionBookedToast } from '@/shared/utils/toastHelpers';

const STAFF_INTERVIEW_STEPS = [
  { id: 'interviewee', title: 'Select Candidate' },
  { id: 'time', title: 'Select Time' },
  { id: 'interviewer', title: 'Select Interviewer' },
  { id: 'confirm', title: 'Confirm Booking' },
];

const DEFAULT_DURATION_MINUTES = 45;

function getDefaultStartEnd(): { startAt: string; endAt: string } {
  const now = new Date();
  const start = new Date(now);
  start.setMinutes(start.getMinutes() + 30);
  start.setSeconds(0, 0);
  const end = new Date(start.getTime() + DEFAULT_DURATION_MINUTES * 60 * 1000);
  return {
    startAt: start.toISOString(),
    endAt: end.toISOString(),
  };
}

export function useStaffInterviewBookingFlow({
  isOpen: _isOpen,
  onBookingCreated,
  onClose,
}: {
  isOpen: boolean;
  onBookingCreated?: (sessionId: string) => void;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [currentStep, setCurrentStep] = useState(0);
  const [staffSearch, setStaffSearch] = useState('');
  const [selectedIntervieweeId, setSelectedIntervieweeId] = useState('');
  const [isCreatingStaff, setIsCreatingStaff] = useState(false);
  const [startAt, setStartAt] = useState('');
  const [endAt, setEndAt] = useState('');
  const [interviewerSearch, setInterviewerSearch] = useState('');
  const [selectedInterviewerId, setSelectedInterviewerId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdSessionId, setCreatedSessionId] = useState<string | null>(null);

  const steps = STAFF_INTERVIEW_STEPS;
  const currentStepData = steps[currentStep];
  const currentStepId = currentStepData?.id;

  const createMutation = useMutation({
    mutationFn: createStaffInterview,
    onSuccess: (sessionId) => {
      queryClient.invalidateQueries({ queryKey: sessionsKeys.all });
      queryClient.invalidateQueries({ queryKey: staffKeys.all });
      showSessionBookedToast({
        toast,
        sessionId,
        message: 'Staff interview has been booked successfully',
      });
      setCreatedSessionId(sessionId);
    },
    onError: (error) => {
      toast({
        title: 'Booking Failed',
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    },
  });

  const effectiveStartAt = startAt || getDefaultStartEnd().startAt;
  const effectiveEndAt = endAt || getDefaultStartEnd().endAt;

  const canGoNext = useCallback(() => {
    switch (currentStepId) {
      case 'interviewee':
        return !!selectedIntervieweeId;
      case 'time':
        return !!effectiveStartAt && !!effectiveEndAt;
      case 'interviewer':
        return !!selectedInterviewerId;
      case 'confirm':
        return true;
      default:
        return false;
    }
  }, [currentStepId, selectedIntervieweeId, effectiveStartAt, effectiveEndAt, selectedInterviewerId]);

  const handleNext = useCallback(() => {
    if (!canGoNext() && currentStepId !== 'confirm') {
      toast({
        title: 'Validation Error',
        description:
          currentStepId === 'interviewee'
            ? 'Please select or create a staff candidate'
            : currentStepId === 'time'
              ? 'Please set the date and time'
              : 'Please select the interviewer',
        variant: 'destructive',
      });
      return;
    }

    if (currentStepId === 'time' && !startAt) {
      const { startAt: s, endAt: e } = getDefaultStartEnd();
      setStartAt(s);
      setEndAt(e);
    }

    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  }, [canGoNext, currentStep, currentStepId, startAt, steps.length, toast]);

  const handleBack = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  }, [currentStep]);

  const handleConfirmBooking = useCallback(async () => {
    if (!selectedIntervieweeId || !selectedInterviewerId || !effectiveStartAt || !effectiveEndAt) {
      toast({
        title: 'Missing Information',
        description: 'Please complete all steps',
        variant: 'destructive',
      });
      return;
    }

    if (selectedIntervieweeId === selectedInterviewerId) {
      toast({
        title: 'Invalid Selection',
        description: 'Interviewee and interviewer must be different',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      await createMutation.mutateAsync({
        interviewee_staff_id: selectedIntervieweeId,
        interviewer_staff_id: selectedInterviewerId,
        start_at: effectiveStartAt,
        end_at: effectiveEndAt,
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [
    selectedIntervieweeId,
    selectedInterviewerId,
    effectiveStartAt,
    effectiveEndAt,
    createMutation,
    toast,
  ]);

  const handleClose = useCallback(() => {
    if (!isSubmitting && !createMutation.isPending) {
      setCurrentStep(0);
      setStaffSearch('');
      setSelectedIntervieweeId('');
      setIsCreatingStaff(false);
      setStartAt('');
      setEndAt('');
      setInterviewerSearch('');
      setSelectedInterviewerId('');
      setCreatedSessionId(null);
      onClose();
    }
  }, [isSubmitting, createMutation.isPending, onClose]);

  const handleDoneMessageStep = useCallback(
    (sessionId: string) => {
      setCreatedSessionId(null);
      onBookingCreated?.(sessionId);
      onClose();
    },
    [onBookingCreated, onClose]
  );

  const handleIntervieweeCreated = useCallback((staffId: string) => {
    setSelectedIntervieweeId(staffId);
  }, []);

  const handleStartAtChange = useCallback((value: string) => {
    setStartAt(value);
  }, []);

  const handleEndAtChange = useCallback((value: string) => {
    setEndAt(value);
  }, []);

  return {
    currentStep,
    steps,
    currentStepData,
    currentStepId,
    createdSessionId,
    handleDoneMessageStep,
    staffSearch,
    setStaffSearch,
    selectedIntervieweeId,
    setSelectedIntervieweeId,
    isCreatingStaff,
    setIsCreatingStaff,
    startAt: effectiveStartAt,
    endAt: effectiveEndAt,
    setStartAt,
    setEndAt,
    handleStartAtChange,
    handleEndAtChange,
    interviewerSearch,
    setInterviewerSearch,
    selectedInterviewerId,
    setSelectedInterviewerId,
    isSubmitting: isSubmitting || createMutation.isPending,
    canGoNext,
    handleNext,
    handleBack,
    handleConfirmBooking,
    handleClose,
    handleIntervieweeCreated,
  };
}
