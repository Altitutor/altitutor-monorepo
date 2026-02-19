'use client';

import { useCallback } from 'react';
import { getStudentClasses, getStudentClassesWithStartDates, getStaffClasses, getStaffClassesWithStartDates } from '../api/bulk';
import { formatClassesList, formatClassesWithStartDatesList } from '../utils/classFormatters';
import { getInviteUrlForStudent, getInviteUrlForStaff } from '@/shared/utils/invites';
import { generateLinkTokensForStudent, generateLinkTokensForStaff } from '../utils/generateLinkTokens';
import {
  getVariablesForRecipientType,
  STUDENT_SUB_VARIABLES,
  parseStudentSubVariable,
  canGenerateStudentVariable,
  canGenerateStaffVariable,
  canGenerateParentVariable,
  type RecipientType,
  type TemplateVariable,
} from '../utils/variableConfig';
import type { Tables } from '@altitutor/shared';

/** Contact data shape from getContactForTemplate - uses partial types from API response */
type ContactForTemplate = {
  contact_type: string;
  students?: { id: string; first_name: string | null; last_name: string | null; status?: string; user_id?: string | null } | null;
  parents?: {
    id: string;
    first_name: string;
    last_name: string;
    parents_students?: Array<{ students: { id: string; first_name: string | null; last_name: string | null; status?: string; user_id?: string | null } | null }>;
  } | null;
  staff?: { id: string; first_name: string | null; last_name: string | null; role?: string | null; user_id?: string | null } | null;
} | null;

type ParentWithStudents = {
  id: string;
  first_name: string;
  last_name: string;
  parents_students?: Array<{ students: Tables<'students'> | null }>;
};

/** Normalize parent to Tables<'parents'> shape */
function toParentTable(parentData: ParentWithStudents): Tables<'parents'> {
  return {
    id: parentData.id,
    first_name: parentData.first_name || '',
    last_name: parentData.last_name || '',
    email: null,
    phone: null,
    user_id: null,
    invite_token: null,
    created_by: null,
    created_at: null,
    updated_at: null,
  };
}

