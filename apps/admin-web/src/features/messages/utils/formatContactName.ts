import type { ConversationWithRelations } from '../types';
import { messagingHandle } from './messagingHandle';

// Utility to format contact names based on type
export function formatContactName(conversation: ConversationWithRelations | { contacts: ConversationWithRelations['contacts'] }): string {
  const contact = 'contacts' in conversation ? conversation.contacts : conversation;
  if (!contact) return 'Unknown';

  switch (contact.contact_type) {
    case 'STUDENT': {
      const student = contact.students;
      if (student) {
        return `${student.first_name} ${student.last_name}`.trim();
      }
      return messagingHandle(contact) ?? 'Unknown';
    }
    case 'PARENT': {
      const parent = contact.parents;
      if (parent) {
        const studentNames = (parent.parents_students ?? [])
          .map(({ students }) => students ? `${students.first_name} ${students.last_name}`.trim() : '')
          .filter(Boolean)
          .join(', ');
        return `${parent.first_name} ${parent.last_name}${studentNames ? ` (parent of ${studentNames})` : ''}`.trim();
      }
      return messagingHandle(contact) ?? 'Unknown';
    }
    case 'STAFF': {
      const staff = contact.staff;
      if (staff) {
        return `${staff.first_name} ${staff.last_name}`.trim();
      }
      return messagingHandle(contact) ?? 'Unknown';
    }
    default:
      return messagingHandle(contact) ?? 'Unknown';
  }
}


