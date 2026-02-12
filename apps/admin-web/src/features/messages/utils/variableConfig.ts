/**
 * Centralized variable configuration for messaging templates
 * Defines available variables for each recipient type: students, parents, and staff
 */

export type RecipientType = 'STUDENT' | 'PARENT' | 'STAFF';

export interface TemplateVariable {
  name: string;
  description: string;
  example: string;
}

/**
 * Available variables for student recipients
 */
export const STUDENT_VARIABLES: readonly TemplateVariable[] = [
  {
    name: 'first_name',
    description: 'Student\'s first name',
    example: 'John',
  },
  {
    name: 'last_name',
    description: 'Student\'s last name',
    example: 'Smith',
  },
  {
    name: 'classes',
    description: 'Student\'s enrolled classes (formatted list)',
    example: '- SACE 12 Mathematics Mon 2:00 PM - 4:00 PM\n- SACE 12 Physics Wed 3:00 PM - 5:00 PM',
  },
  {
    name: 'classes_with_start_date',
    description: 'Student\'s enrolled classes with start dates (formatted list)',
    example: '- PRESACE 9 Mathematics Wed 1:30 PM - 3:00 PM starting on Wed 11th Feb\n- SACE 12 Physics Fri 3:00 PM - 5:00 PM starting on Fri 13th Feb',
  },
  {
    name: 'sender_name',
    description: 'Name of the currently logged in staff member',
    example: 'Jane Doe',
  },
  {
    name: 'registration_link',
    description: 'Registration link for students (students only)',
    example: 'https://student.altitutor.com/register/abc123...',
  },
  {
    name: 'invite_link',
    description: 'Invite link for students',
    example: 'https://student.altitutor.com/invite/abc123...',
  },
  {
    name: 'forgot_password_link',
    description: 'Password reset link',
    example: 'https://student.altitutor.com/auth/callback?token=...',
  },
] as const;

/**
 * Available variables for parent recipients
 * Includes parent-specific variables and nested student variables (e.g., parent.student1.first_name)
 */
export const PARENT_VARIABLES: readonly TemplateVariable[] = [
  {
    name: 'parent_first_name',
    description: 'Parent\'s first name',
    example: 'Jane',
  },
  {
    name: 'parent_full_name',
    description: 'Parent\'s full name (first and last)',
    example: 'Jane Smith',
  },
  {
    name: 'sender_name',
    description: 'Name of the currently logged in staff member',
    example: 'John Doe',
  },
] as const;

/**
 * Student sub-variables available under parent.student{N}.{variable}
 * These are dynamically generated for each student linked to the parent
 */
export const STUDENT_SUB_VARIABLES: readonly TemplateVariable[] = [
  {
    name: 'first_name',
    description: 'Student\'s first name',
    example: 'John',
  },
  {
    name: 'full_name',
    description: 'Student\'s full name (first and last)',
    example: 'John Smith',
  },
  {
    name: 'classes',
    description: 'Student\'s enrolled classes (formatted list)',
    example: '- SACE 12 Mathematics Mon 2:00 PM - 4:00 PM\n- SACE 12 Physics Wed 3:00 PM - 5:00 PM',
  },
  {
    name: 'classes_with_start_date',
    description: 'Student\'s enrolled classes with start dates (formatted list)',
    example: '- PRESACE 9 Mathematics Wed 1:30 PM - 3:00 PM starting on Wed 11th Feb\n- SACE 12 Physics Fri 3:00 PM - 5:00 PM starting on Fri 13th Feb',
  },
  {
    name: 'registration_link',
    description: 'Registration link for students',
    example: 'https://student.altitutor.com/register/abc123...',
  },
  {
    name: 'invite_link',
    description: 'Invite link for students',
    example: 'https://student.altitutor.com/invite/abc123...',
  },
  {
    name: 'forgot_password_link',
    description: 'Password reset link',
    example: 'https://student.altitutor.com/auth/callback?token=...',
  },
] as const;

/**
 * Generate a student sub-variable name (e.g., "parent.student1.first_name")
 */
export function getStudentSubVariableName(studentIndex: number, variableName: string): string {
  return `parent.student${studentIndex}.${variableName}`;
}

/**
 * Parse a student sub-variable name (e.g., "parent.student1.first_name" -> { index: 1, variable: "first_name" })
 */
export function parseStudentSubVariable(variableName: string): { index: number; variable: string } | null {
  const match = variableName.match(/^parent\.student(\d+)\.(.+)$/i);
  if (!match) return null;
  return {
    index: parseInt(match[1], 10),
    variable: match[2],
  };
}

/**
 * Available variables for staff recipients
 */
export const STAFF_VARIABLES: readonly TemplateVariable[] = [
  {
    name: 'first_name',
    description: 'Staff member\'s first name',
    example: 'Jane',
  },
  {
    name: 'full_name',
    description: 'Staff member\'s full name (first and last)',
    example: 'Jane Doe',
  },
  {
    name: 'classes',
    description: 'Staff member\'s assigned classes (formatted list)',
    example: '- SACE 12 Mathematics Mon 2:00 PM - 4:00 PM\n- SACE 12 Physics Wed 3:00 PM - 5:00 PM',
  },
  {
    name: 'classes_with_start_date',
    description: 'Staff member\'s assigned classes with start dates (formatted list)',
    example: '- PRESACE 9 Mathematics Wed 1:30 PM - 3:00 PM starting on Wed 11th Feb\n- SACE 12 Physics Fri 3:00 PM - 5:00 PM starting on Fri 13th Feb',
  },
  {
    name: 'sender_name',
    description: 'Name of the currently logged in staff member',
    example: 'John Smith',
  },
  {
    name: 'invite_link',
    description: 'Invite link for staff',
    example: 'https://tutor.altitutor.com/invite/abc123...',
  },
  {
    name: 'forgot_password_link',
    description: 'Password reset link',
    example: 'https://tutor.altitutor.com/auth/callback?token=...',
  },
] as const;

