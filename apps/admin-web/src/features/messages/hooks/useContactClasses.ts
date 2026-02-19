'use client';

import { useQueries, useQuery } from '@tanstack/react-query';
import { getStudentClasses, getStaffClasses } from '../api/bulk';
import { messagesKeys } from '../api/queryKeys';

/** Contact data shape from getContactForTemplate - uses partial types from API response */
type ContactForTemplate = {
  contact_type: string;
  students?: { id: string } | null;
  parents?: {
    id: string;
    first_name: string;
    last_name: string;
    parents_students?: Array<{ students: { id: string } | null }>;
  } | null;
  staff?: { id: string } | null;
} | null;

/**
 * Extracts all student and staff IDs from contact data for class lookup
 */
function getEntityIdsFromContact(contact: ContactForTemplate): {
  studentIds: string[];
  staffId: string | null;
} {
  if (!contact) return { studentIds: [], staffId: null };

  const studentIds: string[] = [];
  let staffId: string | null = null;

  if (contact.contact_type === 'STUDENT' && contact.students) {
    studentIds.push(contact.students.id);
  } else if (contact.contact_type === 'PARENT' && contact.parents?.parents_students) {
    for (const ps of contact.parents.parents_students) {
      const student = ps.students;
      if (student?.id) studentIds.push(student.id);
    }
  } else if (contact.contact_type === 'STAFF' && contact.staff) {
    staffId = contact.staff.id;
  }

  return { studentIds, staffId };
}

/**
 * React Query hook to fetch class availability for students and staff in a contact.
 * Replaces the useEffect-based fetching in Composer.
 * Returns maps of entity ID -> hasClasses (boolean) for filtering available variables.
 */
export function useContactClasses(contactData: ContactForTemplate): {
  studentHasClasses: Record<string, boolean>;
  staffHasClasses: Record<string, boolean>;
  isLoading: boolean;
} {
  const { studentIds, staffId } = getEntityIdsFromContact(contactData);

  const studentQueries = useQueries({
    queries: studentIds.map((studentId) => ({
      queryKey: messagesKeys.studentClasses(studentId),
      queryFn: async () => {
        const classes = await getStudentClasses(studentId);
        return classes.length > 0;
      },
      enabled: !!studentId,
      staleTime: 1000 * 60 * 2, // 2 minutes
    })),
  });

  const staffQuery = useQuery({
    queryKey: messagesKeys.staffClasses(staffId ?? ''),
    queryFn: async () => {
      if (!staffId) return false;
      const classes = await getStaffClasses(staffId);
      return classes.length > 0;
    },
    enabled: !!staffId,
    staleTime: 1000 * 60 * 2, // 2 minutes
  });

  const studentHasClasses: Record<string, boolean> = {};
  studentIds.forEach((id, i) => {
    const result = studentQueries[i]?.data;
    if (result !== undefined) studentHasClasses[id] = result;
  });

  const staffHasClasses: Record<string, boolean> = {};
  if (staffId && staffQuery.data !== undefined) {
    staffHasClasses[staffId] = staffQuery.data;
  }

  const isLoading =
    studentQueries.some((q) => q.isLoading) || (!!staffId && staffQuery.isLoading);

  return { studentHasClasses, staffHasClasses, isLoading };
}
