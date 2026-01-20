'use client';

import { useClassDetails } from '@/features/classes/hooks/useClassesQuery';
import { AssignStaffModal } from '@/features/enrollments';
import type { Tables } from '@altitutor/shared';

interface AssignStaffModalWrapperProps {
  isOpen: boolean;
  classId: string;
  currentStaffId: string;
  onClose: () => void;
  onAssign: (params: {
    staffId: string;
    classId: string;
    assignedAt: Date;
    currentStaffId: string;
  }) => Promise<void>;
}

/**
 * Wrapper component to handle class data fetching for AssignStaffModal
 */
export function AssignStaffModalWrapper({
  isOpen,
  classId,
  currentStaffId,
  onClose,
  onAssign,
}: AssignStaffModalWrapperProps) {
  const { data: classDetails, isLoading } = useClassDetails(classId, isOpen && !!classId);
  const classData = classDetails?.class || null;
  const classSubject = classDetails?.subject || null;
  const classStaff = classDetails?.staff || [];

  // Don't render modal until data is loaded
  if (!isOpen || isLoading || !classData || !classSubject) {
    return null;
  }

  return (
    <AssignStaffModal
      isOpen={isOpen}
      onClose={onClose}
      context="class"
      classData={classData}
      classSubject={classSubject}
      classStaff={classStaff}
      assignedStaffIds={classStaff.map((s: Tables<'staff'>) => s.id)}
      onAssign={onAssign}
      currentStaffId={currentStaffId}
    />
  );
}
