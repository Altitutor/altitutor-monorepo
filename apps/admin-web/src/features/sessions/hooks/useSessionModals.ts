import { useState, useCallback } from 'react';

interface UseSessionModalsReturn {
  // Modal states
  isStudentModalOpen: boolean;
  selectedStudentId: string | null;
  isStaffModalOpen: boolean;
  selectedStaffId: string | null;
  isClassModalOpen: boolean;
  selectedClassId: string | null;
  isLogSessionModalOpen: boolean;
  isEditTutorLogModalOpen: boolean;
  isBookingConfirmationDialogOpen: boolean;
  selectedStudentForBookingConfirmation: string | null;
  isLogStudentAbsenceDialogOpen: boolean;
  selectedStudentForAbsence: string | null;
  isLogStaffAbsenceDialogOpen: boolean;
  selectedStaffForAbsence: string | null;
  isAddStudentToSessionModalOpen: boolean;
  isAddStaffToSessionModalOpen: boolean;
  isRemoveFromSessionDialogOpen: boolean;
  removeFromSessionTarget: { entityType: 'student' | 'staff'; entityId: string; entityName: string } | null;

  // Actions
  openStudentModal: (studentId: string) => void;
  closeStudentModal: () => void;
  openStaffModal: (staffId: string) => void;
  closeStaffModal: () => void;
  openClassModal: (classId: string) => void;
  closeClassModal: () => void;
  openLogSessionModal: () => void;
  closeLogSessionModal: () => void;
  openEditTutorLogModal: () => void;
  closeEditTutorLogModal: () => void;
  openBookingConfirmationDialog: (studentId: string) => void;
  closeBookingConfirmationDialog: () => void;
  openLogStudentAbsenceDialog: (studentId: string) => void;
  closeLogStudentAbsenceDialog: () => void;
  openLogStaffAbsenceDialog: (staffId: string) => void;
  closeLogStaffAbsenceDialog: () => void;
  openAddStudentToSessionModal: () => void;
  closeAddStudentToSessionModal: () => void;
  openAddStaffToSessionModal: () => void;
  closeAddStaffToSessionModal: () => void;
  openRemoveFromSessionDialog: (target: { entityType: 'student' | 'staff'; entityId: string; entityName: string }) => void;
  closeRemoveFromSessionDialog: () => void;
  reset: () => void;
}

/**
 * Hook for managing all session-related modal states
 */
