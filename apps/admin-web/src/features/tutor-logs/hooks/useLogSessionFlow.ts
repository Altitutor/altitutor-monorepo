import { useState, useEffect, useCallback, useMemo } from 'react';
import type { Tables } from '@altitutor/shared';
import type { TutorLogFormData } from '../types';
import { useCreateTutorLog } from './useTutorLogsQuery';
import { useSessionForLogging } from './useSessionForLogging';
import { useStaffById } from '@/features/staff/hooks/useStaffQuery';
import { sessionsApi } from '@/features/sessions/api/sessions';
import {
  getLogSessionTotalSteps,
  calculateInitialStep,
  canProceedToNextLogStep,
} from '../utils/logSessionHelpers';

export type SubmissionState = 'idle' | 'submitting' | 'success' | 'error';

export interface UseLogSessionFlowProps {
  isOpen: boolean;
  onClose: () => void;
  currentStaffId: string;
  adminMode?: boolean;
  initialSessionId?: string;
  initialStaffId?: string;
}

export interface UseLogSessionFlowReturn {
  // State
  currentStep: number;
  selectedStaffId: string;
  formData: Partial<TutorLogFormData>;
  submissionState: SubmissionState;
  submissionError: string | null;
  totalSteps: number;

  // Data
  selectedStaff: Tables<'staff'> | null;
  selectedSession: Tables<'sessions'> | null;
  sessionClassData: Tables<'classes'> | null;
  sessionSubject: Tables<'subjects'> | null;
  sessionStaff: Tables<'staff'>[];
  sessionStudents: Tables<'students'>[];

  // Actions
  setSelectedStaffId: (staffId: string) => void;
  updateFormData: (updates: Partial<TutorLogFormData>) => void;
  handleNext: () => void;
  handlePrevious: () => void;
  handleSubmit: () => Promise<void>;
  handleClose: () => void;
  handleTryAgain: () => void;
  handleAddStaffToSession: (staffId: string) => Promise<void>;
  canGoNext: boolean;
}

export function useLogSessionFlow({
  isOpen,
  onClose,
  currentStaffId,
  adminMode = false,
  initialSessionId,
  initialStaffId,
}: UseLogSessionFlowProps): UseLogSessionFlowReturn {
  const createMutation = useCreateTutorLog();

  // Calculate initial step
  const initialStep = useMemo(
    () => calculateInitialStep(adminMode, initialSessionId, initialStaffId),
    [adminMode, initialSessionId, initialStaffId]
  );

  // State management
  const [currentStep, setCurrentStep] = useState(initialStep);
  const [selectedStaffId, setSelectedStaffId] = useState<string>(
    initialStaffId || currentStaffId
  );
  const [formData, setFormData] = useState<Partial<TutorLogFormData>>(
    initialSessionId ? { sessionId: initialSessionId } : {}
  );
  const [submissionState, setSubmissionState] = useState<SubmissionState>('idle');
  const [submissionError, setSubmissionError] = useState<string | null>(null);

  // Calculate total steps
  const totalSteps = useMemo(
    () => getLogSessionTotalSteps(adminMode),
    [adminMode]
  );

  // Fetch selected staff data
  const { data: selectedStaff } = useStaffById(selectedStaffId);

  // Fetch selected session data
  const { data: sessionData } = useSessionForLogging(formData.sessionId);

  // Extract session data
  const selectedSession = sessionData?.session || null;
  const sessionClassData = sessionData?.classData || null;
  const sessionSubject = sessionData?.subject || null;
  const sessionStaff = sessionData?.staff || [];
  const sessionStudents = sessionData?.students || [];

  // Initialize form data when modal opens with initial values
  useEffect(() => {
    if (isOpen) {
      // Set initial values
      if (initialSessionId) {
        setFormData((prev) => ({ ...prev, sessionId: initialSessionId }));
      }
      if (initialStaffId) {
        setSelectedStaffId(initialStaffId);
      }
      // Set the step based on what's pre-selected
      const targetStep = calculateInitialStep(
        adminMode,
        initialSessionId,
        initialStaffId
      );
      setCurrentStep(targetStep);
    }
  }, [isOpen, initialSessionId, initialStaffId, adminMode]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setCurrentStep(initialStep);
      setSelectedStaffId(initialStaffId || currentStaffId);
      setFormData(initialSessionId ? { sessionId: initialSessionId } : {});
      setSubmissionState('idle');
      setSubmissionError(null);
    }
  }, [
    isOpen,
    currentStaffId,
    initialSessionId,
    initialStaffId,
    initialStep,
  ]);

  // Update form data helper
  const updateFormData = useCallback((updates: Partial<TutorLogFormData>) => {
    setFormData((prev) => ({ ...prev, ...updates }));
  }, []);

  // Navigation handlers
  const handleNext = useCallback(() => {
    if (currentStep < totalSteps - 1) {
      setCurrentStep(currentStep + 1);
    }
  }, [currentStep, totalSteps]);

  const handlePrevious = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  }, [currentStep]);

  // Submit handler
  const handleSubmit = useCallback(async () => {
    if (!formData.sessionId) return;

    const submitPayload = {
      data: formData as TutorLogFormData,
      createdBy: selectedStaffId,
    };

    setSubmissionState('submitting');
    setSubmissionError(null);
    try {
      await createMutation.mutateAsync(submitPayload);
      setSubmissionState('success');
    } catch (error: unknown) {
      console.error('❌ [LogSessionModal] Failed to create tutor log:', error);
      setSubmissionState('error');
      setSubmissionError(
        error instanceof Error
          ? error.message
          : 'Failed to submit log. Please try again.'
      );
    }
  }, [formData, selectedStaffId, createMutation]);

  // Close handler
  const handleClose = useCallback(() => {
    if (submissionState === 'success') {
      onClose();
    }
  }, [submissionState, onClose]);

  // Try again handler
  const handleTryAgain = useCallback(() => {
    setSubmissionState('idle');
    setSubmissionError(null);
  }, []);

  // Add staff to session handler
  const handleAddStaffToSession = useCallback(
    async (staffId: string) => {
      if (!formData.sessionId) return;
      await sessionsApi.assignStaffToSession(formData.sessionId, staffId);
    },
    [formData.sessionId]
  );

  // Check if can proceed to next step
  const canGoNext = useMemo(() => {
    return canProceedToNextLogStep(
      currentStep,
      adminMode,
      formData,
      selectedStaffId,
      selectedSession
    );
  }, [currentStep, adminMode, formData, selectedStaffId, selectedSession]);

  return {
    // State
    currentStep,
    selectedStaffId,
    formData,
    submissionState,
    submissionError,
    totalSteps,

    // Data
    selectedStaff: selectedStaff || null,
    selectedSession,
    sessionClassData,
    sessionSubject,
    sessionStaff,
    sessionStudents,

    // Actions
    setSelectedStaffId,
    updateFormData,
    handleNext,
    handlePrevious,
    handleSubmit,
    handleClose,
    handleTryAgain,
    handleAddStaffToSession,
    canGoNext,
  };
}
