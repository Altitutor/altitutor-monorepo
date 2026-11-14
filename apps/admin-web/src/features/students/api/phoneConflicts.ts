import { PARENT_PHONE_CONFLICT_MESSAGE } from '@/features/parents/api/errors';

const PHONE_CONFLICT = /^Phone number .+ is already associated with (another student|a student|a parent|a staff member) \(ID: .+\)$/;

const EXPLANATIONS: Record<string, string> = {
  'another student': 'This phone number is already linked to another student. Use a different number, or check the other student\'s contact details.',
  'a student': PARENT_PHONE_CONFLICT_MESSAGE,
  'a parent': 'This phone number is already linked to a parent. Use a different number for the student, or check the parent\'s contact details.',
  'a staff member': 'This phone number is already linked to a staff member. Use a different number.',
};

/** Phone uniqueness across people is intended validation; the database message carries the number and a record ID. */
export class PhoneConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PhoneConflictError';
  }
}

/** Returns an identifier-free explanation for a contact phone conflict raised by the database, or null. */
export function explainPhoneConflict(error: unknown): string | null {
  if (!error || typeof error !== 'object' || !('code' in error) || error.code !== 'P0001') return null;
  if (!('message' in error) || typeof error.message !== 'string') return null;
  const owner = PHONE_CONFLICT.exec(error.message)?.[1];
  return owner ? EXPLANATIONS[owner] : null;
}
