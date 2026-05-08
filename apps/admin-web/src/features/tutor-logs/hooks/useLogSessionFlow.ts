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
  resolveLogSessionWizardFlow,
  type LogSessionWizardFlow,
} from '../utils/logSessionHelpers';

export type SubmissionState = 'idle' | 'submitting' | 'success' | 'error';

export interface UseLogSessionFlowProps {
  isOpen: boolean;
  onClose: () => void;
  currentStaffId: string;
  adminMode?: boolean;
  initialSessionId?: string;
  initialStaffId?: string;
  /** When opening from a known meeting (non-class) session, use the short wizard from step 0. */
  initialSessionKind?: LogSessionWizardFlow;
}

export interface UseLogSessionFlowReturn {
  currentStep: number;
  selectedStaffId: string;
  formData: Partial<TutorLogFormData>;
  submissionState: SubmissionState;
  submissionError: string | null;
  totalSteps: number;
  wizardFlow: LogSessionWizardFlow;

  selectedStaff: Tables<'staff'> | null;
  selectedSession: Tables<'sessions'> | null;
  sessionClassData: Tables<'classes'> | null;
  sessionSubject: Tables<'subjects'> | null;
  sessionStaff: Tables<'staff'>[];
  sessionStudents: Tables<'students'>[];
  sessionParents: Array<Tables<'parents'> & { sessions_parents_id?: string }>;

  setSelectedStaffId: (staffId: string) => void;
  updateFormData: (updates: Partial<TutorLogFormData>) => void;
  handleNext: () => void;
  handlePrevious: () => void;
  handleSubmit: () => Promise<void>;
  handleClose: () => void;
  handleTryAgain: () => void;
  handleAddStaffToSession: (staffId: string) => Promise<void>;
  handleAddStudentToSession: (studentId: string) => Promise<void>;
  handleAddParentToSession: (parentId: string) => Promise<void>;
  canGoNext: boolean;
}

