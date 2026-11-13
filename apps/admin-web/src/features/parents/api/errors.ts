export const PARENT_PHONE_CONFLICT_MESSAGE = 'This phone number is already linked to a student. Use a different number for the parent, or check the student contact details.';

/** A specific contact-policy outcome; the original database event stays visible. */
export class ParentPhoneConflictError extends Error {
  constructor() {
    super(PARENT_PHONE_CONFLICT_MESSAGE);
    this.name = 'ParentPhoneConflictError';
  }
}
