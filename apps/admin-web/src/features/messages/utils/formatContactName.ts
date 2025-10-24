// Utility to format contact names based on type
export function formatContactName(conversation: any): string {
  const contact = conversation?.contacts;
  if (!contact) return contact?.phone_e164 || 'Unknown';

  switch (contact.contact_type) {
    case 'STUDENT': {
      const student = contact.students;
      if (student) {
        return `${student.first_name} ${student.last_name}`.trim();
      }
      return contact.display_name || contact.phone_e164;
    }
    case 'PARENT': {
      const parent = contact.parents;
      if (parent) {
        // Find the student(s) this parent is linked to
        const parentStudents = parent.parents_students || [];
        if (parentStudents.length > 0) {
          const firstStudent = parentStudents[0]?.students;
          const studentName = firstStudent ? `${firstStudent.first_name} ${firstStudent.last_name}`.trim() : '';
          return `${parent.first_name} ${parent.last_name}${studentName ? ` (parent of ${studentName})` : ''}`.trim();
        }
        return `${parent.first_name} ${parent.last_name}`.trim();
      }
      return contact.display_name || contact.phone_e164;
    }
    case 'STAFF': {
      const staff = contact.staff;
      if (staff) {
        return `${staff.first_name} ${staff.last_name}`.trim();
      }
      return contact.display_name || contact.phone_e164;
    }
    default:
      return contact.display_name || contact.phone_e164;
  }
}

