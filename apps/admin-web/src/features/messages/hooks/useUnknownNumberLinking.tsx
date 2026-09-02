'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@altitutor/ui';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import { AddStudentModal } from '@/features/students/components/AddStudentModal';
import { AddParentModal } from '@/features/parents/components/AddParentModal';
import { AddStaffModal } from '@/features/staff/components/AddStaffModal';
import { studentsApi } from '@/features/students/api/students';
import { studentsKeys, useUpdateStudent } from '@/features/students/hooks/useStudentsQuery';
import { useUpdateParent } from '@/features/parents/hooks/useParentsQuery';
import { staffApi } from '@/features/staff/api/staff';
import { staffKeys, useUpdateStaff } from '@/features/staff/hooks/useStaffQuery';
import { messagesKeys } from '@/features/messages/api/queryKeys';
import type { Database } from '@altitutor/shared';
import type { SupabaseClient } from '@supabase/supabase-js';

export type LinkableContact = {
  phone_e164?: string | null;
  students?: { id: string } | null;
  parents?: { id: string } | null;
  staff?: { id: string } | null;
} | null;

export type UnknownNumberHeaderProps = {
  showUnknownNumberActions: boolean;
  isLinkingPhone: boolean;
  studentOptionsWithoutPhone: Array<{ id: string; label: string }>;
  parentOptionsWithoutPhone: Array<{ id: string; label: string }>;
  staffOptionsWithoutPhone: Array<{ id: string; label: string }>;
  onCreateStudent: () => void;
  onCreateParent: () => void;
  onCreateStaff: () => void;
  onAssignStudent: (studentId: string) => Promise<void>;
  onAssignParent: (parentId: string) => Promise<void>;
  onAssignStaff: (staffId: string) => Promise<void>;
};