export function useVariableReplacement(
  contactData: ContactForTemplate,
  studentHasClasses: Record<string, boolean>,
  staffHasClasses: Record<string, boolean>,
  currentStaff: Pick<Tables<'staff'>, 'first_name' | 'last_name'> | null | undefined,
  setIsGeneratingTokens: (value: boolean) => void
) {
  const senderName = currentStaff
    ? `${currentStaff.first_name || ''} ${currentStaff.last_name || ''}`.trim()
    : '';

  const resolveStudentVariable = useCallback(
    async (
      student: Tables<'students'>,
      variable: string,
      setGenerating: (v: boolean) => void
    ): Promise<string> => {
      if (variable === 'first_name') return student.first_name || '';
      if (variable === 'full_name')
        return `${student.first_name || ''} ${student.last_name || ''}`.trim();
      if (variable === 'last_name') return student.last_name || '';

      if (variable === 'classes') {
        try {
          const classes = await getStudentClasses(student.id);
          return formatClassesList(classes, 'No classes enrolled');
        } catch (error) {
          console.error('Error fetching student classes:', error);
          return 'No classes enrolled';
        }
      }

      if (variable === 'classes_with_start_date') {
        try {
          const classesWithDates = await getStudentClassesWithStartDates(student.id);
          return formatClassesWithStartDatesList(classesWithDates, 'No classes enrolled');
        } catch (error) {
          console.error('Error fetching classes with start dates:', error);
          try {
            const classes = await getStudentClasses(student.id);
            return formatClassesList(classes, 'No classes enrolled');
          } catch (fallbackError) {
            console.error('Error fetching student classes:', fallbackError);
            return 'No classes enrolled';
          }
        }
      }

      if (variable === 'registration_link') {
        try {
          setGenerating(true);
          const linkTokens = await generateLinkTokensForStudent(student.id, {
            includeRegistration: true,
            includeInvite: false,
            includePasswordReset: false,
          });
          if (linkTokens?.registrationToken) {
            return getInviteUrlForStudent(linkTokens.registrationToken, 'register');
          }
        } catch (error) {
          console.error('Error generating registration link:', error);
        } finally {
          setGenerating(false);
        }
        return '';
      }

      if (variable === 'invite_link') {
        try {
          setGenerating(true);
          const linkTokens = await generateLinkTokensForStudent(student.id, {
            includeRegistration: false,
            includeInvite: true,
            includePasswordReset: false,
          });
          if (linkTokens?.inviteToken) {
            return getInviteUrlForStudent(linkTokens.inviteToken, 'invite');
          }
        } catch (error) {
          console.error('Error generating invite link:', error);
        } finally {
          setGenerating(false);
        }
        return '';
      }

      if (variable === 'forgot_password_link') {
        try {
          setGenerating(true);
          const linkTokens = await generateLinkTokensForStudent(student.id, {
            includeRegistration: false,
            includeInvite: false,
            includePasswordReset: true,
          });
          if (linkTokens?.forgotPasswordLink) return linkTokens.forgotPasswordLink;
        } catch (error) {
          console.error('Error generating password reset link:', error);
        } finally {
          setGenerating(false);
        }
        return '';
      }

      return `{${variable}}`;
    },
    []
  );

  const getVariableValue = useCallback(
    async (variable: string): Promise<string> => {
      if (variable === 'sender_name') return senderName;

      if (!contactData) return `{${variable}}`;

      const contact = contactData;

      if (contact.contact_type === 'STUDENT' && contact.students) {
        const student = contact.students as Tables<'students'>;
        return resolveStudentVariable(student, variable, setIsGeneratingTokens);
      }

      if (contact.contact_type === 'PARENT' && contact.parents) {
        const parentData = contact.parents as ParentWithStudents;
        const parent = toParentTable(parentData);
        const parentStudents = parentData.parents_students || [];

        if (variable === 'parent_first_name') return parent.first_name || '';
        if (variable === 'parent_full_name')
          return `${parent.first_name || ''} ${parent.last_name || ''}`.trim();
        if (variable === 'parent_last_name') return parent.last_name || '';

        const parsed = parseStudentSubVariable(variable);
        if (parsed) {
          const { index, variable: subVariable } = parsed;
          const studentIndex = index - 1;
          if (
            studentIndex < 0 ||
            studentIndex >= parentStudents.length ||
            !parentStudents[studentIndex]?.students
          ) {
            return '';
          }
          const student = parentStudents[studentIndex].students!;
          return resolveStudentVariable(student, subVariable, setIsGeneratingTokens);
        }
      }

      if (contact.contact_type === 'STAFF' && contact.staff) {
        const staff = contact.staff as Tables<'staff'>;

        if (variable === 'first_name') return staff.first_name || '';
        if (variable === 'full_name')
          return `${staff.first_name || ''} ${staff.last_name || ''}`.trim();
        if (variable === 'last_name') return staff.last_name || '';

        if (variable === 'classes') {
          try {
            const classes = await getStaffClasses(staff.id);
            return formatClassesList(classes, 'No classes assigned');
          } catch (error) {
            console.error('Error fetching staff classes:', error);
            return 'No classes assigned';
          }
        }

        if (variable === 'classes_with_start_date') {
          try {
            const classesWithDates = await getStaffClassesWithStartDates(staff.id);
            return formatClassesWithStartDatesList(classesWithDates, 'No classes assigned');
          } catch (error) {
            console.error('Error fetching staff classes with start dates:', error);
            try {
              const classes = await getStaffClasses(staff.id);
              return formatClassesList(classes, 'No classes assigned');
            } catch (fallbackError) {
              console.error('Error fetching staff classes:', fallbackError);
              return 'No classes assigned';
            }
          }
        }

        if (variable === 'invite_link') {
          try {
            setIsGeneratingTokens(true);
            const linkTokens = await generateLinkTokensForStaff(staff.id, staff.role, {
              includeInvite: true,
              includePasswordReset: false,
            });
            if (linkTokens?.inviteToken && staff.role) {
              return getInviteUrlForStaff(linkTokens.inviteToken, staff.role);
            }
          } catch (error) {
            console.error('Error generating invite link for staff:', error);
          } finally {
            setIsGeneratingTokens(false);
          }
          return '';
        }

        if (variable === 'forgot_password_link') {
          try {
            setIsGeneratingTokens(true);
            const linkTokens = await generateLinkTokensForStaff(staff.id, staff.role, {
              includeInvite: false,
              includePasswordReset: true,
            });
            if (linkTokens?.forgotPasswordLink) return linkTokens.forgotPasswordLink;
          } catch (error) {
            console.error('Error generating password reset link for staff:', error);
          } finally {
            setIsGeneratingTokens(false);
          }
          return '';
        }
      }

      return `{${variable}}`;
    },
    [
      senderName,
      contactData,
      resolveStudentVariable,
      setIsGeneratingTokens,
    ]
  );

  const getAvailableVariables = useCallback((): readonly TemplateVariable[] => {
    if (!contactData) {
      return getVariablesForRecipientType('STUDENT');
    }
    const contact = contactData;
    const allVariables = getVariablesForRecipientType(contact.contact_type as RecipientType);

    if (contact.contact_type === 'STUDENT' && contact.students) {
      const student = contact.students as Tables<'students'>;
      const hasClasses = studentHasClasses[student.id] ?? false;
      return allVariables.filter((v) =>
        canGenerateStudentVariable(v.name, student, hasClasses)
      );
    }

    if (contact.contact_type === 'STAFF' && contact.staff) {
      const staff = contact.staff as Tables<'staff'>;
      const hasClasses = staffHasClasses[staff.id] ?? false;
      return allVariables.filter((v) =>
        canGenerateStaffVariable(v.name, staff, hasClasses)
      );
    }

    if (contact.contact_type === 'PARENT' && contact.parents) {
      const parent = contact.parents as ParentWithStudents;
      return allVariables.filter((v) =>
        canGenerateParentVariable(v.name, parent)
      );
    }

    return allVariables;
  }, [contactData, studentHasClasses, staffHasClasses]);

  const getParentStudents = useCallback((): Tables<'students'>[] => {
    if (!contactData || contactData.contact_type !== 'PARENT' || !contactData.parents) {
      return [];
    }
    const parent = contactData.parents as ParentWithStudents;
    const parentStudents = parent.parents_students || [];
    return parentStudents
      .map((ps) => ps.students)
      .filter((s): s is Tables<'students'> => s != null)
      .sort((a, b) => {
        const nameA = `${a.first_name || ''} ${a.last_name || ''}`.trim().toLowerCase();
        const nameB = `${b.first_name || ''} ${b.last_name || ''}`.trim().toLowerCase();
        return nameA.localeCompare(nameB);
      });
  }, [contactData]);

  return {
    getVariableValue,
    getAvailableVariables,
    getParentStudents,
  };
}