export function useSessionModals(): UseSessionModalsReturn {
  const [isStudentModalOpen, setIsStudentModalOpen] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [isStaffModalOpen, setIsStaffModalOpen] = useState(false);
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);
  const [isClassModalOpen, setIsClassModalOpen] = useState(false);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [isLogSessionModalOpen, setIsLogSessionModalOpen] = useState(false);
  const [isEditTutorLogModalOpen, setIsEditTutorLogModalOpen] = useState(false);
  const [isBookingConfirmationDialogOpen, setIsBookingConfirmationDialogOpen] = useState(false);
  const [selectedStudentForBookingConfirmation, setSelectedStudentForBookingConfirmation] = useState<string | null>(null);
  const [isLogStudentAbsenceDialogOpen, setIsLogStudentAbsenceDialogOpen] = useState(false);
  const [selectedStudentForAbsence, setSelectedStudentForAbsence] = useState<string | null>(null);
  const [isLogStaffAbsenceDialogOpen, setIsLogStaffAbsenceDialogOpen] = useState(false);
  const [selectedStaffForAbsence, setSelectedStaffForAbsence] = useState<string | null>(null);
  const [isAddStudentToSessionModalOpen, setIsAddStudentToSessionModalOpen] = useState(false);
  const [isAddStaffToSessionModalOpen, setIsAddStaffToSessionModalOpen] = useState(false);
  const [isRemoveFromSessionDialogOpen, setIsRemoveFromSessionDialogOpen] = useState(false);
  const [removeFromSessionTarget, setRemoveFromSessionTarget] = useState<{ entityType: 'student' | 'staff'; entityId: string; entityName: string } | null>(null);

  const openStudentModal = useCallback((studentId: string) => {
    setSelectedStudentId(studentId);
    setIsStudentModalOpen(true);
  }, []);

  const closeStudentModal = useCallback(() => {
    setIsStudentModalOpen(false);
    setSelectedStudentId(null);
  }, []);

  const openStaffModal = useCallback((staffId: string) => {
    setSelectedStaffId(staffId);
    setIsStaffModalOpen(true);
  }, []);

  const closeStaffModal = useCallback(() => {
    setIsStaffModalOpen(false);
    setSelectedStaffId(null);
  }, []);

  const openClassModal = useCallback((classId: string) => {
    setSelectedClassId(classId);
    setIsClassModalOpen(true);
  }, []);

  const closeClassModal = useCallback(() => {
    setIsClassModalOpen(false);
    setSelectedClassId(null);
  }, []);

  const openLogSessionModal = useCallback(() => {
    setIsLogSessionModalOpen(true);
  }, []);

  const closeLogSessionModal = useCallback(() => {
    setIsLogSessionModalOpen(false);
  }, []);

  const openEditTutorLogModal = useCallback(() => {
    setIsEditTutorLogModalOpen(true);
  }, []);

  const closeEditTutorLogModal = useCallback(() => {
    setIsEditTutorLogModalOpen(false);
  }, []);

  const openBookingConfirmationDialog = useCallback((studentId: string) => {
    setSelectedStudentForBookingConfirmation(studentId);
    setIsBookingConfirmationDialogOpen(true);
  }, []);

  const closeBookingConfirmationDialog = useCallback(() => {
    setIsBookingConfirmationDialogOpen(false);
    setSelectedStudentForBookingConfirmation(null);
  }, []);

  const openLogStudentAbsenceDialog = useCallback((studentId: string) => {
    setSelectedStudentForAbsence(studentId);
    setIsLogStudentAbsenceDialogOpen(true);
  }, []);

  const closeLogStudentAbsenceDialog = useCallback(() => {
    setIsLogStudentAbsenceDialogOpen(false);
    setSelectedStudentForAbsence(null);
  }, []);

  const openLogStaffAbsenceDialog = useCallback((staffId: string) => {
    setSelectedStaffForAbsence(staffId);
    setIsLogStaffAbsenceDialogOpen(true);
  }, []);

  const closeLogStaffAbsenceDialog = useCallback(() => {
    setIsLogStaffAbsenceDialogOpen(false);
    setSelectedStaffForAbsence(null);
  }, []);

  const openAddStudentToSessionModal = useCallback(() => {
    setIsAddStudentToSessionModalOpen(true);
  }, []);

  const closeAddStudentToSessionModal = useCallback(() => {
    setIsAddStudentToSessionModalOpen(false);
  }, []);

  const openAddStaffToSessionModal = useCallback(() => {
    setIsAddStaffToSessionModalOpen(true);
  }, []);

  const closeAddStaffToSessionModal = useCallback(() => {
    setIsAddStaffToSessionModalOpen(false);
  }, []);

  const openRemoveFromSessionDialog = useCallback((target: { entityType: 'student' | 'staff'; entityId: string; entityName: string }) => {
    setRemoveFromSessionTarget(target);
    setIsRemoveFromSessionDialogOpen(true);
  }, []);

  const closeRemoveFromSessionDialog = useCallback(() => {
    setIsRemoveFromSessionDialogOpen(false);
    setRemoveFromSessionTarget(null);
  }, []);

  const reset = useCallback(() => {
    setIsStudentModalOpen(false);
    setSelectedStudentId(null);
    setIsStaffModalOpen(false);
    setSelectedStaffId(null);
    setIsClassModalOpen(false);
    setSelectedClassId(null);
    setIsLogSessionModalOpen(false);
    setIsEditTutorLogModalOpen(false);
    setIsBookingConfirmationDialogOpen(false);
    setSelectedStudentForBookingConfirmation(null);
    setIsLogStudentAbsenceDialogOpen(false);
    setSelectedStudentForAbsence(null);
    setIsLogStaffAbsenceDialogOpen(false);
    setSelectedStaffForAbsence(null);
    setIsAddStudentToSessionModalOpen(false);
    setIsAddStaffToSessionModalOpen(false);
    setIsRemoveFromSessionDialogOpen(false);
    setRemoveFromSessionTarget(null);
  }, []);

  return {
    isStudentModalOpen,
    selectedStudentId,
    isStaffModalOpen,
    selectedStaffId,
    isClassModalOpen,
    selectedClassId,
    isLogSessionModalOpen,
    isEditTutorLogModalOpen,
    isBookingConfirmationDialogOpen,
    selectedStudentForBookingConfirmation,
    isLogStudentAbsenceDialogOpen,
    selectedStudentForAbsence,
    isLogStaffAbsenceDialogOpen,
    selectedStaffForAbsence,
    isAddStudentToSessionModalOpen,
    isAddStaffToSessionModalOpen,
    isRemoveFromSessionDialogOpen,
    removeFromSessionTarget,
    openStudentModal,
    closeStudentModal,
    openStaffModal,
    closeStaffModal,
    openClassModal,
    closeClassModal,
    openLogSessionModal,
    closeLogSessionModal,
    openEditTutorLogModal,
    closeEditTutorLogModal,
    openBookingConfirmationDialog,
    closeBookingConfirmationDialog,
    openLogStudentAbsenceDialog,
    closeLogStudentAbsenceDialog,
    openLogStaffAbsenceDialog,
    closeLogStaffAbsenceDialog,
    openAddStudentToSessionModal,
    closeAddStudentToSessionModal,
    openAddStaffToSessionModal,
    closeAddStaffToSessionModal,
    openRemoveFromSessionDialog,
    closeRemoveFromSessionDialog,
    reset,
  };
}