export function useUnknownNumberLinking(args: {
  contactId: string | null;
  contact: LinkableContact | undefined;
  enabled?: boolean;
}): UnknownNumberHeaderProps & { linkingModals: ReactNode } {
  const { contactId, contact, enabled = true } = args;
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isAddStudentOpen, setIsAddStudentOpen] = useState(false);
  const [isAddParentOpen, setIsAddParentOpen] = useState(false);
  const [isAddStaffOpen, setIsAddStaffOpen] = useState(false);
  const [prefillPhoneForModal, setPrefillPhoneForModal] = useState<string | null>(null);
  const [isLinkingPhone, setIsLinkingPhone] = useState(false);

  const hasLinkedEntity =
    Boolean(contact?.students?.id) ||
    Boolean(contact?.parents?.id) ||
    Boolean(contact?.staff?.id);
  const showUnknownNumberActions = Boolean(contact?.phone_e164 && !hasLinkedEntity);
  const fetchEnabled = enabled && showUnknownNumberActions;

  const { data: students = [] } = useQuery({
    queryKey: studentsKeys.lists(),
    queryFn: studentsApi.getAllStudents,
    enabled: fetchEnabled,
    staleTime: 1000 * 60 * 3,
  });
  const { data: staff = [] } = useQuery({
    queryKey: staffKeys.lists(),
    queryFn: staffApi.getAllStaff,
    enabled: fetchEnabled,
    staleTime: 1000 * 60 * 3,
  });
  const { data: parentsWithoutPhone = [] } = useQuery({
    queryKey: ['parents', 'without-phone'],
    queryFn: async () => {
      const supabase = getSupabaseClient() as SupabaseClient<Database>;
      const { data, error } = await supabase
        .from('parents')
        .select('id, first_name, last_name, phone')
        .order('last_name', { ascending: true });
      if (error) throw error;
      return (data ?? []).filter((parent) => !parent.phone?.trim());
    },
    enabled: fetchEnabled,
  });

  const updateStudent = useUpdateStudent();
  const updateParent = useUpdateParent();
  const updateStaff = useUpdateStaff();

  const studentOptionsWithoutPhone = useMemo(
    () =>
      fetchEnabled
        ? students
            .filter((student) => !student.phone?.trim())
            .map((student) => ({
              id: student.id,
              label: `${student.first_name ?? ''} ${student.last_name ?? ''}`.trim() || 'Unnamed student',
            }))
        : [],
    [fetchEnabled, students]
  );

  const parentOptionsWithoutPhone = useMemo(
    () =>
      parentsWithoutPhone.map((parent) => ({
        id: parent.id,
        label: `${parent.first_name ?? ''} ${parent.last_name ?? ''}`.trim() || 'Unnamed parent',
      })),
    [parentsWithoutPhone]
  );

  const staffOptionsWithoutPhone = useMemo(
    () =>
      fetchEnabled
        ? staff
            .filter((staffMember) => !staffMember.phone_number?.trim())
            .map((staffMember) => ({
              id: staffMember.id,
              label: `${staffMember.first_name ?? ''} ${staffMember.last_name ?? ''}`.trim() || 'Unnamed staff member',
            }))
        : [],
    [fetchEnabled, staff]
  );

  const handleOpenCreateStudent = () => {
    setPrefillPhoneForModal(contact?.phone_e164 ?? null);
    setIsAddStudentOpen(true);
  };

  const handleOpenCreateParent = () => {
    setPrefillPhoneForModal(contact?.phone_e164 ?? null);
    setIsAddParentOpen(true);
  };

  const handleOpenCreateStaff = () => {
    setPrefillPhoneForModal(contact?.phone_e164 ?? null);
    setIsAddStaffOpen(true);
  };

  const invalidateAfterLink = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['contact', contactId] }),
      queryClient.invalidateQueries({ queryKey: messagesKeys.conversationsByContactBase() }),
      queryClient.invalidateQueries({ queryKey: ['students', 'list'] }),
      queryClient.invalidateQueries({ queryKey: ['parents', 'list'] }),
      queryClient.invalidateQueries({ queryKey: ['staff', 'list'] }),
    ]);
  };

  const linkConversationContact = async (
    entityType: 'student' | 'parent' | 'staff',
    entityId: string
  ) => {
    if (!contactId || !contact?.phone_e164) return;

    const supabase = getSupabaseClient() as SupabaseClient<Database>;
    const { error } = await supabase
      .from('contacts')
      .update({
        contact_type: entityType === 'student' ? 'STUDENT' : entityType === 'parent' ? 'PARENT' : 'STAFF',
        student_id: entityType === 'student' ? entityId : null,
        parent_id: entityType === 'parent' ? entityId : null,
        staff_id: entityType === 'staff' ? entityId : null,
      })
      .eq('id', contactId);

    if (error) throw error;
  };

  const handleAssignNumberToExisting = async (
    entityType: 'student' | 'parent' | 'staff',
    entityId: string
  ) => {
    if (!contact?.phone_e164 || !contactId) return;
    const phoneNumber = contact.phone_e164;

    setIsLinkingPhone(true);
    try {
      if (entityType === 'student') {
        await updateStudent.mutateAsync({
          id: entityId,
          data: { phone: phoneNumber },
        });
      } else if (entityType === 'parent') {
        await updateParent.mutateAsync({
          id: entityId,
          data: { phone: phoneNumber },
        });
      } else {
        await updateStaff.mutateAsync({
          id: entityId,
          data: { phone_number: phoneNumber },
        });
      }

      await linkConversationContact(entityType, entityId);
      await invalidateAfterLink();

      toast({
        title: 'Phone number linked',
        description: `Saved ${phoneNumber} to the selected ${entityType}.`,
      });
    } catch (error) {
      toast({
        title: 'Failed to link phone number',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLinkingPhone(false);
    }
  };

  const linkingModals = (
    <>
      <AddStudentModal
        isOpen={isAddStudentOpen}
        onClose={() => setIsAddStudentOpen(false)}
        onStudentAdded={() => {
          void invalidateAfterLink();
        }}
        initialPhone={prefillPhoneForModal}
      />
      <AddParentModal
        isOpen={isAddParentOpen}
        onClose={() => setIsAddParentOpen(false)}
        onParentAdded={() => {
          void invalidateAfterLink();
        }}
        initialPhone={prefillPhoneForModal}
      />
      <AddStaffModal
        isOpen={isAddStaffOpen}
        onClose={() => setIsAddStaffOpen(false)}
        onStaffAdded={() => {
          void invalidateAfterLink();
        }}
        initialPhone={prefillPhoneForModal}
      />
    </>
  );

  return {
    showUnknownNumberActions,
    isLinkingPhone,
    studentOptionsWithoutPhone,
    parentOptionsWithoutPhone,
    staffOptionsWithoutPhone,
    onCreateStudent: handleOpenCreateStudent,
    onCreateParent: handleOpenCreateParent,
    onCreateStaff: handleOpenCreateStaff,
    onAssignStudent: (studentId) => handleAssignNumberToExisting('student', studentId),
    onAssignParent: (parentId) => handleAssignNumberToExisting('parent', parentId),
    onAssignStaff: (staffId) => handleAssignNumberToExisting('staff', staffId),
    linkingModals,
  };
}