export function useLogSessionFlow({
  isOpen,
  onClose,
  currentStaffId,
  adminMode = false,
  initialSessionId,
  initialStaffId,
  initialSessionKind,
}: UseLogSessionFlowProps): UseLogSessionFlowReturn {
  const createMutation = useCreateTutorLog();

  const openingWizardFlow: LogSessionWizardFlow =
    initialSessionKind === 'meeting' ? 'meeting' : 'class';

  const initialStep = useMemo(
    () => calculateInitialStep(adminMode, initialSessionId, initialStaffId, openingWizardFlow),
    [adminMode, initialSessionId, initialStaffId, openingWizardFlow]
  );

  const [currentStep, setCurrentStep] = useState(initialStep);
  const [selectedStaffId, setSelectedStaffId] = useState<string>(
    initialStaffId || currentStaffId
  );
  const [formData, setFormData] = useState<Partial<TutorLogFormData>>(
    initialSessionId ? { sessionId: initialSessionId } : {}
  );
  const [submissionState, setSubmissionState] = useState<SubmissionState>('idle');
  const [submissionError, setSubmissionError] = useState<string | null>(null);

  const { data: selectedStaff } = useStaffById(selectedStaffId);

  const { data: sessionData } = useSessionForLogging(formData.sessionId);

  const selectedSession = sessionData?.session || null;
  const sessionClassData = sessionData?.classData || null;
  const sessionSubject = sessionData?.subject || null;
  const sessionStaff = sessionData?.staff || [];
  const sessionStudents = sessionData?.students || [];
  const sessionParents = sessionData?.parents || [];

  const wizardFlow = useMemo(
    () => resolveLogSessionWizardFlow(selectedSession, initialSessionKind),
    [selectedSession, initialSessionKind]
  );

  const totalSteps = useMemo(
    () => getLogSessionTotalSteps(!!adminMode, wizardFlow),
    [adminMode, wizardFlow]
  );

  const sessionParentIdsKey = useMemo(
    () => sessionParents.map((p) => p.id).sort().join(','),
    [sessionParents]
  );

  useEffect(() => {
    if (!selectedSession || selectedSession.type === 'CLASS') {
      setFormData((fd) =>
        fd.parentAttendance && fd.parentAttendance.length > 0 ? { ...fd, parentAttendance: [] } : fd
      );
      return;
    }
    const next = sessionParents.map((p) => ({ parentId: p.id, attended: false }));
    setFormData((fd) => ({ ...fd, parentAttendance: next }));
  }, [selectedSession?.id, selectedSession?.type, sessionParentIdsKey]);

  useEffect(() => {
    if (isOpen) {
      if (initialSessionId) {
        setFormData((prev) => ({ ...prev, sessionId: initialSessionId }));
      }
      if (initialStaffId) {
        setSelectedStaffId(initialStaffId);
      }
      const targetStep = calculateInitialStep(
        adminMode,
        initialSessionId,
        initialStaffId,
        openingWizardFlow
      );
      setCurrentStep(targetStep);
    }
  }, [isOpen, initialSessionId, initialStaffId, adminMode, openingWizardFlow]);

  useEffect(() => {
    if (!isOpen) {
      setCurrentStep(initialStep);
      setSelectedStaffId(initialStaffId || currentStaffId);
      setFormData(initialSessionId ? { sessionId: initialSessionId } : {});
      setSubmissionState('idle');
      setSubmissionError(null);
    }
  }, [isOpen, currentStaffId, initialSessionId, initialStaffId, initialStep]);

  const updateFormData = useCallback((updates: Partial<TutorLogFormData>) => {
    setFormData((prev) => ({ ...prev, ...updates }));
  }, []);

  const handleNext = useCallback(() => {
    if (currentStep >= totalSteps - 1) return;
    setCurrentStep(currentStep + 1);
  }, [currentStep, totalSteps]);

  const handlePrevious = useCallback(() => {
    if (currentStep <= 0) return;
    setCurrentStep(currentStep - 1);
  }, [currentStep]);

  const handleSubmit = useCallback(async () => {
    if (!formData.sessionId) return;

    const base = {
      ...(formData as TutorLogFormData),
      parentAttendance: formData.parentAttendance ?? [],
    };
    const data: TutorLogFormData =
      wizardFlow === 'meeting'
        ? { ...base, topics: [], topicFiles: [] }
        : base;

    const submitPayload = { data, createdBy: selectedStaffId };

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
  }, [formData, selectedStaffId, createMutation, wizardFlow]);

  const handleClose = useCallback(() => {
    if (submissionState === 'success') {
      onClose();
    }
  }, [submissionState, onClose]);

  const handleTryAgain = useCallback(() => {
    setSubmissionState('idle');
    setSubmissionError(null);
  }, []);

  const handleAddStaffToSession = useCallback(
    async (staffId: string) => {
      if (!formData.sessionId) return;
      await sessionsApi.assignStaffToSession(formData.sessionId, staffId);
    },
    [formData.sessionId]
  );

  const handleAddStudentToSession = useCallback(
    async (studentId: string) => {
      if (!formData.sessionId) return;
      await sessionsApi.addStudentToSession(formData.sessionId, studentId);
    },
    [formData.sessionId]
  );

  const handleAddParentToSession = useCallback(
    async (parentId: string) => {
      if (!formData.sessionId) return;
      await sessionsApi.addParentToSession(formData.sessionId, parentId);
    },
    [formData.sessionId]
  );

  const canGoNext = useMemo(() => {
    return canProceedToNextLogStep(
      currentStep,
      !!adminMode,
      wizardFlow,
      formData,
      selectedStaffId,
      selectedSession
    );
  }, [currentStep, adminMode, wizardFlow, formData, selectedStaffId, selectedSession]);

  return {
    currentStep,
    selectedStaffId,
    formData,
    submissionState,
    submissionError,
    totalSteps,
    wizardFlow,

    selectedStaff: selectedStaff || null,
    selectedSession,
    sessionClassData,
    sessionSubject,
    sessionStaff,
    sessionStudents,
    sessionParents,

    setSelectedStaffId,
    updateFormData,
    handleNext,
    handlePrevious,
    handleSubmit,
    handleClose,
    handleTryAgain,
    handleAddStaffToSession,
    handleAddStudentToSession,
    handleAddParentToSession,
    canGoNext,
  };
}