/**
 * Get available variables for a specific recipient type
 */
export function getVariablesForRecipientType(recipientType: RecipientType): readonly TemplateVariable[] {
  switch (recipientType) {
    case 'STUDENT':
      return STUDENT_VARIABLES;
    case 'PARENT':
      return PARENT_VARIABLES;
    case 'STAFF':
      return STAFF_VARIABLES;
    default:
      // Return all variables if type is unknown (for backward compatibility)
      return STUDENT_VARIABLES;
  }
}

/**
 * Get all variable names for a specific recipient type
 */
export function getVariableNamesForRecipientType(recipientType: RecipientType): readonly string[] {
  return getVariablesForRecipientType(recipientType).map(v => v.name);
}

/**
 * Check if a template contains any variables for a specific recipient type
 */
export function hasVariablesForRecipientType(template: string, recipientType: RecipientType): boolean {
  const variableNames = getVariableNamesForRecipientType(recipientType);
  const pattern = new RegExp(`\\{(${variableNames.join('|')})\\}`, 'gi');
  return pattern.test(template);
}

/**
 * Check if a template contains any variables (checks all recipient types)
 */
export function hasVariables(template: string): boolean {
  const allVariableNames = [
    ...STUDENT_VARIABLES.map(v => v.name),
    ...PARENT_VARIABLES.map(v => v.name),
    ...STAFF_VARIABLES.map(v => v.name),
  ];
  // Remove duplicates
  const uniqueVariableNames = [...new Set(allVariableNames)];
  const pattern = new RegExp(`\\{(${uniqueVariableNames.join('|')})\\}`, 'gi');
  
  // Also check for student sub-variables (parent.student{N}.{variable})
  const studentSubVariablePattern = /\{parent\.student\d+\.[\w_]+\}/gi;
  
  return pattern.test(template) || studentSubVariablePattern.test(template);
}

/**
 * Check if a student variable can be generated based on student data
 */
export function canGenerateStudentVariable(
  variableName: string,
  student: { first_name: string | null; last_name: string | null; status: string; user_id: string | null },
  hasClasses: boolean
): boolean {
  switch (variableName) {
    case 'first_name':
      // Can generate if first name is not null
      return student.first_name !== null;
    
    case 'full_name':
      // Can generate if at least first name is not null (last name can be empty)
      return student.first_name !== null;
    
    case 'classes':
    case 'classes_with_start_date':
      // Can generate if student is enrolled in any classes
      return hasClasses;
    
    case 'registration_link':
      // Can generate if student status is TRIAL (not ACTIVE)
      return student.status === 'TRIAL';
    
    case 'invite_link':
      // Can generate if student has no user_id
      return student.user_id === null;
    
    case 'forgot_password_link':
      // Can generate if student has a user_id
      return student.user_id !== null;
    
    case 'sender_name':
      // Always available
      return true;
    
    default:
      return true; // Default to showing unknown variables
  }
}

/**
 * Check if a staff variable can be generated based on staff data
 */
export function canGenerateStaffVariable(
  variableName: string,
  staff: { first_name: string | null; last_name: string | null; user_id: string | null },
  hasClasses: boolean
): boolean {
  switch (variableName) {
    case 'first_name':
      // Can generate if first name is not null
      return staff.first_name !== null;
    
    case 'full_name':
      // Can generate if at least first name is not null (last name can be empty)
      return staff.first_name !== null;
    
    case 'classes':
    case 'classes_with_start_date':
      // Can generate if staff is assigned to any classes
      return hasClasses;
    
    case 'invite_link':
      // Can generate if staff has no user_id
      return staff.user_id === null;
    
    case 'forgot_password_link':
      // Can generate if staff has a user_id
      return staff.user_id !== null;
    
    case 'sender_name':
      // Always available
      return true;
    
    default:
      return true; // Default to showing unknown variables
  }
}

/**
 * Check if a parent variable can be generated based on parent data
 */
export function canGenerateParentVariable(
  variableName: string,
  parent: { first_name: string | null; last_name: string | null }
): boolean {
  switch (variableName) {
    case 'parent_first_name':
      // Can generate if first name is not null
      return parent.first_name !== null;
    
    case 'parent_full_name':
      // Can generate if at least first name is not null (last name can be empty)
      return parent.first_name !== null;
    
    case 'sender_name':
      // Always available
      return true;
    
    default:
      return true; // Default to showing unknown variables
  }
}

/**
 * Legacy export for backward compatibility
 * Returns student variables (most common use case)
 * @deprecated Use getVariablesForRecipientType() instead
 */
export const TEMPLATE_VARIABLES = STUDENT_VARIABLES;
